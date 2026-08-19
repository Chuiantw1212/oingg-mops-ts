import prisma from '../../adapters/prisma/index.js';
import { fetchIncomeStatement } from './service.js';
import { parseIncomeStatementReport } from './parser.js';
import type { IncomeStatementPayload } from './types.js';

interface MopsIncomeStatementResponse {
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
  season: IncomeStatementPayload['season'];
  dataType: IncomeStatementPayload['dataType'];
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
  season: IncomeStatementPayload['season'];
  dataType: IncomeStatementPayload['dataType'];
  warnings: string[];
  mopsMessage?: string;
  error?: string;
  record?: unknown;
}

type Season = IncomeStatementPayload['season'];

// 公開發行公司季報法定公告截止日：Q1 5/15、Q2 8/14、Q3 11/14、Q4(年報) 次年 3/31。
// monthOffsetYears: 截止日落在「該季度所屬 ROC 年 + 1911」的隔幾個西元年（Q4 跨到隔年）。
const QUARTER_DEADLINES: Record<Season, { monthOffsetYears: number; month: number; day: number }> = {
  '1': { monthOffsetYears: 0, month: 5, day: 15 },
  '2': { monthOffsetYears: 0, month: 8, day: 14 },
  '3': { monthOffsetYears: 0, month: 11, day: 14 },
  '4': { monthOffsetYears: 1, month: 3, day: 31 },
};

const SEASONS_DESC: Season[] = ['4', '3', '2', '1'];

// 依法定截止日，找出「今天」為止最新一筆應該已經公告的季度。
export const getLatestAvailableQuarter = (today: Date): { rocYear: number; season: Season } => {
  const currentRocYear = today.getFullYear() - 1911;

  // 由近至遠依序檢查：今年 Q4~Q1，再往前一年 Q4~Q1。最壞情況（例如今天是 1 月初，
  // 去年 Q4 的截止日 3/31 都還沒到）需要一路查到前年 Q3，因此涵蓋今年 + 前一年共 8 季足夠。
  const candidates: { rocYear: number; season: Season }[] = [
    ...SEASONS_DESC.map((season) => ({ rocYear: currentRocYear, season })),
    ...SEASONS_DESC.map((season) => ({ rocYear: currentRocYear - 1, season })),
  ];

  for (const candidate of candidates) {
    const { monthOffsetYears, month, day } = QUARTER_DEADLINES[candidate.season];
    const deadline = new Date(candidate.rocYear + 1911 + monthOffsetYears, month - 1, day);
    if (today.getTime() >= deadline.getTime()) {
      return candidate;
    }
  }

  // 理論上不會到這裡（8 季已涵蓋最壞情況）；保底回傳前年 Q4。
  return { rocYear: currentRocYear - 2, season: '4' };
};

// 由 latest 往前數 n 季（含 latest 本身），依時間先後（舊 -> 新）回傳。
export const getPastNQuarters = (latest: { rocYear: number; season: Season }, n: number): { year: string; season: Season }[] => {
  const quarters: { rocYear: number; season: Season }[] = [];
  let { rocYear, season } = latest;
  for (let i = 0; i < n; i++) {
    quarters.push({ rocYear, season });
    const idx = SEASONS_DESC.indexOf(season);
    if (idx === SEASONS_DESC.length - 1) {
      rocYear -= 1;
      season = '4';
    } else {
      season = SEASONS_DESC[idx + 1]!;
    }
  }
  return quarters.reverse().map((q) => ({ year: String(q.rocYear), season: q.season }));
};

// 季度結束日（西元），MOPS 原始資料本身沒有明確的報告日期欄位。
const getQuarterEndDate = (rocYear: string, season: IncomeStatementPayload['season']): Date => {
  const gregorianYear = Number(rocYear) + 1911;
  const quarterEndMonthDay: Record<typeof season, [number, number]> = {
    '1': [2, 31], // 3/31 (month is 0-indexed)
    '2': [5, 30], // 6/30
    '3': [8, 30], // 9/30
    '4': [11, 31], // 12/31
  };
  const [month, day] = quarterEndMonthDay[season];
  return new Date(Date.UTC(gregorianYear, month, day));
};

// 向 MOPS 抓取單一季度損益表、解析、並 upsert 進資料庫。單筆 API 與批次回補 API 共用此邏輯。
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
      const existing = await prisma.quarterlyIncomeStatement.findUnique({ where });
      if (existing) {
        return { success: true, skipped: true, ...meta, warnings: [], record: existing };
      }
    }

    const mopsResponse: MopsIncomeStatementResponse = await fetchIncomeStatement(payload);

    if (mopsResponse.code !== 200 || !mopsResponse.result) {
      return { success: false, skipped: false, ...meta, warnings: [], mopsMessage: mopsResponse.message };
    }

    const { warnings, ...parsedFields } = parseIncomeStatementReport(mopsResponse.result.reportList);

    const record = await prisma.quarterlyIncomeStatement.upsert({
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

// BigInt 欄位（operatingRevenue 等）無法被 JSON.stringify 直接序列化，轉成 string。
export const serializeBigInt = <T>(value: T) =>
  JSON.parse(JSON.stringify(value, (_key, v) => (typeof v === 'bigint' ? v.toString() : v)));
