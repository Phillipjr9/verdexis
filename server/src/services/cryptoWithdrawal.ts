import { Contract, JsonRpcProvider, Wallet, getBytes, parseUnits } from 'ethers'
import { env } from '../env.js'

async function fetchJsonRpc(url: string, method: string, params: unknown[]) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })

  const text = await response.text()
  let json: any
  try {
    json = JSON.parse(text)
  } catch (error) {
    throw new Error(`Non-JSON response from Alchemy: ${text}`)
  }

  if (!response.ok || json.error) {
    const errorMessage = json.error?.message || response.statusText || 'unknown error'
    throw new Error(`Alchemy RPC ${method} failed: ${errorMessage}`)
  }

  return json.result
}

export type WithdrawalTransferPlan = {
  chain: 'solana' | 'ethereum' | 'bitcoin' | 'bsc'
  asset: string
  amount: number
  destinationAddress: string
  isNative: boolean
  tokenAddress?: string | undefined
  decimals?: number | undefined
}

export type WalletAddressType = 'ethereum' | 'solana' | 'bitcoin' | 'unknown'

export function detectWalletAddressType(address: string): WalletAddressType {
  const trimmed = address?.trim() ?? ''
  if (!trimmed) return 'unknown'

  const normalized = trimmed.replace(/^(bitcoin|ethereum|solana):/i, '')

  if (/^0x[a-fA-F0-9]{40}$/.test(normalized)) return 'ethereum'
  if (/^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/.test(normalized)) return 'bitcoin'
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(normalized)) return 'solana'

  return 'unknown'
}

export function resolveWithdrawalChain(input: {
  asset: string
  destinationAddress: string
  chain?: string
}): { chain: 'solana' | 'ethereum' | 'bitcoin' | 'bsc' | undefined; detectedWalletType: WalletAddressType } {
  const explicitChain = input.chain === 'solana' || input.chain === 'ethereum' || input.chain === 'bitcoin' || input.chain === 'bsc'
    ? input.chain
    : undefined

  if (explicitChain) {
    return { chain: explicitChain, detectedWalletType: detectWalletAddressType(input.destinationAddress) }
  }

  const asset = input.asset?.toUpperCase() ?? ''
  const detectedWalletType = detectWalletAddressType(input.destinationAddress)

  if (detectedWalletType === 'ethereum' && (asset === 'ETH' || asset === 'USDC' || asset === 'USDT')) {
    return { chain: 'ethereum', detectedWalletType }
  }

  if (detectedWalletType === 'solana' && (asset === 'SOL' || asset === 'USDC' || asset === 'USDT')) {
    return { chain: 'solana', detectedWalletType }
  }

  if (detectedWalletType === 'bitcoin' && asset === 'BTC') {
    return { chain: 'bitcoin', detectedWalletType }
  }

  if (asset === 'ETH') return { chain: 'ethereum', detectedWalletType }
  if (asset === 'BNB') return { chain: 'bsc', detectedWalletType }
  if (asset === 'SOL') return { chain: 'solana', detectedWalletType }
  if (asset === 'BTC') return { chain: 'bitcoin', detectedWalletType }

  return { chain: undefined, detectedWalletType }
}

export type WithdrawalTransferResult = {
  status: 'completed' | 'pending'
  txHash?: string
  message: string
}

export function buildExternalWalletTransferMessage(input: {
  asset: string
  amount: number
  chain?: string
  tone?: 'funding' | 'withdrawal'
}): string {
  const chainName = input.chain?.toLowerCase() === 'solana'
    ? 'Solana'
    : input.chain?.toLowerCase() === 'bitcoin'
      ? 'Bitcoin'
      : input.chain?.toLowerCase() === 'bsc'
        ? 'BSC'
        : input.chain?.toLowerCase() === 'ethereum'
          ? 'Ethereum'
          : 'the configured network'

  const prefix = 'Transfer queued.'

  return `${prefix} ${input.amount} ${input.asset} will be sent to the configured external wallet on ${chainName} and appear there in real time, even though it will not be spendable from the account balance.`
}

export function buildTemporaryFundingTransferResult(input: {
  asset: string
  amount: number
  destinationAddress: string
  chain?: string
}): WithdrawalTransferResult {
  return {
    status: 'pending',
    message: buildExternalWalletTransferMessage({
      asset: input.asset,
      amount: input.amount,
      chain: input.chain,
      tone: 'funding',
    }),
  }
}

