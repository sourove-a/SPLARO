import type { Pool } from 'mysql2/promise';

async function columnExists(pool: Pool, table: string, column: string): Promise<boolean> {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS count
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column],
  );
  const row = Array.isArray(rows) && rows[0] ? (rows[0] as { count: number }) : { count: 0 };
  return Number(row.count) > 0;
}

async function indexExists(pool: Pool, table: string, indexName: string): Promise<boolean> {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS count
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [table, indexName],
  );
  const row = Array.isArray(rows) && rows[0] ? (rows[0] as { count: number }) : { count: 0 };
  return Number(row.count) > 0;
}

async function addColumnIfMissing(pool: Pool, table: string, column: string, definition: string): Promise<void> {
  if (await columnExists(pool, table, column)) return;
  await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
}

async function addIndexIfMissing(pool: Pool, table: string, indexName: string, indexSql: string): Promise<void> {
  if (await indexExists(pool, table, indexName)) return;
  await pool.query(indexSql);
}

export async function ensureTables(pool: Pool): Promise<void> {
  await pool.query(`CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(50) NULL,
    district VARCHAR(120) NULL,
    thana VARCHAR(120) NULL,
    address TEXT NULL,
    password_hash VARCHAR(255) NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'user',
    is_blocked TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.query(`CREATE TABLE IF NOT EXISTS products (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    category_id VARCHAR(64) NULL,
    product_type VARCHAR(20) NOT NULL,
    image_url TEXT NULL,
    product_url TEXT NULL,
    price DECIMAL(12,2) NOT NULL DEFAULT 0,
    discount_price DECIMAL(12,2) NULL,
    stock_quantity INT NOT NULL DEFAULT 0,
    variants_json LONGTEXT NULL,
    seo_title VARCHAR(255) NULL,
    seo_description TEXT NULL,
    meta_keywords VARCHAR(255) NULL,
    active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.query(`CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR(64) PRIMARY KEY,
    order_no VARCHAR(20) NOT NULL UNIQUE,
    user_id VARCHAR(64) NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    address TEXT NOT NULL,
    district VARCHAR(120) NULL,
    thana VARCHAR(120) NULL,
    status ENUM('PENDING','CONFIRMED','PROCESSING','SHIPPED','DELIVERED','CANCELLED') NOT NULL DEFAULT 'PENDING',
    subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
    shipping DECIMAL(12,2) NOT NULL DEFAULT 0,
    discount DECIMAL(12,2) NOT NULL DEFAULT 0,
    total DECIMAL(12,2) NOT NULL DEFAULT 0,
    admin_note TEXT NULL,
    is_refund_requested TINYINT(1) NOT NULL DEFAULT 0,
    is_refunded TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.query(`CREATE TABLE IF NOT EXISTS order_items (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    order_id VARCHAR(64) NOT NULL,
    product_id VARCHAR(64) NULL,
    product_name VARCHAR(255) NOT NULL,
    product_url TEXT NULL,
    image_url TEXT NULL,
    quantity INT NOT NULL DEFAULT 1,
    unit_price DECIMAL(12,2) NOT NULL DEFAULT 0,
    line_total DECIMAL(12,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_order_items_order_id (order_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.query(`CREATE TABLE IF NOT EXISTS subscriptions (
    id VARCHAR(64) PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    consent TINYINT(1) NOT NULL DEFAULT 0,
    source VARCHAR(40) NOT NULL DEFAULT 'footer',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.query(`CREATE TABLE IF NOT EXISTS campaigns (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    status ENUM('Draft','Active','Paused','Completed') NOT NULL DEFAULT 'Draft',
    audience_segment ENUM('ALL_USERS','NEW_SIGNUPS_7D','INACTIVE_30D') NOT NULL DEFAULT 'ALL_USERS',
    target_count INT NOT NULL DEFAULT 0,
    pulse_percent INT NOT NULL DEFAULT 0,
    schedule_time DATETIME NULL,
    content LONGTEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.query(`CREATE TABLE IF NOT EXISTS coupons (
    id VARCHAR(64) PRIMARY KEY,
    code VARCHAR(64) NOT NULL UNIQUE,
    discount_type ENUM('PERCENT','FIXED') NOT NULL,
    discount_value DECIMAL(12,2) NOT NULL DEFAULT 0,
    expiry_at DATETIME NULL,
    usage_limit INT NOT NULL DEFAULT 0,
    used_count INT NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.query(`CREATE TABLE IF NOT EXISTS login_history (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(64) NULL,
    email VARCHAR(255) NULL,
    ip_address VARCHAR(45) NULL,
    user_agent TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.query(`CREATE TABLE IF NOT EXISTS system_logs (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    event_type VARCHAR(120) NOT NULL,
    event_description TEXT NOT NULL,
    user_id VARCHAR(64) NULL,
    ip_address VARCHAR(45) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.query(`CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    actor_id VARCHAR(64) NULL,
    action VARCHAR(120) NOT NULL,
    entity_type VARCHAR(120) NOT NULL,
    entity_id VARCHAR(120) NOT NULL,
    before_json LONGTEXT NULL,
    after_json LONGTEXT NULL,
    ip_address VARCHAR(45) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.query(`CREATE TABLE IF NOT EXISTS site_settings (
    setting_key VARCHAR(120) PRIMARY KEY,
    setting_value LONGTEXT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.query(`CREATE TABLE IF NOT EXISTS traffic_metrics (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    metric_key VARCHAR(120) NOT NULL,
    metric_value BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_traffic_metric_key (metric_key)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await pool.query(`CREATE TABLE IF NOT EXISTS order_counters (
    id INT PRIMARY KEY,
    seq BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await addColumnIfMissing(pool, 'users', 'district', 'VARCHAR(120) NULL');
  await addColumnIfMissing(pool, 'users', 'thana', 'VARCHAR(120) NULL');
  await addColumnIfMissing(pool, 'users', 'address', 'TEXT NULL');
  await addColumnIfMissing(pool, 'users', 'password_hash', 'VARCHAR(255) NULL');
  await addColumnIfMissing(pool, 'users', 'is_blocked', 'TINYINT(1) NOT NULL DEFAULT 0');
  await addColumnIfMissing(pool, 'users', 'profile_image', 'TEXT NULL');
  await addColumnIfMissing(pool, 'users', 'email_verified', 'TINYINT(1) NOT NULL DEFAULT 0');
  await addColumnIfMissing(pool, 'users', 'phone_verified', 'TINYINT(1) NOT NULL DEFAULT 0');
  await addColumnIfMissing(pool, 'users', 'default_shipping_address', 'TEXT NULL');
  await addColumnIfMissing(pool, 'users', 'notification_email', 'TINYINT(1) NOT NULL DEFAULT 1');
  await addColumnIfMissing(pool, 'users', 'notification_sms', 'TINYINT(1) NOT NULL DEFAULT 0');
  await addColumnIfMissing(pool, 'users', 'preferred_language', "VARCHAR(10) NOT NULL DEFAULT 'EN'");
  await addColumnIfMissing(pool, 'users', 'two_factor_enabled', 'TINYINT(1) NOT NULL DEFAULT 0');
  await addColumnIfMissing(pool, 'users', 'two_factor_secret', 'VARCHAR(255) NULL');
  await addColumnIfMissing(pool, 'users', 'email_verify_code', 'VARCHAR(16) NULL');
  await addColumnIfMissing(pool, 'users', 'email_verify_expiry', 'DATETIME NULL');
  await addColumnIfMissing(pool, 'users', 'reset_code', 'VARCHAR(16) NULL');
  await addColumnIfMissing(pool, 'users', 'reset_expiry', 'DATETIME NULL');
  await addColumnIfMissing(pool, 'users', 'last_password_change_at', 'DATETIME NULL');
  await addColumnIfMissing(pool, 'users', 'force_relogin', 'TINYINT(1) NOT NULL DEFAULT 0');
  await addColumnIfMissing(pool, 'users', 'updated_at', 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');

  await addColumnIfMissing(pool, 'products', 'slug', 'VARCHAR(255) NULL');
  await addColumnIfMissing(pool, 'products', 'category_id', 'VARCHAR(64) NULL');
  await addColumnIfMissing(pool, 'products', 'product_type', 'VARCHAR(20) NULL');
  await addColumnIfMissing(pool, 'products', 'image_url', 'TEXT NULL');
  await addColumnIfMissing(pool, 'products', 'product_url', 'TEXT NULL');
  await addColumnIfMissing(pool, 'products', 'discount_price', 'DECIMAL(12,2) NULL');
  await addColumnIfMissing(pool, 'products', 'stock_quantity', 'INT NOT NULL DEFAULT 0');
  await addColumnIfMissing(pool, 'products', 'variants_json', 'LONGTEXT NULL');
  await addColumnIfMissing(pool, 'products', 'seo_title', 'VARCHAR(255) NULL');
  await addColumnIfMissing(pool, 'products', 'seo_description', 'TEXT NULL');
  await addColumnIfMissing(pool, 'products', 'meta_keywords', 'VARCHAR(255) NULL');
  await addColumnIfMissing(pool, 'products', 'active', 'TINYINT(1) NOT NULL DEFAULT 1');
  await addColumnIfMissing(pool, 'products', 'updated_at', 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');

  await addColumnIfMissing(pool, 'orders', 'order_no', 'VARCHAR(20) NULL');
  await addColumnIfMissing(pool, 'orders', 'name', 'VARCHAR(255) NULL');
  await addColumnIfMissing(pool, 'orders', 'email', 'VARCHAR(255) NULL');
  await addColumnIfMissing(pool, 'orders', 'status', `ENUM('PENDING','CONFIRMED','PROCESSING','SHIPPED','DELIVERED','CANCELLED') NOT NULL DEFAULT 'PENDING'`);
  await addColumnIfMissing(pool, 'orders', 'subtotal', 'DECIMAL(12,2) NOT NULL DEFAULT 0');
  await addColumnIfMissing(pool, 'orders', 'shipping', 'DECIMAL(12,2) NOT NULL DEFAULT 0');
  await addColumnIfMissing(pool, 'orders', 'discount', 'DECIMAL(12,2) NOT NULL DEFAULT 0');
  await addColumnIfMissing(pool, 'orders', 'total', 'DECIMAL(12,2) NOT NULL DEFAULT 0');
  await addColumnIfMissing(pool, 'orders', 'admin_note', 'TEXT NULL');
  await addColumnIfMissing(pool, 'orders', 'tracking_number', 'VARCHAR(120) NULL');
  await addColumnIfMissing(pool, 'orders', 'customer_comment', 'TEXT NULL');
  await addColumnIfMissing(pool, 'orders', 'is_refund_requested', 'TINYINT(1) NOT NULL DEFAULT 0');
  await addColumnIfMissing(pool, 'orders', 'is_refunded', 'TINYINT(1) NOT NULL DEFAULT 0');
  await addColumnIfMissing(pool, 'orders', 'updated_at', 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');

  await addColumnIfMissing(pool, 'site_settings', 'setting_key', 'VARCHAR(120) NULL');
  await addColumnIfMissing(pool, 'site_settings', 'setting_value', 'LONGTEXT NULL');

  await addIndexIfMissing(pool, 'users', 'idx_users_phone', 'CREATE INDEX idx_users_phone ON users(phone)');
  await addIndexIfMissing(pool, 'users', 'idx_users_created_at', 'CREATE INDEX idx_users_created_at ON users(created_at)');

  await addIndexIfMissing(pool, 'products', 'idx_products_slug', 'CREATE INDEX idx_products_slug ON products(slug)');
  await addIndexIfMissing(pool, 'products', 'idx_products_category_id', 'CREATE INDEX idx_products_category_id ON products(category_id)');
  await addIndexIfMissing(pool, 'products', 'idx_products_product_type', 'CREATE INDEX idx_products_product_type ON products(product_type)');
  await addIndexIfMissing(pool, 'products', 'idx_products_active', 'CREATE INDEX idx_products_active ON products(active)');
  await addIndexIfMissing(pool, 'products', 'idx_products_stock_quantity', 'CREATE INDEX idx_products_stock_quantity ON products(stock_quantity)');

  await addIndexIfMissing(pool, 'orders', 'idx_orders_order_no', 'CREATE INDEX idx_orders_order_no ON orders(order_no)');
  await addIndexIfMissing(pool, 'orders', 'idx_orders_status', 'CREATE INDEX idx_orders_status ON orders(status)');
  await addIndexIfMissing(pool, 'orders', 'idx_orders_created_at', 'CREATE INDEX idx_orders_created_at ON orders(created_at)');
  await addIndexIfMissing(pool, 'orders', 'idx_orders_email', 'CREATE INDEX idx_orders_email ON orders(email)');
  await addIndexIfMissing(pool, 'orders', 'idx_orders_phone', 'CREATE INDEX idx_orders_phone ON orders(phone)');
  await addIndexIfMissing(pool, 'orders', 'idx_orders_updated_at', 'CREATE INDEX idx_orders_updated_at ON orders(updated_at)');

  await addIndexIfMissing(pool, 'campaigns', 'idx_campaigns_status', 'CREATE INDEX idx_campaigns_status ON campaigns(status)');
  await addIndexIfMissing(pool, 'campaigns', 'idx_campaigns_created_at', 'CREATE INDEX idx_campaigns_created_at ON campaigns(created_at)');
  await addIndexIfMissing(pool, 'campaigns', 'idx_campaigns_deleted_at', 'CREATE INDEX idx_campaigns_deleted_at ON campaigns(deleted_at)');

  await addIndexIfMissing(pool, 'coupons', 'idx_coupons_code', 'CREATE INDEX idx_coupons_code ON coupons(code)');
  await addIndexIfMissing(pool, 'coupons', 'idx_coupons_is_active', 'CREATE INDEX idx_coupons_is_active ON coupons(is_active)');
  await addIndexIfMissing(pool, 'coupons', 'idx_coupons_expiry_at', 'CREATE INDEX idx_coupons_expiry_at ON coupons(expiry_at)');
  await addIndexIfMissing(pool, 'coupons', 'idx_coupons_created_at', 'CREATE INDEX idx_coupons_created_at ON coupons(created_at)');

  await addIndexIfMissing(pool, 'system_logs', 'idx_system_logs_event_type', 'CREATE INDEX idx_system_logs_event_type ON system_logs(event_type)');
  await addIndexIfMissing(pool, 'system_logs', 'idx_system_logs_created_at', 'CREATE INDEX idx_system_logs_created_at ON system_logs(created_at)');
  await addIndexIfMissing(pool, 'login_history', 'idx_login_history_email', 'CREATE INDEX idx_login_history_email ON login_history(email)');
  await addIndexIfMissing(pool, 'login_history', 'idx_login_history_created_at', 'CREATE INDEX idx_login_history_created_at ON login_history(created_at)');

  await addIndexIfMissing(pool, 'audit_logs', 'idx_audit_logs_actor_id', 'CREATE INDEX idx_audit_logs_actor_id ON audit_logs(actor_id)');
  await addIndexIfMissing(pool, 'audit_logs', 'idx_audit_logs_entity_type', 'CREATE INDEX idx_audit_logs_entity_type ON audit_logs(entity_type)');
  await addIndexIfMissing(pool, 'audit_logs', 'idx_audit_logs_created_at', 'CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at)');
  await addIndexIfMissing(pool, 'site_settings', 'uniq_site_settings_setting_key', 'CREATE UNIQUE INDEX uniq_site_settings_setting_key ON site_settings(setting_key)');
  await addIndexIfMissing(pool, 'site_settings', 'idx_site_settings_setting_key', 'CREATE INDEX idx_site_settings_setting_key ON site_settings(setting_key)');

  await pool.query('INSERT INTO order_counters (id, seq) VALUES (1, 0) ON DUPLICATE KEY UPDATE seq = seq');
}
