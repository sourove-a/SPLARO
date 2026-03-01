import { randomUUID } from 'node:crypto';

export type ErrorContext = {
  requestId?: string;
  userId?: string | null;
  ip?: string | null;
  path?: string;
  method?: string;
  meta?: Record<string, unknown>;
};

export class AppError extends Error {
  code: string;
  status: number;
  expose: boolean;
  retryable: boolean;
  details?: Record<string, unknown>;

  constructor(input: {
    code: string;
    message: string;
    status?: number;
    expose?: boolean;
    retryable?: boolean;
    details?: Record<string, unknown>;
    cause?: unknown;
  }) {
    super(input.message, input.cause ? { cause: input.cause as Error } : undefined);
    this.name = 'AppError';
    this.code = input.code;
    this.status = Number.isFinite(input.status) ? Number(input.status) : 500;
    this.expose = Boolean(input.expose);
    this.retryable = Boolean(input.retryable);
    this.details = input.details;
  }
}

const TRANSIENT_DB_CODES = new Set<string>([
  'PROTOCOL_CONNECTION_LOST',
  'ECONNRESET',
  'ETIMEDOUT',
  'EPIPE',
  'ER_LOCK_DEADLOCK',
  'ER_LOCK_WAIT_TIMEOUT',
  'ER_CON_COUNT_ERROR',
  'ER_QUERY_TIMEOUT',
  'PROTOCOL_SEQUENCE_TIMEOUT',
  'ER_TOO_MANY_USER_CONNECTIONS',
]);

export function getRequestId(headers?: Headers | null): string {
  const headerId = headers?.get('x-request-id') || headers?.get('x-correlation-id') || '';
  const clean = String(headerId).trim();
  return clean || randomUUID();
}

export function isTransientDbError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = String((error as any).code || '').trim().toUpperCase();
  if (!code) return false;
  return TRANSIENT_DB_CODES.has(code);
}

export function toAppError(error: unknown, fallbackCode = 'INTERNAL_ERROR'): AppError {
  if (error instanceof AppError) return error;

  const message = error instanceof Error ? error.message : String(error || 'Unknown error');
  const status = typeof (error as any)?.status === 'number' ? Number((error as any).status) : 500;
  const expose = status >= 400 && status < 500;
  const retryable = isTransientDbError(error);

  return new AppError({
    code: String((error as any)?.code || fallbackCode),
    message,
    status,
    expose,
    retryable,
    cause: error,
  });
}

export function safePublicErrorMessage(error: AppError): string {
  if (error.expose) return error.message;
  return 'Something went wrong. Please try again.';
}

export async function withOperationTimeout<T>(
  action: () => Promise<T>,
  timeoutMs: number,
  timeoutCode = 'TIMEOUT',
  timeoutMessage = 'Operation timed out.',
): Promise<T> {
  const ms = Math.max(1, Math.floor(timeoutMs));
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new AppError({
        code: timeoutCode,
        message: timeoutMessage,
        status: 504,
        expose: true,
        retryable: true,
      }));
    }, ms);

    action()
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

export async function withRetries<T>(
  action: () => Promise<T>,
  options?: {
    maxRetries?: number;
    baseDelayMs?: number;
    shouldRetry?: (error: unknown) => boolean;
  },
): Promise<T> {
  const maxRetries = Math.min(5, Math.max(0, Number(options?.maxRetries ?? 2)));
  const baseDelayMs = Math.min(5_000, Math.max(50, Number(options?.baseDelayMs ?? 140)));
  const shouldRetry = options?.shouldRetry || isTransientDbError;

  let attempt = 0;
  let lastError: unknown;
  while (attempt <= maxRetries) {
    try {
      return await action();
    } catch (error) {
      lastError = error;
      const retry = attempt < maxRetries && shouldRetry(error);
      if (!retry) {
        throw error;
      }
      const delay = baseDelayMs * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
      attempt += 1;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new AppError({
      code: 'RETRY_EXHAUSTED',
      message: 'Operation failed after retries.',
      status: 500,
    });
}

export function serializeErrorForLog(error: unknown): Record<string, unknown> {
  const appError = toAppError(error);
  const origin = error as any;

  return {
    name: appError.name,
    code: appError.code,
    status: appError.status,
    message: appError.message,
    retryable: appError.retryable,
    stack: appError.stack || (origin?.stack ? String(origin.stack) : undefined),
    cause: origin?.cause ? String(origin.cause) : undefined,
  };
}

export async function logUnhandledError(
  context: ErrorContext,
  error: unknown,
): Promise<void> {
  const errorLog = serializeErrorForLog(error);
  const payload = {
    level: 'error',
    event: 'unhandled_error',
    ts: new Date().toISOString(),
    requestId: context.requestId || '',
    userId: context.userId || null,
    ip: context.ip || null,
    method: context.method || '',
    path: context.path || '',
    ...errorLog,
    meta: context.meta || {},
  };

  console.error(JSON.stringify(payload));

  try {
    const mod = await import('./log');
    await mod.writeSystemLog({
      eventType: 'UNHANDLED_ERROR',
      description: JSON.stringify({
        requestId: context.requestId || '',
        code: String(errorLog.code || ''),
        message: String(errorLog.message || ''),
      }),
      userId: context.userId || null,
      ipAddress: context.ip || null,
    });
  } catch {
    // system log failed; console output above already keeps trace.
  }
}
