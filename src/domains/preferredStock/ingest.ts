import prisma from '../../adapters/prisma/index';
import { politeDelay } from '../../shared/politeDelay';
import { createPreferredStockHttpClient } from './service';
import { parseStep1, parseStep2 } from './parser';
import type { PreferredStockRightsPayload } from './types';

export interface PreferredStockEntryResult {
  preferredStockCode: string;
  seriesNo: number;
  skipped: boolean;
  success: boolean;
  error?: string;
}

export interface IngestPreferredStockRightsResult {
  success: boolean;
  companyId: string;
  totalEntries: number;
  fetched: number;
  skipped: number;
  failed: number;
  entries: PreferredStockEntryResult[];
  error?: string;
}

// 抓取單一公司底下所有特別股（各版本）的權利明細：Step1 拿清單，Step2 逐筆查明細並 upsert。
// 每一筆版本（依 symbol+preferredStockCode+seriesNo 為主鍵）已存在且未帶 force 就跳過，不呼叫 MOPS；
// 真的呼叫 MOPS 時，Step1 與每次 Step2 之間用隨機浮動間隔（politeDelay），跟其他 domain 一致。
export const ingestPreferredStockRights = async (payload: PreferredStockRightsPayload): Promise<IngestPreferredStockRightsResult> => {
  const { companyId, typek, force } = payload;
  const client = createPreferredStockHttpClient();

  let step1Html: string;
  try {
    step1Html = await client.step1({ companyId, typek });
  } catch (error) {
    return { success: false, companyId, totalEntries: 0, fetched: 0, skipped: 0, failed: 0, entries: [], error: error instanceof Error ? error.message : String(error) };
  }

  let list;
  try {
    list = parseStep1(step1Html, companyId);
  } catch (error) {
    return { success: false, companyId, totalEntries: 0, fetched: 0, skipped: 0, failed: 0, entries: [], error: error instanceof Error ? error.message : String(error) };
  }

  const results: PreferredStockEntryResult[] = [];
  for (const entry of list) {
    const where = {
      symbol_preferredStockCode_seriesNo: { symbol: companyId, preferredStockCode: entry.preferredStockCode, seriesNo: entry.seriesNo },
    };

    if (!force) {
      const existing = await prisma.preferredStockRights.findUnique({ where });
      if (existing) {
        results.push({ preferredStockCode: entry.preferredStockCode, seriesNo: entry.seriesNo, skipped: true, success: true });
        continue;
      }
    }

    // 只有真的要呼叫 MOPS（非 skip）才需要間隔，涵蓋 Step1->第一次 Step2、以及 Step2 之間。
    await politeDelay();

    try {
      const step2Html = await client.step2({ preferredStockCode: entry.preferredStockCode, seriesNo: entry.seriesNo, name: entry.preferredStockName, typek });
      const detail = parseStep2(step2Html, companyId);

      await prisma.preferredStockRights.upsert({
        where,
        create: {
          symbol: companyId,
          preferredStockCode: entry.preferredStockCode,
          seriesNo: entry.seriesNo,
          preferredStockName: entry.preferredStockName,
          ...detail,
        },
        update: { preferredStockName: entry.preferredStockName, ...detail },
      });

      results.push({ preferredStockCode: entry.preferredStockCode, seriesNo: entry.seriesNo, skipped: false, success: true });
    } catch (error) {
      results.push({
        preferredStockCode: entry.preferredStockCode,
        seriesNo: entry.seriesNo,
        skipped: false,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    success: true,
    companyId,
    totalEntries: list.length,
    fetched: results.filter((r) => r.success && !r.skipped).length,
    skipped: results.filter((r) => r.skipped).length,
    failed: results.filter((r) => !r.success).length,
    entries: results,
  };
};
