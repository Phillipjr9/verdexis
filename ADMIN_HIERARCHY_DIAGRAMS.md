# Admin Hierarchy - Architecture & Flow Diagrams

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         VERDEXIS PLATFORM                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────┐              ┌──────────────────┐        │
│  │   Frontend App   │◄─────────────►│   Express API    │        │
│  │   (React/TSX)    │              │   (Node.js)      │        │
│  └──────────────────┘              └──────────────────┘        │
│         │                                   │                   │
│         │ AdminHierarchyManager             │ Admin Routes      │
│         │ Component                         │                   │
│         │                            ┌──────▼────────┐         │
│         └───────────────────────────►│  Auth Routes   │         │
│                                      │  (Signup/Login)│        │
│                                      └──────┬────────┘         │
│                                             │                   │
│                                      ┌──────▼──────────┐        │
│                                      │  Admin Library  │        │
│                                      │  (Business      │        │
│                                      │   Logic)        │        │
│                                      └──────┬──────────┘        │
│                                             │                   │
│                              ┌──────────────▼─────────────┐    │
│                              │   Prisma ORM              │    │
│                              │   (Database Layer)        │    │
│                              └──────────────┬─────────────┘    │
│                                             │                   │
│                                      ┌──────▼──────────┐        │
│                                      │   Database      │        │
│                                      │   (PostgreSQL/  │        │
│                                      │    SQLite)      │        │
│                                      └─────────────────┘        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Admin Hierarchy Structure

```
                    Super Admin
                 (admin@verdexis.com)
                        │
                  [Full Permissions]
                        │
        ┌───────────────┼───────────────┐
        │               │               │
        ▼               ▼               ▼
     Sub-Admin 1    Sub-Admin 2    Sub-Admin 3
    (Limited Admins) (Regional)    (Country)
        │               │               │
  [Can't create]  [Can't create]  [Can't create]
        │               │               │
    ┌───┴────┐    ┌─────┴──────┐   ┌──┴────┐
    │        │    │            │   │       │
    ▼        ▼    ▼            ▼   ▼       ▼
  User1    User2 User3         User4 User5 User6
  (No perm) (No perm) (No perm)
```

## User Signup & Auto-Assignment Flow

```
User Visits App
       │
       ▼
   ┌─────────────┐
   │   Signup    │
   │   Form      │
   └──────┬──────┘
          │
          ▼
   ┌──────────────────┐
   │ POST /api/auth/  │
   │ signup           │
   └──────┬───────────┘
          │
          ▼
   ┌──────────────────────┐
   │ Create User in DB    │
   │ role = 'user'        │
   └──────┬───────────────┘
          │
          ▼
   ┌──────────────────────┐
   │ Check if DEFAULT_    │
   │ ADMIN_ID set?        │
   └──────┬───────────────┘
          │
    ┌─────┴─────┐
    │           │
   YES         NO
    │           │
    ▼           ▼
 ┌────┐     Skip
 │Assign   Auto-
 │User to  Assign
 │Admin│
 └─┬──┘
   │
   ▼
┌────────────────────┐
│ Award Signup Bonus │
│ (if enabled)       │
└─────┬──────────────┘
      │
      ▼
┌─────────────────┐
│ Return JWT Token│
│ & User Object   │
└─────────────────┘
```

## Database Schema Relationships

```
┌─────────────────────┐
│      User           │
├─────────────────────┤
│ id (PK)             │◄──┐
│ email               │   │
│ name                │   │
│ role: admin|user    │   │
│ passwordHash        │   │
│ ...                 │   │
└──────┬──────────────┘   │
       │                  │
       │                  │
       ▼                  │
┌─────────────────────┐   │
│  AdminHierarchy     │   │
├─────────────────────┤   │
│ adminId (PK, FK)──────┐ │
│ parentAdminId (FK)  │ │ │
│ canCreateAdmins     │ │ │
│ canManageUsers      │ │ │
│ canManageDeposits   │ │ │
│ canManageTransact   │ │ │
│ createdBy (FK)      │ │ │
└─────┬───────────────┘ │ │
      │                 │ │
      └─────────────┐   │ │
                    │   │ │
    ┌───────────────▼─┐ │ │
    │ parentAdminId   │ │ │
    │ points to User  │─┘ │
    └─────────────────┘   │
                          │
┌─────────────────────────┘
│
│  ┌───────────────────────┐
│  │ UserAdminAssignment   │
│  ├───────────────────────┤
│  │ userId (PK, FK)       │
│  │ adminId (PK, FK)  ────┘
│  │ assignedBy (FK)   ────┐
│  │ assignedAt            │
│  └───────────────────────┘
│                        │
│  ┌──────────────────────┘
│  │
│  ▼
│  User record
```

