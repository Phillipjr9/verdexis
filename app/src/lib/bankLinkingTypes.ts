/**
 * UPDATED BANK LINKING SYSTEM
 * 
 * RESTRICTIONS:
 * - Users can NO LONGER link their own banks
 * - Super admin ONLY can input bank information for users
 * - Users can ONLY see/use pre-configured withdrawal methods:
 *   1. ACH (if admin configured it for them)
 *   2. Wire transfer (if admin configured it for them)
 *   3. Crypto withdrawal (if admin configured crypto addresses)
 * 
 * FLOW:
 * 1. Super admin goes to user detail page → Wallet → Personal payment destinations
 * 2. Admin enters wire details OR assigns ACH account from a system account
 * 3. User sees read-only withdrawal methods (no linking interface)
 * 4. User can only withdraw to what admin configured
 */

import { z } from 'zod'

// Shared types used by both frontend and backend
export interface AdminBankAccount {
  id: string
  institution: string
  accountHolder: string
  type: 'checking' | 'savings'
  routingNumber: string
  accountMask: string
  status: 'verified' | 'pending' | 'failed'
  linkedAt: string
}

// What super admin can assign to a user for ACH withdrawals
export interface UserAchDestination {
  bankAccountId: string // References an admin-managed bank account
  bankName: string
  accountMask: string
  institution: string
  verified: boolean
}

// What super admin can assign for wire transfers
export interface UserWireDestination {
  beneficiaryName: string
  bankName: string
  accountNumber: string
  routingNumber: string
  swiftCode?: string
  iban?: string
  reference?: string
}

// Type definitions for API
export const adminBankAccountSchema = z.object({
  id: z.string(),
  institution: z.string(),
  accountHolder: z.string(),
  type: z.enum(['checking', 'savings']),
  routingNumber: z.string(),
  accountMask: z.string(),
  status: z.enum(['verified', 'pending', 'failed']),
  linkedAt: z.string(),
})

export const userAchDestinationSchema = z.object({
  bankAccountId: z.string(),
  bankName: z.string(),
  accountMask: z.string(),
  institution: z.string(),
  verified: z.boolean(),
})

export const userWireDestinationSchema = z.object({
  beneficiaryName: z.string().min(1),
  bankName: z.string().min(1),
  accountNumber: z.string().min(4),
  routingNumber: z.string().min(9).max(9),
  swiftCode: z.string().optional(),
  iban: z.string().optional(),
  reference: z.string().optional(),
})

// What users see when withdrawing (READ-ONLY)
export interface UserWithdrawalOptions {
  crypto: {
    enabled: boolean
    currencies: string[]
  }
  ach: {
    enabled: boolean
    account?: UserAchDestination
  }
  wire: {
    enabled: boolean
    details?: UserWireDestination
  }
}
