import { useState } from 'react'
import { Copy, Check, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'

export interface CopyFormat {
  label: string
  value: string
  icon?: React.ReactNode
}

interface EnhancedCopyButtonProps {
  value: string
  formats?: CopyFormat[]
  onCopy?: (format: string) => void
  tooltip?: string
  className?: string
  showLabel?: boolean
}

export function EnhancedCopyButton({
  value,
  formats = [
    { label: 'Copy address', value: value },
  ],
  onCopy,
  tooltip = 'Copy to clipboard',
  className = '',
  showLabel = false,
}: EnhancedCopyButtonProps) {
  const [copied, setCopied] = useState(false)
  const [showMenu, setShowMenu] = useState(false)

  const handleCopy = async (format: CopyFormat) => {
    try {
      await navigator.clipboard.writeText(format.value)
      setCopied(true)
      setShowMenu(false)
      toast.success(format.label)
      onCopy?.(format.label)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Failed to copy')
    }
  }

  if (formats.length === 1) {
    return (
      <button
        onClick={() => handleCopy(formats[0])}
        className={`inline-flex items-center gap-2 p-2 rounded-lg transition-colors ${
          copied
            ? 'bg-[#0C8B44]/30 text-[#0C8B44]'
            : 'text-[#737373] hover:text-[#0C8B44] hover:bg-[#0C8B44]/10'
        } ${className}`}
        title={tooltip}
      >
        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        {showLabel && <span className="text-xs font-medium">{formats[0].label}</span>}
      </button>
    )
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className={`inline-flex items-center gap-1.5 p-2 rounded-lg transition-colors ${
          copied
            ? 'bg-[#0C8B44]/30 text-[#0C8B44]'
            : 'text-[#737373] hover:text-[#0C8B44] hover:bg-[#0C8B44]/10'
        } ${className}`}
        title={tooltip}
      >
        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        <ChevronDown className="w-3 h-3" />
      </button>

      {showMenu && (
        <div className="absolute right-0 mt-1 bg-[#0a0e10] border border-[#ffffff10] rounded-lg shadow-xl z-50 min-w-48">
          {formats.map((format, idx) => (
            <button
              key={idx}
              onClick={() => handleCopy(format)}
              className="w-full text-left px-3 py-2 text-xs text-[#A0A0A0] hover:bg-[#0C8B44]/20 hover:text-[#0C8B44] transition-colors flex items-center gap-2 first:rounded-t-lg last:rounded-b-lg"
            >
              {format.icon || <Copy className="w-3 h-3" />}
              {format.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// Preset copy format helpers
export const copyFormats = {
  basic: (address: string) => ({ label: 'Copy address', value: address }),
  withDetails: (address: string, currency: string, network: string) => ({
    label: 'Copy with details',
    value: `${currency} Deposit\nAddress: ${address}\nNetwork: ${network}`
  }),
  csv: (address: string, currency: string, network: string) => ({
    label: 'Copy as CSV',
    value: `address,currency,network\n${address},${currency},${network}`
  }),
  json: (address: string, currency: string, network: string) => ({
    label: 'Copy as JSON',
    value: JSON.stringify({ address, currency, network }, null, 2)
  }),
  backup: (address: string, currency: string, network: string) => ({
    label: 'Copy backup format',
    value: `WALLET BACKUP\nCurrency: ${currency}\nNetwork: ${network}\nAddress: ${address}\n\n⚠️ Keep secure - only send ${currency} on ${network}`
  })
}
