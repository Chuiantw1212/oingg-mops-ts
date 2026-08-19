export type MopsReportRow = string[];

// MOPS 科目名稱在不同季度/公司間，縮排空白、全形/半形符號偶有不一致，比對前先正規化。
export const normalizeLabel = (label: string) =>
  (label ?? '')
    .replace(/^[\s　]+/, '') // 去除前導縮排（全形/半形空白）
    .replace(/[（）]/g, (c) => (c === '（' ? '(' : ')')) // 全形括號 -> 半形
    .replace(/[∕／⁄]/g, '/') // 除號斜線(U+2215)、全形斜線(U+FF0F)、分數斜線(U+2044) -> 一般斜線
    .replace(/：/g, ':') // 全形冒號 -> 半形
    .trim();

// 有些公司（觀察到的案例：部分銀行的損益表）會在不同區塊重複使用同一個不帶括號的科目名稱
// （例如「母公司業主」同時出現在「本期淨利歸屬於：」跟「本期綜合損益歸屬於：」兩個區塊底下，
// 代表完全不同的數字），我們目前的比對邏輯是不看區塊標題的純文字比對，沒有能力分辨兩者。
// 若同一名稱比對到多筆「數值不同」的資料列，代表無法安全判斷該取哪一筆，寧可回傳 null
// 也不要賭第一筆猜錯——賭錯的後果是安靜地把錯誤數字寫進資料庫。
const findRowValue = (reportList: MopsReportRow[], label: string): string | null => {
  const target = normalizeLabel(label);
  const matches = reportList.filter((r) => normalizeLabel(r[0] ?? '') === target && (r[1] ?? '') !== '');
  if (matches.length === 0) return null;
  const distinctValues = new Set(matches.map((r) => r[1]));
  if (distinctValues.size > 1) return null; // 同名但數值不同，無法安全判斷，視為找不到
  return matches[0]![1] ?? null;
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
  /**
   * true 時，會把「所有」比對到的候選科目加總，而不是只取第一個比對到的。
   * 用於候選名稱之間不是互斥的別名，而是同一份報表可能同時存在的不同科目
   * （例如部分金控同時有「發行公司債」與「發行金融債券」兩個獨立科目，兩者都要算進去）。
   * 預設 false：labels 視為互斥別名，只取第一個比對到的。
   */
  sumAllMatches?: boolean;
}

// 把 labels 內「所有」比對到的候選科目加總（找不到的候選直接跳過，不影響其他候選）。
// 一個都找不到時回傳 null，藉此跟「找到但金額是 0」區分開來。
const sumAllMatchingAmounts = (reportList: MopsReportRow[], labels: string[]): bigint | null => {
  let sum: bigint | null = null;
  for (const label of labels) {
    const value = toBigIntOrNull(findRowValue(reportList, label));
    if (value !== null) sum = (sum ?? 0n) + value;
  }
  return sum;
};

// 依 specs 定義，從 reportList 抓出一組金額欄位（BigInt），找不到必要欄位時記錄 warning。
export const parseAmountFields = <K extends string>(
  reportList: MopsReportRow[],
  specs: Record<K, FieldSpec>
): { values: Record<K, bigint | null>; warnings: string[] } => {
  const warnings: string[] = [];
  const values = {} as Record<K, bigint | null>;
  for (const key of Object.keys(specs) as K[]) {
    const { labels, required, sumAllMatches } = specs[key];
    const value = sumAllMatches ? sumAllMatchingAmounts(reportList, labels) : toBigIntOrNull(findFirstRowValue(reportList, labels));
    if (value === null && required) {
      warnings.push(`Could not find row for "${key}" (labels tried: ${labels.join(', ')})`);
    }
    values[key] = value;
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
