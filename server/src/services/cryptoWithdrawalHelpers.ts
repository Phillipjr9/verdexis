export function detectWalletAddressType(address: string): 'ethereum' | 'solana' | 'bitcoin' | 'unknown' {
  const trimmed = (address || '').trim().replace(/^(bitcoin|ethereum|solana):/i, '')
  if (!trimmed) return 'unknown'
  if (/^0x[a-fA-F0-9]{40}$/.test(trimmed)) return 'ethereum'
  if (/^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/.test(trimmed)) return 'bitcoin'
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trimmed)) return 'solana'
  return 'unknown'
}

export function resolveWithdrawalChain(input: {
  destinationAddress?: string
  chain?: 'ethereum' | 'solana' | 'bitcoin' | 'bsc'
  asset?: string
}) {
  const detectedWalletType = detectWalletAddressType(String(input?.destinationAddress || ''))
  const explicit = input?.chain
  const asset = String(input?.asset || '').toUpperCase()
  let chain = explicit
  if (!chain) {
    if (asset === 'BTC' || detectedWalletType === 'bitcoin') chain = 'bitcoin'
    else if (asset === 'SOL' || detectedWalletType === 'solana') chain = 'solana'
    else if (asset === 'BNB') chain = 'bsc'
    else if (detectedWalletType === 'ethereum') chain = 'ethereum'
    else if (asset === 'ETH' || asset === 'USDC' || asset === 'USDT') chain = 'ethereum'
  }
  return { chain, detectedWalletType }
}
