import { randomUUID } from 'node:crypto';

export type LogPayload = Record<string, unknown>;

let pinoLoggerPromise: Promise<any | null> | null = null;

const SECRET_KEY_PATTERN = /(pass|password|token|secret|authorization|cookie|api[-_]?key)/i;

function sanitizeValue(value: unknown): unknown {
  if (value === null || typeof value === 'undefined') return value;
  if (Array.isArray(value)) return value.map((item) => sanitizeValue(item));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_KEY_PATTERN.test(k)) {
        const raw = String(v ?? '');
        out[k] = raw ? `${raw.slice(0, 2)}***${raw.slice(-2)}` : '';
      } else {
        out[k] = sanitizeValue(v);
      }
    }
    return out;
  }
  if (typeof value === 'string' && value.length > 5_000) return `${value.slice(0, 5_000)}...[truncated]`;
  return value;
}

async function getPinoLogger(): Promise<any | null> {
  if (pinoLoggerPromise) return pinoLoggerPromise;
  pinoLoggerPromise = (async () => {
    try {
      const dynamicImport = new Function('mod', 'return import(mod)') as (mod: string) => Promise<any>;
      const pinoMod = await dynamicImport('pino');
      const logger = pinoMod.default?.({
        level: process.env.LOG_LEVEL || 'info',
        base: undefined,
      }) || null;
      return logger;
    } catch {
      return null;
    }
  })();
  return pinoLoggerPromise;
}

export function logInfo(event: string, payload: LogPayload = {}): void {
  const sanitized = sanitizeValue(payload) as Record<string, unknown>;
  const body = {
    level: 'info',
    event,
    ts: new Date().toISOString(),
    ...sanitized,
  };
  void getPinoLogger().then((logger) => {
    if (logger?.info) {
      logger.info(body);
      return;
    }
    console.log(JSON.stringify(body));
  });
}

export function logError(event: string, payload: LogPayload = {}): void {
  const sanitized = sanitizeValue(payload) as Record<string, unknown>;
  const body = {
    level: 'error',
    event,
    ts: new Date().toISOString(),
    ...sanitized,
  };
  void getPinoLogger().then((logger) => {
    if (logger?.error) {
      logger.error(body);
      return;
    }
    console.error(JSON.stringify(body));
  });
}

export function buildRequestContext(endpoint: string, requestId?: string) {
  const id = requestId ?? randomUUID();
  const started = Date.now();

  return {
    requestId: id,
    endpoint,
    finish(extra: LogPayload = {}) {
      const durationMs = Date.now() - started;
      logInfo('admin_request', {
        requestId: id,
        endpoint,
        duration_ms: durationMs,
        ...extra,
      });
      return durationMs;
    },
  };
}

export function extractRequestId(headers: Headers): string {
  return headers.get('x-request-id') || randomUUID();
}
