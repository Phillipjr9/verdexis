-- Add User.address column if missing
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "address" TEXT;
