'use server';

import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { getAdminRole, canManage } from '@/app/admin/_lib/auth';
import { getDbPool } from '@/lib/db';
import {
  INTEGRATION_BY_PROVIDER,
  INTEGRATION_DEFINITIONS,
  type IntegrationCategory,
  type IntegrationMode,
  type IntegrationProvider,
} from '@/lib/integrations';
import { writeAuditLog, writeSystemLog } from '@/lib/log';
import { prisma } from '@/lib/prisma';
import { maskSecret } from '@/lib/security';

export type IntegrationView = {
  provider: IntegrationProvider;
  name: string;
  category: IntegrationCategory;
  description: string;
  isConnected: boolean;
  mode: IntegrationMode;
  updatedAt: string;
  lastTestStatus: string;
  lastTestMessage: string;
  configMask: Record<string, string>;
};

type IntegrationActionResult<T = undefined> = {
  ok: boolean;
  message: string;
  data?: T;
};

type IntegrationPersisted = {
  provider: IntegrationProvider;
  isConnected: boolean;
  mode: IntegrationMode;
  updatedAt: string;
  lastTestStatus: string;
  lastTestMessage: string;
  configMask: Record<string, string>;
};

type ConnectPayload = {
  provider: IntegrationProvider;
  mode?: IntegrationMode;
  values: Record<string, string>;
};

const ENCRYPTION_PREFIX = 'enc:v1';
const FALLBACK_TEST_TIMEOUT_MS = 7000;

const INTERNAL_ENV_FLAGS: Partial<Record<IntegrationProvider, boolean>> = {
  bkash: Boolean(process.env.BKASH_APP_KEY || process.env.BKASH_APP_SECRET),
  nagad: Boolean(process.env.NAGAD_MERCHANT_ID || process.env.NAGAD_MERCHANT_PRIVATE_KEY),
  sslcommerz: Boolean(process.env.SSLCOMMERZ_STORE_ID && process.env.SSLCOMMERZ_STORE_PASSWORD),
  rocket: Boolean(process.env.ROCKET_MERCHANT_ID || process.env.ROCKET_API_KEY),
  pathao: Boolean(process.env.PATHAO_CLIENT_ID && process.env.PATHAO_CLIENT_SECRET),
  steadfast: Boolean(process.env.STEADFAST_API_KEY || process.env.STEADFAST_TOKEN),
  meta: Boolean(process.env.NEXT_PUBLIC_META_PIXEL_ID),
};

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeMode(raw: unknown, fallback: IntegrationMode): IntegrationMode {
  return String(raw || '').trim().toUpperCase() === 'LIVE' ? 'LIVE' : fallback;
}

function normalizeProvider(raw: unknown): IntegrationProvider | null {
  const value = String(raw || '').trim().toLowerCase();
  if (!value) return null;
  if (Object.prototype.hasOwnProperty.call(INTEGRATION_BY_PROVIDER, value)) {
    return value as IntegrationProvider;
  }
  return null;
}

function normalizeValues(values: Record<string, string> | undefined): Record<string, string> {
  const output: Record<string, string> = {};
  for (const [key, value] of Object.entries(values || {})) {
    output[String(key)] = String(value || '').trim();
  }
  return output;
}

function safeJsonParseObject(value: unknown): Record<string, string> {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) {
    return Object.entries(value as Record<string, unknown>).reduce<Record<string, string>>((acc, [key, entry]) => {
      acc[key] = String(entry ?? '');
      return acc;
    }, {});
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return Object.entries(parsed as Record<string, unknown>).reduce<Record<string, string>>((acc, [key, entry]) => {
          acc[key] = String(entry ?? '');
          return acc;
        }, {});
      }
    } catch {
      return {};
    }
  }
  return {};
}

function sanitizePreviewValue(value: string): string {
  return String(value || '').replace(/[\r\n\t]/g, ' ').trim();
}

function maskConfigValues(provider: IntegrationProvider, values: Record<string, string>): Record<string, string> {
  const definition = INTEGRATION_BY_PROVIDER[provider];
  const secretMap = new Map(definition.fields.map((field) => [field.key, Boolean(field.secret)]));
  const out: Record<string, string> = {};

  for (const [key, raw] of Object.entries(values)) {
    const value = sanitizePreviewValue(raw);
    const shouldMask = secretMap.get(key) || /secret|token|password|key/i.test(key);
    out[key] = shouldMask ? maskSecret(value || '********', 2) : value;
  }

  return out;
}

