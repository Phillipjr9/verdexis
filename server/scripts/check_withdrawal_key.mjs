#!/usr/bin/env node
import 'dotenv/config'
import { JsonRpcProvider, Wallet, formatEther } from 'ethers'
import { Connection, Keypair, clusterApiUrl } from '@solana/web3.js'

function safePrint(...args) {
  console.log(...args)
}

async function checkEthereum() {
  const rpc = process.env.ETHEREUM_RPC_ENDPOINT
  const pk = process.env.ETHEREUM_WITHDRAWAL_PRIVATE_KEY
  if (!pk) {
    safePrint('[eth] No ETH private key configured')
    return
  }
  if (!rpc) {
    safePrint('[eth] No ETH RPC endpoint configured')
    return
  }

  try {
    const provider = new JsonRpcProvider(rpc)
    const wallet = new Wallet(pk, provider)
    const address = await wallet.getAddress()
    const balance = await provider.getBalance(address)
    safePrint('[eth] address=', address)
    safePrint('[eth] balance (ETH)=', formatEther(balance))
  } catch (err) {
    safePrint('[eth] error:', err instanceof Error ? err.message : String(err))
  }
}

async function checkBsc() {
  const rpc = process.env.BSC_RPC_ENDPOINT
  const pk = process.env.BSC_WITHDRAWAL_PRIVATE_KEY || process.env.ETHEREUM_WITHDRAWAL_PRIVATE_KEY
  if (!pk) {
    safePrint('[bsc] No BSC private key configured (or ETH key available)')
    return
  }
  if (!rpc) {
    safePrint('[bsc] No BSC RPC endpoint configured')
    return
  }

  try {
    const provider = new JsonRpcProvider(rpc)
    const wallet = new Wallet(pk, provider)
    const address = await wallet.getAddress()
    const balance = await provider.getBalance(address)
    safePrint('[bsc] address=', address)
    safePrint('[bsc] balance (BNB)=', formatEther(balance))
  } catch (err) {
    safePrint('[bsc] error:', err instanceof Error ? err.message : String(err))
  }
}

async function checkSolana() {
  const rpc = process.env.SOLANA_RPC_ENDPOINT || clusterApiUrl('mainnet-beta')
  const pk = process.env.SOLANA_WITHDRAWAL_PRIVATE_KEY
  if (!pk) {
    safePrint('[sol] No Solana private key configured')
    return
  }

  try {
    let secret
    const trimmed = pk.trim()
    if (trimmed.startsWith('[')) {
      const arr = JSON.parse(trimmed)
      secret = Uint8Array.from(arr)
    } else {
      // assume base64
      secret = Uint8Array.from(Buffer.from(trimmed, 'base64'))
    }

    const kp = Keypair.fromSecretKey(secret)
    const conn = new Connection(rpc, 'confirmed')
    const balance = await conn.getBalance(kp.publicKey)
    safePrint('[sol] address=', kp.publicKey.toBase58())
    safePrint('[sol] balance (SOL)=', (balance / 1e9).toString())
  } catch (err) {
    safePrint('[sol] error:', err instanceof Error ? err.message : String(err))
  }
}

async function main() {
  await checkEthereum()
  await checkBsc()
  await checkSolana()
}

main().catch((e) => {
  console.error('unexpected error', e)
  process.exit(1)
})
