import * as cheerio from 'cheerio';
import { toBigIntOrNull, toNumberOrNull } from '../../shared/mopsReportParsing';
import { parseRocDate } from '../../shared/rocDate';
import type { DividendDistributionRow } from './types';

// 依實測回應（台積電 2330, 114年）觀察到的欄位順序，「適用停止過戶期間規定之公司」表格固定 19 欄，
// 不用標籤比對（不像 capitalStock 的 t05st05），直接照 index 取值。
const EXPECTED_COLUMN_COUNT = 19;

const extractParValue = (raw: string | null): number | null => {
  if (!raw) return null;
  const match = raw.match(/([\d,]+\.?\d*)/);
  return match ? toNumberOrNull(match[1]!) : null;
};

// 「股利所屬期間」原始文字（如「113年第3季」）拆成民國年 + 季別兩個欄位。只認得到「NNN年第M季」這個
// 目前唯一實測過的格式；季別解析不到時（例如年度/半年度股利等未見過的格式）fiscalQuarter 留 null 並記錄 warning。
const parseFiscalPeriod = (raw: string): { fiscalYear: number | null; fiscalQuarter: number | null; warning: string | null } => {
  const quarterMatch = raw.match(/^(\d{2,3})年第(\d)季$/);
  if (quarterMatch) {
    return { fiscalYear: Number(quarterMatch[1]), fiscalQuarter: Number(quarterMatch[2]), warning: null };
  }
  const yearOnlyMatch = raw.match(/^(\d{2,3})年/);
  if (yearOnlyMatch) {
    return {
      fiscalYear: Number(yearOnlyMatch[1]),
      fiscalQuarter: null,
      warning: `「股利所屬期間」是 "${raw}"，不是常見的「NNN年第M季」格式，fiscalQuarter 留 null。`,
    };
  }
  return { fiscalYear: null, fiscalQuarter: null, warning: `解析不到「股利所屬期間」的民國年，原始文字："${raw}"。` };
};

export interface ParseDividendResult {
  rows: DividendDistributionRow[];
  warnings: string[];
}

export const parseDividendDistribution = (html: string, companyId: string): ParseDividendResult => {
  const $ = cheerio.load(html);
  const warnings: string[] = [];
  const rows: DividendDistributionRow[] = [];

  const tables = $('table.hasBorder').toArray();
  if (tables.length === 0) {
    throw new Error(`t108sb27：找不到預期的表格（table.hasBorder），MOPS 回應格式可能已變更或暫時性錯誤（companyId=${companyId}）。`);
  }

  // 回應固定有兩張表：「適用停止過戶期間規定之公司」跟「不適用停止過戶期間規定之公司」。目前只驗證過第一張
  // （見規格取樣，2330 台積電，第二張是空的）。第二張的欄位配置未知——寧可警告、整批跳過，
  // 也不要照第一張的 19 欄位順序硬套（欄位語意很可能不同，套錯會安靜寫入錯誤數字）。
  const [applicableTable, ...restTables] = tables;
  restTables.forEach((table, idx) => {
    const dataRowCount = $(table).find('tr').not('.tblHead').length;
    if (dataRowCount > 0) {
      warnings.push(
        `第 ${idx + 2} 張表格（推測為「不適用停止過戶期間規定之公司」）有 ${dataRowCount} 筆資料，但欄位配置尚未用真實樣本驗證，本次未解析，需要真實回應樣本才能安全支援。`
      );
    }
  });

  $(applicableTable!)
    .find('tr')
    .not('.tblHead')
    .each((_, tr) => {
      const cells = $(tr).find('td').toArray();
      if (cells.length !== EXPECTED_COLUMN_COUNT) {
        warnings.push(`資料列欄位數是 ${cells.length}，預期 ${EXPECTED_COLUMN_COUNT}，跳過此列（MOPS 表格結構可能已變更）。`);
        return;
      }
      const text = (i: number) => $(cells[i]!).text().trim();

      const rowCompanyId = text(0);
      if (rowCompanyId !== companyId) {
        warnings.push(`資料列公司代號是 "${rowCompanyId}"，跟查詢的 "${companyId}" 不符，跳過此列。`);
        return;
      }

      const rightsRecordDate = parseRocDate(text(3));
      if (!rightsRecordDate) {
        warnings.push(`第 "${text(2)}" 列解析不到「權利分派基準日」，跳過此列（此欄位是本表主鍵的一部分，缺了就無法安全存檔）。`);
        return;
      }

      const { fiscalYear, fiscalQuarter, warning: fiscalPeriodWarning } = parseFiscalPeriod(text(2));
      if (fiscalPeriodWarning) warnings.push(fiscalPeriodWarning);

      rows.push({
        companyName: text(1) || null,
        fiscalYear,
        fiscalQuarter,
        rightsRecordDate,
        stockDividendFromEarnings: toNumberOrNull(text(4)),
        stockDividendFromCapitalReserve: toNumberOrNull(text(5)),
        exRightsDate: parseRocDate(text(6)),
        cashDividendFromEarnings: toNumberOrNull(text(7)),
        cashDividendFromCapitalReserve: toNumberOrNull(text(8)),
        preferredStockCashDividend: toNumberOrNull(text(9)),
        exDividendDate: parseRocDate(text(10)),
        cashDividendPaymentDate: parseRocDate(text(11)),
        capitalIncreaseShares: toBigIntOrNull(text(12)),
        capitalIncreaseSubscriptionRatio: toNumberOrNull(text(13)),
        capitalIncreaseSubscriptionPrice: toNumberOrNull(text(14)),
        totalParticipatingShares: toBigIntOrNull(text(15)),
        announcementDate: parseRocDate(text(16)),
        announcementTime: text(17) || null,
        parValue: extractParValue(text(18)),
      });
    });

  return { rows, warnings };
};
