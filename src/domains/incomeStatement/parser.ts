import { type MopsReportRow, type FieldSpec, parseAmountFields, parseRatioFields } from '../../shared/mopsReportParsing.js';

export type { MopsReportRow };

const AMOUNT_FIELD_KEYS = [
  'operatingRevenue',
  'operatingCost',
  'grossProfitBeforeAdjustment',
  'grossProfit',
  'sellingExpenses',
  'adminExpenses',
  'rdExpenses',
  'operatingExpenses',
  'otherOperatingGainsLosses',
  'operatingIncome',
  'interestIncome',
  'otherIncome',
  'otherNonOperatingGainsLosses',
  'financeCosts',
  'shareOfAssociatesJvProfit',
  'nonOperatingIncomeExpenses',
  'profitBeforeTax',
  'incomeTaxExpense',
  'netIncomeFromContinuingOps',
  'netIncome',
  'otherComprehensiveIncome',
  'totalComprehensiveIncome',
  'netIncomeAttributableToParent',
  'netIncomeAttributableToNci',
  'comprehensiveIncomeAttributableToParent',
  'comprehensiveIncomeAttributableToNci',
] as const;
type AmountFieldKey = (typeof AMOUNT_FIELD_KEYS)[number];

const RATIO_FIELD_KEYS = ['eps', 'epsDiluted'] as const;
type RatioFieldKey = (typeof RATIO_FIELD_KEYS)[number];

export type ParsedIncomeStatement = {
  [K in AmountFieldKey]: bigint | null;
} & {
  [K in RatioFieldKey]: number | null;
} & {
  warnings: string[];
};

// key -> (可能出現的科目名稱，依優先序；MOPS 不同季度/公司偶爾用字略有差異)
// 金控/銀行/保險業（t164sb04 對這類公司回傳的科目名稱跟一般業完全不同：沒有「營業收入/成本/毛利」
// 這種製造業概念，而是用「淨收益」「利息淨收益」「繼續營業單位稅前損益」等）的候選名稱一併列在後面。
const AMOUNT_FIELD_LABELS: Record<AmountFieldKey, FieldSpec> = {
  operatingRevenue: { labels: ['營業收入合計', '淨收益'], required: true }, // 金融業以「淨收益」對應營收概念
  operatingCost: { labels: ['營業成本合計'] }, // 金融業無此概念，結構性缺欄不算 required
  grossProfitBeforeAdjustment: { labels: ['營業毛利（毛損）'] },
  grossProfit: { labels: ['營業毛利（毛損）淨額', '營業毛利（毛損）'] }, // 金融業無此概念
  sellingExpenses: { labels: ['推銷費用'] },
  adminExpenses: { labels: ['管理費用'] },
  rdExpenses: { labels: ['研究發展費用'] },
  operatingExpenses: { labels: ['營業費用合計', '營業費用'], required: true }, // 金融業科目沒有「合計」二字
  otherOperatingGainsLosses: { labels: ['其他收益及費損淨額'] },
  operatingIncome: { labels: ['營業利益（損失）'] }, // 金融業無此概念
  interestIncome: { labels: ['利息收入'] }, // 注意：金融業的「利息收入」是核心業務收入，語意跟一般業的營業外利息收入不同
  otherIncome: { labels: ['其他收入'] },
  otherNonOperatingGainsLosses: { labels: ['其他利益及損失淨額'] },
  financeCosts: { labels: ['財務成本淨額'] },
  shareOfAssociatesJvProfit: { labels: ['採用權益法認列之關聯企業及合資損益之份額淨額'] },
  nonOperatingIncomeExpenses: { labels: ['營業外收入及支出合計'] },
  profitBeforeTax: { labels: ['稅前淨利（淨損）', '繼續營業單位稅前損益'], required: true },
  incomeTaxExpense: { labels: ['所得稅費用（利益）合計', '所得稅費用（利益）'], required: true },
  netIncomeFromContinuingOps: { labels: ['繼續營業單位本期淨利（淨損）'] },
  netIncome: { labels: ['本期淨利（淨損）', '本期稅後淨利（淨損）'], required: true },
  otherComprehensiveIncome: { labels: ['其他綜合損益（淨額）'] },
  totalComprehensiveIncome: { labels: ['本期綜合損益總額'] },
  netIncomeAttributableToParent: { labels: ['母公司業主（淨利/損）', '母公司業主（淨利/淨損）'] },
  netIncomeAttributableToNci: { labels: ['非控制權益（淨利/損）', '非控制權益（淨利/淨損）'] },
  comprehensiveIncomeAttributableToParent: { labels: ['母公司業主（綜合損益）'] },
  comprehensiveIncomeAttributableToNci: { labels: ['非控制權益（綜合損益）'] },
};

const RATIO_FIELD_LABELS: Record<RatioFieldKey, FieldSpec> = {
  eps: { labels: ['基本每股盈餘'], required: true },
  epsDiluted: { labels: ['稀釋每股盈餘'] },
};

export const parseIncomeStatementReport = (reportList: MopsReportRow[]): ParsedIncomeStatement => {
  const amounts = parseAmountFields(reportList, AMOUNT_FIELD_LABELS);
  const ratios = parseRatioFields(reportList, RATIO_FIELD_LABELS);
  return { ...amounts.values, ...ratios.values, warnings: [...amounts.warnings, ...ratios.warnings] };
};
