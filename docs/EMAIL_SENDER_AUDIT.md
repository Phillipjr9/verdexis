# Verdexis Email Sender Audit

## Policy

Verdexis has exactly two application sender identities:

- Customer: `Verdexis <no-reply@verdexisgroup.com>`
- Internal/admin: `Verdexis Admin <admin@verdexisgroup.com>`

Customer support is directed to `https://www.verdexisgroup.com/support`; no support mailbox is used.

## Runtime implementation

| Sender | Runtime source | Use |
| --- | --- | --- |
| `no-reply@verdexisgroup.com` | `server/src/config/email.ts`, `server/src/notificationService.ts` | All customer email and notification paths |
| `admin@verdexisgroup.com` | `server/src/config/email.ts`, `server/src/notificationService.ts` | Internal/admin operational alerts |

Customer email routes include authentication, security, account, KYC, financial, trading, investment, portfolio, referral, support-ticket, system, and marketing notifications when enabled. Daily portfolio digests and the legacy OTP service now use the centralized customer sender.

## Address search results

- `no-reply@verdexisgroup.com`: customer sender configuration and company metadata.
- `admin@verdexisgroup.com`: admin identity configuration, bootstrap/authorization checks, and internal sender configuration.
- `security@`, `support@`, `notifications@`, and `compliance@`: no runtime sender occurrences found in `server/src`.

The `ADMIN_EMAILS` setting is an internal recipient allowlist. It does not change the admin From address, which is fixed by `ADMIN_EMAIL_ADDRESS`.

## Required configuration

```env
EMAIL_FROM_NAME=Verdexis
EMAIL_FROM_ADDRESS=no-reply@verdexisgroup.com
ADMIN_EMAIL_ADDRESS=admin@verdexisgroup.com
EMAIL_REPLY_TO=
```

SMTP credentials remain deployment secrets. The provider must independently authorize both sender identities; successful SMTP login alone does not prove alias authorization.

## Historical/documentation records

Historical reports, fixtures, and documentation were not blindly rewritten. This audit covers executable server sender paths and their centralized configuration.

## Verification status

- Customer sender centralized: implemented.
- Admin sender centralized: implemented.
- Direct customer SMTP bypasses: removed from daily digest and legacy OTP paths.
- Provider verification: local SMTP handshake passed for the configured Gmail account; provider-side sender authorization must be checked for both addresses.
- SPF/DKIM/DMARC: provider-specific values remain documented as pending provider DNS instructions in `docs/VERDEXIS_EMAIL_DNS.md`.
