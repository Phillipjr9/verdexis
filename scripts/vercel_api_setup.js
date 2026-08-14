const fs = require('fs');
const path = require('path');
const fetch = global.fetch || require('node-fetch');

async function main() {
  const token = process.env.VERCEL_TOKEN;
  if (!token) {
    console.error('VERCEL_TOKEN not set');
    process.exit(2);
  }
  const teamId = 'dianas-projects-32e424a3';
  const projectName = 'verdexis';

  const repoRoot = path.resolve(__dirname, '..');
  const files = [path.join(repoRoot, 'server', '.env'), path.join(repoRoot, 'app', '.env.local')];
  const envs = [];
  for (const f of files) {
    if (!fs.existsSync(f)) continue;
    const lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);
    for (let line of lines) {
      if (!line) continue;
      line = line.trim();
      if (!line || line.startsWith('#')) continue;
      const idx = line.indexOf('=');
      if (idx === -1) continue;
      const key = line.slice(0, idx);
      let val = line.slice(idx + 1);
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      envs.push({ key, val });
    }
  }

  console.log('Creating project', projectName);
  // Try to create the project. If it already exists, fetch its id.
  let projectId = null;
  const createRes = await fetch(`https://api.vercel.com/v9/projects?teamId=${teamId}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: projectName })
  });
  if (createRes.ok) {
    const createJson = await createRes.json();
    projectId = createJson.id || createJson.uid || createJson.project?.id;
    console.log('Project created:', projectId || JSON.stringify(createJson));
  } else {
    const text = await createRes.text();
    console.warn('Create project failed, attempting to find existing project:', createRes.status, text);
    // List team projects and find by name
    const listRes = await fetch(`https://api.vercel.com/v9/projects?teamId=${teamId}&limit=100`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!listRes.ok) {
      console.error('Failed to list projects:', listRes.status, await listRes.text());
      process.exit(3);
    }
    const listJson = await listRes.json();
    const found = (listJson.projects || []).find(p => p.name === projectName);
    if (!found) {
      console.error('Project not found in team projects');
      process.exit(4);
    }
    projectId = found.id || found.uid || found.project?.id;
    console.log('Using existing project:', projectId);
  }

  for (const e of envs) {
    try {
      const body = { key: e.key, value: e.val, target: ['production'], type: 'encrypted' };
      const r = await fetch(`https://api.vercel.com/v9/projects/${projectId}/env`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!r.ok) {
        const t = await r.text();
        console.error('Failed to add env', e.key, r.status, t);
      } else {
        console.log('Added env', e.key);
      }
    } catch (err) {
      console.error('Error adding env', e.key, err.message);
    }
  }

  console.log('Done setting envs. Project id:', projectId);
}

main().catch(err => { console.error(err); process.exit(1); });
