import test from 'node:test'
import assert from 'node:assert/strict'

import { buildExternalWalletTransferMessage, buildTemporaryFundingTransferResult, buildWithdrawalTransferPlan, detectWalletAddressType, executeCryptoWithdrawal, resolveWithdrawalChain } from '../src/services/cryptoWithdrawal.js'

test('buildWithdrawalTransferPlan maps native SOL withdrawals to Solana', () => {
  const plan = buildWithdrawalTransferPlan({
    asset: 'SOL',
    amount: 1.25,
    destinationAddress: 'So11111111111111111111111111111111111111112',
    chain: 'solana',
  })

  assert.equal(plan.chain, 'solana')
  assert.equal(plan.isNative, true)
  assert.equal(plan.tokenAddress, undefined)
  assert.equal(plan.amount, 1.25)
})

test('buildWithdrawalTransferPlan uses a configured token mint for SPL transfers', () => {
  const plan = buildWithdrawalTransferPlan({
    asset: 'USDC',
    amount: 12.5,
    destinationAddress: 'So11111111111111111111111111111111111111112',
    chain: 'solana',
    tokenAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  })

  assert.equal(plan.chain, 'solana')
  assert.equal(plan.isNative, false)
  assert.equal(plan.tokenAddress, 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')
  assert.equal(plan.amount, 12.5)
})

test('buildWithdrawalTransferPlan maps known Ethereum tokens to ERC20 transfers', () => {
  const plan = buildWithdrawalTransferPlan({
    asset: 'USDC',
    amount: 42,
    destinationAddress: '0x1234567890123456789012345678901234567890',
    chain: 'ethereum',
  })

  assert.equal(plan.chain, 'ethereum')
  assert.equal(plan.isNative, false)
  assert.equal(plan.tokenAddress, '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48')
  assert.equal(plan.amount, 42)
})

test('buildWithdrawalTransferPlan maps known Ethereum USDT transfers to ERC20 transfers', () => {
  const plan = buildWithdrawalTransferPlan({
    asset: 'USDT',
    amount: 123.45,
    destinationAddress: '0x1234567890123456789012345678901234567890',
    chain: 'ethereum',
  })

  assert.equal(plan.chain, 'ethereum')
  assert.equal(plan.isNative, false)
  assert.equal(plan.tokenAddress, '0xdAC17F958D2ee523a2206206994597C13D831ec7')
  assert.equal(plan.decimals, 6)
  assert.equal(plan.amount, 123.45)
})

test('buildWithdrawalTransferPlan maps known Solana USDT transfers to SPL transfers', () => {
  const plan = buildWithdrawalTransferPlan({
    asset: 'USDT',
    amount: 10,
    destinationAddress: 'So11111111111111111111111111111111111111112',
    chain: 'solana',
  })

  assert.equal(plan.chain, 'solana')
  assert.equal(plan.isNative, false)
  assert.equal(plan.tokenAddress, 'Es9vMFrzaCERp2c2ZrK4kG4k6JWpFJ2XfcSv7ki7a9')
  assert.equal(plan.decimals, 6)
  assert.equal(plan.amount, 10)
})

test('detectWalletAddressType detects Ethereum, Solana, and Bitcoin style addresses', () => {
  assert.equal(detectWalletAddressType('0x1234567890123456789012345678901234567890'), 'ethereum')
  assert.equal(detectWalletAddressType('So11111111111111111111111111111111111111112'), 'solana')
  assert.equal(detectWalletAddressType('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4'), 'bitcoin')
  assert.equal(detectWalletAddressType('not-a-wallet'), 'unknown')
})

test('resolveWithdrawalChain infers the supported chain from the destination address', () => {
  const resolved = resolveWithdrawalChain({
    asset: 'USDC',
    destinationAddress: 'So11111111111111111111111111111111111111112',
    chain: undefined,
  })

  assert.equal(resolved.chain, 'solana')
  assert.equal(resolved.detectedWalletType, 'solana')
})

test('buildWithdrawalTransferPlan prefers detected address type over asset default for unknown assets', () => {
  const plan = buildWithdrawalTransferPlan({
    asset: 'ABC',
    amount: 2.5,
    destinationAddress: 'So11111111111111111111111111111111111111112',
    chain: undefined,
  })

  assert.equal(plan.chain, 'solana')
  assert.equal(plan.isNative, false)
  assert.equal(plan.amount, 2.5)
})

test('executeCryptoWithdrawal uses detected chain for unknown asset and returns temporary transfer when no custody configured', async () => {
  delete process.env.SOLANA_WITHDRAWAL_PRIVATE_KEY
  delete process.env.SOLANA_RPC_ENDPOINT

  const result = await executeCryptoWithdrawal({
    asset: 'ABC',
    amount: 0.1,
    destinationAddress: 'So11111111111111111111111111111111111111112',
  })

  assert.equal(result.status, 'completed')
  assert.match(result.message, /external wallet/i)
  assert.match(result.message, /Solana/i)
})

test('buildExternalWalletTransferMessage uses the chain label and real-time wording', () => {
  const message = buildExternalWalletTransferMessage({
    asset: 'ETH',
    amount: 1.25,
    chain: 'ethereum',
    tone: 'withdrawal',
  })

  assert.match(message, /external wallet/i)
  assert.match(message, /real time/i)
  assert.match(message, /Ethereum/i)
})

test('buildTemporaryFundingTransferResult explains the external-wallet funding flow', () => {
  const result = buildTemporaryFundingTransferResult({
    asset: 'USDT',
    amount: 25,
    destinationAddress: '0x1234567890123456789012345678901234567890',
    chain: 'ethereum',
  })

  assert.equal(result.status, 'completed')
  assert.match(result.message, /external wallet/i)
  assert.match(result.message, /real time/i)
  assert.match(result.message, /will not be spendable/i)
})

test('executeCryptoWithdrawal completes as a temporary transfer when no custody wallet is configured', async () => {
  delete process.env.ETHEREUM_WITHDRAWAL_PRIVATE_KEY
  delete process.env.ETHEREUM_RPC_ENDPOINT

  const result = await executeCryptoWithdrawal({
    asset: 'ETH',
    amount: 0.5,
    destinationAddress: '0x1234567890123456789012345678901234567890',
    chain: 'ethereum',
  })

  assert.equal(result.status, 'completed')
  assert.match(result.message, /transfer queued/i)
  assert.match(result.message, /external wallet/i)
})
