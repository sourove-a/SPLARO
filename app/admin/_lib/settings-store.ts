import { getDbPool } from '@/lib/db';
import { fallbackStore } from '@/lib/fallbackStore';

function parseJsonValue<T>(raw: unknown, fallbackValue: T): T {
  if (raw == null) return fallbackValue;
  if (typeof raw === 'object') return raw as T;
  if (typeof raw !== 'string' || !raw.trim()) return fallbackValue;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallbackValue;
  }
}

export async function readAdminSetting<T>(key: string, fallbackValue: T): Promise<T> {
  const db = await getDbPool();
  if (!db) {
    const mem = fallbackStore();
    const raw = (mem.siteSettings as Record<string, unknown>)[key];
    return parseJsonValue<T>(raw, fallbackValue);
  }

  const [rows] = await db.execute(
    'SELECT setting_value FROM site_settings WHERE setting_key = ? LIMIT 1',
    [key],
  );
  const raw = Array.isArray(rows) && rows[0] ? (rows[0] as any).setting_value : null;
  return parseJsonValue<T>(raw, fallbackValue);
}

export async function writeAdminSetting<T>(key: string, value: T): Promise<'mysql' | 'fallback'> {
  const db = await getDbPool();
  if (!db) {
    const mem = fallbackStore();
    (mem.siteSettings as Record<string, unknown>)[key] = value;
    return 'fallback';
  }

  await db.execute(
    `INSERT INTO site_settings (setting_key, setting_value)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = CURRENT_TIMESTAMP`,
    [key, JSON.stringify(value)],
  );
  return 'mysql';
}
