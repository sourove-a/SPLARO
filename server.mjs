import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { URL } from 'node:url';
import process from 'node:process';

const cwd = process.cwd();
const distDir = path.join(cwd, 'dist');
const indexFile = path.join(distDir, 'index.html');

let envLoadedFromFile = false;

function loadEnvFiles() {
  const candidates = [
    path.join(cwd, '.env.local'),
    path.join(cwd, '.env'),
  ];

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

function getDbConfig() {
  const host = String(process.env.DB_HOST || '').trim();
  const portRaw = String(process.env.DB_PORT || '3306').trim();
  const name = String(process.env.DB_NAME || '').trim();
  const user = String(process.env.DB_USER || '').trim();
  const password = String(process.env.DB_PASSWORD || process.env.DB_PASS || '').trim();

  const missing = [];
  if (!host) missing.push('DB_HOST');
  if (!name) missing.push('DB_NAME');
  if (!user) missing.push('DB_USER');
  if (!password) missing.push('DB_PASSWORD');

  const port = Number(portRaw);
  return {
    host,
    hostCandidates: host === '127.0.0.1' ? ['127.0.0.1', 'localhost'] : host === 'localhost' ? ['localhost', '127.0.0.1'] : [host],
    port: Number.isFinite(port) && port > 0 ? port : 3306,
    name,
    user,
    password,
    missing,
    configured: missing.length === 0,
  };
}

async function checkDbConnection() {
  const config = getDbConfig();
  if (!config.configured) {
    return {
      connected: false,
      storage: 'fallback',
      missing: config.missing,
      dbHost: config.host,
      dbName: config.name,
      message: 'DATABASE_ENV_NOT_CONFIGURED',
    };
  }

  let lastError = '';
  let mysql = null;
  try {
    const mod = await import('mysql2/promise');
    mysql = mod.default || mod;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'mysql2 module not installed';
    return {
      connected: false,
      storage: 'fallback',
      dbHost: config.host,
      dbName: config.name,
      message: 'MYSQL_CLIENT_NOT_INSTALLED',
      error: message,
    };
  }

  for (const host of config.hostCandidates) {
    let conn;
    try {
      const started = Date.now();
      conn = await mysql.createConnection({
        host,
        port: config.port,
        user: config.user,
        password: config.password,
        database: config.name,
        connectTimeout: 5000,
        enableKeepAlive: true,
      });
      await conn.query('SELECT 1');
      const latencyMs = Date.now() - started;
      await conn.end();

      return {
        connected: true,
        storage: 'mysql',
        dbHost: host,
        dbName: config.name,
        latency_ms: latencyMs,
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Unknown DB error';
      if (conn) {
        try { await conn.end(); } catch {}
      }
    }
  }

  return {
    connected: false,
    storage: 'fallback',
    dbHost: config.host,
    dbName: config.name,
    message: 'DATABASE_CONNECTION_FAILED',
    error: lastError,
  };
}

const json = (res, status, payload) => {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Key',
  });
  res.end(body);
};

const contentType = (filePath) => {
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
};

const server = http.createServer(async (req, res) => {
  if (!req.url) {
    res.writeHead(400);
    res.end('Bad Request');
    return;
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Key',
    });
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (url.pathname === '/api/health') {
    const db = await checkDbConnection();
    json(res, 200, {
      ok: true,
      runtime: 'node',
      env_loaded_from_file: envLoadedFromFile,
      storage: db.storage,
      db,
    });
    return;
  }

  if (url.pathname === '/api/index.php') {
    const action = String(url.searchParams.get('action') || '').trim();
    const db = await checkDbConnection();

    if (action === 'health') {
      json(res, 200, {
        status: 'success',
        service: 'SPLARO_API_NODE',
        time: new Date().toISOString(),
        storage: db.storage,
        db,
      });
      return;
    }

    if (action === 'sync') {
      json(res, 200, {
        status: 'success',
        mode: db.connected ? 'MYSQL' : 'DEGRADED',
        storage: db.storage,
        data: {
          products: [],
          orders: [],
          users: [],
          settings: null,
          logs: [],
          traffic: [],
        },
        db,
      });
      return;
    }

    json(res, 503, {
      status: 'error',
      message: 'NODE_API_FALLBACK_ACTIVE',
      storage: db.storage,
      db,
    });
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
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
    fs.createReadStream(indexFile).pipe(res);
    return;
  }

  res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ success: false, error: { code: 'BUILD_NOT_FOUND', message: 'dist folder not found. Run npm run build.' } }));
});

const port = Number(process.env.PORT || 3000);
server.listen(port, '0.0.0.0', () => {
  console.log(`[SPLARO] Node server running on 0.0.0.0:${port}`);
  console.log('[SPLARO] Build command: npm run build');
  console.log('[SPLARO] Start command: npm run start');
});
