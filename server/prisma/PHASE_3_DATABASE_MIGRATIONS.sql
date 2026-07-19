-- VERDEXIS Phase 3 Database Migrations
-- These migrations enable all Phase 3 quick-win features
-- Run these BEFORE deploying Phase 3 code

-- ============================================
-- 1. SMART ALERTS ENHANCEMENT
-- ============================================

-- Add new columns to PriceAlert table for multiple alert types
ALTER TABLE "PriceAlert" ADD COLUMN "alertType" VARCHAR(20) DEFAULT 'price';
-- Options: 'price', 'technical', 'percentage', 'portfolio'

ALTER TABLE "PriceAlert" ADD COLUMN "technicalIndicator" VARCHAR(20);
-- Options: 'RSI', 'MACD', 'Bollinger', etc.

ALTER TABLE "PriceAlert" ADD COLUMN "percentageChange" FLOAT;
-- For percentage-based alerts: how much should it change?

ALTER TABLE "PriceAlert" ADD COLUMN "timeWindow" INT DEFAULT 24;
-- For percentage alerts: how many hours to measure change over?

ALTER TABLE "PriceAlert" ADD COLUMN "portfolioTarget" FLOAT;
-- For portfolio alerts: what net worth value triggers this?

-- Create index for faster lookups by alert type
CREATE INDEX "idx_alert_type_active" ON "PriceAlert"("alertType", "active");

-- ============================================
-- 2. TRADE ATTRIBUTION (Optional - for future enhancements)
-- ============================================

-- Add column to track realized P&L per trade
ALTER TABLE "Trade" ADD COLUMN "pnlRealized" FLOAT DEFAULT 0;
-- This will be updated when trade closes

ALTER TABLE "Trade" ADD COLUMN "entryQuality" FLOAT;
-- Score 0-100: how good was the entry point relative to price range?

ALTER TABLE "Trade" ADD COLUMN "exitQuality" FLOAT;
-- Score 0-100: how good was the exit point?

-- Create index for performance attribution queries
CREATE INDEX "idx_trade_symbol_date" ON "Trade"("symbol", "createdAt");

-- ============================================
-- 3. NFT PORTFOLIO ENHANCEMENT
-- ============================================

-- Add NFT-specific columns to WalletBalance
ALTER TABLE "WalletBalance" ADD COLUMN "nftCollection" VARCHAR(100);
-- Store collection name (e.g., "Bored Ape Yacht Club")

ALTER TABLE "WalletBalance" ADD COLUMN "nftFloorPrice" FLOAT;
-- Current floor price in USD

ALTER TABLE "WalletBalance" ADD COLUMN "nftRarityScore" FLOAT;
-- Rarity score from 0-100 (1=rarest, 100=common)

ALTER TABLE "WalletBalance" ADD COLUMN "nftLastUpdate" TIMESTAMP;
-- When was floor price last updated?

-- Create table for NFT metadata (for faster lookups)
CREATE TABLE "NFTMetadata" (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  collection VARCHAR(100) NOT NULL,
  contractAddress VARCHAR(42) NOT NULL,
  chainId VARCHAR(10) NOT NULL,
  floorPrice FLOAT NOT NULL,
  volumeDay FLOAT,
  volume30d FLOAT,
  tradersDay INT,
  lastUpdate TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(chainId, contractAddress),
  INDEX (collection, lastUpdate)
);

-- ============================================
-- 4. AUDIT TRAIL (Optional - for compliance)
-- ============================================

-- Create AuditLog table for detailed compliance tracking
CREATE TABLE IF NOT EXISTS "AuditLog" (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  userId VARCHAR(36) NOT NULL,
  action VARCHAR(50) NOT NULL,
  -- Actions: LOGIN, LOGOUT, TRADE, DEPOSIT, WITHDRAW, TRANSFER, KYC_SUBMITTED, etc.
  
  resource VARCHAR(50),
  -- Resource being acted on: TRADE, DEPOSIT, ACCOUNT, etc.
  
  resourceId VARCHAR(36),
  -- ID of the resource
  
  changes JSONB,
  -- What changed? { field: { old: X, new: Y } }
  
  ipAddress VARCHAR(45),
  -- IPv4 or IPv6
  
  userAgent VARCHAR(255),
  -- Browser/device info
  
  location VARCHAR(100),
  -- Geographic location (optional)
  
  status VARCHAR(20) DEFAULT 'success',
  -- success, failure, pending
  
  errorMessage TEXT,
  -- If status is failure, what went wrong?
  
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (userId) REFERENCES "User"(id) ON DELETE CASCADE,
  INDEX (userId, createdAt),
  INDEX (action, createdAt),
  INDEX (status, createdAt)
);

-- ============================================
-- 5. PERFORMANCE IMPROVEMENTS
-- ============================================

-- Add analytics cache table for faster dashboard loads
CREATE TABLE IF NOT EXISTS "AnalyticsCache" (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  userId VARCHAR(36) NOT NULL,
  cacheKey VARCHAR(100) NOT NULL,
  -- Examples: "daily_pnl", "portfolio_breakdown", "risk_metrics"
  
  cacheValue JSONB NOT NULL,
  -- Cached data
  
  expiresAt TIMESTAMP NOT NULL,
  -- When does this cache expire?
  
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (userId) REFERENCES "User"(id) ON DELETE CASCADE,
  UNIQUE (userId, cacheKey),
  INDEX (expiresAt)
);

