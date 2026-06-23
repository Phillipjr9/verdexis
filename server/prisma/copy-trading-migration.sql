-- Copy Trading Feature Migration
-- Review this file before running: npm run db:migrate

-- Step 1: Create TraderProfile table
CREATE TABLE IF NOT EXISTS "TraderProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL UNIQUE,
    "displayName" TEXT NOT NULL,
    "bio" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "allowCopying" BOOLEAN NOT NULL DEFAULT false,
    "minCopyAmount" REAL NOT NULL DEFAULT 100,
    "maxCopiers" INTEGER NOT NULL DEFAULT 100,
    "performanceFee" REAL NOT NULL DEFAULT 0,
    "totalPnl" REAL NOT NULL DEFAULT 0,
    "totalPnlPercent" REAL NOT NULL DEFAULT 0,
    "roi30d" REAL NOT NULL DEFAULT 0,
    "roi90d" REAL NOT NULL DEFAULT 0,
    "roisAllTime" REAL NOT NULL DEFAULT 0,
    "winRate" REAL NOT NULL DEFAULT 0,
    "totalTrades" INTEGER NOT NULL DEFAULT 0,
    "totalCopiers" INTEGER NOT NULL DEFAULT 0,
    "activeCopiers" INTEGER NOT NULL DEFAULT 0,
    "rank" INTEGER,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "lastTradeAt" TIMESTAMP,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

-- Step 2: Create CopyRelationship table
CREATE TABLE IF NOT EXISTS "CopyRelationship" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "followerId" TEXT NOT NULL,
    "traderId" TEXT NOT NULL,
    "allocationUsd" REAL NOT NULL,
    "allocationPercent" REAL NOT NULL DEFAULT 100,
    "status" TEXT NOT NULL DEFAULT 'active',
    "totalCopied" REAL NOT NULL DEFAULT 0,
    "totalPnl" REAL NOT NULL DEFAULT 0,
    "totalPnlPercent" REAL NOT NULL DEFAULT 0,
    "copyCount" INTEGER NOT NULL DEFAULT 0,
    "pausedAt" TIMESTAMP,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    FOREIGN KEY ("followerId") REFERENCES "User"("id") ON DELETE CASCADE,
    FOREIGN KEY ("traderId") REFERENCES "User"("id") ON DELETE CASCADE,
    UNIQUE("followerId", "traderId")
);

-- Step 3: Create CopyTrade table
CREATE TABLE IF NOT EXISTS "CopyTrade" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "followerId" TEXT NOT NULL,
    "traderId" TEXT NOT NULL,
    "traderTradeId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "price" REAL NOT NULL,
    "total" REAL NOT NULL,
    "pnl" REAL NOT NULL DEFAULT 0,
    "pnlPercent" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'executed',
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("followerId") REFERENCES "User"("id") ON DELETE CASCADE
);

-- Step 4: Create indexes for performance
CREATE INDEX IF NOT EXISTS "TraderProfile_isPublic_allowCopying_idx" ON "TraderProfile"("isPublic", "allowCopying");
CREATE INDEX IF NOT EXISTS "TraderProfile_roi30d_idx" ON "TraderProfile"("roi30d");
CREATE INDEX IF NOT EXISTS "TraderProfile_rank_idx" ON "TraderProfile"("rank");

CREATE INDEX IF NOT EXISTS "CopyRelationship_followerId_status_idx" ON "CopyRelationship"("followerId", "status");
CREATE INDEX IF NOT EXISTS "CopyRelationship_traderId_status_idx" ON "CopyRelationship"("traderId", "status");

CREATE INDEX IF NOT EXISTS "CopyTrade_followerId_createdAt_idx" ON "CopyTrade"("followerId", "createdAt");
CREATE INDEX IF NOT EXISTS "CopyTrade_traderId_createdAt_idx" ON "CopyTrade"("traderId", "createdAt");
CREATE INDEX IF NOT EXISTS "CopyTrade_traderTradeId_idx" ON "CopyTrade"("traderTradeId");

-- Verification queries (run after migration)
-- SELECT COUNT(*) FROM "TraderProfile";
-- SELECT COUNT(*) FROM "CopyRelationship";
-- SELECT COUNT(*) FROM "CopyTrade";
