import 'dotenv/config'
import { spawnSync } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const provider = (process.env.DATABASE_PROVIDER || 'postgresql').toLowerCase()
const envs = { ...process.env }
const schemaBase = path.resolve('prisma', 'schema.prisma')
let schemaFile = schemaBase

if (provider === 'sqlite') {
  envs.DATABASE_URL = envs.DATABASE_URL || 'file:./dev.db'
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
  envs.DATABASE_URL = envs.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/verdexis'
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
