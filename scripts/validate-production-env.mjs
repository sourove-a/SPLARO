#!/usr/bin/env node
/**
 * SPLARO production env validator — fails the build fast when a required
 * variable is missing or still a placeholder. Never prints secret values.
 *
 * Usage:
 *   node scripts/validate-production-env.mjs           # strict when production detected
 *   FORCE_PRODUCTION_ENV_CHECK=1 node scripts/...      # force strict mode locally
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return
  for (const line of readFileSync(filePath, 'utf8').split('\n')) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (!m) continue
    const key = m[1]
    if (process.env[key] !== undefined) continue
    let value = m[2]
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    process.env[key] = value
  }
}

// Load .env without overriding already-exported values (hPanel env wins).
const envFile = process.env.SPLARO_ENV_FILE
  ? resolve(process.env.SPLARO_ENV_FILE)
  : resolve(ROOT, '.env')
if (existsSync(envFile)) {
  loadEnvFile(envFile)
}

const isProduction =
  process.env.FORCE_PRODUCTION_ENV_CHECK === '1' ||
  process.env.NODE_ENV === 'production' ||
  process.env.SPLARO_HOSTINGER === '1' ||
  ROOT.includes('.builds/source/repository')

const REQUIRED = [
  'DATABASE_URL',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'ADMIN_SESSION_SECRET',
  'ENCRYPTION_KEY',
  'REVALIDATE_SECRET',
  'NEXT_PUBLIC_SITE_URL',
  'NEXT_PUBLIC_API_URL',
  'CORS_ORIGINS',
]

const OPTIONAL_GROUPS = {
  Telegram: ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_ADMIN_USER_ID'],
  'SMTP email': ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'],
  'Cloudflare R2': ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET'],
  'Courier (Steadfast)': ['STEADFAST_API_KEY', 'STEADFAST_SECRET_KEY'],
  'Payment (bKash)': ['BKASH_APP_KEY', 'BKASH_APP_SECRET'],
}

// Known unsafe placeholder fragments — never allowed in production values.
const PLACEHOLDER_PATTERNS = [
  /change[-_]?me/i,
  /your[-_]/i,
  /placeholder/i,
  /^xxx+$/i,
  /Splaro@2026!/,
  /splaro-local-dev/i,
  /splaro-dev-/i,
  /-change-me/i,
  /example\.com/i,
]

const PUBLIC_URL_KEYS = ['NEXT_PUBLIC_SITE_URL', 'NEXT_PUBLIC_ADMIN_URL', 'NEXT_PUBLIC_API_URL', 'WEB_URL', 'ADMIN_URL', 'API_URL']

const errors = []
const warnings = []
const ok = []

function isPlaceholder(value) {
  return PLACEHOLDER_PATTERNS.some((re) => re.test(value))
}

for (const key of REQUIRED) {
  const value = process.env[key]?.trim()
  if (!value) {
    errors.push(`${key} is missing`)
    continue
  }
  if (isPlaceholder(value)) {
    errors.push(`${key} still contains a placeholder/dev value — set a real production value`)
    continue
  }
  if (key !== 'DATABASE_URL' && key.endsWith('SECRET') && value.length < 24) {
    errors.push(`${key} is too short (<24 chars) — generate with: openssl rand -base64 48`)
    continue
  }
  ok.push(key)
}

for (const key of PUBLIC_URL_KEYS) {
  const value = process.env[key]?.trim()
  if (!value) continue
  if (/localhost|127\.0\.0\.1/.test(value)) {
    errors.push(`${key} points at localhost (${value.replace(/:[^@/]*@/, ':***@')}) — must be the public production URL`)
  }
}

// DATABASE_URL sanity (never print credentials)
const dbUrl = process.env.DATABASE_URL?.trim()
if (dbUrl) {
  if (!/^postgres(ql)?:\/\//.test(dbUrl)) {
    errors.push('DATABASE_URL is not a postgresql:// URL')
  } else if (/localhost|127\.0\.0\.1/.test(dbUrl)) {
    warnings.push('DATABASE_URL points at localhost — external managed PostgreSQL (Neon/Supabase) is strongly recommended on shared hosting')
  }
}

// Dev stubs must never be on in production
for (const flag of ['PAYMENT_DEV_STUB', 'COURIER_DEV_STUB']) {
  if (process.env[flag]?.trim() === 'true') {
    errors.push(`${flag}=true — dev stubs are forbidden in production (fake success on real orders)`)
  }
}

// Optional integrations — warn only
for (const [label, keys] of Object.entries(OPTIONAL_GROUPS)) {
  const present = keys.filter((k) => process.env[k]?.trim())
  const placeholders = present.filter((k) => isPlaceholder(process.env[k].trim()))
  if (placeholders.length) {
    errors.push(`${label}: ${placeholders.join(', ')} contain placeholder values — set real keys or remove them`)
  } else if (!present.length) {
    warnings.push(`${label} not configured (optional — feature disabled)`)
  } else if (present.length < keys.length) {
    warnings.push(`${label} partially configured (${present.length}/${keys.length} vars) — double-check`)
  } else {
    ok.push(`${label} configured`)
  }
}

console.log('═══ SPLARO production env check ═══')
console.log(`mode: ${isProduction ? 'PRODUCTION (strict)' : 'local (advisory)'}\n`)
for (const item of ok) console.log(`  ✅ ${item}`)
for (const item of warnings) console.log(`  ⚠️  ${item}`)
for (const item of errors) console.log(`  ❌ ${item}`)
console.log('')

if (errors.length && isProduction) {
  console.error(`❌ ${errors.length} blocking problem(s) — fix env in hPanel, then redeploy.`)
  process.exit(1)
}
if (errors.length) {
  console.warn(`⚠️  ${errors.length} problem(s) would BLOCK a production build. Local dev unaffected.`)
  process.exit(0)
}
console.log('✅ Production env OK')
