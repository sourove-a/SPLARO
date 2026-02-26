import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { URL } from 'node:url';

const cwd = process.cwd();
const distDir = path.join(cwd, 'dist');
const indexFile = path.join(distDir, 'index.html');
const fallbackStorePath = path.join(cwd, '.splaro-fallback-store.json');

let envLoadedFromFile = false;

function loadEnvFiles() {
  const candidates = [path.join(cwd, '.env.local'), path.join(cwd, '.env')];

  for (const filePath of candidates) {
    if (!fs.existsSync(filePath)) continue;
    const raw = fs.readFileSync(filePath, 'utf8');
    const lines = raw.split(/\r?\n/);

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx < 0) continue;

      const key = trimmed.slice(0, idx).trim();
      let value = trimmed.slice(idx + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      if (key && !process.env[key]) {
        process.env[key] = value;
      }
    }

    envLoadedFromFile = true;
  }
}

loadEnvFiles();

const DEFAULT_RATE_LIMIT_WINDOW = Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000);
const DEFAULT_RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX || 60);
const AUTH_SECRET = String(
  process.env.APP_AUTH_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.ADMIN_KEY ||
    `splaro-ephemeral-${crypto.randomBytes(24).toString('hex')}`
);
const CORS_ALLOWED_ORIGINS = String(process.env.CORS_ALLOWED_ORIGINS || process.env.APP_ORIGIN || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);
const CORS_DEFAULT_ORIGIN = CORS_ALLOWED_ORIGINS[0] || 'null';

const dbState = {
  pool: null,
  connected: false,
  storage: 'fallback',
  host: '',
  dbName: '',
  error: '',
  missing: [],
  lastAttemptAt: 0,
  ensurePromise: null,
};

let schemaEnsurePromise = null;
let mysqlModulePromise = null;
let bcryptModulePromise = null;
let nodemailerModulePromise = null;
const rateLimitStore = new Map();

const fallbackStore = loadFallbackStore();
ensureFallbackAdminAccount();

function loadFallbackStore() {
  const empty = {
    users: [],
    products: [],
    orders: [],
    subscriptions: [],
    settings: createDefaultSettings(),
    logs: [],
    traffic: [],
  };

  try {
    if (!fs.existsSync(fallbackStorePath)) return empty;
    const raw = fs.readFileSync(fallbackStorePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return empty;

    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      products: Array.isArray(parsed.products) ? parsed.products : [],
      orders: Array.isArray(parsed.orders) ? parsed.orders : [],
      subscriptions: Array.isArray(parsed.subscriptions) ? parsed.subscriptions : [],
      settings: normalizeSettingsObject(parsed.settings),
      logs: Array.isArray(parsed.logs) ? parsed.logs : [],
      traffic: Array.isArray(parsed.traffic) ? parsed.traffic : [],
    };
  } catch {
    return empty;
  }
}

function persistFallbackStore() {
  try {
    const payload = JSON.stringify(fallbackStore, null, 2);
    fs.writeFileSync(fallbackStorePath, payload, 'utf8');
  } catch {}
}

