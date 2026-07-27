import { z } from 'zod'

// When running tests, provide minimal defaults so env validation doesn't abort the test runner
if (process.env.NODE_ENV === 'test') {
  process.env.DATABASE_URL = process.env.DATABASE_URL || 'file:memory?mode=memory&cache=shared'
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'testjwtsecret000000'
}

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required').default('file:./dev.db'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 chars').default('verdexis-dev-secret-key-2024-minimum-32-chars-required'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGIN: z.string().default('http://localhost:5173,http://localhost:3000'),
  APP_BASE_URL: z.string().default('http://localhost:5173'),
  PRODUCTION_ORIGIN: z.string().optional(),
  ALERT_POLL_ENABLED: z.coerce.boolean().default(true),
  ALERT_POLL_INTERVAL_MS: z.coerce.number().int().min(15_000).default(60_000),
  // Comma-separated list of emails that auto-promote to admin on next login.
  ADMIN_EMAILS: z.string().default(''),
  // Optional admin API secret for machine-to-machine admin calls (set in prod)
  ADMIN_API_SECRET: z.string().optional(),
  // Optional Alpha Vantage API key for historical stock prices used by the
  // admin "deposit + invest as <stock>" flow. Crypto prices come from the
  // free CoinGecko endpoints and don't need a key.
  ALPHA_VANTAGE_KEY: z.string().optional(),
  // Optional CoinGecko API key. Free "Demo" keys use header
  // `x-cg-demo-api-key` against api.coingecko.com; Pro keys use
  // `x-cg-pro-api-key` against pro-api.coingecko.com. Strongly recommended
  // when deploying to a cloud host (Render/Railway/Fly) since CoinGecko
  // aggressively rate-limits/blocks shared cloud egress IPs.
  COINGECKO_API_KEY: z.string().optional(),
  COINGECKO_API_TIER: z.enum(['demo', 'pro']).default('demo'),
  // Optional Coinbase proxy for restricted networks (e.g., Render free tier)
  COINBASE_PROXY_URL: z.string().optional(),
  // Optional Finnhub key (60 req/min free) for stock/forex/crypto news.
  FINNHUB_API_KEY: z.string().optional(),
  // Optional Twelve Data key (800 req/day free) — used as a higher-volume
  // fallback to Alpha Vantage for stock quotes / time series.
  TWELVE_DATA_API_KEY: z.string().optional(),
  // Optional NewsAPI.org key — server-side aggregator used by the News page.
  NEWS_API_KEY: z.string().optional(),
  // Self-ping keep-alive (defeats Render/Railway free-tier sleep).
  // KEEP_ALIVE_URL overrides the auto-detected public URL. Set
  // KEEP_ALIVE_ENABLED=false to disable. Interval defaults to 10 min
  // (Render spins down after 15 min of no traffic).
  KEEP_ALIVE_ENABLED: z.coerce.boolean().default(true),
  KEEP_ALIVE_URL: z.string().optional(),
  KEEP_ALIVE_INTERVAL_MS: z.coerce.number().int().min(60_000).default(10 * 60_000),
  // SMTP configuration for email notifications
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_SECURE: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  SMTP_FROM_NAME: z.string().optional(),
  SMTP_REPLY_TO: z.string().optional(),
  SMTP_UNSUBSCRIBE_URL: z.string().optional(),
  // SMS configuration for OTP delivery
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),
  // AWS configuration for SNS SMS
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().optional(),
  // AWS Cognito for advanced auth
  AWS_COGNITO_USER_POOL_ID: z.string().optional(),
  AWS_COGNITO_CLIENT_ID: z.string().optional(),
  AWS_COGNITO_CLIENT_SECRET: z.string().optional(),
  // AWS Lambda for serverless OTP
  AWS_LAMBDA_OTP_FUNCTION: z.string().optional(),
  // AWS DynamoDB for OTP storage
  AWS_DYNAMODB_OTP_TABLE: z.string().optional(),
  // Security features
  MAX_CONCURRENT_SESSIONS: z.coerce.number().default(5),
  SESSION_TIMEOUT_HOURS: z.coerce.number().default(24),
  TRUST_DEVICE_DAYS: z.coerce.number().default(30),
  OTP_CLEANUP_INTERVAL_HOURS: z.coerce.number().default(1),
  // Fraud detection
  ENABLE_FRAUD_DETECTION: z.coerce.boolean().default(true),
  RISK_SCORE_THRESHOLD: z.coerce.number().default(60),
  AUTO_BLOCK_CRITICAL_RISK: z.coerce.boolean().default(true),
  // Provider integrations
  BTCPAY_SERVER_URL: z.string().optional(),
  BTCPAY_API_KEY: z.string().optional(),
  BTCPAY_STORE_ID: z.string().optional(),
  COINBASE_COMMERCE_KEY: z.string().optional(),
  CRYPTOCOM_PAY_KEY: z.string().optional(),
  CRYPTOCOM_PAY_SECRET: z.string().optional(),
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  // Webhook notifications
  WEBHOOK_SECRET: z.string().optional(),
  SECURITY_WEBHOOK_URL: z.string().optional(),
})

const parsed = schema.safeParse(process.env)
if (!parsed.success) {
  console.error('\n[verdexis-api] Invalid environment configuration:')
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`)
  }
  console.error('\nSee server/.env.example for the required variables.\n')
  process.exit(1)
}

export const env = parsed.data
