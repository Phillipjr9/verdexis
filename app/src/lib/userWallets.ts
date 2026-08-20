// Admin-managed PER-USER deposit / fee-payment instructions.
// User-generated saved wallets fill ETH/ERC-20 only when the admin has not set those assets.

const STORAGE_KEY = 'verdexis_user_wallets_v1'
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
  beneficiaryAddress?: string
  bankName: string
  bankAddress?: string
  routingNumber?: string
  swiftCode?: string
  iban?: string
  accountNumber: string
  reference?: string
  notes?: string
  /** When true/undefined, ACH deposit tab also shows these bank details. */
  showForAch?: boolean
}

export interface UserWalletOverride {
  cryptos: Record<string, UserCryptoOverride>
  wire?: UserWireOverride
  notes?: string
  updatedAt?: string
}

type Store = Record<string, UserWalletOverride>

function read(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return typeof parsed === 'object' && parsed ? parsed as Store : {}
  } catch {
    return {}
  }
}

function write(s: Store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  window.dispatchEvent(new Event(USER_WALLETS_EVENT))
}

function key(emailOrId: string): string {
  return (emailOrId || '').trim().toLowerCase()
}

export const userWallets = {
  get(emailOrId: string): UserWalletOverride | null {
    const k = key(emailOrId)
    if (!k) return null
    return read()[k] || null
  },
  set(emailOrId: string, override: UserWalletOverride): void {
    const k = key(emailOrId)
    if (!k) return
    const s = read()
    s[k] = { ...override, updatedAt: new Date().toISOString() }
    write(s)
  },
  remove(emailOrId: string): void {
    const k = key(emailOrId)
    if (!k) return
    const s = read()
    delete s[k]
    write(s)
  },
  all(): Store { return read() },
  cache(emailOrId: string, override: UserWalletOverride | null): void {
    const k = key(emailOrId)
    if (!k) return
    const s = read()
    if (override) s[k] = override
    else delete s[k]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
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
      addresses = (res.addresses as UserWalletOverride | null) ?? null
    }

    try {
      const saved = await api.getSavedWallet()
      const addr = saved.wallet?.address?.trim()
      if (addr) {
        const cryptos = { ...(addresses?.cryptos || {}) }
        if (!cryptos.ETH?.address) {
          cryptos.ETH = { currency: 'ETH', network: 'Ethereum', address: addr }
        }
        if (!cryptos.USDC?.address) {
          cryptos.USDC = { currency: 'USDC', network: 'ERC-20', address: addr }
        }
        if (!cryptos.USDT?.address) {
          cryptos.USDT = { currency: 'USDT', network: 'ERC-20', address: addr }
        }
        addresses = { cryptos, wire: addresses?.wire, notes: addresses?.notes, updatedAt: addresses?.updatedAt }
      }
    } catch {
      /* saved wallet is optional */
    }
    if (opts.email) userWallets.cache(opts.email, addresses)
    if (opts.userId) userWallets.cache(opts.userId, addresses)
    window.dispatchEvent(new Event(USER_WALLETS_EVENT))
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
