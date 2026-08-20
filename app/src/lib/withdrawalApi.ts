/**
 * Withdrawal helpers for the recommended flow:
 * Admin configures destinations; user picks method + amount.
 */
import { api, newIdempotencyKey } from './api'

export type WithdrawalMethod =
  | 'crypto'
  | 'wire'
  | 'ach'
  | 'check'
  | 'cashier_check'
  | 'wire_check'

export interface WithdrawalOptions {
  crypto: { enabled: boolean; currencies: string[] }
  ach: {
    enabled: boolean
    account?: { bankName: string; accountMask: string; institution: string; verified: boolean }
  }
  wire: {
    enabled: boolean
    details?: {
      beneficiaryName: string
      bankName: string
      accountMask?: string
      routingMask?: string
      swiftCode?: string
      reference?: string
    }
  }
  check: {
    enabled: boolean
    types: Array<'cashier_check' | 'wire_check'>
    details?: {
      payeeName: string
      mailingAddress?: {
        line1: string
        line2?: string
        city: string
        state: string
        postalCode: string
        country?: string
      }
      notes?: string
    }
  }
}

export async function getWithdrawalOptions(): Promise<WithdrawalOptions> {
  return api.get<WithdrawalOptions>('/api/withdrawal-options')
}

export async function requestWithdrawal(payload: {
  amount: number
  asset: string
  withdrawalMethod: WithdrawalMethod
  destinationAddress?: string
  chain?: string
  tokenAddress?: string
  memo?: string
  checkType?: 'cashier_check' | 'wire_check'
}) {
  return api.post<{
    withdrawal: unknown
    transfer: { status: string; message: string; txHash?: string | null }
    method?: string
    processingFee?: number
    totalDebit?: number
  }>('/api/withdrawals', payload, { idempotencyKey: newIdempotencyKey() })
}
