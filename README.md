# oingg-mops-ts

從證交所 MOPS（公開資訊觀測站）抓取台灣上市櫃公司的季度財務報告（損益表、資產負債表、現金流量表），解析後存進 PostgreSQL，並提供三表勾稽（articulation check）驗證資料一致性。

## 技術棧

- TypeScript + `tsx`（開發期直接跑 `.ts`，不用先編譯）
- `ultimate-express`（Express 相容 API）
- Prisma + PostgreSQL（Neon serverless）
- Zod（request 驗證）
- Swagger（`swagger-jsdoc` 從路由檔的 JSDoc 註解自動產生文件）

## 快速開始

```bash
pnpm install          # postinstall 會自動跑 prisma generate
pnpm dev              # tsx watch src/index.ts，預設監聽 :8080
```

`.env` 需要：`DATABASE_URL`（帶 `-pooler`，給 runtime 用）、`DIRECT_URL`（不帶 `-pooler`，給 migration 用）。

啟動後可到 `http://localhost:8080/api-docs` 看 Swagger UI 手動測試。

## 架構

`src/domains/` 下每個資料夾是一個 domain，除了 `system`（根路由）跟 `quarterlyReport`/`reconciliation`（純組合邏輯，不直接打 MOPS）之外，其餘五個（`incomeStatement`、`balanceSheet`、`cashFlow`、`capitalStock`、`dividend`）都遵循同一套檔案結構：

| 檔案 | 職責 |
|---|---|
| `types.ts` | 該 domain 的 request payload 型別 |
| `service.ts` | 打 MOPS API，回傳原始 JSON |
| `parser.ts` | 把 MOPS 的 `reportList`（`[科目名稱, 金額, %, ...]` 陣列）解析成結構化欄位 |
| `ingest.ts` | 組合 service + parser + Prisma upsert，含 skip/force 邏輯 |
| `controller.ts` | Express handler，含單筆 + 20 季 backfill 兩種 |
| `route.ts` | 路由註冊 + Swagger JSDoc |

`src/shared/` 放跨 domain 共用邏輯：`mopsReportParsing.ts`（科目名稱比對/正規化）、`rocQuarter.ts`（民國年季度日期計算）、`serializeBigInt.ts`。

## API 一覽

全部掛在 `/api/ingest` 下（`reconciliation` 除外，掛在 `/api`，因為它只讀資料庫不打 MOPS）：

| Method + Path | 說明 |
|---|---|
| `POST /api/ingest/income-statements` | 抓單一公司單一季度損益表 |
| `POST /api/ingest/income-statements/backfill` | 回補單一公司過去 N 年（預設 5 年=20 季）損益表 |
| `POST /api/ingest/balance-sheets` (`/backfill`) | 資產負債表，同上模式 |
| `POST /api/ingest/cash-flow-statements` (`/backfill`) | 現金流量表，同上模式 |
| `POST /api/ingest/quarterly-report` | 單一公司單一季度，三表一次抓（依序 5 秒間隔） |
| `POST /api/ingest/quarterly-report/backfill` | 單一公司過去 N 年，三表 x 20 季一次回補 |
| `POST /api/ingest/capital-stock-history` | 單一公司近 5 年股本變更歷史（MOPS t05st05，非官方 HTML 端點，一次抓全部，無單筆/backfill 區分） |
| `POST /api/ingest/dividend-distributions` (`/backfill`) | 單一公司股利分派公告（MOPS t108sb27，非官方 HTML 端點，按民國年查詢，backfill 每年都真的呼叫 MOPS） |
| `POST /api/reconciliation/quarter` | 三表勾稽：用現金流量表交叉驗證資產負債表跟損益表 |

所有單筆/backfill request body 都吃 `{companyId, year?, season?, dataType?, subsidiaryCompanyId?, force?}`；`dataType`: `'1'`=個別, `'2'`=合併（預設）。

## 關鍵設計決策（未來 session 接手前務必看）

### 1. 科目名稱比對是「候選名稱清單」而非固定欄位

