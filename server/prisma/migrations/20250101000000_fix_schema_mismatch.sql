-- Fix all schema mismatches between Prisma schema and database
-- This migration adds all missing columns and tables

-- 1. Add missing columns to User table
ALTER TABLE "User" 
ADD COLUMN IF NOT EXISTS "kycFirstName" TEXT,
ADD COLUMN IF NOT EXISTS "kycLastName" TEXT,
ADD COLUMN IF NOT EXISTS "kycDob" TEXT,
ADD COLUMN IF NOT EXISTS "kycCountry" TEXT,
ADD COLUMN IF NOT EXISTS "kycSsnEncrypted" TEXT,
ADD COLUMN IF NOT EXISTS "kycAddressStreet" TEXT,
ADD COLUMN IF NOT EXISTS "kycAddressCity" TEXT,
ADD COLUMN IF NOT EXISTS "kycAddressZip" TEXT,
ADD COLUMN IF NOT EXISTS "kycIdDocType" TEXT,
ADD COLUMN IF NOT EXISTS "kycDocumentsJson" TEXT,
ADD COLUMN IF NOT EXISTS "kycTier" TEXT DEFAULT 'UNVERIFIED',
ADD COLUMN IF NOT EXISTS "kycTierUpdatedAt" TIMESTAMP(3);

-- 2. Create BalanceHistory table
CREATE TABLE IF NOT EXISTS "BalanceHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL,
    "available" DOUBLE PRECISION NOT NULL,
    "totalWorthUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "snapshotAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BalanceHistory_pkey" PRIMARY KEY ("id")
);

-- 3. Create Otp table
CREATE TABLE IF NOT EXISTS "Otp" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "hashedOtp" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Otp_pkey" PRIMARY KEY ("id")
);

-- 4. Create Copy Trading tables
CREATE TABLE IF NOT EXISTS "TraderProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "bio" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "allowCopying" BOOLEAN NOT NULL DEFAULT false,
    "minCopyAmount" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "maxCopiers" INTEGER NOT NULL DEFAULT 100,
    "performanceFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalPnl" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalPnlPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "roi30d" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "roi90d" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "roisAllTime" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "winRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalTrades" INTEGER NOT NULL DEFAULT 0,
    "totalCopiers" INTEGER NOT NULL DEFAULT 0,
    "activeCopiers" INTEGER NOT NULL DEFAULT 0,
    "rank" INTEGER,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "lastTradeAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TraderProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CopyRelationship" (
    "id" TEXT NOT NULL,
    "followerId" TEXT NOT NULL,
    "traderId" TEXT NOT NULL,
    "allocationUsd" DOUBLE PRECISION NOT NULL,
    "allocationPercent" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "status" TEXT NOT NULL DEFAULT 'active',
    "totalCopied" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalPnl" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalPnlPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "copyCount" INTEGER NOT NULL DEFAULT 0,
    "pausedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CopyRelationship_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CopyTrade" (
    "id" TEXT NOT NULL,
    "followerId" TEXT NOT NULL,
    "traderId" TEXT NOT NULL,
    "traderTradeId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "pnl" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pnlPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'executed',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CopyTrade_pkey" PRIMARY KEY ("id")
);

-- 5. Create indexes
CREATE INDEX IF NOT EXISTS "BalanceHistory_userId_currency_snapshotAt_idx" ON "BalanceHistory"("userId", "currency", "snapshotAt");
CREATE INDEX IF NOT EXISTS "BalanceHistory_userId_snapshotAt_idx" ON "BalanceHistory"("userId", "snapshotAt");
CREATE INDEX IF NOT EXISTS "Otp_userId_idx" ON "Otp"("userId");
CREATE INDEX IF NOT EXISTS "Otp_purpose_idx" ON "Otp"("purpose");
CREATE INDEX IF NOT EXISTS "Otp_expiresAt_idx" ON "Otp"("expiresAt");
CREATE INDEX IF NOT EXISTS "Otp_userId_purpose_used_idx" ON "Otp"("userId", "purpose", "used");
CREATE UNIQUE INDEX IF NOT EXISTS "TraderProfile_userId_key" ON "TraderProfile"("userId");
CREATE INDEX IF NOT EXISTS "TraderProfile_isPublic_allowCopying_idx" ON "TraderProfile"("isPublic", "allowCopying");
CREATE INDEX IF NOT EXISTS "TraderProfile_roi30d_idx" ON "TraderProfile"("roi30d");
CREATE INDEX IF NOT EXISTS "TraderProfile_rank_idx" ON "TraderProfile"("rank");
CREATE UNIQUE INDEX IF NOT EXISTS "CopyRelationship_followerId_traderId_key" ON "CopyRelationship"("followerId", "traderId");
CREATE INDEX IF NOT EXISTS "CopyRelationship_followerId_status_idx" ON "CopyRelationship"("followerId", "status");
CREATE INDEX IF NOT EXISTS "CopyRelationship_traderId_status_idx" ON "CopyRelationship"("traderId", "status");
CREATE INDEX IF NOT EXISTS "CopyTrade_followerId_createdAt_idx" ON "CopyTrade"("followerId", "createdAt");
CREATE INDEX IF NOT EXISTS "CopyTrade_traderId_createdAt_idx" ON "CopyTrade"("traderId", "createdAt");
CREATE INDEX IF NOT EXISTS "CopyTrade_traderTradeId_idx" ON "CopyTrade"("traderTradeId");

-- 6. Add foreign key constraints
ALTER TABLE "BalanceHistory" ADD CONSTRAINT "BalanceHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Otp" ADD CONSTRAINT "Otp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TraderProfile" ADD CONSTRAINT "TraderProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CopyRelationship" ADD CONSTRAINT "CopyRelationship_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CopyRelationship" ADD CONSTRAINT "CopyRelationship_traderId_fkey" FOREIGN KEY ("traderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CopyTrade" ADD CONSTRAINT "CopyTrade_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 7. Update existing PriceAlert indexes from phase3 migration
CREATE INDEX IF NOT EXISTS "PriceAlert_alertType_active_idx" ON "PriceAlert"("alertType", "active");