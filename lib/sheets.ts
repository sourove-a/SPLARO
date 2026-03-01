import { setTimeout as sleep } from 'node:timers/promises';
import { getValidGoogleAccessToken, readSecureJson, writeSecureJson } from './googleAuth';
import { logError, logInfo } from './logger';
import { withCircuitBreaker } from './circuitBreaker';

const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4';
const REQUEST_TIMEOUT_MS = 5_000;
const REQUEST_RETRIES = 2;
const SHEET_TITLE = 'SPLARO_DB';
const STORAGE_KEY = 'google-sheets-meta';

export const REQUIRED_TABS = {
  ORDERS: [
    'order_id',
    'created_at',
    'name',
    'email',
    'phone',
    'address',
    'district',
    'thana',
    'product_name',
    'product_url',
    'image_url',
    'quantity',
    'notes',
    'status',
  ],
  USERS: ['user_id', 'created_at', 'name', 'email', 'phone', 'district', 'thana', 'address', 'source', 'verified'],
  SUBSCRIPTIONS: ['sub_id', 'created_at', 'email', 'consent', 'source'],
} as const;

export type RequiredTabName = keyof typeof REQUIRED_TABS;

type StoredSheetMeta = {
  spreadsheetId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type TabRows = {
  tab: string;
  headers: string[];
  rows: Record<string, string>[];
};

type GoogleSpreadsheetMetadataResponse = {
  spreadsheetId?: string;
  sheets?: Array<{ properties?: { title?: string; sheetId?: number } }>;
};

type GoogleBatchValuesResponse = {
  valueRanges?: Array<{ values?: string[][] }>;
};

type GoogleValuesResponse = {
  values?: string[][];
};

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/\s+/g, '_');
}

function rowToObject(headers: string[], row: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((header, index) => {
    out[header] = (row[index] || '').trim();
  });
  return out;
}

function toStringValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

function headersMatch(actual: string[], expected: string[]): boolean {
  if (actual.length < expected.length) return false;
  for (let i = 0; i < expected.length; i += 1) {
    if ((actual[i] || '').trim() !== expected[i]) {
      return false;
    }
  }
  return true;
}

