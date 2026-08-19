import prisma from '../../adapters/prisma/index';
import { getQuarterEndDate, getLatestAvailableQuarter, getPastNQuarters } from '../../shared/rocQuarter';
import { serializeBigInt } from '../../shared/serializeBigInt';
import { fetchBalanceSheet } from './service';
import { parseBalanceSheetReport } from './parser';
import type { BalanceSheetPayload } from './types';

export { getLatestAvailableQuarter, getPastNQuarters, serializeBigInt };

interface MopsBalanceSheetResponse {
  code: number;
  message: string;
  result?: {
    reportList: string[][];
    [key: string]: unknown;
  };
}

export interface OneQuarterPayload {
  companyId: string;
  year: string; // 民國年，例如 "114"
  season: BalanceSheetPayload['season'];
  dataType: BalanceSheetPayload['dataType'];
  subsidiaryCompanyId: string;
  /** true 時即使資料庫已有資料也會強制重新向 MOPS 抓取並覆蓋。 */
  force?: boolean;
}

export interface IngestOneQuarterResult {
  success: boolean;
  /** true 表示資料庫已有資料、且未強制更新，因此沒有呼叫 MOPS。 */
  skipped: boolean;
  companyId: string;
  year: string;
  season: BalanceSheetPayload['season'];
  dataType: BalanceSheetPayload['dataType'];
  warnings: string[];
  mopsMessage?: string;
  error?: string;
  record?: unknown;
}

// 向 MOPS 抓取單一季度資產負債表、解析、並 upsert 進資料庫。單筆 API 與批次回補 API 共用此邏輯。
// 預設會先查資料庫；已有資料且未帶 force 就直接跳過，不會呼叫 MOPS。
export const ingestOneQuarter = async (payload: OneQuarterPayload): Promise<IngestOneQuarterResult> => {
  const meta = { companyId: payload.companyId, year: payload.year, season: payload.season, dataType: payload.dataType };
  const where = {
    symbol_year_quarter_dataType_subsidiaryCompanyId: {
      symbol: payload.companyId,
      year: Number(payload.year),
      quarter: Number(payload.season),
      dataType: payload.dataType,
      subsidiaryCompanyId: payload.subsidiaryCompanyId,
    },
  };

  try {
    if (!payload.force) {
      const existing = await prisma.quarterlyBalanceSheet.findUnique({ where });
      if (existing) {
        return { success: true, skipped: true, ...meta, warnings: [], record: existing };
      }
    }

    const mopsResponse: MopsBalanceSheetResponse = await fetchBalanceSheet(payload);

    if (mopsResponse.code !== 200 || !mopsResponse.result) {
      return { success: false, skipped: false, ...meta, warnings: [], mopsMessage: mopsResponse.message };
    }

    const { warnings, ...parsedFields } = parseBalanceSheetReport(mopsResponse.result.reportList);

    const record = await prisma.quarterlyBalanceSheet.upsert({
      where,
      create: {
        symbol: payload.companyId,
        year: Number(payload.year),
        quarter: Number(payload.season),
        dataType: payload.dataType,
        subsidiaryCompanyId: payload.subsidiaryCompanyId,
        reportDate: getQuarterEndDate(payload.year, payload.season),
        ...parsedFields,
      },
      update: {
        reportDate: getQuarterEndDate(payload.year, payload.season),
        ...parsedFields,
      },
    });

    return { success: true, skipped: false, ...meta, warnings, record };
  } catch (error) {
    return { success: false, skipped: false, ...meta, warnings: [], error: error instanceof Error ? error.message : String(error) };
  }
};
