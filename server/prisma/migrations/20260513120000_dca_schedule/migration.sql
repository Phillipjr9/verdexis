-- CreateTable
CREATE TABLE "DcaSchedule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amountUsd" DOUBLE PRECISION NOT NULL,
    "intervalDays" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "totalInvested" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAcquired" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "runs" INTEGER NOT NULL DEFAULT 0,
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3) NOT NULL,
    "lastSkipReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DcaSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DcaSchedule_userId_idx" ON "DcaSchedule"("userId");

-- CreateIndex
CREATE INDEX "DcaSchedule_active_nextRunAt_idx" ON "DcaSchedule"("active", "nextRunAt");

-- AddForeignKey
ALTER TABLE "DcaSchedule" ADD CONSTRAINT "DcaSchedule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
