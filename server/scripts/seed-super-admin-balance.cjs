const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
let databaseUrl = '';

if (fs.existsSync(envPath)) {
  const env = fs.readFileSync(envPath, 'utf8');
  const match = env.match(/DATABASE_URL=(.+)/);
  if (match) databaseUrl = match[1].trim().replace(/^"|"$/g, '');
}

if (!databaseUrl) {
  databaseUrl = 'postgresql://verdexis_user:B47rt1u8pT3n0Ow5GYyluUZznQhBIrAS@dpg-d7uetvpj2pic73bq89c0-a/verdexis';
}

const url = new URL(databaseUrl);
const host = url.hostname;
const port = url.port || '5432';
const db = url.pathname.replace(/^\//, '');
const user = url.username;
const password = url.password;

const sql = `
WITH upserted AS (
  INSERT INTO "User" (id, email, name, "passwordHash", role, "emailVerified", "emailVerifiedAt", "createdAt", "updatedAt")
  VALUES ('admin-super', 'admin@verdexis.com', 'Admin', '$2a$12$y5i6dfgqA0.4wL3Ylf2W2efUQqowc1L9yL7MJfefQaD1m5zJvQZXm', 'admin', true, now(), now(), now())
  ON CONFLICT (email) DO UPDATE SET
    name = EXCLUDED.name,
    role = 'admin',
    "emailVerified" = true,
    "emailVerifiedAt" = COALESCE("User"."emailVerifiedAt", now()),
    "updatedAt" = now()
  RETURNING id
)
INSERT INTO "WalletBalance" (id, "userId", currency, symbol, balance, available, "updatedAt")
SELECT gen_random_uuid()::text, u.id, 'USD', 'USD', 1500000000000, 1500000000000, now()
FROM upserted u
ON CONFLICT ("userId", currency) DO UPDATE SET
  balance = EXCLUDED.balance,
  available = EXCLUDED.available,
  "updatedAt" = now();

INSERT INTO "Transaction" (id, "userId", kind, currency, amount, status, reference, "subType", "createdAt")
SELECT gen_random_uuid()::text, u.id, 'deposit', 'USD', 1500000000000, 'completed', 'super-admin-initial-balance', 'manual_bank_wire', now()
FROM (SELECT id FROM "User" WHERE email = 'admin@verdexis.com') u
ON CONFLICT DO NOTHING;
`;

const cmd = `PGPASSWORD='${password}' psql -h '${host}' -p '${port}' -U '${user}' -d '${db}' -c "${sql.replace(/"/g, '\\"')}"`;
console.log('Running database seed...');
try {
  execSync(cmd, { stdio: 'inherit' });
  console.log('Super admin balance seeded successfully.');
} catch (error) {
  console.error('Failed to seed database:', error.message);
  process.exit(1);
}
