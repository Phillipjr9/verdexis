#!/usr/bin/env node
import 'dotenv/config'
import { Wallet, parseEther, hexToBytes } from 'ethers'
import { argv } from 'process'

const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY
const ALCHEMY_BSO_ENDPOINT = process.env.ALCHEMY_BSO_ENDPOINT
const BSO_ID = process.env.BSO_ID || '08fb5ed9-dd71-4684-a02f-56b177240058'
const CHAIN = process.env.CHAIN || 'sepolia' // sepolia | bsc-testnet
const USER_PRIVATE_KEY = process.env.USER_PRIVATE_KEY
const RECIPIENT = process.env.RECIPIENT || argv[2]
const AMOUNT = process.env.AMOUNT || argv[3] || '0.001'
const SUBMIT = process.env.SUBMIT === 'true'
const SIGNATURE = process.env.SIGNATURE

if (!ALCHEMY_API_KEY) {
  console.error('ALCHEMY_API_KEY is required in env')
  process.exit(1)
}
if (!USER_PRIVATE_KEY) {
  console.error('USER_PRIVATE_KEY is required in env (do not paste it in chat)')
  process.exit(1)
}
if (!RECIPIENT) {
  console.error('Recipient required: set RECIPIENT env or pass as first arg')
  process.exit(1)
}
if (!BSO_ID) {
  console.error('BSO_ID is required in env and is used as the paymaster policyId for Alchemy Wallet API calls')
  process.exit(1)
}

const chainIdMap = { sepolia: 11155111, 'bsc-testnet': 97 }
const chainId = chainIdMap[CHAIN]
if (!chainId) {
  console.error('Unsupported chain:', CHAIN)
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

async function fetchJsonRpc(method, params) {
  const url = getAlchemyRpc(CHAIN)
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
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

function getSignatureRequest(payload) {
  return payload?.signatureRequest ?? payload?.data?.signatureRequest
}

async function signSignatureRequest(wallet, signatureRequest) {
  if (!signatureRequest || signatureRequest.type !== 'personal_sign') {
    throw new Error(`Unsupported signatureRequest type: ${signatureRequest?.type}`)
  }

  const raw = signatureRequest.data?.raw || signatureRequest.rawPayload
  if (!raw) {
    throw new Error('Missing raw payload in signatureRequest')
  }

  const bytes = hexToBytes(raw)
  return wallet.signMessage(bytes)
}

async function parseUserOperation(input) {
  if (!input) return undefined
  try {
    return JSON.parse(input)
  } catch {
    try {
      const url = new URL(input)
      throw new Error('SIGNED_USER_OPERATION should be raw JSON, not a URL')
    } catch {
      throw new Error('SIGNED_USER_OPERATION must be a valid JSON string')
    }
  }
}

async function main() {
  const wallet = new Wallet(USER_PRIVATE_KEY)
  const from = await wallet.getAddress()

  const call = {
    to: RECIPIENT,
    data: '0x',
  }
  const value = parseEther(AMOUNT)
  if (value !== 0n) {
    call.value = value.toHexString()
  }

  const preparePayload = {
    calls: [call],
    from,
    chainId: `0x${chainId.toString(16)}`,
    capabilities: {
      paymasterService: {
        policyId: BSO_ID,
      },
    },
  }

  console.log('Preparing Alchemy Wallet API call:')
  console.log('  chain:', CHAIN)
  console.log('  from:', from)
  console.log('  to:', RECIPIENT)
  console.log('  amount:', AMOUNT)
  console.log('  paymaster policyId:', BSO_ID)

  const prepared = await fetchJsonRpc('wallet_prepareCalls', [preparePayload])
  console.log('\nprepareCalls response:')
  console.log(JSON.stringify(prepared, null, 2))

  if (!SUBMIT) {
    console.log('\nFinished prepare stage. To submit this operation, run wallet_sendPreparedCalls with the signed operation.')
    return
  }

  let signedOperation
  if (SIGNATURE) {
    signedOperation = await parseUserOperation(SIGNATURE)
  } else {
    const signatureRequest = getSignatureRequest(prepared)
    const signature = await signSignatureRequest(wallet, signatureRequest)

    signedOperation = {
      type: prepared.type,
      data: {
        ...prepared.data,
        signature: {
          type: 'secp256k1',
          data: signature,
        },
      },
    }
  }

  console.log('\nSending signed prepared call via wallet_sendPreparedCalls...')
  const sendResult = await fetchJsonRpc('wallet_sendPreparedCalls', [signedOperation])
  console.log('wallet_sendPreparedCalls result:')
  console.log(JSON.stringify(sendResult, null, 2))
}

main().catch((e) => {
  console.error('error:', e instanceof Error ? e.message : String(e))
  process.exit(1)
})
