const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function readEnvFile(p) {
  if (!fs.existsSync(p)) return [];
  const out = [];
  const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/);
  for (let line of lines) {
    if (!line) continue;
    line = line.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.slice(0, idx);
    let val = line.slice(idx + 1);
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    out.push({ key, val });
  }
  return out;
}

const repoRoot = path.resolve(__dirname, '..');
const files = [path.join(repoRoot, 'server', '.env'), path.join(repoRoot, 'app', '.env.local')];
const envs = [];
for (const f of files) {
  envs.push(...readEnvFile(f));
}

if (!process.env.VERCEL_TOKEN) {
  console.error('VERCEL_TOKEN not set');
  process.exit(2);
}

const args = ['--prod', '--yes', '--force', '--name', 'verdexis', '--scope', 'dianas-projects-32e424a3'];
for (const e of envs) {
  args.push('--env', `${e.key}=${e.val}`);
}

console.log('Running: npx vercel', args.join(' '));
const res = spawnSync('npx', ['vercel', ...args], { stdio: 'inherit', env: { ...process.env, VERCEL_TOKEN: process.env.VERCEL_TOKEN } });
process.exit(res.status);
