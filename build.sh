#!/bin/bash
set -e

echo "Building server..."
cd server
rm -rf node_modules package-lock.json
npm install --no-package-lock
npm run build
cd ..

echo "Building app..."
cd app
rm -rf node_modules
npm ci --legacy-peer-deps
npm run build
cd ..

echo "Build complete!"
