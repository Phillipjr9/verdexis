import { env } from '../env.js'
import { companyInfo } from './company.js'

export const customerEmailAddress = env.EMAIL_FROM_ADDRESS
export const customerEmailName = env.EMAIL_FROM_NAME
export const adminEmailAddress = env.ADMIN_EMAIL_ADDRESS
export const adminEmailRecipients = Array.from(new Set(
  [env.ADMIN_EMAIL, ...env.ADMIN_EMAILS.split(',')]
    .map((address) => address.trim().toLowerCase())
    .filter(Boolean),
))
export const emailReplyTo = (env.EMAIL_REPLY_TO || '').trim() || undefined
export const appUrl = (env.APP_URL || 'https://www.verdexisgroup.online').replace(/\/$/, '')

export const emailLinks = {
  website: appUrl,
  support: `${appUrl}/support`,
  privacy: `${appUrl}/privacy`,
  terms: `${appUrl}/terms`,
  security: `${appUrl}/security`,
}

// Prefer an explicit public logo from companyInfo.branding when available;
// fall back to the app assets path.
// Force the email logo to use the public site wordmark to ensure consistency
// in all clients. Prefer the explicit company branding.logo if set, otherwise
// point at the public site logo on the verdexisgroup domain.
export const emailLogoUrl = (companyInfo?.branding?.logo && companyInfo.branding.logo.length)
  ? companyInfo.branding.logo
  : `https://www.verdexisgroup.online/assets/logo-icon-transparent.png`
const whatsappUrl = `https://wa.me/${companyInfo.contact.whatsapp.replace(/\D/g, '')}`
const telegramUrl = companyInfo.contact.telegram.startsWith('http')
  ? companyInfo.contact.telegram
  : `https://${companyInfo.contact.telegram}`

export function formatEmailAddress(address: string, name = customerEmailName): string {
  return `${name} <${address}>`
}

export function customerEmailFooter(): string {
  return `<hr style="border:0;border-top:1px solid #e5e7eb;margin:28px 0 16px" />
<p style="font-size:12px;line-height:1.6;color:#64748b;margin:0">
  <img src="${emailLogoUrl}" alt="${companyInfo.name}" width="20" height="20" style="display:inline-block;vertical-align:middle;margin-right:6px" /><strong style="vertical-align:middle">${companyInfo.name}</strong><br />
  <a href="${emailLinks.website}">verdexisgroup.com</a><br />
  Support: <a href="${emailLinks.support}">Support</a><br />
  <a href="${emailLinks.privacy}">Privacy</a> ·
  <a href="${emailLinks.terms}">Terms</a> ·
  <a href="${emailLinks.security}">Security</a>
  <br /><br />
  <a href="${whatsappUrl}" style="display:inline-block;margin-right:10px;color:#166534;text-decoration:none">WhatsApp support</a>
  <a href="${telegramUrl}" style="display:inline-block;color:#0369a1;text-decoration:none">Telegram support</a>
</p>`
}