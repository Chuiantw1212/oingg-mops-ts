export type MopsReportRow = string[];

// MOPS 科目名稱在不同季度/公司間，縮排空白、全形/半形符號偶有不一致，比對前先正規化。
export const normalizeLabel = (label: string) =>
  (label ?? '')
    .replace(/^[\s　]+/, '') // 去除前導縮排（全形/半形空白）
    .replace(/[（）]/g, (c) => (c === '（' ? '(' : ')')) // 全形括號 -> 半形
    .replace(/[∕／⁄]/g, '/') // 除號斜線(U+2215)、全形斜線(U+FF0F)、分數斜線(U+2044) -> 一般斜線
    .replace(/：/g, ':') // 全形冒號 -> 半形
    .trim();

const findRowValue = (reportList: MopsReportRow[], label: string): string | null => {
  const target = normalizeLabel(label);
  const row = reportList.find((r) => normalizeLabel(r[0] ?? '') === target && (r[1] ?? '') !== '');
  return row ? (row[1] ?? null) : null;
};

// 依優先序嘗試多個候選科目名稱，回傳第一個「找得到且該列有值」的原始字串（本期單季金額，即 row[1]）。
export const findFirstRowValue = (reportList: MopsReportRow[], labels: string[]): string | null => {
  for (const label of labels) {
    const value = findRowValue(reportList, label);
    if (value !== null) return value;
  }
  return null;
};

export const toBigIntOrNull = (raw: string | null): bigint | null => {
  if (raw === null) return null;
  const cleaned = raw.replace(/,/g, '').trim();
  if (cleaned === '') return null;
  try {
    return BigInt(cleaned);
  } catch {
    return null;
  }
};

export const toNumberOrNull = (raw: string | null): number | null => {
  if (raw === null) return null;
  const cleaned = raw.replace(/,/g, '').trim();
  if (cleaned === '') return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
};

export interface FieldSpec {
  /** 可能出現的科目名稱，依優先序；MOPS 不同季度/公司偶爾用字略有差異。 */
  labels: string[];
  /** true 時，若所有候選名稱都找不到會加進 warnings（通用科目才需要；公司特有的細項留空即可）。 */
  required?: boolean;
}

// 依 specs 定義，從 reportList 抓出一組金額欄位（BigInt），找不到必要欄位時記錄 warning。
export const parseAmountFields = <K extends string>(
  reportList: MopsReportRow[],
  specs: Record<K, FieldSpec>
): { values: Record<K, bigint | null>; warnings: string[] } => {
  const warnings: string[] = [];
  const values = {} as Record<K, bigint | null>;
  for (const key of Object.keys(specs) as K[]) {
    const { labels, required } = specs[key];
    const raw = findFirstRowValue(reportList, labels);
    if (raw === null && required) {
      warnings.push(`Could not find row for "${key}" (labels tried: ${labels.join(', ')})`);
    }
    values[key] = toBigIntOrNull(raw);
  }
  return { values, warnings };
};

// 與 parseAmountFields 相同，但回傳 number（用於 EPS 等比率/非整數欄位）。
export const parseRatioFields = <K extends string>(
  reportList: MopsReportRow[],
  specs: Record<K, FieldSpec>
): { values: Record<K, number | null>; warnings: string[] } => {
  const warnings: string[] = [];
  const values = {} as Record<K, number | null>;
  for (const key of Object.keys(specs) as K[]) {
    const { labels, required } = specs[key];
    const raw = findFirstRowValue(reportList, labels);
    if (raw === null && required) {
      warnings.push(`Could not find row for "${key}" (labels tried: ${labels.join(', ')})`);
    }
    values[key] = toNumberOrNull(raw);
  }
  return { values, warnings };
};
