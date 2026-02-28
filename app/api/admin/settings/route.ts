import { NextRequest } from 'next/server';
import { withApiHandler } from '../../../../lib/apiRoute';
import { getDbPool } from '../../../../lib/db';
import { jsonError, jsonSuccess, requireAdmin } from '../../../../lib/env';
import { fallbackStore } from '../../../../lib/fallbackStore';
import { writeAuditLog, writeSystemLog } from '../../../../lib/log';
import { sendMail } from '../../../../lib/mailer';

const DEFAULT_SETTINGS = {
  store_name: 'SPLARO',
  support_email: 'info@splaro.co',
  support_phone: '+8801905010205',
  shipping_fee: 120,
  tax_rate: 0,
  currency: 'BDT',
  maintenance_mode: false,
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT || 465),
    secure: String(process.env.SMTP_SECURE || 'true') === 'true',
    user: process.env.SMTP_USER || '',
  },
  telegram: {
    enabled: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
  },
  sheets_sync_enabled: true,
};

type AdminSettings = typeof DEFAULT_SETTINGS & Record<string, unknown>;

function normalizeSettings(value: any): AdminSettings {
  const input = value && typeof value === 'object' ? value : {};
  return {
    ...DEFAULT_SETTINGS,
    ...input,
    smtp: {
      ...DEFAULT_SETTINGS.smtp,
      ...(input.smtp && typeof input.smtp === 'object' ? input.smtp : {}),
    },
    telegram: {
      ...DEFAULT_SETTINGS.telegram,
      ...(input.telegram && typeof input.telegram === 'object' ? input.telegram : {}),
    },
    shipping_fee: Number(input.shipping_fee ?? DEFAULT_SETTINGS.shipping_fee) || 0,
    tax_rate: Number(input.tax_rate ?? DEFAULT_SETTINGS.tax_rate) || 0,
    maintenance_mode: Boolean(input.maintenance_mode),
    sheets_sync_enabled: Boolean(input.sheets_sync_enabled),
  };
}

async function loadSettings(db: any | null): Promise<{ storage: 'mysql' | 'fallback'; settings: AdminSettings }> {
  if (!db) {
    const mem = fallbackStore();
    mem.siteSettings = normalizeSettings(mem.siteSettings);
    return { storage: 'fallback', settings: mem.siteSettings as AdminSettings };
  }

  const [rows] = await db.execute('SELECT setting_value FROM site_settings WHERE setting_key = ? LIMIT 1', ['admin_settings']);
  const raw = Array.isArray(rows) && rows[0] ? (rows[0] as any).setting_value : null;
  let parsed: any = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }

  const settings = normalizeSettings(parsed || DEFAULT_SETTINGS);
  return { storage: 'mysql', settings };
}

async function saveSettings(db: any | null, settings: AdminSettings): Promise<'mysql' | 'fallback'> {
  if (!db) {
    const mem = fallbackStore();
    mem.siteSettings = normalizeSettings(settings);
    return 'fallback';
  }

  await db.execute(
    `INSERT INTO site_settings (setting_key, setting_value)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = CURRENT_TIMESTAMP`,
    ['admin_settings', JSON.stringify(normalizeSettings(settings))],
  );

  return 'mysql';
}

async function sendTelegramTestMessage(): Promise<{ ok: boolean; message: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN || '';
  const chatId = process.env.TELEGRAM_CHAT_ID || '';
  if (!token || !chatId) {
    return { ok: false, message: 'Telegram env not configured' };
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: 'SPLARO admin settings test: Telegram connection is active.',
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return { ok: false, message: `Telegram failed: ${text.slice(0, 120)}` };
    }
    return { ok: true, message: 'Telegram test sent' };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Telegram test failed' };
  }
}

export async function GET(request: NextRequest) {
  return withApiHandler(request, async ({ request: req }) => {
    const admin = requireAdmin(req.headers);
    if (admin.ok === false) return admin.response;

    const db = await getDbPool();
    const result = await loadSettings(db);
    return jsonSuccess({ storage: result.storage, settings: result.settings });
  });
}

export async function PATCH(request: NextRequest) {
  return withApiHandler(request, async ({ request: req, ip }) => {
    const admin = requireAdmin(req.headers);
    if (admin.ok === false) return admin.response;

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return jsonError('INVALID_PAYLOAD', 'Invalid settings payload.', 400);
    }

    const action = String((body as any).action || '').trim().toLowerCase();
    const db = await getDbPool();

    if (action === 'test_smtp') {
      const to = String((body as any).email || process.env.SMTP_USER || '').trim();
      if (!to) return jsonError('INVALID_EMAIL', 'Provide a target email for SMTP test.', 400);

      try {
        await sendMail({
          to,
          subject: 'SPLARO SMTP Test',
          html: '<p>SPLARO SMTP connection test successful.</p>',
          text: 'SPLARO SMTP connection test successful.',
        });
        await writeSystemLog({ eventType: 'SMTP_TEST_SUCCESS', description: `SMTP test sent to ${to}`, ipAddress: ip });
        return jsonSuccess({ storage: db ? 'mysql' : 'fallback', test: { smtp: true, message: `SMTP test sent to ${to}` } });
      } catch (error) {
        return jsonError('SMTP_TEST_FAILED', error instanceof Error ? error.message : 'SMTP test failed', 500);
      }
    }

    if (action === 'test_telegram') {
      const result = await sendTelegramTestMessage();
      if (!result.ok) return jsonError('TELEGRAM_TEST_FAILED', result.message, 500);
      await writeSystemLog({ eventType: 'TELEGRAM_TEST_SUCCESS', description: result.message, ipAddress: ip });
      return jsonSuccess({ storage: db ? 'mysql' : 'fallback', test: { telegram: true, message: result.message } });
    }

    const current = await loadSettings(db);
    const incoming = (body as any).settings && typeof (body as any).settings === 'object' ? (body as any).settings : body;
    const merged = normalizeSettings({ ...current.settings, ...incoming });
    const storage = await saveSettings(db, merged);

    await writeAuditLog({
      action: 'SETTINGS_UPDATED',
      entityType: 'site_settings',
      entityId: 'admin_settings',
      before: current.settings,
      after: merged,
      ipAddress: ip,
    });
    await writeSystemLog({ eventType: 'SETTINGS_UPDATED', description: 'Admin settings updated', ipAddress: ip });

    return jsonSuccess({ storage, settings: merged });
  }, {
    rateLimitScope: 'admin_settings_patch',
    rateLimitLimit: 40,
    rateLimitWindowMs: 60_000,
  });
}

export async function POST(request: NextRequest) {
  return PATCH(request);
}
