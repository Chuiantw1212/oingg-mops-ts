import prisma from '../../adapters/prisma/index';
import { createCapitalStockHttpClient } from './service';
import { parseStep1, parseStep2 } from './parser';
import { politeDelay } from '../../shared/politeDelay';
import type { CapitalStockChangeEvent, CapitalStockHistoryPayload } from './types';

// t05st05 是非官方 HTML 端點，MOPS 對此類端點有 IP 封鎖紀錄（見規格文件 §4），比其他 domain 打的正式
// JSON API 風險更高，所以跟其他 domain 共用同一套隨機浮動間隔（見 politeDelay），而不是自己另外訂更短的固定間隔。
const HISTORY_YEARS = 5;

export interface CapitalStockEventResult {
  year: number; // 西元
  month: number;
  skipped: boolean;
  success: boolean;
  warnings: string[];
  error?: string;
  record?: unknown;
}

export interface IngestCapitalStockHistoryResult {
  success: boolean;
  companyId: string;
  typek?: string;
  totalEvents: number;
  fetched: number;
  skipped: number;
  failed: number;
  events: CapitalStockEventResult[];
  error?: string;
}

// 抓取單一公司近 5 年的股本變更歷史：Step1 取得事件清單 + 正確 TYPEK，Step2 逐筆取得明細並 upsert。
// 每一筆變更事件（依 symbol+effectiveYear+effectiveMonth 為主鍵）已存在且未帶 force 就跳過，不呼叫 MOPS。
export const ingestCapitalStockHistory = async (payload: CapitalStockHistoryPayload): Promise<IngestCapitalStockHistoryResult> => {
  const { companyId, force } = payload;
  const client = createCapitalStockHttpClient();

  let step1Html: string;
  try {
    step1Html = await client.step1(companyId);
  } catch (error) {
    return { success: false, companyId, totalEvents: 0, fetched: 0, skipped: 0, failed: 0, events: [], error: error instanceof Error ? error.message : String(error) };
  }

  let typek: string;
  let allEvents: CapitalStockChangeEvent[];
  try {
    const parsed = parseStep1(step1Html, companyId);
    typek = parsed.typek;
    allEvents = parsed.events;
  } catch (error) {
    return { success: false, companyId, totalEvents: 0, fetched: 0, skipped: 0, failed: 0, events: [], error: error instanceof Error ? error.message : String(error) };
  }

  // 近 5 年篩選：用「年」比較即可，不精算月份（見規格文件 §1 解析規則第4點）。
  const cutoffYear = new Date().getFullYear() - HISTORY_YEARS;
  const events = allEvents.filter((e) => e.year >= cutoffYear);

  const results: CapitalStockEventResult[] = [];
  for (const event of events) {
    const where = { symbol_effectiveYear_effectiveMonth: { symbol: companyId, effectiveYear: event.year, effectiveMonth: event.month } };

    if (!force) {
      const existing = await prisma.capitalStockHistory.findUnique({ where });
      if (existing) {
        results.push({ year: event.year, month: event.month, skipped: true, success: true, warnings: [], record: existing });
        continue;
      }
    }

    // 只有真的要呼叫 MOPS（非 skip）才需要間隔，涵蓋 Step1->第一次 Step2、以及 Step2 之間。
    await politeDelay();

    try {
      const step2Html = await client.step2({ typek, companyId, year: event.year, month: event.month });
      const { detail, warnings } = parseStep2(step2Html, companyId, event);

      const record = await prisma.capitalStockHistory.upsert({
        where,
        create: { symbol: companyId, effectiveYear: event.year, effectiveMonth: event.month, market: typek, ...detail },
        update: { market: typek, ...detail },
      });

      results.push({ year: event.year, month: event.month, skipped: false, success: true, warnings, record });
    } catch (error) {
      results.push({ year: event.year, month: event.month, skipped: false, success: false, warnings: [], error: error instanceof Error ? error.message : String(error) });
    }
  }

  return {
    success: true,
    companyId,
    typek,
    totalEvents: events.length,
    fetched: results.filter((r) => r.success && !r.skipped).length,
    skipped: results.filter((r) => r.skipped).length,
    failed: results.filter((r) => !r.success).length,
    events: results,
  };
};
