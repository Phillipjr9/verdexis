-- CreateTable WithdrawalRequest
CREATE TABLE "WithdrawalRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "walletLinkId" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "asset" TEXT NOT NULL,
    "fee" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "txHash" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedReason" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WithdrawalRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE,
    CONSTRAINT "WithdrawalRequest_walletLinkId_fkey" FOREIGN KEY ("walletLinkId") REFERENCES "WalletLink" ("id") ON DELETE CASCADE
);

-- CreateTable InvestmentPortfolio
CREATE TABLE "InvestmentPortfolio" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL UNIQUE,
    "totalInvested" REAL NOT NULL DEFAULT 0,
    "currentValue" REAL NOT NULL DEFAULT 0,
    "totalGainLoss" REAL NOT NULL DEFAULT 0,
    "totalGainLossPercent" REAL NOT NULL DEFAULT 0,
    "targetAllocation" TEXT,
    "rebalanceFrequency" TEXT NOT NULL DEFAULT 'monthly',
    "lastRebalancedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InvestmentPortfolio_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE
);

-- CreateTable StakingPosition
CREATE TABLE "StakingPosition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "apy" REAL NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unstakedAt" TIMESTAMP(3),
    "totalYieldEarned" REAL NOT NULL DEFAULT 0,
    "yieldFrequency" TEXT NOT NULL DEFAULT 'daily',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StakingPosition_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE
);

-- CreateTable YieldReward
CREATE TABLE "YieldReward" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "stakingPositionId" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "asset" TEXT NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "YieldReward_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE,
    CONSTRAINT "YieldReward_stakingPositionId_fkey" FOREIGN KEY ("stakingPositionId") REFERENCES "StakingPosition" ("id") ON DELETE CASCADE
);

-- CreateTable WalletVerification
CREATE TABLE "WalletVerification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "walletLinkId" TEXT NOT NULL UNIQUE,
    "verificationChallenge" TEXT NOT NULL,
    "signature" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WalletVerification_walletLinkId_fkey" FOREIGN KEY ("walletLinkId") REFERENCES "WalletLink" ("id") ON DELETE CASCADE
);

-- CreateTable DepositLimit
CREATE TABLE "DepositLimit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "asset" TEXT,
    "dailyLimit" REAL,
    "monthlyLimit" REAL,
    "perTransactionLimit" REAL,
    "dailyUsed" REAL NOT NULL DEFAULT 0,
    "monthlyUsed" REAL NOT NULL DEFAULT 0,
    "dailyResetAt" TIMESTAMP(3),
    "monthlyResetAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DepositLimit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE
);

-- CreateTable WithdrawalLimit
CREATE TABLE "WithdrawalLimit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "asset" TEXT,
    "dailyLimit" REAL,
    "monthlyLimit" REAL,
    "perTransactionLimit" REAL,
    "dailyUsed" REAL NOT NULL DEFAULT 0,
    "monthlyUsed" REAL NOT NULL DEFAULT 0,
    "dailyResetAt" TIMESTAMP(3),
    "monthlyResetAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WithdrawalLimit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE
);

-- CreateTable TransactionExport
CREATE TABLE "TransactionExport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'csv',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "fileUrl" TEXT,
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TransactionExport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "WithdrawalRequest_txHash_key" ON "WithdrawalRequest"("txHash");

-- CreateIndex
CREATE INDEX "WithdrawalRequest_userId_status_idx" ON "WithdrawalRequest"("userId", "status");

-- CreateIndex
CREATE INDEX "WithdrawalRequest_status_createdAt_idx" ON "WithdrawalRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "WithdrawalRequest_walletLinkId_idx" ON "WithdrawalRequest"("walletLinkId");

-- CreateIndex
CREATE INDEX "InvestmentPortfolio_userId_idx" ON "InvestmentPortfolio"("userId");

-- CreateIndex
CREATE INDEX "StakingPosition_userId_unstakedAt_idx" ON "StakingPosition"("userId", "unstakedAt");

-- CreateIndex
CREATE INDEX "StakingPosition_userId_asset_idx" ON "StakingPosition"("userId", "asset");

-- CreateIndex
CREATE INDEX "YieldReward_userId_earnedAt_idx" ON "YieldReward"("userId", "earnedAt");

-- CreateIndex
CREATE INDEX "YieldReward_stakingPositionId_idx" ON "YieldReward"("stakingPositionId");

-- CreateIndex
CREATE INDEX "WalletVerification_walletLinkId_idx" ON "WalletVerification"("walletLinkId");

-- CreateIndex
CREATE UNIQUE INDEX "DepositLimit_userId_asset_key" ON "DepositLimit"("userId", "asset");

-- CreateIndex
CREATE INDEX "DepositLimit_userId_idx" ON "DepositLimit"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WithdrawalLimit_userId_asset_key" ON "WithdrawalLimit"("userId", "asset");

-- CreateIndex
CREATE INDEX "WithdrawalLimit_userId_idx" ON "WithdrawalLimit"("userId");

-- CreateIndex
CREATE INDEX "TransactionExport_userId_status_idx" ON "TransactionExport"("userId", "status");

-- CreateIndex
CREATE INDEX "TransactionExport_expiresAt_idx" ON "TransactionExport"("expiresAt");
