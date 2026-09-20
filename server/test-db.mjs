import { Client } from 'pg';

const client = new Client({
  connectionString: 'postgresql://neondb_owner:[REDACTED]@ep-lingering-waterfall-avld32az-pooler.c-11.us-east-1.aws.neon.tech/neondb?sslmode=require',
  connectionTimeoutMillis: 5000,
});

try {
  await client.connect();
  console.log('✅ Connection successful');
  const res = await client.query('SELECT version()');
  console.log('PostgreSQL version:', res.rows[0].version);
  await client.end();
} catch (err) {
  console.error('❌ Connection failed:', err.message);
  process.exit(1);
}
