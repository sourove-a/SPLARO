import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';

export type StorageMode = 'mysql' | 'fallback';

export type DbEnv = {
  host: string;
  hostCandidates: string[];
  port: number;
  name: string;
  user: string;
  password: string;
  configured: boolean;
  missing: string[];
  databaseUrl?: string;
};

export type RuntimeEnv = {
  db: DbEnv;
  adminKey: string;
  rateLimitWindowMs: number;
  rateLimitMax: number;
};

function env(name: string): string {
  const value = process.env[name];
  return typeof value === 'string' ? value.trim() : '';
}

let didBootstrapEnv = false;

function bootstrapEnvFiles(): void {
  if (didBootstrapEnv) return;
  didBootstrapEnv = true;

  const cwd = process.cwd();
  const candidates = [
    path.join(cwd, '.env.local'),
    path.join(cwd, '.env'),
  ];

  for (const filePath of candidates) {
    if (!fs.existsSync(filePath)) continue;
    const raw = fs.readFileSync(filePath, 'utf8');
    const lines = raw.split(/\r?\n/);

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx < 0) continue;

      const key = trimmed.slice(0, idx).trim();
      let value = trimmed.slice(idx + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      if (key && !process.env[key]) {
        process.env[key] = value;
      }
    }
  }
}

function uniq(values: string[]): string[] {
  const set = new Set<string>();
  values.forEach((value) => {
    const v = value.trim();
    if (v) set.add(v);
  });
  return Array.from(set);
}

function parseDatabaseUrl(raw: string): Partial<Pick<DbEnv, 'host' | 'port' | 'name' | 'user' | 'password'>> {
  if (!raw) return {};

  try {
    const url = new URL(raw);
    return {
      host: url.hostname || undefined,
      port: url.port ? Number(url.port) : undefined,
      name: url.pathname ? url.pathname.replace(/^\//, '') : undefined,
      user: decodeURIComponent(url.username || ''),
      password: decodeURIComponent(url.password || ''),
    };
  } catch {
    return {};
  }
}

export function resolveDbEnv(): DbEnv {
  bootstrapEnvFiles();
  const databaseUrl = env('DATABASE_URL');
  const parsed = parseDatabaseUrl(databaseUrl);

  const host = env('DB_HOST') || parsed.host || '127.0.0.1';
  const hostCandidates = uniq([
    host,
    host === '127.0.0.1' ? 'localhost' : '127.0.0.1',
    host === 'localhost' ? '127.0.0.1' : 'localhost',
  ]);

  const rawPort = env('DB_PORT');
  const port = Number(rawPort || parsed.port || 3306);

  const name = env('DB_NAME') || parsed.name || '';
  const user = env('DB_USER') || parsed.user || '';
  const password = env('DB_PASSWORD') || env('DB_PASS') || parsed.password || '';

  const missing: string[] = [];
  if (!name) missing.push('DB_NAME');
  if (!user) missing.push('DB_USER');
  if (!password) missing.push('DB_PASSWORD');

  return {
    host,
    hostCandidates,
    port: Number.isFinite(port) && port > 0 ? port : 3306,
    name,
    user,
    password,
    configured: missing.length === 0,
    missing,
    databaseUrl: databaseUrl || undefined,
  };
}

export function resolveRuntimeEnv(): RuntimeEnv {
  const rateLimitWindowMs = Number(env('RATE_LIMIT_WINDOW_MS') || 60_000);
  const rateLimitMax = Number(env('RATE_LIMIT_MAX') || 120);

  return {
    db: resolveDbEnv(),
    adminKey: env('ADMIN_KEY'),
    rateLimitWindowMs: Number.isFinite(rateLimitWindowMs) && rateLimitWindowMs > 0 ? rateLimitWindowMs : 60_000,
    rateLimitMax: Number.isFinite(rateLimitMax) && rateLimitMax > 0 ? rateLimitMax : 120,
  };
}

export function jsonError(code: string, message: string, status = 400, extra: Record<string, unknown> = {}) {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
      },
      ...extra,
    },
    { status },
  );
}

export function jsonSuccess<T extends Record<string, unknown>>(payload: T, status = 200) {
  return NextResponse.json(
    {
      success: true,
      ...payload,
    },
    { status },
  );
}

export function requireAdmin(headers: Headers): { ok: true } | { ok: false; response: NextResponse } {
  const expected = resolveRuntimeEnv().adminKey;
  if (!expected) {
    return {
      ok: false,
      response: jsonError('ADMIN_KEY_NOT_CONFIGURED', 'Admin key is not configured.', 500),
    };
  }

  const direct = headers.get('x-admin-key') || '';
  const auth = headers.get('authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const supplied = (direct || bearer).trim();

  if (!supplied || supplied !== expected) {
    return {
      ok: false,
      response: jsonError('UNAUTHORIZED', 'Unauthorized.', 401),
    };
  }

  return { ok: true };
}

export function parsePagination(input: URLSearchParams): {
  page: number;
  pageSize: number;
  offset: number;
} {
  const pageRaw = Number(input.get('page') || 1);
  const pageSizeRaw = Number(input.get('pageSize') || 20);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
  const pageSize = Math.min(100, Math.max(1, Number.isFinite(pageSizeRaw) ? Math.floor(pageSizeRaw) : 20));

  return {
    page,
    pageSize,
    offset: (page - 1) * pageSize,
  };
}

export function requestIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return headers.get('x-real-ip') || 'unknown';
}
