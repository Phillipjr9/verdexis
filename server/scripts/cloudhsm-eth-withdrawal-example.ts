import { ethers } from 'ethers'

export type CloudHsmConfig = {
  pkcs11LibPath: string
  slotLabel: string
  pin: string
  keyLabel: string
  expectedAddress: string
  rpcUrl: string
}

function derToRS(der: Buffer) {
  if (der[0] !== 0x30) throw new Error('Invalid DER signature')
  const rLen = der[3]
  const r = der.slice(4, 4 + rLen)
  const sLen = der[4 + rLen + 1]
  const s = der.slice(4 + rLen + 2, 4 + rLen + 2 + sLen)
  return { r: ethers.hexlify(r), s: ethers.hexlify(s) }
}

async function loadPkcs11() {
  const pkcs11Module = await import('pkcs11js')
  return pkcs11Module.default ?? pkcs11Module
}

async function signDigestWithCloudHsm(digest: Uint8Array, config: CloudHsmConfig) {
  const PKCS11 = await loadPkcs11()
  const pkcs11 = new PKCS11.PKCS11()
  pkcs11.load(config.pkcs11LibPath)
  pkcs11.C_Initialize()

  try {
    const slots = pkcs11.C_GetSlotList(true)
    const slot = slots.find((slotId: number) => {
      const info = pkcs11.C_GetTokenInfo(slotId)
      return info.label.trim() === config.slotLabel
    })
    if (!slot) throw new Error(`No PKCS#11 slot found with label ${config.slotLabel}`)

    const session = pkcs11.C_OpenSession(slot, PKCS11.CKF_SERIAL_SESSION | PKCS11.CKF_RW_SESSION)
    pkcs11.C_Login(session, PKCS11.CKU_USER, config.pin)

    const template = [
      { type: PKCS11.CKA_CLASS, value: PKCS11.CKO_PRIVATE_KEY },
      { type: PKCS11.CKA_LABEL, value: config.keyLabel },
      { type: PKCS11.CKA_KEY_TYPE, value: PKCS11.CKK_EC }
    ]

    pkcs11.C_FindObjectsInit(session, template)
    const keys = pkcs11.C_FindObjects(session, 1)
    pkcs11.C_FindObjectsFinal(session)
    if (!keys || keys.length === 0) throw new Error(`HSM key not found: ${config.keyLabel}`)

    const privateKey = keys[0]
    pkcs11.C_SignInit(session, { mechanism: PKCS11.CKM_ECDSA }, privateKey)
    const signature = pkcs11.C_Sign(session, digest)
    pkcs11.C_Logout(session)
    pkcs11.C_CloseSession(session)

    return derToRS(Buffer.from(signature))
  } finally {
    pkcs11.C_Finalize()
  }
}

function recoverV(digest: Uint8Array, r: string, s: string, expectedAddress: string) {
  for (const v of [27, 28]) {
    try {
      const signature = ethers.Signature.from({ r, s, v })
      const recovered = ethers.recoverAddress(digest, signature)
      if (recovered.toLowerCase() === expectedAddress.toLowerCase()) {
        return v
      }
    } catch {
      // ignore invalid v
    }
  }
  throw new Error('Unable to recover v value for HSM signature')
}

async function signEthereumTransaction(tx: ethers.TransactionRequest, config: CloudHsmConfig) {
  if (!tx.chainId) throw new Error('chainId is required')
  if (!tx.nonce && tx.nonce !== 0) throw new Error('nonce is required')

  const signingTx = await ethers.Transaction.from(tx)
  const digest = signingTx.unsignedHash()

  const { r, s } = await signDigestWithCloudHsm(ethers.getBytes(digest), config)
  const v = recoverV(ethers.getBytes(digest), r, s, config.expectedAddress)

  const signature = ethers.Signature.from({ r, s, v })
  return ethers.serializeTransaction(tx, signature)
}

export async function broadcastSignedTransaction(rawTx: string, rpcUrl: string) {
  const provider = new ethers.JsonRpcProvider(rpcUrl)
  return provider.sendTransaction(rawTx)
}

async function example() {
  const config: CloudHsmConfig = {
    pkcs11LibPath: process.env.ETHEREUM_HSM_PKCS11_LIB || '/opt/cloudhsm/lib/libcloudhsm_pkcs11.so',
    slotLabel: process.env.ETHEREUM_HSM_SLOT_LABEL || 'cloudhsm-slot',
    pin: process.env.ETHEREUM_HSM_PIN || '',
    keyLabel: process.env.ETHEREUM_HSM_KEY_LABEL || 'ETH_WITHDRAWAL_KEY',
    expectedAddress: process.env.ETHEREUM_HSM_PUBLIC_ADDRESS || '0xYourEthereumAddress',
    rpcUrl: process.env.ETHEREUM_RPC_ENDPOINT || 'https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY',
  }

  const unsignedTx: ethers.TransactionRequest = {
    to: '0x6C1f1C8dfAbb45CCAF2E6Ef3503627222a964e70',
    value: ethers.parseEther('0.055863'),
    gasLimit: 21000n,
    maxFeePerGas: ethers.parseUnits('60', 'gwei'),
    maxPriorityFeePerGas: ethers.parseUnits('5', 'gwei'),
    nonce: 0,
    chainId: 1,
  }

  const rawTx = await signEthereumTransaction(unsignedTx, config)
  console.log('Signed raw transaction:', rawTx)

  const response = await broadcastSignedTransaction(rawTx, config.rpcUrl)
  console.log('Broadcast tx hash:', response.hash)
}

example().catch((error) => {
  console.error('CloudHSM signing example failed:', error)
  process.exit(1)
})
