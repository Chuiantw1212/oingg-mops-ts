-- CreateTable
CREATE TABLE "monthly_cpi" (
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "index_value" DECIMAL(8,4) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "monthly_cpi_pkey" PRIMARY KEY ("year","month")
);
