import { useRef, useState } from 'react'
import { QrCode, Copy, Eye, EyeOff, Download, Smartphone } from 'lucide-react'
import { toast } from 'sonner'

interface WalletQrScannerProps {
  address: string
  currency: string
  network: string
  onAddressScanned?: (address: string) => void
}

export function WalletQrScanner({ address, currency, network, onAddressScanned }: WalletQrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [scanning, setScanning] = useState(false)
  const [scannedAddress, setScannedAddress] = useState<string>('')
  const [scanMode, setScanMode] = useState<'display' | 'verify'>('display')
  const [showCopyOptions, setShowCopyOptions] = useState(false)

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(address)
      toast.success('Address copied to clipboard')
    } catch {
      toast.error('Failed to copy address')
    }
  }

  const copyAsMnemonic = () => {
    const text = `${currency} Deposit Address\n${address}\nNetwork: ${network}\nDo not send other assets.`
    try {
      navigator.clipboard.writeText(text)
      toast.success('Formatted address copied')
    } catch {
      toast.error('Failed to copy')
    }
  }

  const downloadQrCode = () => {
    const canvas = document.querySelector('canvas')
    if (!canvas) {
      toast.error('QR code not found')
      return
    }
    const link = document.createElement('a')
    link.href = canvas.toDataURL()
    link.download = `verdexis-${currency}-deposit-qr.png`
    link.click()
    toast.success('QR code downloaded')
  }

  const toggleScan = async () => {
    if (!scanning) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment' } 
        })
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          setScanning(true)
        }
      } catch (err) {
        toast.error('Camera access denied')
      }
    } else {
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks()
        tracks.forEach(track => track.stop())
      }
      setScanning(false)
    }
  }

  return (
    <div className="space-y-4">
      {scanMode === 'display' ? (
        <div className="space-y-4">
          {/* Address display */}
          <div className="bg-[#070C0E] rounded-xl p-4 border border-[#ffffff08]">
            <p className="text-xs text-[#737373] mb-2 uppercase tracking-wider">Wallet address</p>
            <div className="flex items-center gap-2 mb-3">
              <code className="flex-1 text-[11px] text-[#0C8B44] font-mono bg-[#0a0e10] px-3 py-2 rounded-lg break-all">
                {address}
              </code>
              <div className="flex gap-1">
                <button
                  onClick={copyToClipboard}
                  className="p-2 rounded-lg bg-[#0C8B44]/10 text-[#0C8B44] hover:bg-[#0C8B44]/20 transition-colors"
                  title="Copy address"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setShowCopyOptions(!showCopyOptions)}
                  className="p-2 rounded-lg bg-[#0C8B44]/10 text-[#0C8B44] hover:bg-[#0C8B44]/20 transition-colors"
                  title="More copy options"
                >
                  <EyeOff className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Copy options menu */}
            {showCopyOptions && (
              <div className="bg-[#0a0e10] rounded-lg p-2 mb-3 border border-[#ffffff08] space-y-1">
                <button
                  onClick={copyToClipboard}
                  className="w-full text-left text-xs text-[#A0A0A0] hover:text-[#0C8B44] px-3 py-2 rounded transition-colors flex items-center gap-2"
                >
                  <Copy className="w-3 h-3" /> Copy plain
                </button>
                <button
                  onClick={copyAsMnemonic}
                  className="w-full text-left text-xs text-[#A0A0A0] hover:text-[#0C8B44] px-3 py-2 rounded transition-colors flex items-center gap-2"
                >
                  <Copy className="w-3 h-3" /> Copy with details
                </button>
                <button
                  onClick={downloadQrCode}
                  className="w-full text-left text-xs text-[#A0A0A0] hover:text-[#0C8B44] px-3 py-2 rounded transition-colors flex items-center gap-2"
                >
                  <Download className="w-3 h-3" /> Download QR code
                </button>
                <button
                  onClick={() => setScanMode('verify')}
                  className="w-full text-left text-xs text-[#A0A0A0] hover:text-[#0C8B44] px-3 py-2 rounded transition-colors flex items-center gap-2"
                >
                  <Smartphone className="w-3 h-3" /> Verify with QR
                </button>
              </div>
            )}

            {/* Network info */}
            <div className="flex items-center justify-between text-[10px] text-[#737373]">
              <span>Network: <span className="text-[#E5E5E5]">{network}</span></span>
              <span>Asset: <span className="text-[#E5E5E5]">{currency}</span></span>
            </div>
          </div>

          {/* Warning */}
          <div className="bg-[#F57C00]/10 border border-[#F57C00]/30 rounded-lg p-3">
            <p className="text-xs text-[#F57C00] font-medium">⚠ Important</p>
            <p className="text-[11px] text-[#A0A0A0] mt-1">
              Only send {currency} on the {network} network. Funds sent on other networks cannot be recovered.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* QR verification mode */}
          <div className="bg-[#0F1619] rounded-xl p-4 border border-[#1a2329]">
            <p className="text-xs text-[#737373] mb-3 uppercase tracking-wider">Scan deposit QR code to verify</p>
            
            {scanning ? (
              <div className="space-y-3">
                <div className="relative bg-[#000] rounded-lg overflow-hidden aspect-square">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 border-4 border-[#0C8B44]/50 rounded-lg m-4 pointer-events-none">
                    <div className="absolute inset-0 bg-gradient-to-b from-[#0C8B44]/30 to-transparent" />
                  </div>
                </div>
                <p className="text-center text-xs text-[#A0A0A0]">
                  Position the wallet QR code in the frame
                </p>
              </div>
            ) : (
              <div className="bg-[#070C0E] rounded-lg aspect-square flex flex-col items-center justify-center border-2 border-dashed border-[#0C8B44]/30">
                <QrCode className="w-12 h-12 text-[#0C8B44]/50 mb-3" />
                <p className="text-xs text-[#A0A0A0]">Ready to scan</p>
              </div>
            )}

            <div className="flex gap-2 mt-3">
              <button
                onClick={toggleScan}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-colors ${
                  scanning
                    ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                    : 'bg-[#0C8B44]/20 text-[#0C8B44] hover:bg-[#0C8B44]/30'
                }`}
              >
                {scanning ? 'Stop scan' : 'Start scan'}
              </button>
              <button
                onClick={() => setScanMode('display')}
                className="flex-1 py-2 px-3 rounded-lg text-xs font-medium bg-[#1a1a1a] text-[#A0A0A0] hover:text-[#E5E5E5] transition-colors"
              >
                Back
              </button>
            </div>

            {scannedAddress && (
              <div className="mt-3 p-3 bg-[#0C8B44]/10 border border-[#0C8B44]/30 rounded-lg">
                <p className="text-[10px] uppercase tracking-wider text-[#0C8B44] font-medium mb-1">Verified</p>
                <p className="text-[11px] text-[#E5E5E5] font-mono break-all">{scannedAddress}</p>
                {scannedAddress === address && (
                  <p className="text-[10px] text-[#4CAF50] mt-1.5">✓ Address matches wallet</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
