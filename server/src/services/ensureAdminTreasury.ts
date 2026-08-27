import { prisma } from '../db.js'

/** Default admin USD treasury ceiling used for display / seeding. */
export const ADMIN_TREASURY_USD = 1_000_000_000_000

export type AdminTreasuryBalances = {
  balance: number
  available: number
  balanceMinorUnits: string
  availableMinorUnits: string
  seeded: boolean
}

/**
 * Ensure an admin user has a USD wallet balance at the treasury target.
 * Safe to call repeatedly; only writes when missing or force=true.
 */
export async function ensureAdminTreasury(
  userId: string,
  opts: { force?: boolean } = {},
): Promise<AdminTreasuryBalances> {
  const force = opts.force === true
  const existing = await prisma.walletBalance.findUnique({
    where: { userId_currency: { userId, currency: 'USD' } },
  })

  const currentAvail = existing ? Number(existing.available) : 0
  const currentBal = existing ? Number(existing.balance) : 0

  if (!force && existing && currentAvail >= ADMIN_TREASURY_USD * 0.5) {
    return {
      balance: currentBal,
      available: currentAvail,
      balanceMinorUnits: String(Math.round(currentBal * 100)),
      availableMinorUnits: String(Math.round(currentAvail * 100)),
      seeded: false,
    }
  }

  const target = ADMIN_TREASURY_USD
  const row = await prisma.walletBalance.upsert({
    where: { userId_currency: { userId, currency: 'USD' } },
    create: {
      userId,
      currency: 'USD',
      symbol: '$',
      balance: target,
      available: target,
      balanceMinorUnits: BigInt(Math.round(target * 100)),
      availableMinorUnits: BigInt(Math.round(target * 100)),
    },
    update: {
      balance: target,
      available: target,
      balanceMinorUnits: BigInt(Math.round(target * 100)),
      availableMinorUnits: BigInt(Math.round(target * 100)),
      symbol: '$',
    },
  })

  return {
    balance: Number(row.balance),
    available: Number(row.available),
    balanceMinorUnits: String(Math.round(Number(row.balance) * 100)),
    availableMinorUnits: String(Math.round(Number(row.available) * 100)),
    seeded: true,
  }
}
