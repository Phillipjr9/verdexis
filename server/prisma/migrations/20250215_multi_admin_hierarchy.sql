-- CreateTable AdminHierarchy
CREATE TABLE "AdminHierarchy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "adminId" TEXT NOT NULL,
    "parentAdminId" TEXT,
    "canCreateAdmins" BOOLEAN NOT NULL DEFAULT false,
    "canManageUsers" BOOLEAN NOT NULL DEFAULT false,
    "canManageDeposits" BOOLEAN NOT NULL DEFAULT true,
    "canManageTransactions" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    CONSTRAINT "AdminHierarchy_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User" ("id") ON DELETE CASCADE,
    CONSTRAINT "AdminHierarchy_parentAdminId_fkey" FOREIGN KEY ("parentAdminId") REFERENCES "User" ("id") ON DELETE SET NULL,
    CONSTRAINT "AdminHierarchy_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User" ("id") ON DELETE CASCADE
);

-- CreateTable UserAdminAssignment
CREATE TABLE "UserAdminAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "assignedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedBy" TEXT NOT NULL,
    CONSTRAINT "UserAdminAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE,
    CONSTRAINT "UserAdminAssignment_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User" ("id") ON DELETE CASCADE,
    CONSTRAINT "UserAdminAssignment_assignedBy_fkey" FOREIGN KEY ("assignedBy") REFERENCES "User" ("id") ON DELETE CASCADE
);

-- CreateTable AdminBankAccount (for admin to add bank details for users)
CREATE TABLE "AdminBankAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "routingNumber" TEXT,
    "accountHolder" TEXT NOT NULL,
    "accountType" TEXT DEFAULT 'checking',
    "country" TEXT,
    "verifiedAt" DATETIME,
    "verifiedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AdminBankAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE,
    CONSTRAINT "AdminBankAccount_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User" ("id") ON DELETE CASCADE,
    CONSTRAINT "AdminBankAccount_verifiedBy_fkey" FOREIGN KEY ("verifiedBy") REFERENCES "User" ("id") ON DELETE SET NULL
);

-- CreateTable AdminWalletDetail (for admin to add/manage wallet details for users)
CREATE TABLE "AdminWalletDetail" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "chainId" TEXT,
    "walletType" TEXT DEFAULT 'ethereum',
    "label" TEXT,
    "notes" TEXT,
    "verifiedAt" DATETIME,
    "verifiedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AdminWalletDetail_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE,
    CONSTRAINT "AdminWalletDetail_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User" ("id") ON DELETE CASCADE,
    CONSTRAINT "AdminWalletDetail_verifiedBy_fkey" FOREIGN KEY ("verifiedBy") REFERENCES "User" ("id") ON DELETE SET NULL
);

-- CreateIndex AdminHierarchy_adminId_idx
CREATE UNIQUE INDEX "AdminHierarchy_adminId_key" ON "AdminHierarchy"("adminId");

-- CreateIndex AdminHierarchy_parentAdminId_idx
CREATE INDEX "AdminHierarchy_parentAdminId_idx" ON "AdminHierarchy"("parentAdminId");

-- CreateIndex UserAdminAssignment_userId_adminId_idx
CREATE UNIQUE INDEX "UserAdminAssignment_userId_adminId_key" ON "UserAdminAssignment"("userId", "adminId");

-- CreateIndex UserAdminAssignment_adminId_idx
CREATE INDEX "UserAdminAssignment_adminId_idx" ON "UserAdminAssignment"("adminId");

-- CreateIndex AdminBankAccount_userId_idx
CREATE INDEX "AdminBankAccount_userId_idx" ON "AdminBankAccount"("userId");

-- CreateIndex AdminBankAccount_adminId_idx
CREATE INDEX "AdminBankAccount_adminId_idx" ON "AdminBankAccount"("adminId");

-- CreateIndex AdminWalletDetail_userId_idx
CREATE INDEX "AdminWalletDetail_userId_idx" ON "AdminWalletDetail"("userId");

-- CreateIndex AdminWalletDetail_adminId_idx
CREATE INDEX "AdminWalletDetail_adminId_idx" ON "AdminWalletDetail"("adminId");
