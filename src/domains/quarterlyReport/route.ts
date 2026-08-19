import { Router } from 'ultimate-express';
import { ingestQuarterlyReport } from './controller';

const router = Router();

/**
 * @swagger
 * /api/ingest/quarterly-report:
 *   post:
 *     summary: 以公司為單位，同時抓取單一季度的損益表、資產負債表、現金流量表
 *     description: >
 *       依序呼叫損益表、資產負債表、現金流量表各自的抓取邏輯（與各自單獨的 /api/ingest/... API 完全相同的
 *       skip/force 規則：資料庫已有資料且未帶 force 就跳過、不呼叫 MOPS）。
 *       三支對外請求（MOPS）之間間隔 5 秒；若某一表因為已在資料庫中而被跳過，該次不算對外請求，
 *       不會佔用等待時間，因此若三表都已存在，會在數百毫秒內完成，不需要等待 10 秒。
 *       任一表抓取失敗（例如 MOPS 查無資料）不會中斷其餘表的抓取，最終回應會列出三表各自的結果。
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
 *                 example: "115"
 *               season:
 *                 type: string
 *                 enum: ["1", "2", "3", "4"]
 *                 description: "季度"
 *                 example: "2"
 *               dataType:
 *                 type: string
 *                 enum: ["1", "2"]
 *                 description: "1 = 個體, 2 = 合併，預設 2"
 *                 default: "2"
 *               subsidiaryCompanyId:
 *                 type: string
 *                 description: "子公司代號，查詢母公司本身時留空"
 *                 example: ""
 *               force:
 *                 type: boolean
 *                 description: "true 時三表都強制重新向 MOPS 抓取並覆蓋，即使資料庫已有資料，預設 false"
 *                 default: false
 *     responses:
 *       200:
 *         description: 流程執行完畢（個別報表失敗不影響整體回應），回傳三表各自的結果與成功筆數統計。
 *       400:
 *         description: 請求的參數格式錯誤。
 */
router.post('/quarterly-report', ingestQuarterlyReport);

export default router;
