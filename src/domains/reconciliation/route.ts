import { Router } from 'ultimate-express';
import { reconcileQuarter } from './controller';

const router = Router();

/**
 * @swagger
 * /api/reconciliation/quarter:
 *   post:
 *     summary: 用現金流量表交叉驗證單一公司單一季度的資產負債表與損益表
 *     description: >
 *       只讀取資料庫既有資料（不會向 MOPS 發出請求），依三個勾稽關係逐一比對：
 *       (1) 本季資產負債表「現金及約當現金」應等於本季現金流量表「資產負債表帳列之現金及約當現金」
 *       （不是拿現金流量表的「期末現金及約當現金餘額」比——金融業該欄位依 IAS 7 定義涵蓋存放央行、
 *       附賣回票券等項目，範圍比資產負債表寬，兩者不相等是正常現象，非資料錯誤）；
 *       (2) 本季現金流量表「期初現金及約當現金餘額」應等於去年Q4現金流量表「期末現金及約當現金餘額」
 *       （兩邊都在現金流量表內比對、同一套口徑，不受產業別影響）；
 *       (3) 損益表 Q1~本季累加「稅前淨利」應等於現金流量表本季累計「本期稅前淨利」
 *       （現金流量表金額是累計數，損益表存的是單季數字，因此需要加總對齊）。
 *       若相關季度的資料庫紀錄不存在，該項檢查會標記為 skipped 並說明缺少哪些資料，不會誤判為 fail。
 *       若多項檢查同時 fail，回應的 interpretation 會提醒現金流量表本身也可能才是錯誤來源。
 *     tags:
 *       - Reconciliation
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - year
 *               - season
 *             properties:
 *               companyId:
 *                 type: string
 *                 description: "公司代號，預設 2330"
 *                 default: "2330"
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
 *               toleranceNtd:
 *                 type: integer
 *                 description: "容許誤差（新台幣元），避免財報本身四捨五入造成誤判，預設 5000"
 *                 default: 5000
 *     responses:
 *       200:
 *         description: 檢查完成。回傳 overallStatus（pass/fail/inconclusive）與每項檢查的詳細結果。
 *       400:
 *         description: 請求的參數格式錯誤。
 */
router.post('/reconciliation/quarter', reconcileQuarter);

export default router;
