import { type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { ingestOneQuarter as ingestIncomeStatement } from '../incomeStatement/ingest';
import { ingestOneQuarter as ingestBalanceSheet } from '../balanceSheet/ingest';
import { ingestOneQuarter as ingestCashFlow } from '../cashFlow/ingest';
import { serializeBigInt } from '../../shared/serializeBigInt';

const requestSchema = z.object({
  companyId: z.string({ required_error: 'companyId is required.' }).min(1),
  year: z.string({ required_error: 'year is required.' }).min(1), // 民國年，例如 "114"
  season: z.enum(['1', '2', '3', '4'], { required_error: 'season is required.' }),
  dataType: z.enum(['1', '2']).default('2'), // 1 = 個體, 2 = 合併
  subsidiaryCompanyId: z.string().optional().default(''),
  force: z.boolean().optional().default(false), // true 時即使資料庫已有資料也強制重新抓取覆蓋
});

const REQUEST_INTERVAL_MS = 5000;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// 依序抓取單一公司單一季度的損益表、資產負債表、現金流量表。三支對外請求（MOPS）之間間隔 5 秒；
// 若某一表已在資料庫中且未帶 force 而被跳過，該次不算對外請求，不佔用等待時間。
export const ingestQuarterlyReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validationResult = requestSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        message: 'Invalid request body.',
        errors: validationResult.error.format(),
      });
    }
    const payload = validationResult.data;
    const label = `${payload.companyId} ${payload.year}Q${payload.season}`;

    console.log(`[quarterly-report] Starting for ${label} (dataType=${payload.dataType}, force=${payload.force})`);

    const logStep = (name: string, result: { skipped: boolean; success: boolean; error?: string; mopsMessage?: string; warnings: string[] }) => {
      if (result.skipped) {
        console.log(`[quarterly-report] ${name}: SKIP (already in DB) ${label}`);
      } else if (result.success) {
        console.log(`[quarterly-report] ${name}: FETCHED ${label}${result.warnings.length ? ` (${result.warnings.length} warnings)` : ''}`);
      } else {
        console.log(`[quarterly-report] ${name}: NO DATA ${label}: ${result.error ?? result.mopsMessage}`);
      }
    };

    const incomeStatement = await ingestIncomeStatement(payload);
    logStep('income-statement', incomeStatement);
    if (!incomeStatement.skipped) await sleep(REQUEST_INTERVAL_MS);

    const balanceSheet = await ingestBalanceSheet(payload);
    logStep('balance-sheet', balanceSheet);
    if (!balanceSheet.skipped) await sleep(REQUEST_INTERVAL_MS);

    const cashFlow = await ingestCashFlow(payload);
    logStep('cash-flow', cashFlow);

    const results = { incomeStatement, balanceSheet, cashFlow };
    const succeeded = Object.values(results).filter((r) => r.success).length;
    console.log(`[quarterly-report] Done for ${label}. ${succeeded}/3 succeeded.`);

    res.status(200).json(
      serializeBigInt({
        companyId: payload.companyId,
        year: payload.year,
        season: payload.season,
        dataType: payload.dataType,
        subsidiaryCompanyId: payload.subsidiaryCompanyId,
        succeeded,
        total: 3,
        results,
      })
    );
  } catch (error) {
    console.error('Quarterly report ingestion failed:', error);
    next(error);
  }
};