function createDefaultSettings() {
  return {
    id: 1,
    site_name: 'Splaro',
    maintenance_mode: 0,
    support_email: 'info@splaro.co',
    support_phone: '+880 1905 010 205',
    whatsapp_number: '+8801905010205',
    facebook_link: 'https://facebook.com/splaro.co',
    instagram_link: 'https://www.instagram.com/splaro.bd',
    logo_url: '',
    smtp_settings: {
      host: 'smtp.hostinger.com',
      port: '465',
      secure: true,
      user: 'info@splaro.co',
    },
    logistics_config: {
      metro: 90,
      regional: 140,
    },
    hero_slides: [],
    content_pages: {},
    story_posts: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function normalizeSettingsObject(raw) {
  const base = createDefaultSettings();
  const input = raw && typeof raw === 'object' ? raw : {};

  return {
    ...base,
    ...input,
    maintenance_mode: Number(input.maintenance_mode || 0) ? 1 : 0,
    smtp_settings: parseJsonObject(input.smtp_settings) || base.smtp_settings,
    logistics_config: parseJsonObject(input.logistics_config) || base.logistics_config,
    hero_slides: Array.isArray(parseJsonObject(input.hero_slides))
      ? parseJsonObject(input.hero_slides)
      : Array.isArray(input.hero_slides)
        ? input.hero_slides
        : base.hero_slides,
    content_pages: parseJsonObject(input.content_pages) || base.content_pages,
    story_posts: Array.isArray(parseJsonObject(input.story_posts))
      ? parseJsonObject(input.story_posts)
      : Array.isArray(input.story_posts)
        ? input.story_posts
        : base.story_posts,
  };
}

function ensureFallbackAdminAccount() {
  const hasAdmin = fallbackStore.users.some((user) => String(user.role || '').toUpperCase() === 'ADMIN');
  if (hasAdmin) return;

  const adminEmail = 'admin@splaro.co';
  const adminKey = String(process.env.ADMIN_KEY || '').trim();
  if (!adminKey) return;

  const adminUser = {
    id: `usr_admin_${crypto.randomBytes(4).toString('hex')}`,
    name: 'Splaro Admin',
    email: adminEmail,
    phone: 'N/A',
    address: '',
    district: '',
    thana: '',
    profile_image: '',
    password: hashPassword(adminKey),
    role: 'ADMIN',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  fallbackStore.users.unshift(adminUser);
  persistFallbackStore();
}

function parseJsonObject(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function safeJsonParse(value, fallback = null) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function generateId(prefix) {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

async function getBcryptModule() {
  if (!bcryptModulePromise) {
    bcryptModulePromise = import('bcryptjs')
      .then((mod) => mod.default || mod)
      .catch(() => null);
  }
  return bcryptModulePromise;
}

function verifyBcryptWithPhp(password, hash) {
  try {
    const script = 'echo password_verify($argv[1], $argv[2]) ? "1" : "0";';
    const result = spawnSync('php', ['-r', script, String(password || ''), String(hash || '')], {
      encoding: 'utf8',
      timeout: 1500,
      windowsHide: true,
    });
    if (result.status === 0) {
      const value = String(result.stdout || '').trim();
      if (value === '1') return true;
      if (value === '0') return false;
    }
  } catch {}
  return null;
}

async function verifyPassword(password, stored) {
  const plain = String(password || '');
  const encoded = String(stored || '');

  if (!encoded) return { ok: false, needsUpgrade: false };

  if (encoded.startsWith('scrypt:')) {
    const parts = encoded.split(':');
    if (parts.length !== 3) return { ok: false, needsUpgrade: false };
    const [, salt, expected] = parts;
    const calculated = crypto.scryptSync(plain, salt, 64).toString('hex');
    return { ok: timingSafeEqual(expected, calculated), needsUpgrade: false };
  }

  if (encoded.startsWith('$2y$') || encoded.startsWith('$2a$') || encoded.startsWith('$2b$')) {
    const bcrypt = await getBcryptModule();
    if (bcrypt) {
      const ok = await bcrypt.compare(plain, encoded);
      return { ok, needsUpgrade: ok };
    }
    const phpVerified = verifyBcryptWithPhp(plain, encoded);
    if (phpVerified !== null) {
      return { ok: phpVerified, needsUpgrade: phpVerified };
    }
    return { ok: false, needsUpgrade: false, message: 'BCRYPT_UNSUPPORTED' };
  }

  return { ok: timingSafeEqual(encoded, plain), needsUpgrade: true };
}

function timingSafeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function base64Url(input) {
  const source = typeof input === 'string' ? input : JSON.stringify(input);
  return Buffer.from(source).toString('base64url');
}

function issueAuthToken(user) {
  const payload = {
    id: user.id,
    email: user.email,
    role: String(user.role || 'USER').toUpperCase(),
    iat: Date.now(),
  };
  const payloadEncoded = base64Url(payload);
  const signature = crypto.createHmac('sha256', AUTH_SECRET).update(payloadEncoded).digest('base64url');
  return `${payloadEncoded}.${signature}`;
}

function parseAuthToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [payloadEncoded, signature] = token.split('.');
  if (!payloadEncoded || !signature) return null;

  const expectedSignature = crypto.createHmac('sha256', AUTH_SECRET).update(payloadEncoded).digest('base64url');
  if (!timingSafeEqual(expectedSignature, signature)) return null;

  const decoded = safeJsonParse(Buffer.from(payloadEncoded, 'base64url').toString('utf8'));
  if (!decoded || typeof decoded !== 'object') return null;
  return decoded;
}

function getAuthToken(req) {
  const authHeader = String(req.headers.authorization || '');
  if (!authHeader.toLowerCase().startsWith('bearer ')) return '';
  return authHeader.slice(7).trim();
}

function getClientIp(req) {
  const xff = String(req.headers['x-forwarded-for'] || '').trim();
  if (xff) return xff.split(',')[0].trim();
  const realIp = String(req.headers['x-real-ip'] || '').trim();
  if (realIp) return realIp;
  return req.socket.remoteAddress || '0.0.0.0';
}

function checkRateLimit(key, max = DEFAULT_RATE_LIMIT_MAX, windowMs = DEFAULT_RATE_LIMIT_WINDOW) {
  const now = Date.now();
  const current = rateLimitStore.get(key);

  if (!current || current.expiresAt <= now) {
    rateLimitStore.set(key, { count: 1, expiresAt: now + windowMs });
    return false;
  }

  current.count += 1;
  if (current.count > max) {
    return true;
  }

  return false;
}

function getDbConfig() {
  const hostRaw = String(process.env.DB_HOST || '').trim();
  const portRaw = String(process.env.DB_PORT || '3306').trim();
  const name = String(process.env.DB_NAME || '').trim();
  const user = String(process.env.DB_USER || '').trim();
  const password = String(process.env.DB_PASSWORD || process.env.DB_PASS || '').trim();

  const missing = [];
  if (!hostRaw) missing.push('DB_HOST');
  if (!name) missing.push('DB_NAME');
  if (!user) missing.push('DB_USER');
  if (!password) missing.push('DB_PASSWORD');

  const parsedPort = Number(portRaw);
  const hostCandidates =
    hostRaw === '127.0.0.1'
      ? ['127.0.0.1', 'localhost']
      : hostRaw === 'localhost'
        ? ['localhost', '127.0.0.1']
        : hostRaw
          ? [hostRaw]
          : [];

  return {
    host: hostRaw,
    hostCandidates,
    port: Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 3306,
    name,
    user,
    password,
    missing,
    configured: missing.length === 0,
  };
}

async function getMysqlModule() {
  if (!mysqlModulePromise) {
    mysqlModulePromise = import('mysql2/promise').then((mod) => mod.default || mod);
  }
  return mysqlModulePromise;
}

function isTransientDbError(error) {
  if (!error) return false;
  const code = String(error.code || '');
  return ['PROTOCOL_CONNECTION_LOST', 'ER_LOCK_DEADLOCK', 'ETIMEDOUT', 'ECONNRESET', 'EPIPE'].includes(code);
}

async function mysqlQuery(pool, sql, params = [], retries = 1) {
  let attempt = 0;
  while (attempt <= retries) {
    try {
      const [rows] = await pool.query({ sql, timeout: 5000 }, params);
      return rows;
    } catch (error) {
      if (attempt >= retries || !isTransientDbError(error)) {
        throw error;
      }
      const backoff = 150 * (attempt + 1);
      await new Promise((resolve) => setTimeout(resolve, backoff));
      attempt += 1;
    }
  }
  return [];
}

async function ensureSchema(pool) {
  if (schemaEnsurePromise) {
    return schemaEnsurePromise;
  }

  schemaEnsurePromise = (async () => {
    const statements = [
      `CREATE TABLE IF NOT EXISTS products (
        id varchar(80) NOT NULL,
        name varchar(255) NOT NULL,
        brand varchar(120) NOT NULL,
        price int NOT NULL DEFAULT 0,
        image text NOT NULL,
        category varchar(120) NOT NULL,
        type varchar(60) NOT NULL,
        product_type varchar(60) DEFAULT NULL,
        description longtext DEFAULT NULL,
        sizes longtext DEFAULT NULL,
        colors longtext DEFAULT NULL,
        materials longtext DEFAULT NULL,
        tags longtext DEFAULT NULL,
        featured tinyint(1) DEFAULT 0,
        sku varchar(120) DEFAULT NULL,
        stock int DEFAULT 50,
        weight varchar(80) DEFAULT NULL,
        dimensions longtext DEFAULT NULL,
        variations longtext DEFAULT NULL,
        additional_images longtext DEFAULT NULL,
        size_chart_image text DEFAULT NULL,
        discount_percentage int DEFAULT NULL,
        sub_category varchar(120) DEFAULT NULL,
        created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_products_category (category),
        KEY idx_products_type (type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      `CREATE TABLE IF NOT EXISTS users (
        id varchar(80) NOT NULL,
        name varchar(255) NOT NULL,
        email varchar(255) NOT NULL,
        phone varchar(50) DEFAULT NULL,
        district varchar(120) DEFAULT NULL,
        thana varchar(120) DEFAULT NULL,
        address text DEFAULT NULL,
        profile_image text DEFAULT NULL,
        password varchar(255) NOT NULL,
        role varchar(20) DEFAULT 'USER',
        reset_code varchar(20) DEFAULT NULL,
        reset_expiry datetime DEFAULT NULL,
        created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uniq_users_email (email),
        KEY idx_users_phone (phone),
        KEY idx_users_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      `CREATE TABLE IF NOT EXISTS orders (
        id varchar(80) NOT NULL,
        user_id varchar(80) DEFAULT NULL,
        customer_name varchar(255) NOT NULL,
        customer_email varchar(255) NOT NULL,
        phone varchar(50) NOT NULL,
        district varchar(120) DEFAULT NULL,
        thana varchar(120) DEFAULT NULL,
        address text NOT NULL,
        items longtext NOT NULL,
        total decimal(12,2) NOT NULL DEFAULT 0,
        status varchar(50) NOT NULL DEFAULT 'Pending',
        tracking_number varchar(120) DEFAULT NULL,
        admin_notes text DEFAULT NULL,
        customer_comment text DEFAULT NULL,
        shipping_fee decimal(12,2) DEFAULT NULL,
        discount_amount decimal(12,2) DEFAULT 0,
        discount_code varchar(120) DEFAULT NULL,
        created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_orders_status (status),
        KEY idx_orders_created (created_at),
        KEY idx_orders_email (customer_email),
        KEY idx_orders_phone (phone),
        KEY idx_orders_user (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      `CREATE TABLE IF NOT EXISTS subscriptions (
        id varchar(80) NOT NULL,
        email varchar(255) NOT NULL,
        consent tinyint(1) DEFAULT 0,
        source varchar(40) DEFAULT 'footer',
        created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uniq_subscriptions_email (email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      `CREATE TABLE IF NOT EXISTS site_settings (
        id int NOT NULL AUTO_INCREMENT,
        site_name varchar(255) DEFAULT 'Splaro',
        maintenance_mode tinyint(1) DEFAULT 0,
        support_email varchar(255) DEFAULT 'info@splaro.co',
        support_phone varchar(50) DEFAULT NULL,
        whatsapp_number varchar(50) DEFAULT NULL,
        facebook_link varchar(255) DEFAULT NULL,
        instagram_link varchar(255) DEFAULT NULL,
        logo_url text DEFAULT NULL,
        smtp_settings longtext DEFAULT NULL,
        logistics_config longtext DEFAULT NULL,
        hero_slides longtext DEFAULT NULL,
        content_pages longtext DEFAULT NULL,
        story_posts longtext DEFAULT NULL,
        created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      `CREATE TABLE IF NOT EXISTS system_logs (
        id bigint NOT NULL AUTO_INCREMENT,
        event_type varchar(100) NOT NULL,
        event_description text NOT NULL,
        user_id varchar(80) DEFAULT NULL,
        ip_address varchar(45) DEFAULT NULL,
        created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_logs_event (event_type),
        KEY idx_logs_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      `CREATE TABLE IF NOT EXISTS traffic_metrics (
        id bigint NOT NULL AUTO_INCREMENT,
        session_id varchar(120) NOT NULL,
        user_id varchar(80) DEFAULT NULL,
        ip_address varchar(45) DEFAULT NULL,
        path varchar(255) DEFAULT '/',
        user_agent text DEFAULT NULL,
        last_active timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uniq_session_id (session_id),
        KEY idx_traffic_last_active (last_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    ];

    for (const sql of statements) {
      await mysqlQuery(pool, sql, []);
    }

    const alterStatements = [
      `ALTER TABLE orders ADD COLUMN shipping_fee decimal(12,2) DEFAULT NULL`,
      `ALTER TABLE orders ADD COLUMN discount_amount decimal(12,2) DEFAULT 0`,
      `ALTER TABLE orders ADD COLUMN discount_code varchar(120) DEFAULT NULL`,
      `ALTER TABLE orders ADD COLUMN customer_comment text DEFAULT NULL`,
      `ALTER TABLE orders ADD COLUMN tracking_number varchar(120) DEFAULT NULL`,
      `ALTER TABLE orders ADD COLUMN admin_notes text DEFAULT NULL`,
      `ALTER TABLE users ADD COLUMN profile_image text DEFAULT NULL`,
      `ALTER TABLE users ADD COLUMN district varchar(120) DEFAULT NULL`,
      `ALTER TABLE users ADD COLUMN thana varchar(120) DEFAULT NULL`,
      `ALTER TABLE users ADD COLUMN address text DEFAULT NULL`,
      `ALTER TABLE users ADD COLUMN reset_code varchar(20) DEFAULT NULL`,
      `ALTER TABLE users ADD COLUMN reset_expiry datetime DEFAULT NULL`,
      `ALTER TABLE site_settings ADD COLUMN hero_slides longtext DEFAULT NULL`,
      `ALTER TABLE site_settings ADD COLUMN content_pages longtext DEFAULT NULL`,
      `ALTER TABLE site_settings ADD COLUMN story_posts longtext DEFAULT NULL`,
      `ALTER TABLE site_settings ADD COLUMN smtp_settings longtext DEFAULT NULL`,
      `ALTER TABLE site_settings ADD COLUMN logistics_config longtext DEFAULT NULL`,
      `ALTER TABLE products ADD COLUMN product_type varchar(60) DEFAULT NULL`,
    ];

    for (const sql of alterStatements) {
      try {
        await mysqlQuery(pool, sql, []);
      } catch {
        // Column already exists.
      }
    }

    await mysqlQuery(
      pool,
      `INSERT INTO site_settings (id, site_name, support_email)
       VALUES (1, 'Splaro', 'info@splaro.co')
       ON DUPLICATE KEY UPDATE site_name = site_name`,
      []
    );

    const adminKey = String(process.env.ADMIN_KEY || '').trim();
    if (adminKey) {
      const existingAdmin = await mysqlQuery(pool, 'SELECT id FROM users WHERE role = ? LIMIT 1', ['ADMIN']);
      if (!Array.isArray(existingAdmin) || existingAdmin.length === 0) {
        const id = `usr_admin_${crypto.randomBytes(4).toString('hex')}`;
        const password = hashPassword(adminKey);
        await mysqlQuery(
          pool,
          `INSERT INTO users (id, name, email, phone, password, role)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [id, 'Splaro Admin', 'admin@splaro.co', 'N/A', password, 'ADMIN']
        );
      }
    }
  })()
    .catch((error) => {
      schemaEnsurePromise = null;
      throw error;
    });

  return schemaEnsurePromise;
}

async function ensureDbConnection() {
  const now = Date.now();
  if (dbState.connected && dbState.pool) {
    return dbState;
  }

  if (dbState.ensurePromise) {
    return dbState.ensurePromise;
  }

  if (now - dbState.lastAttemptAt < 3000) {
    return dbState;
  }

  dbState.lastAttemptAt = now;
  dbState.ensurePromise = (async () => {
    const config = getDbConfig();
    dbState.missing = config.missing;
    dbState.dbName = config.name;
    dbState.host = config.host;

    if (!config.configured) {
      dbState.connected = false;
      dbState.storage = 'fallback';
      dbState.error = 'DATABASE_ENV_NOT_CONFIGURED';
      return dbState;
    }

    let mysql;
    try {
      mysql = await getMysqlModule();
    } catch {
      dbState.connected = false;
      dbState.storage = 'fallback';
      dbState.error = 'MYSQL_CLIENT_NOT_INSTALLED';
      return dbState;
    }

    let lastError = '';
    for (const host of config.hostCandidates) {
      const pool = mysql.createPool({
        host,
        port: config.port,
        user: config.user,
        password: config.password,
        database: config.name,
        waitForConnections: true,
        connectionLimit: 8,
        queueLimit: 0,
        connectTimeout: 5000,
        enableKeepAlive: true,
      });

      try {
        await mysqlQuery(pool, 'SELECT 1', [], 0);
        await ensureSchema(pool);

        dbState.pool = pool;
        dbState.connected = true;
        dbState.storage = 'mysql';
        dbState.host = host;
        dbState.dbName = config.name;
        dbState.error = '';
        return dbState;
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown DB connection error';
        try {
          await pool.end();
        } catch {}
      }
    }

    dbState.pool = null;
    dbState.connected = false;
    dbState.storage = 'fallback';
    dbState.error = `DATABASE_CONNECTION_FAILED: ${lastError}`;
    return dbState;
  })();

  try {
    return await dbState.ensurePromise;
  } finally {
    dbState.ensurePromise = null;
  }
}

async function resolveStorage() {
  const state = await ensureDbConnection();
  if (state.connected && state.pool) {
    return {
      mode: 'mysql',
      pool: state.pool,
      dbHost: state.host,
      dbName: state.dbName,
      error: '',
    };
  }

  return {
    mode: 'fallback',
    pool: null,
    dbHost: state.host,
    dbName: state.dbName,
    error: state.error,
  };
}

function sanitizeUser(user) {
  if (!user || typeof user !== 'object') return null;
  const sanitized = { ...user };
  delete sanitized.password;
  delete sanitized.reset_code;
  delete sanitized.reset_expiry;
  return sanitized;
}

async function getUserById(storage, userId) {
  if (!userId) return null;

  if (storage.mode === 'mysql' && storage.pool) {
    const rows = await mysqlQuery(storage.pool, 'SELECT * FROM users WHERE id = ? LIMIT 1', [String(userId)]);
    return Array.isArray(rows) && rows[0] ? rows[0] : null;
  }

  return fallbackStore.users.find((user) => user.id === String(userId)) || null;
}

async function getUserByEmail(storage, email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;

  if (storage.mode === 'mysql' && storage.pool) {
    const rows = await mysqlQuery(storage.pool, 'SELECT * FROM users WHERE email = ? LIMIT 1', [normalized]);
    return Array.isArray(rows) && rows[0] ? rows[0] : null;
  }

  return fallbackStore.users.find((user) => normalizeEmail(user.email) === normalized) || null;
}

async function resolveAuthUser(req, storage) {
  const token = getAuthToken(req);
  const parsed = parseAuthToken(token);
  if (!parsed || !parsed.id) return null;

  try {
    const user = await getUserById(storage, parsed.id);
    if (!user) return null;
    return sanitizeUser(user);
  } catch {
    return null;
  }
}

function hasAdminHeader(req) {
  const adminKey = String(process.env.ADMIN_KEY || '').trim();
  if (!adminKey) return false;
  const incoming = String(req.headers['x-admin-key'] || '').trim();
  return incoming !== '' && timingSafeEqual(incoming, adminKey);
}

function isAdminAuthenticated(req, authUser) {
  if (hasAdminHeader(req)) return true;
  return String(authUser?.role || '').toUpperCase() === 'ADMIN';
}

function buildDisplayNameFromEmail(email) {
  const base = normalizeEmail(email).split('@')[0] || '';
  const cleaned = base
    .replace(/[0-9]/g, ' ')
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return 'Splaro Customer';

  return cleaned
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

async function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1024 * 1024) {
        reject(new Error('PAYLOAD_TOO_LARGE'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!raw.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('INVALID_JSON'));
      }
    });
    req.on('error', reject);
  });
}

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': CORS_DEFAULT_ORIGIN,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Key',
    Vary: 'Origin',
  });
  res.end(body);
}

