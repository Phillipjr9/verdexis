const STORAGE_KEY = 'verdexis_cookie_consent'
const COOKIE_NAME = 'verdexis_cookie_consent'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 year in seconds

type ConsentValue = 'accept' | 'reject'

function parseCookieValue(value: string | null): ConsentValue | null {
  if (value === 'accept' || value === 'reject') return value
  return null
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const value = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
  if (!value) return null
  return decodeURIComponent(value.split('=')[1] || '') || null
}

function setCookie(name: string, value: string) {
  if (typeof document === 'undefined') return
  const attrs = [`path=/`, `max-age=${COOKIE_MAX_AGE}`, 'samesite=lax']
  if (window.location.protocol === 'https:') attrs.push('secure')
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)};${attrs.join(';')}`
}

function clearCookie(name: string) {
  if (typeof document === 'undefined') return
  document.cookie = `${encodeURIComponent(name)}=;path=/;max-age=0;expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

export function getConsentValue(): ConsentValue | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    const parsed = parseCookieValue(stored)
    if (parsed) return parsed
  } catch {
    // ignore localStorage issues
  }

  const fromCookie = parseCookieValue(getCookie(COOKIE_NAME))
  if (fromCookie) {
    try {
      localStorage.setItem(STORAGE_KEY, fromCookie)
    } catch {
      // ignore storage errors
    }
  }
  return fromCookie
}

export function setConsentValue(value: ConsentValue) {
  try {
    localStorage.setItem(STORAGE_KEY, value)
  } catch {
    // ignore localStorage errors
  }
  setCookie(COOKIE_NAME, value)
}

export function clearConsentValue() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore localStorage errors
  }
  clearCookie(COOKIE_NAME)
}

export function consented() {
  return getConsentValue() === 'accept'
}
