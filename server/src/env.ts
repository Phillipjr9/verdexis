import { z } from 'zod'

// When running tests, provide minimal defaults so env validation doesn't abort the test runner
if (process.env.NODE_ENV === 'test') {
  process.env.DATABASE_URL = process.env.DATABASE_URL || 'file:memory?mode=memory&cache=shared'
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'testjwtsecret000000'
}

const optionalNonEmptyString = z.preprocess((value) => {
  if (typeof value === 'string' && value.trim() === '') return undefined
  return value
}, z.string().min(1).optional())

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_PROVIDER: z.enum(['postgresql', 'sqlite']).default('postgresql'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required').default('postgresql://postgres:postgres@127.0.0.1:5432/verdexis'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 chars').default('verdexis-dev-secret-key-2024-minimum-32-chars-required'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGIN: z.string().default('http://localhost:5173,http://localhost:3000'),
  APP_BASE_URL: z.string().default('http://localhost:5173'),
  APP_URL: z.string().default('https://www.verdexisgroup.com'),
  PRODUCTION_ORIGIN: z.string().optional(),
  PASSKEY_RP_ID: z.string().optional(),
  PASSKEY_ORIGIN: z.string().optional(),
  ALERT_POLL_ENABLED: z.coerce.boolean().default(true),
  ALERT_POLL_INTERVAL_MS: z.coerce.number().int().min(15_000).default(60_000),
  // Comma-separated list of emails that auto-promote to admin on next login.
  ADMIN_EMAILS: z.string().default('admin@verdexisgroup.com'),
  ADMIN_EMAIL: z.string().email().default('admin@verdexisgroup.com'),
  // Optional seed password for the initial super-admin bootstrap.
  ADMIN_SEED_PASSWORD: z.string().optional(),
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
  // Optional blockchain RPC endpoints for custodial withdrawals.
  ETHEREUM_RPC_ENDPOINT: z.string().url().optional(),
  ETHEREUM_WITHDRAWAL_PRIVATE_KEY: optionalNonEmptyString,
  SOLANA_RPC_ENDPOINT: z.string().url().optional(),
  SOLANA_WITHDRAWAL_PRIVATE_KEY: optionalNonEmptyString,
  BSC_RPC_ENDPOINT: z.string().url().optional(),
  BSC_WITHDRAWAL_PRIVATE_KEY: optionalNonEmptyString,
  ALCHEMY_PAYMASTER_POLICY_ID: z.string().min(1).optional(),
  BTC_WITHDRAWAL_ENABLED: z.coerce.boolean().default(false),
  BNB_TOKEN_ADDRESS: z.string().optional(),
  ETHEREUM_TOKEN_ADDRESS: z.string().optional(),
  BSC_TOKEN_ADDRESS: z.string().optional(),
  ETHEREUM_TOKEN_SYMBOL: z.string().optional(),
  // Optional Finnhub key (60 req/min free) for stock/forex/crypto news.
  FINNHUB_API_KEY: z.string().optional(),
  // Optional Twelve Data key (800 req/day free) — used as a higher-volume
  // fallback to Alpha Vantage for stock quotes / time series.
  TWELVE_DATA_API_KEY: z.string().optional(),
  // Optional NewsAPI.org key — server-side aggregator used by the News page.
  NEWS_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  VERCEL_AI_KEY: z.string().optional(),
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
  EMAIL_PROVIDER: z.string().optional(),
  EMAIL_API_KEY: z.string().optional(),
  EMAIL_FROM_NAME: z.string().default('Verdexis'),
  EMAIL_FROM_ADDRESS: z.string().email().default('no-reply@verdexisgroup.com'),
  ADMIN_EMAIL_ADDRESS: z.string().email().default('admin@verdexisgroup.com'),
  EMAIL_REPLY_TO: z.string().optional(),
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
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_DATABASE_URL: z.string().url().optional(),
  FIREBASE_DB_LISTEN_PATH: z.string().default('/users'),
  GOOGLE_GENAI_API_KEY: z.string().optional(),
  GOOGLE_GENAI_PROJECT_ID: z.string().optional(),
  GOOGLE_GENAI_LOCATION: z.string().default('us-central1'),
  GOOGLE_GENAI_MODEL: z.string().default('chat-bison@002'),
  // Webhook notifications
  WEBHOOK_SECRET: z.string().optional(),
  SECURITY_WEBHOOK_URL: z.string().optional(),
})