function encryptionKey(): Buffer {
  const seed =
    process.env.INTEGRATION_CONFIG_SECRET ||
    process.env.APP_AUTH_SECRET ||
    process.env.ADMIN_KEY ||
    process.env.APP_ORIGIN ||
    'splaro-integrations-fallback-secret';
  return createHash('sha256').update(seed).digest();
}

function encryptConfig(values: Record<string, string>): string {
  const iv = randomBytes(12);
  const key = encryptionKey();
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const plain = Buffer.from(JSON.stringify(values), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ENCRYPTION_PREFIX}:${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

async function ensureMysqlIntegrationTable(): Promise<void> {
  const db = await getDbPool();
  if (!db) return;

  await db.query(`CREATE TABLE IF NOT EXISTS integrations (
    id VARCHAR(191) NOT NULL PRIMARY KEY,
    name VARCHAR(191) NOT NULL,
    provider VARCHAR(120) NOT NULL,
    category VARCHAR(120) NOT NULL,
    isConnected TINYINT(1) NOT NULL DEFAULT 0,
    mode ENUM('SANDBOX','LIVE') NOT NULL DEFAULT 'SANDBOX',
    config JSON NULL,
    configMask JSON NULL,
    lastTestStatus VARCHAR(40) NULL,
    lastTestMessage TEXT NULL,
    lastTestAt DATETIME(3) NULL,
    updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE KEY integrations_provider_key (provider),
    KEY integrations_category_isConnected_idx (category, isConnected),
    KEY integrations_updatedAt_idx (updatedAt)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

async function fetchPersistedIntegrations(): Promise<Map<IntegrationProvider, IntegrationPersisted>> {
  const mapped = new Map<IntegrationProvider, IntegrationPersisted>();

  const prismaIntegration = process.env.DATABASE_URL ? (prisma as any)?.integration : null;
  if (prismaIntegration) {
    try {
      const rows = (await prismaIntegration.findMany({
        select: {
          provider: true,
          isConnected: true,
          mode: true,
          updatedAt: true,
          lastTestStatus: true,
          lastTestMessage: true,
          configMask: true,
        },
      })) as Array<Record<string, unknown>>;

      for (const row of rows) {
        const provider = normalizeProvider(row.provider);
        if (!provider) continue;
        mapped.set(provider, {
          provider,
          isConnected: Boolean(row.isConnected),
          mode: normalizeMode(row.mode, INTEGRATION_BY_PROVIDER[provider].defaultMode),
          updatedAt: new Date(String(row.updatedAt || nowIso())).toISOString(),
          lastTestStatus: String(row.lastTestStatus || ''),
          lastTestMessage: String(row.lastTestMessage || ''),
          configMask: safeJsonParseObject(row.configMask),
        });
      }
      return mapped;
    } catch {
      // fallback to direct mysql query
    }
  }

  const db = await getDbPool();
  if (!db) return mapped;

  await ensureMysqlIntegrationTable();
  const [rows] = await db.query(
    `SELECT provider, isConnected, mode, updatedAt, lastTestStatus, lastTestMessage, configMask
     FROM integrations`,
  );

  for (const row of (Array.isArray(rows) ? rows : []) as Array<Record<string, unknown>>) {
    const provider = normalizeProvider(row.provider);
    if (!provider) continue;
    mapped.set(provider, {
      provider,
      isConnected: Boolean(Number(row.isConnected) || row.isConnected),
      mode: normalizeMode(row.mode, INTEGRATION_BY_PROVIDER[provider].defaultMode),
      updatedAt: new Date(String(row.updatedAt || nowIso())).toISOString(),
      lastTestStatus: String(row.lastTestStatus || ''),
      lastTestMessage: String(row.lastTestMessage || ''),
      configMask: safeJsonParseObject(row.configMask),
    });
  }

  return mapped;
}

async function persistIntegration(input: {
  provider: IntegrationProvider;
  isConnected: boolean;
  mode: IntegrationMode;
  encryptedConfig: string;
  configMask: Record<string, string>;
  lastTestStatus: string;
  lastTestMessage: string;
  lastTestAt: string;
}): Promise<IntegrationPersisted> {
  const definition = INTEGRATION_BY_PROVIDER[input.provider];
  const prismaIntegration = process.env.DATABASE_URL ? (prisma as any)?.integration : null;

  if (prismaIntegration) {
    try {
      const row = (await prismaIntegration.upsert({
        where: { provider: input.provider },
        create: {
          name: definition.name,
          provider: input.provider,
          category: definition.category,
          isConnected: input.isConnected,
          mode: input.mode,
          config: {
            encrypted: input.encryptedConfig,
          },
          configMask: input.configMask,
          lastTestStatus: input.lastTestStatus,
          lastTestMessage: input.lastTestMessage,
          lastTestAt: new Date(input.lastTestAt),
        },
        update: {
          name: definition.name,
          category: definition.category,
          isConnected: input.isConnected,
          mode: input.mode,
          config: {
            encrypted: input.encryptedConfig,
          },
          configMask: input.configMask,
          lastTestStatus: input.lastTestStatus,
          lastTestMessage: input.lastTestMessage,
          lastTestAt: new Date(input.lastTestAt),
        },
        select: {
          provider: true,
          isConnected: true,
          mode: true,
          updatedAt: true,
          lastTestStatus: true,
          lastTestMessage: true,
          configMask: true,
        },
      })) as Record<string, unknown>;

      return {
        provider: input.provider,
        isConnected: Boolean(row.isConnected),
        mode: normalizeMode(row.mode, definition.defaultMode),
        updatedAt: new Date(String(row.updatedAt || input.lastTestAt)).toISOString(),
        lastTestStatus: String(row.lastTestStatus || input.lastTestStatus),
        lastTestMessage: String(row.lastTestMessage || input.lastTestMessage),
        configMask: safeJsonParseObject(row.configMask),
      };
    } catch {
      // continue to mysql fallback
    }
  }

  const db = await getDbPool();
  if (!db) {
    return {
      provider: input.provider,
      isConnected: input.isConnected,
      mode: input.mode,
      updatedAt: input.lastTestAt,
      lastTestStatus: input.lastTestStatus,
      lastTestMessage: input.lastTestMessage,
      configMask: input.configMask,
    };
  }

  await ensureMysqlIntegrationTable();

  await db.execute(
    `INSERT INTO integrations (id, name, provider, category, isConnected, mode, config, configMask, lastTestStatus, lastTestMessage, lastTestAt)
     VALUES (UUID(), ?, ?, ?, ?, ?, CAST(? AS JSON), CAST(? AS JSON), ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       name = VALUES(name),
       category = VALUES(category),
       isConnected = VALUES(isConnected),
       mode = VALUES(mode),
       config = VALUES(config),
       configMask = VALUES(configMask),
       lastTestStatus = VALUES(lastTestStatus),
       lastTestMessage = VALUES(lastTestMessage),
       lastTestAt = VALUES(lastTestAt),
       updatedAt = CURRENT_TIMESTAMP(3)`,
    [
      definition.name,
      input.provider,
      definition.category,
      input.isConnected ? 1 : 0,
      input.mode,
      JSON.stringify({ encrypted: input.encryptedConfig }),
      JSON.stringify(input.configMask),
      input.lastTestStatus,
      input.lastTestMessage,
      input.lastTestAt,
    ],
  );

  const [rows] = await db.execute(
    `SELECT provider, isConnected, mode, updatedAt, lastTestStatus, lastTestMessage, configMask
     FROM integrations
     WHERE provider = ?
     LIMIT 1`,
    [input.provider],
  );

  const row = Array.isArray(rows) && rows[0] ? (rows[0] as Record<string, unknown>) : {};
  return {
    provider: input.provider,
    isConnected: Boolean(Number(row.isConnected) || row.isConnected || input.isConnected),
    mode: normalizeMode(row.mode, input.mode),
    updatedAt: new Date(String(row.updatedAt || input.lastTestAt)).toISOString(),
    lastTestStatus: String(row.lastTestStatus || input.lastTestStatus),
    lastTestMessage: String(row.lastTestMessage || input.lastTestMessage),
    configMask: safeJsonParseObject(row.configMask),
  };
}

async function disconnectIntegration(provider: IntegrationProvider): Promise<IntegrationPersisted> {
  const definition = INTEGRATION_BY_PROVIDER[provider];
  const now = nowIso();

  return persistIntegration({
    provider,
    isConnected: false,
    mode: definition.defaultMode,
    encryptedConfig: encryptConfig({}),
    configMask: {},
    lastTestStatus: 'DISCONNECTED',
    lastTestMessage: 'Disconnected by admin.',
    lastTestAt: now,
  });
}

async function assertManagePermission(): Promise<IntegrationActionResult> {
  const role = await getAdminRole();
  if (!canManage(role, 'SUPER_ADMIN')) {
    return {
      ok: false,
      message: 'Only Super Admin can edit integration credentials.',
    };
  }
  return { ok: true, message: 'OK' };
}

type ProbeResult = {
  ok: boolean;
  message: string;
  statusCode: number;
  responsePreview: string;
};

async function runProbe(url: string, init: RequestInit): Promise<ProbeResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FALLBACK_TEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...init,
      cache: 'no-store',
      signal: controller.signal,
    });

    const bodyText = await response.text();
    const preview = bodyText.slice(0, 260);

    if (response.status >= 500) {
      return {
        ok: false,
        message: `Provider returned ${response.status}`,
        statusCode: response.status,
        responsePreview: preview,
      };
    }

    return {
      ok: response.status < 500,
      message: response.ok ? 'Connection verified.' : `Endpoint reachable (${response.status}).`,
      statusCode: response.status,
      responsePreview: preview,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      message: message.includes('aborted') ? 'Connection timed out.' : message,
      statusCode: 0,
      responsePreview: '',
    };
  } finally {
    clearTimeout(timer);
  }
}

function validateRequiredFields(provider: IntegrationProvider, values: Record<string, string>): string[] {
  const definition = INTEGRATION_BY_PROVIDER[provider];
  return definition.fields
    .filter((field) => field.required)
    .filter((field) => !values[field.key])
    .map((field) => field.label);
}

async function testProviderConnection(
  provider: IntegrationProvider,
  mode: IntegrationMode,
  values: Record<string, string>,
): Promise<ProbeResult> {
  if (provider === 'bkash') {
    const endpoint =
      mode === 'LIVE'
        ? 'https://tokenized.pay.bka.sh/v1.2.0-beta/tokenized/checkout/token/grant'
        : 'https://tokenized.sandbox.bka.sh/v1.2.0-beta/tokenized/checkout/token/grant';

    const probe = await runProbe(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        username: values.username || values.apiKey,
        password: values.password || values.apiSecret,
      },
      body: JSON.stringify({
        app_key: values.apiKey,
        app_secret: values.apiSecret,
      }),
    });

    if (!probe.ok || probe.statusCode === 401 || probe.statusCode === 403) {
      return {
        ...probe,
        ok: false,
        message: probe.statusCode === 401 || probe.statusCode === 403 ? 'Invalid bKash credentials.' : probe.message,
      };
    }
    return probe;
  }

  if (provider === 'sslcommerz') {
    const base =
      mode === 'LIVE'
        ? 'https://securepay.sslcommerz.com/validator/api/validationserverAPI.php'
        : 'https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php';

    const searchParams = new URLSearchParams({
      val_id: 'SPLARO_TEST',
      store_id: values.storeId,
      store_passwd: values.storePassword,
      v: '1',
      format: 'json',
    });

    const probe = await runProbe(`${base}?${searchParams.toString()}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!probe.ok || probe.statusCode === 401 || probe.statusCode === 403) {
      return {
        ...probe,
        ok: false,
        message:
          probe.statusCode === 401 || probe.statusCode === 403
            ? 'Invalid SSLCommerz credentials.'
            : probe.message,
      };
    }

    return {
      ...probe,
      ok: true,
      message: 'SSLCommerz validation endpoint responded successfully.',
    };
  }

  if (provider === 'nagad') {
    const probe = await runProbe('https://api.mynagad.com/api/dfs/check-out/initialize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Merchant-ID': values.merchantId,
        'X-Api-Key': values.apiKey,
        'X-Api-Secret': values.apiSecret,
      },
      body: JSON.stringify({ merchantId: values.merchantId, requestType: 'HEALTH_CHECK' }),
    });

    if (!probe.ok || probe.statusCode === 401 || probe.statusCode === 403) {
      return {
        ...probe,
        ok: false,
        message: probe.statusCode === 401 || probe.statusCode === 403 ? 'Invalid Nagad credentials.' : probe.message,
      };
    }

    return {
      ...probe,
      ok: true,
      message: 'Nagad endpoint reachable and accepted request.',
    };
  }

  if (provider === 'rocket') {
    const probe = await runProbe('https://rocket.com.bd/', {
      method: 'GET',
      headers: {
        Accept: 'text/html',
      },
    });

    return {
      ...probe,
      ok: probe.ok,
      message: probe.ok ? 'Rocket endpoint reachable.' : probe.message,
    };
  }

  if (provider === 'pathao') {
    const probe = await runProbe('https://api-hermes.pathao.com/aladdin/api/v1/issue-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: values.merchantId,
        client_secret: values.apiSecret,
        grant_type: 'password',
        username: values.apiKey,
        password: values.apiSecret,
      }),
    });

    if (!probe.ok || probe.statusCode === 401 || probe.statusCode === 403) {
      return {
        ...probe,
        ok: false,
        message: probe.statusCode === 401 || probe.statusCode === 403 ? 'Invalid Pathao credentials.' : probe.message,
      };
    }

    return {
      ...probe,
      ok: true,
      message: 'Pathao token endpoint responded.',
    };
  }

  if (provider === 'steadfast') {
    const probe = await runProbe('https://portal.packzy.com/api/v1/status_by_cid/SPLARO_TEST', {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Api-Key': values.apiKey,
        'Store-ID': values.storeId,
      },
    });

    if (!probe.ok || probe.statusCode === 401 || probe.statusCode === 403) {
      return {
        ...probe,
        ok: false,
        message: probe.statusCode === 401 || probe.statusCode === 403 ? 'Invalid Steadfast credentials.' : probe.message,
      };
    }

    return {
      ...probe,
      ok: true,
      message: 'Steadfast API responded successfully.',
    };
  }

  if (provider === 'meta') {
    if (!values.accessToken) {
      return {
        ok: true,
        statusCode: 200,
        message: 'Meta config saved. Add access token for live verification.',
        responsePreview: '',
      };
    }

    const endpoint = `https://graph.facebook.com/v19.0/me?access_token=${encodeURIComponent(values.accessToken)}`;
    const probe = await runProbe(endpoint, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!probe.ok || probe.statusCode === 401 || probe.statusCode === 403) {
      return {
        ...probe,
        ok: false,
        message: probe.statusCode === 401 || probe.statusCode === 403 ? 'Invalid Meta access token.' : probe.message,
      };
    }

    return {
      ...probe,
      ok: true,
      message: 'Meta Graph API token verified.',
    };
  }

  return {
    ok: false,
    statusCode: 0,
    message: 'Unsupported integration provider.',
    responsePreview: '',
  };
}

