import 'dotenv/config'
import { spawnSync } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { resolvePrismaGenerationConfig } from './prisma-config.mjs'

const cwd = process.cwd()
const config = await resolvePrismaGenerationConfig({
  env: process.env,
  cwd,
  logger: (message) => console.warn(message),
})

const { envs, schemaFile, shouldUseSqlite, sqliteSchema } = config

console.warn('[generate-prisma-client] resolved config:', { shouldUseSqlite, schemaFile, hasSqliteSchema: !!sqliteSchema })
console.warn('[generate-prisma-client] sample envs keys:', Object.keys(envs).slice(0,20))

if (sqliteSchema) {
  await writeFile(schemaFile, sqliteSchema, 'utf8')
}

const spawnPrisma = (args) => {
  const result = spawnSync('npx', ['prisma', ...args], { stdio: 'inherit', shell: true, env: envs })
  if (result.status !== 0) {
    console.warn('[generate-prisma-client] prisma command failed with status', result.status, ' — continuing for local dev')
    return false
  }
  return true
}

try {
  spawnPrisma(['generate', '--schema', schemaFile])
} catch (err) {
  console.error('prisma generate failed:', err && err.stack ? err.stack : err)
  process.exit(1)
}

if (shouldUseSqlite) {
  spawnPrisma(['db', 'push', '--schema', schemaFile])
}