async function withGoogleApi<T>(
  label: string,
  action: (accessToken: string) => Promise<Response>,
): Promise<T> {
  let attempt = 0;
  let forceRefresh = false;
  let lastError: unknown;

  while (attempt <= REQUEST_RETRIES) {
    attempt += 1;
    const started = Date.now();

    try {
      const token = await getValidGoogleAccessToken({ forceRefresh });
      const response = await action(token);
      const latencyMs = Date.now() - started;

      if (response.status === 401 && !forceRefresh) {
        forceRefresh = true;
        logInfo('google_api_refresh_retry', { label, attempt, latency_ms: latencyMs });
        continue;
      }

      const text = await response.text();
      let payload: unknown = null;
      if (text) {
        try {
          payload = JSON.parse(text);
        } catch {
          payload = text;
        }
      }

      if (!response.ok) {
        const message =
          typeof payload === 'object' && payload && 'error' in payload
            ? JSON.stringify((payload as { error: unknown }).error)
            : String(payload || `Google API failed (${response.status})`);
        throw new Error(message);
      }

      logInfo('google_api_call', { label, attempt, latency_ms: latencyMs });
      return payload as T;
    } catch (error) {
      lastError = error;
      logError('google_api_call_failed', {
        label,
        attempt,
        error: error instanceof Error ? error.message : String(error),
      });

      if (attempt <= REQUEST_RETRIES) {
        await sleep(220 * attempt);
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`Google API failed: ${label}`);
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function requestGoogleJson<T>(
  label: string,
  path: string,
  init: Omit<RequestInit, 'headers'> & { headers?: Record<string, string> } = {},
): Promise<T> {
  return withCircuitBreaker('google_sheets_api', () =>
    withGoogleApi<T>(label, async (accessToken) => {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${accessToken}`,
        ...(init.headers || {}),
      };

      const hasBody = init.body !== undefined;
      if (hasBody && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
      }

      return fetchWithTimeout(`${SHEETS_API_BASE}${path}`, {
        ...init,
        headers,
      });
    })
  );
}

async function getStoredSpreadsheetMeta(): Promise<StoredSheetMeta | null> {
  return readSecureJson<StoredSheetMeta>(STORAGE_KEY);
}

async function saveSpreadsheetMeta(meta: StoredSheetMeta): Promise<void> {
  await writeSecureJson(STORAGE_KEY, meta);
}

async function readSpreadsheetMetadata(spreadsheetId: string): Promise<GoogleSpreadsheetMetadataResponse> {
  return requestGoogleJson<GoogleSpreadsheetMetadataResponse>(
    'read_spreadsheet_metadata',
    `/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=spreadsheetId,sheets.properties.title,sheets.properties.sheetId`,
    { method: 'GET' },
  );
}

export async function getSpreadsheetId(): Promise<string | null> {
  const meta = await getStoredSpreadsheetMeta();
  return meta?.spreadsheetId || null;
}

export async function createSpreadsheetIfMissing(): Promise<{ spreadsheetId: string; created: boolean }> {
  const stored = await getStoredSpreadsheetMeta();

  if (stored?.spreadsheetId) {
    try {
      await readSpreadsheetMetadata(stored.spreadsheetId);
      return { spreadsheetId: stored.spreadsheetId, created: false };
    } catch {
      // spreadsheet was removed or inaccessible; create a new one
    }
  }

  const created = await requestGoogleJson<GoogleSpreadsheetMetadataResponse>('create_spreadsheet', '/spreadsheets', {
    method: 'POST',
    body: JSON.stringify({
      properties: {
        title: SHEET_TITLE,
      },
    }),
  });

  if (!created.spreadsheetId) {
    throw new Error('Google did not return spreadsheetId after creation');
  }

  const now = new Date().toISOString();
  await saveSpreadsheetMeta({
    spreadsheetId: created.spreadsheetId,
    title: SHEET_TITLE,
    createdAt: now,
    updatedAt: now,
  });

  return { spreadsheetId: created.spreadsheetId, created: true };
}

async function ensureTabExists(spreadsheetId: string, tabName: RequiredTabName): Promise<void> {
  const metadata = await readSpreadsheetMetadata(spreadsheetId);
  const existingTabs = new Set((metadata.sheets || []).map((sheet) => sheet.properties?.title).filter(Boolean) as string[]);

  if (existingTabs.has(tabName)) return;

  await requestGoogleJson('add_missing_tab', `/spreadsheets/${encodeURIComponent(spreadsheetId)}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      requests: [
        {
          addSheet: {
            properties: {
              title: tabName,
            },
          },
        },
      ],
    }),
  });
}

async function ensureHeaderRow(spreadsheetId: string, tabName: RequiredTabName, headers: readonly string[]): Promise<void> {
  const headerRange = `${tabName}!1:1`;
  const existing = await requestGoogleJson<GoogleValuesResponse>(
    'read_header_row',
    `/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(headerRange)}`,
    { method: 'GET' },
  );

  const existingHeader = existing.values?.[0] || [];
  if (headersMatch(existingHeader, [...headers])) {
    return;
  }

  await requestGoogleJson(
    'write_header_row',
    `/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(headerRange)}?valueInputOption=RAW`,
    {
      method: 'PUT',
      body: JSON.stringify({
        range: headerRange,
        majorDimension: 'ROWS',
        values: [[...headers]],
      }),
    },
  );
}

export async function ensureTabsAndHeaders(spreadsheetIdInput?: string): Promise<string> {
  const spreadsheetId = spreadsheetIdInput || (await createSpreadsheetIfMissing()).spreadsheetId;
  const tabs = Object.keys(REQUIRED_TABS) as RequiredTabName[];

  for (const tab of tabs) {
    await ensureTabExists(spreadsheetId, tab);
    await ensureHeaderRow(spreadsheetId, tab, REQUIRED_TABS[tab]);
  }

  const stored = await getStoredSpreadsheetMeta();
  const now = new Date().toISOString();
  await saveSpreadsheetMeta({
    spreadsheetId,
    title: stored?.title || SHEET_TITLE,
    createdAt: stored?.createdAt || now,
    updatedAt: now,
  });

  return spreadsheetId;
}

export async function appendRow(tabName: RequiredTabName, values: unknown[]): Promise<void> {
  const created = await createSpreadsheetIfMissing();
  const spreadsheetId = await ensureTabsAndHeaders(created.spreadsheetId);

  const row = values.map(toStringValue);
  const appendRange = `${tabName}!A:ZZ`;

  await requestGoogleJson(
    'append_row',
    `/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(appendRange)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      body: JSON.stringify({
        majorDimension: 'ROWS',
        values: [row],
      }),
    },
  );
}

export async function listRows(tabName: RequiredTabName, limit = 1000): Promise<Record<string, string>[]> {
  const spreadsheetId = await ensureTabsAndHeaders();
  const range = `${tabName}!A1:ZZ`;

  const response = await requestGoogleJson<GoogleValuesResponse>(
    'list_rows',
    `/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`,
    { method: 'GET' },
  );

  const rows = response.values || [];
  if (rows.length === 0) return [];

  const headers = (rows[0] || []).map(normalizeHeader);
  const bodyRows = rows.slice(1, 1 + Math.max(1, limit));
  return bodyRows.map((row) => rowToObject(headers, row));
}

export async function findRow(tabName: RequiredTabName, query: Record<string, string>): Promise<Record<string, string> | null> {
  const rows = await listRows(tabName, 5000);

  return (
    rows.find((row) =>
      Object.entries(query).every(([key, value]) => (row[key] || '').trim().toLowerCase() === value.trim().toLowerCase()),
    ) || null
  );
}

export async function updateRow(tabName: RequiredTabName, rowIndex: number, values: unknown[]): Promise<void> {
  const spreadsheetId = await ensureTabsAndHeaders();
  const range = `${tabName}!A${rowIndex}:ZZ${rowIndex}`;

  await requestGoogleJson('update_row', `/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({
      majorDimension: 'ROWS',
      values: [values.map(toStringValue)],
    }),
  });
}

export async function batchReadTabs(tabNames: string[]): Promise<TabRows[]> {
  if (tabNames.length === 0) return [];

  const spreadsheetId = await ensureTabsAndHeaders();
  const params = new URLSearchParams();
  tabNames.forEach((tab) => params.append('ranges', `${tab}!A1:ZZ`));

  const response = await requestGoogleJson<GoogleBatchValuesResponse>(
    'batch_read_tabs',
    `/spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchGet?${params.toString()}`,
    { method: 'GET' },
  );

  const valueRanges = response.valueRanges || [];

  return tabNames.map((tab, index) => {
    const values = valueRanges[index]?.values || [];
    const headers = (values[0] || []).map(normalizeHeader);
    const rows = values.slice(1).map((row) => rowToObject(headers, row));

    return {
      tab,
      headers,
      rows,
    };
  });
}

export async function updateOrderStatusInSheet(orderId: string, status: string): Promise<boolean> {
  const spreadsheetId = await ensureTabsAndHeaders();

  const idsResponse = await requestGoogleJson<GoogleValuesResponse>(
    'read_order_ids',
    `/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent('ORDERS!A2:A')}`,
    { method: 'GET' },
  );

  const idRows = idsResponse.values || [];
  const foundIndex = idRows.findIndex((row) => (row[0] || '').trim() === orderId);
  if (foundIndex < 0) {
    return false;
  }

  const sheetRow = foundIndex + 2;
  const statusColumnRange = `ORDERS!N${sheetRow}:N${sheetRow}`;

  await requestGoogleJson(
    'update_order_status',
    `/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(statusColumnRange)}?valueInputOption=RAW`,
    {
      method: 'PUT',
      body: JSON.stringify({
        majorDimension: 'ROWS',
        values: [[status]],
      }),
    },
  );

  return true;
}