MOPS 對不同產業（一般業/金控銀行保險業/證券期貨業/保險業）回傳的科目名稱完全不同（例如「營業收入合計」vs「淨收益」vs「收益合計」vs「保險收入」都對應同一個 `operatingRevenue` 概念）。`parser.ts` 裡每個欄位用 `FieldSpec.labels` 陣列存所有已知變體，依序嘗試比對。**這份清單是逐步累積出來的，靠實際貼真實 MOPS 回應撞出新變體才補上**，目前涵蓋了台積電、台新新光金、兆豐銀行、富邦金、聯邦銀（金控銀行）、中信證券、福勝證券（證券期貨業）、三商壽、新產（保險業）等真實案例。之後遇到新產業/新公司格式對不上，就是要貼真實回應樣本，分析對不到的欄位、補 fallback 名稱，同時做回歸測試確保沒破壞既有公司的解析。

某些欄位（`operatingCost`、`grossProfit`、`operatingIncome`、`currentAssets`/`nonCurrentAssets` 等）對金融業結構上不存在，故意設成非 `required`，避免產生假警訊。

### 2. 科目名稱模糊比對防呆（`mopsReportParsing.ts` 的 `findRowValue`）

部分銀行（兆豐銀行、聯邦銀）的損益表會用不帶括號的裸科目名稱「母公司業主」，在「本期淨利歸屬於：」跟「本期綜合損益歸屬於：」兩個不同區塊各出現一次、代表不同數字。目前的比對邏輯是純文字比對、不看區塊標題，沒有能力分辨兩者。防呆機制：同一名稱若比對到多筆**數值不同**的資料列，直接回傳 `null`，不賭第一筆。**這是故意的行為，不是 bug**——寧可欄位是 `null` 也不要安靜寫入錯誤數字。

### 3. `cashEndingBalance` vs `cashPerBalanceSheet`（現金流量表）

金控銀行業的現金流量表「期末現金及約當現金餘額」（`cashEndingBalance`）依 IAS 7 定義涵蓋存放央行、附賣回票券等項目，範圍比資產負債表上的「現金及約當現金」寬，兩者**不會相等**（一般業、證券商、保險業則通常相等，因為沒有這些科目）。`cashPerBalanceSheet` 欄位（對應 MOPS 報表裡的「資產負債表帳列之現金及約當現金」）才是跟資產負債表口徑一致的數字，**三表勾稽務必用這個欄位去比對資產負債表，不要用 `cashEndingBalance`**。台積電等公司在此欄位加入 schema 之前抓的舊資料，這欄位會是 `null`（該筆資料抓取時這個欄位還不存在，非資料錯誤，可用 `force=true` 重新抓補上）。

### 4. 季度日期規則（`rocQuarter.ts`）

`getLatestAvailableQuarter()` 依法定公告截止日判斷「今天為止最新一筆應該已公告」的季度：Q1 5/15、Q2 8/14、Q3 11/14、Q4 次年 3/31。**這是「一般上市、上櫃公司」的規則，不是全部公司都適用**：

- 金融保險業及大型企業：Q2 截止日是 8/31（不是 8/14），因為要多等子公司彙整
- 興櫃/未上市公開發行公司：Q1、Q3 免公告申報（根本沒有這份報告）；年報可延至 4/30
- 資本額 ≥ 100 億的上市櫃公司：年報提早至 3/15

**目前故意沒有依公司分類套用不同規則**（2025-08-19 討論後決定維持現狀）——因為系統遇到「查無資料」本來就會優雅跳過、記錄、繼續，不會產生錯誤資料，只是在上述例外窗口內偶爾會多打一次注定落空的請求（多等 5 秒、log 多一條無害的 NO DATA）。如果之後要優化，需要先解決「怎麼知道一家公司屬於哪個分類」（資本額、是否為金融業）這個資料來源問題，可以考慮從 MOPS 回應的科目名稱型態去推斷，或另外維護清單。

### 5. `dataType`（個別 vs 合併）不會自動 fallback

