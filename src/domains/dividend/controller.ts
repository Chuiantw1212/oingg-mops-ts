import { type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { serializeBigInt } from '../../shared/serializeBigInt';
import { politeDelay } from '../../shared/politeDelay';
import { ingestDividendDistributionYear, type IngestDividendYearResult } from './ingest';

const requestSchema = z.object({
  companyId: z.string({ required_error: 'companyId is required.' }).min(1),
  year: z.string({ required_error: 'year is required.' }).min(1), // 民國年，篩選「公告」落在這個民國年的股利分派事件
  typek: z.enum(['sii', 'otc']).default('sii'),
  force: z.boolean().optional().default(false),
});

export const ingestDividendDistributions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validationResult = requestSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        message: 'Invalid request body.',
        errors: validationResult.error.format(),
      });
    }

    const result = await ingestDividendDistributionYear(validationResult.data);

    if (!result.success) {
      return res.status(502).json({
        message: 'Failed to fetch dividend distribution data from MOPS.',
        error: result.error,
      });
    }

    res.status(200).json({
      message: `Ingested dividend distribution data for ${result.companyId} ${result.year}: ${result.fetched} fetched, ${result.skipped} skipped.`,
      ...serializeBigInt(result),
    });
  } catch (error) {
    console.error('Dividend distribution ingestion failed:', error);
    next(error);
  }
};

const backfillSchema = z.object({
  companyId: z.string({ required_error: 'companyId is required.' }).min(1),
  typek: z.enum(['sii', 'otc']).default('sii'),
  years: z.coerce.number().int().min(1).max(20).default(5),
  force: z.boolean().optional().default(false),
});

// 回補單一公司過去 N 個民國年的股利分派公告。這個端點沒有「季度」概念，也沒有其他 domain 用的
// 「整個時段已在資料庫中就跳過」邏輯——每一年都會真的呼叫 MOPS（見 ingest.ts 說明），
// 每次真正呼叫之間用隨機浮動間隔（politeDelay），跟其他 domain 一致。
export const backfillDividendDistributions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validationResult = backfillSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        message: 'Invalid request body.',
        errors: validationResult.error.format(),
      });
    }
    const { companyId, typek, years, force } = validationResult.data;

    const currentRocYear = new Date().getFullYear() - 1911;
    const targetYears = Array.from({ length: years }, (_, i) => String(currentRocYear - years + 1 + i));

    console.log(
      `[dividend-backfill] Starting for ${companyId} (typek=${typek}, force=${force}): ${targetYears.length} years, ${targetYears[0]} ~ ${targetYears[targetYears.length - 1]!}`
    );

    const results: IngestDividendYearResult[] = [];
    for (let i = 0; i < targetYears.length; i++) {
      const year = targetYears[i]!;
      const result = await ingestDividendDistributionYear({ companyId, year, typek, force });
      results.push(result);

      if (result.success) {
        console.log(`[dividend-backfill] (${i + 1}/${targetYears.length}) ${companyId} ${year}: ${result.fetched} fetched, ${result.skipped} skipped.`);
      } else {
        console.log(`[dividend-backfill] (${i + 1}/${targetYears.length}) ${companyId} ${year}: FAILED - ${result.error}`);
      }

      if (i < targetYears.length - 1) {
        await politeDelay();
      }
    }

    const succeeded = results.filter((r) => r.success).length;
    const totalFetched = results.reduce((sum, r) => sum + r.fetched, 0);
    const totalSkipped = results.reduce((sum, r) => sum + r.skipped, 0);
    console.log(`[dividend-backfill] Done. ${succeeded}/${targetYears.length} years succeeded for ${companyId} (${totalFetched} fetched, ${totalSkipped} skipped).`);

    res.status(200).json({
      message: `Backfill completed for ${companyId}. ${succeeded}/${targetYears.length} years succeeded (${totalFetched} records fetched, ${totalSkipped} skipped).`,
      companyId,
      years: targetYears.length,
      succeeded,
      totalFetched,
      totalSkipped,
      results: serializeBigInt(results),
    });
  } catch (error) {
    console.error('Dividend distribution backfill failed:', error);
    next(error);
  }
};
