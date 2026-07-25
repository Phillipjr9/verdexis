#!/usr/bin/env node
const { execSync } = require('child_process');
const path = require('path');

console.log('Building app...');
process.chdir(path.join(__dirname, 'app'));

try {
  console.log('Installing dependencies...');
  execSync('npm install', { stdio: 'inherit' });
  
  console.log('Running vite build...');
  execSync('npm run build', { stdio: 'inherit' });
  
  console.log('Build complete!');
} catch (error) {
  console.error('Build failed:', error.message);
  process.exit(1);
}