function mapToView(persisted: Map<IntegrationProvider, IntegrationPersisted>): IntegrationView[] {
  return INTEGRATION_DEFINITIONS.map((definition) => {
    const row = persisted.get(definition.provider);
    const isConnected = row ? row.isConnected : Boolean(INTERNAL_ENV_FLAGS[definition.provider] || definition.defaultConnected);
    return {
      provider: definition.provider,
      name: definition.name,
      category: definition.category,
      description: definition.description,
      isConnected,
      mode: row?.mode || definition.defaultMode,
      updatedAt: row?.updatedAt || nowIso(),
      lastTestStatus: row?.lastTestStatus || (isConnected ? 'CONNECTED' : 'NOT_CONNECTED'),
      lastTestMessage: row?.lastTestMessage || (isConnected ? 'Connected and ready.' : 'Not connected.'),
      configMask: row?.configMask || {},
    };
  });
}

export async function listIntegrationsAction(): Promise<IntegrationActionResult<IntegrationView[]>> {
  try {
    const persisted = await fetchPersistedIntegrations();
    return {
      ok: true,
      message: 'Integrations loaded',
      data: mapToView(persisted),
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Failed to load integrations',
      data: mapToView(new Map<IntegrationProvider, IntegrationPersisted>()),
    };
  }
}

