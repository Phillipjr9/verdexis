# Email deliverability (Mailgun)

## Required Render env

```
EMAIL_FROM_ADDRESS=noreply@verdexisgroup.online
EMAIL_FROM_NAME=Verdexis
EMAIL_REPLY_TO=support@verdexisgroup.online
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=2525
SMTP_USER=noreply@verdexisgroup.online
SMTP_PASS=...
```

**Do not use `www.` in the From domain.**
SPF is on `verdexisgroup.online`, not `www.verdexisgroup.online`.

## Mailgun dashboard checklist

1. Domain `verdexisgroup.online` is **Verified** (not only www)
2. DNS records present: SPF, DKIM (k1._domainkey), optional DMARC
3. Not stuck in **Sandbox** (sandbox only delivers to authorized recipients)
4. Sending domain matches EMAIL_FROM_ADDRESS domain

## Why only OTP / welcome arrive

- OTP uses a direct SMTP path (more reliable)
- Welcome goes through the same pipeline when verified
- Credit/debit emails need the latest deploy **and** a From address that passes SPF
