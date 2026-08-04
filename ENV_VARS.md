ENVIRONMENT VARIABLES FOR DEPLOYMENT

This repo deploys in three pieces:
- Frontend: Cloudflare Pages builds and serves `app/`
- Firebase: frontend client-side auth/database uses `VITE_FIREBASE_*` values
- Backend/API: AWS ECS/ECR deploys `server/` and connects to AWS RDS Postgres via `DATABASE_URL`

Fill in the values (keep secrets out of source control). Use the Vercel dashboard or GitHub secrets to store them.

1) CI / Deployment (GitHub + Vercel)
- VERCEL_TOKEN: <your_vercel_token>
- VERCEL_ORG_ID: <vercel_org_id>
- VERCEL_PROJECT_ID: <vercel_project_id>
- APP_HEALTHCHECK_URL: https://your-app.example.com/health (optional)

2) Frontend (`app/`)
- VITE_API_URL: https://api.yourdomain.com
- VITE_CDN_URL: https://cdn.yourdomain.com (optional)
- Any other VITE_* keys used in `app/` (e.g., VITE_FIREBASE_API_KEY)

3) Backend / Server (`server/`)
- DATABASE_URL: postgres://user:pass@host:5432/dbname or file:./vercel.db (for SQLite)
- DATABASE_PROVIDER: postgresql | sqlite | mysql
- JWT_SECRET: <strong_random_secret>
- REDIS_URL: redis://:password@redis-host:6379
- SMTP_HOST: smtp.example.com
- SMTP_PORT: 587
- SMTP_USER: <smtp_user>
- SMTP_PASS: <smtp_pass>
- SMTP_SECURE: 'true' or 'false'
- SMTP_FROM: noreply@yourdomain.com
- SES_FROM_EMAIL: noreply@yourdomain.com (if using AWS SES)
- SENTRY_DSN: <optional_sentry_dsn>

Email DNS requirements
----------------------
- Add a TXT record for your sending domain with SPF to authorize the service that sends email for `SMTP_FROM` / `SES_FROM_EMAIL`.
- Example for AWS SES:

  `v=spf1 include:amazonses.com -all`

- Example for SendGrid:

  `v=spf1 include:sendgrid.net -all`

- If you use a custom SMTP provider, use its recommended SPF include value, e.g.:

  `v=spf1 a mx include:_spf.yourprovider.com -all`

- Also configure DKIM and DMARC if available to improve deliverability and prevent spoofing.
- Add a DMARC TXT record for your sending domain to enforce policy and reporting, for example:

  `v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain.com; ruf=mailto:dmarc@yourdomain.com; pct=100; sp=none; aspf=s; adkim=s`

4) Cloud / Provider keys
- AWS_REGION: us-east-1
- AWS_ACCESS_KEY_ID: <aws_key_id>
- AWS_SECRET_ACCESS_KEY: <aws_secret>
- AWS_COGNITO_USER_POOL_ID
- AWS_COGNITO_CLIENT_ID
- AWS_COGNITO_CLIENT_SECRET

5) Third-party / API keys
- OPENAI_API_KEY
- GOOGLE_GENAI_API_KEY
- GOOGLE_GENAI_PROJECT_ID
- GOOGLE_GENAI_LOCATION (default: us-central1)
- GOOGLE_GENAI_MODEL (default: chat-bison@002)
- ANTHROPIC_API_KEY
- INFURA_PROJECT_ID
- ETHERSCAN_API_KEY
- SOLANA_RPC_URL
- ETHEREUM_RPC_ENDPOINT
- SIMPLEHASH_API_KEY (if used)
- TWILIO_ACCOUNT_SID
- TWILIO_AUTH_TOKEN
- TWILIO_PHONE_NUMBER
- FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_CONFIG
- KYC_ENCRYPTION_KEY

6) Blockchain / Wallets (if used)
- ETHEREUM_WITHDRAWAL_PRIVATE_KEY
- SOLANA_WITHDRAWAL_PRIVATE_KEY

