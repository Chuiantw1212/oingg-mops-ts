import { type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { ingestPreferredStockRights } from './ingest';
import { CompanyNotFoundError } from './service';

const requestSchema = z.object({
  companyId: z.string({ required_error: 'companyId is required.' }).min(1),
  typek: z.enum(['sii', 'otc']).default('sii'),
  force: z.boolean().optional().default(false),
});

export const ingestPreferredStockRightsHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validationResult = requestSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        message: 'Invalid request body.',
        errors: validationResult.error.format(),
      });
    }

    const result = await ingestPreferredStockRights(validationResult.data);

    if (!result.success) {
      const status = result.error?.includes('查無公司代號') ? 404 : 502;
      return res.status(status).json({
        message: 'Failed to fetch preferred stock rights from MOPS.',
        error: result.error,
      });
    }

    res.status(200).json({
      message: `Ingested preferred stock rights for ${result.companyId}: ${result.fetched} fetched, ${result.skipped} skipped, ${result.failed} failed (of ${result.totalEntries} entries).`,
      ...result,
    });
  } catch (error) {
    if (error instanceof CompanyNotFoundError) {
      return res.status(404).json({ message: error.message });
    }
    console.error('Preferred stock rights ingestion failed:', error);
    next(error);
  }
};
