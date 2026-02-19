<?php
/**
 * SPLARO AUTOMATIC DATABASE INITIALIZER
 * This script will automatically sync the schema.sql to your Hostinger database.
 */

require_once 'config.php';

try {
    $db = get_db_connection();
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
        "ALTER TABLE `users` ADD COLUMN `reset_expiry` datetime DEFAULT NULL AFTER `reset_code`"
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

    // 3. RUN IDENTITY ENFORCEMENT (FORCE ADMIN RESET)
    // We check if the admin exists; if yes, we ensure the password matches the config.
    $check_admin = $db->prepare("SELECT id FROM users WHERE email = 'admin@splaro.co'");
    $check_admin->execute();
    $existing_admin = $check_admin->fetch();

    if ($existing_admin) {
        $db->prepare("UPDATE users SET password = ?, role = 'ADMIN', name = 'Sourove Admin' WHERE email = 'admin@splaro.co'")
           ->execute(['Sourove017@#%&*-+()']);
        $success_count++;
    } else {
        $db->prepare("INSERT INTO users (id, name, email, phone, password, role) VALUES (?, ?, ?, ?, ?, ?)")
           ->execute(['admin_chief', 'Sourove Admin', 'admin@splaro.co', '01700000000', 'Sourove017@#%&*-+()', 'ADMIN']);
        $success_count++;
    }

    echo json_encode([
        "status" => "success",
        "message" => "DATABASE_INITIALIZATION_COMPLETE",
        "executed_queries" => $success_count,
        "errors" => $error_count,
        "instruction" => "PLEASE DELETE THIS FILE (db_init.php) FROM THE SERVER IMMEDIATELY FOR SECURITY."
    ]);

} catch (Exception $e) {
    echo json_encode([
        "status" => "error",
        "message" => $e->getMessage()
    ]);
}
