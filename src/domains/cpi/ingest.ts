import prisma from '../../adapters/prisma/index';
import { fetchMonthlyCpi } from './service';
import { parseMonthlyCpi } from './parser';

// DGBAS 這條序列已知最早的資料是 1981-M1（見規格取樣的完整回應），固定從這裡開始抓，不用讓呼叫端指定。
const START_YEAR = 1981;

export interface IngestMonthlyCpiResult {
  success: boolean;
  totalPoints: number;
  fetched: number;
  skipped: number;
  error?: string;
}

// 一次請求就拿到 1981-M1 至今的整段月資料（DGBAS 這個 SDMX 端點本身不分頁、不需要重複請求），
// 逐月 upsert；force 控制已存在的月份要不要覆寫（CPI 數字偶爾會被 DGBAS 事後小幅修正，尤其是近期月份）。
export const ingestMonthlyCpi = async (force = false): Promise<IngestMonthlyCpiResult> => {
  const now = new Date();

  let raw: unknown;
  try {
    raw = await fetchMonthlyCpi({ startYear: START_YEAR, endYear: now.getFullYear(), endMonth: now.getMonth() + 1 });
  } catch (error) {
    return { success: false, totalPoints: 0, fetched: 0, skipped: 0, error: error instanceof Error ? error.message : String(error) };
  }

  let points;
  try {
    points = parseMonthlyCpi(raw);
  } catch (error) {
    return { success: false, totalPoints: 0, fetched: 0, skipped: 0, error: error instanceof Error ? error.message : String(error) };
  }

  let fetched = 0;
  let skipped = 0;
  for (const point of points) {
    const where = { year_month: { year: point.year, month: point.month } };

    if (!force) {
      const existing = await prisma.monthlyCpi.findUnique({ where });
      if (existing) {
        skipped++;
        continue;
      }
    }

    await prisma.monthlyCpi.upsert({
      where,
      create: { year: point.year, month: point.month, indexValue: point.indexValue },
      update: { indexValue: point.indexValue },
    });
    fetched++;
  }

  return { success: true, totalPoints: points.length, fetched, skipped };
};
