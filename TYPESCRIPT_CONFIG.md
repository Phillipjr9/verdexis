# TypeScript Configuration - Strictness Improvements

This document outlines recommended TypeScript compiler options for improved type safety.

---

## Recommended tsconfig.json (server)

```json
{
  "compilerOptions": {
    // Strict mode enables all strict type checking options
    "strict": true,

    // Individual strict flags (already enabled by "strict": true, but listed for clarity)
    "noImplicitAny": true,           // Error on variables with implicit 'any' type
    "strictNullChecks": true,        // Error on null/undefined assignments
    "strictFunctionTypes": true,     // Error on unsafe function type comparisons
    "strictBindCallApply": true,     // Error on unsafe bind/call/apply calls
    "strictPropertyInitialization": true, // Error on uninitialized properties
    "noImplicitThis": true,          // Error on implicit 'any' 'this'

    // Additional safety checks
    "noUnusedLocals": true,          // Error on unused variables
    "noUnusedParameters": true,      // Error on unused function parameters
    "noImplicitReturns": true,       // Error on code paths without return
    "noFallthroughCasesInSwitch": true, // Error on switch fallthrough

    // Module resolution
    "moduleResolution": "node",
    "module": "esnext",
    "target": "es2020",

    // Path resolution
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    },

    // Output
    "outDir": "./dist",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,

    // Interop
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "forceConsistentCasingInFileNames": true,

    // Skip lib check for faster compilation
    "skipLibCheck": true,
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

---

## Current vs. Recommended

| Setting | Current | Recommended | Benefit |
|---------|---------|-------------|---------|
| strict | false | true | Catches most type errors |
| noUnusedLocals | false | true | Detects dead code |
| noUnusedParameters | false | true | Finds unused function args |
| noImplicitReturns | false | true | Ensures all paths return |
| noFallthroughCasesInSwitch | false | true | Catches switch bugs |

---

## Migration Guide

### Step 1: Audit Current Errors

```bash
# Check how many errors strict mode would catch
npx tsc --strict --noEmit
```

### Step 2: Fix by Category

#### A. Implicit Any Errors
```typescript
// ❌ BEFORE
const handleError = (err) => {
  console.error(err.message)
}

// ✅ AFTER
import type { Error as NodeError } from 'node:util'

const handleError = (err: NodeError | unknown): void => {
  if (err instanceof Error) {
    console.error(err.message)
  }
}
```

#### B. Unused Variables
```typescript
// ❌ BEFORE
const [data, setData] = useState('')
const [loading] = useState(false)  // unused

// ✅ AFTER
const [data, setData] = useState('')
// loading variable removed if not used
```

#### C. Missing Return Types
```typescript
// ❌ BEFORE
router.get('/endpoint', async (req, res) => {
  if (!req.body.id) {
    res.status(400).json({ error: 'Missing id' })
    // Implicit return undefined
  }
  const result = await db.find(req.body.id)
  res.json(result)
})

// ✅ AFTER
router.get('/endpoint', async (req: Request, res: Response): Promise<void> => {
  if (!req.body.id) {
    res.status(400).json({ error: 'Missing id' })
    return  // Explicit
  }
  const result = await db.find(req.body.id)
  res.json(result)
})
```

#### D. Null/Undefined Checks
```typescript
// ❌ BEFORE
const user = await db.user.findUnique({ where: { id } })
const email = user.email  // User might be null!

// ✅ AFTER
const user = await db.user.findUnique({ where: { id } })
if (!user) {
  throw new Error('User not found')
}
const email = user.email  // Safe to access
```

### Step 3: Enable Gradually (Optional)

If full migration is too large, enable settings one at a time:

```json
{
  "compilerOptions": {
    "noImplicitAny": true,
    "noUnusedLocals": false,  // Enable in next sprint
    "noUnusedParameters": false,  // Enable later
    "noImplicitReturns": false  // Enable later
  }
}
```

---

## Common Patterns in VERDEXIS

### Pattern 1: Prisma Results Can Be Null

```typescript
// ❌ UNSAFE
const user = await prisma.user.findUnique({ where: { id } })
console.log(user.email)  // Type error: user might be null

