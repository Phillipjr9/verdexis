# Verdexis email environment checklist

Use this on every deployment (Render, Vercel, Docker, local). All signup OTP, password reset, welcome, and admin alert mail depend on these variables.

## Required (mail will not send without these)

| Variable | Production value | Purpose |
| --- | --- | --- |
| `SMTP_HOST` | e.g. `smtp.mailgun.org` | SMTP server |
| `SMTP_PORT` | `587` (STARTTLS) or `465` (TLS) | Port |
| `SMTP_SECURE` | `false` for 587, `true` for 465 | TLS mode |
| `SMTP_USER` | provider login | SMTP auth user (also used as envelope MAIL FROM for SPF) |
| `SMTP_PASS` | provider password | SMTP auth password |

## Sender identities (must match DNS / provider authorized senders)

| Variable | Production value | Used for |
| --- | --- | --- |
| `EMAIL_FROM_ADDRESS` | `no-reply@verdexisgroup.com` | Customer mail From (OTP, reset, welcome, digests) |
| `EMAIL_FROM_NAME` | `Verdexis` | Customer display name |
| `ADMIN_EMAIL_ADDRESS` | `admin@verdexisgroup.com` | Admin mail From |
| `SMTP_FROM` | `no-reply@verdexisgroup.com` | Optional alias; falls back to `EMAIL_FROM_ADDRESS` |
| `SMTP_FROM_NAME` | `Verdexis` | Optional alias for `EMAIL_FROM_NAME` |

## Admin recipients (allowlist — non-listed addresses are dropped)

| Variable | Production value | Used for |
| --- | --- | --- |
| `ADMIN_EMAIL` | `admin@verdexisgroup.com` | Primary admin recipient |
| `ADMIN_EMAILS` | `admin@verdexisgroup.com` (comma-separated for more) | Full allowlist for deposit / new-user alerts |

## Links inside emails

| Variable | Production value | Used for |
| --- | --- | --- |
| `APP_BASE_URL` | `https://www.verdexisgroup.com` | Password-reset links, tracking base |
| `APP_URL` | `https://www.verdexisgroup.com` | Footer / admin deep links |

## Optional

| Variable | Purpose |
| --- | --- |
| `EMAIL_REPLY_TO` / `SMTP_REPLY_TO` | Reply-To on customer mail |
| `SMTP_UNSUBSCRIBE_URL` | List-Unsubscribe header + footer |
| `EMAIL_PROVIDER` / `EMAIL_API_KEY` | Metadata only (nodemailer uses SMTP_*) |

## Policy (do not change without updating DNS + code)

- **Customer From:** `Verdexis <no-reply@verdexisgroup.com>`
- **Admin From:** `Verdexis Admin <admin@verdexisgroup.com>`
- **Admin To:** only addresses in `ADMIN_EMAIL` + `ADMIN_EMAILS`
- Provider must authorize both from-addresses (or as aliases of `SMTP_USER`)
- SPF / DKIM / DMARC: see `docs/VERDEXIS_EMAIL_DNS.md`

## How the code resolves senders

`server/src/notificationService.ts` → `resolveEmailTransportConfig()`:

1. Customer From = `EMAIL_FROM_ADDRESS` → else `SMTP_FROM` → else default `no-reply@...`
2. Envelope MAIL FROM = `SMTP_USER` when set (SPF alignment)
3. Admin From = `ADMIN_EMAIL_ADDRESS`
4. Admin recipients = intersection of requested addresses with `ADMIN_EMAIL` + `ADMIN_EMAILS`

## Startup check

On boot the API logs SMTP set-flags (booleans only) plus From/admin addresses.

If SMTP is incomplete:

`SMTP incomplete — signup OTP and transactional email will fail until SMTP_HOST, SMTP_USER, and SMTP_PASS are set.`

Also hit `GET /api/health/email` after deploy (no secrets returned).

## Copy-paste for Render / Vercel dashboard

```env
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM=no-reply@verdexisgroup.com
SMTP_FROM_NAME=Verdexis
EMAIL_FROM_NAME=Verdexis
EMAIL_FROM_ADDRESS=no-reply@verdexisgroup.com
ADMIN_EMAIL_ADDRESS=admin@verdexisgroup.com
ADMIN_EMAIL=admin@verdexisgroup.com
ADMIN_EMAILS=admin@verdexisgroup.com
APP_BASE_URL=https://www.verdexisgroup.com
APP_URL=https://www.verdexisgroup.com
```

Replace `SMTP_USER` / `SMTP_PASS` / host with your real provider values. Do not leave them empty in production.
