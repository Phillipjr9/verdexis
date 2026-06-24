-- CreateTable AdminHierarchy
CREATE TABLE "AdminHierarchy" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "parentAdminId" TEXT,
    "canCreateAdmins" BOOLEAN NOT NULL DEFAULT false,
    "canManageUsers" BOOLEAN NOT NULL DEFAULT true,
    "canManageDeposits" BOOLEAN NOT NULL DEFAULT true,
    "canManageTransactions" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminHierarchy_pkey" PRIMARY KEY ("id")
);

-- CreateTable UserAdminAssignment
CREATE TABLE "UserAdminAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "assignedBy" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserAdminAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable AdminBankAccount
CREATE TABLE "AdminBankAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "routingNumber" TEXT,
    "accountHolder" TEXT NOT NULL,
    "accountType" TEXT NOT NULL DEFAULT 'checking',
    "country" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminBankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable AdminWalletDetail
CREATE TABLE "AdminWalletDetail" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "chainId" TEXT,
    "walletType" TEXT NOT NULL DEFAULT 'ethereum',
    "label" TEXT,
    "notes" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminWalletDetail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminHierarchy_adminId_key" ON "AdminHierarchy"("adminId");

-- CreateIndex
CREATE INDEX "AdminHierarchy_adminId_idx" ON "AdminHierarchy"("adminId");

-- CreateIndex
CREATE INDEX "AdminHierarchy_parentAdminId_idx" ON "AdminHierarchy"("parentAdminId");

-- CreateIndex
CREATE UNIQUE INDEX "UserAdminAssignment_userId_adminId_key" ON "UserAdminAssignment"("userId", "adminId");

-- CreateIndex
CREATE INDEX "UserAdminAssignment_userId_idx" ON "UserAdminAssignment"("userId");

-- CreateIndex
CREATE INDEX "UserAdminAssignment_adminId_idx" ON "UserAdminAssignment"("adminId");

-- CreateIndex
CREATE INDEX "AdminBankAccount_userId_idx" ON "AdminBankAccount"("userId");

-- CreateIndex
CREATE INDEX "AdminBankAccount_adminId_idx" ON "AdminBankAccount"("adminId");

-- CreateIndex
CREATE INDEX "AdminWalletDetail_userId_idx" ON "AdminWalletDetail"("userId");

-- CreateIndex
CREATE INDEX "AdminWalletDetail_adminId_idx" ON "AdminWalletDetail"("adminId");

-- AddForeignKey
ALTER TABLE "AdminHierarchy" ADD CONSTRAINT "AdminHierarchy_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminHierarchy" ADD CONSTRAINT "AdminHierarchy_parentAdminId_fkey" FOREIGN KEY ("parentAdminId") REFERENCES "AdminHierarchy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAdminAssignment" ADD CONSTRAINT "UserAdminAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAdminAssignment" ADD CONSTRAINT "UserAdminAssignment_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
