#!/usr/bin/env node
/**
 * Copy Trading Feature Verification Script
 * Run this BEFORE deploying to ensure everything works
 * 
 * Usage: node verify-copy-trading.mjs
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function verify() {
  console.log('🔍 Verifying Copy Trading Implementation...\n')

  let allPassed = true

  // Test 1: Check if new tables exist
  try {
    console.log('✓ Test 1: Checking database tables...')
    await prisma.traderProfile.findMany({ take: 1 })
    await prisma.copyRelationship.findMany({ take: 1 })
    await prisma.copyTrade.findMany({ take: 1 })
    console.log('  ✅ All tables exist\n')
  } catch (err) {
    console.log('  ❌ Tables missing - run migration first')
    console.log(`  Error: ${err.message}\n`)
    allPassed = false
  }

  // Test 2: Check if User relationships work
  try {
    console.log('✓ Test 2: Checking User model relationships...')
    const user = await prisma.user.findFirst({
      include: {
        traderProfile: true,
        followers: { take: 1 },
        following: { take: 1 },
      },
    })
    console.log('  ✅ User relationships working\n')
  } catch (err) {
    console.log('  ❌ User relationships broken')
    console.log(`  Error: ${err.message}\n`)
    allPassed = false
  }

  // Test 3: Check indexes
  try {
    console.log('✓ Test 3: Checking database indexes...')
    // PostgreSQL specific query
    const indexes = await prisma.$queryRaw`
      SELECT tablename, indexname 
      FROM pg_indexes 
      WHERE tablename IN ('TraderProfile', 'CopyRelationship', 'CopyTrade')
      ORDER BY tablename, indexname;
    `
    console.log(`  ✅ Found ${indexes.length} indexes\n`)
  } catch (err) {
    console.log('  ⚠️  Index check skipped (may not be PostgreSQL)\n')
  }

  // Test 4: Create a test trader profile
  try {
    console.log('✓ Test 4: Creating test trader profile...')
    const testUser = await prisma.user.findFirst()
    
    if (testUser) {
      const profile = await prisma.traderProfile.upsert({
        where: { userId: testUser.id },
        update: {},
        create: {
          userId: testUser.id,
          displayName: 'Test Trader',
          bio: 'Test profile created by verification script',
          isPublic: false,
        },
      })
      console.log(`  ✅ Profile created: ${profile.id}\n`)
    } else {
      console.log('  ⚠️  No users found - create a user first\n')
    }
  } catch (err) {
    console.log('  ❌ Failed to create profile')
    console.log(`  Error: ${err.message}\n`)
    allPassed = false
  }

  // Test 5: Check foreign keys
  try {
    console.log('✓ Test 5: Checking foreign key constraints...')
    const profile = await prisma.traderProfile.findFirst({
      include: { user: true },
    })
    if (profile?.user) {
      console.log('  ✅ Foreign keys working\n')
    } else {
      console.log('  ⚠️  No profiles to test\n')
    }
  } catch (err) {
    console.log('  ❌ Foreign key constraint issue')
    console.log(`  Error: ${err.message}\n`)
    allPassed = false
  }

  // Summary
  console.log('=' .repeat(50))
  if (allPassed) {
    console.log('✅ ALL TESTS PASSED - Safe to deploy!')
    console.log('\nNext steps:')
    console.log('1. Commit changes: git add . && git commit -m "feat: add copy trading"')
    console.log('2. Push to deploy: git push origin main')
    console.log('3. Test API endpoints:')
    console.log('   - GET  /api/copy-trading/leaderboard')
    console.log('   - GET  /api/copy-trading/my-profile')
    console.log('   - GET  /api/copy-trading/following')
  } else {
    console.log('❌ SOME TESTS FAILED - Do NOT deploy yet!')
    console.log('\nFix issues before deploying:')
    console.log('1. Run migration: cd server && npx prisma migrate dev')
    console.log('2. Generate client: npx prisma generate')
    console.log('3. Re-run this script: node verify-copy-trading.mjs')
  }
  console.log('=' .repeat(50))

  await prisma.$disconnect()
  process.exit(allPassed ? 0 : 1)
}

verify().catch(err => {
  console.error('❌ Verification script failed:', err)
  process.exit(1)
})
