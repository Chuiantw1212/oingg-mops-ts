-- CreateTable
CREATE TABLE "quarterly_income_statement" (
    "symbol" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "quarter" INTEGER NOT NULL,
    "data_type" TEXT NOT NULL,
    "subsidiary_company_id" TEXT NOT NULL DEFAULT '',
    "report_date" DATE NOT NULL,
    "operating_revenue" BIGINT,
    "gross_profit" BIGINT,
    "operating_income" BIGINT,
    "profit_before_tax" BIGINT,
    "net_income" BIGINT,
    "eps" DECIMAL(10,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quarterly_income_statement_pkey" PRIMARY KEY ("symbol","year","quarter","data_type","subsidiary_company_id")
);

