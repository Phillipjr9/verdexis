import crypto from 'node:crypto'
import https from 'node:https'

interface AddressResponse {
  address: string
  currency: string
  chainId: string
  network: string
}

class CryptoAddressGenerator {
  // For demo/sandbox, we generate fake but deterministic addresses
  // In production, integrate with a custodial service (Coinbase Commerce, BitPay, etc.)
  
  private generateEthereumAddress(userId: string): string {
    // Generate deterministic Ethereum address from user ID
    const hash = crypto.createHash('sha256').update(`${userId}-ethereum-v1`).digest()
    const address = '0x' + hash.slice(0, 20).toString('hex')
    return address.toLowerCase()
  }

  private generateBitcoinAddress(userId: string): string {
    // Generate deterministic Bitcoin address (P2PKH format starts with 1)
    const hash = crypto.createHash('sha256').update(`${userId}-bitcoin-v1`).digest()
    const base58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
    let address = '1'
    let num = BigInt('0x' + hash.toString('hex'))
    while (num > 0n) {
      address = base58[Number(num % 58n)] + address
      num = num / 58n
    }
    return address.substring(0, 34)
  }

  private generateSolanaAddress(userId: string): string {
    // Generate deterministic Solana address (base58, ~32-44 chars)
    const hash = crypto.createHash('sha256').update(`${userId}-solana-v1`).digest()
    const base58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
    let address = ''
    let num = BigInt('0x' + hash.toString('hex'))
    for (let i = 0; i < 32; i++) {
      address = base58[Number(num % 58n)] + address
      num = num / 58n
    }
    return address.substring(0, 44)
  }

  private generatePolygonAddress(userId: string): string {
    // Polygon uses Ethereum format (0x-prefixed)
    return this.generateEthereumAddress(`${userId}-polygon`)
  }

  public generateAddress(userId: string, currency: string): AddressResponse {
    const currencyLower = currency.toLowerCase()
    
    let address: string
    let chainId: string
    let network: string

    switch (currencyLower) {
      case 'btc':
      case 'bitcoin':
        address = this.generateBitcoinAddress(userId)
        chainId = 'bitcoin'
        network = 'Bitcoin Mainnet'
        break

      case 'eth':
      case 'ethereum':
        address = this.generateEthereumAddress(userId)
        chainId = '0x1'
        network = 'Ethereum Mainnet'
        break

      case 'sol':
      case 'solana':
        address = this.generateSolanaAddress(userId)
        chainId = '101'
        network = 'Solana Mainnet'
        break

      case 'matic':
      case 'polygon':
        address = this.generatePolygonAddress(userId)
        chainId = '0x89'
        network = 'Polygon Mainnet'
        break

      case 'usdc':
      case 'usdt':
      case 'dai':
        // Stablecoins use Ethereum mainnet
        address = this.generateEthereumAddress(`${userId}-${currencyLower}`)
        chainId = '0x1'
        network = 'Ethereum Mainnet'
        break

      default:
        throw new Error(`Unsupported currency: ${currency}`)
    }

    return {
      address,
      currency: currencyLower,
      chainId,
      network,
    }
  }

  public generateQRCode(address: string): string {
    // Generate QR code data URL using qr-server API
    const encodedAddress = encodeURIComponent(address)
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodedAddress}`
  }

  public async fetchQRCode(address: string): Promise<Buffer> {
    // Fetch QR code image from qr-server
    return new Promise((resolve, reject) => {
      const url = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(address)}`
      https.get(url, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`QR code generation failed: ${res.statusCode}`))
          return
        }
        const chunks: Buffer[] = []
        res.on('data', (chunk) => chunks.push(chunk))
        res.on('end', () => resolve(Buffer.concat(chunks)))
        res.on('error', reject)
      }).on('error', reject)
    })
  }
}

export const addressGenerator = new CryptoAddressGenerator()
