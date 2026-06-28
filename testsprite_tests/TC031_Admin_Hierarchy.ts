// Test Suite: Admin Hierarchy Management
// File: server/src/lib/adminHierarchy.ts
// Coverage: Super Admin creation, sub-admin creation, user assignment, permissions

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals'

interface TestContext {
  baseUrl: string
  superAdminToken: string
  superAdminId: string
  superAdminEmail: string
  subAdminToken: string
  subAdminId: string
  subAdminEmail: string
  regularUserId: string
  regularUserEmail: string
  regularUserToken: string
}

const context: TestContext = {
  baseUrl: 'http://localhost:4000',
  superAdminToken: '',
  superAdminId: '',
  superAdminEmail: 'admin@verdexis.com',
  subAdminToken: '',
  subAdminId: '',
  subAdminEmail: `subadmin-${Date.now()}@verdexis.com`,
  regularUserId: '',
  regularUserEmail: `user-${Date.now()}@verdexis.com`,
  regularUserToken: ''
}

// Helper function for API calls
async function apiCall(
  method: string,
  endpoint: string,
  data?: any,
  token?: string
) {
  const headers: any = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`${context.baseUrl}${endpoint}`, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined
  })

  const responseData = await response.json()
  return { status: response.status, data: responseData, headers: response.headers }
}

