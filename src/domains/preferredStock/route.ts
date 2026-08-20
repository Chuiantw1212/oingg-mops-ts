import { Router } from 'ultimate-express';
import { ingestPreferredStockRightsHandler } from './controller';

const router = Router();

/**
 * @swagger
 * /api/ingest/preferred-stock-rights:
 *   post:
 *     summary: 向 MOPS 抓取單一公司底下所有特別股的權利基本資料並存入資料庫
 *     description: >
 *       透過 MOPS t47sb12（公司國內有價證券基本資料查詢 - 特別股權利基本資料查詢）這個非官方 HTML 端點抓取。
 *       流程：Step1 查該公司底下所有特別股清單（每檔特別股股票代號如 "2887A" 可能有多個版本/序號 seriesNo，
 *       條款修改時會產生新版本，見回應裡的 previousSeriesNo 欄位——不是同時存在的多檔不同證券）；
 *       Step2 對每一筆版本個別查詢權利明細（發行日期、股息、累積/參加分派、表決權、轉換權、收回條件等）。
 *
 *       每一筆版本（依 symbol + preferredStockCode + seriesNo 為主鍵）已存在且未帶 force 就跳過，不呼叫 MOPS；
 *       真的呼叫 MOPS 時，Step1 與每次 Step2 之間用隨機浮動間隔（見 politeDelay）。
 *
 *       **注意**：回應裡的「股息」欄位（dividendRate）原始資料沒有標示單位，實測值如 5.750，可能是「每股金額」
 *       也可能是「百分比」，尚未二次確認，使用時請自行核對，不要假設單位。
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
 *                 description: "母公司股票代號（不是特別股股票代號）"
 *                 example: "2887"
 *               typek:
 *                 type: string
 *                 enum: ["sii", "otc"]
 *                 description: "市場別，sii=上市, otc=上櫃，預設 sii"
 *                 default: "sii"
 *               force:
 *                 type: boolean
 *                 description: "true 時即使資料庫已有該筆版本也強制重新向 MOPS 抓取並覆蓋，預設 false"
 *                 default: false
 *     responses:
 *       200:
 *         description: 抓取流程執行完畢（個別版本失敗不影響整體回應），回傳每筆版本的執行結果與成功/跳過/失敗筆數統計。
 *       400:
 *         description: 請求的參數格式錯誤。
 *       404:
 *         description: MOPS 查無此公司代號。
 *       502:
 *         description: 抓取清單（Step1）失敗，例如 MOPS 回應格式非預期。
 */
router.post('/preferred-stock-rights', ingestPreferredStockRightsHandler);

export default router;
