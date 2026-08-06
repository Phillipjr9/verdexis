#!/usr/bin/env node
import 'dotenv/config'
import { existsSync } from 'fs'
import { readFile } from 'fs/promises'

const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY
const CHAIN = process.env.CHAIN || 'sepolia' // sepolia | bsc-testnet
const ALCHEMY_BSO_ENDPOINT = process.env.ALCHEMY_BSO_ENDPOINT
const SIGNED_PREPARED_OPERATION = process.env.SIGNED_PREPARED_OPERATION || process.argv[2]

if (!ALCHEMY_API_KEY) {
  console.error('ALCHEMY_API_KEY is required.')
  process.exit(1)
}

if (!SIGNED_PREPARED_OPERATION) {
  console.error('SIGNED_PREPARED_OPERATION is required as env or first argument.')
  console.error('Provide a signed prepared user operation JSON string or a path to a JSON file.')
  process.exit(1)
}

function getAlchemyRpc(chain) {
  if (ALCHEMY_BSO_ENDPOINT) {
    const trimmed = ALCHEMY_BSO_ENDPOINT.replace(/\/+$/g, '')
    if (trimmed.includes('/v2/')) return trimmed
    if (trimmed.endsWith('/v1/bso/submit')) {
      return trimmed.replace(/\/v1\/bso\/submit$/, `/v2/${ALCHEMY_API_KEY}`)
    }
    return `${trimmed}/v2/${ALCHEMY_API_KEY}`
  }
  if (chain === 'sepolia') return `https://api.g.alchemy.com/v2/${ALCHEMY_API_KEY}`
  if (chain === 'bsc-testnet') return `https://bsc-testnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`
  throw new Error('Unsupported chain: ' + chain)
}

async function loadPreparedOperation(input) {
  const trimmed = input.trim()
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return JSON.parse(trimmed)
  }
  if (existsSync(trimmed)) {
    const file = await readFile(trimmed, 'utf8')
    return JSON.parse(file)
  }
  throw new Error('SIGNED_PREPARED_OPERATION must be a JSON string or path to a JSON file')
}

async function fetchJsonRpc(method, params) {
  const url = getAlchemyRpc(CHAIN)
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })

  const text = await response.text()
  let json
  try {
    json = JSON.parse(text)
  } catch (err) {
    throw new Error(`Non-JSON response from Alchemy: ${text}`)
  }

  if (!response.ok || json.error) {
    const errorMessage = json.error?.message || response.statusText || 'unknown error'
    throw new Error(`RPC ${method} failed: ${errorMessage} - ${JSON.stringify(json.error)}`)
  }

  return json.result
}

async function main() {
  const preparedOperation = await loadPreparedOperation(SIGNED_PREPARED_OPERATION)

  console.log('Sending signed prepared operation with wallet_sendPreparedCalls...')
  const result = await fetchJsonRpc('wallet_sendPreparedCalls', [preparedOperation])

  console.log('Result:')
  console.log(JSON.stringify(result, null, 2))
}

main().catch((err) => {
  console.error('Error:', err instanceof Error ? err.message : String(err))
  process.exit(1)
})