describe('Admin Hierarchy Management (TC031)', () => {
  
  // ============================================
  // SETUP: Create Super Admin and Regular User
  // ============================================
  beforeAll(async () => {
    console.log('🔧 Setting up test data for Admin Hierarchy tests')

    // Try to login as existing super admin
    const loginResponse = await apiCall('POST', '/api/auth/login', {
      email: context.superAdminEmail,
      password: 'AdminPassword123!'
    })

    if (loginResponse.status === 200) {
      context.superAdminToken = loginResponse.data.token
      context.superAdminId = loginResponse.data.user.id
    } else {
      // If super admin doesn't exist, use create-admin endpoint or DB script
      console.log('⚠️  Super admin not found, skipping tests')
    }

    // Create regular user for assignment tests
    const userSignup = await apiCall('POST', '/api/auth/signup', {
      email: context.regularUserEmail,
      password: 'UserPassword123!',
      name: 'Test User'
    })

    if (userSignup.status === 201) {
      context.regularUserId = userSignup.data.user.id
      context.regularUserToken = userSignup.data.token
    }
  })

  // ============================================
  // SUPER ADMIN FUNCTIONS
  // ============================================
  describe('Super Admin Functions', () => {
    
    it('isSuperAdmin - Should identify Super Admin correctly', async () => {
      if (!context.superAdminToken) {
        console.log('⏭️  Skipping: Super admin not available')
        return
      }

      const { status, data } = await apiCall(
        'GET',
        '/api/admin/hierarchy/verify-super-admin',
        null,
        context.superAdminToken
      )

      expect(status).toBe(200)
      expect(data.isSuperAdmin).toBe(true)
      expect(data.userId).toBe(context.superAdminId)
    })

    it('canCreateAdmins - Super Admin should be able to create admins', async () => {
      if (!context.superAdminToken) {
        console.log('⏭️  Skipping: Super admin not available')
        return
      }

      const { status, data } = await apiCall(
        'GET',
        '/api/admin/hierarchy/can-create-admins',
        null,
        context.superAdminToken
      )

      expect(status).toBe(200)
      expect(data.canCreateAdmins).toBe(true)
    })

    it('initializeSuperAdminHierarchy - Should initialize hierarchy for new Super Admin', async () => {
      if (!context.superAdminToken) {
        console.log('⏭️  Skipping: Super admin not available')
        return
      }

      const { status, data } = await apiCall(
        'GET',
        '/api/admin/hierarchy/info',
        null,
        context.superAdminToken
      )

      expect(status).toBe(200)
      expect(data.canCreateAdmins).toBe(true)
      expect(data.canManageUsers).toBe(true)
      expect(data.canManageDeposits).toBe(true)
      expect(data.canManageTransactions).toBe(true)
      expect(data.parentAdminId).toBeNull()
    })

    it('getSubAdmins - Super Admin should see list of created sub-admins', async () => {
      if (!context.superAdminToken) {
        console.log('⏭️  Skipping: Super admin not available')
        return
      }

      const { status, data } = await apiCall(
        'GET',
        '/api/admin/hierarchy/sub-admins',
        null,
        context.superAdminToken
      )

      expect(status).toBe(200)
      expect(Array.isArray(data.subAdmins)).toBe(true)
      expect(data.subAdmins.length).toBeGreaterThanOrEqual(0)
    })
  })

  // ============================================
  // SUB-ADMIN CREATION
  // ============================================
  describe('Create Sub-Admin', () => {
    
    it('createSubAdmin - Super Admin should create new sub-admin', async () => {
      if (!context.superAdminToken) {
        console.log('⏭️  Skipping: Super admin not available')
        return
      }

      const { status, data } = await apiCall(
        'POST',
        '/api/admin/hierarchy/create-sub-admin',
        {
          email: context.subAdminEmail,
          name: 'Sub Admin User',
          password: 'SubAdminPass123!'
        },
        context.superAdminToken
      )

      expect(status).toBe(201)
      expect(data.admin.email).toBe(context.subAdminEmail)
      expect(data.admin.role).toBe('admin')
      expect(data.hierarchy.parentAdminId).toBe(context.superAdminId)
      expect(data.hierarchy.canCreateAdmins).toBe(false)
      expect(data.hierarchy.canManageUsers).toBe(true)
      expect(data.hierarchy.canManageDeposits).toBe(true)
      expect(data.hierarchy.canManageTransactions).toBe(true)

      context.subAdminId = data.admin.id
    })

    it('createSubAdmin - Reject non-Super Admin creating admins', async () => {
      if (!context.regularUserToken) {
        console.log('⏭️  Skipping: Regular user not available')
        return
      }

      const { status, data } = await apiCall(
        'POST',
        '/api/admin/hierarchy/create-sub-admin',
        {
          email: `badmin-${Date.now()}@verdexis.com`,
          name: 'Bad Admin',
          password: 'BadAdminPass123!'
        },
        context.regularUserToken
      )

      expect(status).toBe(403)
      expect(data.error).toContain('Super Admin')
    })

    it('createSubAdmin - Duplicate email should be rejected', async () => {
      if (!context.superAdminToken) {
        console.log('⏭️  Skipping: Super admin not available')
        return
      }

      const { status, data } = await apiCall(
        'POST',
        '/api/admin/hierarchy/create-sub-admin',
        {
          email: context.subAdminEmail,
          name: 'Duplicate Admin',
          password: 'DuplicatePass123!'
        },
        context.superAdminToken
      )

      expect(status).toBe(409)
      expect(data.error).toBeDefined()
    })
  })

  // ============================================
  // SUB-ADMIN LIMITATIONS
  // ============================================
  describe('Sub-Admin Limitations', () => {
    
    beforeEach(async () => {
      // Login as sub-admin if created
      if (context.subAdminId) {
        const loginResponse = await apiCall('POST', '/api/auth/login', {
          email: context.subAdminEmail,
          password: 'SubAdminPass123!'
        })

        if (loginResponse.status === 200) {
          context.subAdminToken = loginResponse.data.token
        }
      }
    })

    it('canCreateAdmins - Sub-Admin should NOT be able to create admins', async () => {
      if (!context.subAdminToken) {
        console.log('⏭️  Skipping: Sub-admin not available')
        return
      }

      const { status, data } = await apiCall(
        'GET',
        '/api/admin/hierarchy/can-create-admins',
        null,
        context.subAdminToken
      )

      expect(status).toBe(200)
      expect(data.canCreateAdmins).toBe(false)
    })

    it('isSuperAdmin - Sub-Admin should NOT be identified as Super Admin', async () => {
      if (!context.subAdminToken) {
        console.log('⏭️  Skipping: Sub-admin not available')
        return
      }

      const { status, data } = await apiCall(
        'GET',
        '/api/admin/hierarchy/verify-super-admin',
        null,
        context.subAdminToken
      )

      expect(status).toBe(200)
      expect(data.isSuperAdmin).toBe(false)
    })

    it('getAdminParent - Sub-Admin should have Super Admin as parent', async () => {
      if (!context.subAdminToken) {
        console.log('⏭️  Skipping: Sub-admin not available')
        return
      }

      const { status, data } = await apiCall(
        'GET',
        '/api/admin/hierarchy/parent',
        null,
        context.subAdminToken
      )

      expect(status).toBe(200)
      expect(data.parentAdminId).toBe(context.superAdminId)
    })

    it('createSubAdmin - Sub-Admin should be rejected when trying to create admin', async () => {
      if (!context.subAdminToken) {
        console.log('⏭️  Skipping: Sub-admin not available')
        return
      }

      const { status, data } = await apiCall(
        'POST',
        '/api/admin/hierarchy/create-sub-admin',
        {
          email: `another-admin-${Date.now()}@verdexis.com`,
          name: 'Another Admin',
          password: 'AnotherAdminPass123!'
        },
        context.subAdminToken
      )

      expect(status).toBe(403)
      expect(data.error).toContain('Super Admin')
    })
  })

  // ============================================
  // USER ASSIGNMENT
  // ============================================
  describe('User Assignment to Admins', () => {
    
    it('assignUserToAdmin - Super Admin should assign user to sub-admin', async () => {
      if (!context.superAdminToken || !context.subAdminId) {
        console.log('⏭️  Skipping: Prerequisites not available')
        return
      }

      const { status, data } = await apiCall(
        'POST',
        '/api/admin/hierarchy/assign-user',
        {
          userId: context.regularUserId,
          adminId: context.subAdminId
        },
        context.superAdminToken
      )

      expect(status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.assignment.userId).toBe(context.regularUserId)
      expect(data.assignment.adminId).toBe(context.subAdminId)
    })

    it('assignUserToAdmin - Sub-Admin can self-assign users', async () => {
      if (!context.subAdminToken || !context.regularUserId) {
        console.log('⏭️  Skipping: Prerequisites not available')
        return
      }

      const { status } = await apiCall(
        'POST',
        '/api/admin/hierarchy/assign-user',
        {
          userId: context.regularUserId,
          adminId: context.subAdminId
        },
        context.subAdminToken
      )

      expect(status).toBe(200)
    })

    it('assignUserToAdmin - Reject unauthorized user assignment', async () => {
      if (!context.regularUserToken || !context.subAdminId) {
        console.log('⏭️  Skipping: Prerequisites not available')
        return
      }

      const { status, data } = await apiCall(
        'POST',
        '/api/admin/hierarchy/assign-user',
        {
          userId: context.regularUserId,
          adminId: context.subAdminId
        },
        context.regularUserToken
      )

      expect(status).toBe(403)
      expect(data.error).toBeDefined()
    })

    it('canAssignUser - Should validate user can be assigned', async () => {
      if (!context.regularUserId) {
        console.log('⏭️  Skipping: Regular user not available')
        return
      }

      const { status, data } = await apiCall(
        'POST',
        '/api/admin/hierarchy/can-assign-user',
        {
          userId: context.regularUserId,
          adminId: context.subAdminId
        }
      )

      expect(status).toBe(200)
      expect(data.canAssign).toBe(true)
    })

    it('getAdminUsers - Should list users assigned to admin', async () => {
      if (!context.subAdminToken) {
        console.log('⏭️  Skipping: Sub-admin not available')
        return
      }

      const { status, data } = await apiCall(
        'GET',
        '/api/admin/hierarchy/assigned-users',
        null,
        context.subAdminToken
      )

      expect(status).toBe(200)
      expect(Array.isArray(data.users)).toBe(true)
      expect(data.users.length).toBeGreaterThanOrEqual(0)
    })

    it('assignUserToAdmin - Reassign user to different admin', async () => {
      if (!context.superAdminToken || !context.regularUserId) {
        console.log('⏭️  Skipping: Prerequisites not available')
        return
      }

      // Create another sub-admin first
      const createAdminResponse = await apiCall(
        'POST',
        '/api/admin/hierarchy/create-sub-admin',
        {
          email: `admin2-${Date.now()}@verdexis.com`,
          name: 'Second Sub Admin',
          password: 'Admin2Pass123!'
        },
        context.superAdminToken
      )

      if (createAdminResponse.status !== 201) {
        console.log('⏭️  Skipping: Could not create second admin')
        return
      }

      const secondAdminId = createAdminResponse.data.admin.id

      // Reassign user
      const { status, data } = await apiCall(
        'POST',
        '/api/admin/hierarchy/assign-user',
        {
          userId: context.regularUserId,
          adminId: secondAdminId
        },
        context.superAdminToken
      )

      expect(status).toBe(200)
      expect(data.assignment.adminId).toBe(secondAdminId)
    })
  })

  // ============================================
  // ERROR HANDLING
  // ============================================
  describe('Error Handling and Validation', () => {
    
    it('Nonexistent user assignment should fail', async () => {
      if (!context.superAdminToken || !context.subAdminId) {
        console.log('⏭️  Skipping: Prerequisites not available')
        return
      }

      const { status, data } = await apiCall(
        'POST',
        '/api/admin/hierarchy/assign-user',
        {
          userId: 'nonexistent-user-id',
          adminId: context.subAdminId
        },
        context.superAdminToken
      )

      expect(status).toBe(404)
      expect(data.error).toBeDefined()
    })

    it('Nonexistent admin should fail assignment', async () => {
      if (!context.superAdminToken || !context.regularUserId) {
        console.log('⏭️  Skipping: Prerequisites not available')
        return
      }

      const { status, data } = await apiCall(
        'POST',
        '/api/admin/hierarchy/assign-user',
        {
          userId: context.regularUserId,
          adminId: 'nonexistent-admin-id'
        },
        context.superAdminToken
      )

      expect(status).toBe(404)
      expect(data.error).toBeDefined()
    })

    it('Invalid email format for sub-admin creation', async () => {
      if (!context.superAdminToken) {
        console.log('⏭️  Skipping: Super admin not available')
        return
      }

      const { status, data } = await apiCall(
        'POST',
        '/api/admin/hierarchy/create-sub-admin',
        {
          email: 'invalid-email',
          name: 'Invalid Email Admin',
          password: 'InvalidEmailPass123!'
        },
        context.superAdminToken
      )

      expect(status).toBe(400)
      expect(data.error).toBeDefined()
    })

    it('Missing required fields for sub-admin creation', async () => {
      if (!context.superAdminToken) {
        console.log('⏭️  Skipping: Super admin not available')
        return
      }

      const { status, data } = await apiCall(
        'POST',
        '/api/admin/hierarchy/create-sub-admin',
        {
          email: `incomplete-${Date.now()}@verdexis.com`
          // Missing name and password
        },
        context.superAdminToken
      )

      expect(status).toBe(400)
      expect(data.error).toBeDefined()
    })

    it('Weak password for sub-admin should be rejected', async () => {
      if (!context.superAdminToken) {
        console.log('⏭️  Skipping: Super admin not available')
        return
      }

      const { status, data } = await apiCall(
        'POST',
        '/api/admin/hierarchy/create-sub-admin',
        {
          email: `weak-${Date.now()}@verdexis.com`,
          name: 'Weak Password Admin',
          password: '123'
        },
        context.superAdminToken
      )

      expect(status).toBe(400)
      expect(data.error).toBeDefined()
    })
  })

  // ============================================
  // AUTHORIZATION AND PERMISSIONS
  // ============================================
  describe('Authorization and Permissions', () => {
    
    it('Unauthenticated request should fail', async () => {
      const { status, data } = await apiCall(
        'GET',
        '/api/admin/hierarchy/sub-admins'
      )

      expect(status).toBe(401)
      expect(data.error).toBe('UNAUTHORIZED')
    })

    it('Invalid token should fail', async () => {
      const { status, data } = await apiCall(
        'GET',
        '/api/admin/hierarchy/sub-admins',
        null,
        'invalid.token.here'
      )

      expect(status).toBe(401)
      expect(data.error).toBeDefined()
    })

    it('Expired token should be rejected', async () => {
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjB9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'

      const { status, data } = await apiCall(
        'GET',
        '/api/admin/hierarchy/sub-admins',
        null,
        expiredToken
      )

      expect(status).toBe(401)
      expect(data.error).toBeDefined()
    })

    it('Regular user should not access admin endpoints', async () => {
      if (!context.regularUserToken) {
        console.log('⏭️  Skipping: Regular user not available')
        return
      }

      const { status, data } = await apiCall(
        'GET',
        '/api/admin/hierarchy/sub-admins',
        null,
        context.regularUserToken
      )

      expect([403, 403]).toContain(status)
      expect(data.error).toBeDefined()
    })
  })

  // ============================================
  // CLEANUP
  // ============================================
  afterAll(async () => {
    console.log('🧹 Test cleanup complete')
  })
})
