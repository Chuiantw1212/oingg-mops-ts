import { Router } from 'ultimate-express';
import { ingestIncomeStatements } from './controller';

const router = Router();

/**
 * @swagger
 * /api/ingest/income-statements:
 *   post:
 *     summary: 向 MOPS 抓取單一公司季度損益表並存入資料庫
 *     description: >
 *       伺服器會依據參數向 MOPS (https://mops.twse.com.tw/mops/api/t164sb04) 發出請求，
 *       解析回傳的損益表科目，並依 symbol + year + quarter + dataType + subsidiaryCompanyId
 *       複合主鍵 upsert 進資料庫（重複呼叫同一季度會覆蓋更新，不會重複新增）。
 *     tags:
 *       - Ingestion
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - companyId
 *               - year
 *               - season
 *             properties:
 *               companyId:
 *                 type: string
 *                 description: "公司代號"
 *                 example: "2330"
 *               year:
 *                 type: string
 *                 description: "民國年"
 *                 example: "114"
 *               season:
 *                 type: string
 *                 enum: ["1", "2", "3", "4"]
 *                 description: "季度"
 *                 example: "1"
 *               dataType:
 *                 type: string
 *                 enum: ["1", "2"]
 *                 description: "1 = 個體, 2 = 合併，預設 2"
 *                 default: "2"
 *               subsidiaryCompanyId:
 *                 type: string
 *                 description: "子公司代號，查詢母公司本身時留空"
 *                 example: ""
 *     responses:
 *       201:
 *         description: 資料成功抓取並存入。回傳解析後的紀錄與（若有科目解析不到）warnings。
 *       400:
 *         description: 請求的參數格式錯誤。
 *       502:
 *         description: MOPS API 未回傳可用的報表資料。
 */
router.post('/income-statements', ingestIncomeStatements);

export default router;