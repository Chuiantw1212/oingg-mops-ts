import { type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { serializeBigInt } from '../../shared/serializeBigInt';
import { ingestCapitalStockHistory } from './ingest';
import { CompanyNotFoundError } from './service';

const requestSchema = z.object({
  companyId: z.string({ required_error: 'companyId is required.' }).min(1),
  force: z.boolean().optional().default(false), // true 時即使資料庫已有該筆變更紀錄也強制重新抓取覆蓋
});

export const ingestCapitalStockHistoryHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validationResult = requestSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        message: 'Invalid request body.',
        errors: validationResult.error.format(),
      });
    }

    const result = await ingestCapitalStockHistory(validationResult.data);

    if (!result.success) {
      const status = result.error?.includes('查無公司代號') ? 404 : 502;
      return res.status(status).json({
        message: 'Failed to fetch capital stock history from MOPS.',
        error: result.error,
      });
    }

    res.status(200).json({
      message: `Ingested capital stock history for ${result.companyId}: ${result.fetched} fetched, ${result.skipped} skipped, ${result.failed} failed (of ${result.totalEvents} events within the last 5 years).`,
      ...serializeBigInt(result),
    });
  } catch (error) {
    if (error instanceof CompanyNotFoundError) {
      return res.status(404).json({ message: error.message });
    }
    console.error('Capital stock history ingestion failed:', error);
    next(error);
  }
};
