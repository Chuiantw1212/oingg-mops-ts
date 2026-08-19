export type MopsReportRow = string[];

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
const AMOUNT_FIELD_LABELS: Record<AmountFieldKey, { labels: string[]; required?: boolean }> = {
  operatingRevenue: { labels: ['營業收入合計'], required: true },
  operatingCost: { labels: ['營業成本合計'], required: true },
  grossProfitBeforeAdjustment: { labels: ['營業毛利（毛損）'] },
  grossProfit: { labels: ['營業毛利（毛損）淨額', '營業毛利（毛損）'], required: true },
  sellingExpenses: { labels: ['推銷費用'] },
  adminExpenses: { labels: ['管理費用'] },
  rdExpenses: { labels: ['研究發展費用'] },
  operatingExpenses: { labels: ['營業費用合計'], required: true },
  otherOperatingGainsLosses: { labels: ['其他收益及費損淨額'] },
  operatingIncome: { labels: ['營業利益（損失）'], required: true },
  interestIncome: { labels: ['利息收入'] },
  otherIncome: { labels: ['其他收入'] },
  otherNonOperatingGainsLosses: { labels: ['其他利益及損失淨額'] },
  financeCosts: { labels: ['財務成本淨額'] },
  shareOfAssociatesJvProfit: { labels: ['採用權益法認列之關聯企業及合資損益之份額淨額'] },
  nonOperatingIncomeExpenses: { labels: ['營業外收入及支出合計'] },
  profitBeforeTax: { labels: ['稅前淨利（淨損）'], required: true },
  incomeTaxExpense: { labels: ['所得稅費用（利益）合計'], required: true },
  netIncomeFromContinuingOps: { labels: ['繼續營業單位本期淨利（淨損）'] },
  netIncome: { labels: ['本期淨利（淨損）'], required: true },
  otherComprehensiveIncome: { labels: ['其他綜合損益（淨額）'] },
  totalComprehensiveIncome: { labels: ['本期綜合損益總額'] },
  netIncomeAttributableToParent: { labels: ['母公司業主（淨利/損）'] },
  netIncomeAttributableToNci: { labels: ['非控制權益（淨利/損）'] },
  comprehensiveIncomeAttributableToParent: { labels: ['母公司業主（綜合損益）'] },
  comprehensiveIncomeAttributableToNci: { labels: ['非控制權益（綜合損益）'] },
};

const RATIO_FIELD_LABELS: Record<RatioFieldKey, { labels: string[]; required?: boolean }> = {
  eps: { labels: ['基本每股盈餘'], required: true },
  epsDiluted: { labels: ['稀釋每股盈餘'] },
};

// MOPS 科目名稱在不同季度/公司間，縮排空白、全形/半形符號偶有不一致，比對前先正規化。
const normalizeLabel = (label: string) =>
  (label ?? '')
    .replace(/^[\s　]+/, '') // 去除前導縮排（全形/半形空白）
    .replace(/[（）]/g, (c) => (c === '（' ? '(' : ')')) // 全形括號 -> 半形
    .replace(/∕/g, '/') // 特殊除號斜線 -> 一般斜線
    .replace(/：/g, ':') // 全形冒號 -> 半形
    .trim();

const findRowValue = (reportList: MopsReportRow[], label: string): string | null => {
  const target = normalizeLabel(label);
  const row = reportList.find((r) => normalizeLabel(r[0] ?? '') === target && (r[1] ?? '') !== '');
  return row ? (row[1] ?? null) : null;
};

const findFirstRowValue = (reportList: MopsReportRow[], labels: string[]): string | null => {
  for (const label of labels) {
    const value = findRowValue(reportList, label);
    if (value !== null) return value;
  }
  return null;
};

const toBigIntOrNull = (raw: string | null): bigint | null => {
  if (raw === null) return null;
  const cleaned = raw.replace(/,/g, '').trim();
  if (cleaned === '') return null;
  try {
    return BigInt(cleaned);
  } catch {
    return null;
  }
};

const toNumberOrNull = (raw: string | null): number | null => {
  if (raw === null) return null;
  const cleaned = raw.replace(/,/g, '').trim();
  if (cleaned === '') return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
};

export const parseIncomeStatementReport = (reportList: MopsReportRow[]): ParsedIncomeStatement => {
  const warnings: string[] = [];

  const amounts = {} as Record<AmountFieldKey, bigint | null>;
  for (const key of AMOUNT_FIELD_KEYS) {
    const { labels, required } = AMOUNT_FIELD_LABELS[key];
    const raw = findFirstRowValue(reportList, labels);
    if (raw === null && required) {
      warnings.push(`Could not find row for "${key}" (labels tried: ${labels.join(', ')})`);
    }
    amounts[key] = toBigIntOrNull(raw);
  }

  const ratios = {} as Record<RatioFieldKey, number | null>;
  for (const key of RATIO_FIELD_KEYS) {
    const { labels, required } = RATIO_FIELD_LABELS[key];
    const raw = findFirstRowValue(reportList, labels);
    if (raw === null && required) {
      warnings.push(`Could not find row for "${key}" (labels tried: ${labels.join(', ')})`);
    }
    ratios[key] = toNumberOrNull(raw);
  }

  return { ...amounts, ...ratios, warnings };
};