function handleError(res, statusCode, message, details = undefined) {
  const payload = { status: 'error', message };
  if (details && process.env.NODE_ENV !== 'production') {
    payload.details = details;
  }
  json(res, statusCode, payload);
}

function contentType(filePath) {
  if (filePath.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.svg')) return 'image/svg+xml';
  if (filePath.endsWith('.json')) return 'application/json; charset=utf-8';
  if (filePath.endsWith('.png')) return 'image/png';
  if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) return 'image/jpeg';
  if (filePath.endsWith('.webp')) return 'image/webp';
  if (filePath.endsWith('.ico')) return 'image/x-icon';
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  return 'application/octet-stream';
}

function normalizeOrderRow(order) {
  const row = { ...order };
  if (Array.isArray(row.items)) {
    row.items = JSON.stringify(row.items);
  }
  if (!row.status) row.status = 'Pending';
  return row;
}

function normalizeProductRow(row) {
  const safe = { ...row };

  const jsonFields = ['description', 'sizes', 'colors', 'materials', 'tags', 'dimensions', 'variations', 'additional_images'];
  for (const field of jsonFields) {
    const parsed = parseJsonObject(safe[field]);
    if (parsed !== null) {
      safe[field] = parsed;
    }
  }

  safe.additionalImages = Array.isArray(safe.additional_images) ? safe.additional_images : parseJsonObject(safe.additional_images) || [];
  safe.sizeChartImage = safe.size_chart_image || null;
  safe.discountPercentage = safe.discount_percentage === null || safe.discount_percentage === undefined ? null : Number(safe.discount_percentage);
  safe.subCategory = safe.sub_category || '';
  safe.featured = Number(safe.featured || 0) === 1 || safe.featured === true;
  safe.stock = toNumber(safe.stock, 0);
  safe.price = toNumber(safe.price, 0);

  if (!safe.productType) {
    safe.productType = String(safe.product_type || (String(safe.category || '').toLowerCase().includes('bag') ? 'bag' : 'shoe'));
  }

  return safe;
}

function normalizeOrderPayload(input, authUser) {
  const orderId = String(input.id || '').trim() || `SPL-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const items = Array.isArray(input.items) ? input.items : [];
  const nowIso = new Date().toISOString();
  const shippingFee = input.shippingFee === null || input.shippingFee === undefined || input.shippingFee === ''
    ? null
    : toNumber(input.shippingFee, 0);

  return {
    id: orderId,
    // Never trust client-provided userId when request is unauthenticated.
    user_id: authUser?.id || null,
    customer_name: String(input.customerName || '').trim(),
    customer_email: normalizeEmail(input.customerEmail || authUser?.email || ''),
    phone: String(input.phone || '').trim(),
    district: String(input.district || '').trim(),
    thana: String(input.thana || '').trim(),
    address: String(input.address || '').trim(),
    items,
    total: toNumber(input.total, 0),
    status: String(input.status || 'Pending').trim() || 'Pending',
    customer_comment: String(input.customerComment || '').trim(),
    tracking_number: String(input.trackingNumber || '').trim() || null,
    admin_notes: String(input.adminNotes || '').trim() || null,
    shipping_fee: shippingFee,
    discount_amount: toNumber(input.discountAmount, 0),
    discount_code: String(input.discountCode || '').trim() || null,
    created_at: String(input.createdAt || nowIso),
    updated_at: nowIso,
  };
}

function getPagination(url, pageKey = 'page', sizeKey = 'pageSize') {
  const page = Math.max(1, toNumber(url.searchParams.get(pageKey), 1));
  const pageSize = Math.min(100, Math.max(10, toNumber(url.searchParams.get(sizeKey), 30)));
  const offset = (page - 1) * pageSize;
  return { page, pageSize, offset };
}

async function logSystemEvent(storage, eventType, description, ipAddress = null, userId = null) {
  const row = {
    id: generateId('log'),
    event_type: String(eventType || 'SYSTEM_EVENT'),
    event_description: String(description || ''),
    user_id: userId || null,
    ip_address: ipAddress || null,
    created_at: new Date().toISOString(),
  };

  if (storage.mode === 'mysql' && storage.pool) {
    try {
      await mysqlQuery(
        storage.pool,
        'INSERT INTO system_logs (event_type, event_description, user_id, ip_address) VALUES (?, ?, ?, ?)',
        [row.event_type, row.event_description, row.user_id, row.ip_address]
      );
    } catch {
      // Best effort logging.
    }
    return;
  }

  fallbackStore.logs.unshift(row);
  if (fallbackStore.logs.length > 300) fallbackStore.logs = fallbackStore.logs.slice(0, 300);
  persistFallbackStore();
}

async function getNodemailerModule() {
  if (!nodemailerModulePromise) {
    nodemailerModulePromise = import('nodemailer')
      .then((mod) => mod.default || mod)
      .catch(() => null);
  }
  return nodemailerModulePromise;
}

async function sendMail({ to, subject, text, html }) {
  const host = String(process.env.SMTP_HOST || '').trim();
  const user = String(process.env.SMTP_USER || '').trim();
  const pass = String(process.env.SMTP_PASS || '').trim();
  const from = String(process.env.SMTP_FROM || user || '').trim();
  const port = toNumber(process.env.SMTP_PORT, 465);
  const secure = String(process.env.SMTP_SECURE || 'true').trim().toLowerCase() === 'true';

  if (!host || !user || !pass || !from || !to || !subject) {
    return { ok: false, message: 'SMTP_NOT_CONFIGURED' };
  }

  const nodemailer = await getNodemailerModule();
  if (!nodemailer) {
    return { ok: false, message: 'NODEMAILER_NOT_INSTALLED' };
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 10_000,
  });

  const mail = {
    from,
    to,
    subject,
    text: text || '',
    html: html || undefined,
  };

  let attempt = 0;
  const maxAttempts = 2;
  while (attempt < maxAttempts) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      await transporter.sendMail({ ...mail, signal: controller.signal });
      clearTimeout(timeout);
      return { ok: true };
    } catch (error) {
      clearTimeout(timeout);
      attempt += 1;
      if (attempt >= maxAttempts) {
        return { ok: false, message: error instanceof Error ? error.message : 'SMTP_SEND_FAILED' };
      }
      await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
    }
  }

  return { ok: false, message: 'SMTP_SEND_FAILED' };
}

async function sendTelegramMessage(text) {
  const token = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
  const chatId = String(process.env.TELEGRAM_CHAT_ID || '').trim();
  if (!token || !chatId || !text) return false;

  const endpoint = `https://api.telegram.org/bot${token}/sendMessage`;
  const payload = {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return response.ok;
  } catch {
    clearTimeout(timeout);
    return false;
  }
}

async function pushSheetsWebhook(type, data) {
  const webhookUrl = String(process.env.GOOGLE_SHEETS_WEBHOOK_URL || '').trim();
  if (!webhookUrl) return false;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, data }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return response.ok;
  } catch {
    clearTimeout(timeout);
    return false;
  }
}

function escapeTelegramHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function sendOrderTelegram(order) {
  const items = Array.isArray(order.items)
    ? order.items
    : typeof order.items === 'string'
      ? parseJsonObject(order.items) || []
      : [];

  const firstItem = items[0] || {};
  const firstProduct = firstItem.product || {};
  const productName = firstProduct.name || firstItem.name || 'N/A';
  const productUrl = firstItem.productUrl || firstItem.url || `/product/${encodeURIComponent(firstProduct.id || '')}`;
  const imageUrl = firstProduct.image || firstItem.image || firstItem.imageUrl || 'N/A';
  const quantity = items.reduce((acc, item) => acc + toNumber(item.quantity, 0), 0);

  const message = [
    '<b>🛒 New Order</b>',
    `<b>Order ID:</b> ${escapeTelegramHtml(order.id)}`,
    `<b>Time:</b> ${escapeTelegramHtml(new Date().toISOString())}`,
    `<b>Name:</b> ${escapeTelegramHtml(order.customer_name)}`,
    `<b>Phone:</b> ${escapeTelegramHtml(order.phone)}`,
    `<b>Email:</b> ${escapeTelegramHtml(order.customer_email)}`,
    `<b>District/Thana:</b> ${escapeTelegramHtml(`${order.district || ''} / ${order.thana || ''}`)}`,
    `<b>Address:</b> ${escapeTelegramHtml(order.address)}`,
    `<b>Product:</b> ${escapeTelegramHtml(productName)}`,
    `<b>Product URL:</b> ${escapeTelegramHtml(productUrl || 'N/A')}`,
    `<b>Image URL:</b> ${escapeTelegramHtml(imageUrl)}`,
    `<b>Quantity:</b> ${escapeTelegramHtml(String(quantity || 1))}`,
    `<b>Notes:</b> ${escapeTelegramHtml(order.customer_comment || 'N/A')}`,
    `<b>Status:</b> ${escapeTelegramHtml(String(order.status || 'PENDING').toUpperCase())}`,
  ].join('\n');

  await sendTelegramMessage(message);
}

async function sendSignupTelegram(user) {
  const message = [
    '<b>✅ New Signup</b>',
    `<b>User ID:</b> ${escapeTelegramHtml(user.id)}`,
    `<b>Time:</b> ${escapeTelegramHtml(new Date().toISOString())}`,
    `<b>Name:</b> ${escapeTelegramHtml(user.name)}`,
    `<b>Email:</b> ${escapeTelegramHtml(user.email)}`,
    `<b>Phone:</b> ${escapeTelegramHtml(user.phone || 'N/A')}`,
  ].join('\n');

  await sendTelegramMessage(message);
}

async function sendSubscriptionTelegram(entry) {
  const message = [
    '<b>📩 New Subscriber</b>',
    `<b>Sub ID:</b> ${escapeTelegramHtml(entry.id)}`,
    `<b>Time:</b> ${escapeTelegramHtml(entry.created_at)}`,
    `<b>Email:</b> ${escapeTelegramHtml(entry.email)}`,
    `<b>Consent:</b> ${escapeTelegramHtml(entry.consent ? 'true' : 'false')}`,
    `<b>Source:</b> ${escapeTelegramHtml(entry.source || 'footer')}`,
  ].join('\n');

  await sendTelegramMessage(message);
}

async function handleSync(req, res, url, storage, authUser) {
  const isAdmin = isAdminAuthenticated(req, authUser);
  const isUser = String(authUser?.role || '').toUpperCase() === 'USER';

  let settings = null;
  let products = [];
  let orders = [];
  let users = [];
  let logs = [];
  let traffic = [];
  let meta = {};

  if (storage.mode === 'mysql' && storage.pool) {
    const settingsRows = await mysqlQuery(storage.pool, 'SELECT * FROM site_settings ORDER BY id ASC LIMIT 1');
    if (Array.isArray(settingsRows) && settingsRows[0]) {
      settings = { ...settingsRows[0] };
      settings.smtp_settings = parseJsonObject(settings.smtp_settings) || {};
      settings.logistics_config = parseJsonObject(settings.logistics_config) || {};
      settings.hero_slides = parseJsonObject(settings.hero_slides) || [];
      settings.content_pages = parseJsonObject(settings.content_pages) || {};
      settings.story_posts = parseJsonObject(settings.story_posts) || [];
      if (!isAdmin) {
        delete settings.smtp_settings;
      }
    } else {
      settings = normalizeSettingsObject({});
    }

    const productRows = await mysqlQuery(storage.pool, 'SELECT * FROM products ORDER BY updated_at DESC LIMIT 1000');
    products = Array.isArray(productRows) ? productRows.map((row) => normalizeProductRow(row)) : [];

    if (isAdmin) {
      const { page, pageSize, offset } = getPagination(url);
      const q = String(url.searchParams.get('q') || '').trim();
      const status = String(url.searchParams.get('status') || '').trim();

      const where = [];
      const params = [];

      if (q) {
        const like = `%${q}%`;
        where.push('(id LIKE ? OR customer_name LIKE ? OR customer_email LIKE ? OR phone LIKE ?)');
        params.push(like, like, like, like);
      }

      if (status) {
        where.push('status = ?');
        params.push(status);
      }

      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const countRows = await mysqlQuery(storage.pool, `SELECT COUNT(*) AS total FROM orders ${whereSql}`, params);
      const orderCount = Array.isArray(countRows) && countRows[0] ? toNumber(countRows[0].total, 0) : 0;

      orders = await mysqlQuery(
        storage.pool,
        `SELECT * FROM orders ${whereSql} ORDER BY created_at DESC LIMIT ${pageSize} OFFSET ${offset}`,
        params
      );

      const usersPage = Math.max(1, toNumber(url.searchParams.get('usersPage'), page));
      const usersPageSize = Math.min(100, Math.max(10, toNumber(url.searchParams.get('usersPageSize'), pageSize)));
      const usersOffset = (usersPage - 1) * usersPageSize;
      const usersQ = String(url.searchParams.get('usersQ') || q).trim();

      const usersWhere = [];
      const usersParams = [];
      if (usersQ) {
        const like = `%${usersQ}%`;
        usersWhere.push('(name LIKE ? OR email LIKE ? OR phone LIKE ?)');
        usersParams.push(like, like, like);
      }

      const usersWhereSql = usersWhere.length ? `WHERE ${usersWhere.join(' AND ')}` : '';
      const usersCountRows = await mysqlQuery(storage.pool, `SELECT COUNT(*) AS total FROM users ${usersWhereSql}`, usersParams);
      const userCount = Array.isArray(usersCountRows) && usersCountRows[0] ? toNumber(usersCountRows[0].total, 0) : 0;

      users = await mysqlQuery(
        storage.pool,
        `SELECT id, name, email, phone, district, thana, address, profile_image, role, created_at FROM users ${usersWhereSql} ORDER BY created_at DESC LIMIT ${usersPageSize} OFFSET ${usersOffset}`,
        usersParams
      );

      logs = await mysqlQuery(storage.pool, 'SELECT * FROM system_logs ORDER BY created_at DESC LIMIT 50');
      traffic = await mysqlQuery(
        storage.pool,
        `SELECT * FROM traffic_metrics WHERE last_active > DATE_SUB(NOW(), INTERVAL 5 MINUTE) ORDER BY last_active DESC LIMIT 100`
      );

      meta = {
        orders: { page, pageSize, count: orderCount },
        users: { page: usersPage, pageSize: usersPageSize, count: userCount },
      };
    } else if (isUser && authUser?.email) {
      orders = await mysqlQuery(
        storage.pool,
        'SELECT * FROM orders WHERE user_id = ? OR customer_email = ? ORDER BY created_at DESC LIMIT 300',
        [authUser.id || null, authUser.email]
      );
    }
  } else {
    settings = normalizeSettingsObject(fallbackStore.settings);
    if (!isAdmin) {
      delete settings.smtp_settings;
    }

    products = fallbackStore.products.map((item) => normalizeProductRow(item));

    if (isAdmin) {
      const { page, pageSize, offset } = getPagination(url);
      const q = String(url.searchParams.get('q') || '').trim().toLowerCase();
      const status = String(url.searchParams.get('status') || '').trim().toLowerCase();

      const filteredOrders = fallbackStore.orders.filter((order) => {
        const matchesStatus = !status || String(order.status || '').toLowerCase() === status;
        if (!matchesStatus) return false;
        if (!q) return true;
        const haystack = [order.id, order.customer_name, order.customer_email, order.phone]
          .map((value) => String(value || '').toLowerCase())
          .join(' ');
        return haystack.includes(q);
      });

      orders = filteredOrders.slice(offset, offset + pageSize);

      const usersPage = Math.max(1, toNumber(url.searchParams.get('usersPage'), page));
      const usersPageSize = Math.min(100, Math.max(10, toNumber(url.searchParams.get('usersPageSize'), pageSize)));
      const usersOffset = (usersPage - 1) * usersPageSize;
      const usersQ = String(url.searchParams.get('usersQ') || q).trim().toLowerCase();

      const filteredUsers = fallbackStore.users.filter((user) => {
        if (!usersQ) return true;
        const haystack = [user.name, user.email, user.phone].map((v) => String(v || '').toLowerCase()).join(' ');
        return haystack.includes(usersQ);
      });

      users = filteredUsers
        .slice(usersOffset, usersOffset + usersPageSize)
        .map((user) => ({
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          district: user.district || '',
          thana: user.thana || '',
          address: user.address || '',
          profile_image: user.profile_image || '',
          role: user.role || 'USER',
          created_at: user.created_at || new Date().toISOString(),
        }));

      logs = fallbackStore.logs.slice(0, 50);
      traffic = fallbackStore.traffic.filter((entry) => Date.now() - new Date(entry.last_active || 0).getTime() <= 5 * 60_000);

      meta = {
        orders: { page, pageSize, count: filteredOrders.length },
        users: { page: usersPage, pageSize: usersPageSize, count: filteredUsers.length },
      };
    } else if (isUser && authUser?.email) {
      orders = fallbackStore.orders
        .filter((order) => order.user_id === authUser.id || normalizeEmail(order.customer_email) === normalizeEmail(authUser.email))
        .slice(0, 300);
    }
  }

  json(res, 200, {
    status: 'success',
    storage: storage.mode,
    dbHost: storage.dbHost,
    dbName: storage.dbName,
    data: {
      products,
      orders,
      users,
      settings,
      logs,
      traffic,
      meta,
    },
  });
}

