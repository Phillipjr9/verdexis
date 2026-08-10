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

if (sqliteSchema) {
  await writeFile(schemaFile, sqliteSchema, 'utf8')
}

const spawnPrisma = (args) => {
  const result = spawnSync('npx', ['prisma', ...args], { stdio: 'inherit', shell: true, env: envs })
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

spawnPrisma(['generate', '--schema', schemaFile])

if (shouldUseSqlite) {
  spawnPrisma(['db', 'push', '--schema', schemaFile])
}
