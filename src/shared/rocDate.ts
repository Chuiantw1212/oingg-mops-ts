// 把 MOPS 常見的「民國年/月/日」文字（例如 "114/03/24"）轉成 Date（UTC，避免時區位移影響日期本身）。
// 找不到符合格式就回傳 null，不猜測——這類欄位常常是空白（&nbsp;）或格式不符時代表「無此日期」。
export const parseRocDate = (raw: string | null | undefined): Date | null => {
  if (!raw) return null;
  const match = raw.trim().match(/^(\d{2,3})\/(\d{1,2})\/(\d{1,2})$/);
  if (!match) return null;
  const [, rocYear, month, day] = match;
  const gregorianYear = Number(rocYear) + 1911;
  return new Date(Date.UTC(gregorianYear, Number(month) - 1, Number(day)));
};
