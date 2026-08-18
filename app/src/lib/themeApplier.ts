// Applies the user's chosen theme as `data-theme` + Tailwind `dark` class on <html>.

type Theme = 'dark' | 'light' | 'auto'

const PREFS_KEY = 'verdexis_prefs'

function readTheme(): Theme {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return 'dark'
    const parsed = JSON.parse(raw)
    return (parsed.theme as Theme) || 'dark'
  } catch {
    return 'dark'
  }
}

function resolve(theme: Theme): 'dark' | 'light' {
  if (theme === 'auto') {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  }
  return theme
}

export function getResolvedTheme(): 'dark' | 'light' {
  return resolve(readTheme())
}

export function applyTheme(theme: Theme = readTheme()) {
  const resolved = resolve(theme)
  const root = document.documentElement
  root.setAttribute('data-theme', resolved)
  root.style.colorScheme = resolved
  root.classList.toggle('dark', resolved === 'dark')
  root.classList.toggle('light', resolved === 'light')
  try {
    window.dispatchEvent(new CustomEvent('verdexis:theme', { detail: resolved }))
  } catch {
    /* ignore */
  }
}

export function setThemePreference(theme: Theme) {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    const prefs = raw ? JSON.parse(raw) : {}
    prefs.theme = theme
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
  } catch {
    /* ignore */
  }
  applyTheme(theme)
  try {
    window.dispatchEvent(new Event('verdexis:prefs'))
  } catch {
    /* ignore */
  }
}

export function initTheme() {
  applyTheme()
  window.addEventListener('storage', (e) => {
    if (e.key === PREFS_KEY) applyTheme()
  })
  window.addEventListener('verdexis:prefs', () => applyTheme())
  const mq = window.matchMedia('(prefers-color-scheme: light)')
  mq.addEventListener('change', () => {
    if (readTheme() === 'auto') applyTheme()
  })
}
