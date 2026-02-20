import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const SECURE_DIR = path.join(process.cwd(), '.secure');
const TOKEN_FILE_KEY = 'google-oauth-token';
const STATE_FILE_KEY = 'google-oauth-state';
const TOKEN_TTL_BUFFER_MS = 60_000;
const REQUEST_TIMEOUT_MS = 5_000;
const REQUEST_RETRIES = 2;

const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
] as const;

export type StoredOAuthTokens = {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  scope: string;
  expiryDate: number;
  createdAt: string;
  updatedAt: string;
};

type OAuthStatePayload = {
  state: string;
  expiresAt: number;
  setupKeyHash: string;
};

type TokenEndpointResponse = {
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  scope?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function tokenStorageKey(): Buffer {
  const secret = requiredEnv('TOKEN_STORAGE_SECRET');
  return createHash('sha256').update(secret).digest();
}

function setupKeyHash(): string {
  const key = requiredEnv('ADMIN_SETUP_KEY');
  return createHash('sha256').update(key).digest('hex');
}

async function ensureSecureDir(): Promise<void> {
  await mkdir(SECURE_DIR, { recursive: true });
}

function secureFilePath(name: string): string {
  return path.join(SECURE_DIR, `${name}.enc`);
}

function encryptText(plainText: string): string {
  const key = tokenStorageKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`;
}

function decryptText(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split('.');
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error('Invalid encrypted payload format');
  }

  const key = tokenStorageKey();
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const encrypted = Buffer.from(dataB64, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return plain.toString('utf8');
}

export async function writeSecureJson<T>(name: string, payload: T): Promise<void> {
  await ensureSecureDir();
  const content = encryptText(JSON.stringify(payload));
  await writeFile(secureFilePath(name), content, 'utf8');
}

export async function readSecureJson<T>(name: string): Promise<T | null> {
  try {
    const raw = await readFile(secureFilePath(name), 'utf8');
    const parsed = JSON.parse(decryptText(raw)) as T;
    return parsed;
  } catch {
    return null;
  }
}

export async function clearSecureJson(name: string): Promise<void> {
  await rm(secureFilePath(name), { force: true });
}

function getSetupKeyFromRequest(request: Request): string {
  const url = new URL(request.url);
  const fromQuery = url.searchParams.get('setupKey') || url.searchParams.get('key');
  const fromHeader = request.headers.get('x-admin-setup-key') || request.headers.get('x-setup-key');
  return (fromQuery || fromHeader || '').trim();
}

export function isSetupKeyAuthorized(request: Request): boolean {
  const configured = process.env.ADMIN_SETUP_KEY;
  if (!configured) return false;

  const provided = getSetupKeyFromRequest(request);
  if (!provided) return false;
  return provided === configured;
}

export async function createOAuthState(): Promise<string> {
  const state = randomBytes(24).toString('hex');
  const payload: OAuthStatePayload = {
    state,
    expiresAt: Date.now() + 10 * 60_000,
    setupKeyHash: setupKeyHash(),
  };
  await writeSecureJson(STATE_FILE_KEY, payload);
  return state;
}

export async function consumeOAuthState(state: string): Promise<boolean> {
  const payload = await readSecureJson<OAuthStatePayload>(STATE_FILE_KEY);
  await clearSecureJson(STATE_FILE_KEY);

  if (!payload) return false;
  if (payload.state !== state) return false;
  if (payload.expiresAt < Date.now()) return false;
  if (payload.setupKeyHash !== setupKeyHash()) return false;
  return true;
}

export function buildGoogleConsentUrl(state: string): string {
  const clientId = requiredEnv('GOOGLE_OAUTH_CLIENT_ID');
  const redirectUri = requiredEnv('GOOGLE_OAUTH_REDIRECT_URL');

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    access_type: 'offline',
    include_granted_scopes: 'true',
    prompt: 'consent',
    scope: GOOGLE_SCOPES.join(' '),
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postTokenForm(form: URLSearchParams): Promise<TokenEndpointResponse> {
  let lastError: unknown;
  let attempt = 0;

  while (attempt <= REQUEST_RETRIES) {
    attempt += 1;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: form.toString(),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const json = (await response.json().catch(() => ({}))) as TokenEndpointResponse;
      if (!response.ok) {
        throw new Error(json.error_description || json.error || `Token endpoint failed: ${response.status}`);
      }

      return json;
    } catch (error) {
      clearTimeout(timeout);
      lastError = error;
      if (attempt <= REQUEST_RETRIES) {
        await sleep(200 * attempt);
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Token exchange failed');
}

export async function exchangeAuthorizationCode(code: string): Promise<StoredOAuthTokens> {
  const clientId = requiredEnv('GOOGLE_OAUTH_CLIENT_ID');
  const clientSecret = requiredEnv('GOOGLE_OAUTH_CLIENT_SECRET');
  const redirectUri = requiredEnv('GOOGLE_OAUTH_REDIRECT_URL');

  const form = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  const tokenResponse = await postTokenForm(form);

  if (!tokenResponse.access_token || !tokenResponse.refresh_token) {
    throw new Error('Google OAuth response missing access_token or refresh_token');
  }

  const now = Date.now();
  const tokens: StoredOAuthTokens = {
    accessToken: tokenResponse.access_token,
    refreshToken: tokenResponse.refresh_token,
    tokenType: tokenResponse.token_type || 'Bearer',
    scope: tokenResponse.scope || GOOGLE_SCOPES.join(' '),
    expiryDate: now + (tokenResponse.expires_in || 3600) * 1000,
    createdAt: new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
  };

  await writeSecureJson(TOKEN_FILE_KEY, tokens);
  return tokens;
}

export async function getStoredTokens(): Promise<StoredOAuthTokens | null> {
  return readSecureJson<StoredOAuthTokens>(TOKEN_FILE_KEY);
}

export async function hasStoredTokens(): Promise<boolean> {
  const tokens = await getStoredTokens();
  return Boolean(tokens?.refreshToken || tokens?.accessToken);
}

async function refreshAccessToken(existing: StoredOAuthTokens): Promise<StoredOAuthTokens> {
  const clientId = requiredEnv('GOOGLE_OAUTH_CLIENT_ID');
  const clientSecret = requiredEnv('GOOGLE_OAUTH_CLIENT_SECRET');

  const form = new URLSearchParams({
    refresh_token: existing.refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
  });

  const tokenResponse = await postTokenForm(form);

  if (!tokenResponse.access_token) {
    throw new Error('Google token refresh did not return access token');
  }

  const now = Date.now();
  const updated: StoredOAuthTokens = {
    ...existing,
    accessToken: tokenResponse.access_token,
    refreshToken: tokenResponse.refresh_token || existing.refreshToken,
    tokenType: tokenResponse.token_type || existing.tokenType || 'Bearer',
    scope: tokenResponse.scope || existing.scope,
    expiryDate: now + (tokenResponse.expires_in || 3600) * 1000,
    updatedAt: new Date(now).toISOString(),
  };

  await writeSecureJson(TOKEN_FILE_KEY, updated);
  return updated;
}

export async function getValidGoogleAccessToken(options?: { forceRefresh?: boolean }): Promise<string> {
  const existing = await getStoredTokens();
  if (!existing) {
    throw new Error('Google OAuth is not configured. Run /api/setup/google first.');
  }

  const shouldRefresh =
    options?.forceRefresh ||
    !existing.accessToken ||
    existing.expiryDate <= Date.now() + TOKEN_TTL_BUFFER_MS;

  if (!shouldRefresh) {
    return existing.accessToken;
  }

  const refreshed = await refreshAccessToken(existing);
  return refreshed.accessToken;
}
