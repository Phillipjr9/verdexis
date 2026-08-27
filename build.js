#!/usr/bin/env node
const { execSync } = require('child_process');
const path = require('path');

const rootDir = __dirname;
const appDir = path.join(rootDir, 'app');
const serverDir = path.join(rootDir, 'server');

console.log('Building app and API server...');

try {
  console.log('Installing server dependencies...');
  execSync('npm install --include=dev', { cwd: serverDir, stdio: 'inherit' });

  console.log('Building server bundle...');
  execSync('npm run build', { cwd: serverDir, stdio: 'inherit' });

  console.log('Installing app dependencies...');
  execSync('npm install --include=dev', { cwd: appDir, stdio: 'inherit' });

  console.log('Restoring portfolioStore.ts if needed...');
  execSync('node scripts/restore-portfolio-store.mjs', { cwd: rootDir, stdio: 'inherit' });

  console.log('Removing Wallet Quick start card if present...');
  execSync('node scripts/patch-remove-quick-start.mjs', { cwd: rootDir, stdio: 'inherit' });

  console.log('Running vite build...');
  execSync('npm run build', { cwd: appDir, stdio: 'inherit' });

  console.log('Build complete!');
} catch (error) {
  console.error('Build failed:', error.message);
  process.exit(1);
}
