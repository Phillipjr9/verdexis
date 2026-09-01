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

export const emailLogoUrl = (companyInfo?.branding?.logo && companyInfo.branding.logo.length)
  ? companyInfo.branding.logo
  : `https://www.verdexisgroup.online/assets/logo-icon-transparent.png`

export const whatsappUrl = `https://wa.me/${companyInfo.contact.whatsapp.replace(/\D/g, '')}`
export const telegramUrl = companyInfo.contact.telegram.startsWith('http')
  ? companyInfo.contact.telegram
  : `https://${companyInfo.contact.telegram}`

export function formatEmailAddress(address: string, name = customerEmailName): string {
  return `${name} <${address}>`
}

/**
 * Single, centered support strip shown near the top of customer emails.
 * WhatsApp / Telegram / Support live here only — never again in the footer.
 */
export function customerSupportBlock(): string {
  return `<table role="presentation" data-vx-support="1" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 22px">
  <tr>
    <td align="center" style="padding:0">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:520px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px">
        <tr>
          <td align="center" style="padding:16px 18px 8px">
            <p style="margin:0;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#64748b;font-weight:700">Client support</p>
            <p style="margin:6px 0 0;font-size:14px;line-height:1.5;color:#0f172a">Questions about your account? Our team is available on the channel you prefer.</p>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:4px 12px 16px">
            <a href="${emailLinks.support}" style="display:inline-block;margin:6px 5px;padding:9px 14px;border-radius:999px;background:#0C8B44;color:#ffffff;text-decoration:none;font-size:13px;font-weight:700">Support Center</a>
            <a href="${whatsappUrl}" style="display:inline-block;margin:6px 5px;padding:9px 14px;border-radius:999px;background:#ffffff;border:1px solid #bbf7d0;color:#166534;text-decoration:none;font-size:13px;font-weight:700">WhatsApp</a>
            <a href="${telegramUrl}" style="display:inline-block;margin:6px 5px;padding:9px 14px;border-radius:999px;background:#ffffff;border:1px solid #bae6fd;color:#0369a1;text-decoration:none;font-size:13px;font-weight:700">Telegram</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`
}

/** Legal / brand footer only. No Support, WhatsApp, or Telegram links. */
export function customerEmailFooter(): string {
  const year = new Date().getFullYear()
  const address = typeof companyInfo.getFormattedAddress === 'function'
    ? companyInfo.getFormattedAddress()
    : `${companyInfo.address.street}, ${companyInfo.address.city}, ${companyInfo.address.state} ${companyInfo.address.zip}`
  return `<div data-vx-legal-footer="1" style="margin:28px 0 0;padding-top:18px;border-top:1px solid #e5e7eb;text-align:center">
  <p style="font-size:13px;line-height:1.6;color:#64748b;margin:0">
    <img src="${emailLogoUrl}" alt="${companyInfo.name}" width="20" height="20" style="display:inline-block;vertical-align:middle;margin-right:6px" />
    <strong style="vertical-align:middle;color:#0f172a">${companyInfo.name}</strong>
  </p>
  <p style="font-size:12px;line-height:1.6;color:#94a3b8;margin:8px 0 0">
    ${address}<br />
    <a href="${emailLinks.website}" style="color:#0C8B44;text-decoration:none">${emailLinks.website.replace(/^https?:\/\//, '')}</a>
  </p>
  <p style="font-size:12px;line-height:1.6;color:#94a3b8;margin:10px 0 0">
    <a href="${emailLinks.privacy}" style="color:#64748b;text-decoration:none">Privacy</a>
    &nbsp;·&nbsp;
    <a href="${emailLinks.terms}" style="color:#64748b;text-decoration:none">Terms</a>
    &nbsp;·&nbsp;
    <a href="${emailLinks.security}" style="color:#64748b;text-decoration:none">Security</a>
  </p>
  <p style="font-size:11px;line-height:1.5;color:#94a3b8;margin:12px 0 0">
    © ${year} ${companyInfo.name}. All rights reserved.<br />
    Trading digital assets involves risk of loss. This message is confidential and intended only for the addressee.
  </p>
</div>`
}
