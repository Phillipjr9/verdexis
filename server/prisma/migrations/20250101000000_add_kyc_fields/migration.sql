-- Add KYC fields to User table
ALTER TABLE "User" ADD COLUMN "kycFirstName" TEXT,
ADD COLUMN "kycLastName" TEXT,
ADD COLUMN "kycDob" TEXT,
ADD COLUMN "kycCountry" TEXT,
ADD COLUMN "kycSsnEncrypted" TEXT,
ADD COLUMN "kycAddressStreet" TEXT,
ADD COLUMN "kycAddressCity" TEXT,
ADD COLUMN "kycAddressZip" TEXT,
ADD COLUMN "kycIdDocType" TEXT,
ADD COLUMN "kycDocumentsJson" TEXT;
