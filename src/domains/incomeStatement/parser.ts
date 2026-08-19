export type MopsReportRow = string[];

export interface ParsedIncomeStatement {
  operatingRevenue: bigint | null;
  grossProfit: bigint | null;
  operatingIncome: bigint | null;
  profitBeforeTax: bigint | null;
  netIncome: bigint | null;
  eps: number | null;
  warnings: string[];
}

// MOPS 的科目名稱前面會用全形空白（　）縮排表示階層，比對時先去除。
const stripIndent = (label: string) => label.replace(/^[\s　]+/, '');

const findRowValue = (reportList: MopsReportRow[], label: string): string | null => {
  const row = reportList.find((r) => stripIndent(r[0] ?? '') === label && (r[1] ?? '') !== '');
  return row ? row[1] ?? null : null;
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

// key -> (可能出現的科目名稱，依優先序)
const FIELD_LABELS: Record<'operatingRevenue' | 'grossProfit' | 'operatingIncome' | 'profitBeforeTax' | 'netIncome' | 'eps', string[]> = {
  operatingRevenue: ['營業收入合計'],
  grossProfit: ['營業毛利（毛損）淨額', '營業毛利（毛損）'],
  operatingIncome: ['營業利益（損失）'],
  profitBeforeTax: ['稅前淨利（淨損）'],
  netIncome: ['本期淨利（淨損）'],
  eps: ['基本每股盈餘'],
};

export const parseIncomeStatementReport = (reportList: MopsReportRow[]): ParsedIncomeStatement => {
  const warnings: string[] = [];

  const readBigInt = (key: 'operatingRevenue' | 'grossProfit' | 'operatingIncome' | 'profitBeforeTax' | 'netIncome') => {
    const raw = findFirstRowValue(reportList, FIELD_LABELS[key]);
    if (raw === null) warnings.push(`Could not find row for "${key}" (labels tried: ${FIELD_LABELS[key].join(', ')})`);
    return toBigIntOrNull(raw);
  };

  const epsRaw = findFirstRowValue(reportList, FIELD_LABELS.eps);
  if (epsRaw === null) warnings.push(`Could not find row for "eps" (labels tried: ${FIELD_LABELS.eps.join(', ')})`);

  return {
    operatingRevenue: readBigInt('operatingRevenue'),
    grossProfit: readBigInt('grossProfit'),
    operatingIncome: readBigInt('operatingIncome'),
    profitBeforeTax: readBigInt('profitBeforeTax'),
    netIncome: readBigInt('netIncome'),
    eps: toNumberOrNull(epsRaw),
    warnings,
  };
};
