// Admin-managed deposit instructions. Database is the source of truth.

import { api } from './api'

export const DEPOSIT_INSTRUCTIONS_EVENT = 'verdexis:depositInstructions'

export interface WireInstruction {
  label: string
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
}

export interface CryptoWallet {
  currency: string
  network: string
  address: string
  memo?: string
  notes?: string
}

export interface Web3Payout {
  label: string
  chainId: string
  address: string
  notes?: string
}

export interface DepositInstructions {
  wires: Record<string, WireInstruction>
  cryptos: Record<string, CryptoWallet>
  web3: Record<string, Web3Payout>
}

let memory: DepositInstructions = { wires: {}, cryptos: {}, web3: {} }

function emit() {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(DEPOSIT_INSTRUCTIONS_EVENT))
}

function write(next: DepositInstructions): void {
  memory = {
    wires: next.wires ?? {},
    cryptos: next.cryptos ?? {},
    web3: next.web3 ?? {},
  }
  emit()
}

export async function hydrateFromServer(): Promise<boolean> {
  try {
    const { instructions } = await api.getDepositInstructions() as { instructions?: Partial<DepositInstructions> }
    if (!instructions || typeof instructions !== 'object') return false
    write({
      wires: instructions.wires ?? {},
      cryptos: instructions.cryptos ?? {},
      web3: instructions.web3 ?? {},
    })
    return true
  } catch {
    return false
  }
}

export async function pushToServer(): Promise<boolean> {
  try {
    await api.putDepositInstructions(memory)
    return true
  } catch {
    return false
  }
}

export const depositInstructions = {
  all(): DepositInstructions {
    return memory
  },
  getWire(currency: string): WireInstruction | null {
    return memory.wires[currency.toUpperCase()] ?? null
  },
  getCrypto(currency: string): CryptoWallet | null {
    return memory.cryptos[currency.toUpperCase()] ?? null
  },
  setWire(currency: string, info: WireInstruction): void {
    write({ ...memory, wires: { ...memory.wires, [currency.toUpperCase()]: info } })
  },
  removeWire(currency: string): void {
    const wires = { ...memory.wires }
    delete wires[currency.toUpperCase()]
    write({ ...memory, wires })
  },
  setCrypto(currency: string, info: CryptoWallet): void {
    write({ ...memory, cryptos: { ...memory.cryptos, [currency.toUpperCase()]: info } })
  },
  removeCrypto(currency: string): void {
    const cryptos = { ...memory.cryptos }
    delete cryptos[currency.toUpperCase()]
    write({ ...memory, cryptos })
  },
  getWeb3Payout(chainId: string | null | undefined): Web3Payout | null {
    if (chainId) {
      const hit = memory.web3[chainId.toLowerCase()]
      if (hit) return hit
    }
    return memory.web3.default ?? null
  },
  listWeb3Payouts(): Web3Payout[] {
    return Object.values(memory.web3)
  },
  setWeb3Payout(info: Web3Payout): void {
    const key = (info.chainId || 'default').toLowerCase()
    write({ ...memory, web3: { ...memory.web3, [key]: { ...info, chainId: key } } })
  },
  removeWeb3Payout(chainId: string): void {
    const web3 = { ...memory.web3 }
    delete web3[chainId.toLowerCase()]
    write({ ...memory, web3 })
  },
}

export function onDepositInstructionsChanged(cb: () => void): () => void {
  const handler = () => cb()
  if (typeof window === 'undefined') return () => {}
  window.addEventListener(DEPOSIT_INSTRUCTIONS_EVENT, handler)
  return () => window.removeEventListener(DEPOSIT_INSTRUCTIONS_EVENT, handler)
}

export function isAdmin(): boolean {
  return false
}

export function setAdmin(_on: boolean): void {}
