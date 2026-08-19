import { type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../../adapters/prisma/index';
import { serializeBigInt } from '../../shared/serializeBigInt';

const requestSchema = z.object({
  companyId: z.string().min(1).default('2330'),
  year: z.string({ required_error: 'year is required.' }).min(1), // 民國年，例如 "115"
  season: z.enum(['1', '2', '3', '4'], { required_error: 'season is required.' }),
  dataType: z.enum(['1', '2']).default('2'), // 1 = 個體, 2 = 合併
  subsidiaryCompanyId: z.string().optional().default(''),
  toleranceNtd: z.coerce.number().int().min(0).default(5000), // 容許誤差（新台幣元），避免財報本身四捨五入造成誤判
});

type CheckStatus = 'pass' | 'fail' | 'skipped';

interface CheckResult {
  name: string;
  description: string;
  status: CheckStatus;
  details: Record<string, unknown>;
}

const closeEnough = (a: bigint | null | undefined, b: bigint | null | undefined, tolerance: bigint): boolean => {
  if (a == null || b == null) return false;
  const diff = a > b ? a - b : b - a;
  return diff <= tolerance;
};

const diffString = (a: bigint | null | undefined, b: bigint | null | undefined): string | null =>
  a != null && b != null ? (a - b).toString() : null;

export const reconcileQuarter = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validationResult = requestSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        message: 'Invalid request body.',
        errors: validationResult.error.format(),
      });
    }
    const { companyId, year, season, dataType, subsidiaryCompanyId, toleranceNtd } = validationResult.data;
    const tolerance = BigInt(toleranceNtd);
    const yearNum = Number(year);
    const seasonNum = Number(season);

    const where = {
      symbol_year_quarter_dataType_subsidiaryCompanyId: { symbol: companyId, year: yearNum, quarter: seasonNum, dataType, subsidiaryCompanyId },
    };
    const priorYearEndWhere = {
      symbol_year_quarter_dataType_subsidiaryCompanyId: { symbol: companyId, year: yearNum - 1, quarter: 4, dataType, subsidiaryCompanyId },
    };

    const [balanceSheet, cashFlow, priorYearEndCashFlow, incomeStatements] = await Promise.all([
      prisma.quarterlyBalanceSheet.findUnique({ where }),
      prisma.quarterlyCashFlowStatement.findUnique({ where }),
      prisma.quarterlyCashFlowStatement.findUnique({ where: priorYearEndWhere }),
      prisma.quarterlyIncomeStatement.findMany({
        where: { symbol: companyId, year: yearNum, quarter: { lte: seasonNum }, dataType, subsidiaryCompanyId },
        orderBy: { quarter: 'asc' },
      }),
    ]);

    const checks: CheckResult[] = [];

    // Check 1：本季資產負債表現金 vs 本季現金流量表「資產負債表帳列之現金及約當現金」
    // 注意：不是拿 cashEndingBalance 比。金融業的 cashEndingBalance 依 IAS 7 定義涵蓋存放央行、
    // 附賣回票券等項目，範圍比資產負債表寬，直接比會系統性誤判。cashPerBalanceSheet 才是對應
    // 資產負債表口徑的數字；若該欄位缺漏（例如較舊資料尚未含此欄位）則退回用 cashEndingBalance。
    {
      const description = '資產負債表本季「現金及約當現金」應等於現金流量表本季「資產負債表帳列之現金及約當現金」（缺此欄位時退回用期末現金餘額比對）';
      if (!balanceSheet || !cashFlow) {
        const missing = [!balanceSheet && 'balance_sheet', !cashFlow && 'cash_flow_statement'].filter(Boolean);
        checks.push({ name: 'cash_balance_continuity', description, status: 'skipped', details: { reason: `缺少資料: ${missing.join(', ')}` } });
      } else {
        const cfCashForBsCompare = cashFlow.cashPerBalanceSheet ?? cashFlow.cashEndingBalance;
        const usedFallback = cashFlow.cashPerBalanceSheet === null;
        const passed = closeEnough(balanceSheet.cashAndEquivalents, cfCashForBsCompare, tolerance);
        checks.push({
          name: 'cash_balance_continuity',
          description,
          status: passed ? 'pass' : 'fail',
          details: {
            balanceSheetCash: balanceSheet.cashAndEquivalents?.toString() ?? null,
            cashFlowValueUsed: cfCashForBsCompare?.toString() ?? null,
            usedCashEndingBalanceFallback: usedFallback,
            difference: diffString(balanceSheet.cashAndEquivalents, cfCashForBsCompare),
          },
        });
      }
    }

    // Check 2：本季現金流量表「期初現金及約當現金餘額」 vs 去年Q4現金流量表「期末現金及約當現金餘額」
    // 兩邊都是現金流量表欄位、同一套 IAS 7 口徑，不會有資產負債表 vs 現金流量表的定義範圍落差，
    // 對任何產業（含金融業）都準確。
    {
      const description = `現金流量表本季「期初現金及約當現金餘額」應等於現金流量表 ${yearNum - 1}Q4（去年期末年報）的「期末現金及約當現金餘額」`;
      if (!priorYearEndCashFlow || !cashFlow) {
        const missing = [!priorYearEndCashFlow && `cash_flow_statement(${yearNum - 1}Q4)`, !cashFlow && 'cash_flow_statement'].filter(Boolean);
        checks.push({ name: 'cash_beginning_balance_continuity', description, status: 'skipped', details: { reason: `缺少資料: ${missing.join(', ')}` } });
      } else {
        const passed = closeEnough(priorYearEndCashFlow.cashEndingBalance, cashFlow.cashBeginningBalance, tolerance);
        checks.push({
          name: 'cash_beginning_balance_continuity',
          description,
          status: passed ? 'pass' : 'fail',
          details: {
            priorYearEndCashFlowEndingBalance: priorYearEndCashFlow.cashEndingBalance?.toString() ?? null,
            cashFlowBeginningBalance: cashFlow.cashBeginningBalance?.toString() ?? null,
            difference: diffString(priorYearEndCashFlow.cashEndingBalance, cashFlow.cashBeginningBalance),
          },
        });
      }
    }

    // Check 3：損益表 Q1~本季 累加稅前淨利 vs 現金流量表本季累計「本期稅前淨利」
    // 現金流量表是累計數（例如 Q2 = 當年 1/1~6/30），損益表則存的是單季數字，因此要加總對齊。
    {
      const description = `損益表 ${year}Q1~Q${seasonNum} 累加「稅前淨利」應等於現金流量表本季累計「本期稅前淨利」`;
      const foundQuarters = incomeStatements.map((r) => r.quarter);
      const missingQuarters = Array.from({ length: seasonNum }, (_, i) => i + 1).filter((q) => !foundQuarters.includes(q));
      const anyNullProfitBeforeTax = incomeStatements.some((r) => r.profitBeforeTax === null);

      if (missingQuarters.length > 0 || !cashFlow) {
        const reasons = [
          missingQuarters.length > 0 && `缺少損益表季度: Q${missingQuarters.join(', Q')}`,
          !cashFlow && '缺少現金流量表資料',
        ].filter(Boolean);
        checks.push({ name: 'pretax_profit_reconciliation', description, status: 'skipped', details: { reason: reasons.join('; ') } });
      } else if (anyNullProfitBeforeTax || cashFlow.profitBeforeTax === null) {
        checks.push({ name: 'pretax_profit_reconciliation', description, status: 'skipped', details: { reason: '相關季度中有稅前淨利欄位為 null' } });
      } else {
        const sumIncomeStatement = incomeStatements.reduce((acc, r) => acc + (r.profitBeforeTax as bigint), 0n);
        const passed = closeEnough(sumIncomeStatement, cashFlow.profitBeforeTax, tolerance);
        checks.push({
          name: 'pretax_profit_reconciliation',
          description,
          status: passed ? 'pass' : 'fail',
          details: {
            quartersUsed: incomeStatements.map((r) => `${r.year}Q${r.quarter}`),
            incomeStatementCumulativeProfitBeforeTax: sumIncomeStatement.toString(),
            cashFlowCumulativeProfitBeforeTax: cashFlow.profitBeforeTax.toString(),
            difference: diffString(sumIncomeStatement, cashFlow.profitBeforeTax),
          },
        });
      }
    }

    const failedChecks = checks.filter((c) => c.status === 'fail');
    const skippedChecks = checks.filter((c) => c.status === 'skipped');
    const overallStatus: 'pass' | 'fail' | 'inconclusive' =
      failedChecks.length > 0 ? 'fail' : skippedChecks.length === checks.length ? 'inconclusive' : 'pass';

    let interpretation: string | undefined;
    if (failedChecks.length >= 2) {
      interpretation = '多項檢查同時未通過：除了資產負債表/損益表本身可能有誤之外，現金流量表本身的數字也有可能才是錯誤來源，建議一併重新核對現金流量表資料，不要只假設是資產負債表或損益表的問題。';
    } else if (failedChecks.length === 1) {
      interpretation = '只有一項檢查未通過，優先檢查該項牽涉到的兩張報表（含現金流量表本身）是否有資料缺漏、抓取時機不同或解析錯誤。';
    }

    res.status(200).json(
      serializeBigInt({
        companyId,
        year,
        season,
        dataType,
        subsidiaryCompanyId,
        toleranceNtd,
        overallStatus,
        interpretation,
        checks,
      })
    );
  } catch (error) {
    console.error('Reconciliation check failed:', error);
    next(error);
  }
};
