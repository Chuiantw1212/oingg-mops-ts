import prisma from '../../adapters/prisma/index';
import { fetchDividendDistribution } from './service';
import { parseDividendDistribution } from './parser';
import type { DividendYearPayload } from './types';

export interface IngestDividendYearResult {
  success: boolean;
  companyId: string;
  year: string;
  fetched: number;
  skipped: number;
  parseWarnings: string[];
  error?: string;
}

// 抓取單一公司、單一民國年的股利分派公告資料（可能是 0~多筆）。這個端點沒有「單一資料是否已存在」
// 可以拿來跳過整次呼叫的概念（一次查詢就是一整年份，MOPS 隨時可能新增/更正該年公告），
// 所以每次呼叫都會真的打 MOPS；force 只控制「個別事件」（依 symbol+rightsRecordDate）已存在時是否覆寫。
export const ingestDividendDistributionYear = async (payload: DividendYearPayload): Promise<IngestDividendYearResult> => {
  const { companyId, year, typek, force } = payload;

  let html: string;
  try {
    html = await fetchDividendDistribution({ companyId, year, typek });
  } catch (error) {
    return { success: false, companyId, year, fetched: 0, skipped: 0, parseWarnings: [], error: error instanceof Error ? error.message : String(error) };
  }

  let rows;
  let parseWarnings: string[];
  try {
    ({ rows, warnings: parseWarnings } = parseDividendDistribution(html, companyId));
  } catch (error) {
    return { success: false, companyId, year, fetched: 0, skipped: 0, parseWarnings: [], error: error instanceof Error ? error.message : String(error) };
  }

  let fetched = 0;
  let skipped = 0;
  for (const row of rows) {
    const where = { symbol_rightsRecordDate: { symbol: companyId, rightsRecordDate: row.rightsRecordDate } };

    if (!force) {
      const existing = await prisma.dividendDistribution.findUnique({ where });
      if (existing) {
        skipped++;
        continue;
      }
    }

    await prisma.dividendDistribution.upsert({
      where,
      create: { symbol: companyId, ...row },
      update: { ...row },
    });
    fetched++;
  }

  return { success: true, companyId, year, fetched, skipped, parseWarnings };
};
