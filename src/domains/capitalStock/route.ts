import { Router } from 'ultimate-express';
import { ingestCapitalStockHistoryHandler } from './controller';

const router = Router();

/**
 * @swagger
 * /api/ingest/capital-stock-history:
 *   post:
 *     summary: 向 MOPS 抓取單一公司近 5 年股本變更歷史並存入資料庫
 *     description: >
 *       透過 MOPS t05st05（資本形成經過）這個非官方 HTML 端點抓取。這個頁面來源是每次「變更公司執照」時的
 *       申報存檔，本質是歷史序列（一家公司近 5 年可能有 0～多筆），不是像其他 ingest domain 那樣的單一季度快照，
 *       因此本 API 一次會抓「近 5 年全部」，沒有單筆 vs backfill 的區分。
 *
 *       流程：Step1 查詢該公司近 5 年的變更事件清單（西元年月）與正確市場別 TYPEK；
 *       Step2 對每一筆事件個別查詢股本明細（面額、核定/實收股本股數與金額等）。
 *       每一筆事件（依 symbol + effectiveYear + effectiveMonth 為主鍵）已存在且未帶 force 就跳過，不呼叫 MOPS；
 *       真的呼叫 MOPS 時，Step1 與每次 Step2 之間會間隔隨機浮動的秒數（此端點有 IP 封鎖紀錄，需節流，且比其他 domain 更需要避免規律性請求）。
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
 *               force:
 *                 type: boolean
 *                 description: "true 時即使資料庫已有該筆變更紀錄也強制重新向 MOPS 抓取並覆蓋，預設 false"
 *                 default: false
 *     responses:
 *       200:
 *         description: 抓取流程執行完畢（個別事件失敗不影響整體回應），回傳每筆事件的執行結果與成功/跳過/失敗筆數統計。
 *       400:
 *         description: 請求的參數格式錯誤。
 *       404:
 *         description: MOPS 查無此公司代號。
 *       502:
 *         description: 抓取歷史清單（Step1）失敗，例如 MOPS 回應格式非預期。
 */
router.post('/capital-stock-history', ingestCapitalStockHistoryHandler);

export default router;
