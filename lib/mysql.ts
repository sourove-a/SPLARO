import { resolveDbEnv } from './dbEnv';

type MysqlPool = {
  execute: (sql: string, params?: unknown[]) => Promise<[any[], any]>;
  query: (sql: string, params?: unknown[]) => Promise<[any[], any]>;
  getConnection: () => Promise<any>;
};

type StorageKind = 'mysql' | 'fallback';

let poolRef: MysqlPool | null = null;
let poolInitPromise: Promise<MysqlPool | null> | null = null;
let connectedHost = '';
let lastDbError = '';
let schemaEnsured = false;

async function loadMysqlModule(): Promise<any | null> {
  try {
    const mod = await import('mysql2/promise');
    return mod;
  } catch (error) {
    lastDbError = error instanceof Error ? error.message : 'mysql2 module not available';
    return null;
  }
}

async function tryCreatePool(host: string): Promise<MysqlPool | null> {
  const env = resolveDbEnv();
  const mysql = await loadMysqlModule();
  if (!mysql) return null;

  const pool = mysql.createPool({
    host,
    port: env.port,
    user: env.dbUser,
    password: env.dbPassword,
    database: env.dbName,
    connectionLimit: 10,
    waitForConnections: true,
    queueLimit: 0,
    connectTimeout: 5000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    charset: 'utf8mb4',
  }) as MysqlPool;

  try {
    await pool.query('SELECT 1');
    connectedHost = host;
    lastDbError = '';
    return pool;
  } catch (error) {
    lastDbError = error instanceof Error ? error.message : 'Database connection failed';
    return null;
  }
}

async function ensureBaseTables(pool: MysqlPool): Promise<void> {
  if (schemaEnsured) return;

  const createStatements = [
    `CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      phone VARCHAR(50) NULL,
      address TEXT NULL,
      profile_image TEXT NULL,
      password VARCHAR(255) NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'USER',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_users_email (email),
      INDEX idx_users_phone (phone),
      INDEX idx_users_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS orders (
      id VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(64) NULL,
      customer_name VARCHAR(255) NOT NULL,
      customer_email VARCHAR(255) NOT NULL,
      phone VARCHAR(50) NOT NULL,
      district VARCHAR(120) NULL,
      thana VARCHAR(120) NULL,
      address TEXT NOT NULL,
      items LONGTEXT NOT NULL,
      total DECIMAL(12,2) NOT NULL DEFAULT 0,
      status VARCHAR(50) NOT NULL DEFAULT 'Pending',
      customer_comment TEXT NULL,
      shipping_fee DECIMAL(12,2) NULL,
      discount_amount DECIMAL(12,2) NULL DEFAULT 0,
      discount_code VARCHAR(120) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_orders_order_id (id),
      INDEX idx_orders_email (customer_email),
      INDEX idx_orders_phone (phone),
      INDEX idx_orders_created_at (created_at),
      INDEX idx_orders_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS subscriptions (
      id VARCHAR(64) PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      consent TINYINT(1) NOT NULL DEFAULT 0,
      source VARCHAR(40) NOT NULL DEFAULT 'footer',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_subscriptions_email (email),
      INDEX idx_subscriptions_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS products (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      brand VARCHAR(120) NULL,
      category VARCHAR(120) NULL,
      price DECIMAL(12,2) NULL DEFAULT 0,
      image TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_products_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS site_settings (
      id INT NOT NULL PRIMARY KEY DEFAULT 1,
      site_name VARCHAR(255) NULL DEFAULT 'SPLARO',
      maintenance_mode TINYINT(1) NOT NULL DEFAULT 0,
      support_email VARCHAR(255) NULL,
      support_phone VARCHAR(50) NULL,
      whatsapp_number VARCHAR(50) NULL,
      facebook_link VARCHAR(255) NULL,
      instagram_link VARCHAR(255) NULL,
      logo_url TEXT NULL,
      smtp_settings LONGTEXT NULL,
      logistics_config LONGTEXT NULL,
      hero_slides LONGTEXT NULL,
      content_pages LONGTEXT NULL,
      story_posts LONGTEXT NULL,
      campaigns_data LONGTEXT NULL,
      settings_json LONGTEXT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS system_logs (
      id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      event_type VARCHAR(120) NOT NULL,
      event_description TEXT NOT NULL,
      user_id VARCHAR(64) NULL,
      ip_address VARCHAR(45) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_system_logs_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS traffic_metrics (
      id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      session_id VARCHAR(128) NOT NULL,
      user_id VARCHAR(64) NULL,
      ip_address VARCHAR(45) NULL,
      path VARCHAR(255) NULL,
      user_agent TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_active TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_traffic_session (session_id),
      INDEX idx_traffic_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  ];

  for (const statement of createStatements) {
    await pool.execute(statement);
  }

  await pool.execute(
    `INSERT INTO site_settings (id, site_name) VALUES (1, 'SPLARO')
     ON DUPLICATE KEY UPDATE site_name = COALESCE(site_name, VALUES(site_name))`,
  );

  schemaEnsured = true;
}

async function initPool(): Promise<MysqlPool | null> {
  const env = resolveDbEnv();
  if (!env.hasRequired) {
    lastDbError = `Missing env: ${env.missing.join(', ')}`;
    return null;
  }

  for (const host of env.hostCandidates) {
    const pool = await tryCreatePool(host);
    if (!pool) continue;

    try {
      await ensureBaseTables(pool);
      return pool;
    } catch (error) {
      lastDbError = error instanceof Error ? error.message : 'Schema initialization failed';
    }
  }

  return null;
}

export async function getMysqlPool(): Promise<MysqlPool | null> {
  if (poolRef) return poolRef;
  if (!poolInitPromise) {
    poolInitPromise = initPool().then((pool) => {
      poolRef = pool;
      return pool;
    });
  }
  return poolInitPromise;
}

export async function getStorageMeta(): Promise<{
  storage: StorageKind;
  dbHost: string;
  dbName: string;
  dbPort: number;
  error?: string;
}> {
  const env = resolveDbEnv();
  const pool = await getMysqlPool();
  if (pool) {
    return {
      storage: 'mysql',
      dbHost: connectedHost || env.hostCandidates[0] || '127.0.0.1',
      dbName: env.dbName,
      dbPort: env.port,
    };
  }

  return {
    storage: 'fallback',
    dbHost: env.hostCandidates[0] || '127.0.0.1',
    dbName: env.dbName || '',
    dbPort: env.port,
    error: lastDbError || undefined,
  };
}
