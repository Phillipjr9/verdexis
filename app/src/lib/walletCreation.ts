/**
 * Wallet Creation Service
 * 
 * Allows users to create their own Ethereum wallets within Verdexis.
 * This replaces the Flutter demo with real TypeScript implementation.
 */

import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from 'bip39'
import { HDKey } from '@scure/bip32'
import { bytesToHex } from '@noble/hashes/utils'
import { Wallet } from 'ethers'

export interface WalletCreationResult {
  mnemonic: string
  privateKey: string
  address: string
  publicKey: string
}

export interface ImportedWallet {
  address: string
  privateKey: string
  publicKey: string
}

/**
 * Generate a new Ethereum wallet with BIP39 mnemonic
 */
export function generateWallet(): WalletCreationResult {
  // Generate 12-word mnemonic
  const mnemonic = generateMnemonic(128) // 128 bits = 12 words
  
  // Derive seed from mnemonic
  const seed = mnemonicToSeedSync(mnemonic)
  
  // Derive Ethereum key using BIP44 path: m/44'/60'/0'/0/0
  const hdKey = HDKey.fromMasterSeed(seed)
  const derivedKey = hdKey.derive("m/44'/60'/0'/0/0")
  
  if (!derivedKey.privateKey) {
    throw new Error('Failed to derive private key')
  }
  
  const privateKey = bytesToHex(derivedKey.privateKey)
  const wallet = new Wallet(privateKey)
  
  return {
    mnemonic,
    privateKey: `0x${privateKey}`,
    address: wallet.address,
    publicKey: wallet.publicKey,
  }
}

/**
 * Import wallet from mnemonic phrase
 */
export function importFromMnemonic(mnemonic: string): ImportedWallet {
  const cleanMnemonic = mnemonic.trim().toLowerCase()
  
  if (!validateMnemonic(cleanMnemonic)) {
    throw new Error('Invalid mnemonic phrase')
  }
  
  const seed = mnemonicToSeedSync(cleanMnemonic)
  const hdKey = HDKey.fromMasterSeed(seed)
  const derivedKey = hdKey.derive("m/44'/60'/0'/0/0")
  
  if (!derivedKey.privateKey) {
    throw new Error('Failed to derive private key')
  }
  
  const privateKey = bytesToHex(derivedKey.privateKey)
  const wallet = new Wallet(privateKey)
  
  return {
    address: wallet.address,
    privateKey: `0x${privateKey}`,
    publicKey: wallet.publicKey,
  }
}

/**
 * Import wallet from private key
 */
export function importFromPrivateKey(privateKey: string): ImportedWallet {
  try {
    const cleanKey = privateKey.trim()
    const wallet = new Wallet(cleanKey)
    
    return {
      address: wallet.address,
      privateKey: wallet.privateKey,
      publicKey: wallet.publicKey,
    }
  } catch (error) {
    throw new Error('Invalid private key')
  }
}

/**
 * Validate Ethereum address
 */
export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

/**
 * Mask sensitive data for display
 */
export function maskPrivateKey(privateKey: string): string {
  if (privateKey.length < 16) return '***'
  return `${privateKey.substring(0, 8)}...${privateKey.substring(privateKey.length - 8)}`
}

export function maskMnemonic(mnemonic: string): string {
  const words = mnemonic.split(' ')
  if (words.length < 4) return '***'
  return `${words[0]} ${words[1]} ... ${words[words.length - 2]} ${words[words.length - 1]}`
}

/**
 * Secure storage key names
 */
export const STORAGE_KEYS = {
  ENCRYPTED_WALLET: 'verdexis_encrypted_wallet',
  WALLET_ADDRESS: 'verdexis_wallet_address',
  HAS_WALLET: 'verdexis_has_wallet',
} as const

/**
 * Simple encryption for browser storage (NOT production-grade, use proper encryption in production)
 * For production, use Web Crypto API or a proper encryption library
 */
export async function encryptData(data: string, password: string): Promise<string> {
  // WARNING: This is a simple XOR cipher for demonstration
  // In production, use proper encryption like AES-GCM via Web Crypto API
  const encoder = new TextEncoder()
  const dataBytes = encoder.encode(data)
  const passwordBytes = encoder.encode(password)
  
  const encrypted = new Uint8Array(dataBytes.length)
  for (let i = 0; i < dataBytes.length; i++) {
    encrypted[i] = dataBytes[i] ^ passwordBytes[i % passwordBytes.length]
  }
  
  return btoa(String.fromCharCode(...encrypted))
}

export async function decryptData(encrypted: string, password: string): Promise<string> {
  try {
    const encoder = new TextEncoder()
    const decoder = new TextDecoder()
    const passwordBytes = encoder.encode(password)
    
    const encryptedBytes = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0))
    const decrypted = new Uint8Array(encryptedBytes.length)
    
    for (let i = 0; i < encryptedBytes.length; i++) {
      decrypted[i] = encryptedBytes[i] ^ passwordBytes[i % passwordBytes.length]
    }
    
    return decoder.decode(decrypted)
  } catch (error) {
    throw new Error('Decryption failed - incorrect password or corrupted data')
  }
}

/**
 * Save encrypted wallet to localStorage
 */
export async function saveWalletToStorage(
  privateKey: string,
  password: string
): Promise<void> {
  const encrypted = await encryptData(privateKey, password)
  const wallet = new Wallet(privateKey)
  
  localStorage.setItem(STORAGE_KEYS.ENCRYPTED_WALLET, encrypted)
  localStorage.setItem(STORAGE_KEYS.WALLET_ADDRESS, wallet.address)
  localStorage.setItem(STORAGE_KEYS.HAS_WALLET, 'true')
}

/**
 * Load wallet from localStorage
 */
export async function loadWalletFromStorage(password: string): Promise<ImportedWallet> {
  const encrypted = localStorage.getItem(STORAGE_KEYS.ENCRYPTED_WALLET)
  if (!encrypted) {
    throw new Error('No wallet found in storage')
  }
  
  const privateKey = await decryptData(encrypted, password)
  return importFromPrivateKey(privateKey)
}

/**
 * Check if user has a saved wallet
 */
export function hasSavedWallet(): boolean {
  return localStorage.getItem(STORAGE_KEYS.HAS_WALLET) === 'true'
}

/**
 * Get saved wallet address (without unlocking)
 */
export function getSavedWalletAddress(): string | null {
  return localStorage.getItem(STORAGE_KEYS.WALLET_ADDRESS)
}

/**
 * Clear wallet from storage
 */
export function clearWalletFromStorage(): void {
  localStorage.removeItem(STORAGE_KEYS.ENCRYPTED_WALLET)
  localStorage.removeItem(STORAGE_KEYS.WALLET_ADDRESS)
  localStorage.removeItem(STORAGE_KEYS.HAS_WALLET)
}
