-- Phase 3: Smart Alert Enhancement
-- Add new columns to PriceAlert for multiple alert types (safe for existing data)

-- Add alert type column (price, technical, percentage, portfolio)
ALTER TABLE "PriceAlert" ADD COLUMN IF NOT EXISTS "alertType" VARCHAR(20) DEFAULT 'price';

-- Add technical indicator column (RSI, MACD, etc.)
ALTER TABLE "PriceAlert" ADD COLUMN IF NOT EXISTS "technicalIndicator" VARCHAR(20);

-- Add percentage change column (for percentage-based alerts)
ALTER TABLE "PriceAlert" ADD COLUMN IF NOT EXISTS "percentageChange" DOUBLE PRECISION;

-- Add time window column (hours for percentage alerts)
ALTER TABLE "PriceAlert" ADD COLUMN IF NOT EXISTS "timeWindow" INTEGER DEFAULT 24;

-- Add portfolio target column (for portfolio value alerts)
ALTER TABLE "PriceAlert" ADD COLUMN IF NOT EXISTS "portfolioTarget" DOUBLE PRECISION;

-- Create index for faster alert lookups
CREATE INDEX IF NOT EXISTS "PriceAlert_alertType_active_idx" ON "PriceAlert"("alertType", "active");
