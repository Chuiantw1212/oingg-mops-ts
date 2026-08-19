import { type Request, type Response, type NextFunction } from 'express';
import prisma from '../../adapters/prisma/index';
import { z } from 'zod';

// Zod 的 BigInt 需要從 string 或 number 轉換，我們用 preprocess 處理
const toBigInt = (val: unknown): bigint | unknown => {
  if (typeof val === 'number' || typeof val === 'string') {
    try {
      // 確保不是空字串
      if (String(val).trim() === '') return null;
      return BigInt(val);
    } catch (e) {
      return val; // 如果轉換失敗，返回原值以便 Zod 捕捉錯誤
    }
  }
  return val; // 如果不是 string 或 number，返回原值
};
const bigIntOptional = z.preprocess(toBigInt, z.bigint().optional().nullable());

// 定義單筆損益表紀錄的驗證規則
const incomeStatementSchema = z.object({
  symbol: z.string({ required_error: 'symbol is required.' }).min(1),
  year: z.number({ required_error: 'year is required.' }).int(),
  quarter: z.number({ required_error: 'quarter is required.' }).int().min(1).max(4),
  reportDate: z.string({ required_error: 'reportDate is required.' }).datetime({ message: 'Invalid datetime string. Use ISO 8601 format.' }),
  operatingRevenue: bigIntOptional,
  grossProfit: bigIntOptional,
  operatingIncome: bigIntOptional,
  profitBeforeTax: bigIntOptional,
  netIncome: bigIntOptional,
  eps: z.number().optional().nullable(),
});

// 定義整個請求 body 的驗證規則
const ingestSchema = z.object({
  data: z.array(incomeStatementSchema).min(1, { message: 'Input data array cannot be empty.' }),
});

export const ingestIncomeStatements = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 1. 驗證請求 Body
    const validationResult = ingestSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        message: 'Invalid request body.',
        errors: validationResult.error.format(),
      });
    }

    // 2. 使用 Prisma 的 createMany 進行高效率批次寫入
    const { data } = validationResult.data;
    const result = await prisma.quarterlyIncomeStatement.createMany({
      data,
      skipDuplicates: true, // 忽略會導致唯一性約束衝突的紀錄
    });

    res.status(201).json({
      message: `Successfully ingested data. ${result.count} new records were created.`,
      count: result.count,
    });
  } catch (error) {
    console.error('Ingestion failed:', error);
    next(error); // 將錯誤傳遞給中央錯誤處理器
  }
};