import { useEffect, useState } from 'react'
import { Moon, Sun, Monitor } from 'lucide-react'
import { applyTheme, getResolvedTheme, setThemePreference } from '../../lib/themeApplier'

type ThemePref = 'dark' | 'light' | 'auto'

function readPref(): ThemePref {
  try {
    const raw = localStorage.getItem('verdexis_prefs')
    if (!raw) return 'dark'
    const parsed = JSON.parse(raw)
    return (parsed.theme as ThemePref) || 'dark'
  } catch {
    return 'dark'
  }
}

/** Cycles dark → light → auto. Visible on Dashboard toolbar and nav. */
export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [pref, setPref] = useState<ThemePref>(() => readPref())
  const [resolved, setResolved] = useState<'dark' | 'light'>(() => getResolvedTheme())

  useEffect(() => {
    const sync = () => {
      setPref(readPref())
      setResolved(getResolvedTheme())
    }
    window.addEventListener('verdexis:theme', sync)
    window.addEventListener('verdexis:prefs', sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener('verdexis:theme', sync)
      window.removeEventListener('verdexis:prefs', sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const cycle = () => {
    const order: ThemePref[] = ['dark', 'light', 'auto']
    const next = order[(order.indexOf(pref) + 1) % order.length]
    setThemePreference(next)
    setPref(next)
    setResolved(getResolvedTheme())
    applyTheme(next)
  }

  const Icon = pref === 'auto' ? Monitor : resolved === 'light' ? Sun : Moon
  const label = pref === 'auto' ? 'Auto' : resolved === 'light' ? 'Light' : 'Dark'

  return (
    <button
      type="button"
      onClick={cycle}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#ffffff10] bg-[#1a1a1a]/50 text-xs text-[#A0A0A0] hover:text-[#E5E5E5] hover:border-[#0C8B44]/30 transition-colors"
      title={`Theme: ${label}. Click to switch.`}
      aria-label={`Current theme ${label}. Click to change theme.`}
    >
      <Icon className="w-3.5 h-3.5" />
      {!compact && <span className="hidden sm:inline capitalize">{label}</span>}
    </button>
  )
}
