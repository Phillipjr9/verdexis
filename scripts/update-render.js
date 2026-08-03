#!/usr/bin/env node
const https = require('https');
const { URL } = require('url');
const API_HOST = 'api.render.com';
const SERVICE_ID = 'srv-d8prertqb8s738gd810';
const key = process.env.RENDER_API_KEY;
if (!key) {
  console.error('RENDER_API_KEY environment variable is not set');
  process.exit(1);
}
function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: API_HOST,
      path,
      method,
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };
    const req = https.request(opts, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        let json = data;
        try { json = JSON.parse(data || '{}'); } catch (e) { /* keep raw */ }
        resolve({ status: res.statusCode, body: json });
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}
(async function main(){
  try {
    console.log('\n1) PATCH service dockerCommand...');
    const patchBody = {
      serviceDetails: {
        envSpecificDetails: {
          dockerCommand: 'sh -lc "node scripts/resolve-failed-migration.js || true && npx prisma migrate deploy --schema server/prisma/schema.prisma && node dist/index.js"',
          dockerContext: '.',
          dockerfilePath: './Dockerfile'
        }
      }
    };
    const patch = await request('PATCH', `/v1/services/${SERVICE_ID}`, patchBody);
    console.log('PATCH status:', patch.status);
    console.log(JSON.stringify(patch.body, null, 2));

    console.log('\n2) Create manual deploy...');
    const post = await request('POST', `/v1/services/${SERVICE_ID}/deploys`, { type: 'manual' });
    console.log('DEPLOY status:', post.status);
    console.log(JSON.stringify(post.body, null, 2));

    console.log('\n3) Get service details...');
    const get = await request('GET', `/v1/services/${SERVICE_ID}`);
    console.log('GET status:', get.status);
    console.log(JSON.stringify(get.body, null, 2));

    console.log('\nDone. If any step returned an error, paste the printed JSON here.');
  } catch (err) {
    console.error('Request error:', err);
    process.exit(2);
  }
})();