export async function listIntegrationsForPage(): Promise<IntegrationView[]> {
  const snapshot = await listIntegrationsAction();
  return snapshot.data || [];
}

export async function testIntegrationConnectionAction(payload: ConnectPayload): Promise<IntegrationActionResult> {
  try {
    const permission = await assertManagePermission();
    if (!permission.ok) return permission;

    const provider = normalizeProvider(payload.provider);
    if (!provider) return { ok: false, message: 'Invalid provider' };

    const definition = INTEGRATION_BY_PROVIDER[provider];
    const mode = normalizeMode(payload.mode, definition.defaultMode);
    const values = normalizeValues(payload.values);

    const missing = validateRequiredFields(provider, values);
    if (missing.length > 0) {
      return {
        ok: false,
        message: `Required: ${missing.join(', ')}`,
      };
    }

    const probe = await testProviderConnection(provider, mode, values);

    await writeSystemLog({
      eventType: 'INTEGRATION_TEST',
      description: `Provider ${provider} test => ${probe.ok ? 'OK' : 'FAILED'} (${probe.statusCode}) ${probe.message}`,
      ipAddress: 'server-action',
    });

    return {
      ok: probe.ok,
      message: probe.ok ? `${definition.name} connected successfully.` : probe.message,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Integration test failed',
    };
  }
}

