-- Week 2: Database Performance Optimization
-- Adding indices for frequently queried fields

-- User table indices
CREATE INDEX IF NOT EXISTS idx_user_email ON "User"(email);
CREATE INDEX IF NOT EXISTS idx_user_kycStatus ON "User"("kycStatus");
CREATE INDEX IF NOT EXISTS idx_user_kycTier ON "User"("kycTier");
CREATE INDEX IF NOT EXISTS idx_user_suspended ON "User"(suspended);
CREATE INDEX IF NOT EXISTS idx_user_createdAt ON "User"("createdAt" DESC);

-- Transaction table indices (HIGH PRIORITY - frequently queried)
CREATE INDEX IF NOT EXISTS idx_transaction_userId ON "Transaction"("userId");
CREATE INDEX IF NOT EXISTS idx_transaction_createdAt ON "Transaction"("createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_transaction_status ON "Transaction"(status);
CREATE INDEX IF NOT EXISTS idx_transaction_userId_createdAt ON "Transaction"("userId", "createdAt" DESC);

-- Trade table indices (HIGH PRIORITY - frequently queried)
CREATE INDEX IF NOT EXISTS idx_trade_userId ON "Trade"("userId");
CREATE INDEX IF NOT EXISTS idx_trade_symbol ON "Trade"(symbol);
CREATE INDEX IF NOT EXISTS idx_trade_createdAt ON "Trade"("createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_trade_userId_createdAt ON "Trade"("userId", "createdAt" DESC);

-- Order table indices (HIGH PRIORITY - status tracking)
CREATE INDEX IF NOT EXISTS idx_order_userId ON "Order"("userId");
CREATE INDEX IF NOT EXISTS idx_order_symbol ON "Order"(symbol);
CREATE INDEX IF NOT EXISTS idx_order_status ON "Order"(status);
CREATE INDEX IF NOT EXISTS idx_order_userId_status ON "Order"("userId", status);
CREATE INDEX IF NOT EXISTS idx_order_symbol_status ON "Order"(symbol, status);
CREATE INDEX IF NOT EXISTS idx_order_createdAt ON "Order"("createdAt" DESC);

-- Holding table indices
CREATE INDEX IF NOT EXISTS idx_holding_userId ON "Holding"("userId");
CREATE INDEX IF NOT EXISTS idx_holding_userId_symbol ON "Holding"("userId", symbol);

-- WalletBalance table indices
CREATE INDEX IF NOT EXISTS idx_walletBalance_userId ON "WalletBalance"("userId");
CREATE INDEX IF NOT EXISTS idx_walletBalance_userId_currency ON "WalletBalance"("userId", currency);

-- PriceAlert table indices
CREATE INDEX IF NOT EXISTS idx_priceAlert_userId ON "PriceAlert"("userId");
CREATE INDEX IF NOT EXISTS idx_priceAlert_active ON "PriceAlert"(active);
CREATE INDEX IF NOT EXISTS idx_priceAlert_userId_active ON "PriceAlert"("userId", active);

-- Watchlist table indices
CREATE INDEX IF NOT EXISTS idx_watchlist_userId ON "Watchlist"("userId");
CREATE INDEX IF NOT EXISTS idx_watchlist_userId_symbol ON "Watchlist"("userId", symbol);

-- Notification table indices
CREATE INDEX IF NOT EXISTS idx_notification_userId ON "Notification"("userId");
CREATE INDEX IF NOT EXISTS idx_notification_createdAt ON "Notification"("createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_notification_userId_createdAt ON "Notification"("userId", "createdAt" DESC);

-- AdminAudit table indices
CREATE INDEX IF NOT EXISTS idx_adminAudit_actorId ON "AdminAudit"("actorId");
CREATE INDEX IF NOT EXISTS idx_adminAudit_createdAt ON "AdminAudit"("createdAt" DESC);

-- PendingDeposit table indices
CREATE INDEX IF NOT EXISTS idx_pendingDeposit_userId ON "PendingDeposit"("userId");
CREATE INDEX IF NOT EXISTS idx_pendingDeposit_status ON "PendingDeposit"(status);
CREATE INDEX IF NOT EXISTS idx_pendingDeposit_createdAt ON "PendingDeposit"("createdAt" DESC);

-- DcaSchedule table indices
CREATE INDEX IF NOT EXISTS idx_dcaSchedule_active ON "DcaSchedule"(active);
CREATE INDEX IF NOT EXISTS idx_dcaSchedule_nextRunAt ON "DcaSchedule"("nextRunAt");

-- Passkey table indices
CREATE INDEX IF NOT EXISTS idx_passkey_userId ON "Passkey"("userId");
CREATE INDEX IF NOT EXISTS idx_passkey_credentialId ON "Passkey"("credentialId");

-- Referral table indices
CREATE INDEX IF NOT EXISTS idx_referral_referrerId ON "Referral"("referrerId");
CREATE INDEX IF NOT EXISTS idx_referral_refereeEmail ON "Referral"("refereeEmail");