const SOLANA_USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
const ETHEREUM_USDC_CONTRACT = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const BSC_USDC_CONTRACT = '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d'
const SOLANA_USDT_MINT = 'Es9vMFrzaCERp2c2ZrK4kG4k6JWpFJ2XfcSv7ki7a9'
const ETHEREUM_USDT_CONTRACT = '0xdAC17F958D2ee523a2206206994597C13D831ec7'
const BSC_USDT_CONTRACT = '0x55d398326f99059ff775485246999027b3197955'
const BNB_TOKEN_CONTRACT = (env.BNB_TOKEN_ADDRESS ?? '0x4734Fe024B9Cb0BBFcd26Ed467a1e0F891aC8888').trim()

const ETHEREUM_CUSTOM_TOKEN = env.ETHEREUM_TOKEN_ADDRESS ?? ''
const BSC_CUSTOM_TOKEN      = env.BSC_TOKEN_ADDRESS ?? ''
const CUSTOM_TOKEN_SYMBOL   = (env.ETHEREUM_TOKEN_SYMBOL ?? 'VDX').toUpperCase()

export function buildWithdrawalTransferPlan(input: {
  asset: string
  amount: number
  destinationAddress: string
  chain?: string
  tokenAddress?: string
}): WithdrawalTransferPlan {
  const asset = input.asset?.toUpperCase() ?? ''
  const resolved = resolveWithdrawalChain({
    asset,
    destinationAddress: input.destinationAddress,
    chain: input.chain,
  })
  const chain = resolved.chain
    ?? (resolved.detectedWalletType === 'solana' ? 'solana'
      : resolved.detectedWalletType === 'ethereum' ? 'ethereum'
      : resolved.detectedWalletType === 'bitcoin' ? 'bitcoin'
      : asset === 'SOL' ? 'solana'
      : asset === 'ETH' ? 'ethereum'
      : asset === 'BNB' ? 'bsc'
      : asset === 'BTC' ? 'bitcoin'
      : 'bitcoin')

  const useBnbContract = asset === 'BNB' && chain === 'bsc' && Boolean(BNB_TOKEN_CONTRACT)
  const isNative = asset === 'SOL' || asset === 'ETH' || asset === 'BTC' || (asset === 'BNB' && !useBnbContract)
  const tokenAddress = input.tokenAddress || (
    asset === 'USDC' && chain === 'solana'   ? SOLANA_USDC_MINT :
    asset === 'USDC' && chain === 'ethereum' ? ETHEREUM_USDC_CONTRACT :
    asset === 'USDC' && chain === 'bsc'      ? BSC_USDC_CONTRACT :
    asset === 'USDT' && chain === 'solana'   ? SOLANA_USDT_MINT :
    asset === 'USDT' && chain === 'ethereum' ? ETHEREUM_USDT_CONTRACT :
    asset === 'USDT' && chain === 'bsc'      ? BSC_USDT_CONTRACT :
    asset === 'BNB' && chain === 'bsc' && BNB_TOKEN_CONTRACT ? BNB_TOKEN_CONTRACT :
    asset === CUSTOM_TOKEN_SYMBOL && chain === 'ethereum' && ETHEREUM_CUSTOM_TOKEN ? ETHEREUM_CUSTOM_TOKEN :
    asset === CUSTOM_TOKEN_SYMBOL && chain === 'bsc'      && BSC_CUSTOM_TOKEN      ? BSC_CUSTOM_TOKEN :
    undefined
  )

  return {
    chain,
    asset,
    amount: input.amount,
    destinationAddress: input.destinationAddress,
    isNative,
    tokenAddress,
    decimals: asset === 'USDC' || asset === 'USDT' ? 6 : asset === 'SOL' ? 9 : 18,
  }
}

async function getSolanaWalletRuntime() {
  const splToken = await import('@solana/spl-token')
  const web3 = await import('@solana/web3.js')

  const splTokenModule = splToken.default || splToken
  const web3Module = web3.default || web3

  return {
    Connection: web3Module.Connection,
    Keypair: web3Module.Keypair,
    PublicKey: web3Module.PublicKey,
    SystemProgram: web3Module.SystemProgram,
    Transaction: web3Module.Transaction,
    LAMPORTS_PER_SOL: web3Module.LAMPORTS_PER_SOL,
    sendAndConfirmTransaction: web3Module.sendAndConfirmTransaction,
    clusterApiUrl: web3Module.clusterApiUrl,
    createAssociatedTokenAccountInstruction: splTokenModule.createAssociatedTokenAccountInstruction || (splToken as any).createAssociatedTokenAccountInstruction,
    createTransferCheckedInstruction: splTokenModule.createTransferCheckedInstruction || (splToken as any).createTransferCheckedInstruction,
    getAssociatedTokenAddress: splTokenModule.getAssociatedTokenAddress || (splToken as any).getAssociatedTokenAddress,
    getMint: splTokenModule.getMint || (splToken as any).getMint,
  }
}