const maskSecret = (value: string | undefined): string => {
  if (!value) return '<unset>'
  try {
    const url = new URL(value)
    if (url.password) url.password = '***'
    return url.toString()
  } catch {
    if (value.length > 32) return `${value.slice(0, 16)}...${value.slice(-8)}`
    return value
  }
}

const parsed = schema.safeParse(process.env)
if (!parsed.success) {
  console.error('\n[verdexis-api] Invalid environment configuration:')
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`)
  }
  console.error('\nSee server/.env.example for the required variables.\n')
  process.exit(1)
}

const envSummary = {
  NODE_ENV: parsed.data.NODE_ENV,
  PORT: parsed.data.PORT,
  DATABASE_PROVIDER: parsed.data.DATABASE_PROVIDER,
  DATABASE_URL: maskSecret(process.env.DATABASE_URL),
  DATABASE_URL_SET: !!process.env.DATABASE_URL,
  JWT_SECRET_SET: !!process.env.JWT_SECRET,
  CORS_ORIGIN: parsed.data.CORS_ORIGIN,
  APP_BASE_URL: parsed.data.APP_BASE_URL,
  PRODUCTION_ORIGIN: parsed.data.PRODUCTION_ORIGIN,
  PASSKEY_RP_ID_SET: !!parsed.data.PASSKEY_RP_ID,
  PASSKEY_ORIGIN_SET: !!parsed.data.PASSKEY_ORIGIN,
  SUPABASE_URL_SET: !!parsed.data.SUPABASE_URL,
  FIREBASE_PROJECT_ID_SET: !!parsed.data.FIREBASE_PROJECT_ID,
  FIREBASE_DATABASE_URL_SET: !!parsed.data.FIREBASE_DATABASE_URL,
  FIREBASE_DB_LISTEN_PATH: parsed.data.FIREBASE_DB_LISTEN_PATH,
  GOOGLE_GENAI_API_KEY_SET: !!parsed.data.GOOGLE_GENAI_API_KEY,
  REDIS_URL_SET: !!process.env.REDIS_URL,
  OPENAI_API_KEY_SET: !!process.env.OPENAI_API_KEY,
  VERCEL_AI_KEY_SET: !!process.env.VERCEL_AI_KEY,
  ETHEREUM_RPC_ENDPOINT_SET: !!parsed.data.ETHEREUM_RPC_ENDPOINT,
  SOLANA_RPC_ENDPOINT_SET: !!parsed.data.SOLANA_RPC_ENDPOINT,
  BSC_RPC_ENDPOINT_SET: !!parsed.data.BSC_RPC_ENDPOINT,
  ALCHEMY_PAYMASTER_POLICY_ID_SET: !!parsed.data.ALCHEMY_PAYMASTER_POLICY_ID,
  BTC_WITHDRAWAL_ENABLED: parsed.data.BTC_WITHDRAWAL_ENABLED,
  ETHEREUM_TOKEN_ADDRESS_SET: !!parsed.data.ETHEREUM_TOKEN_ADDRESS,
  BSC_TOKEN_ADDRESS_SET: !!parsed.data.BSC_TOKEN_ADDRESS,
  BNB_TOKEN_ADDRESS_SET: !!parsed.data.BNB_TOKEN_ADDRESS,
  AWS_COGNITO_USER_POOL_ID_SET: !!parsed.data.AWS_COGNITO_USER_POOL_ID,
}
console.log('[verdexis-api] Environment summary:', JSON.stringify(envSummary, null, 2))

export const env = parsed.data
