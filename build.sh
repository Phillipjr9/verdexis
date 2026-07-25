#!/bin/bash
set -e

echo "Building server..."
cd server
npm install --no-package-lock
npm run build
cd ..

echo "Building app..."
cd app
npm install --legacy-peer-deps
npm run build
cd ..

echo "Build complete!"
