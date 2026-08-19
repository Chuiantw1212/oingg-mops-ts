import * as cheerio from 'cheerio';
import { toBigIntOrNull, toNumberOrNull } from '../../shared/mopsReportParsing';
import { CompanyNotFoundError } from './service';
import type { CapitalStockChangeEvent, CapitalStockStep1Result, CapitalStockStep2Detail } from './types';

const NOT_FOUND_MARKER = '之公司不存在';

// Step1：解析「歷史清單」HTML 片段，取得正確 TYPEK 與全部（未篩選近 5 年）的變更事件年月（西元）。
export const parseStep1 = (html: string, companyId: string): CapitalStockStep1Result => {
  if (html.includes(NOT_FOUND_MARKER)) {
    throw new CompanyNotFoundError(companyId);
  }

  const $ = cheerio.load(html);
  const typek = $("input[name='TYPEK']").attr('value');
  if (!typek) {
    throw new Error('t05st05 Step1：解析不到 TYPEK 隱藏欄位，MOPS 回應格式可能已變更，請重新核對規格文件。');
  }

  if ($("table.hasBorder").length === 0) {
    throw new Error('t05st05 Step1：找不到預期的歷史清單表格（table.hasBorder），MOPS 回應格式可能已變更或暫時性錯誤。');
  }

  // 不依賴「115年 5月」的民國年文字解析，onclick 裡的西元年更穩定（見規格文件 §1 解析規則第3點）。
  const events: CapitalStockChangeEvent[] = [];
  $("table.hasBorder input[type='button']").each((_, el) => {
    const onclick = $(el).attr('onclick') ?? '';
    const yearMatch = onclick.match(/year\.value\s*=\s*"(\d{4})"/);
    const monthMatch = onclick.match(/month\.value\s*=\s*"(\d{1,2})"/);
    if (yearMatch && monthMatch) {
      events.push({ year: Number(yearMatch[1]), month: Number(monthMatch[1]) });
    }
  });

  return { typek, events };
};

// Step2：把「標籤儲存格 + 數值儲存格」交錯排列的表格解析成 label -> value 文字的對照表。
// 不用固定 XPath index，而是照文件順序把 tblHead 儲存格跟緊接在後面的下一個儲存格配對（見規格文件 §2 解析規則第2點）。
const buildLabelValueMap = ($: cheerio.CheerioAPI): Map<string, string> => {
  const map = new Map<string, string>();
  const cells = $('td').toArray();
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i]!;
    if ($(cell).hasClass('tblHead')) {
      const label = $(cell).text().trim();
      const value = cells[i + 1] ? $(cells[i + 1]!).text().trim() : '';
      if (label) map.set(label, value);
    }
  }
  return map;
};

// 部分標籤可能帶有 "(股)"/"(元)" 等單位後綴，或跟規格文件記錄的文字有些微差異；精確比對失敗時，
// 用「去除括號後綴」的寬鬆比對再試一次，避免因為單位後綴不同就整個欄位變成找不到。
const findValue = (map: Map<string, string>, label: string): string | null => {
  if (map.has(label)) return map.get(label) ?? null;
  const normalizedTarget = label.replace(/[（(].*?[）)]/g, '').trim();
  for (const [key, value] of map) {
    if (key.replace(/[（(].*?[）)]/g, '').trim() === normalizedTarget) return value;
  }
  return null;
};

export const parseStep2 = (html: string, companyId: string, event: CapitalStockChangeEvent): { detail: CapitalStockStep2Detail; warnings: string[] } => {
  if (html.includes(NOT_FOUND_MARKER)) {
    throw new CompanyNotFoundError(companyId);
  }

  const $ = cheerio.load(html);
  if ($("table.hasBorder").length === 0) {
    throw new Error(
      `t05st05 Step2：找不到預期的明細表格（table.hasBorder）(companyId=${companyId}, ${event.year}/${event.month})，MOPS 回應格式可能已變更或暫時性錯誤。`
    );
  }

  const map = buildLabelValueMap($);
  const warnings: string[] = [];

  // 變更公司執照時間（民國年/月）：規格文件標註「年 / 月，兩個相鄰 <TD>」，即標籤後面接著兩個獨立的值儲存格。
  let licenseChangeYear: number | null = null;
  let licenseChangeMonth: number | null = null;
  const cells = $('td').toArray();
  const licenseLabelIndex = cells.findIndex((c) => $(c).text().trim().startsWith('變更公司執照時間'));
  if (licenseLabelIndex !== -1) {
    const yearText = cells[licenseLabelIndex + 1] ? $(cells[licenseLabelIndex + 1]!).text() : '';
    const monthText = cells[licenseLabelIndex + 2] ? $(cells[licenseLabelIndex + 2]!).text() : '';
    const yearMatch = yearText.match(/(\d+)/);
    const monthMatch = monthText.match(/(\d+)/);
    licenseChangeYear = yearMatch ? Number(yearMatch[1]) : null;
    licenseChangeMonth = monthMatch ? Number(monthMatch[1]) : null;
  }
  if (licenseChangeYear === null) {
    warnings.push('解析不到「變更公司執照時間」，licenseChangeYear/Month 會是 null（不影響主鍵，主鍵用的是 Step1 提供的西元年月）。');
  }

  const paidInCapital = toBigIntOrNull(findValue(map, '實收股本金額(元)'));
  if (paidInCapital === null) {
    warnings.push('解析不到「實收股本金額」，本表主要目標欄位 paidInCapital 會是 null。');
  }

  const detail: CapitalStockStep2Detail = {
    parValue: toNumberOrNull(findValue(map, '每股面額')),
    licenseChangeYear,
    licenseChangeMonth,
    authorizedShares: toBigIntOrNull(findValue(map, '核定股本股數(股)')),
    authorizedCapital: toBigIntOrNull(findValue(map, '核定股本金額(元)')),
    paidInShares: toBigIntOrNull(findValue(map, '實收股本股數(股)')),
    paidInCapital,
    sourceInitialCapital: toBigIntOrNull(findValue(map, '1.創立時資本')),
    sourceCashIncrease: toBigIntOrNull(findValue(map, '2.現金增資')),
    sourceCapitalReserveTransfer: toBigIntOrNull(findValue(map, '3.資本公積轉增資')),
    sourceRetainedEarningsTransfer: toBigIntOrNull(findValue(map, '4.盈餘轉增資')),
    capitalReserveApprovalDate: findValue(map, '5.證期局核准資本公積之日期') || null,
    retainedEarningsApprovalDate: findValue(map, '6.證期局核准盈餘轉增資之日期') || null,
    sourceMergerIncrease: toBigIntOrNull(findValue(map, '7.合併增資(元)')),
    sourceCapitalReduction: toBigIntOrNull(findValue(map, '8.減資(元)')),
    mergerApprovalDate: findValue(map, '9.證期局核准合併增資之日期') || null,
    capitalReductionApprovalDate: findValue(map, '10.證期局核准減資之日期') || null,
    sourceOther: findValue(map, '11.其他') || null,
    nonCashContribution: findValue(map, '以現金以外之財產抵充股款者') || null,
    remarks: findValue(map, '其他(備註)') || null,
  };

  return { detail, warnings };
};
