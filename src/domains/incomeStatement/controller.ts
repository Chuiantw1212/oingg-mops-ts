import { type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import prisma from '../../adapters/prisma/index.js';
import { fetchIncomeStatement } from './service.js';
import { parseIncomeStatementReport } from './parser.js';
import type { IncomeStatementPayload } from './types.js';

const requestSchema = z.object({
  companyId: z.string({ required_error: 'companyId is required.' }).min(1),
  year: z.string({ required_error: 'year is required.' }).min(1), // 民國年，例如 "114"
  season: z.enum(['1', '2', '3', '4'], { required_error: 'season is required.' }),
  dataType: z.enum(['1', '2']).default('2'), // 1 = 個體, 2 = 合併
  subsidiaryCompanyId: z.string().optional().default(''),
});

interface MopsIncomeStatementResponse {
  code: number;
  message: string;
  result?: {
    reportList: string[][];
    [key: string]: unknown;
  };
}

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

export const ingestIncomeStatements = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validationResult = requestSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        message: 'Invalid request body.',
        errors: validationResult.error.format(),
      });
    }
    const payload = validationResult.data;

    const mopsResponse: MopsIncomeStatementResponse = await fetchIncomeStatement(payload);

    if (mopsResponse.code !== 200 || !mopsResponse.result) {
      return res.status(502).json({
        message: 'MOPS API did not return a usable report.',
        mopsMessage: mopsResponse.message,
      });
    }

    // MOPS 回應本質上就是 JSON，externally-typed 為 unknown 索引簽章，轉型讓 Prisma 的 Json 欄位接受。
    const rawResult = mopsResponse.result as unknown as Prisma.InputJsonValue;
    const { warnings, ...parsedFields } = parseIncomeStatementReport(mopsResponse.result.reportList);
    if (warnings.length > 0) {
      console.warn(`[ingestIncomeStatements] ${payload.companyId} ${payload.year}Q${payload.season}:`, warnings);
    }

    const record = await prisma.quarterlyIncomeStatement.upsert({
      where: {
        symbol_year_quarter_dataType_subsidiaryCompanyId: {
          symbol: payload.companyId,
          year: Number(payload.year),
          quarter: Number(payload.season),
          dataType: payload.dataType,
          subsidiaryCompanyId: payload.subsidiaryCompanyId,
        },
      },
      create: {
        symbol: payload.companyId,
        year: Number(payload.year),
        quarter: Number(payload.season),
        dataType: payload.dataType,
        subsidiaryCompanyId: payload.subsidiaryCompanyId,
        reportDate: getQuarterEndDate(payload.year, payload.season),
        raw: rawResult,
        ...parsedFields,
      },
      update: {
        reportDate: getQuarterEndDate(payload.year, payload.season),
        raw: rawResult,
        ...parsedFields,
      },
    });

    res.status(201).json({
      message: 'Successfully ingested income statement.',
      warnings,
      // BigInt fields (operatingRevenue 等) 無法被 JSON.stringify 直接序列化，轉成 string。
      record: JSON.parse(JSON.stringify(record, (_key, value) => (typeof value === 'bigint' ? value.toString() : value))),
    });
  } catch (error) {
    console.error('Ingestion failed:', error);
    next(error); // 將錯誤傳遞給中央錯誤處理器
  }
};
