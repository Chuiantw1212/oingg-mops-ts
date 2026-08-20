import { Router } from 'ultimate-express';
import { ingestIncomeStatements, backfillIncomeStatements } from './controller';

const router = Router();

/**
 * @swagger
 * /api/ingest/income-statements:
 *   post:
 *     summary: 向 MOPS 抓取單一公司季度損益表並存入資料庫
 *     description: >
 *       會先查資料庫是否已有該季資料；已存在且未帶 force 就直接跳過（不呼叫 MOPS，回傳 200）。
 *       沒有資料，或帶 force=true 時，才會向 MOPS (https://mops.twse.com.tw/mops/api/t164sb04) 發出請求，
 *       解析回傳的損益表科目，並依 symbol + year + quarter + dataType + subsidiaryCompanyId
 *       複合主鍵 upsert 進資料庫。
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
 *               force:
 *                 type: boolean
 *                 description: "true 時即使資料庫已有資料也強制重新向 MOPS 抓取並覆蓋，預設 false"
 *                 default: false
 *     responses:
 *       200:
 *         description: 資料庫已有該季資料，未帶 force，跳過未寫入。
 *       201:
 *         description: 資料成功抓取並存入。回傳解析後的紀錄與（若有科目解析不到）warnings。
 *       400:
 *         description: 請求的參數格式錯誤。
 *       502:
 *         description: MOPS API 未回傳可用的報表資料。
 */
router.post('/income-statements', ingestIncomeStatements);

/**
 * @swagger
 * /api/ingest/income-statements/backfill:
 *   post:
 *     summary: 回補單一公司過去 N 年的每季損益表
 *     description: >
 *       終點季度依台灣公開發行公司季報法定公告截止日判斷（Q1 5/15、Q2 8/14、Q3 11/14、Q4 次年 3/31），
 *       取「今天為止最新一筆理論上應該已公告」的季度，再往前數 years*4 季（預設 20 季），
 *       確保抓的每一季在法定截止日邏輯下都應該已有資料，不會浪費請求在還沒到公告期的季度上。
 *       每一季會先查資料庫：已有資料且未帶 force 就直接跳過（不呼叫 MOPS）；
 *       沒有資料，或帶 force=true，才會向 MOPS 發出請求並間隔隨機 5～10 秒再處理下一季（跳過的季度不佔用等待時間；
 *       隨機浮動是為了避免固定週期的請求被防火牆依規律性識別為機器人流量）。
 *       仍查無資料的季度（例如公司該季尚未實際送件）會被記錄下來並繼續下一筆，不會中斷整個流程。
 *       進度會即時輸出到伺服器 console；若大部分季度資料庫已有資料，實際耗時會遠低於 20 季 x 5～10 秒。
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
 *             properties:
 *               companyId:
 *                 type: string
 *                 description: "公司代號"
 *                 example: "2330"
 *               dataType:
 *                 type: string
 *                 enum: ["1", "2"]
 *                 description: "1 = 個體, 2 = 合併，預設 2"
 *                 default: "2"
 *               subsidiaryCompanyId:
 *                 type: string
 *                 description: "子公司代號，查詢母公司本身時留空"
 *                 example: ""
 *               years:
 *                 type: integer
 *                 description: "往前回補幾年（含今年），預設 5"
 *                 default: 5
 *               force:
 *                 type: boolean
 *                 description: "true 時每一季都強制重新向 MOPS 抓取並覆蓋，即使資料庫已有資料，預設 false"
 *                 default: false
 *     responses:
 *       200:
 *         description: 回補流程執行完畢（個別季度失敗不影響整體回應），回傳每季的執行結果與成功/失敗筆數統計。
 *       400:
 *         description: 請求的參數格式錯誤。
 */
router.post('/income-statements/backfill', backfillIncomeStatements);

export default router;