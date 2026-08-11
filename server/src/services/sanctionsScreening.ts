import type { User } from '@prisma/client'

export interface ScreeningResult {
  sanctioned: boolean
  pepMatch: boolean
  adverseMedia: boolean
  riskScore: number
  flags: string[]
}

type ScreeningProvider = (user: User) => Promise<ScreeningResult>

const LOCAL_HIGH_RISK_COUNTRIES = new Set(['KP', 'IR', 'SY', 'CU'])
const LOCAL_SANCTIONED_NAMES = ['kim jong', 'bashar al-assad', 'vladimir putin', 'nicolas maduro']

function localScreen(user: User): ScreeningResult {
  const flags: string[] = []
  let riskScore = 0
  const country = user.kycCountry?.toUpperCase()
  const name = `${user.kycFirstName ?? ''} ${user.kycLastName ?? ''}`.trim().toLowerCase()

  if (country && LOCAL_HIGH_RISK_COUNTRIES.has(country)) {
    flags.push(`High-risk country: ${country}`)
    riskScore += 40
  }
  if (name && LOCAL_SANCTIONED_NAMES.some((candidate) => name.includes(candidate))) {
    flags.push('Potential sanctions match')
    riskScore += 50
  }

  return {
    sanctioned: riskScore >= 50,
    pepMatch: false,
    adverseMedia: false,
    riskScore: Math.min(100, riskScore),
    flags,
  }
}

async function httpScreen(user: User): Promise<ScreeningResult> {
  const endpoint = process.env.SANCTIONS_SCREENING_URL
  const apiKey = process.env.SANCTIONS_SCREENING_API_KEY
  if (!endpoint || !apiKey) return localScreen(user)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5_000)
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        referenceId: user.id,
        firstName: user.kycFirstName,
        lastName: user.kycLastName,
        country: user.kycCountry,
      }),
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`screening provider returned ${response.status}`)

    const payload = await response.json() as Record<string, unknown>
    const flags = Array.isArray(payload.flags) ? payload.flags.filter((value): value is string => typeof value === 'string') : []
    return {
      sanctioned: payload.sanctioned === true,
      pepMatch: payload.pepMatch === true,
      adverseMedia: payload.adverseMedia === true,
      riskScore: typeof payload.riskScore === 'number' ? Math.max(0, Math.min(100, payload.riskScore)) : 0,
      flags,
    }
  } finally {
    clearTimeout(timeout)
  }
}

let provider: ScreeningProvider = httpScreen

export function setScreeningProvider(nextProvider: ScreeningProvider): void {
  provider = nextProvider
}

export function screenUser(user: User): Promise<ScreeningResult> {
  return provider(user)
}
