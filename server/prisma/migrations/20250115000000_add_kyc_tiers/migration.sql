-- Add KYC tier tracking
ALTER TABLE "User" ADD COLUMN "kycTier" VARCHAR(20) NOT NULL DEFAULT 'UNVERIFIED';
ALTER TABLE "User" ADD COLUMN "kycTierUpdatedAt" TIMESTAMP(3);

-- Add indices for KYC tier queries
CREATE INDEX "idx_user_kycTier" ON "User"("kycTier");
CREATE INDEX "idx_user_kycStatus_kycTier" ON "User"("kycStatus", "kycTier");
