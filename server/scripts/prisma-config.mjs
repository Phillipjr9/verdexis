import { readFile } from 'node:fs/promises'
import path from 'node:path'

const isPostgresUrl = (value) => typeof value === 'string' && /^postgres(?:ql)?:\/\//i.test(value)
const isSqliteUrl = (value) => typeof value === 'string' && /^(file:|sqlite:)/i.test(value)

const normalizeEnvValue = (value) => {
  if (typeof value !== 'string') return value
  return value.trim().replace(/^['"]|['"]$/g, '')
}

export async function resolvePrismaGenerationConfig({ env, cwd, logger = () => {} }) {
  const provider = (env.DATABASE_PROVIDER || 'postgresql').toLowerCase()
  const envs = { ...env }
  const schemaBase = path.resolve(cwd, 'prisma', 'schema.prisma')
  let schemaFile = schemaBase

  envs.DATABASE_URL = normalizeEnvValue(envs.DATABASE_URL)
  envs.DIRECT_URL = normalizeEnvValue(envs.DIRECT_URL) || envs.DATABASE_URL

  let shouldUseSqlite = false

  if (provider === 'sqlite') {
    shouldUseSqlite = true
    if (!isSqliteUrl(envs.DATABASE_URL)) {
      logger('[generate-prisma-client] DATABASE_URL is not a valid SQLite URL; defaulting to file:./dev.db')
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
    schemaFile = path.resolve(cwd, 'prisma', 'schema.sqlite.prisma')
    return { provider: 'sqlite', shouldUseSqlite, envs, schemaFile, sqliteSchema }
  }

  const normalizedDatabaseUrl = normalizeEnvValue(envs.DATABASE_URL)
  if (!normalizedDatabaseUrl || !isPostgresUrl(normalizedDatabaseUrl)) {
    logger('[generate-prisma-client] DATABASE_URL is not set or invalid for Postgres; defaulting to local SQLite for build')
    envs.DATABASE_URL = 'file:./dev.db'
    envs.DATABASE_PROVIDER = 'sqlite'
    shouldUseSqlite = true
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
    schemaFile = path.resolve(cwd, 'prisma', 'schema.sqlite.prisma')
    return { provider: 'sqlite', shouldUseSqlite, envs, schemaFile, sqliteSchema }
  }

  envs.DATABASE_URL = normalizedDatabaseUrl
  return { provider, shouldUseSqlite, envs, schemaFile }
}