function validateSignupInput(input) {
  const email = normalizeEmail(input.email);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, message: 'INVALID_EMAIL' };
  }

  const password = String(input.password || '');
  const isGoogleSignup = typeof input.google_sub === 'string' && input.google_sub.trim() !== '';
  if (!isGoogleSignup && password.length < 6) {
    return { ok: false, message: 'PASSWORD_REQUIRED' };
  }

  return { ok: true };
}

async function handleSignup(req, res, storage, authUser) {
  const ip = getClientIp(req);
  const limitKey = `signup:${ip}`;
  if (checkRateLimit(limitKey, 8, 60_000)) {
    handleError(res, 429, 'RATE_LIMIT_EXCEEDED');
    return;
  }

  let input;
  try {
    input = await readJsonBody(req);
  } catch (error) {
    handleError(res, 400, error.message || 'INVALID_PAYLOAD');
    return;
  }

  if (String(input.website || '').trim() !== '') {
    handleError(res, 400, 'SPAM_BLOCKED');
    return;
  }

  const validation = validateSignupInput(input);
  if (!validation.ok) {
    handleError(res, 400, validation.message || 'INVALID_SIGNUP_PAYLOAD');
    return;
  }

  const email = normalizeEmail(input.email);
  const name = String(input.name || '').trim() || buildDisplayNameFromEmail(email);
  const phone = String(input.phone || '').trim() || 'N/A';
  const address = String(input.address || '').trim();
  const district = String(input.district || '').trim();
  const thana = String(input.thana || '').trim();
  const profileImage = String(input.profileImage || input.profile_image || '').trim();
  const incomingRole = String(input.role || 'USER').trim().toUpperCase();
  const canAssignAdminRole = incomingRole === 'ADMIN' && isAdminAuthenticated(req, authUser);
  const role = canAssignAdminRole ? 'ADMIN' : 'USER';
  const passwordRaw = String(input.password || '') || (input.google_sub ? crypto.randomBytes(8).toString('hex') : '');
  const password = hashPassword(passwordRaw);

  let userRow;

  try {
    if (storage.mode === 'mysql' && storage.pool) {
      const existing = await getUserByEmail(storage, email);
      if (existing) {
        handleError(res, 409, 'EMAIL_ALREADY_REGISTERED');
        return;
      } else {
        const userId = String(input.id || '').trim() || generateId('usr');
        await mysqlQuery(
          storage.pool,
          `INSERT INTO users (id, name, email, phone, district, thana, address, profile_image, password, role)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [userId, name, email, phone, district || null, thana || null, address || null, profileImage || null, password, role]
        );
        userRow = await getUserById(storage, userId);
      }
    } else {
      const existingIndex = fallbackStore.users.findIndex((user) => normalizeEmail(user.email) === email);
      if (existingIndex >= 0) {
        handleError(res, 409, 'EMAIL_ALREADY_REGISTERED');
        return;
      } else {
        userRow = {
          id: String(input.id || '').trim() || generateId('usr'),
          name,
          email,
          phone,
          district,
          thana,
          address,
          profile_image: profileImage,
          password,
          role,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        fallbackStore.users.unshift(userRow);
      }
      persistFallbackStore();
    }

    const safeUser = sanitizeUser(userRow);
    const token = issueAuthToken(safeUser);

    await Promise.allSettled([
      pushSheetsWebhook('SIGNUP', safeUser),
      sendSignupTelegram(safeUser),
      logSystemEvent(storage, 'IDENTITY_REGISTRATION', `Signup completed for ${safeUser.email}`, ip, safeUser.id),
    ]);

    json(res, 200, {
      status: 'success',
      storage: storage.mode,
      user: safeUser,
      token,
    });
  } catch (error) {
    handleError(res, 500, 'SIGNUP_FAILED', error instanceof Error ? error.message : String(error));
  }
}

async function handleLogin(req, res, storage) {
  const ip = getClientIp(req);
  const limitKey = `login:${ip}`;
  if (checkRateLimit(limitKey, 12, 60_000)) {
    handleError(res, 429, 'RATE_LIMIT_EXCEEDED');
    return;
  }

  let input;
  try {
    input = await readJsonBody(req);
  } catch (error) {
    handleError(res, 400, error.message || 'INVALID_PAYLOAD');
    return;
  }

  const identifier = normalizeEmail(input.identifier || input.email);
  const password = String(input.password || '');
  if (!identifier || !password) {
    handleError(res, 400, 'INVALID_CREDENTIALS');
    return;
  }

  try {
    const user = await getUserByEmail(storage, identifier);

    if (user) {
      const verified = await verifyPassword(password, user.password);
      if (verified.ok) {
        if (verified.needsUpgrade && storage.mode === 'mysql' && storage.pool) {
          const upgraded = hashPassword(password);
          await mysqlQuery(storage.pool, 'UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?', [upgraded, user.id]);
          user.password = upgraded;
        }

        const safeUser = sanitizeUser(user);
        const token = issueAuthToken(safeUser);
        await logSystemEvent(storage, 'IDENTITY_VALIDATION', `Login successful for ${safeUser.email}`, ip, safeUser.id);
        json(res, 200, {
          status: 'success',
          storage: storage.mode,
          user: safeUser,
          token,
        });
        return;
      }
      if (verified.message === 'BCRYPT_UNSUPPORTED') {
        handleError(res, 400, 'PASSWORD_RESET_REQUIRED');
        return;
      }
    }

    await logSystemEvent(storage, 'SECURITY_ALERT', `Failed login attempt for ${identifier}`, ip, null);
    handleError(res, 401, 'INVALID_CREDENTIALS');
  } catch (error) {
    handleError(res, 500, 'LOGIN_FAILED', error instanceof Error ? error.message : String(error));
  }
}

async function handleCreateOrder(req, res, storage, authUser) {
  const ip = getClientIp(req);
  const limitKey = `create_order:${ip}`;
  if (checkRateLimit(limitKey, 10, 60_000)) {
    handleError(res, 429, 'RATE_LIMIT_EXCEEDED');
    return;
  }

  let input;
  try {
    input = await readJsonBody(req);
  } catch (error) {
    handleError(res, 400, error.message || 'INVALID_PAYLOAD');
    return;
  }

  if (String(input.website || '').trim() !== '') {
    handleError(res, 400, 'SPAM_BLOCKED');
    return;
  }

  const order = normalizeOrderPayload(input, authUser);
  if (!order.customer_name || !order.customer_email || !order.phone || !order.address) {
    handleError(res, 400, 'MISSING_REQUIRED_FIELDS');
    return;
  }

  try {
    if (storage.mode === 'mysql' && storage.pool) {
      await mysqlQuery(
        storage.pool,
        `INSERT INTO orders
          (id, user_id, customer_name, customer_email, phone, district, thana, address, items, total, status, customer_comment, tracking_number, admin_notes, shipping_fee, discount_amount, discount_code)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          order.id,
          order.user_id,
          order.customer_name,
          order.customer_email,
          order.phone,
          order.district || null,
          order.thana || null,
          order.address,
          JSON.stringify(order.items || []),
          order.total,
          order.status,
          order.customer_comment || null,
          order.tracking_number || null,
          order.admin_notes || null,
          order.shipping_fee,
          order.discount_amount,
          order.discount_code,
        ]
      );
    } else {
      fallbackStore.orders.unshift(normalizeOrderRow(order));
      persistFallbackStore();
    }

    await Promise.allSettled([
      pushSheetsWebhook('ORDER', {
        order_id: order.id,
        created_at: order.created_at,
        name: order.customer_name,
        email: order.customer_email,
        phone: order.phone,
        address: order.address,
        district: order.district,
        thana: order.thana,
        product_name: Array.isArray(order.items) && order.items[0]?.product?.name ? order.items[0].product.name : '',
        product_url: Array.isArray(order.items) && order.items[0]?.productUrl ? order.items[0].productUrl : '',
        image_url: Array.isArray(order.items) && order.items[0]?.product?.image ? order.items[0].product.image : '',
        quantity: Array.isArray(order.items) ? order.items.reduce((acc, item) => acc + toNumber(item.quantity, 0), 0) : 0,
        notes: order.customer_comment,
        status: String(order.status || 'Pending').toUpperCase(),
      }),
      sendOrderTelegram(order),
      logSystemEvent(storage, 'ORDER_CREATED', `Order ${order.id} created`, ip, authUser.id),
    ]);

    json(res, 200, {
      status: 'success',
      storage: storage.mode,
      order_id: order.id,
      message: 'ORDER_RECEIVED',
    });
  } catch (error) {
    handleError(res, 500, 'ORDER_CREATE_FAILED', error instanceof Error ? error.message : String(error));
  }
}

async function handleDeleteOrder(req, res, storage, authUser) {
  if (!isAdminAuthenticated(req, authUser)) {
    handleError(res, 403, 'ADMIN_ACCESS_REQUIRED');
    return;
  }

  let input;
  try {
    input = await readJsonBody(req);
  } catch (error) {
    handleError(res, 400, error.message || 'INVALID_PAYLOAD');
    return;
  }

  const orderId = String(input.id || '').trim();
  if (!orderId) {
    handleError(res, 400, 'MISSING_ID');
    return;
  }

  try {
    if (storage.mode === 'mysql' && storage.pool) {
      await mysqlQuery(storage.pool, 'DELETE FROM orders WHERE id = ?', [orderId]);
    } else {
      fallbackStore.orders = fallbackStore.orders.filter((order) => String(order.id) !== orderId);
      persistFallbackStore();
    }

    await Promise.allSettled([
      pushSheetsWebhook('DELETE_ORDER', { id: orderId }),
      logSystemEvent(storage, 'REGISTRY_ERASURE', `Order ${orderId} deleted`, getClientIp(req), authUser?.id || null),
    ]);

    json(res, 200, { status: 'success', storage: storage.mode });
  } catch (error) {
    handleError(res, 500, 'DELETE_ORDER_FAILED', error instanceof Error ? error.message : String(error));
  }
}

