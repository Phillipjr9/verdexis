#!/usr/bin/env node
/**
 * Vercel build: frontend only.
 * The API runs on Render (https://verdexis-fjqz.onrender.com).
 * Building the full Express server on Vercel fails (missing deps / Prisma / workers)
 * and is unnecessary — api/* proxies to Render.
 */
const { execSync } = require('child_process');
const path = require('path');

const rootDir = __dirname;
const appDir = path.join(rootDir, 'app');

console.log('Building Verdexis frontend for Vercel...');

try {
  console.log('Installing app dependencies...');
  execSync('npm install --include=dev', { cwd: appDir, stdio: 'inherit' });

  console.log('Running vite build...');
  execSync('npm run build', { cwd: appDir, stdio: 'inherit' });

  console.log('Frontend build complete (API proxied to Render).');
} catch (error) {
  console.error('Build failed:', error.message);
  process.exit(1);
}
