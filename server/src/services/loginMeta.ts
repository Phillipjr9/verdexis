import type { Request } from 'express'
import { prisma } from '../db.js'

export type LoginGeo = {
  country?: string
  countryCode?: string
  region?: string
  city?: string
  latitude?: number
  longitude?: number
  timezone?: string
  isp?: string
}

export function getClientIp(req: Request): string | null {
  const raw =
    (typeof req.headers['cf-connecting-ip'] === 'string' && req.headers['cf-connecting-ip']) ||
    (typeof req.headers['x-real-ip'] === 'string' && req.headers['x-real-ip']) ||
    (typeof req.headers['x-forwarded-for'] === 'string' && req.headers['x-forwarded-for'].split(',')[0]) ||
    req.ip ||
    (req.socket && req.socket.remoteAddress) ||
    ''
  const ip = String(raw).trim().replace(/^::ffff:/, '')
  return ip || null
}

function isPrivateIp(ip: string): boolean {
  return (
    ip === '::1' ||
    ip === '127.0.0.1' ||
    ip.startsWith('10.') ||
    ip.startsWith('192.168.') ||
    ip.startsWith('172.16.') ||
    ip.startsWith('172.17.') ||
    ip.startsWith('172.18.') ||
    ip.startsWith('172.19.') ||
    ip.startsWith('172.2') ||
    ip.startsWith('172.30.') ||
    ip.startsWith('172.31.')
  )
}

async function lookupGeo(ip: string): Promise<LoginGeo | null> {
  if (!ip || isPrivateIp(ip)) return null
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 2500)
  try {
    const url = `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,countryCode,regionName,city,lat,lon,timezone,isp`
    const res = await fetch(url, { signal: ctrl.signal })
    if (!res.ok) return null
    const data = await res.json() as Record<string, unknown>
    if (data.status !== 'success') return null
    return {
      country: typeof data.country === 'string' ? data.country : undefined,
      countryCode: typeof data.countryCode === 'string' ? data.countryCode : undefined,
      region: typeof data.regionName === 'string' ? data.regionName : undefined,
      city: typeof data.city === 'string' ? data.city : undefined,
      latitude: typeof data.lat === 'number' ? data.lat : undefined,
      longitude: typeof data.lon === 'number' ? data.lon : undefined,
      timezone: typeof data.timezone === 'string' ? data.timezone : undefined,
      isp: typeof data.isp === 'string' ? data.isp : undefined,
    }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export async function recordLastLogin(userId: string, req: Request): Promise<void> {
  const ip = getClientIp(req)
  const geo = ip ? await lookupGeo(ip) : null
  const row = await prisma.user.findUnique({ where: { id: userId }, select: { prefs: true } })
  let prefs: Record<string, unknown> = {}
  try {
    prefs = row?.prefs ? JSON.parse(row.prefs) : {}
    if (!prefs || typeof prefs !== 'object' || Array.isArray(prefs)) prefs = {}
  } catch {
    prefs = {}
  }
  const security = (prefs.security && typeof prefs.security === 'object' && !Array.isArray(prefs.security))
    ? { ...(prefs.security as Record<string, unknown>) }
    : {}
  security.lastLogin = {
    at: new Date().toISOString(),
    ip,
    userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null,
    geo,
  }
  prefs.security = security
  await prisma.user.update({
    where: { id: userId },
    data: { prefs: JSON.stringify(prefs) },
  })
}
