<?php
/**
 * SPLARO AUTOMATIC DATABASE INITIALIZER
 * This script will automatically sync the schema.sql to your Hostinger database.
 */

require_once 'config.php';

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    echo json_encode([
        "status" => "error",
        "message" => "DB_INIT_WEB_ACCESS_BLOCKED"
    ]);
    exit;
}

if (strtolower((string)env_or_default('ALLOW_DB_INIT', 'false')) !== 'true') {
    echo json_encode([
        "status" => "error",
        "message" => "DB_INIT_DISABLED"
    ]);
    exit;
}

try {
    $db = get_db_connection();
    if (!$db) {
        throw new RuntimeException('DATABASE_CONNECTION_FAILED');
    }
    $sql = file_get_contents('schema.sql');

    $success_count = 0;
    $error_count = 0;

    // 1. RUN REGISTRY SCHEMA (CREATE TABLES)
    $queries = explode(';', $sql);
    foreach ($queries as $query) {
        $query = trim($query);
        if (!empty($query)) {
            try { $db->exec($query); $success_count++; } catch (PDOException $e) { $error_count++; }
        }
    }

    // 2. RUN ARCHIVAL MIGRATIONS (ADD MISSING COLUMNS TO EXISTING TABLES)
    $migrations = [
        "ALTER TABLE `orders` ADD COLUMN `user_id` varchar(50) DEFAULT NULL AFTER `id`",
        "ALTER TABLE `orders` ADD COLUMN `district` varchar(100) DEFAULT NULL AFTER `phone`",
        "ALTER TABLE `site_settings` ADD COLUMN `smtp_settings` text DEFAULT NULL AFTER `logo_url`",
        "ALTER TABLE `site_settings` ADD COLUMN `logistics_config` text DEFAULT NULL AFTER `smtp_settings`",
        "ALTER TABLE `users` ADD COLUMN `reset_code` varchar(10) DEFAULT NULL AFTER `role`",
        "ALTER TABLE `users` ADD COLUMN `reset_expiry` datetime DEFAULT NULL AFTER `reset_code`",
        "ALTER TABLE `products` ADD COLUMN `description` longtext DEFAULT NULL",
        "ALTER TABLE `products` ADD COLUMN `sizes` longtext DEFAULT NULL",
        "ALTER TABLE `products` ADD COLUMN `colors` longtext DEFAULT NULL",
        "ALTER TABLE `products` ADD COLUMN `materials` longtext DEFAULT NULL",
        "ALTER TABLE `products` ADD COLUMN `tags` longtext DEFAULT NULL",
        "ALTER TABLE `products` ADD COLUMN `featured` tinyint(1) DEFAULT 0",
        "ALTER TABLE `products` ADD COLUMN `sku` varchar(100) DEFAULT NULL",
        "ALTER TABLE `products` ADD COLUMN `stock` int(11) DEFAULT 50",
        "ALTER TABLE `products` ADD COLUMN `low_stock_threshold` int(11) DEFAULT NULL",
        "ALTER TABLE `products` ADD COLUMN `weight` varchar(50) DEFAULT NULL",
        "ALTER TABLE `products` ADD COLUMN `dimensions` longtext DEFAULT NULL",
        "ALTER TABLE `products` ADD COLUMN `variations` longtext DEFAULT NULL",
        "ALTER TABLE `products` ADD COLUMN `additional_images` longtext DEFAULT NULL",
        "ALTER TABLE `products` ADD COLUMN `size_chart_image` text DEFAULT NULL",
        "ALTER TABLE `products` ADD COLUMN `discount_percentage` int(11) DEFAULT NULL",
        "ALTER TABLE `products` ADD COLUMN `sub_category` varchar(100) DEFAULT NULL",
        "ALTER TABLE `site_settings` ADD COLUMN `hero_slides` longtext DEFAULT NULL",
        "ALTER TABLE `orders` ADD COLUMN `customer_comment` text DEFAULT NULL",
        "ALTER TABLE `site_settings` ADD COLUMN `content_pages` longtext DEFAULT NULL",
        "ALTER TABLE `site_settings` ADD COLUMN `story_posts` longtext DEFAULT NULL"
    ];

    foreach ($migrations as $m) {
        try {
            $db->exec($m);
            $success_count++;
        } catch (PDOException $e) {
            // Likely column already exists
            $error_count++;
        }
    }

    // 3. RUN IDENTITY ENFORCEMENT (SEED FROM ENV ONLY)
    $adminEmail = strtolower(trim((string)env_or_default('SEED_ADMIN_EMAIL', '')));
    $adminPassword = (string)env_or_default('SEED_ADMIN_PASSWORD', '');
    if ($adminEmail === '' || $adminPassword === '') {
        throw new RuntimeException('SEED_ADMIN_CREDENTIALS_NOT_SET');
    }
    $adminHash = password_hash($adminPassword, PASSWORD_DEFAULT);

    $check_admin = $db->prepare("SELECT id FROM users WHERE email = ?");
    $check_admin->execute([$adminEmail]);
    $existing_admin = $check_admin->fetch();

    if ($existing_admin) {
        $db->prepare("UPDATE users SET password = ?, role = 'ADMIN', name = ? WHERE email = ?")
           ->execute([$adminHash, 'Splaro Admin', $adminEmail]);
        $success_count++;
    } else {
        $db->prepare("INSERT INTO users (id, name, email, phone, password, role) VALUES (?, ?, ?, ?, ?, ?)")
           ->execute(['admin_' . bin2hex(random_bytes(4)), 'Splaro Admin', $adminEmail, '01700000000', $adminHash, 'ADMIN']);
        $success_count++;
    }

    echo json_encode([
        "status" => "success",
        "message" => "DATABASE_INITIALIZATION_COMPLETE",
        "executed_queries" => $success_count,
        "errors" => $error_count,
        "instruction" => "CLI only. Keep ALLOW_DB_INIT=false after setup."
    ]);

} catch (Exception $e) {
    echo json_encode([
        "status" => "error",
        "message" => $e->getMessage()
    ]);
}
