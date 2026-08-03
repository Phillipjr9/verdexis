#!/usr/bin/env node
const https = require('https');

const API_HOST = 'api.render.com';
const SERVICE_ID = 'srv-d8prrertqb8s738gd810';
const API_KEY = process.env.RENDER_API_KEY;

if (!API_KEY) {
  console.error('Error: RENDER_API_KEY environment variable not set');
  process.exit(1);
}

function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: API_HOST,
      path,
      method,
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  try {
    console.log('Clearing cached dockerCommand from Render service...\n');

    // Clear dockerCommand - set to empty string to let Dockerfile ENTRYPOINT run
    const updateBody = {
      serviceDetails: {
        envSpecificDetails: {
          dockerCommand: ''
        }
      }
    };

    console.log(`PATCH /v1/services/${SERVICE_ID}`);
    const result = await makeRequest('PATCH', `/v1/services/${SERVICE_ID}`, updateBody);

    if (result.status === 200) {
      console.log('✓ Successfully cleared dockerCommand\n');
      console.log('Triggering manual redeploy...\n');

      // Trigger manual deploy
      const deployResult = await makeRequest('POST', `/v1/services/${SERVICE_ID}/deploys`, {});
      if (deployResult.status === 201 || deployResult.status === 200) {
        console.log('✓ Redeploy triggered successfully\n');
      } else {
        console.log('⚠ Deploy trigger status:', deployResult.status);
        console.log('Response:', deployResult.data);
      }
    } else {
      console.error('✗ Failed to update service');
      console.error('Status:', result.status);
      console.error('Response:', result.data);
      process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
