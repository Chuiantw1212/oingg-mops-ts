import { Router, type Request, type Response, type NextFunction } from 'ultimate-express';
import { prisma } from '../../adapters/prisma/index.js';

const router = Router();

/**
 * @swagger
 * /healthz:
 *   get:
 *     summary: Perform a health check
 *     description: Checks the health of the service, including the database connection.
 *     tags: [System]
 *     responses:
 *       200:
 *         description: The service is healthy.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                   status:
 *                     type: string
 *                     example: "ok"
 *                   message:
 *                     type: string
 *                     example: "Database connection is healthy."
 *       503:
 *         description: The service is unhealthy.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 503
 *                 message:
 *                   type: string
 *                   example: "Database connection failed."
 */
router.get('/healthz', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Use a lightweight query to check database connectivity.
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: 'ok', message: 'Database connection is healthy.' });
  } catch (error) {
    const serviceUnavailableError = new Error('Database connection failed.');
    // Attach a status code for the central error handler.
    (serviceUnavailableError as any).status = 503;
    next(serviceUnavailableError);
  }
});

export default router;