async function handleUpdateOrderStatus(req, res, storage, authUser) {
  if (!isAdminAuthenticated(req, authUser)) {
    handleError(res, 403, 'ADMIN_ACCESS_REQUIRED');
    return;
  }

  let input;
  try {
    input = await readJsonBody(req);
  } catch (error) {
    handleError(res, 400, error.message || 'INVALID_PAYLOAD');
    return;
  }

  const orderId = String(input.id || '').trim();
  const status = String(input.status || '').trim();
  if (!orderId || !status) {
    handleError(res, 400, 'MISSING_PARAMETERS');
    return;
  }

  try {
    if (storage.mode === 'mysql' && storage.pool) {
      await mysqlQuery(storage.pool, 'UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?', [status, orderId]);
    } else {
      fallbackStore.orders = fallbackStore.orders.map((order) =>
        String(order.id) === orderId
          ? { ...order, status, updated_at: new Date().toISOString() }
          : order
      );
      persistFallbackStore();
    }

    await Promise.allSettled([
      pushSheetsWebhook('UPDATE_STATUS', { id: orderId, status }),
      sendTelegramMessage(
        [
          '<b>📦 Order Status Updated</b>',
          `<b>Order ID:</b> ${escapeTelegramHtml(orderId)}`,
          `<b>New Status:</b> ${escapeTelegramHtml(status)}`,
          `<b>Time:</b> ${escapeTelegramHtml(new Date().toISOString())}`,
        ].join('\n')
      ),
      logSystemEvent(storage, 'LOGISTICS_UPDATE', `Order ${orderId} status updated to ${status}`, getClientIp(req), authUser?.id || null),
    ]);

    json(res, 200, { status: 'success', storage: storage.mode, message: 'STATUS_SYNCHRONIZED' });
  } catch (error) {
    handleError(res, 500, 'STATUS_UPDATE_FAILED', error instanceof Error ? error.message : String(error));
  }
}

async function handleUpdateOrderMetadata(req, res, storage, authUser) {
  if (!isAdminAuthenticated(req, authUser)) {
    handleError(res, 403, 'ADMIN_ACCESS_REQUIRED');
    return;
  }

  let input;
  try {
    input = await readJsonBody(req);
  } catch (error) {
    handleError(res, 400, error.message || 'INVALID_PAYLOAD');
    return;
  }

  const orderId = String(input.id || '').trim();
  if (!orderId) {
    handleError(res, 400, 'MISSING_ID');
    return;
  }

  const trackingNumber = String(input.trackingNumber || '').trim() || null;
  const adminNotes = String(input.adminNotes || '').trim() || null;

  try {
    if (storage.mode === 'mysql' && storage.pool) {
      await mysqlQuery(
        storage.pool,
        'UPDATE orders SET tracking_number = ?, admin_notes = ?, updated_at = NOW() WHERE id = ?',
        [trackingNumber, adminNotes, orderId]
      );
    } else {
      fallbackStore.orders = fallbackStore.orders.map((order) =>
        String(order.id) === orderId
          ? {
              ...order,
              tracking_number: trackingNumber,
              admin_notes: adminNotes,
              updated_at: new Date().toISOString(),
            }
          : order
      );
      persistFallbackStore();
    }

    await logSystemEvent(storage, 'ORDER_METADATA_UPDATE', `Order ${orderId} metadata updated`, getClientIp(req), authUser?.id || null);

    json(res, 200, { status: 'success', storage: storage.mode });
  } catch (error) {
    handleError(res, 500, 'METADATA_UPDATE_FAILED', error instanceof Error ? error.message : String(error));
  }
}

function normalizeProductInput(input) {
  const productTypeFromCategory = String(input.category || '').toLowerCase().includes('bag') ? 'bag' : 'shoe';
  return {
    id: String(input.id || '').trim(),
    name: String(input.name || '').trim(),
    brand: String(input.brand || '').trim() || 'Splaro',
    price: toNumber(input.price, 0),
    image: String(input.image || '').trim(),
    category: String(input.category || '').trim() || 'Shoes',
    type: String(input.type || '').trim() || 'Unisex',
    product_type: String(input.productType || input.product_type || '').trim() || productTypeFromCategory,
    description: input.description || { EN: '', BN: '' },
    sizes: Array.isArray(input.sizes) ? input.sizes : [],
    colors: Array.isArray(input.colors) ? input.colors : [],
    materials: Array.isArray(input.materials) ? input.materials : [],
    tags: Array.isArray(input.tags) ? input.tags : [],
    featured: input.featured ? 1 : 0,
    sku: String(input.sku || '').trim() || null,
    stock: toNumber(input.stock, 50),
    weight: String(input.weight || '').trim() || null,
    dimensions: input.dimensions || {},
    variations: Array.isArray(input.variations) ? input.variations : [],
    additional_images: Array.isArray(input.additionalImages)
      ? input.additionalImages
      : Array.isArray(input.additional_images)
        ? input.additional_images
        : [],
    size_chart_image: String(input.sizeChartImage || input.size_chart_image || '').trim() || null,
    discount_percentage: input.discountPercentage === null || input.discountPercentage === undefined
      ? null
      : toNumber(input.discountPercentage, 0),
    sub_category: String(input.subCategory || input.sub_category || '').trim() || null,
  };
}

