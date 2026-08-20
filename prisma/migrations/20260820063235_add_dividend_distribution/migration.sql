-- CreateTable
CREATE TABLE "dividend_distribution" (
    "symbol" TEXT NOT NULL,
    "rights_record_date" DATE NOT NULL,
    "company_name" TEXT,
    "dividend_period" TEXT,
    "stock_dividend_from_earnings" DECIMAL(12,8),
    "stock_dividend_from_capital_reserve" DECIMAL(12,8),
    "ex_rights_date" DATE,
    "cash_dividend_from_earnings" DECIMAL(12,8),
    "cash_dividend_from_capital_reserve" DECIMAL(12,8),
    "preferred_stock_cash_dividend" DECIMAL(12,8),
    "ex_dividend_date" DATE,
    "cash_dividend_payment_date" DATE,
    "capital_increase_shares" BIGINT,
    "capital_increase_subscription_ratio" DECIMAL(8,4),
    "capital_increase_subscription_price" DECIMAL(10,4),
    "total_participating_shares" BIGINT,
    "announcement_date" DATE,
    "announcement_time" TEXT,
    "par_value" DECIMAL(10,4),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dividend_distribution_pkey" PRIMARY KEY ("symbol","rights_record_date")
);