## API Request-Response Flow

```
┌─────────────────────────────────────────────┐
│  Frontend (React Component)                 │
│  AdminHierarchyManager                      │
│  - Create form                              │
│  - Admin list                               │
│  - User list                                │
└────────┬────────────────────────────────────┘
         │
         │ 1. POST /api/admin/hierarchy/admins
         │    {email, name, password}
         │
         ▼
┌─────────────────────────────────────────────┐
│  Express API Server                         │
│  /admin-hierarchy.ts                        │
│                                             │
│  POST /admins                               │
│  ├─ Validate input (schema)                 │
│  ├─ Check auth header                       │
│  ├─ Verify Super Admin (isSuperAdmin)       │
│  ├─ Check email not taken                   │
│  ├─ Hash password (bcryptjs)                │
│  └─ Create sub-admin                        │
└────────┬────────────────────────────────────┘
         │
         │ 2. Call adminHierarchy.createSubAdmin()
         │
         ▼
┌─────────────────────────────────────────────┐
│  Admin Library (Business Logic)             │
│  /lib/adminHierarchy.ts                     │
│                                             │
│  createSubAdmin(superAdminId, data)         │
│  ├─ Create User record                      │
│  │  role = 'admin'                          │
│  │                                          │
│  └─ Create AdminHierarchy                   │
│     ├─ parentAdminId = superAdminId        │
│     ├─ canCreateAdmins = false              │
│     ├─ canManageUsers = true                │
│     └─ ...permissions                       │
└────────┬────────────────────────────────────┘
         │
         │ 3. INSERT into User, AdminHierarchy tables
         │
         ▼
┌─────────────────────────────────────────────┐
│  Prisma ORM                                 │
│  Database Transaction                       │
│  ├─ Create User                             │
│  └─ Create AdminHierarchy                   │
└────────┬────────────────────────────────────┘
         │
         │ 4. SQL Queries
         │
         ▼
┌─────────────────────────────────────────────┐
│  Database                                   │
│  ├─ INSERT INTO User (...)                  │
│  ├─ INSERT INTO AdminHierarchy (...)        │
│  └─ COMMIT                                  │
└────────┬────────────────────────────────────┘
         │
         │ 5. Success Response
         │    {ok: true, admin: {...}}
         │
         ▼
┌─────────────────────────────────────────────┐
│  Frontend (React Component)                 │
│  ├─ Update admins list                      │
│ ├─ Show success notification                │
│ └─ Clear form                               │
└─────────────────────────────────────────────┘
```

## Permission Enforcement Logic

```
┌────────────────────────────────────┐
│ Incoming Request                   │
│ /api/admin/hierarchy/...           │
└────────┬─────────────────────────┐
         │                         │
         ▼                         ▼
    ┌──────────┐            ┌───────────┐
    │ requireAuth middleware  │ requireAdmin
    │ (verify JWT token)      │ middleware
    └────┬─────────────────────┘
         │
         ▼
   ┌──────────────┐
   │ Check if     │
   │ Super Admin? │
   └──┬──────┬────┘
      │      │
     YES    NO
      │      │
      ▼      ▼
   ┌──┐   ┌───────────────┐
   │✓ │   │ Check if      │
   │  │   │ Admin's own   │
   │  │   │ data/users?   │
   │  │   └─┬──────────┬──┘
   │  │     │          │
   │  │    YES        NO
   │  │     │          │
   │  │     ▼          ▼
   │  │    ┌──┐     ┌────┐
   │  │    │✓ │     │✗ 403
   │  │    │  │     │     
   │  │    └──┘     └────┘
   │  │
   │  └─────────────┐
   │                │
   └────┬───────────┘
        │
        ▼
   ┌──────────────┐
   │ Execute      │
   │ Request      │
   │ Handler      │
   └──────────────┘
```

## Environment & Configuration Flow

```
┌────────────────────────────────┐
│ Production Environment          │
│ ├─ ADMIN_EMAIL                 │
│ ├─ ADMIN_PASSWORD              │
│ ├─ DEFAULT_ADMIN_ID            │
│ ├─ JWT_SECRET                  │
│ ├─ DATABASE_URL                │
│ └─ NODE_ENV=production          │
└────┬─────────────────────────┐
     │                         │
     ▼                         ▼
┌──────────────┐        ┌──────────────┐
│ npm run      │        │ Server       │
│ create-super │        │ Initialization
│ admin        │        │              │
└──┬───────────┘        └──────────────┘
   │                            │
   ├─ Creates                   │
   │  admin@verdexis.com        │
   │                            │
   ├─ Sets up                   │
   │  AdminHierarchy            │
   │                            │
   ├─ Seeds                     │
   │  wallet balances           │
   │                            │
   └─ Ready for                 │
      user signups              │
            │                   │
            └──────┬────────────┘
                   │
                   ▼
         ┌──────────────────┐
         │ Users register   │
         │ - Signup form    │
         │ - Check          │
         │  DEFAULT_ADMIN_ID│
         │ - Auto-assign    │
         │  to admin        │
         └──────────────────┘
```