async function handleSyncProducts(req, res, storage, authUser) {
  if (!isAdminAuthenticated(req, authUser)) {
    handleError(res, 403, 'ADMIN_ACCESS_REQUIRED');
    return;
  }

  let input;
  try {
    input = await readJsonBody(req);
  } catch (error) {
    handleError(res, 400, error.message || 'INVALID_PAYLOAD');
    return;
  }

  const products = Array.isArray(input) ? input : Array.isArray(input.products) ? input.products : [];
  const purgeMissing = Boolean(input && typeof input === 'object' && input.purgeMissing);

  if (!Array.isArray(products)) {
    handleError(res, 400, 'INVALID_PRODUCT_PAYLOAD');
    return;
  }

  try {
    const normalizedProducts = products.map((product) => normalizeProductInput(product));
    const invalid = normalizedProducts.find((product) => !product.id || !product.name || !product.image || !product.category);

    if (invalid) {
      handleError(res, 400, 'PRODUCT_REQUIRED_FIELDS_MISSING');
      return;
    }

    if (storage.mode === 'mysql' && storage.pool) {
      const upsertSql = `INSERT INTO products
        (id, name, brand, price, image, category, type, product_type, description, sizes, colors, materials, tags, featured, sku, stock, weight, dimensions, variations, additional_images, size_chart_image, discount_percentage, sub_category)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          name = VALUES(name),
          brand = VALUES(brand),
          price = VALUES(price),
          image = VALUES(image),
          category = VALUES(category),
          type = VALUES(type),
          product_type = VALUES(product_type),
          description = VALUES(description),
          sizes = VALUES(sizes),
          colors = VALUES(colors),
          materials = VALUES(materials),
          tags = VALUES(tags),
          featured = VALUES(featured),
          sku = VALUES(sku),
          stock = VALUES(stock),
          weight = VALUES(weight),
          dimensions = VALUES(dimensions),
          variations = VALUES(variations),
          additional_images = VALUES(additional_images),
          size_chart_image = VALUES(size_chart_image),
          discount_percentage = VALUES(discount_percentage),
          sub_category = VALUES(sub_category),
          updated_at = NOW()`;

      for (const product of normalizedProducts) {
        await mysqlQuery(storage.pool, upsertSql, [
          product.id,
          product.name,
          product.brand,
          product.price,
          product.image,
          product.category,
          product.type,
          product.product_type,
          JSON.stringify(product.description || {}),
          JSON.stringify(product.sizes || []),
          JSON.stringify(product.colors || []),
          JSON.stringify(product.materials || []),
          JSON.stringify(product.tags || []),
          product.featured,
          product.sku,
          product.stock,
          product.weight,
          JSON.stringify(product.dimensions || {}),
          JSON.stringify(product.variations || []),
          JSON.stringify(product.additional_images || []),
          product.size_chart_image,
          product.discount_percentage,
          product.sub_category,
        ]);
      }

      if (purgeMissing && normalizedProducts.length > 0) {
        const ids = normalizedProducts.map((product) => product.id);
        const placeholders = ids.map(() => '?').join(',');
        await mysqlQuery(storage.pool, `DELETE FROM products WHERE id NOT IN (${placeholders})`, ids);
      }
    } else {
      const map = new Map(fallbackStore.products.map((product) => [String(product.id), product]));
      for (const product of normalizedProducts) {
        map.set(product.id, {
          ...product,
          description: product.description,
          sizes: product.sizes,
          colors: product.colors,
          materials: product.materials,
          tags: product.tags,
          dimensions: product.dimensions,
          variations: product.variations,
          additional_images: product.additional_images,
          created_at: map.get(product.id)?.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }

      let nextProducts = Array.from(map.values());
      if (purgeMissing) {
        const keep = new Set(normalizedProducts.map((product) => product.id));
        nextProducts = nextProducts.filter((product) => keep.has(String(product.id)));
      }

      fallbackStore.products = nextProducts;
      persistFallbackStore();
    }

    await logSystemEvent(storage, 'PRODUCT_SYNC', `Products synchronized (${normalizedProducts.length})`, getClientIp(req), authUser?.id || null);

    json(res, 200, {
      status: 'success',
      storage: storage.mode,
      message: 'PRODUCT_MANIFEST_UPDATED',
    });
  } catch (error) {
    handleError(res, 500, 'PRODUCT_SYNC_FAILED', error instanceof Error ? error.message : String(error));
  }
}

async function handleUpdateProfile(req, res, storage, authUser) {
  if (!authUser?.id) {
    handleError(res, 401, 'AUTH_REQUIRED');
    return;
  }

  let input;
  try {
    input = await readJsonBody(req);
  } catch (error) {
    handleError(res, 400, error.message || 'INVALID_PAYLOAD');
    return;
  }

  const isAdmin = isAdminAuthenticated(req, authUser);
  const targetId = isAdmin && input.id ? String(input.id) : String(authUser.id);

  try {
    const current = await getUserById(storage, targetId);
    if (!current) {
      handleError(res, 404, 'USER_NOT_FOUND');
      return;
    }

    const nextName = String(input.name || current.name || '').trim() || 'Splaro Customer';
    const nextPhone = String(input.phone || current.phone || '').trim() || 'N/A';
    const nextAddress = String(input.address || current.address || '').trim();
    const nextDistrict = String(input.district || current.district || '').trim();
    const nextThana = String(input.thana || current.thana || '').trim();
    const nextProfileImage = String(input.profileImage || input.profile_image || current.profile_image || '').trim();

    if (storage.mode === 'mysql' && storage.pool) {
      await mysqlQuery(
        storage.pool,
        `UPDATE users SET name = ?, phone = ?, address = ?, district = ?, thana = ?, profile_image = ?, updated_at = NOW() WHERE id = ?`,
        [nextName, nextPhone, nextAddress || null, nextDistrict || null, nextThana || null, nextProfileImage || null, targetId]
      );
    } else {
      const index = fallbackStore.users.findIndex((user) => String(user.id) === targetId);
      if (index >= 0) {
        fallbackStore.users[index] = {
          ...fallbackStore.users[index],
          name: nextName,
          phone: nextPhone,
          address: nextAddress,
          district: nextDistrict,
          thana: nextThana,
          profile_image: nextProfileImage,
          updated_at: new Date().toISOString(),
        };
        persistFallbackStore();
      }
    }

    const updatedUser = await getUserById(storage, targetId);
    const safeUser = sanitizeUser(updatedUser || current);
    const token = issueAuthToken(safeUser);

    await logSystemEvent(storage, 'PROFILE_UPDATE', `Profile updated for ${safeUser.email || safeUser.id}`, getClientIp(req), safeUser.id || null);

    json(res, 200, {
      status: 'success',
      storage: storage.mode,
      user: safeUser,
      token,
    });
  } catch (error) {
    handleError(res, 500, 'PROFILE_UPDATE_FAILED', error instanceof Error ? error.message : String(error));
  }
}

async function handleUpdateSettings(req, res, storage, authUser) {
  if (!isAdminAuthenticated(req, authUser)) {
    handleError(res, 403, 'ADMIN_ACCESS_REQUIRED');
    return;
  }

  let input;
  try {
    input = await readJsonBody(req);
  } catch (error) {
    handleError(res, 400, error.message || 'INVALID_PAYLOAD');
    return;
  }

  const payload = normalizeSettingsObject({
    ...fallbackStore.settings,
    ...input,
    site_name: input.siteName || input.site_name || fallbackStore.settings.site_name,
    support_email: input.supportEmail || input.support_email || fallbackStore.settings.support_email,
    support_phone: input.supportPhone || input.support_phone || fallbackStore.settings.support_phone,
    whatsapp_number: input.whatsappNumber || input.whatsapp_number || fallbackStore.settings.whatsapp_number,
    facebook_link: input.facebookLink || input.facebook_link || fallbackStore.settings.facebook_link,
    instagram_link: input.instagramLink || input.instagram_link || fallbackStore.settings.instagram_link,
    maintenance_mode: input.maintenanceMode ? 1 : 0,
    logo_url: input.logoUrl || input.logo_url || fallbackStore.settings.logo_url,
    smtp_settings: input.smtpSettings || input.smtp_settings || fallbackStore.settings.smtp_settings,
    logistics_config: input.logisticsConfig || input.logistics_config || fallbackStore.settings.logistics_config,
    hero_slides: input.slides || input.hero_slides || fallbackStore.settings.hero_slides,
    content_pages: input.cmsPages || input.contentPages || input.content_pages || fallbackStore.settings.content_pages,
    story_posts: input.storyPosts || input.story_posts || fallbackStore.settings.story_posts,
    updated_at: new Date().toISOString(),
  });

  try {
    if (storage.mode === 'mysql' && storage.pool) {
      await mysqlQuery(
        storage.pool,
        `UPDATE site_settings SET
          site_name = ?,
          support_email = ?,
          support_phone = ?,
          whatsapp_number = ?,
          facebook_link = ?,
          instagram_link = ?,
          maintenance_mode = ?,
          logo_url = ?,
          smtp_settings = ?,
          logistics_config = ?,
          hero_slides = ?,
          content_pages = ?,
          story_posts = ?,
          updated_at = NOW()
         WHERE id = 1`,
        [
          payload.site_name,
          payload.support_email,
          payload.support_phone || null,
          payload.whatsapp_number || null,
          payload.facebook_link || null,
          payload.instagram_link || null,
          payload.maintenance_mode ? 1 : 0,
          payload.logo_url || null,
          JSON.stringify(payload.smtp_settings || {}),
          JSON.stringify(payload.logistics_config || {}),
          JSON.stringify(payload.hero_slides || []),
          JSON.stringify(payload.content_pages || {}),
          JSON.stringify(payload.story_posts || []),
        ]
      );
    }

    fallbackStore.settings = payload;
    persistFallbackStore();

    await logSystemEvent(storage, 'SYSTEM_OVERRIDE', 'Site settings updated', getClientIp(req), authUser?.id || null);

    json(res, 200, {
      status: 'success',
      storage: storage.mode,
      message: 'CONFIGURATION_ARCHIVED',
    });
  } catch (error) {
    handleError(res, 500, 'SETTINGS_UPDATE_FAILED', error instanceof Error ? error.message : String(error));
  }
}

async function handleDeleteUser(req, res, storage, authUser) {
  if (!isAdminAuthenticated(req, authUser)) {
    handleError(res, 403, 'ADMIN_ACCESS_REQUIRED');
    return;
  }

  let input;
  try {
    input = await readJsonBody(req);
  } catch (error) {
    handleError(res, 400, error.message || 'INVALID_PAYLOAD');
    return;
  }

  const userId = String(input.id || '').trim();
  if (!userId) {
    handleError(res, 400, 'MISSING_ID');
    return;
  }

  try {
    if (storage.mode === 'mysql' && storage.pool) {
      await mysqlQuery(storage.pool, 'DELETE FROM users WHERE id = ?', [userId]);
    } else {
      fallbackStore.users = fallbackStore.users.filter((user) => String(user.id) !== userId);
      persistFallbackStore();
    }

    await Promise.allSettled([
      pushSheetsWebhook('DELETE_USER', { id: userId }),
      logSystemEvent(storage, 'IDENTITY_TERMINATION', `User ${userId} deleted`, getClientIp(req), authUser?.id || null),
    ]);

    json(res, 200, { status: 'success', storage: storage.mode });
  } catch (error) {
    handleError(res, 500, 'DELETE_USER_FAILED', error instanceof Error ? error.message : String(error));
  }
}

async function handleInitializeSheets(req, res, storage, authUser) {
  if (!isAdminAuthenticated(req, authUser)) {
    handleError(res, 403, 'ADMIN_ACCESS_REQUIRED');
    return;
  }

  await Promise.allSettled([
    pushSheetsWebhook('INIT', { message: 'INITIALIZING_RECORDS', time: new Date().toISOString() }),
    logSystemEvent(storage, 'REGISTRY_INITIALIZATION', 'Google Sheets registry initialization requested', getClientIp(req), authUser?.id || null),
  ]);

  json(res, 200, {
    status: 'success',
    storage: storage.mode,
    message: 'REGISTRY_INITIALIZED',
  });
}

async function handleHeartbeat(req, res, storage, authUser) {
  let input;
  try {
    input = await readJsonBody(req);
  } catch (error) {
    handleError(res, 400, error.message || 'INVALID_PAYLOAD');
    return;
  }

  const sessionId = String(input.sessionId || '').trim();
  if (!sessionId) {
    handleError(res, 400, 'MISSING_IDENTITY');
    return;
  }

  const userId = input.userId || authUser?.id || null;
  const ip = getClientIp(req);
  const requestPath = String(input.path || '/').slice(0, 255);
  const userAgent = String(req.headers['user-agent'] || '').slice(0, 1000);

  try {
    if (storage.mode === 'mysql' && storage.pool) {
      await mysqlQuery(
        storage.pool,
        `INSERT INTO traffic_metrics (session_id, user_id, ip_address, path, user_agent)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
          user_id = VALUES(user_id),
          ip_address = VALUES(ip_address),
          path = VALUES(path),
          user_agent = VALUES(user_agent),
          last_active = CURRENT_TIMESTAMP`,
        [sessionId, userId, ip, requestPath, userAgent]
      );
    } else {
      const existingIndex = fallbackStore.traffic.findIndex((entry) => String(entry.session_id) === sessionId);
      const row = {
        session_id: sessionId,
        user_id: userId,
        ip_address: ip,
        path: requestPath,
        user_agent: userAgent,
        last_active: new Date().toISOString(),
      };
      if (existingIndex >= 0) fallbackStore.traffic[existingIndex] = row;
      else fallbackStore.traffic.unshift(row);
      fallbackStore.traffic = fallbackStore.traffic.slice(0, 500);
      persistFallbackStore();
    }

    json(res, 200, { status: 'success', storage: storage.mode });
  } catch (error) {
    handleError(res, 500, 'HEARTBEAT_FAILED', error instanceof Error ? error.message : String(error));
  }
}

async function handleSubscribe(req, res, storage) {
  const ip = getClientIp(req);
  const limitKey = `subscribe:${ip}`;
  if (checkRateLimit(limitKey, 10, 60_000)) {
    handleError(res, 429, 'RATE_LIMIT_EXCEEDED');
    return;
  }

  let input;
  try {
    input = await readJsonBody(req);
  } catch (error) {
    handleError(res, 400, error.message || 'INVALID_PAYLOAD');
    return;
  }

  if (String(input.website || '').trim() !== '') {
    handleError(res, 400, 'SPAM_BLOCKED');
    return;
  }

  const email = normalizeEmail(input.email);
  const source = ['footer', 'popup'].includes(String(input.source || '').toLowerCase())
    ? String(input.source).toLowerCase()
    : 'footer';
  const consent = Boolean(input.consent);

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    handleError(res, 400, 'INVALID_EMAIL');
    return;
  }

  try {
    let existing = null;

    if (storage.mode === 'mysql' && storage.pool) {
      const rows = await mysqlQuery(storage.pool, 'SELECT id FROM subscriptions WHERE email = ? LIMIT 1', [email]);
      existing = Array.isArray(rows) && rows[0] ? rows[0] : null;
    } else {
      existing = fallbackStore.subscriptions.find((entry) => normalizeEmail(entry.email) === email) || null;
    }

    if (existing) {
      json(res, 200, { status: 'success', message: 'ALREADY_SUBSCRIBED', sub_id: existing.id });
      return;
    }

    const entry = {
      id: generateId('sub'),
      email,
      consent: consent ? 1 : 0,
      source,
      created_at: new Date().toISOString(),
    };

    if (storage.mode === 'mysql' && storage.pool) {
      await mysqlQuery(
        storage.pool,
        'INSERT INTO subscriptions (id, email, consent, source) VALUES (?, ?, ?, ?)',
        [entry.id, entry.email, entry.consent, entry.source]
      );
    } else {
      fallbackStore.subscriptions.unshift(entry);
      persistFallbackStore();
    }

    await Promise.allSettled([
      pushSheetsWebhook('SUBSCRIPTION', {
        sub_id: entry.id,
        created_at: entry.created_at,
        email: entry.email,
        consent: Boolean(entry.consent),
        source: entry.source,
      }),
      sendSubscriptionTelegram(entry),
      logSystemEvent(storage, 'SUBSCRIPTION_CREATED', `New subscriber ${entry.email}`, ip, null),
    ]);

    json(res, 200, {
      status: 'success',
      storage: storage.mode,
      sub_id: entry.id,
    });
  } catch (error) {
    handleError(res, 500, 'SUBSCRIPTION_FAILED', error instanceof Error ? error.message : String(error));
  }
}

async function handleForgotPassword(req, res, storage) {
  const ip = getClientIp(req);
  const limitKey = `forgot_password:${ip}`;
  if (checkRateLimit(limitKey, 8, 60_000)) {
    handleError(res, 429, 'RATE_LIMIT_EXCEEDED');
    return;
  }

  let input;
  try {
    input = await readJsonBody(req);
  } catch (error) {
    handleError(res, 400, error.message || 'INVALID_PAYLOAD');
    return;
  }

  const email = normalizeEmail(input.email);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    handleError(res, 400, 'INVALID_EMAIL');
    return;
  }

  try {
    const user = await getUserByEmail(storage, email);
    if (!user) {
      handleError(res, 404, 'IDENTITY_NOT_FOUND');
      return;
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expiryDate = new Date(Date.now() + 15 * 60_000);

    if (storage.mode === 'mysql' && storage.pool) {
      await mysqlQuery(storage.pool, 'UPDATE users SET reset_code = ?, reset_expiry = ? WHERE id = ?', [otp, expiryDate, user.id]);
    } else {
      const index = fallbackStore.users.findIndex((entry) => entry.id === user.id);
      if (index >= 0) {
        fallbackStore.users[index] = {
          ...fallbackStore.users[index],
          reset_code: otp,
          reset_expiry: expiryDate.toISOString(),
          updated_at: new Date().toISOString(),
        };
        persistFallbackStore();
      }
    }

    const mailResult = await sendMail({
      to: email,
      subject: 'SPLARO password reset code',
      text: `Your SPLARO verification code is ${otp}. This code expires in 15 minutes.`,
      html: `<p>Your SPLARO verification code is <b>${otp}</b>.</p><p>This code expires in 15 minutes.</p>`,
    });
    if (!mailResult.ok) {
      await logSystemEvent(
        storage,
        'PASSWORD_RECOVERY_MAIL_FAILED',
        `Password reset code delivery failed for ${email}: ${mailResult.message || 'unknown'}`,
        ip,
        user.id
      );
      handleError(res, 500, 'SIGNAL_DISPATCH_FAILURE');
      return;
    }

    await logSystemEvent(storage, 'PASSWORD_RECOVERY', `Password reset code generated for ${email}`, ip, user.id);

    json(res, 200, {
      status: 'success',
      storage: storage.mode,
      message: 'RECOVERY_SIGNAL_DISPATCHED',
    });
  } catch (error) {
    handleError(res, 500, 'RECOVERY_SIGNAL_FAILED', error instanceof Error ? error.message : String(error));
  }
}

async function handleResetPassword(req, res, storage) {
  const ip = getClientIp(req);
  const limitKey = `reset_password:${ip}`;
  if (checkRateLimit(limitKey, 8, 60_000)) {
    handleError(res, 429, 'RATE_LIMIT_EXCEEDED');
    return;
  }

  let input;
  try {
    input = await readJsonBody(req);
  } catch (error) {
    handleError(res, 400, error.message || 'INVALID_PAYLOAD');
    return;
  }

  const email = normalizeEmail(input.email);
  const otp = String(input.otp || '').trim();
  const password = String(input.password || '');

  if (!email || !otp || password.length < 6) {
    handleError(res, 400, 'INVALID_RESET_REQUEST');
    return;
  }

  try {
    const user = await getUserByEmail(storage, email);
    if (!user) {
      handleError(res, 404, 'IDENTITY_NOT_FOUND');
      return;
    }

    const currentCode = String(user.reset_code || '');
    const expiry = user.reset_expiry ? new Date(user.reset_expiry).getTime() : 0;

    if (!currentCode || currentCode !== otp || !expiry || expiry < Date.now()) {
      handleError(res, 400, 'INVALID_CODE_OR_EXPIRED');
      return;
    }

    const hashed = hashPassword(password);

    if (storage.mode === 'mysql' && storage.pool) {
      await mysqlQuery(storage.pool, 'UPDATE users SET password = ?, reset_code = NULL, reset_expiry = NULL, updated_at = NOW() WHERE id = ?', [hashed, user.id]);
    } else {
      const index = fallbackStore.users.findIndex((entry) => entry.id === user.id);
      if (index >= 0) {
        fallbackStore.users[index] = {
          ...fallbackStore.users[index],
          password: hashed,
          reset_code: null,
          reset_expiry: null,
          updated_at: new Date().toISOString(),
        };
        persistFallbackStore();
      }
    }

    await logSystemEvent(storage, 'PASSWORD_RESET', `Password reset completed for ${email}`, ip, user.id);

    json(res, 200, {
      status: 'success',
      storage: storage.mode,
      message: 'PASSWORD_OVERRIDDEN',
    });
  } catch (error) {
    handleError(res, 500, 'RESET_PASSWORD_FAILED', error instanceof Error ? error.message : String(error));
  }
}

async function handleHealth(res) {
  const startedAt = Date.now();
  const storage = await resolveStorage();
  const latency = Date.now() - startedAt;

  json(res, 200, {
    ok: true,
    runtime: 'node',
    env_loaded_from_file: envLoadedFromFile,
    storage: storage.mode,
    db: {
      connected: storage.mode === 'mysql',
      host: storage.dbHost || null,
      name: storage.dbName || null,
      error: storage.error || null,
      latency_ms: latency,
    },
  });
}

async function handleIndexAction(req, res, url) {
  const action = String(url.searchParams.get('action') || '').trim();
  const storage = await resolveStorage();
  const authUser = await resolveAuthUser(req, storage);

  if (req.method === 'GET' && action === 'health') {
    json(res, 200, {
      status: 'success',
      service: 'SPLARO_API_NODE',
      time: new Date().toISOString(),
      storage: storage.mode,
      dbHost: storage.dbHost,
      dbName: storage.dbName,
      error: storage.error || null,
    });
    return;
  }

  if (req.method === 'GET' && action === 'sync') {
    await handleSync(req, res, url, storage, authUser);
    return;
  }

  if (req.method === 'POST' && action === 'signup') {
    await handleSignup(req, res, storage, authUser);
    return;
  }

  if (req.method === 'POST' && action === 'login') {
    await handleLogin(req, res, storage);
    return;
  }

  if (req.method === 'POST' && action === 'create_order') {
    await handleCreateOrder(req, res, storage, authUser);
    return;
  }

  if (req.method === 'POST' && action === 'delete_order') {
    await handleDeleteOrder(req, res, storage, authUser);
    return;
  }

  if (req.method === 'POST' && action === 'update_order_status') {
    await handleUpdateOrderStatus(req, res, storage, authUser);
    return;
  }

  if (req.method === 'POST' && action === 'update_order_metadata') {
    await handleUpdateOrderMetadata(req, res, storage, authUser);
    return;
  }

  if (req.method === 'POST' && action === 'sync_products') {
    await handleSyncProducts(req, res, storage, authUser);
    return;
  }

  if (req.method === 'POST' && action === 'update_profile') {
    await handleUpdateProfile(req, res, storage, authUser);
    return;
  }

  if (req.method === 'POST' && action === 'update_settings') {
    await handleUpdateSettings(req, res, storage, authUser);
    return;
  }

  if (req.method === 'POST' && action === 'delete_user') {
    await handleDeleteUser(req, res, storage, authUser);
    return;
  }

  if (req.method === 'POST' && action === 'initialize_sheets') {
    await handleInitializeSheets(req, res, storage, authUser);
    return;
  }

  if (req.method === 'POST' && action === 'heartbeat') {
    await handleHeartbeat(req, res, storage, authUser);
    return;
  }

  if (req.method === 'POST' && action === 'subscribe') {
    await handleSubscribe(req, res, storage);
    return;
  }

  if (req.method === 'POST' && action === 'forgot_password') {
    await handleForgotPassword(req, res, storage);
    return;
  }

  if (req.method === 'POST' && action === 'reset_password') {
    await handleResetPassword(req, res, storage);
    return;
  }

  handleError(res, 404, 'ACTION_NOT_SUPPORTED');
}

const server = http.createServer(async (req, res) => {
  if (!req.url) {
    res.writeHead(400);
    res.end('Bad Request');
    return;
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': CORS_DEFAULT_ORIGIN,
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Key',
      Vary: 'Origin',
    });
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  try {
    if (url.pathname === '/api/health') {
      await handleHealth(res);
      return;
    }

    if (url.pathname === '/api/index.php') {
      await handleIndexAction(req, res, url);
      return;
    }
  } catch (error) {
    handleError(res, 500, 'UNHANDLED_SERVER_ERROR', error instanceof Error ? error.message : String(error));
    return;
  }

  let requestPath = decodeURIComponent(url.pathname);
  if (requestPath === '/') requestPath = '/index.html';

  const safePath = path.normalize(requestPath).replace(/^\.+[\\/]/, '');
  const filePath = path.join(distDir, safePath);

  if (filePath.startsWith(distDir) && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    res.writeHead(200, {
      'Content-Type': contentType(filePath),
      'Cache-Control': filePath.endsWith('.html') ? 'no-cache' : 'public, max-age=31536000, immutable',
    });
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  if (fs.existsSync(indexFile)) {
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache',
    });
    fs.createReadStream(indexFile).pipe(res);
    return;
  }

  res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(
    JSON.stringify({
      success: false,
      error: {
        code: 'BUILD_NOT_FOUND',
        message: 'dist folder not found. Run npm run build.',
      },
    })
  );
});

const port = Number(process.env.PORT || 3000);
server.listen(port, '0.0.0.0', () => {
  console.log(`[SPLARO] Node server running on 0.0.0.0:${port}`);
  console.log('[SPLARO] Build command: npm run build');
  console.log('[SPLARO] Start command: npm run start');
});
