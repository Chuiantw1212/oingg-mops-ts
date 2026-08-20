import { type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { ingestOneQuarter, serializeBigInt, getLatestAvailableQuarter, getPastNQuarters, type IngestOneQuarterResult } from './ingest';
import { politeDelay } from '../../shared/politeDelay';

const requestSchema = z.object({
  companyId: z.string({ required_error: 'companyId is required.' }).min(1),
  year: z.string({ required_error: 'year is required.' }).min(1), // 民國年，例如 "114"
  season: z.enum(['1', '2', '3', '4'], { required_error: 'season is required.' }),
  dataType: z.enum(['1', '2']).default('2'), // 1 = 個體, 2 = 合併
  subsidiaryCompanyId: z.string().optional().default(''),
  force: z.boolean().optional().default(false), // true 時即使資料庫已有資料也強制重新抓取覆蓋
});

export const ingestCashFlowStatements = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validationResult = requestSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        message: 'Invalid request body.',
        errors: validationResult.error.format(),
      });
    }

    const result = await ingestOneQuarter(validationResult.data);

    if (result.error) {
      console.error(`[ingestCashFlowStatements] ${result.companyId} ${result.year}Q${result.season}:`, result.error);
      return next(new Error(result.error));
    }

    if (!result.success) {
      return res.status(502).json({
        message: 'MOPS API did not return a usable report.',
        mopsMessage: result.mopsMessage,
      });
    }

    if (result.warnings.length > 0) {
      console.warn(`[ingestCashFlowStatements] ${result.companyId} ${result.year}Q${result.season}:`, result.warnings);
    }

    res.status(result.skipped ? 200 : 201).json({
      message: result.skipped
        ? 'Record already exists in database, skipped fetching from MOPS. Pass force=true to overwrite.'
        : 'Successfully ingested cash flow statement.',
      skipped: result.skipped,
      warnings: result.warnings,
      record: serializeBigInt(result.record),
    });
  } catch (error) {
    console.error('Ingestion failed:', error);
    next(error); // 將錯誤傳遞給中央錯誤處理器
  }
};

const backfillSchema = z.object({
  companyId: z.string({ required_error: 'companyId is required.' }).min(1),
  dataType: z.enum(['1', '2']).default('2'), // 1 = 個體, 2 = 合併
  subsidiaryCompanyId: z.string().optional().default(''),
  years: z.coerce.number().int().min(1).max(20).default(5),
  force: z.boolean().optional().default(false), // true 時每一季都強制重新向 MOPS 抓取並覆蓋
});

export const backfillCashFlowStatements = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validationResult = backfillSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        message: 'Invalid request body.',
        errors: validationResult.error.format(),
      });
    }
    const { companyId, dataType, subsidiaryCompanyId, years, force } = validationResult.data;

    // 終點季度依法定公告截止日判斷（同損益表/資產負債表規則），往前數 years*4 季。
    const quarterCount = years * 4;
    const latestAvailable = getLatestAvailableQuarter(new Date());
    const quarters = getPastNQuarters(latestAvailable, quarterCount);

    console.log(
      `[backfill-cash-flow] Starting backfill for ${companyId} (dataType=${dataType}, force=${force}): ${quarters.length} quarters, ` +
        `${quarters[0]!.year}Q${quarters[0]!.season} ~ ${quarters[quarters.length - 1]!.year}Q${quarters[quarters.length - 1]!.season}`
    );

    const results: IngestOneQuarterResult[] = [];
    for (let i = 0; i < quarters.length; i++) {
      const { year, season } = quarters[i]!;
      const progress = `(${i + 1}/${quarters.length})`;

      const result = await ingestOneQuarter({ companyId, year, season, dataType, subsidiaryCompanyId, force });
      results.push(result);

      if (result.skipped) {
        console.log(`[backfill-cash-flow] ${progress} SKIP (already in DB) ${companyId} ${year}Q${season}`);
      } else if (result.success) {
        console.log(`[backfill-cash-flow] ${progress} FETCHED ${companyId} ${year}Q${season}${result.warnings.length ? ` (${result.warnings.length} warnings)` : ''}`);
      } else {
        console.log(`[backfill-cash-flow] ${progress} NO DATA ${companyId} ${year}Q${season}: ${result.error ?? result.mopsMessage}`);
      }

      // 只有真的呼叫過 MOPS（非 skip）才需要間隔；最後一筆之後不需要等待。間隔用隨機浮動（見 politeDelay）。
      if (!result.skipped && i < quarters.length - 1) {
        await politeDelay();
      }
    }

    const fetched = results.filter((r) => r.success && !r.skipped).length;
    const skipped = results.filter((r) => r.skipped).length;
    const succeeded = results.filter((r) => r.success).length;
    console.log(`[backfill-cash-flow] Done. ${succeeded}/${quarters.length} succeeded for ${companyId} (${fetched} fetched from MOPS, ${skipped} already in DB).`);

    res.status(200).json({
      message: `Backfill completed for ${companyId}.`,
      total: quarters.length,
      succeeded,
      failed: quarters.length - succeeded,
      fetched,
      skipped,
      results: serializeBigInt(results),
    });
  } catch (error) {
    console.error('Backfill failed:', error);
    next(error);
  }
};
