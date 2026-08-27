/**
 * Normalize sender addresses for Mailgun / SPF / DKIM alignment.
 *
 * Common misconfig: EMAIL_FROM_ADDRESS=noreply@www.example.com
 * while SPF/DKIM are published on example.com (not www).
 * That fails alignment and pushes mail to spam.
 */

export function normalizeFromAddress(raw: string): string {
  const value = String(raw || '').trim()
  if (!value) return value

  // Handle "Name <email@host>" forms
  const angle = value.match(/^(.+?)<\s*([^>]+)\s*>$/)
  if (angle) {
    const name = angle[1].trim()
    const email = normalizeBareEmail(angle[2].trim())
    return name ? `${name} <${email}>` : email
  }

  return normalizeBareEmail(value)
}

function normalizeBareEmail(email: string): string {
  const at = email.lastIndexOf('@')
  if (at < 1) return email.toLowerCase()

  const local = email.slice(0, at).trim()
  let domain = email.slice(at + 1).trim().toLowerCase()

  // Strip leading www. so From matches root domain SPF/DKIM
  if (domain.startsWith('www.')) {
    domain = domain.slice(4)
  }

  return `${local}@${domain}`
}

/** Prefer Reply-To on a real mailbox when From is noreply@. */
export function preferSupportReplyTo(fromAddress: string, configuredReplyTo?: string): string | undefined {
  const reply = (configuredReplyTo || '').trim()
  if (reply) return normalizeFromAddress(reply)

  const from = normalizeFromAddress(fromAddress).toLowerCase()
  if (from.startsWith('noreply@') || from.startsWith('no-reply@')) {
    const domain = from.split('@')[1]
    if (domain) return `support@${domain}`
  }
  return undefined
}
