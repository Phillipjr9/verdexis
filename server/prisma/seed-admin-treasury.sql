-- Seed admin treasury with $1 trillion
-- Run this SQL directly on your PostgreSQL database

-- First, find the admin user ID (replace admin@verdexis.com with your actual admin email)
-- UPDATE WalletBalance SET balance = 1000000000000, available = 1000000000000 
-- WHERE userId = (SELECT id FROM "User" WHERE email = 'admin@verdexis.com') AND currency = 'USD';

-- If no wallet exists, insert it:
INSERT INTO "WalletBalance" ("id", "userId", "currency", "symbol", "balance", "available", "createdAt", "updatedAt")
SELECT 
  gen_random_uuid(),
  u.id,
  'USD',
  '$',
  1000000000000,
  1000000000000,
  NOW(),
  NOW()
FROM "User" u
WHERE u.email = 'admin@verdexis.com'
ON CONFLICT ("userId", "currency") 
DO UPDATE SET 
  balance = 1000000000000,
  available = 1000000000000,
  "updatedAt" = NOW();

-- Verify the update
SELECT u.email, w.currency, w.balance, w.available 
FROM "WalletBalance" w
JOIN "User" u ON u.id = w."userId"
WHERE u.email = 'admin@verdexis.com' AND w.currency = 'USD';
