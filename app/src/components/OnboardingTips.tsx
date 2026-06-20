import { useState, useEffect } from 'react'
import { X, Lightbulb } from 'lucide-react'

export function OnboardingTips() {
  const [visible, setVisible] = useState(false)
  const [dismissedCount, setDismissedCount] = useState(0)

  useEffect(() => {
    const count = parseInt(localStorage.getItem('verdexis_tips_dismissed') || '0', 10)
    setDismissedCount(count)
    if (count === 0) {
      setTimeout(() => setVisible(true), 2000)
    }
  }, [])

  const tips = [
    { title: 'Link a bank account', desc: 'Start with ACH deposits for faster funding' },
    { title: 'Check the market screener', desc: 'Browse top movers and trading opportunities' },
  ]

  const handleDismiss = () => {
    setVisible(false)
    localStorage.setItem('verdexis_tips_dismissed', String(dismissedCount + 1))
  }

  if (!visible) return null

  const tip = tips[dismissedCount % tips.length]

  return (
    <div className="fixed bottom-8 right-8 z-40 max-w-sm">
      <div className="bg-[#0C8B44]/10 border border-[#0C8B44]/30 rounded-xl p-4 flex items-start gap-3">
        <Lightbulb className="w-5 h-5 text-[#0C8B44] shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-medium text-[#E5E5E5]">{tip.title}</p>
          <p className="text-xs text-[#A0A0A0] mt-1">{tip.desc}</p>
        </div>
        <button
          onClick={handleDismiss}
          className="p-1 text-[#737373] hover:text-[#E5E5E5] transition-colors shrink-0"
          aria-label="Dismiss tip"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
