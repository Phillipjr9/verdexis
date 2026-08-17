-- Migration: add-wallet-minor-units
-- Adds balanceMinorUnits and availableMinorUnits to WalletBalance

ALTER TABLE "WalletBalance"
  ADD COLUMN IF NOT EXISTS "balanceMinorUnits" BIGINT DEFAULT 0 NOT NULL;

ALTER TABLE "WalletBalance"
  ADD COLUMN IF NOT EXISTS "availableMinorUnits" BIGINT DEFAULT 0 NOT NULL;
