import { randomUUID } from 'node:crypto';

export type LogPayload = Record<string, unknown>;

export function logInfo(event: string, payload: LogPayload = {}): void {
  console.log(
    JSON.stringify({
      level: 'info',
      event,
      ts: new Date().toISOString(),
      ...payload,
    }),
  );
}

export function logError(event: string, payload: LogPayload = {}): void {
  console.error(
    JSON.stringify({
      level: 'error',
      event,
      ts: new Date().toISOString(),
      ...payload,
    }),
  );
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
