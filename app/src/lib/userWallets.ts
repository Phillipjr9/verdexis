// Per-user deposit / fee-payment instructions. Database is the source of truth.

export const USER_WALLETS_EVENT = 'verdexis:userWallets'

export interface UserCryptoOverride {
  currency: string
  network: string
  address: string
  memo?: string
  notes?: string
}

export interface UserWireOverride {
  beneficiaryName: string
  bankName: string
  routingNumber?: string
  swiftCode?: string
  accountNumber: string
  reference?: string
  notes?: string
}

export interface UserWalletOverride {
  cryptos: Record<string, UserCryptoOverride>
  wire?: UserWireOverride
  notes?: string
  updatedAt?: string
}

type Store = Record<string, UserWalletOverride>
let memory: Store = {}

function emit() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(USER_WALLETS_EVENT))
}

function key(emailOrId: string): string {
  return (emailOrId || '').trim().toLowerCase()
}

export const userWallets = {
  get(emailOrId: string): UserWalletOverride | null {
    const k = key(emailOrId)
    if (!k) return null
    return memory[k] || null
  },
  set(emailOrId: string, override: UserWalletOverride): void {
    const k = key(emailOrId)
    if (!k) return
    memory[k] = { ...override, updatedAt: new Date().toISOString() }
    emit()
  },
  remove(emailOrId: string): void {
    const k = key(emailOrId)
    if (!k) return
    delete memory[k]
    emit()
  },
  all(): Store {
    return { ...memory }
  },
  cache(emailOrId: string, override: UserWalletOverride | null): void {
    const k = key(emailOrId)
    if (!k) return
    if (override) memory[k] = override
    else delete memory[k]
  },
}

export async function hydrateUserWalletsFromServer(opts: {
  email?: string
  userId?: string
  admin?: boolean
}): Promise<UserWalletOverride | null> {
  try {
    const { api } = await import('./api')
    let addresses: UserWalletOverride | null = null
    if (opts.admin && opts.userId) {
      const { adminApi } = await import('./adminApi')
      const res = await adminApi.getUserDepositAddresses(opts.userId)
      addresses = (res.addresses as UserWalletOverride | null) ?? null
    } else {
      const res = await api.getMyDepositAddresses()
      addresses = ((res as { addresses?: UserWalletOverride | null }).addresses) ?? null
    }
    if (opts.email) userWallets.cache(opts.email, addresses)
    if (opts.userId) userWallets.cache(opts.userId, addresses)
    emit()
    return addresses
  } catch {
    return null
  }
}

export async function pushUserWalletsToServer(
  userId: string,
  override: UserWalletOverride,
): Promise<UserWalletOverride | null> {
  try {
    const { adminApi } = await import('./adminApi')
    const res = await adminApi.setUserDepositAddresses(userId, override)
    return (res.addresses as UserWalletOverride | null) ?? null
  } catch {
    return null
  }
}
