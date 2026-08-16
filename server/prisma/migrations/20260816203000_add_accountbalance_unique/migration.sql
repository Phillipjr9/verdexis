-- Add unique index for AccountBalance(userId, asset) to support upsert ON CONFLICT
-- This migration creates the unique index only if it does not already exist.
CREATE UNIQUE INDEX IF NOT EXISTS "AccountBalance_userId_asset_key" ON "AccountBalance"("userId", "asset");