export async function connectIntegrationAction(payload: ConnectPayload): Promise<IntegrationActionResult<IntegrationView>> {
  try {
    const permission = await assertManagePermission();
    if (!permission.ok) return permission;

    const provider = normalizeProvider(payload.provider);
    if (!provider) return { ok: false, message: 'Invalid provider' };

    const definition = INTEGRATION_BY_PROVIDER[provider];
    const mode = normalizeMode(payload.mode, definition.defaultMode);
    const values = normalizeValues(payload.values);

    const missing = validateRequiredFields(provider, values);
    if (missing.length > 0) {
      return {
        ok: false,
        message: `Required: ${missing.join(', ')}`,
      };
    }

    const probe = await testProviderConnection(provider, mode, values);
    if (!probe.ok) {
      await writeSystemLog({
        eventType: 'INTEGRATION_CONNECT_FAILED',
        description: `${provider} connect failed (${probe.statusCode}) ${probe.message}`,
        ipAddress: 'server-action',
      });
      return {
        ok: false,
        message: probe.message,
      };
    }

    const encryptedConfig = encryptConfig(values);
    const configMask = maskConfigValues(provider, values);
    const persisted = await persistIntegration({
      provider,
      isConnected: true,
      mode,
      encryptedConfig,
      configMask,
      lastTestStatus: 'CONNECTED',
      lastTestMessage: probe.message,
      lastTestAt: nowIso(),
    });

    await writeAuditLog({
      actorId: 'SUPER_ADMIN',
      action: 'INTEGRATION_CONNECTED',
      entityType: 'integration',
      entityId: provider,
      after: {
        provider,
        mode,
        configMask,
        lastTestMessage: probe.message,
      },
      ipAddress: 'server-action',
    });

    await writeSystemLog({
      eventType: 'INTEGRATION_CONNECTED',
      description: `${provider} connected via admin integrations panel`,
      ipAddress: 'server-action',
    });

    revalidatePath('/admin/integrations');

    return {
      ok: true,
      message: `${definition.name} connected successfully.`,
      data: {
        provider,
        name: definition.name,
        category: definition.category,
        description: definition.description,
        isConnected: true,
        mode: persisted.mode,
        updatedAt: persisted.updatedAt,
        lastTestStatus: persisted.lastTestStatus,
        lastTestMessage: persisted.lastTestMessage,
        configMask: persisted.configMask,
      },
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Failed to connect integration',
    };
  }
}

