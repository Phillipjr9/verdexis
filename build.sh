#!/bin/bash
set -ex

echo "Current directory: $(pwd)"
echo "Node version: $(node --version)"
echo "NPM version: $(npm --version)"

echo "Building app first..."
cd app
echo "App directory: $(pwd)"
echo "Listing files:"
ls -la
echo "Installing app dependencies with npm install..."
npm install
echo "Checking vite installation:"
npm list vite || true
echo "Running vite build..."
npm run build
cd ..

echo "Building server..."
cd server
echo "Server directory: $(pwd)"
npm install --no-package-lock
npm run build
cd ..

echo "Build complete!"
