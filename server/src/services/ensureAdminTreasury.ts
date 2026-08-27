import { prisma } from '../db.js'

/** Default admin USD treasury ceiling used when first seeding a missing wallet. */
export const ADMIN_TREASURY_USD = 1_000_000_000_000

export type AdminTreasuryBalances = {
  balance: number
  available: number
  balanceMinorUnits: string
  availableMinorUnits: string
  seeded: boolean
}

/**
 * Ensure an admin user has a USD wallet row.
 *
 * CRITICAL: never overwrite an existing balance. Previously `force: true` (and
 * low-balance thresholds) reset the admin wallet back to ADMIN_TREASURY_USD,
 * which made admin transfers appear not to reduce admin funds.
 *
 * - Missing wallet → seed to ADMIN_TREASURY_USD once
 * - Existing wallet → return as-is (force is ignored for overwrites)
 */
export async function ensureAdminTreasury(
  userId: string,
  _opts: { force?: boolean } = {},
): Promise<AdminTreasuryBalances> {
  const existing = await prisma.walletBalance.findUnique({
    where: { userId_currency: { userId, currency: 'USD' } },
  })

  if (existing) {
    const currentAvail = Number(existing.available)
    const currentBal = Number(existing.balance)
    return {
      balance: currentBal,
      available: currentAvail,
      balanceMinorUnits: String(Math.round(currentBal * 100)),
      availableMinorUnits: String(Math.round(currentAvail * 100)),
      seeded: false,
    }
  }

  const target = ADMIN_TREASURY_USD
  const row = await prisma.walletBalance.create({
    data: {
      userId,
      currency: 'USD',
      symbol: '$',
      balance: target,
      available: target,
      balanceMinorUnits: BigInt(Math.round(target * 100)),
      availableMinorUnits: BigInt(Math.round(target * 100)),
    },
  })

  await prisma.accountBalance
    .upsert({
      where: { userId_asset: { userId, asset: 'USD' } },
      create: {
        userId,
        asset: 'USD',
        balanceMinorUnits: BigInt(Math.round(target * 100)),
        availableMinorUnits: BigInt(Math.round(target * 100)),
        lockedMinorUnits: 0n,
        pendingMinorUnits: 0n,
      },
      update: {},
    })
    .catch(() => null)

  return {
    balance: Number(row.balance),
    available: Number(row.available),
    balanceMinorUnits: String(Math.round(Number(row.balance) * 100)),
    availableMinorUnits: String(Math.round(Number(row.available) * 100)),
    seeded: true,
  }
}
