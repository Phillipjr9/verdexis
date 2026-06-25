#!/usr/bin/env node
/**
 * Admin Hierarchy API Test Script
 * Tests all endpoints with proper authentication
 */

import fetch from 'node-fetch'

const BASE_URL = process.env.API_URL || 'http://localhost:3000'
const SUPER_ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@verdexis.com'
const SUPER_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@Verdexis2024'

let superAdminToken = ''
let testAdminId = ''
let testUserId = ''

const log = {
  success: (msg) => console.log(`✅ ${msg}`),
  error: (msg) => console.error(`❌ ${msg}`),
  info: (msg) => console.log(`ℹ️  ${msg}`),
  test: (msg) => console.log(`\n🧪 Testing: ${msg}`),
}

async function request(method, path, body = null, token = null) {
  const url = `${BASE_URL}${path}`
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: body ? JSON.stringify(body) : null,
  }

  try {
    const res = await fetch(url, options)
    const data = await res.json()
    return { status: res.status, data }
  } catch (err) {
    log.error(`Request failed: ${err.message}`)
    throw err
  }
}

async function login() {
  log.test('Login as Super Admin')
  const { status, data } = await request('POST', '/api/auth/login', {
    email: SUPER_ADMIN_EMAIL,
    password: SUPER_ADMIN_PASSWORD,
  })

  if (status !== 200) {
    log.error(`Login failed (status ${status}): ${data.error}`)
    process.exit(1)
  }

  superAdminToken = data.token
  log.success(`Super Admin authenticated: ${data.user.email}`)
}

async function testCreateSubAdmin() {
  log.test('Create sub-admin')
  const { status, data } = await request(
    'POST',
    '/api/admin/hierarchy/admins',
    {
      email: `admin-test-${Date.now()}@example.com`,
      name: 'Test Admin',
      password: 'TestPass@123',
    },
    superAdminToken
  )

  if (status !== 201) {
    log.error(`Create sub-admin failed (status ${status}): ${data.error}`)
    return false
  }

  testAdminId = data.admin.id
  log.success(`Sub-admin created: ${data.admin.email} (ID: ${testAdminId})`)
  return true
}

async function testListSubAdmins() {
  log.test('List all sub-admins')
  const { status, data } = await request(
    'GET',
    '/api/admin/hierarchy/admins',
    null,
    superAdminToken
  )

  if (status !== 200) {
    log.error(`List sub-admins failed (status ${status}): ${data.error}`)
    return false
  }

  log.success(`Found ${data.count} sub-admin(s)`)
  return true
}

async function testGetAdminDetails() {
  log.test('Get admin details')
  const { status, data } = await request(
    'GET',
    `/api/admin/hierarchy/admins/${testAdminId}`,
    null,
    superAdminToken
  )

  if (status !== 200) {
    log.error(`Get admin details failed (status ${status}): ${data.error}`)
    return false
  }

  log.success(`Admin details retrieved`)
  log.info(`Permissions: canCreateAdmins=${data.hierarchy.canCreateAdmins}, canManageUsers=${data.hierarchy.canManageUsers}`)
  return true
}

async function testCreateRegularUser() {
  log.test('Create regular user for assignment')
  const { status, data } = await request('POST', '/api/auth/signup', {
    email: `user-test-${Date.now()}@example.com`,
    password: 'UserPass@123',
    name: 'Test User',
    phone: '+1234567890',
  })

  if (status !== 201) {
    log.error(`Create user failed (status ${status}): ${data.error}`)
    return false
  }

  testUserId = data.user.id
  log.success(`Test user created: ${data.user.email} (ID: ${testUserId})`)
  return true
}

async function testAssignUserToAdmin() {
  log.test('Assign user to admin')
  const { status, data } = await request(
    'POST',
    '/api/admin/hierarchy/assign-user',
    {
      userId: testUserId,
      adminId: testAdminId,
    },
    superAdminToken
  )

  if (status !== 200) {
    log.error(`Assign user failed (status ${status}): ${data.error}`)
    return false
  }

  log.success(`User assigned to admin`)
  return true
}

async function testGetAdminUsers() {
  log.test('Get admin\'s assigned users')
  const { status, data } = await request(
    'GET',
    `/api/admin/hierarchy/admins/${testAdminId}/users`,
    null,
    superAdminToken
  )

  if (status !== 200) {
    log.error(`Get admin users failed (status ${status}): ${data.error}`)
    return false
  }

  log.success(`Admin has ${data.count} assigned user(s)`)
  if (data.users.length > 0) {
    log.info(`Users: ${data.users.map((u) => u.email).join(', ')}`)
  }
  return true
}

async function testUnauthorizedAccess() {
  log.test('Verify unauthorized access is blocked')
  const { status, data } = await request(
    'GET',
    '/api/admin/hierarchy/admins',
    null,
    'invalid-token'
  )

  if (status === 401) {
    log.success(`Unauthorized access blocked (401)`)
    return true
  }

  log.error(`Expected 401, got ${status}`)
  return false
}

async function testRemoveAssignment() {
  log.test('Remove user assignment')
  const { status, data } = await request(
    'POST',
    '/api/admin/hierarchy/remove-assignment',
    {
      userId: testUserId,
      adminId: testAdminId,
    },
    superAdminToken
  )

  if (status !== 200) {
    log.error(`Remove assignment failed (status ${status}): ${data.error}`)
    return false
  }

  log.success(`User assignment removed`)
  return true
}

async function runTests() {
  log.info(`API Base URL: ${BASE_URL}\n`)

  try {
    await login()

    const tests = [
      testListSubAdmins,
      testCreateSubAdmin,
      testGetAdminDetails,
      testCreateRegularUser,
      testAssignUserToAdmin,
      testGetAdminUsers,
      testRemoveAssignment,
      testUnauthorizedAccess,
    ]

    let passed = 0
    let failed = 0

    for (const test of tests) {
      try {
        const result = await test()
        if (result !== false) {
          passed++
        } else {
          failed++
        }
      } catch (err) {
        log.error(`Test crashed: ${err.message}`)
        failed++
      }
    }

    console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed`)

    if (failed > 0) {
      process.exit(1)
    }
  } catch (err) {
    log.error(`Test suite failed: ${err.message}`)
    process.exit(1)
  }
}

runTests()
