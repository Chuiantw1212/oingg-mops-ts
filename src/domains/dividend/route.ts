import { Router } from 'ultimate-express';
import { ingestDividendDistributions, backfillDividendDistributions } from './controller';

const router = Router();

/**
 * @swagger
 * /api/ingest/dividend-distributions:
 *   post:
 *     summary: 向 MOPS 抓取單一公司、單一民國年的股利分派公告資料
 *     description: >
 *       透過 MOPS t108sb27（公司股利分派公告資料彙總表）這個非官方 HTML 端點抓取，單次請求即回傳整年資料
 *       （0～多筆），不像其他 ingest domain 是按季度抓。`year` 篩選的是「公告/記錄」落在這個民國年的事件，
 *       不是股利所屬期間的年度（例如查 114 年可能查到「113年第3季」的股利分派公告，因為是 114 年公告/生效的）。
 *
 *       目前只解析回應中「適用停止過戶期間規定之公司」那張表；「不適用...」那張表的欄位配置尚未用真實樣本驗證，
 *       若該表有資料會記錄在 warnings 中但不會解析寫入（避免用未驗證的欄位順序硬套、寫入錯誤數字）。
 *
 *       依 symbol + rightsRecordDate（權利分派基準日）為主鍵；已存在且未帶 force 就跳過該筆，不覆寫。
 *       這個端點沒有「本次查詢是否已在資料庫」可以拿來跳過整次呼叫的概念，所以每次都會真的呼叫 MOPS。
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
 *             properties:
 *               companyId:
 *                 type: string
 *                 description: "公司代號"
 *                 example: "2330"
 *               year:
 *                 type: string
 *                 description: "民國年"
 *                 example: "114"
 *               typek:
 *                 type: string
 *                 enum: ["sii", "otc"]
 *                 description: "市場別，sii=上市, otc=上櫃，預設 sii"
 *                 default: "sii"
 *               force:
 *                 type: boolean
 *                 description: "true 時即使資料庫已有該筆事件也強制覆寫，預設 false"
 *                 default: false
 *     responses:
 *       200:
 *         description: 抓取完成（可能是 0 筆，代表該年沒有股利分派公告，屬正常情況），回傳解析後筆數與 warnings。
 *       400:
 *         description: 請求的參數格式錯誤。
 *       502:
 *         description: 向 MOPS 抓取或解析失敗。
 */
router.post('/dividend-distributions', ingestDividendDistributions);

/**
 * @swagger
 * /api/ingest/dividend-distributions/backfill:
 *   post:
 *     summary: 回補單一公司過去 N 個民國年的股利分派公告
 *     description: >
 *       依序對過去 N 個民國年（預設 5 年）各呼叫一次 /api/ingest/dividend-distributions 的邏輯。
 *       這個端點沒有「季度」概念、也沒有其他 domain 的 backfill 常見的「整段時間已在資料庫就跳過」邏輯——
 *       每一年都會真的呼叫 MOPS（因為無法事先知道某一年是否有新公告或更正），只有個別事件本身
 *       （依 symbol + rightsRecordDate）已存在且未帶 force 才會跳過覆寫。真正呼叫之間用隨機浮動間隔。
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
 *               typek:
 *                 type: string
 *                 enum: ["sii", "otc"]
 *                 description: "市場別，sii=上市, otc=上櫃，預設 sii"
 *                 default: "sii"
 *               years:
 *                 type: integer
 *                 description: "往前回補幾個民國年（含今年），預設 5"
 *                 default: 5
 *               force:
 *                 type: boolean
 *                 description: "true 時每一筆事件都強制覆寫，即使資料庫已有資料，預設 false"
 *                 default: false
 *     responses:
 *       200:
 *         description: 回補流程執行完畢（個別年度失敗不影響整體回應），回傳每年的執行結果與成功/筆數統計。
 *       400:
 *         description: 請求的參數格式錯誤。
 */
router.post('/dividend-distributions/backfill', backfillDividendDistributions);

export default router;
