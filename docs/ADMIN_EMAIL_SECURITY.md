# Secure admin email delivery

## Changes applied in notificationService.ts

1. **Fixed HTML escaping** — `& < > "` now correctly become entities (was broken and allowed HTML injection into admin emails).
2. **Recipient allowlist** — only `ADMIN_EMAIL` / `ADMIN_EMAILS` / `ADMIN_EMAIL_ADDRESS` may receive admin mail. Arbitrary addresses are dropped.
3. **SPF-aligned envelope** — display From remains `Verdexis Admin <admin@verdexisgroup.com>`; SMTP MAIL FROM uses `SMTP_USER` when set.
4. **No customer tracking** — admin path does not add List-Unsubscribe, Reply-To, or UTM tracking links.
5. **Subject sanitization** — strips CR/LF (header injection) and truncates to 200 chars.
6. **Safer logging** — logs recipient count + subject prefix only (not full bodies or PII dumps).
7. **High importance** — optional Importance / X-Priority headers for urgent alerts (new users, etc.).

## Required env

```env
ADMIN_EMAIL=admin@verdexisgroup.com
ADMIN_EMAILS=admin@verdexisgroup.com
ADMIN_EMAIL_ADDRESS=admin@verdexisgroup.com
SMTP_HOST=...
SMTP_USER=...
SMTP_PASS=...
```

Ensure the SMTP provider authorizes sending as `admin@verdexisgroup.com` (or as an alias of `SMTP_USER`).

## Note on multi-admin deposit alerts

`depositAlerts.ts` passes each DB admin email into `sendAdminEmailNotification`. Those addresses must appear in `ADMIN_EMAILS` or the message is blocked. Add every operational admin mailbox to `ADMIN_EMAILS`.