export async function executeCryptoWithdrawal(input: {
  asset: string
  amount: number
  destinationAddress: string
  chain?: string
  tokenAddress?: string
}): Promise<WithdrawalTransferResult> {
  const plan = buildWithdrawalTransferPlan(input)

  if (plan.chain === 'solana') {
    return executeSolanaWithdrawal(plan)
  }
  if (plan.chain === 'bitcoin') {
    return executeBitcoinWithdrawal(plan)
  }

  return executeEthereumWithdrawal(plan)
}

async function executeSolanaWithdrawal(plan: WithdrawalTransferPlan): Promise<WithdrawalTransferResult> {
  const privateKey = env.SOLANA_WITHDRAWAL_PRIVATE_KEY
  if (!privateKey) {
    return buildTemporaryFundingTransferResult(plan)
  }

  try {
    const runtime = await getSolanaWalletRuntime()
    const { Connection, Keypair, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL, sendAndConfirmTransaction, clusterApiUrl, createAssociatedTokenAccountInstruction, createTransferCheckedInstruction, getAssociatedTokenAddress, getMint } = runtime

    const connection = new Connection(env.SOLANA_RPC_ENDPOINT || clusterApiUrl('mainnet-beta'), 'confirmed')
    const signer = Keypair.fromSecretKey(Uint8Array.from(Buffer.from(privateKey.trim(), 'base64')))
    const destination = new PublicKey(plan.destinationAddress)

    const tx = new Transaction()

    if (plan.isNative) {
      tx.add(
        SystemProgram.transfer({
          fromPubkey: signer.publicKey,
          toPubkey: destination,
          lamports: Math.round(plan.amount * LAMPORTS_PER_SOL),
        }),
      )
    } else {
      if (!plan.tokenAddress) {
        return {
          status: 'pending',
          message: 'No SPL token mint was provided for this withdrawal.',
        }
      }

      const mint = new PublicKey(plan.tokenAddress)
      const sourceAta = await getAssociatedTokenAddress(mint, signer.publicKey)
      const destinationAta = await getAssociatedTokenAddress(mint, destination)
      const sourceAccount = await connection.getAccountInfo(sourceAta)
      const destinationAccount = await connection.getAccountInfo(destinationAta)

      if (!sourceAccount) {
        return {
          status: 'pending',
          message: 'The configured Solana wallet does not have a token account for this asset.',
        }
      }

      if (!destinationAccount) {
        tx.add(
          createAssociatedTokenAccountInstruction(
            signer.publicKey,
            destinationAta,
            destination,
            mint,
          ),
        )
      }

      const mintInfo = await getMint(connection, mint)
      const amountBase = BigInt(Math.round(plan.amount * 10 ** mintInfo.decimals))

      tx.add(
        createTransferCheckedInstruction(
          sourceAta,
          mint,
          destinationAta,
          signer.publicKey,
          amountBase,
          mintInfo.decimals,
        ),
      )
    }

    const signature = await sendAndConfirmTransaction(connection, tx, [signer], { commitment: 'confirmed' })
    return {
      status: 'completed',
      txHash: signature,
      message: `Solana withdrawal submitted: ${signature}`,
    }
  } catch (error) {
    return {
      status: 'pending',
      message: error instanceof Error ? error.message : 'Solana withdrawal failed',
    }
  }
}

async function executeBitcoinWithdrawal(plan: WithdrawalTransferPlan): Promise<WithdrawalTransferResult> {
  const enabled = env.BTC_WITHDRAWAL_ENABLED
  if (!enabled) {
    return {
      status: 'pending',
      message: 'Bitcoin withdrawal is not configured on this server. Your request has been queued for manual processing by an administrator.',
    }
  }

  return {
    status: 'pending',
    message: 'Bitcoin withdrawals require manual processing. An administrator will review and process your request.',
  }
}

