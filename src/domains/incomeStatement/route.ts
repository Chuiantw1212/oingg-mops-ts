import { Router } from 'ultimate-express';
import { ingestIncomeStatements } from './controller';

const router = Router();

/**
 * @swagger
 * /api/ingest/income-statements:
 *   post:
 *     summary: 接收並儲存季度損益表資料
 *     description: 用於接收並儲存一或多筆季度損益表紀錄。如果紀錄已存在（根據 symbol, year, quarter 的複合主鍵），則會被忽略。
 *     tags:
 *       - Ingestion
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               data:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     symbol:
 *                       type: string
 *                       description: "公司代號"
 *                       example: "2330"
 *                     year:
 *                       type: integer
 *                       description: "財報年份"
 *                       example: 2023
 *                     quarter:
 *                       type: integer
 *                       description: "財報季度"
 *                       example: 4
 *                     reportDate:
 *                       type: string
 *                       format: date-time
 *                       description: "財報發布日期 (ISO 8601 格式)"
 *                       example: "2024-03-15T00:00:00.000Z"
 *                     operatingRevenue:
 *                       type: string
 *                       description: "營業收入"
 *                       example: "625532000000"
 *                     netIncome:
 *                       type: string
 *                       description: "本期淨利"
 *                       example: "238713000000"
 *                     eps:
 *                       type: number
 *                       description: "每股盈餘 (EPS)"
 *                       example: 9.21
 *     responses:
 *       201:
 *         description: 資料成功接收。回傳新增的紀錄筆數。
 *       400:
 *         description: 請求的資料格式錯誤。
 */
router.post('/api/ingest/income-statements', ingestIncomeStatements);

export default router;