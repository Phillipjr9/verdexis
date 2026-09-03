declare global {
  interface Window {
    dataLayer: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

const AW_ID = 'AW-18425098842'
const AW_SEND_TO = 'AW-18425098842/6dD-CIam2-wcENrk4tFE'
const FIRED_KEY = 'verdexis_aw_signup_fired'

function gtag(...args: unknown[]) {
  if (typeof window === 'undefined') return
  window.dataLayer = window.dataLayer || []
  if (typeof window.gtag === 'function') {
    window.gtag(...args)
    return
  }
  window.dataLayer.push(args)
}

export function fireSignupConversion(reason = 'signup') {
  if (typeof window === 'undefined') return
  try {
    if (sessionStorage.getItem(FIRED_KEY) === '1') return
    sessionStorage.setItem(FIRED_KEY, '1')
  } catch { /* ignore */ }

  gtag('event', 'sign_up', { method: 'email', send_to: AW_ID })
  gtag('event', 'conversion', {
    send_to: AW_SEND_TO,
    value: 10.0,
    currency: 'USD',
  })
  window.dataLayer.push({ event: 'verdexis_signup', reason, send_to: AW_SEND_TO })
}

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.toString()
  return input.url
}

const origFetch = window.fetch.bind(window)
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = urlOf(input)
  const method = String(init?.method || (typeof input !== 'string' && !(input instanceof URL) ? input.method : 'GET') || 'GET').toUpperCase()
  const res = await origFetch(input, init)
  if (!res.ok || method !== 'POST') return res
  const isSignup =
    /\/api\/auth\/signup\/verify-otp(?:\?|$)/.test(url) ||
    /\/api\/auth\/signup(?:\?|$)/.test(url)
  if (!isSignup) return res
  try {
    const copy = res.clone()
    const body = await copy.json() as { token?: string; otpRequired?: boolean; pendingToken?: string }
    if (body?.token && !body.otpRequired && !body.pendingToken) {
      fireSignupConversion(url.includes('verify-otp') ? 'verify-otp' : 'signup')
    }
  } catch { /* ignore */ }
  return res
}
