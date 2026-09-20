const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://neondb_owner:placeholder@ep-lingering-waterfall-avld32az-pooler.c-11.us-east-1.aws.neon.tech/neondb?sslmode=require',
  connectionTimeoutMillis: 5000,
});

client.connect((err) => {
  if (err) {
    console.error('❌ Connection failed:', err.message);
    process.exit(1);
  }
  console.log('✅ Connection successful');
  client.query('SELECT version()', (err, res) => {
    if (err) console.error('Query error:', err);
    else console.log('PostgreSQL version:', res.rows[0].version);
    client.end();
  });
});
