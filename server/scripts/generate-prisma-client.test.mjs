import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolvePrismaGenerationConfig } from './prisma-config.mjs'

const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

test('keeps Postgres Prisma generation when DATABASE_PROVIDER is postgresql even if DATABASE_URL is absent at build time', async () => {
  const result = await resolvePrismaGenerationConfig({
    env: {
      DATABASE_PROVIDER: 'postgresql',
      DATABASE_URL: '',
    },
    cwd: serverDir,
    logger: () => {},
  })

  assert.equal(result.provider, 'postgresql')
  assert.equal(result.shouldUseSqlite, false)
  assert.equal(result.envs.DATABASE_PROVIDER, 'postgresql')
  assert.equal(result.envs.DATABASE_URL, '')
  assert.equal(result.schemaFile, path.join(serverDir, 'prisma', 'schema.prisma'))
})

test('falls back to sqlite and enables db push when the postgres URL is invalid', async () => {
  const result = await resolvePrismaGenerationConfig({
    env: {
      DATABASE_PROVIDER: 'postgresql',
      DATABASE_URL: 'not-a-postgres-url',
    },
    cwd: serverDir,
    logger: () => {},
  })

  assert.equal(result.provider, 'sqlite')
  assert.equal(result.shouldUseSqlite, true)
  assert.equal(result.envs.DATABASE_PROVIDER, 'sqlite')
  assert.equal(result.envs.DATABASE_URL, 'file:./dev.db')
  assert.equal(result.schemaFile, path.join(serverDir, 'prisma', 'schema.sqlite.prisma'))
})