-- Auto-cleanup expired cache (PostgreSQL event trigger)
-- Run this periodically: DELETE FROM "AnalyticsCache" WHERE "expiresAt" < NOW();

-- ============================================
-- 6. REAL-TIME PRICE HISTORY (for Smart Alerts)
-- ============================================

-- Store hourly price history for technical indicators
CREATE TABLE IF NOT EXISTS "PriceHistory" (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  symbol VARCHAR(20) NOT NULL,
  price FLOAT NOT NULL,
  high FLOAT,
  low FLOAT,
  volume FLOAT,
  timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  INDEX (symbol, timestamp DESC),
  INDEX (timestamp)
);

-- Set retention policy: keep last 365 days
-- (Optional: use PARTITION BY RANGE (timestamp) for better performance with large data)

-- ============================================
-- 7. MIGRATION DEPLOYMENT
-- ============================================

-- Run these in order:
-- 1. Smart Alerts columns
-- 2. Trade Attribution columns
-- 3. NFT Enhancement columns
-- 4. AuditLog table creation
-- 5. AnalyticsCache table creation
-- 6. PriceHistory table creation

-- Verify migrations:
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name='PriceAlert' 
AND column_name IN ('alertType', 'technicalIndicator', 'percentageChange', 'timeWindow', 'portfolioTarget');

-- Expected output: 5 rows (all new columns present)

-- ============================================
-- 8. MIGRATION ROLLBACK (if needed)
-- ============================================

-- To rollback Phase 3 migrations:

-- ALTER TABLE "PriceAlert" DROP COLUMN "alertType";
-- ALTER TABLE "PriceAlert" DROP COLUMN "technicalIndicator";
-- ALTER TABLE "PriceAlert" DROP COLUMN "percentageChange";
-- ALTER TABLE "PriceAlert" DROP COLUMN "timeWindow";
-- ALTER TABLE "PriceAlert" DROP COLUMN "portfolioTarget";

-- ALTER TABLE "Trade" DROP COLUMN "pnlRealized";
-- ALTER TABLE "Trade" DROP COLUMN "entryQuality";
-- ALTER TABLE "Trade" DROP COLUMN "exitQuality";

-- ALTER TABLE "WalletBalance" DROP COLUMN "nftCollection";
-- ALTER TABLE "WalletBalance" DROP COLUMN "nftFloorPrice";
-- ALTER TABLE "WalletBalance" DROP COLUMN "nftRarityScore";
-- ALTER TABLE "WalletBalance" DROP COLUMN "nftLastUpdate";

-- DROP TABLE IF EXISTS "NFTMetadata";
-- DROP TABLE IF EXISTS "AuditLog";
-- DROP TABLE IF EXISTS "AnalyticsCache";
-- DROP TABLE IF EXISTS "PriceHistory";

-- ============================================
-- 9. DEPLOYMENT INSTRUCTIONS
-- ============================================

-- 1. Create a migration file:
--    server/prisma/migrations/[timestamp]_phase3_features/migration.sql

-- 2. Copy contents of this file into migration.sql

-- 3. Run migration:
--    cd server
--    npx prisma migrate deploy

-- 4. Verify in database:
--    psql $DATABASE_URL -c "\dt" (to list tables)
--    psql $DATABASE_URL -c "\d PriceAlert" (to check PriceAlert columns)

-- 5. Update Prisma schema (server/prisma/schema.prisma):
--    Add fields to @model definitions corresponding to new columns

-- 6. Regenerate Prisma client:
--    cd server
--    npx prisma generate

-- 7. Deploy code changes
-- 8. Monitor for issues: check logs, error tracking, etc.

-- ============================================
-- 10. TESTING QUERIES
-- ============================================

-- Test 1: Verify new alert types can be created
-- INSERT INTO "PriceAlert" (userId, symbol, name, alertType, direction, target, active) 
-- VALUES ('user123', 'BTC', 'RSI Alert', 'technical', 'below', 30, true);

-- Test 2: Check price history is recording
-- SELECT COUNT(*) FROM "PriceHistory" WHERE symbol = 'BTC';

-- Test 3: Verify audit logs are tracking
-- SELECT COUNT(*) FROM "AuditLog" WHERE userId = 'user123' AND action = 'LOGIN';

-- Test 4: Check cache expiration
-- SELECT COUNT(*) FROM "AnalyticsCache" WHERE "expiresAt" < NOW();

-- ============================================
-- 11. PRODUCTION CHECKLIST
-- ============================================

-- Before deploying to production:
-- [ ] Run migrations on staging database first
-- [ ] Verify no errors in logs
-- [ ] Check data integrity: SELECT COUNT(*) FROM each new table
-- [ ] Backup production database
-- [ ] Schedule maintenance window (30 min)
-- [ ] Run migrations on production
-- [ ] Verify migrations completed: SELECT * FROM "_prisma_migrations"
-- [ ] Monitor error tracking for issues
-- [ ] Rollback plan ready (see section 8)
-- [ ] Notify users of new features

-- Estimated migration time: 5-10 minutes
-- Downtime: 0-2 minutes (non-blocking)

-- ============================================
-- END OF MIGRATIONS
-- ============================================
