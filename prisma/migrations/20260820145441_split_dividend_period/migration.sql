-- 把 dividend_distribution.dividend_period（例如「113年第3季」）拆成 fiscal_year / fiscal_quarter 兩欄。
-- 先加新欄位、用既有資料回填，再刪舊欄位，避免直接刪欄造成資料遺失。
-- 只認得到「NNN年第M季」這個目前唯一實測過的格式；不符合這個格式的舊資料，fiscal_year/fiscal_quarter 會是 NULL
-- （跟 parser.ts 的 parseFiscalPeriod() 對「格式不符」的處理方式一致：留 null，不猜）。

ALTER TABLE "dividend_distribution" ADD COLUMN "fiscal_year" INTEGER;
ALTER TABLE "dividend_distribution" ADD COLUMN "fiscal_quarter" INTEGER;

UPDATE "dividend_distribution"
SET
  "fiscal_year" = substring("dividend_period" from '^(\d+)年第\d季$')::integer,
  "fiscal_quarter" = substring("dividend_period" from '^\d+年第(\d)季$')::integer
WHERE "dividend_period" ~ '^\d+年第\d季$';

ALTER TABLE "dividend_distribution" DROP COLUMN "dividend_period";