// ✅ SAFE
const user = await prisma.user.findUnique({ where: { id } })
if (!user) {
  throw new Error('User not found')
}
console.log(user.email)  // Safe
```

### Pattern 2: Express Request Body Is Any

```typescript
// ❌ UNSAFE
const body = req.body  // type: any
const amount = body.amount * 2  // No type checking

// ✅ SAFE
import { z } from 'zod'

const schema = z.object({ amount: z.number() })
const parsed = schema.safeParse(req.body)
if (!parsed.success) {
  sendError(res, 400, 'Invalid input')
  return
}
const amount = parsed.data.amount * 2  // Type-safe
```

### Pattern 3: JSON.parse Returns Any

```typescript
// ❌ UNSAFE
const prefs = JSON.parse(user.prefs) as Record<string, unknown>
const bonus = prefs.bonusLocked  // Could be anything

// ✅ SAFE
const prefs = JSON.parse(user.prefs) as Record<string, unknown>
const bonus = (prefs as { bonusLocked?: unknown }).bonusLocked === true
// Or use Zod schema for validation
```

### Pattern 4: Array Methods Can Return Undefined

```typescript
// ❌ UNSAFE
const first = items.find(x => x.id === id).name  // find() might return undefined

// ✅ SAFE
const item = items.find(x => x.id === id)
if (!item) {
  throw new Error('Item not found')
}
console.log(item.name)
```

---

## Benefits in VERDEXIS

### Security
- Type errors prevent runtime crashes
- Null checks catch missing error handling
- Function signatures are explicit

### Maintainability
- IDEs provide better autocomplete
- Refactoring is safer with type checking
- Code intent is self-documenting

### Performance
- Easier to optimize with known types
- Fewer runtime error checks needed
- Dead code elimination is easier

---

## Rollout Plan

### Phase 1: Foundation (Week 1)
- Enable `noImplicitAny`
- Fix type errors in core files (auth, db, errorHandler, logging)
- Update error handling utilities

### Phase 2: Safety (Week 2)
- Enable `noImplicitReturns`
- Fix async/Promise handling
- Update route handlers

### Phase 3: Cleanliness (Week 3)
- Enable `noUnusedLocals` and `noUnusedParameters`
- Remove dead code
- Clean up imports

### Phase 4: Strictness (Week 4)
- Enable all strict flags
- Audit and fix remaining errors
- Add pre-commit type checking

---

## Pre-Commit Hook (Optional)

Add to `.husky/pre-commit`:

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

npx tsc --noEmit
if [ $? -ne 0 ]; then
  echo "❌ TypeScript errors detected. Fix them before committing."
  exit 1
fi

echo "✅ TypeScript check passed"
```

---

## Configuration Examples by Scenario

### Strictest (Recommended for VERDEXIS)

```json
{
  "compilerOptions": {
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

### Production-Ready

```json
{
  "compilerOptions": {
    "strict": true,
    "noUnusedLocals": true,
    "noImplicitReturns": true
  }
}
```

### Moderate (If Migration is Large)

```json
{
  "compilerOptions": {
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noImplicitReturns": true
  }
}
```

---

## Tools to Help

### 1. TypeScript Check in VS Code

Settings → Search "typescript check" → Enable automatic checking

### 2. ESLint Integration

```bash
npm install --save-dev @typescript-eslint/parser @typescript-eslint/eslint-plugin
```

### 3. Pre-Commit Checking

```bash
npx tsc --noEmit && npm run lint
```

---

## Reference

- [TypeScript Strict Mode](https://www.typescriptlang.org/tsconfig#strict)
- [TSConfig Reference](https://www.typescriptlang.org/tsconfig)
- [TypeScript Handbook - Type Checking](https://www.typescriptlang.org/docs/handbook/type-checking-javascript-files.html)