合併報表（`dataType=2`，預設）比個別報表（`dataType=1`）通常晚幾天公告（尤其金融業）。若合併查無資料但個別已經有，**系統不會自動切換**——因為兩者數字口徑不同，混著存會誤導判讀。呼叫端要自己決定是否要重試 `dataType=1`。

### 6. 加總 vs 取第一個（`FieldSpec.sumAllMatches`）

部分金控（富邦金）現金流量表/資產負債表會**同時**有「發行公司債」跟「發行金融債券」兩個獨立科目（不是同義詞，是不同東西）。這種情況要用 `sumAllMatches: true` 讓該欄位加總所有比對到的候選科目，而不是只取第一個。預設 `false`（候選名稱視為互斥別名）。

### 7. Backfill 的節流間隔：隨機浮動，不是固定毫秒數

所有 backfill / 多請求端點（含 `capitalStock`）都遵守「只有真的呼叫 MOPS（非 skip）才需要間隔」——資料庫已有資料而跳過的請求不佔用等待時間。間隔本身用 `src/shared/politeDelay.ts` 提供的隨機浮動秒數（預設 5～10 秒區間），**不是固定毫秒數**：爬蟲社群實測指出，固定週期的請求容易被防火牆/WAF 依規律性識別為機器人流量，就算間隔長度本身合理也一樣（2026-08-20 依使用者提供的社群實測經驗，把原本所有 domain 各自的固定 `REQUEST_INTERVAL_MS` 都改成呼叫共用的 `politeDelay()`）。`quarterlyReport` 的三表合一 backfill 曾經有個 bug：季度跟季度之間的邊界沒有套用間隔（只有同一季內三表之間有），已修正為攤平成一整條步驟序列統一處理，不分季度邊界。

### 8. `capitalStock` domain 打的是非官方 HTML 端點，不是 `t164sbXX` JSON API

其他四個 ingest domain 都打 MOPS 正式的 `t164sbXX` JSON API；`capitalStock`（股本變更歷史）打的是 `t05st05`，一個沒有官方文件、回傳 HTML 片段而非 JSON 的內部 servlet 端點（規格來源：使用者提供的爬取規格文件，2026-08-19/20 依此規格實作）。因此這個 domain 跟其他幾個結構上不同：

- **兩段式請求**：Step1 查「近 5 年變更事件清單」+ 正確市場別 `TYPEK`，Step2 對每一筆事件個別查明細。`service.ts` 用手動維護的單一 cookie 字串（`jcsession`）模擬瀏覽器 session，同一次 ingest 呼叫內的 Step1/Step2 共用同一個 client 實例。
- **`parser.ts` 用 `cheerio` 解析 HTML**（新增的依賴），不是既有 domain 用的 `reportList`（`[科目名稱, 金額, ...]`）陣列解析。標籤/數值儲存格用「文件順序中緊接在後」的方式配對，不用固定 index，避免表格版面微調就整批解析失敗。
- **主鍵用 Step1 提供的西元年月**（`effectiveYear`/`effectiveMonth`），不用 Step2 明細裡的民國年月文字（`licenseChangeYear`/`licenseChangeMonth`，只作顯示用）——規格文件明確建議西元年月更穩定，不要依賴民國年文字解析。
- **沒有單筆 vs backfill 的區分**：這個 domain 本質上就是「歷史序列」，一次呼叫就抓近 5 年全部，用 `force` 控制是否覆蓋已存在的個別事件。
- **節流間隔跟其他 domain 共用 `politeDelay()`（隨機 5～10 秒）**，不是自己另外訂更短的固定間隔——這個端點被 IP 封鎖過，風險比其他 domain 打的正式 JSON API 更高，沒有理由用更短的間隔（規格文件本身建議的 ≥1 秒/次只是最低下限）。
- **`paidInCapital`（實收股本金額）是每一筆的期末餘額，不是增量**；但 `sourceCashIncrease`/`sourceRetainedEarningsTransfer` 等來源欄位，除了每家公司最早一筆是累計數之外，第二筆起都是「該次異動的增量」——下游計算（例如加權平均股數）如果要用到來源欄位，務必注意這個累計 vs 增量的區別。
- **標籤比對必須先去除所有空白，不能只 trim 頭尾**：真實 MOPS 回應（2026-08-20 用台積電 2330 的 Step2 明細驗證）證實部分標籤會用半形空白把每個中文字隔開做視覺對齊（例如「每股面額」實際是「每   股   面   額」、「變更公司執照時間」是「變 更 公 司 執 照 時 間」），還有的混雜 tab。`parser.ts` 的 `normalizeLabel()` 統一去除所有空白（含 `&nbsp;`）跟括號內容再比較，兩邊（map 的 key 跟查詢用的目標 label）都套用同一套正規化。Step1（清單）尚未貼真實回應驗證過，僅驗證了 Step2（明細）。

