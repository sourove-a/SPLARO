import { plainToInstance } from 'class-transformer'
import { IsOptional, IsString, validateSync } from 'class-validator'
import { normalizeCorsOrigin, resolveCorsOriginsFromEnv } from '../cors-origins.util'

class EnvironmentVariables {
  @IsOptional()
  @IsString()
  NODE_ENV?: string

  @IsOptional()
  @IsString()
  DATABASE_URL?: string

  @IsOptional()
  @IsString()
  ADMIN_SESSION_SECRET?: string
}

const PLACEHOLDER_PATTERNS = [
  /change[-_]?me/i,
  /your[-_]/i,
  /placeholder/i,
  /^xxx+$/i,
  /splaro-local-dev/i,
  /splaro-dev-/i,
  /-change-me/i,
]

const LOCALHOST_RE = /localhost|127\.0\.0\.1/i

function envStr(config: Record<string, unknown>, key: string): string {
  const value = config[key]
  return typeof value === 'string' ? value.trim() : ''
}

function isPlaceholder(value: string): boolean {
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(value))
}

function resolveCorsOrigins(config: Record<string, unknown>): string[] {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ...(typeof config.CORS_ORIGINS === 'string' ? { CORS_ORIGINS: config.CORS_ORIGINS } : {}),
    ...(typeof config.CORS_ORIGIN === 'string' ? { CORS_ORIGIN: config.CORS_ORIGIN } : {}),
    ...(typeof config.WEB_URL === 'string' ? { WEB_URL: config.WEB_URL } : {}),
    ...(typeof config.ADMIN_URL === 'string' ? { ADMIN_URL: config.ADMIN_URL } : {}),
    ...(typeof config.NODE_ENV === 'string' ? { NODE_ENV: config.NODE_ENV } : {}),
  }
  return resolveCorsOriginsFromEnv(env)
}

function checkSecret(
  config: Record<string, unknown>,
  key: string,
  minLength: number,
  missing: string[],
  errors: string[],
): void {
  const value = envStr(config, key)
  if (!value) {
    missing.push(key)
    return
  }
  if (value.length < minLength) {
    errors.push(`${key} is too short (minimum ${minLength} characters)`)
  }
  if (isPlaceholder(value)) {
    errors.push(`${key} still contains a placeholder/dev value`)
  }
}

function checkPublicUrl(
  config: Record<string, unknown>,
  key: string,
  errors: string[],
  required = false,
): void {
  const value = envStr(config, key)
  if (!value) {
    if (required) errors.push(`${key} is required in production`)
    return
  }
  if (LOCALHOST_RE.test(value)) {
    errors.push(`${key} must not point at localhost in production`)
  }
}

export function validateEnv(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  })

  const schemaErrors = validateSync(validated, {
    skipMissingProperties: true,
    whitelist: true,
  })

  if (schemaErrors.length > 0) {
    throw new Error(`Environment validation failed:\n${schemaErrors.toString()}`)
  }

  const isProd = config.NODE_ENV === 'production'
  if (!isProd) {
    return config
  }

  const missing: string[] = []
  const errors: string[] = []

  // ── Core secrets (auth, integrations, internal events) ──
  if (!envStr(config, 'DATABASE_URL')) {
    missing.push('DATABASE_URL')
  } else if (!/^postgres(ql)?:\/\//i.test(envStr(config, 'DATABASE_URL'))) {
    errors.push('DATABASE_URL must be a postgresql:// connection string')
  }

  checkSecret(config, 'ADMIN_SESSION_SECRET', 24, missing, errors)
  checkSecret(config, 'INTERNAL_HEALTH_SECRET', 16, missing, errors)
  checkSecret(config, 'ENCRYPTION_KEY', 32, missing, errors)

  // ── CORS — must not boot with localhost fallbacks (main.ts getCorsOrigins) ──
  const corsOrigins = resolveCorsOrigins(config)
  if (!corsOrigins.length) {
    missing.push('CORS_ORIGINS (or WEB_URL + ADMIN_URL)')
  } else {
    const explicit =
      envStr(config, 'CORS_ORIGINS') || envStr(config, 'CORS_ORIGIN') ||
      [envStr(config, 'WEB_URL'), envStr(config, 'ADMIN_URL')].filter(Boolean).join(',')
    for (const part of explicit.split(',')) {
      const trimmed = part.trim()
      if (!trimmed) continue
      const normalized = normalizeCorsOrigin(trimmed)
      if (trimmed !== normalized && trimmed.replace(/\/+$/, '') !== normalized) {
        errors.push(`CORS origin "${trimmed}" should be ${normalized} (no trailing path or slash)`)
      }
    }
    if (corsOrigins.some((origin) => LOCALHOST_RE.test(origin))) {
      errors.push('CORS origins must not include localhost in production')
    }
  }

  // ── Public URLs used by payments, OAuth, webhooks ──
  checkPublicUrl(config, 'WEB_URL', errors, true)
  checkPublicUrl(config, 'ADMIN_URL', errors, true)
  checkPublicUrl(config, 'API_URL', errors, true)
  checkPublicUrl(config, 'NEXT_PUBLIC_SITE_URL', errors)
  checkPublicUrl(config, 'NEXT_PUBLIC_API_URL', errors)

  // ── Dev stubs forbidden on a live store ──
  if (envStr(config, 'PAYMENT_DEV_STUB') === 'true') {
    errors.push('PAYMENT_DEV_STUB=true is forbidden in production')
  }
  if (envStr(config, 'COURIER_DEV_STUB') === 'true') {
    errors.push('COURIER_DEV_STUB=true is forbidden in production')
  }

  // ── Telegram webhook (fixes #2 / #6) ──
  if (envStr(config, 'TELEGRAM_WEBHOOK_URL')) {
    checkSecret(config, 'TELEGRAM_WEBHOOK_SECRET', 16, missing, errors)
    if (LOCALHOST_RE.test(envStr(config, 'TELEGRAM_WEBHOOK_URL'))) {
      errors.push('TELEGRAM_WEBHOOK_URL must be a public HTTPS URL in production')
    }
  }

  // ── Optional payment env keys — if partially set, all must be real ──
  for (const group of [
    { label: 'bKash', keys: ['BKASH_APP_KEY', 'BKASH_APP_SECRET'] },
    { label: 'SSLCommerz', keys: ['SSLCOMMERZ_STORE_ID', 'SSLCOMMERZ_STORE_PASSWORD'] },
    { label: 'Nagad', keys: ['NAGAD_MERCHANT_ID', 'NAGAD_MERCHANT_PRIVATE_KEY'] },
  ]) {
    const present = group.keys.filter((key) => envStr(config, key))
    const placeholders = present.filter((key) => isPlaceholder(envStr(config, key)))
    if (placeholders.length) {
      errors.push(
        `${group.label} payment: ${placeholders.join(', ')} contain placeholder values — configure in .env or Admin only`,
      )
    } else if (present.length > 0 && present.length < group.keys.length) {
      errors.push(`${group.label} payment is partially configured — set all keys or store keys in Admin only`)
    }
  }

  if (missing.length) {
    errors.unshift(`Production requires: ${missing.join(', ')}`)
  }

  if (errors.length) {
    throw new Error(
      `Production environment validation failed:\n${errors.map((line) => `  - ${line}`).join('\n')}\nSet values in .env / hPanel before starting the API.`,
    )
  }

  return config
}