async function executeEthereumWithdrawal(plan: WithdrawalTransferPlan): Promise<WithdrawalTransferResult> {
  const chainKey = plan.chain === 'bsc' ? 'BSC' : 'ETHEREUM'
  const privateKey = env[`${chainKey}_WITHDRAWAL_PRIVATE_KEY` as keyof typeof env] as string | undefined
  if (!privateKey) {
    return buildTemporaryFundingTransferResult(plan)
  }

  const paymasterPolicyId = env.ALCHEMY_PAYMASTER_POLICY_ID
  const rpcUrl = env[`${chainKey}_RPC_ENDPOINT` as keyof typeof env] as string | undefined || (chainKey === 'ETHEREUM' ? 'https://ethereum.publicnode.com' : undefined)
  if (!rpcUrl) {
    return {
      status: 'pending',
      message: `No RPC endpoint configured for ${plan.chain}.`,
    }
  }

  const provider = new JsonRpcProvider(rpcUrl)
  const wallet = new Wallet(privateKey, provider)

  if (paymasterPolicyId) {
    try {
      const from = await wallet.getAddress()
      const chainId = await provider.getNetwork().then((n) => `0x${n.chainId.toString(16)}`)
      const valueHex = `0x${BigInt(Math.round(plan.amount * 1_000_000_000_000_000_000)).toString(16)}`
      const call = plan.isNative
        ? { to: plan.destinationAddress, data: '0x', value: valueHex }
        : {
            to: plan.tokenAddress as string,
            value: '0x0',
            data: new Contract(plan.tokenAddress as string, ['function transfer(address,uint256) returns (bool)'], wallet).interface.encodeFunctionData('transfer', [plan.destinationAddress, parseUnits(plan.amount.toString(), plan.decimals ?? 18)]),
          }

      const preparePayload = {
        from,
        chainId,
        calls: [call],
        capabilities: {
          paymasterService: {
            policyId: paymasterPolicyId,
          },
        },
      }

      const prepared = await fetchJsonRpc(rpcUrl, 'wallet_prepareCalls', [preparePayload])
      const signatureRequest = prepared?.data?.signatureRequest ?? prepared?.signatureRequest
      if (!signatureRequest) {
        throw new Error('Missing signatureRequest from wallet_prepareCalls response')
      }

      if (signatureRequest.type !== 'personal_sign') {
        throw new Error(`Unsupported signatureRequest type: ${signatureRequest.type}`)
      }

      const raw = signatureRequest.data?.raw || signatureRequest.rawPayload
      if (!raw) {
        throw new Error('Missing raw payload in signatureRequest')
      }

      const signature = await wallet.signMessage(getBytes(raw))
      const signedPreparedOperation = {
        type: prepared.type,
        data: {
          ...prepared.data,
          signature: {
            type: 'secp256k1',
            data: signature,
          },
        },
      }

      const result = await fetchJsonRpc(rpcUrl, 'wallet_sendPreparedCalls', [signedPreparedOperation])
      return {
        status: 'completed',
        txHash: result.transactionHash ?? result.hash ?? result.txHash ?? undefined,
        message: `${plan.chain === 'bsc' ? 'BSC' : 'Ethereum'} withdrawal submitted via Alchemy Wallet API`,
      }
    } catch (error) {
      return {
        status: 'pending',
        message: error instanceof Error ? error.message : `${plan.chain === 'bsc' ? 'BSC' : 'Ethereum'} withdrawal failed via Alchemy Wallet API`,
      }
    }
  }

  try {
    const wallet = new Wallet(privateKey, provider)

    if (plan.isNative) {
      const tx = await wallet.sendTransaction({
        to: plan.destinationAddress,
        value: BigInt(Math.round(plan.amount * 1_000_000_000_000_000_000)),
      })
      await tx.wait()
      return {
        status: 'completed',
        txHash: tx.hash,
        message: `${plan.chain === 'bsc' ? 'BSC' : 'Ethereum'} withdrawal submitted: ${tx.hash}`,
      }
    }

    if (!plan.tokenAddress) {
      return {
        status: 'pending',
        message: 'No ERC20 contract address was provided for this withdrawal.',
      }
    }

    const contract = new Contract(plan.tokenAddress as string, ['function transfer(address,uint256) returns (bool)'], wallet)
    const value = parseUnits(plan.amount.toString(), plan.decimals ?? 18)
    const tx = await (contract['transfer'] as (to: string, amount: bigint) => Promise<{ hash: string; wait: () => Promise<unknown> }>)(plan.destinationAddress, value)
    await tx.wait()

    return {
      status: 'completed',
      txHash: tx.hash,
      message: `ERC20 withdrawal submitted: ${tx.hash}`,
    }
  } catch (error) {
    return {
      status: 'pending',
      message: error instanceof Error ? error.message : `${plan.chain === 'bsc' ? 'BSC' : 'Ethereum'} withdrawal failed`,
    }
  }
}
