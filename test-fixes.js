#!/usr/bin/env node

/**
 * Verdexis Fixes Verification Test
 * Run this to verify all critical fixes are working
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔍 Verdexis Fixes Verification Test');
console.log('===================================\n');

let allPassed = true;

// Test 1: Check environment files
console.log('📋 Test 1: Environment Configuration');
console.log('-----------------------------------');
try {
  const rootEnv = fs.existsSync(path.join(__dirname, '.env.local'));
  const serverEnv = fs.existsSync(path.join(__dirname, 'server', '.env.local'));
  
  if (rootEnv) {
    console.log('✅ .env.local exists');
  } else {
    console.log('❌ .env.local missing');
    allPassed = false;
  }
  
  if (serverEnv) {
    console.log('✅ server/.env.local exists');
  } else {
    console.log('❌ server/.env.local missing');
    allPassed = false;
  }
} catch (error) {
  console.log('❌ Error checking environment files:', error.message);
  allPassed = false;
}

console.log('');

// Test 2: Check TypeScript configuration
console.log('📋 Test 2: TypeScript Configuration');
console.log('-----------------------------------');
try {
  const tsconfigPath = path.join(__dirname, 'server', 'tsconfig.json');
  const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
  
  if (tsconfig.compilerOptions.strict === true) {
    console.log('✅ TypeScript strict mode enabled');
  } else {
    console.log('❌ TypeScript strict mode disabled');
    allPassed = false;
  }
  
  if (tsconfig.exclude && tsconfig.exclude.length > 0 && tsconfig.exclude[0] !== 'node_modules') {
    console.log('❌ TypeScript excludes critical files');
    allPassed = false;
  } else {
    console.log('✅ TypeScript includes all files');
  }
} catch (error) {
  console.log('❌ Error checking TypeScript config:', error.message);
  allPassed = false;
}

console.log('');

// Test 3: Check critical files were updated
console.log('📋 Test 3: Critical File Updates');
console.log('--------------------------------');
const criticalFiles = [
  { path: 'app/src/components/RequireAuth.tsx', check: 'hasToken || hasAuth' },
  { path: 'server/src/index.ts', check: 'corsOptions' },
  { path: 'app/src/App.tsx', check: 'withLazyErrorBoundary' },
  { path: 'server/prisma/schema.prisma', check: 'connectionLimit' },
];

criticalFiles.forEach(file => {
  try {
    const filePath = path.join(__dirname, file.path);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      if (content.includes(file.check)) {
        console.log(`✅ ${file.path} updated`);
      } else {
        console.log(`❌ ${file.path} missing critical fix`);
        allPassed = false;
      }
    } else {
      console.log(`❌ ${file.path} not found`);
      allPassed = false;
    }
  } catch (error) {
    console.log(`❌ Error checking ${file.path}:`, error.message);
    allPassed = false;
  }
});

console.log('');

// Test 4: Check new files were created
console.log('📋 Test 4: New Files Created');
console.log('----------------------------');
const newFiles = [
  'server/prisma/migrations/20250101000000_fix_schema_mismatch.sql',
  'email_password_reset.html',
  'deploy-fixes.sh',
  'FIXES_SUMMARY.md',
];

newFiles.forEach(file => {
  try {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
      console.log(`✅ ${file} created`);
    } else {
      console.log(`❌ ${file} not created`);
      allPassed = false;
    }
  } catch (error) {
    console.log(`❌ Error checking ${file}:`, error.message);
    allPassed = false;
  }
});

console.log('');

// Test 5: Check package.json dependencies
console.log('📋 Test 5: Dependencies Check');
console.log('----------------------------');
try {
  const appPackage = JSON.parse(fs.readFileSync(path.join(__dirname, 'app', 'package.json'), 'utf8'));
  const serverPackage = JSON.parse(fs.readFileSync(path.join(__dirname, 'server', 'package.json'), 'utf8'));
  
  // Check for critical security dependencies
  const criticalDeps = ['helmet', 'cors', 'express-rate-limit', 'bcryptjs', 'jsonwebtoken'];
  
  criticalDeps.forEach(dep => {
    if (serverPackage.dependencies[dep] || serverPackage.devDependencies[dep]) {
      console.log(`✅ ${dep} included`);
    } else {
      console.log(`❌ ${dep} missing from server`);
      allPassed = false;
    }
  });
  
  // Check for error handling in frontend
  if (appPackage.dependencies['sonner']) {
    console.log('✅ Toast notifications (sonner) included');
  } else {
    console.log('❌ Toast notifications missing');
    allPassed = false;
  }
  
} catch (error) {
  console.log('❌ Error checking dependencies:', error.message);
  allPassed = false;
}

console.log('\n===================================');
if (allPassed) {
  console.log('🎉 All tests passed!');
  console.log('\nNext steps:');
  console.log('1. Run: chmod +x deploy-fixes.sh');
  console.log('2. Run: ./deploy-fixes.sh');
  console.log('3. Update environment variables');
  console.log('4. Start with: ./start-verdexis.sh');
} else {
  console.log('⚠️ Some tests failed.');
  console.log('\nPlease check the failed items above.');
  console.log('Run the deployment script to fix missing items:');
  console.log('./deploy-fixes.sh');
}
console.log('===================================\n');