7) Optional / Test keys
- TESTSPRITE_API_KEY
- DEBUG (set to true/false locally)

Notes
- Do NOT commit secrets into source control.
- For Vite keys, prefix with `VITE_` so they are exposed to the frontend build.
- For Vercel, add variables in the Project > Settings > Environment Variables.
- For GitHub Actions, add repo secrets under Settings > Secrets and variables > Actions.

Once you fill this file, tell me and I will generate exact `gh` and `vercel` CLI commands to set the values for your repo and project.

Cloudflare Pages (frontend-only)
--------------------------------
- CF_API_TOKEN: <your_cloudflare_api_token> (Pages:Edit/Deploy)
- CF_PAGES_PROJECT_NAME: <pages_project_name>
- Any `VITE_` variables used by the `app/` build (set these in Pages > Settings > Environment Variables):
	- VITE_API_URL
	- VITE_CDN_URL
	- VITE_FIREBASE_*

Notes for Cloudflare Pages:
- If you use `wrangler pages publish` in CI, ensure `CF_API_TOKEN` and `CF_PAGES_PROJECT_NAME` are set as GitHub Actions secrets.
- Alternatively, configure Build command: `cd app && npm ci && npm run build` and Output directory: `app/dist` in the Pages project settings.

Render (backend / full stack)
-----------------------------
Render will run your backend service and needs the full set of server env vars. Below are the primary values you must provide in the Render service's Environment > Environment Variables section:
- DATABASE_URL: postgres://user:pass@host:5432/dbname  (or a managed DB connection string)
- DATABASE_PROVIDER: postgresql | sqlite | mysql
- JWT_SECRET
- REDIS_URL (if using background jobs/queues)
- SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE, SMTP_FROM
- SES_FROM_EMAIL (if using AWS SES)
- AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
- AWS_COGNITO_USER_POOL_ID, AWS_COGNITO_CLIENT_ID, AWS_COGNITO_CLIENT_SECRET
- SENTRY_DSN (optional)
- OPENAI_API_KEY, ANTHROPIC_API_KEY (if AI features used)
- INFURA_PROJECT_ID, ETHERSCAN_API_KEY, SOLANA_RPC_URL, ETHEREUM_RPC_ENDPOINT
- TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER
- FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_CONFIG
- KYC_ENCRYPTION_KEY
- ETHEREUM_WITHDRAWAL_PRIVATE_KEY, SOLANA_WITHDRAWAL_PRIVATE_KEY (if used)

Render migration notes — your "old database" failure
--------------------------------------------------
- Cause: Render is likely pointing to an older database (older schema/data) than the server expects.
- Fix overview:
	1. Provision a new, up-to-date database (managed Postgres is recommended).
	2. Set `DATABASE_URL` on the Render service to the new DB connection string.
	3. Run Prisma migrations on the new DB before or as part of deploy. Example commands you can run locally (after setting `DATABASE_URL` locally):

```bash
# Install dependencies
cd server
npm ci

# Generate client and run migrations
npx prisma generate
npx prisma migrate deploy

# Build server
npm run build
```

	4. If you need existing data from the old DB, dump and restore it to the new DB (pg_dump / pg_restore) and then run migrations or data migration scripts as needed.
	5. Add the `DATABASE_URL` and other env vars to the Render service and trigger a deploy.

Render-specific deployment hint:
- In Render Dashboard, under your Service > Deploys, you can add a Post-Deploy Command such as `npx prisma migrate deploy` so migrations run automatically after each deploy.

Security reminder
-----------------
- Never commit secrets into source control. Use Render Dashboard or Cloudflare Pages settings (or CI secrets) to store values.

Next step
---------
- Paste the Render `DATABASE_URL` and any other secret values you have, or tell me which ones you want me to prepare commands for, and I will generate exact steps (or CLI commands) to set them on Cloudflare Pages and Render.
