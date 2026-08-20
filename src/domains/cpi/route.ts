import { Router } from 'ultimate-express';
import { ingestCpi } from './controller';

const router = Router();

/**
 * @swagger
 * /api/ingest/cpi:
 *   post:
 *     summary: 向行政院主計總處（DGBAS）抓取台灣消費者物價總指數（CPI）月資料
 *     description: >
 *       透過 DGBAS 的開放統計資料 SDMX-JSON 端點（指標代碼 A030101015，總指數，月頻率）抓取，
 *       單次請求就回傳 1981-M1 至今整段月資料，不像其他 domain 需要按公司/季度/年份分次請求，
 *       所以沒有單筆/backfill 的區分，也不需要節流間隔。
 *
 *       存的是**原始指數值**（例如 112.35），不是年增率/月增率——換算通膨率是下游計算，不在本服務範圍。
 *
 *       依 year + month 為主鍵；已存在且未帶 force 就跳過，不覆寫。CPI 數字偶爾會被 DGBAS 事後小幅修正
 *       （尤其是近期月份），需要更新時可帶 force=true 全部覆寫。
 *     tags:
 *       - Ingestion
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               force:
 *                 type: boolean
 *                 description: "true 時即使資料庫已有該月資料也強制覆寫，預設 false"
 *                 default: false
 *     responses:
 *       200:
 *         description: 抓取完成，回傳總月數、實際寫入筆數與跳過筆數。
 *       400:
 *         description: 請求的參數格式錯誤。
 *       502:
 *         description: 向 DGBAS 抓取或解析失敗。
 */
router.post('/cpi', ingestCpi);

export default router;