export async function disconnectIntegrationAction(
  providerInput: IntegrationProvider,
): Promise<IntegrationActionResult<IntegrationView>> {
  try {
    const permission = await assertManagePermission();
    if (!permission.ok) return permission;

    const provider = normalizeProvider(providerInput);
    if (!provider) return { ok: false, message: 'Invalid provider' };

    const definition = INTEGRATION_BY_PROVIDER[provider];
    const persisted = await disconnectIntegration(provider);

    await writeAuditLog({
      actorId: 'SUPER_ADMIN',
      action: 'INTEGRATION_DISCONNECTED',
      entityType: 'integration',
      entityId: provider,
      after: {
        provider,
        isConnected: false,
      },
      ipAddress: 'server-action',
    });

    await writeSystemLog({
      eventType: 'INTEGRATION_DISCONNECTED',
      description: `${provider} disconnected from admin panel`,
      ipAddress: 'server-action',
    });

    revalidatePath('/admin/integrations');

    return {
      ok: true,
      message: `${definition.name} disconnected.`,
      data: {
        provider,
        name: definition.name,
        category: definition.category,
        description: definition.description,
        isConnected: false,
        mode: persisted.mode,
        updatedAt: persisted.updatedAt,
        lastTestStatus: persisted.lastTestStatus,
        lastTestMessage: persisted.lastTestMessage,
        configMask: persisted.configMask,
      },
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Failed to disconnect integration',
    };
  }
}
