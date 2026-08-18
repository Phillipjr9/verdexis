import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@verdexisgroup.com';
  const password = 'Admin@Verdexis2024';
  const name = 'Super Admin';

  console.log(`[CreateSuperAdmin] Creating super admin: ${email}`);

  // Delete if exists
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`[CreateSuperAdmin] Deleting existing user: ${email}`);
    await prisma.user.delete({ where: { id: existing.id } });
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Create user with admin role
  const user = await prisma.user.create({
    data: {
      email,
      name,
      username: 'superadmin',
      role: 'admin',
      password: hashedPassword,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      twoFactor: false,
    },
  });

  console.log(`[CreateSuperAdmin] User created: ${user.id}`);

  // Create wallet balance with 1T USD
  const ADMIN_TREASURY_USD = 1_000_000_000_000;
  const wallet = await prisma.walletBalance.create({
    data: {
      userId: user.id,
      currency: 'USD',
      symbol: 'USD',
      balance: ADMIN_TREASURY_USD,
      available: ADMIN_TREASURY_USD,
    },
  });

  console.log(`[CreateSuperAdmin] Wallet created with ${ADMIN_TREASURY_USD} USD`);

  // Create a system transaction for the treasury seed
  await prisma.transaction.create({
    data: {
      transactionId: `admin_seed_${Date.now()}`,
      userId: user.id,
      kind: 'deposit',
      currency: 'USD',
      amount: ADMIN_TREASURY_USD,
      status: 'completed',
      reference: 'Admin treasury seed',
      subType: 'treasury_seed',
    },
  });

  console.log(`[CreateSuperAdmin] ✅ Super admin setup complete!`);
  console.log(`Email: ${email}`);
  console.log(`Password: ${password}`);
  console.log(`Balance: $${ADMIN_TREASURY_USD.toLocaleString('en-US')}`);
  console.log(`User ID: ${user.id}`);
}

main()
  .catch((err) => {
    console.error('[CreateSuperAdmin] Error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
