import { z } from 'zod';

const envSchema = z.object({
  DB_HOST: z.string().min(1),
  DB_PORT: z.string().min(1),
  DB_NAME: z.string().min(1),
  DB_USER: z.string().min(1),
  ADMIN_KEY: z.string().min(16),
  APP_AUTH_SECRET: z.string().min(16).optional(),
  RATE_LIMIT_WINDOW_MS: z.string().optional(),
  RATE_LIMIT_MAX: z.string().optional(),
  REDIS_URL: z.string().url().optional().or(z.literal('')),
  UPSTASH_REDIS_REST_URL: z.string().url().optional().or(z.literal('')),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
});

export function getEnvValidationReport(): {
  ok: boolean;
  missing: string[];
  warnings: string[];
} {
  const raw = {
    DB_HOST: process.env.DB_HOST || '',
    DB_PORT: process.env.DB_PORT || '',
    DB_NAME: process.env.DB_NAME || '',
    DB_USER: process.env.DB_USER || '',
    ADMIN_KEY: process.env.ADMIN_KEY || '',
    APP_AUTH_SECRET: process.env.APP_AUTH_SECRET || '',
    RATE_LIMIT_WINDOW_MS: process.env.RATE_LIMIT_WINDOW_MS || '',
    RATE_LIMIT_MAX: process.env.RATE_LIMIT_MAX || '',
    REDIS_URL: process.env.REDIS_URL || '',
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL || '',
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN || '',
  };

  const parsed = envSchema.safeParse(raw);
  const warnings: string[] = [];
  if (raw.REDIS_URL && !raw.UPSTASH_REDIS_REST_URL) {
    warnings.push('Using REDIS_URL without REST fallback.');
  }
  if (!process.env.DB_PASSWORD && !process.env.DB_PASS && !process.env.DB_PASSWORD_URLENC) {
    warnings.push('No DB password source configured.');
  }
  if (!process.env.SSLCOMMERZ_STORE_ID || !process.env.SSLCOMMERZ_STORE_PASSWORD) {
    warnings.push('SSLCommerz is not fully configured.');
  }
  if (!process.env.STEADFAST_API_KEY && !process.env.STEADFAST_TOKEN) {
    warnings.push('Steadfast is not configured.');
  }

  if (parsed.success) {
    return {
      ok: true,
      missing: [],
      warnings,
    };
  }

  const missing = parsed.error.issues
    .filter((issue) => issue.code === 'too_small' || issue.code === 'invalid_string')
    .map((issue) => String(issue.path[0] || ''))
    .filter(Boolean);

  return {
    ok: missing.length === 0,
    missing,
    warnings,
  };
}
