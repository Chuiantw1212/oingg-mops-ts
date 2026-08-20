import * as cheerio from 'cheerio';
import { toNumberOrNull } from '../../shared/mopsReportParsing';
import { parseRocDate } from '../../shared/rocDate';
import { CompanyNotFoundError } from './service';
import type { PreferredStockDetail, PreferredStockListEntry } from './types';

const NOT_FOUND_MARKER = '之公司不存在';

// 跟 capitalStock/parser.ts 同樣的教訓：MOPS 標籤有時會用空白把每個中文字隔開做視覺對齊，
// 比對前先去除所有空白（含 &nbsp;）跟括號內容再比較，這次直接預先套用，不等真的撞到才修。
const normalizeLabel = (raw: string) =>
  raw
    .replace(/[（(].*?[）)]/g, '') // 去除括號內容（單位/填空提示，如 "序號(第__資料)" 的 "(第__資料)"）
    .replace(/\s+/g, '');

// Step1：解析某公司底下所有特別股（各版本）清單。
export const parseStep1 = (html: string, companyId: string): PreferredStockListEntry[] => {
  if (html.includes(NOT_FOUND_MARKER)) {
    throw new CompanyNotFoundError(companyId);
  }

  const $ = cheerio.load(html);
  const entries: PreferredStockListEntry[] = [];

  $("tr.even, tr.odd").each((_, tr) => {
    const cells = $(tr).find('td').toArray();
    // 每列前三個 td 固定是 股票代號/期別/特別股名稱；第四個 td 裡包著查明細用的隱藏表單，不需要解析內容。
    if (cells.length < 3) return;
    const preferredStockCode = $(cells[0]!).text().trim();
    const seriesNoText = $(cells[1]!).text().trim();
    const preferredStockName = $(cells[2]!).text().trim();
    const seriesNo = Number(seriesNoText);
    if (!preferredStockCode || !Number.isFinite(seriesNo)) return;
    entries.push({ preferredStockCode, seriesNo, preferredStockName });
  });

  return entries;
};

const buildLabelValueMap = ($: cheerio.CheerioAPI): Map<string, string> => {
  const map = new Map<string, string>();
  // 標籤是 <th class='tblHead'>，緊接在後的下一個儲存格（可能是 th 也可能是 td，取決於同一列排版）是值。
  const cells = $('th, td').toArray();
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i]!;
    if ($(cell).is('th') && $(cell).hasClass('tblHead')) {
      const label = normalizeLabel($(cell).text());
      const value = cells[i + 1] ? $(cells[i + 1]!).text().trim() : '';
      if (label) map.set(label, value);
    }
  }
  return map;
};

const findValue = (map: Map<string, string>, label: string): string | null => map.get(normalizeLabel(label)) ?? null;

const parseBoolean = (raw: string | null, trueValue: string, falseValue: string): boolean | null => {
  if (raw === null) return null;
  const trimmed = raw.trim();
  if (trimmed === trueValue) return true;
  if (trimmed === falseValue) return false;
  return null;
};

// Step2：解析單一版本的特別股權利明細。
export const parseStep2 = (html: string, companyId: string): PreferredStockDetail => {
  if (html.includes(NOT_FOUND_MARKER)) {
    throw new CompanyNotFoundError(companyId);
  }

  const $ = cheerio.load(html);
  if ($("table.hasBorder").length === 0) {
    throw new Error(`t47sb12 Step2：找不到預期的明細表格（table.hasBorder），MOPS 回應格式可能已變更或暫時性錯誤（companyId=${companyId}）。`);
  }

  const map = buildLabelValueMap($);
  const previousSeriesNoText = findValue(map, '修改前次序號');
  const previousSeriesNo = previousSeriesNoText ? Number(previousSeriesNoText) : null;

  return {
    issueDate: parseRocDate(findValue(map, '發行日期')),
    cumulativeDividend: parseBoolean(findValue(map, '累積股利'), '是', '否'),
    issuePrice: toNumberOrNull(findValue(map, '發行價格')),
    dividendRate: toNumberOrNull(findValue(map, '股息')),

    participatingExcessDividend: parseBoolean(findValue(map, '參加超額股利分配'), '有', '無'),
    liquidationPreference: parseBoolean(findValue(map, '分配剩餘財產優先權'), '有', '無'),
    votingRights: parseBoolean(findValue(map, '表決權'), '有', '無'),
    eligibleForElection: parseBoolean(findValue(map, '被選舉權'), '有', '無'),
    convertible: parseBoolean(findValue(map, '轉換權'), '有', '無'),
    conversionStartDate: parseRocDate(findValue(map, '開始轉換時間')),

    redeemable: parseBoolean(findValue(map, '是否收回'), '是', '否'),
    redemptionDate: parseRocDate(findValue(map, '收回時間')),
    redemptionConditions: findValue(map, '收回條件') || null,

    cashCapitalIncreaseSubscriptionRight: parseBoolean(findValue(map, '現金增資認購權'), '有', '無'),
    earningsCapitalizationRight: parseBoolean(findValue(map, '盈餘轉增資配股權'), '有', '無'),
    assetRevaluationSurplusRight: parseBoolean(findValue(map, '資產重估淨增值'), '有', '無'),
    assetDisposalSurplusRight: parseBoolean(findValue(map, '處分資產盈餘'), '有', '無'),
    commonStockPremiumRight: parseBoolean(findValue(map, '發行普通股溢價'), '有', '無'),

    modifiedDate: parseRocDate(findValue(map, '修改日期')),
    previousSeriesNo: previousSeriesNo !== null && Number.isFinite(previousSeriesNo) ? previousSeriesNo : null,
  };
};
