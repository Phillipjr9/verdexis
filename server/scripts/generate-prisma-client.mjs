import 'dotenv/config'
import { spawnSync } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const provider = (process.env.DATABASE_PROVIDER || 'postgresql').toLowerCase()
const envs = { ...process.env }
const schemaBase = path.resolve('prisma', 'schema.prisma')
let schemaFile = schemaBase
const isPostgresUrl = (value) => typeof value === 'string' && /^postgres(?:ql)?:\/\//i.test(value)
const isSqliteUrl = (value) => typeof value === 'string' && /^(file:|sqlite:)/i.test(value)

const normalizeEnvValue = (value) => {
  if (typeof value !== 'string') return value
  return value.trim().replace(/^['"]|['"]$/g, '')
}

envs.DATABASE_URL = normalizeEnvValue(envs.DATABASE_URL)
envs.DIRECT_URL = normalizeEnvValue(envs.DIRECT_URL) || envs.DATABASE_URL

if (provider === 'sqlite') {
  if (!isSqliteUrl(envs.DATABASE_URL)) {
    console.warn('[generate-prisma-client] DATABASE_URL is not a valid SQLite URL; defaulting to file:./dev.db')
    envs.DATABASE_URL = 'file:./dev.db'
  }
  envs.DIRECT_URL = envs.DIRECT_URL || envs.DATABASE_URL
  const source = await readFile(schemaBase, 'utf8')
  let sqliteSchema = source.replace(/datasource\s+db\s*{[\s\S]*?provider\s*=\s*"[^"]+"/, (block) => block.replace(/provider\s*=\s*"[^"]+"/, 'provider = "sqlite"'))
  sqliteSchema = sqliteSchema.replace(/(\s+\w+\s+)String\[\](\s+@default\(([^)]*)\))?/g, (match, prefix, defaultAttr, defaultValue) => {
    if (defaultAttr && typeof defaultValue === 'string') {
      const escaped = defaultValue.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
      return `${prefix}String @default("${escaped}")`
    }
    return `${prefix}String @default("[]")`
  })
  schemaFile = path.resolve('prisma', 'schema.sqlite.prisma')
  await writeFile(schemaFile, sqliteSchema, 'utf8')
} else {
  const normalizedDatabaseUrl = normalizeEnvValue(envs.DATABASE_URL)
  if (!normalizedDatabaseUrl || !isPostgresUrl(normalizedDatabaseUrl)) {
    console.warn('[generate-prisma-client] DATABASE_URL is not set or invalid for Postgres; defaulting to local SQLite for build')
    envs.DATABASE_URL = 'file:./dev.db'
    envs.DATABASE_PROVIDER = 'sqlite'
  } else {
    envs.DATABASE_URL = normalizedDatabaseUrl
  }
}

const spawnPrisma = (args) => {
  const result = spawnSync('npx', ['prisma', ...args], { stdio: 'inherit', shell: true, env: envs })
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

spawnPrisma(['generate', '--schema', schemaFile])

if (provider === 'sqlite') {
  spawnPrisma(['db', 'push', '--schema', schemaFile])
}
