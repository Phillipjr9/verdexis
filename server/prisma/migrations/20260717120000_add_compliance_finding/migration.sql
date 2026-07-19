-- Create ComplianceFinding table
CREATE TABLE "ComplianceFinding" (
    "id" TEXT NOT NULL,
    "txId" TEXT NOT NULL,
    "userId" TEXT,
    "suspect" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "reviewed" BOOLEAN NOT NULL DEFAULT false,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "actioned" TEXT,
    "actionedAt" TIMESTAMP(3),
    "actionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComplianceFinding_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ComplianceFinding_txId_key" ON "ComplianceFinding" ("txId");
CREATE INDEX "ComplianceFinding_suspect_index" ON "ComplianceFinding" ("suspect");
CREATE INDEX "ComplianceFinding_userId_index" ON "ComplianceFinding" ("userId");
CREATE INDEX "ComplianceFinding_createdAt_index" ON "ComplianceFinding" ("createdAt");

ALTER TABLE "ComplianceFinding"
    ADD CONSTRAINT "ComplianceFinding_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL;
