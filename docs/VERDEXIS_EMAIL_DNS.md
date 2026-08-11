# Verdexis Email DNS

## Production identity

- Sending domain: `verdexisgroup.com`
- Customer sender: `Verdexis <no-reply@verdexisgroup.com>`
- Internal sender: `Verdexis <admin@verdexisgroup.com>`
- Customer support URL: `https://www.verdexisgroup.com/support`

## Provider status

The application currently uses Nodemailer with a generic SMTP transport. The provider is selected at deployment through `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, and `SMTP_PASS`. No provider-specific DNS values are present in this repository.

Do not publish guessed SPF, DKIM, or DMARC values. Before production sending:

1. Select the SMTP provider and verify `verdexisgroup.com` in that provider's dashboard.
2. Copy the exact SPF record/value supplied by the provider. Add it to the single existing SPF TXT record for the domain; do not create multiple SPF records.
3. Copy every DKIM selector, hostname, record type, and value supplied by the provider. Add each record exactly as supplied.
4. Publish a DMARC TXT record for `_dmarc.verdexisgroup.com` using the organization's approved policy and reporting mailbox. The policy must be approved before enforcement; do not invent a reporting address.
5. Confirm SPF, DKIM, and DMARC alignment for `no-reply@verdexisgroup.com` and `admin@verdexisgroup.com`.
6. Send test messages to external mailboxes and verify authentication results in the received headers.

## Application configuration

Set these server environment variables without committing credentials:

```env
APP_URL=https://www.verdexisgroup.com
EMAIL_FROM_NAME=Verdexis
EMAIL_FROM_ADDRESS=no-reply@verdexisgroup.com
ADMIN_EMAIL_ADDRESS=admin@verdexisgroup.com
ADMIN_EMAIL=admin@verdexisgroup.com
EMAIL_REPLY_TO=
EMAIL_PROVIDER=<selected-provider>
EMAIL_API_KEY=<provider-secret-if-required>
SMTP_HOST=<provider-smtp-host>
SMTP_PORT=<provider-smtp-port>
SMTP_SECURE=<provider-setting>
SMTP_USER=<provider-smtp-user>
SMTP_PASS=<provider-smtp-password>
```

`EMAIL_REPLY_TO` is intentionally empty by default. Customer messages direct users to the support page and do not depend on replies to the no-reply address.

## Security requirements

- Keep provider credentials in the deployment secret manager.
- Never put private keys, passwords, seed phrases, API secrets, or full financial credentials in email.
- Customer-facing automated messages use only `no-reply@verdexisgroup.com`.
- Internal operational alerts use only `admin@verdexisgroup.com` or configured internal administrator recipients.
- Re-check DNS after provider changes and before sending production mail.