## Error Handling Flow

```
Request Arrives
     │
     ▼
┌──────────────────┐
│ Validation       │
│ (Schema)         │
└─┬────────────┬───┘
  │            │
 PASS        FAIL
  │            │
  ▼            ▼
┌──┐      ┌────────┐
│✓ │      │ 400    │
│  │      │ Bad    │
└─┬┘      │Request │
  │       └────────┘
  ▼
┌──────────────────┐
│ Authentication   │
│ (JWT token)      │
└─┬────────────┬───┘
  │            │
 VALID      INVALID
  │            │
  ▼            ▼
┌──┐      ┌────────┐
│✓ │      │ 401    │
│  │      │ Unatho │
└─┬┘      │rized   │
  │       └────────┘
  ▼
┌──────────────────┐
│ Authorization    │
│ (Permissions)    │
└─┬────────────┬───┘
  │            │
 ALLOWED    DENIED
  │            │
  ▼            ▼
┌──┐      ┌────────┐
│✓ │      │ 403    │
│  │      │Forbiden│
└─┬┘      └────────┘
  │
  ▼
┌──────────────────┐
│ Business Logic   │
│ Execution        │
└─┬────────────┬───┘
  │            │
 SUCCESS    FAILED
  │            │
  ▼            ▼
┌──────┐   ┌────────┐
│ 200  │   │ 400/409│
│ OK   │   │ Error  │
└──────┘   └────────┘
```

## Deployment Pipeline

```
┌──────────────────┐
│ Code Changes     │
│ (GitHub/GitLab)  │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ CI/CD Pipeline   │
│ - Tests          │
│ - Build          │
│ - Lint           │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Deploy to        │
│ Production       │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Database         │
│ Migration        │
│ (if needed)      │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Initialize Super │
│ Admin (one-time) │
│ npm run          │
│ create-super     │
│ admin            │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Run Tests        │
│ npm run          │
│ test-admin       │
│ hierarchy        │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ All Green ✅      │
│ Ready for Users  │
└──────────────────┘
```

## Data Flow: User Assignment

```
┌─────────────────────────────┐
│ Admin clicks "Assign User"  │
└────────┬────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│ AdminHierarchyManager Component  │
│ Form with:                       │
│ - User selector dropdown         │
│ - Admin selector dropdown        │
└────┬─────────────────────────────┘
     │
     ▼
┌──────────────────────────────────┐
│ POST /api/admin/hierarchy/        │
│      assign-user                 │
│ {                                │
│   userId: "usr_123",             │
│   adminId: "usr_456"             │
│ }                                │
└────┬─────────────────────────────┘
     │
     ▼
┌──────────────────────────────────┐
│ Auth Middleware                  │
│ ✓ Token valid                    │
│ ✓ User authenticated             │
└────┬─────────────────────────────┘
     │
     ▼
┌──────────────────────────────────┐
│ Permission Check                 │
│ ✓ Is Super Admin OR              │
│ ✓ Is the target admin            │
└────┬─────────────────────────────┘
     │
     ▼
┌──────────────────────────────────┐
│ assignUserToAdmin()              │
│ 1. Remove old assignment (if any)│
│ 2. Create new assignment         │
│ 3. Set assignedBy & assignedAt   │
└────┬─────────────────────────────┘
     │
     ▼
┌──────────────────────────────────┐
│ Database Transaction             │
│ DELETE UserAdminAssignment       │
│ WHERE userId = "usr_123"         │
│                                  │
│ INSERT UserAdminAssignment       │
│ (userId, adminId, assignedBy...) │
└────┬─────────────────────────────┘
     │
     ▼
┌──────────────────────────────────┐
│ Return Response                  │
│ {                                │
│   ok: true,                      │
│   message: "User assigned"       │
│ }                                │
└────┬─────────────────────────────┘
     │
     ▼
┌──────────────────────────────────┐
│ Frontend Updates                 │
│ ✓ Success notification           │
│ ✓ Refresh user list              │
│ ✓ Clear form                     │
└──────────────────────────────────┘
```

These diagrams show:
- System architecture and component relationships
- Admin hierarchy structure with levels
- User signup and auto-assignment flow
- Database schema and relationships
- API request/response lifecycle
- Permission enforcement logic
- Configuration and environment flow
- Error handling cascade
- Deployment pipeline
- User assignment data flow
