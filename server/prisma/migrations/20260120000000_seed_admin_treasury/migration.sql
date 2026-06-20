-- Seed admin treasury with $1 trillion
-- This migration ensures the admin has sufficient funds to transfer to users

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
  AND NOT EXISTS (
    SELECT 1 FROM "WalletBalance" w 
    WHERE w."userId" = u.id AND w.currency = 'USD'
  );

-- Update existing wallet if it exists
UPDATE "WalletBalance"
SET 
  balance = 1000000000000,
  available = 1000000000000,
  "updatedAt" = NOW()
WHERE "userId" = (SELECT id FROM "User" WHERE email = 'admin@verdexis.com')
  AND currency = 'USD';