### 9. `dividend` domain：單次請求回傳整年，沒有「跳過整次呼叫」的概念

`dividend`（股利分派公告）打 MOPS t108sb27，另一個非官方 HTML 端點，但跟 `capitalStock` 的兩段式不同，這個是單次 POST 就回傳整個查詢民國年的資料（0～多筆）：

- **`year` 篩選的是「公告/記錄」的民國年，不是股利所屬期間**：查 114 年可能查到「113年第3季」的股利分派公告，因為那筆是 114 年公告/生效的。
- **只解析「適用停止過戶期間規定之公司」表格**（固定 19 欄，照 index 取值，不像 `capitalStock` 需要標籤比對）。回應其實有第二張「不適用...」表格，欄位配置未知（目前看過的樣本裡永遠是空的），若真的遇到有資料的情況，`parser.ts` 會記錄 warning 但不解析寫入——同樣是「寧可警告跳過，不要照第一張表硬套」的判斷。
- **主鍵是 symbol + rightsRecordDate（權利分派基準日）**，不是 symbol + 民國年，因為一次查詢可能回傳同一公司在該年公告的好幾筆不同股利事件。
- **backfill 沒有「整段時間已在資料庫就跳過」邏輯**：因為一次查詢是「整年」，沒辦法只憑資料庫現況判斷某一年是否已經完整、MOPS 會不會突然多一筆更正公告，所以 backfill 每一個民國年都會真的呼叫 MOPS；`force` 只控制「個別事件」（symbol+rightsRecordDate 已存在時）要不要覆寫，不影響「要不要打 MOPS」。
- **已用台積電（2330）114年查詢的真實回應驗證過**解析邏輯（19 欄位、日期格式 `NNN/MM/DD`、`新台幣10.0000元` 面額文字抽取皆與實測樣本核對過）。

### 10. ESM import 不帶 `.js` 副檔名

`tsconfig.json` 用 `moduleResolution: "Bundler"`，執行靠 `tsx`（非原生 Node ESM），`package.json` 也沒有 `"type": "module"`——目前完全沒有「編譯後用純 node 執行」的路徑。因此 relative import 統一不帶 `.js`。**如果之後要改成正式編譯部署（`tsc` 產出 `dist/` 直接用 `node` 跑)，屆時要嘛全部改回 `NodeNext` 解析並補回 `.js`，要嘛換一套打包工具**。

## 已知缺口 / Backlog

- **沒有自動化測試**：`vitest` 已安裝但沒有寫測試。這次開發過程中好幾個真實 bug（全形斜線正規化、Windows glob 反斜線解析、路由前綴重複、跨季 5 秒間隔遺漏）都是靠實測 + 真實 MOPS 回應樣本手動抓到的。建議至少把已經驗證過的真實 MOPS 回應存成 fixture，針對 `parser.ts` 寫單元測試，避免以後改動時舊 bug 復發。
- **沒有身份驗證**：`.env` 有 `TASK_SECRET` 但程式碼完全沒用到，所有 ingest API 目前是開放的。
- **公司產業分類**：見上方「季度日期規則」——目前無法自動判斷公司屬於哪個申報分類，需要時再處理。
- **金控/保險業的資產負債表、現金流量表 parser 覆蓋度仍在累積中**，遇到新公司格式對不上就貼真實回應樣本進來修。
