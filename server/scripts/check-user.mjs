import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const id = process.env.TEST_USER_ID
  if (!id) { console.error('Set TEST_USER_ID'); process.exit(1) }
  const u = await prisma.user.findUnique({ where: { id } })
  console.log('found user:', u)
}

main().catch(e=>{console.error(e);process.exit(1)})
