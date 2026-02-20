import { getDbPool, getStorageInfo } from '../../../lib/db';
import { jsonSuccess } from '../../../lib/env';

export async function GET() {
  const started = Date.now();
  const db = await getDbPool();
  const info = await getStorageInfo();

  const latencyMs = db ? Date.now() - started : null;

  return jsonSuccess({
    ok: true,
    db: {
      connected: Boolean(db),
      latency_ms: latencyMs,
      storage: info.storage,
      host: info.dbHost,
      name: info.dbName,
      port: info.dbPort,
      error: info.error || null,
    },
  });
}
