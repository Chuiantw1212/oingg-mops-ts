import { type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { ingestOneQuarter as ingestIncomeStatement } from '../incomeStatement/ingest';
import { ingestOneQuarter as ingestBalanceSheet } from '../balanceSheet/ingest';
import { ingestOneQuarter as ingestCashFlow } from '../cashFlow/ingest';
import { serializeBigInt } from '../../shared/serializeBigInt';
import { getLatestAvailableQuarter, getPastNQuarters, type Season } from '../../shared/rocQuarter';
import { politeDelay } from '../../shared/politeDelay';

const requestSchema = z.object({
  companyId: z.string({ required_error: 'companyId is required.' }).min(1),
  year: z.string({ required_error: 'year is required.' }).min(1), // 民國年，例如 "114"
  season: z.enum(['1', '2', '3', '4'], { required_error: 'season is required.' }),
  dataType: z.enum(['1', '2']).default('2'), // 1 = 個體, 2 = 合併
  subsidiaryCompanyId: z.string().optional().default(''),
  force: z.boolean().optional().default(false), // true 時即使資料庫已有資料也強制重新抓取覆蓋
});

interface StepResult {
  success: boolean;
  skipped: boolean;
  warnings: string[];
  error?: string;
  mopsMessage?: string;
  record?: unknown;
}

interface OneQuarterBase {
  companyId: string;
  dataType: '1' | '2';
  subsidiaryCompanyId: string;
  force?: boolean;
}

const STATEMENTS = [
  { kind: 'income-statement', key: 'incomeStatement' as const, fn: ingestIncomeStatement },
  { kind: 'balance-sheet', key: 'balanceSheet' as const, fn: ingestBalanceSheet },
  { kind: 'cash-flow', key: 'cashFlow' as const, fn: ingestCashFlow },
];

const logStep = (prefix: string, label: string, kind: string, result: StepResult) => {
  if (result.skipped) {
    console.log(`${prefix} ${kind}: SKIP (already in DB) ${label}`);
  } else if (result.success) {
    console.log(`${prefix} ${kind}: FETCHED ${label}${result.warnings.length ? ` (${result.warnings.length} warnings)` : ''}`);
  } else {
    console.log(`${prefix} ${kind}: NO DATA ${label}: ${result.error ?? result.mopsMessage}`);
  }
};

// 依序抓取「一或多個季度 x 三表」的完整步驟序列。隨機浮動間隔（見 politeDelay）套用在整個序列上
// （不分季度邊界），只有真的呼叫過 MOPS（非 skip）的步驟之後才需要等待，序列最後一步之後不等待。
const runQuarterlySteps = async (base: OneQuarterBase, quarters: { year: string; season: Season }[], prefix: string) => {
  const steps = quarters.flatMap((q) => STATEMENTS.map((s) => ({ ...s, year: q.year, season: q.season })));
  const byQuarter = new Map<string, { year: string; season: Season; incomeStatement: StepResult; balanceSheet: StepResult; cashFlow: StepResult }>();

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]!;
    const label = `${base.companyId} ${step.year}Q${step.season}`;
    const result = await step.fn({ ...base, year: step.year, season: step.season });
    logStep(prefix, label, step.kind, result);

    const quarterKey = `${step.year}Q${step.season}`;
    const entry = byQuarter.get(quarterKey) ?? { year: step.year, season: step.season, incomeStatement: result, balanceSheet: result, cashFlow: result };
    entry[step.key] = result;
    byQuarter.set(quarterKey, entry);

    if (!result.skipped && i < steps.length - 1) {
      await politeDelay();
    }
  }

  return [...byQuarter.values()];
};

// 依序抓取單一公司單一季度的損益表、資產負債表、現金流量表。三支對外請求（MOPS）之間間隔隨機浮動（見 politeDelay）；
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
    const { companyId, year, season, dataType, subsidiaryCompanyId, force } = validationResult.data;
    const prefix = '[quarterly-report]';

    console.log(`${prefix} Starting for ${companyId} ${year}Q${season} (dataType=${dataType}, force=${force})`);

    const [quarter] = await runQuarterlySteps({ companyId, dataType, subsidiaryCompanyId, force }, [{ year, season }], prefix);
    const results = { incomeStatement: quarter!.incomeStatement, balanceSheet: quarter!.balanceSheet, cashFlow: quarter!.cashFlow };
    const succeeded = Object.values(results).filter((r) => r.success).length;
    console.log(`${prefix} Done for ${companyId} ${year}Q${season}. ${succeeded}/3 succeeded.`);

    res.status(200).json(
      serializeBigInt({
        companyId,
        year,
        season,
        dataType,
        subsidiaryCompanyId,
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

const backfillSchema = z.object({
  companyId: z.string({ required_error: 'companyId is required.' }).min(1),
  dataType: z.enum(['1', '2']).default('2'), // 1 = 個體, 2 = 合併
  subsidiaryCompanyId: z.string().optional().default(''),
  years: z.coerce.number().int().min(1).max(20).default(5),
  force: z.boolean().optional().default(false), // true 時每一季、每一表都強制重新向 MOPS 抓取並覆蓋
});

// 以公司為單位，回補過去 years*4 季（預設 5 年 = 20 季）的損益表、資產負債表、現金流量表。
// 終點季度依法定公告截止日判斷（同各表單獨的 backfill 規則）。所有對外請求（最多 20*3=60 次）
// 之間統一用隨機浮動間隔（見 politeDelay）、不分季度邊界；跳過的（資料庫已有、未帶 force）不佔用等待時間。
export const backfillQuarterlyReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validationResult = backfillSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        message: 'Invalid request body.',
        errors: validationResult.error.format(),
      });
    }
    const { companyId, dataType, subsidiaryCompanyId, years, force } = validationResult.data;
    const prefix = '[quarterly-report-backfill]';

    const quarterCount = years * 4;
    const latestAvailable = getLatestAvailableQuarter(new Date());
    const quarters = getPastNQuarters(latestAvailable, quarterCount);

    console.log(
      `${prefix} Starting for ${companyId} (dataType=${dataType}, force=${force}): ${quarters.length} quarters, ` +
        `${quarters[0]!.year}Q${quarters[0]!.season} ~ ${quarters[quarters.length - 1]!.year}Q${quarters[quarters.length - 1]!.season}`
    );

    const quarterResults = await runQuarterlySteps({ companyId, dataType, subsidiaryCompanyId, force }, quarters, prefix);

    const allSteps = quarterResults.flatMap((q) => [q.incomeStatement, q.balanceSheet, q.cashFlow]);
    const succeeded = allSteps.filter((r) => r.success).length;
    const fetched = allSteps.filter((r) => r.success && !r.skipped).length;
    const skipped = allSteps.filter((r) => r.skipped).length;
    console.log(
      `${prefix} Done. ${succeeded}/${allSteps.length} succeeded for ${companyId} (${fetched} fetched from MOPS, ${skipped} already in DB).`
    );

    res.status(200).json(
      serializeBigInt({
        companyId,
        dataType,
        subsidiaryCompanyId,
        quarterCount: quarters.length,
        totalSteps: allSteps.length,
        succeeded,
        fetched,
        skipped,
        quarters: quarterResults,
      })
    );
  } catch (error) {
    console.error('Quarterly report backfill failed:', error);
    next(error);
  }
};
