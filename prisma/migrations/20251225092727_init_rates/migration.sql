-- CreateTable
CREATE TABLE "ExchangeRate" (
    "id" SERIAL NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "pair" TEXT NOT NULL DEFAULT 'USD/PHP',
    "rate" DECIMAL(12,6) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'BSP',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExchangeRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExchangeRate_pair_date_idx" ON "ExchangeRate"("pair", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ExchangeRate_pair_date_key" ON "ExchangeRate"("pair", "date");
