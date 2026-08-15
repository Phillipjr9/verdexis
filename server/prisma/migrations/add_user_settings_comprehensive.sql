-- Add comprehensive user settings tables

-- Session Management
CREATE TABLE IF NOT EXISTS "UserSession" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "deviceName" TEXT,
  "deviceType" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "location" TEXT,
  "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE
);
CREATE INDEX "UserSession_userId_idx" ON "UserSession"("userId");
CREATE INDEX "UserSession_isActive_idx" ON "UserSession"("isActive");

-- Notification Preferences
CREATE TABLE IF NOT EXISTS "NotificationPreference" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL UNIQUE,
  "emailFrequency" TEXT NOT NULL DEFAULT 'daily',
  "emailPriceAlerts" BOOLEAN NOT NULL DEFAULT true,
  "emailTradeConfirmations" BOOLEAN NOT NULL DEFAULT true,
  "emailSecurityAlerts" BOOLEAN NOT NULL DEFAULT true,
  "emailSystemUpdates" BOOLEAN NOT NULL DEFAULT false,
  "emailMarketingNews" BOOLEAN NOT NULL DEFAULT false,
  "smsPriceAlerts" BOOLEAN NOT NULL DEFAULT false,
  "smsSecurityAlerts" BOOLEAN NOT NULL DEFAULT true,
  "pushNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
  "quietHoursStart" TEXT,
  "quietHoursEnd" TEXT,
  "quietHoursEnabled" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE
);

-- Privacy Settings
CREATE TABLE IF NOT EXISTS "PrivacySetting" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL UNIQUE,
  "profileVisibility" TEXT NOT NULL DEFAULT 'private',
  "showPortfolioValue" BOOLEAN NOT NULL DEFAULT false,
  "showTradeHistory" BOOLEAN NOT NULL DEFAULT false,
  "allowMessagesFromStrangers" BOOLEAN NOT NULL DEFAULT false,
  "dataCollectionOptOut" BOOLEAN NOT NULL DEFAULT false,
  "analyticsOptOut" BOOLEAN NOT NULL DEFAULT false,
  "thirdPartyDataSharing" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PrivacySetting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE
);

-- Wallet Preferences
CREATE TABLE IF NOT EXISTS "WalletPreference" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL UNIQUE,
  "defaultWithdrawalAddress" TEXT,
  "defaultNetwork" TEXT,
  "autoCompoundStaking" BOOLEAN NOT NULL DEFAULT true,
  "stakingFrequency" TEXT NOT NULL DEFAULT 'daily',
  "gasOptimization" TEXT NOT NULL DEFAULT 'standard',
  "showSmallBalances" BOOLEAN NOT NULL DEFAULT true,
  "minimumBalanceThreshold" REAL NOT NULL DEFAULT 0.01,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WalletPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE
);

-- Accessibility Settings
CREATE TABLE IF NOT EXISTS "AccessibilitySetting" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL UNIQUE,
  "fontSize" TEXT NOT NULL DEFAULT 'medium',
  "highContrast" BOOLEAN NOT NULL DEFAULT false,
  "screenReaderOptimized" BOOLEAN NOT NULL DEFAULT false,
  "keyboardNavigationEnabled" BOOLEAN NOT NULL DEFAULT false,
  "reducedMotion" BOOLEAN NOT NULL DEFAULT false,
  "colorBlindMode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AccessibilitySetting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE
);

-- API Keys (already exists but ensure it's present)
-- Linked Social Accounts
CREATE TABLE IF NOT EXISTS "LinkedAccount" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerUserId" TEXT NOT NULL,
  "email" TEXT,
  "displayName" TEXT,
  "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LinkedAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE,
  CONSTRAINT "LinkedAccount_provider_providerUserId_key" UNIQUE("provider", "providerUserId")
);
CREATE INDEX "LinkedAccount_userId_idx" ON "LinkedAccount"("userId");

-- Account Recovery Options
CREATE TABLE IF NOT EXISTS "AccountRecoveryOption" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "verified" BOOLEAN NOT NULL DEFAULT false,
  "verifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AccountRecoveryOption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE
);
CREATE INDEX "AccountRecoveryOption_userId_idx" ON "AccountRecoveryOption"("userId");

-- Login History (enhanced)
CREATE TABLE IF NOT EXISTS "LoginHistory" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "location" TEXT,
  "country" TEXT,
  "city" TEXT,
  "latitude" REAL,
  "longitude" REAL,
  "deviceFingerprint" TEXT,
  "success" BOOLEAN NOT NULL DEFAULT true,
  "failureReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LoginHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE
);
CREATE INDEX "LoginHistory_userId_createdAt_idx" ON "LoginHistory"("userId", "createdAt");

-- IP Whitelist/Blacklist
CREATE TABLE IF NOT EXISTS "IpRestriction" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "ipAddress" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "description" TEXT,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IpRestriction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE
);
CREATE INDEX "IpRestriction_userId_idx" ON "IpRestriction"("userId");

-- Activity Log
CREATE TABLE IF NOT EXISTS "ActivityLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "details" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE
);
CREATE INDEX "ActivityLog_userId_createdAt_idx" ON "ActivityLog"("userId", "createdAt");
CREATE INDEX "ActivityLog_category_idx" ON "ActivityLog"("category");

-- Data Export Request
CREATE TABLE IF NOT EXISTS "DataExportRequest" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "format" TEXT NOT NULL DEFAULT 'json',
  "status" TEXT NOT NULL DEFAULT 'pending',
  "fileUrl" TEXT,
  "expiresAt" TIMESTAMP(3),
  "downloadCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "DataExportRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE
);
CREATE INDEX "DataExportRequest_userId_status_idx" ON "DataExportRequest"("userId", "status");

-- Cookie Preferences
CREATE TABLE IF NOT EXISTS "CookiePreference" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL UNIQUE,
  "essential" BOOLEAN NOT NULL DEFAULT true,
  "analytics" BOOLEAN NOT NULL DEFAULT false,
  "marketing" BOOLEAN NOT NULL DEFAULT false,
  "preferences" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CookiePreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE
);

-- Risk Tolerance
CREATE TABLE IF NOT EXISTS "RiskTolerance" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL UNIQUE,
  "level" TEXT NOT NULL DEFAULT 'moderate',
  "maxDrawdown" REAL NOT NULL DEFAULT 20,
  "maxSingleTradePercent" REAL NOT NULL DEFAULT 5,
  "maxLeverageMultiplier" REAL NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RiskTolerance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE
);

-- Recovery Codes (for 2FA backup)
CREATE TABLE IF NOT EXISTS "TwoFactorRecoveryCode" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "used" BOOLEAN NOT NULL DEFAULT false,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TwoFactorRecoveryCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE
);
CREATE INDEX "TwoFactorRecoveryCode_userId_idx" ON "TwoFactorRecoveryCode"("userId");
