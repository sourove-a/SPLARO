import { setTimeout as sleep } from 'node:timers/promises';
import { logError, logInfo } from './logger';

const SHEETS_SCOPE = ['https://www.googleapis.com/auth/spreadsheets'];
const SHEETS_TIMEOUT_MS = 5000;
const SHEETS_RETRIES = 2;

type GoogleSheetsApi = {
  spreadsheets: {
    values: {
      batchGet: (input: {
        spreadsheetId: string;
        ranges: string[];
      }) => Promise<{ data?: { valueRanges?: Array<{ range?: string; values?: string[][] }> } }>;
      get: (input: {
        spreadsheetId: string;
        range: string;
      }) => Promise<{ data?: { values?: string[][] } }>;
      update: (input: {
        spreadsheetId: string;
        range: string;
        valueInputOption: 'RAW' | 'USER_ENTERED';
        requestBody: { values: string[][] };
      }) => Promise<unknown>;
    };
  };
};

let sheetsApiPromise: Promise<GoogleSheetsApi> | null = null;

function requiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is required`);
  return value;
}

function formatPrivateKey(key: string): string {
  return key.replace(/\\n/g, '\n');
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutId: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
  });

  try {
    return (await Promise.race([promise, timeoutPromise])) as T;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function withRetries<T>(label: string, fn: () => Promise<T>): Promise<T> {
  let attempt = 0;
  let waitMs = 180;
  let lastError: unknown;

  while (attempt <= SHEETS_RETRIES) {
    attempt += 1;
    const started = Date.now();
    try {
      const value = await fn();
      logInfo('sheets_call', {
        label,
        attempt,
        latency_ms: Date.now() - started,
      });
      return value;
    } catch (error) {
      lastError = error;
      logError('sheets_call_failed', {
        label,
        attempt,
        latency_ms: Date.now() - started,
        error: error instanceof Error ? error.message : String(error),
      });
      if (attempt <= SHEETS_RETRIES) {
        await sleep(waitMs);
        waitMs *= 2;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`Sheets call failed: ${label}`);
}

async function buildSheetsApi(): Promise<GoogleSheetsApi> {
  const { google } = (await import('googleapis')) as unknown as {
    google: {
      auth: {
        JWT: new (opts: {
          email: string;
          key: string;
          scopes: string[];
        }) => unknown;
      };
      sheets: (opts: { version: 'v4'; auth: unknown }) => GoogleSheetsApi;
    };
  };

  const email = requiredEnv('GOOGLE_SHEETS_CLIENT_EMAIL');
  const key = formatPrivateKey(requiredEnv('GOOGLE_SHEETS_PRIVATE_KEY'));

  const auth = new google.auth.JWT({
    email,
    key,
    scopes: SHEETS_SCOPE,
  });

  return google.sheets({ version: 'v4', auth });
}

export async function getSheetsApi(): Promise<GoogleSheetsApi> {
  if (!sheetsApiPromise) {
    sheetsApiPromise = buildSheetsApi();
  }
  return sheetsApiPromise;
}

export type TabRows = {
  tab: string;
  headers: string[];
  rows: Record<string, string>[];
};

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/\s+/g, '_');
}

function rowToObject(headers: string[], row: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((header, idx) => {
    out[header] = (row[idx] ?? '').trim();
  });
  return out;
}

export async function batchReadTabs(tabNames: string[]): Promise<TabRows[]> {
  if (tabNames.length === 0) return [];

  const sheets = await getSheetsApi();
  const spreadsheetId = requiredEnv('GOOGLE_SHEET_ID');
  const ranges = tabNames.map((tab) => `${tab}!A1:ZZ`);

  const response = await withRetries('batch_get_tabs', () =>
    withTimeout(
      sheets.spreadsheets.values.batchGet({
        spreadsheetId,
        ranges,
      }),
      SHEETS_TIMEOUT_MS,
      'batch_get_tabs',
    ),
  );

  const valueRanges = response.data?.valueRanges ?? [];

  return valueRanges.map((rangeData, idx) => {
    const raw = rangeData.values ?? [];
    const rawHeaders = raw[0] ?? [];
    const headers = rawHeaders.map(normalizeHeader);
    const bodyRows = raw.slice(1);

    return {
      tab: tabNames[idx] ?? `tab_${idx}`,
      headers,
      rows: bodyRows.map((row) => rowToObject(headers, row)),
    };
  });
}

export async function updateOrderStatusInSheet(orderId: string, status: string): Promise<boolean> {
  const sheets = await getSheetsApi();
  const spreadsheetId = requiredEnv('GOOGLE_SHEET_ID');

  const orderIdColumn = await withRetries('orders_find_row', () =>
    withTimeout(
      sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'ORDERS!A2:A',
      }),
      SHEETS_TIMEOUT_MS,
      'orders_find_row',
    ),
  );

  const idRows = orderIdColumn.data?.values ?? [];
  const foundIdx = idRows.findIndex((row) => (row[0] ?? '').trim() === orderId);
  if (foundIdx < 0) {
    return false;
  }

  const sheetRowNumber = foundIdx + 2;
  await withRetries('orders_update_status', () =>
    withTimeout(
      sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `ORDERS!N${sheetRowNumber}:N${sheetRowNumber}`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [[status]],
        },
      }),
      SHEETS_TIMEOUT_MS,
      'orders_update_status',
    ),
  );

  return true;
}
