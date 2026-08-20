import { useState, useEffect } from 'react'
import { X, Lightbulb } from 'lucide-react'

const TIPS = [
  'Complete KYC to unlock higher withdrawal limits.',
  'Link a bank account or crypto wallet from Settings to deposit funds.',
  'Set price alerts so you never miss a move on your watchlist.',
  'Use DCA (dollar-cost averaging) to invest a fixed amount on a schedule.',
  'Enable passkeys for faster, passwordless sign-in.',
]

const STORAGE_KEY = 'verdexis_onboarding_tips_dismissed'

export function OnboardingTips() {
  const [index, setIndex] = useState(0)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === '1') return
    } catch {
      /* ignore */
    }
    setVisible(true)
  }, [])

  if (!visible) return null

  function dismiss() {
    setVisible(false)
    try {
      localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      /* ignore */
    }
  }

  function next() {
    if (index >= TIPS.length - 1) {
      dismiss()
      return
    }
    setIndex((i) => i + 1)
  }

  return (
    <div className="fixed bottom-4 right-4 z-40 max-w-sm w-[calc(100%-2rem)] rounded-xl bg-[#0f1619] border border-[#0C8B44]/40 shadow-lg p-4">
      <div className="flex items-start gap-3">
        <Lightbulb className="w-5 h-5 text-[#0C8B44] shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-xs uppercase tracking-wider text-[#737373] mb-1">
            Tip {index + 1} of {TIPS.length}
          </p>
          <p className="text-sm text-[#E5E5E5]">{TIPS[index]}</p>
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              onClick={next}
              className="px-3 py-1.5 text-xs rounded-lg bg-[#0C8B44] text-white hover:bg-[#0a7539]"
            >
              {index >= TIPS.length - 1 ? 'Got it' : 'Next'}
            </button>
            <button
              type="button"
              onClick={dismiss}
              className="px-3 py-1.5 text-xs rounded-lg text-[#A0A0A0] hover:text-[#E5E5E5]"
            >
              Dismiss
            </button>
          </div>
        </div>
        <button type="button" onClick={dismiss} aria-label="Close" className="text-[#737373] hover:text-[#E5E5E5]">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
