import { type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { ingestMonthlyCpi } from './ingest';

const requestSchema = z.object({
  force: z.boolean().optional().default(false), // true 時已存在的月份也強制覆寫（用於 DGBAS 事後修正近期月份數字的情況）
});

export const ingestCpi = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validationResult = requestSchema.safeParse(req.body ?? {});
    if (!validationResult.success) {
      return res.status(400).json({
        message: 'Invalid request body.',
        errors: validationResult.error.format(),
      });
    }

    const result = await ingestMonthlyCpi(validationResult.data.force);

    if (!result.success) {
      return res.status(502).json({
        message: 'Failed to fetch CPI data from DGBAS.',
        error: result.error,
      });
    }

    res.status(200).json({
      message: `Ingested monthly CPI data: ${result.fetched} fetched, ${result.skipped} skipped (of ${result.totalPoints} months total).`,
      ...result,
    });
  } catch (error) {
    console.error('CPI ingestion failed:', error);
    next(error);
  }
};
