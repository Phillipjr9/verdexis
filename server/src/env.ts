import { z } from 'zod'

/** Strip www. so From domain matches Mailgun SPF (root domain). */
function normalizeEmailFromDomain(email: string): string {
  const v = String(email || '').trim()
  const at = v.lastIndexOf('@')
  if (at < 1) return v
  const local = v.slice(0, at)
  let domain = v.slice(at + 1).toLowerCase()
  if (domain.startsWith('www.')) domain = domain.slice(4)
  return `${local}@${domain}`
}

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
  APP_URL: z.string().default('https://www.verdexisgroup.online'),
  PRODUCTION_ORIGIN: z.string().optional(),
  PASSKEY_RP_ID: z.string().optional(),
  PASSKEY_ORIGIN: z.string().optional(),
  ALERT_POLL_ENABLED: z.coerce.boolean().default(true),
  ALERT_POLL_INTERVAL_MS: z.coerce.number().int().min(15_000).default(60_000),
  ADMIN_EMAILS: z.string().default('admin@verdexisgroup.com'),
  ADMIN_EMAIL: z.string().email().default('admin@verdexisgroup.com'),
  ADMIN_SEED_PASSWORD: z.string().optional(),
  ADMIN_API_SECRET: z.string().optional(),
  ALPHA_VANTAGE_KEY: z.string().optional(),
  COINGECKO_API_KEY: z.string().optional(),
  COINGECKO_API_TIER: z.enum(['demo', 'pro']).default('demo'),
  COINBASE_PROXY_URL: z.string().optional(),
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
  FINNHUB_API_KEY: z.string().optional(),
  TWELVE_DATA_API_KEY: z.string().optional(),
  NEWS_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  VERCEL_AI_KEY: z.string().optional(),
  KEEP_ALIVE_ENABLED: z.coerce.boolean().default(true),
  KEEP_ALIVE_URL: z.string().optional(),
  KEEP_ALIVE_INTERVAL_MS: z.coerce.number().int().min(60_000).default(10 * 60_000),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_SECURE: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional().transform((v) => (v ? normalizeEmailFromDomain(v) : v)),
  SMTP_FROM_NAME: z.string().optional(),
  SMTP_REPLY_TO: z.string().optional(),
  SMTP_UNSUBSCRIBE_URL: z.string().optional(),
  EMAIL_PROVIDER: z.string().optional(),
  EMAIL_API_KEY: z.string().optional(),
  EMAIL_FROM_NAME: z.string().default('Verdexis'),
  // Must match Mailgun verified domain WITHOUT www. (SPF lives on root domain)
  EMAIL_FROM_ADDRESS: z.string().email().default('noreply@verdexisgroup.online').transform(normalizeEmailFromDomain),
  ADMIN_EMAIL_ADDRESS: z.string().email().default('admin@verdexisgroup.com'),
  EMAIL_REPLY_TO: z.string().optional().transform((v) => (v ? normalizeEmailFromDomain(v) : v)),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().optional(),
  AWS_COGNITO_USER_POOL_ID: z.string().optional(),
  AWS_COGNITO_CLIENT_ID: z.string().optional(),
  AWS_COGNITO_CLIENT_SECRET: z.string().optional(),
  AWS_LAMBDA_OTP_FUNCTION: z.string().optional(),
  AWS_DYNAMODB_OTP_TABLE: z.string().optional(),
  MAX_CONCURRENT_SESSIONS: z.coerce.number().default(5),
  SESSION_TIMEOUT_HOURS: z.coerce.number().default(24),
  TRUST_DEVICE_DAYS: z.coerce.number().default(30),
  OTP_CLEANUP_INTERVAL_HOURS: z.coerce.number().default(1),
  ENABLE_FRAUD_DETECTION: z.coerce.boolean().default(true),
  RISK_SCORE_THRESHOLD: z.coerce.number().default(60),
  AUTO_BLOCK_CRITICAL_RISK: z.coerce.boolean().default(true),
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

// Keep process.env in sync so notificationService (reads process.env first) stays SPF-aligned
if (parsed.data.EMAIL_FROM_ADDRESS) process.env.EMAIL_FROM_ADDRESS = parsed.data.EMAIL_FROM_ADDRESS
if (parsed.data.SMTP_FROM) process.env.SMTP_FROM = parsed.data.SMTP_FROM
if (parsed.data.EMAIL_REPLY_TO) process.env.EMAIL_REPLY_TO = parsed.data.EMAIL_REPLY_TO
console.log('[env] EMAIL_FROM_ADDRESS =', parsed.data.EMAIL_FROM_ADDRESS)

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
  SMTP_HOST_SET: !!parsed.data.SMTP_HOST,
  SMTP_USER_SET: !!parsed.data.SMTP_USER,
  SMTP_PASS_SET: !!parsed.data.SMTP_PASS,
  SMTP_PORT: parsed.data.SMTP_PORT || '587',
  EMAIL_FROM_ADDRESS: parsed.data.EMAIL_FROM_ADDRESS,
  EMAIL_FROM_NAME: parsed.data.EMAIL_FROM_NAME,
  ADMIN_EMAIL_ADDRESS: parsed.data.ADMIN_EMAIL_ADDRESS,
  ADMIN_EMAIL: parsed.data.ADMIN_EMAIL,
  ADMIN_EMAILS: parsed.data.ADMIN_EMAILS,
  APP_URL: parsed.data.APP_URL,
}
console.log('[verdexis-api] Environment summary:', JSON.stringify(envSummary, null, 2))
if (!parsed.data.SMTP_HOST || !parsed.data.SMTP_USER || !parsed.data.SMTP_PASS) {
  console.warn('[verdexis-api] SMTP incomplete — signup OTP and transactional email will fail until SMTP_HOST, SMTP_USER, and SMTP_PASS are set.')
}

export const env = parsed.data
