<?php
/**
 * SPLARO INSTITUTIONAL DATA GATEWAY
 * Institutional API endpoint for Hostinger Deployment
 */

require_once 'config.php';

// PHPMailer Integration
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception as MailerException;
use PHPMailer\PHPMailer\SMTP;

$__splaroRequestAction = $_GET['action'] ?? '';
register_shutdown_function(function () use ($__splaroRequestAction) {
    $lastError = error_get_last();
    if (!$lastError) {
        return;
    }
    $fatalTypes = [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR];
    if (!in_array((int)($lastError['type'] ?? 0), $fatalTypes, true)) {
        return;
    }
    if (headers_sent()) {
        return;
    }

    error_log("SPLARO_FATAL_SHUTDOWN: action={$__splaroRequestAction}; type=" . (string)($lastError['type'] ?? '') . "; message=" . (string)($lastError['message'] ?? '') . "; file=" . (string)($lastError['file'] ?? '') . "; line=" . (string)($lastError['line'] ?? ''));
    http_response_code(500);
    header('Content-Type: application/json');
    $payload = [
        "status" => "error",
        "message" => "INTERNAL_SERVER_ERROR",
        "action" => (string)$__splaroRequestAction
    ];
    if ((string)$__splaroRequestAction === 'health') {
        $payload['fatal'] = [
            'type' => (int)($lastError['type'] ?? 0),
            'message' => (string)($lastError['message'] ?? ''),
            'line' => (int)($lastError['line'] ?? 0),
            'file' => basename((string)($lastError['file'] ?? ''))
        ];
    }
    echo json_encode($payload);
});

$mailerBase = __DIR__ . '/PHPMailer/';
$mailerFiles = [
    $mailerBase . 'Exception.php',
    $mailerBase . 'PHPMailer.php',
    $mailerBase . 'SMTP.php',
];
foreach ($mailerFiles as $mailerFile) {
    if (is_file($mailerFile) && is_readable($mailerFile)) {
        require_once $mailerFile;
    }
}

function send_institutional_email($to, $subject, $body, $altBody = '', $isHtml = true, $attachments = []) {
    global $db;

    $smtpSettings = [
        'host' => SMTP_HOST,
        'port' => SMTP_PORT,
        'user' => SMTP_USER,
        'pass' => SMTP_PASS,
        'from' => SMTP_USER,
    ];

    try {
        if (isset($db) && $db && function_exists('load_smtp_settings')) {
            $resolved = load_smtp_settings($db);
            if (is_array($resolved)) {
                $smtpSettings = array_merge($smtpSettings, $resolved);
            }
        }
    } catch (Exception $e) {
        // keep static fallback settings
    }

    $smtpHost = trim((string)($smtpSettings['host'] ?? ''));
    $smtpPort = (int)($smtpSettings['port'] ?? SMTP_PORT);
    $smtpUser = trim((string)($smtpSettings['user'] ?? ''));
    $smtpPass = (string)($smtpSettings['pass'] ?? '');
    $fromAddress = trim((string)($smtpSettings['from'] ?? $smtpUser));

    if ($fromAddress === '') {
        $fromAddress = $smtpUser !== '' ? $smtpUser : 'info@splaro.co';
    }

    if (!class_exists(PHPMailer::class)) {
        error_log("SPLARO_MAILER_UNAVAILABLE: PHPMailer class not loaded");
        if (function_exists('mail')) {
            $headers = [
                "From: SPLARO <{$fromAddress}>",
                "Reply-To: {$fromAddress}",
                "MIME-Version: 1.0"
            ];
            $headers[] = $isHtml
                ? "Content-Type: text/html; charset=UTF-8"
                : "Content-Type: text/plain; charset=UTF-8";

            $mailBody = $isHtml ? $body : ($altBody ?: strip_tags($body));
            return @mail($to, $subject, $mailBody, implode("\r\n", $headers));
        }
        return false;
    }

    $mail = new PHPMailer(true);
    try {
        $mail->isSMTP();
        $mail->Host       = $smtpHost !== '' ? $smtpHost : SMTP_HOST;
        $mail->SMTPAuth   = true;
        $mail->Username   = $smtpUser !== '' ? $smtpUser : SMTP_USER;
        $mail->Password   = $smtpPass !== '' ? $smtpPass : SMTP_PASS;
        $mail->Timeout    = 10;
        $mail->CharSet    = 'UTF-8';
        $mail->Port       = $smtpPort > 0 ? $smtpPort : (int)SMTP_PORT;

        if ($mail->Port === 465) {
            $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
        } else {
            $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        }

        // SSL Security Handshake Bypass (Essential for Hostinger/Shared Environments)
        $mail->SMTPOptions = [
            'ssl' => [
                'verify_peer' => false,
                'verify_peer_name' => false,
                'allow_self_signed' => true
            ]
        ];

        $mail->setFrom($fromAddress, 'SPLARO');
        $mail->addAddress($to);

        $mail->isHTML($isHtml);
        $mail->Subject = $subject;
        $mail->Body    = $body;
        $mail->AltBody = $altBody ?: strip_tags($body);

        if (is_array($attachments)) {
            foreach ($attachments as $attachment) {
                if (!is_array($attachment)) {
                    continue;
                }
                $filePath = (string)($attachment['path'] ?? '');
                if ($filePath === '' || !is_file($filePath)) {
                    continue;
                }
                $fileName = trim((string)($attachment['name'] ?? ''));
                $mimeType = trim((string)($attachment['type'] ?? ''));
                if ($fileName !== '' && $mimeType !== '') {
                    $mail->addAttachment($filePath, $fileName, PHPMailer::ENCODING_BASE64, $mimeType);
                } elseif ($fileName !== '') {
                    $mail->addAttachment($filePath, $fileName);
                } else {
                    $mail->addAttachment($filePath);
                }
            }
        }

        $mail->send();
        return true;
    } catch (Exception $e) {
        error_log("SPLARO_MAIL_FAILURE: " . $mail->ErrorInfo . " | Exception: " . $e->getMessage());

        // Last-resort fallback: native PHP mail() on shared hosting
        if (function_exists('mail')) {
            $headers = [
                "From: SPLARO <{$fromAddress}>",
                "Reply-To: {$fromAddress}",
                "MIME-Version: 1.0"
            ];

            if ($isHtml) {
                $headers[] = "Content-Type: text/html; charset=UTF-8";
            } else {
                $headers[] = "Content-Type: text/plain; charset=UTF-8";
            }

            $mailBody = $isHtml ? $body : ($altBody ?: strip_tags($body));
            $fallbackSent = @mail($to, $subject, $mailBody, implode("\r\n", $headers));
            if ($fallbackSent) {
                error_log("SPLARO_MAIL_FALLBACK_SUCCESS: delivered via mail() to {$to}");
                return true;
            }
        }

        return false;
    }
}

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

function get_env_source_label() {
    $source = (string)($GLOBALS['SPLARO_ENV_SOURCE_FILE'] ?? '');
    if ($source === '') {
        return 'runtime';
    }
    $base = basename($source);
    return $base !== '' ? $base : $source;
}

$db = get_db_connection();
if (!$db) {
    $bootstrapError = $GLOBALS['SPLARO_DB_BOOTSTRAP_ERROR'] ?? ["message" => "DATABASE_CONNECTION_FAILED"];
    $healthDebug = filter_var((string)env_or_default('HEALTH_DEBUG', 'false'), FILTER_VALIDATE_BOOLEAN);
    $safeDbStatus = [
        "message" => $bootstrapError['message'] ?? 'DATABASE_CONNECTION_FAILED'
    ];
    if ($healthDebug) {
        $safeDbStatus['details'] = $bootstrapError;
    }

    if ($method === 'OPTIONS') {
        http_response_code(204);
        exit;
    }

    if ($method === 'GET' && $action === 'health') {
        echo json_encode([
            "status" => "success",
            "service" => "SPLARO_API",
            "time" => date('c'),
            "mode" => "DEGRADED",
            "storage" => "fallback",
            "dbHost" => DB_HOST,
            "dbName" => DB_NAME,
            "envSource" => get_env_source_label(),
            "dbPasswordSource" => (string)($GLOBALS['SPLARO_DB_PASSWORD_SOURCE'] ?? ''),
            "db" => $safeDbStatus
        ]);
        exit;
    }

    if ($method === 'GET' && $action === 'sync') {
        echo json_encode([
            "status" => "success",
            "mode" => "DEGRADED",
            "storage" => "fallback",
            "data" => [
                "products" => [],
                "orders" => [],
                "users" => [],
                "settings" => null,
                "logs" => [],
                "traffic" => []
            ],
            "db" => $safeDbStatus
        ]);
        exit;
    }

    http_response_code(503);
    echo json_encode([
        "status" => "error",
        "storage" => "fallback",
        "message" => $safeDbStatus['message'] ?? 'DATABASE_CONNECTION_FAILED',
        "missing" => $bootstrapError['missing'] ?? [],
        "db" => $safeDbStatus
    ]);
    exit;
}

if ($method === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function ensure_table($db, $table, $createSql) {
    try {
        $stmt = $db->prepare("SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?");
        $stmt->execute([$table]);
        if ((int)$stmt->fetchColumn() === 0) {
            $db->exec($createSql);
        }
    } catch (Exception $e) {
        // continue with best effort
    }
}

function ensure_column($db, $table, $column, $definition) {
    try {
        $stmt = $db->prepare("SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?");
        $stmt->execute([$table, $column]);
        if ((int)$stmt->fetchColumn() === 0) {
            $db->exec("ALTER TABLE `$table` ADD COLUMN `$column` $definition");
        }
    } catch (Exception $e) {
        error_log("SPLARO_SCHEMA_WARNING: ensure_column failed for {$table}.{$column} -> " . $e->getMessage());
    }
}

function ensure_index($db, $table, $indexName, $indexSql) {
    try {
        $stmt = $db->prepare("SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?");
        $stmt->execute([$table, $indexName]);
        if ((int)$stmt->fetchColumn() === 0) {
            $db->exec($indexSql);
        }
    } catch (Exception $e) {
        error_log("SPLARO_SCHEMA_WARNING: ensure_index failed for {$table}.{$indexName} -> " . $e->getMessage());
    }
}

function column_exists($db, $table, $column) {
    try {
        $stmt = $db->prepare("SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?");
        $stmt->execute([$table, $column]);
        return ((int)$stmt->fetchColumn()) > 0;
    } catch (Exception $e) {
        error_log("SPLARO_SCHEMA_WARNING: column_exists failed for {$table}.{$column} -> " . $e->getMessage());
        return false;
    }
}

function ensure_core_schema($db) {
    ensure_table($db, 'site_settings', "CREATE TABLE IF NOT EXISTS `site_settings` (
        `id` int(11) NOT NULL AUTO_INCREMENT,
        `site_name` varchar(255) DEFAULT 'SPLARO',
        `maintenance_mode` tinyint(1) DEFAULT 0,
        `support_email` varchar(255) DEFAULT 'support@splaro.co',
        `support_phone` varchar(50) DEFAULT NULL,
        `whatsapp_number` varchar(50) DEFAULT NULL,
        `facebook_link` varchar(255) DEFAULT NULL,
        `instagram_link` varchar(255) DEFAULT NULL,
        `logo_url` text DEFAULT NULL,
        `smtp_settings` text DEFAULT NULL,
        `logistics_config` text DEFAULT NULL,
        `hero_slides` longtext DEFAULT NULL,
        `content_pages` longtext DEFAULT NULL,
        `story_posts` longtext DEFAULT NULL,
        PRIMARY KEY (`id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    ensure_table($db, 'products', "CREATE TABLE IF NOT EXISTS `products` (
      `id` varchar(50) NOT NULL,
      `name` varchar(255) NOT NULL,
      `slug` varchar(255) DEFAULT NULL,
      `brand` varchar(100) NOT NULL,
      `brand_slug` varchar(120) DEFAULT NULL,
      `price` int(11) NOT NULL,
      `discount_price` int(11) DEFAULT NULL,
      `discount_starts_at` datetime DEFAULT NULL,
      `discount_ends_at` datetime DEFAULT NULL,
      `image` text NOT NULL,
      `main_image_id` varchar(80) DEFAULT NULL,
      `category` varchar(100) NOT NULL,
      `category_slug` varchar(120) DEFAULT NULL,
      `type` varchar(50) NOT NULL,
      `description` longtext DEFAULT NULL,
      `sizes` longtext DEFAULT NULL,
      `colors` longtext DEFAULT NULL,
      `color_variants` longtext DEFAULT NULL,
      `materials` longtext DEFAULT NULL,
      `tags` longtext DEFAULT NULL,
      `featured` tinyint(1) DEFAULT 0,
      `sku` varchar(100) DEFAULT NULL,
      `barcode` varchar(120) DEFAULT NULL,
      `stock` int(11) DEFAULT 50,
      `low_stock_threshold` int(11) DEFAULT NULL,
      `status` varchar(20) DEFAULT 'PUBLISHED',
      `hide_when_out_of_stock` tinyint(1) DEFAULT 0,
      `weight` varchar(50) DEFAULT NULL,
      `dimensions` longtext DEFAULT NULL,
      `variations` longtext DEFAULT NULL,
      `additional_images` longtext DEFAULT NULL,
      `size_chart_image` text DEFAULT NULL,
      `discount_percentage` int(11) DEFAULT NULL,
      `sub_category` varchar(100) DEFAULT NULL,
      `sub_category_slug` varchar(120) DEFAULT NULL,
      `product_url` text DEFAULT NULL,
      PRIMARY KEY (`id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    ensure_table($db, 'product_images', "CREATE TABLE IF NOT EXISTS `product_images` (
      `id` varchar(80) NOT NULL,
      `product_id` varchar(50) NOT NULL,
      `url` text NOT NULL,
      `alt_text` varchar(255) DEFAULT NULL,
      `sort_order` int(11) DEFAULT 0,
      `is_main` tinyint(1) DEFAULT 0,
      `width` int(11) DEFAULT NULL,
      `height` int(11) DEFAULT NULL,
      `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (`id`),
      KEY `idx_product_images_product` (`product_id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    ensure_table($db, 'orders', "CREATE TABLE IF NOT EXISTS `orders` (
      `id` varchar(50) NOT NULL,
      `user_id` varchar(50) DEFAULT NULL,
      `customer_name` varchar(255) NOT NULL,
      `customer_email` varchar(255) NOT NULL,
      `phone` varchar(50) NOT NULL,
      `district` varchar(100) DEFAULT NULL,
      `thana` varchar(100) DEFAULT NULL,
      `address` text NOT NULL,
      `items` longtext NOT NULL,
      `total` int(11) NOT NULL,
      `status` varchar(50) NOT NULL,
      `tracking_number` varchar(100) DEFAULT NULL,
      `admin_notes` text DEFAULT NULL,
      `customer_comment` text DEFAULT NULL,
      `shipping_fee` int(11) DEFAULT NULL,
      `discount_amount` int(11) DEFAULT 0,
      `discount_code` varchar(100) DEFAULT NULL,
      `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (`id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    ensure_table($db, 'subscriptions', "CREATE TABLE IF NOT EXISTS `subscriptions` (
      `id` varchar(50) NOT NULL,
      `email` varchar(255) NOT NULL,
      `consent` tinyint(1) DEFAULT 0,
      `source` varchar(20) DEFAULT 'footer',
      `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (`id`),
      UNIQUE KEY `email` (`email`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    ensure_table($db, 'system_logs', "CREATE TABLE IF NOT EXISTS `system_logs` (
      `id` int(11) NOT NULL AUTO_INCREMENT,
      `event_type` varchar(100) NOT NULL,
      `event_description` text NOT NULL,
      `user_id` varchar(50) DEFAULT NULL,
      `ip_address` varchar(45) DEFAULT NULL,
      `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (`id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    ensure_table($db, 'audit_logs', "CREATE TABLE IF NOT EXISTS `audit_logs` (
      `id` int(11) NOT NULL AUTO_INCREMENT,
      `actor_id` varchar(50) DEFAULT NULL,
      `action` varchar(100) NOT NULL,
      `entity_type` varchar(100) NOT NULL,
      `entity_id` varchar(100) DEFAULT NULL,
      `before_json` longtext DEFAULT NULL,
      `after_json` longtext DEFAULT NULL,
      `ip_address` varchar(45) DEFAULT NULL,
      `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (`id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    ensure_table($db, 'support_tickets', "CREATE TABLE IF NOT EXISTS `support_tickets` (
      `id` varchar(50) NOT NULL,
      `user_id` varchar(50) DEFAULT NULL,
      `email` varchar(255) NOT NULL,
      `subject` varchar(255) NOT NULL,
      `message` text NOT NULL,
      `status` varchar(50) NOT NULL DEFAULT 'OPEN',
      `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (`id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    ensure_table($db, 'page_sections', "CREATE TABLE IF NOT EXISTS `page_sections` (
      `id` int(11) NOT NULL AUTO_INCREMENT,
      `section_key` varchar(120) NOT NULL,
      `draft_json` longtext DEFAULT NULL,
      `published_json` longtext DEFAULT NULL,
      `status` varchar(20) NOT NULL DEFAULT 'DRAFT',
      `updated_by` varchar(80) DEFAULT NULL,
      `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      `published_at` datetime DEFAULT NULL,
      PRIMARY KEY (`id`),
      UNIQUE KEY `uniq_section_key` (`section_key`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    ensure_table($db, 'settings_revisions', "CREATE TABLE IF NOT EXISTS `settings_revisions` (
      `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
      `section_key` varchar(120) NOT NULL,
      `mode` varchar(20) NOT NULL DEFAULT 'DRAFT',
      `payload_json` longtext NOT NULL,
      `actor_id` varchar(80) DEFAULT NULL,
      `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (`id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    ensure_table($db, 'sync_queue', "CREATE TABLE IF NOT EXISTS `sync_queue` (
      `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
      `sync_type` varchar(50) NOT NULL,
      `payload_json` longtext NOT NULL,
      `status` varchar(20) NOT NULL DEFAULT 'PENDING',
      `attempts` int(11) NOT NULL DEFAULT 0,
      `max_attempts` int(11) NOT NULL DEFAULT 5,
      `last_http_code` int(11) DEFAULT NULL,
      `last_error` text DEFAULT NULL,
      `next_attempt_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      `locked_at` datetime DEFAULT NULL,
      `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (`id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    ensure_table($db, 'invoice_counters', "CREATE TABLE IF NOT EXISTS `invoice_counters` (
      `counter_key` varchar(50) NOT NULL,
      `current_number` bigint(20) unsigned NOT NULL DEFAULT 0,
      `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (`counter_key`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    ensure_table($db, 'invoice_documents', "CREATE TABLE IF NOT EXISTS `invoice_documents` (
      `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
      `order_id` varchar(50) NOT NULL,
      `serial` varchar(80) NOT NULL,
      `doc_type` varchar(20) NOT NULL,
      `status` varchar(20) NOT NULL DEFAULT 'GENERATED',
      `html_path` text DEFAULT NULL,
      `pdf_path` text DEFAULT NULL,
      `html_url` text DEFAULT NULL,
      `pdf_url` text DEFAULT NULL,
      `sent_at` datetime DEFAULT NULL,
      `created_by_admin_id` varchar(80) DEFAULT NULL,
      `error_message` text DEFAULT NULL,
      `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (`id`),
      UNIQUE KEY `uniq_invoice_serial` (`serial`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    ensure_column($db, 'invoice_documents', 'order_id', 'varchar(50) NOT NULL');
    ensure_column($db, 'invoice_documents', 'serial', 'varchar(80) NOT NULL');
    ensure_column($db, 'invoice_documents', 'doc_type', 'varchar(20) NOT NULL');
    ensure_column($db, 'invoice_documents', 'status', 'varchar(20) NOT NULL DEFAULT \"GENERATED\"');
    ensure_column($db, 'invoice_documents', 'html_path', 'text DEFAULT NULL');
    ensure_column($db, 'invoice_documents', 'pdf_path', 'text DEFAULT NULL');
    ensure_column($db, 'invoice_documents', 'html_url', 'text DEFAULT NULL');
    ensure_column($db, 'invoice_documents', 'pdf_url', 'text DEFAULT NULL');
    ensure_column($db, 'invoice_documents', 'sent_at', 'datetime DEFAULT NULL');
    ensure_column($db, 'invoice_documents', 'created_by_admin_id', 'varchar(80) DEFAULT NULL');
    ensure_column($db, 'invoice_documents', 'error_message', 'text DEFAULT NULL');

    ensure_table($db, 'traffic_metrics', "CREATE TABLE IF NOT EXISTS `traffic_metrics` (
      `id` int(11) NOT NULL AUTO_INCREMENT,
      `session_id` varchar(100) NOT NULL,
      `user_id` varchar(50) DEFAULT NULL,
      `ip_address` varchar(45) DEFAULT NULL,
      `path` varchar(255) DEFAULT '/',
      `user_agent` text DEFAULT NULL,
      `last_active` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (`id`),
      UNIQUE KEY `session_id` (`session_id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    ensure_column($db, 'site_settings', 'smtp_settings', 'text DEFAULT NULL');
    ensure_column($db, 'site_settings', 'logistics_config', 'text DEFAULT NULL');
    ensure_column($db, 'site_settings', 'hero_slides', 'longtext DEFAULT NULL');
    ensure_column($db, 'site_settings', 'content_pages', 'longtext DEFAULT NULL');
    ensure_column($db, 'site_settings', 'story_posts', 'longtext DEFAULT NULL');
    ensure_column($db, 'site_settings', 'campaigns_data', 'longtext DEFAULT NULL');
    ensure_column($db, 'site_settings', 'settings_json', 'longtext DEFAULT NULL');
    ensure_column($db, 'site_settings', 'logo_url', 'text DEFAULT NULL');
    ensure_column($db, 'site_settings', 'google_client_id', 'varchar(255) DEFAULT NULL');

    ensure_column($db, 'products', 'description', 'longtext DEFAULT NULL');
    ensure_column($db, 'products', 'slug', 'varchar(255) DEFAULT NULL');
    ensure_column($db, 'products', 'sizes', 'longtext DEFAULT NULL');
    ensure_column($db, 'products', 'colors', 'longtext DEFAULT NULL');
    ensure_column($db, 'products', 'color_variants', 'longtext DEFAULT NULL');
    ensure_column($db, 'products', 'materials', 'longtext DEFAULT NULL');
    ensure_column($db, 'products', 'tags', 'longtext DEFAULT NULL');
    ensure_column($db, 'products', 'brand_slug', 'varchar(120) DEFAULT NULL');
    ensure_column($db, 'products', 'featured', 'tinyint(1) DEFAULT 0');
    ensure_column($db, 'products', 'sku', 'varchar(100) DEFAULT NULL');
    ensure_column($db, 'products', 'barcode', 'varchar(120) DEFAULT NULL');
    ensure_column($db, 'products', 'stock', 'int(11) DEFAULT 50');
    ensure_column($db, 'products', 'low_stock_threshold', 'int(11) DEFAULT NULL');
    ensure_column($db, 'products', 'status', 'varchar(20) DEFAULT \"PUBLISHED\"');
    ensure_column($db, 'products', 'hide_when_out_of_stock', 'tinyint(1) DEFAULT 0');
    ensure_column($db, 'products', 'discount_price', 'int(11) DEFAULT NULL');
    ensure_column($db, 'products', 'discount_starts_at', 'datetime DEFAULT NULL');
    ensure_column($db, 'products', 'discount_ends_at', 'datetime DEFAULT NULL');
    ensure_column($db, 'products', 'main_image_id', 'varchar(80) DEFAULT NULL');
    ensure_column($db, 'products', 'category_slug', 'varchar(120) DEFAULT NULL');
    ensure_column($db, 'products', 'weight', 'varchar(50) DEFAULT NULL');
    ensure_column($db, 'products', 'dimensions', 'longtext DEFAULT NULL');
    ensure_column($db, 'products', 'variations', 'longtext DEFAULT NULL');
    ensure_column($db, 'products', 'additional_images', 'longtext DEFAULT NULL');
    ensure_column($db, 'products', 'size_chart_image', 'text DEFAULT NULL');
    ensure_column($db, 'products', 'discount_percentage', 'int(11) DEFAULT NULL');
    ensure_column($db, 'products', 'sub_category', 'varchar(100) DEFAULT NULL');
    ensure_column($db, 'products', 'sub_category_slug', 'varchar(120) DEFAULT NULL');
    ensure_column($db, 'products', 'product_url', 'text DEFAULT NULL');
    ensure_column($db, 'products', 'created_at', 'timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP');

    ensure_column($db, 'orders', 'district', 'varchar(100) DEFAULT NULL');
    ensure_column($db, 'orders', 'thana', 'varchar(100) DEFAULT NULL');
    ensure_column($db, 'orders', 'tracking_number', 'varchar(100) DEFAULT NULL');
    ensure_column($db, 'orders', 'admin_notes', 'text DEFAULT NULL');
    ensure_column($db, 'orders', 'customer_comment', 'text DEFAULT NULL');
    ensure_column($db, 'orders', 'shipping_fee', 'int(11) DEFAULT NULL');
    ensure_column($db, 'orders', 'discount_amount', 'int(11) DEFAULT 0');
    ensure_column($db, 'orders', 'discount_code', 'varchar(100) DEFAULT NULL');

    ensure_table($db, 'users', "CREATE TABLE IF NOT EXISTS `users` (
      `id` varchar(50) NOT NULL,
      `name` varchar(255) NOT NULL,
      `email` varchar(255) NOT NULL,
      `phone` varchar(50) DEFAULT NULL,
      `address` text DEFAULT NULL,
      `profile_image` text DEFAULT NULL,
      `password` varchar(255) NOT NULL,
      `role` varchar(20) DEFAULT 'USER',
      `reset_code` varchar(10) DEFAULT NULL,
      `reset_expiry` datetime DEFAULT NULL,
      `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (`id`),
      UNIQUE KEY `email` (`email`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    ensure_column($db, 'users', 'reset_code', 'varchar(10) DEFAULT NULL');
    ensure_column($db, 'users', 'reset_expiry', 'datetime DEFAULT NULL');
    ensure_column($db, 'users', 'address', 'text DEFAULT NULL');
    ensure_column($db, 'users', 'profile_image', 'text DEFAULT NULL');
    ensure_column($db, 'users', 'last_password_change_at', 'datetime DEFAULT NULL');
    ensure_column($db, 'users', 'force_relogin', 'tinyint(1) NOT NULL DEFAULT 0');
    ensure_column($db, 'users', 'two_factor_enabled', 'tinyint(1) NOT NULL DEFAULT 0');
    ensure_column($db, 'users', 'two_factor_secret', 'varchar(128) DEFAULT NULL');
    ensure_column($db, 'users', 'notification_email', 'tinyint(1) NOT NULL DEFAULT 1');
    ensure_column($db, 'users', 'notification_sms', 'tinyint(1) NOT NULL DEFAULT 0');
    ensure_column($db, 'users', 'preferred_language', 'varchar(8) DEFAULT \"EN\"');
    ensure_column($db, 'users', 'default_shipping_address', 'text DEFAULT NULL');

    ensure_index($db, 'users', 'idx_users_email', 'CREATE INDEX idx_users_email ON users(email)');
    ensure_index($db, 'users', 'idx_users_phone', 'CREATE INDEX idx_users_phone ON users(phone)');
    ensure_index($db, 'users', 'idx_users_created_at', 'CREATE INDEX idx_users_created_at ON users(created_at)');
    ensure_index($db, 'users', 'idx_users_force_relogin', 'CREATE INDEX idx_users_force_relogin ON users(force_relogin)');
    ensure_index($db, 'orders', 'idx_orders_email', 'CREATE INDEX idx_orders_email ON orders(customer_email)');
    ensure_index($db, 'orders', 'idx_orders_phone', 'CREATE INDEX idx_orders_phone ON orders(phone)');
    ensure_index($db, 'orders', 'idx_orders_created_at', 'CREATE INDEX idx_orders_created_at ON orders(created_at)');
    ensure_index($db, 'subscriptions', 'idx_subscriptions_email', 'CREATE INDEX idx_subscriptions_email ON subscriptions(email)');
    ensure_index($db, 'subscriptions', 'idx_subscriptions_created_at', 'CREATE INDEX idx_subscriptions_created_at ON subscriptions(created_at)');
    ensure_index($db, 'products', 'idx_products_created_at', 'CREATE INDEX idx_products_created_at ON products(created_at)');
    ensure_index($db, 'products', 'idx_products_slug', 'CREATE INDEX idx_products_slug ON products(slug)');
    ensure_index($db, 'products', 'idx_products_brand_slug', 'CREATE INDEX idx_products_brand_slug ON products(brand_slug)');
    ensure_index($db, 'products', 'idx_products_category_slug', 'CREATE INDEX idx_products_category_slug ON products(category_slug)');
    ensure_index($db, 'products', 'idx_products_sub_category_slug', 'CREATE INDEX idx_products_sub_category_slug ON products(sub_category_slug)');
    ensure_index($db, 'products', 'idx_products_status', 'CREATE INDEX idx_products_status ON products(status)');
    ensure_index($db, 'product_images', 'idx_product_images_product', 'CREATE INDEX idx_product_images_product ON product_images(product_id)');
    ensure_index($db, 'product_images', 'idx_product_images_sort', 'CREATE INDEX idx_product_images_sort ON product_images(product_id, sort_order)');
    ensure_index($db, 'system_logs', 'idx_system_logs_created_at', 'CREATE INDEX idx_system_logs_created_at ON system_logs(created_at)');
    ensure_index($db, 'audit_logs', 'idx_audit_logs_created_at', 'CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at)');
    ensure_index($db, 'audit_logs', 'idx_audit_logs_entity', 'CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id)');
    ensure_index($db, 'support_tickets', 'idx_support_tickets_created_at', 'CREATE INDEX idx_support_tickets_created_at ON support_tickets(created_at)');
    ensure_index($db, 'support_tickets', 'idx_support_tickets_user', 'CREATE INDEX idx_support_tickets_user ON support_tickets(user_id)');
    ensure_index($db, 'page_sections', 'idx_page_sections_updated_at', 'CREATE INDEX idx_page_sections_updated_at ON page_sections(updated_at)');
    ensure_index($db, 'settings_revisions', 'idx_settings_revisions_section_created', 'CREATE INDEX idx_settings_revisions_section_created ON settings_revisions(section_key, created_at)');
    ensure_index($db, 'sync_queue', 'idx_sync_queue_status_next', 'CREATE INDEX idx_sync_queue_status_next ON sync_queue(status, next_attempt_at)');
    ensure_index($db, 'sync_queue', 'idx_sync_queue_created_at', 'CREATE INDEX idx_sync_queue_created_at ON sync_queue(created_at)');
    ensure_index($db, 'invoice_documents', 'idx_invoice_documents_order', 'CREATE INDEX idx_invoice_documents_order ON invoice_documents(order_id, created_at)');
    ensure_index($db, 'invoice_documents', 'idx_invoice_documents_type', 'CREATE INDEX idx_invoice_documents_type ON invoice_documents(doc_type, created_at)');
    ensure_index($db, 'invoice_documents', 'idx_invoice_documents_status', 'CREATE INDEX idx_invoice_documents_status ON invoice_documents(status, created_at)');
    ensure_index($db, 'traffic_metrics', 'idx_traffic_metrics_created_at', 'CREATE INDEX idx_traffic_metrics_created_at ON traffic_metrics(last_active)');

    try {
        $db->exec("INSERT IGNORE INTO `site_settings` (`id`, `site_name`, `support_email`) VALUES (1, 'Splaro', 'info@splaro.co')");
    } catch (Exception $e) {
        // ignore
    }
}

function maybe_ensure_core_schema($db) {
    $ttl = (int)env_or_default('SCHEMA_CHECK_TTL_SECONDS', 3600);
    if ($ttl < 60) $ttl = 60;
    if ($ttl > 86400) $ttl = 86400;

    $cacheKey = md5(DB_HOST . '|' . DB_NAME . '|' . DB_PORT);
    $cacheFile = rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . "splaro_schema_check_{$cacheKey}.json";
    $now = time();

    if (is_file($cacheFile)) {
        $payload = json_decode((string)@file_get_contents($cacheFile), true);
        $checkedAt = (int)($payload['checked_at'] ?? 0);
        if ($checkedAt > 0 && ($now - $checkedAt) < $ttl) {
            return;
        }
    }

    ensure_core_schema($db);
    @file_put_contents($cacheFile, json_encode(['checked_at' => $now]), LOCK_EX);
}

maybe_ensure_core_schema($db);

// Backward-compatible hot migration for deployments where schema cache skipped new tables.
ensure_table($db, 'sync_queue', "CREATE TABLE IF NOT EXISTS `sync_queue` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `sync_type` varchar(50) NOT NULL,
  `payload_json` longtext NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'PENDING',
  `attempts` int(11) NOT NULL DEFAULT 0,
  `max_attempts` int(11) NOT NULL DEFAULT 5,
  `last_http_code` int(11) DEFAULT NULL,
  `last_error` text DEFAULT NULL,
  `next_attempt_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `locked_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
ensure_index($db, 'sync_queue', 'idx_sync_queue_status_next', 'CREATE INDEX idx_sync_queue_status_next ON sync_queue(status, next_attempt_at)');
ensure_index($db, 'sync_queue', 'idx_sync_queue_created_at', 'CREATE INDEX idx_sync_queue_created_at ON sync_queue(created_at)');
ensure_table($db, 'page_sections', "CREATE TABLE IF NOT EXISTS `page_sections` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `section_key` varchar(120) NOT NULL,
  `draft_json` longtext DEFAULT NULL,
  `published_json` longtext DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'DRAFT',
  `updated_by` varchar(80) DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `published_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_section_key` (`section_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
ensure_table($db, 'settings_revisions', "CREATE TABLE IF NOT EXISTS `settings_revisions` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `section_key` varchar(120) NOT NULL,
  `mode` varchar(20) NOT NULL DEFAULT 'DRAFT',
  `payload_json` longtext NOT NULL,
  `actor_id` varchar(80) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
ensure_index($db, 'page_sections', 'idx_page_sections_updated_at', 'CREATE INDEX idx_page_sections_updated_at ON page_sections(updated_at)');
ensure_index($db, 'settings_revisions', 'idx_settings_revisions_section_created', 'CREATE INDEX idx_settings_revisions_section_created ON settings_revisions(section_key, created_at)');
ensure_table($db, 'invoice_counters', "CREATE TABLE IF NOT EXISTS `invoice_counters` (
  `counter_key` varchar(50) NOT NULL,
  `current_number` bigint(20) unsigned NOT NULL DEFAULT 0,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`counter_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
ensure_table($db, 'invoice_documents', "CREATE TABLE IF NOT EXISTS `invoice_documents` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `order_id` varchar(50) NOT NULL,
  `serial` varchar(80) NOT NULL,
  `doc_type` varchar(20) NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'GENERATED',
  `html_path` text DEFAULT NULL,
  `pdf_path` text DEFAULT NULL,
  `html_url` text DEFAULT NULL,
  `pdf_url` text DEFAULT NULL,
  `sent_at` datetime DEFAULT NULL,
  `created_by_admin_id` varchar(80) DEFAULT NULL,
  `error_message` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_invoice_serial` (`serial`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
ensure_index($db, 'invoice_documents', 'idx_invoice_documents_order', 'CREATE INDEX idx_invoice_documents_order ON invoice_documents(order_id, created_at)');
ensure_index($db, 'invoice_documents', 'idx_invoice_documents_type', 'CREATE INDEX idx_invoice_documents_type ON invoice_documents(doc_type, created_at)');
ensure_index($db, 'invoice_documents', 'idx_invoice_documents_status', 'CREATE INDEX idx_invoice_documents_status ON invoice_documents(status, created_at)');

function load_smtp_settings($db) {
    $settings = [
        'host' => SMTP_HOST,
        'port' => SMTP_PORT,
        'user' => SMTP_USER,
        'pass' => SMTP_PASS,
        'from' => SMTP_USER,
        'secure' => ((int)SMTP_PORT === 465 ? 'ssl' : 'tls'),
    ];

    try {
        $row = $db->query("SELECT smtp_settings FROM site_settings WHERE id = 1 LIMIT 1")->fetch();
        if (!empty($row['smtp_settings'])) {
            $custom = json_decode($row['smtp_settings'], true);
            if (is_array($custom)) {
                $host = trim((string)($custom['host'] ?? ''));
                $user = trim((string)($custom['user'] ?? ''));
                $pass = (string)($custom['pass'] ?? '');
                $from = trim((string)($custom['from'] ?? ''));
                $secure = strtolower(trim((string)($custom['secure'] ?? '')));
                $port = isset($custom['port']) ? (int)$custom['port'] : 0;

                if ($host !== '') $settings['host'] = $host;
                if ($port > 0) $settings['port'] = $port;
                if ($user !== '') $settings['user'] = $user;
                if ($pass !== '') $settings['pass'] = $pass;
                if ($from !== '') $settings['from'] = $from;
                if ($secure !== '') $settings['secure'] = $secure;
            }
        }
    } catch (Exception $e) {
        // fall back to constants
    }

    // Environment variables must win over DB values when provided,
    // so stale DB SMTP credentials never break delivery.
    $envHost = trim((string)SMTP_HOST);
    $envPort = (int)SMTP_PORT;
    $envUser = trim((string)SMTP_USER);
    $envPass = (string)SMTP_PASS;
    $envSecure = strtolower(trim((string)env_or_default('SMTP_SECURE', '')));

    if ($envHost !== '') $settings['host'] = $envHost;
    if ($envPort > 0) $settings['port'] = $envPort;
    if ($envUser !== '') $settings['user'] = $envUser;
    if ($envPass !== '') $settings['pass'] = $envPass;
    if (in_array($envSecure, ['ssl', 'tls'], true)) {
        $settings['secure'] = $envSecure;
    }

    if (trim((string)($settings['from'] ?? '')) === '') {
        $settings['from'] = (string)($settings['user'] ?? '');
    }

    return $settings;
}

function smtp_send_mail($db, $to, $subject, $body, $isHtml = true) {
    return send_institutional_email(
        $to,
        $subject,
        $body,
        $isHtml ? strip_tags($body) : $body,
        $isHtml
    );
}

function smtp_send_mail_with_attachments($db, $to, $subject, $body, $isHtml = true, $attachments = []) {
    return send_institutional_email(
        $to,
        $subject,
        $body,
        $isHtml ? strip_tags($body) : $body,
        $isHtml,
        $attachments
    );
}

function invoice_default_settings() {
    return [
        'invoiceEnabled' => true,
        'invoicePrefix' => 'SPL',
        'numberPadding' => 6,
        'serialTypes' => [
            ['code' => 'INV', 'label' => 'Invoice'],
            ['code' => 'MNF', 'label' => 'Manifest'],
            ['code' => 'RCT', 'label' => 'Receipt']
        ],
        'defaultType' => 'INV',
        'separateCounterPerType' => false,
        'theme' => [
            'primaryColor' => '#0A0C12',
            'accentColor' => '#41DCFF',
            'backgroundColor' => '#F4F7FF',
            'tableHeaderColor' => '#111827',
            'buttonColor' => '#2563EB'
        ],
        'logoUrl' => '',
        'footerText' => 'SPLARO • Luxury Footwear & Bags • www.splaro.co',
        'policyText' => 'For support and returns, please contact support@splaro.co.',
        'showProductImages' => true,
        'showTax' => false,
        'taxRate' => 0,
        'showDiscount' => true,
        'showShipping' => true
    ];
}

function invoice_escape($value) {
    return htmlspecialchars((string)$value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function invoice_valid_color($value, $fallback) {
    $candidate = trim((string)$value);
    if (preg_match('/^#[0-9a-fA-F]{6}$/', $candidate)) {
        return strtoupper($candidate);
    }
    return $fallback;
}

function invoice_normalize_settings($raw, $siteSettingsRow = null) {
    $base = invoice_default_settings();
    $input = is_array($raw) ? $raw : [];
    $themeInput = isset($input['theme']) && is_array($input['theme']) ? $input['theme'] : [];

    $serialTypes = [];
    if (!empty($input['serialTypes']) && is_array($input['serialTypes'])) {
        foreach ($input['serialTypes'] as $serialType) {
            if (!is_array($serialType)) continue;
            $code = strtoupper(trim((string)($serialType['code'] ?? '')));
            $label = trim((string)($serialType['label'] ?? ''));
            if ($code === '' || $label === '') continue;
            $serialTypes[] = ['code' => preg_replace('/[^A-Z0-9]/', '', $code), 'label' => $label];
        }
    }
    if (empty($serialTypes)) {
        $serialTypes = $base['serialTypes'];
    }

    $defaultType = strtoupper(trim((string)($input['defaultType'] ?? $base['defaultType'])));
    $serialCodes = array_map(function ($item) {
        return strtoupper((string)($item['code'] ?? ''));
    }, $serialTypes);
    if (!in_array($defaultType, $serialCodes, true)) {
        $defaultType = strtoupper((string)$serialTypes[0]['code']);
    }

    $prefix = strtoupper(trim((string)($input['invoicePrefix'] ?? $base['invoicePrefix'])));
    $prefix = preg_replace('/[^A-Z0-9]/', '', $prefix);
    if ($prefix === '') {
        $prefix = $base['invoicePrefix'];
    }

    $logoUrl = trim((string)($input['logoUrl'] ?? ''));
    if ($logoUrl === '' && is_array($siteSettingsRow)) {
        $logoUrl = trim((string)($siteSettingsRow['logo_url'] ?? ''));
    }

    $padding = (int)($input['numberPadding'] ?? $base['numberPadding']);
    if ($padding < 3) $padding = 3;
    if ($padding > 10) $padding = 10;
    $taxRate = (float)($input['taxRate'] ?? $base['taxRate']);
    if ($taxRate < 0) $taxRate = 0;
    if ($taxRate > 50) $taxRate = 50;

    return [
        'invoiceEnabled' => isset($input['invoiceEnabled']) ? (bool)$input['invoiceEnabled'] : (bool)$base['invoiceEnabled'],
        'invoicePrefix' => $prefix,
        'numberPadding' => $padding,
        'serialTypes' => $serialTypes,
        'defaultType' => $defaultType,
        'separateCounterPerType' => isset($input['separateCounterPerType']) ? (bool)$input['separateCounterPerType'] : (bool)$base['separateCounterPerType'],
        'theme' => [
            'primaryColor' => invoice_valid_color($themeInput['primaryColor'] ?? '', $base['theme']['primaryColor']),
            'accentColor' => invoice_valid_color($themeInput['accentColor'] ?? '', $base['theme']['accentColor']),
            'backgroundColor' => invoice_valid_color($themeInput['backgroundColor'] ?? '', $base['theme']['backgroundColor']),
            'tableHeaderColor' => invoice_valid_color($themeInput['tableHeaderColor'] ?? '', $base['theme']['tableHeaderColor']),
            'buttonColor' => invoice_valid_color($themeInput['buttonColor'] ?? '', $base['theme']['buttonColor'])
        ],
        'logoUrl' => $logoUrl,
        'footerText' => trim((string)($input['footerText'] ?? $base['footerText'])),
        'policyText' => trim((string)($input['policyText'] ?? $base['policyText'])),
        'showProductImages' => isset($input['showProductImages']) ? (bool)$input['showProductImages'] : (bool)$base['showProductImages'],
        'showTax' => isset($input['showTax']) ? (bool)$input['showTax'] : (bool)$base['showTax'],
        'taxRate' => $taxRate,
        'showDiscount' => isset($input['showDiscount']) ? (bool)$input['showDiscount'] : (bool)$base['showDiscount'],
        'showShipping' => isset($input['showShipping']) ? (bool)$input['showShipping'] : (bool)$base['showShipping']
    ];
}

function invoice_file_safe_name($value) {
    $safe = preg_replace('/[^A-Za-z0-9_-]+/', '_', (string)$value);
    $safe = trim((string)$safe, '_');
    return $safe !== '' ? $safe : 'invoice';
}

function invoice_app_origin() {
    $origin = trim((string)env_or_default('APP_ORIGIN', ''));
    if ($origin !== '') {
        return rtrim($origin, '/');
    }
    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host = trim((string)($_SERVER['HTTP_HOST'] ?? ''));
    if ($host === '') {
        return '';
    }
    return $scheme . '://' . $host;
}

function invoice_ensure_output_dir() {
    $dir = __DIR__ . DIRECTORY_SEPARATOR . 'invoices';
    if (!is_dir($dir)) {
        @mkdir($dir, 0755, true);
    }
    return $dir;
}

function invoice_relative_url($relativePath) {
    $relative = ltrim((string)$relativePath, '/');
    $origin = invoice_app_origin();
    if ($origin === '') {
        return '/' . $relative;
    }
    return $origin . '/' . $relative;
}

function invoice_payment_status($orderRow) {
    $status = strtoupper(trim((string)($orderRow['status'] ?? '')));
    if (in_array($status, ['PAID', 'SUCCESS'], true)) {
        return 'PAID';
    }
    if (in_array($status, ['PENDING', 'PROCESSING'], true)) {
        return 'PENDING';
    }
    return 'COD';
}

function invoice_parse_items($rawItems) {
    $items = [];
    $decoded = $rawItems;
    if (is_string($rawItems)) {
        $decoded = json_decode($rawItems, true);
    }
    if (!is_array($decoded)) {
        return $items;
    }

    foreach ($decoded as $row) {
        if (!is_array($row)) continue;
        $product = isset($row['product']) && is_array($row['product']) ? $row['product'] : [];
        $name = trim((string)($row['name'] ?? $product['name'] ?? 'Product'));
        $qty = (int)($row['quantity'] ?? 1);
        if ($qty <= 0) $qty = 1;
        $unitPrice = (float)($row['unitPrice'] ?? $row['price'] ?? $product['price'] ?? 0);
        if ($unitPrice < 0) $unitPrice = 0;
        $lineTotal = (float)($row['lineTotal'] ?? ($unitPrice * $qty));
        if ($lineTotal < 0) $lineTotal = $unitPrice * $qty;
        $productUrl = trim((string)($row['productUrl'] ?? $row['url'] ?? $product['liveUrl'] ?? ''));
        $imageUrl = trim((string)($row['image'] ?? $row['imageUrl'] ?? $product['image'] ?? ''));
        $size = trim((string)($row['selectedSize'] ?? $row['size'] ?? ''));
        $color = trim((string)($row['selectedColor'] ?? $row['color'] ?? ''));

        $items[] = [
            'name' => $name !== '' ? $name : 'Product',
            'quantity' => $qty,
            'unitPrice' => $unitPrice,
            'lineTotal' => $lineTotal,
            'productUrl' => $productUrl,
            'imageUrl' => $imageUrl,
            'size' => $size,
            'color' => $color
        ];
    }
    return $items;
}

function invoice_currency($amount) {
    $value = (float)$amount;
    return 'BDT ' . number_format($value, 2);
}

function invoice_build_html($orderRow, $items, $settings, $serial, $typeCode, $documentLabel, $totals) {
    $theme = $settings['theme'];
    $paymentStatus = invoice_payment_status($orderRow);
    $statusColor = $paymentStatus === 'PAID'
        ? '#16A34A'
        : ($paymentStatus === 'PENDING' ? '#D97706' : '#2563EB');
    $logoUrl = trim((string)($settings['logoUrl'] ?? ''));
    $siteName = trim((string)($orderRow['site_name'] ?? 'SPLARO'));
    if ($siteName === '') $siteName = 'SPLARO';

    $itemsRows = '';
    $showImages = !empty($settings['showProductImages']);
    foreach ($items as $item) {
        $sizeColor = [];
        if (!empty($item['size'])) $sizeColor[] = 'Size: ' . invoice_escape($item['size']);
        if (!empty($item['color'])) $sizeColor[] = 'Color: ' . invoice_escape($item['color']);
        $metaText = !empty($sizeColor) ? implode(' • ', $sizeColor) : 'Standard item';
        $thumb = '';
        if ($showImages) {
            $image = trim((string)($item['imageUrl'] ?? ''));
            if ($image === '') {
                $thumb = "<div style=\"width:52px;height:52px;border-radius:12px;background:#E5E7EB;border:1px solid #D1D5DB;\"></div>";
            } else {
                $thumb = "<img src=\"" . invoice_escape($image) . "\" alt=\"" . invoice_escape($item['name']) . "\" style=\"width:52px;height:52px;object-fit:cover;border-radius:12px;border:1px solid #D1D5DB;display:block;\" />";
            }
        }
        $productLabel = invoice_escape($item['name']);
        if (!empty($item['productUrl'])) {
            $productLabel = "<a href=\"" . invoice_escape($item['productUrl']) . "\" style=\"color:#111827;text-decoration:none;\">" . invoice_escape($item['name']) . "</a>";
        }

        $itemsRows .= "<tr>"
            . "<td style=\"padding:12px 10px;border-bottom:1px solid #E5E7EB;vertical-align:middle;\">" . $thumb . "</td>"
            . "<td style=\"padding:12px 10px;border-bottom:1px solid #E5E7EB;vertical-align:middle;\">"
            . "<div style=\"font-weight:700;color:#0F172A;font-size:14px;line-height:1.4;\">" . $productLabel . "</div>"
            . "<div style=\"font-size:12px;color:#64748B;margin-top:3px;\">" . $metaText . "</div>"
            . "</td>"
            . "<td style=\"padding:12px 10px;border-bottom:1px solid #E5E7EB;text-align:center;font-size:13px;color:#0F172A;\">" . (int)$item['quantity'] . "</td>"
            . "<td style=\"padding:12px 10px;border-bottom:1px solid #E5E7EB;text-align:right;font-size:13px;color:#0F172A;\">" . invoice_currency($item['unitPrice']) . "</td>"
            . "<td style=\"padding:12px 10px;border-bottom:1px solid #E5E7EB;text-align:right;font-size:13px;font-weight:700;color:#0F172A;\">" . invoice_currency($item['lineTotal']) . "</td>"
            . "</tr>";
    }

    $logoBlock = $logoUrl !== ''
        ? "<img src=\"" . invoice_escape($logoUrl) . "\" alt=\"SPLARO\" style=\"height:38px;max-width:140px;object-fit:contain;display:block;\" />"
        : "<div style=\"font-size:34px;font-weight:900;line-height:1;color:#0F172A;\">SPLARO</div>";

    $footerText = invoice_escape((string)($settings['footerText'] ?? ''));
    $policyText = invoice_escape((string)($settings['policyText'] ?? ''));
    $typeCodeEscaped = invoice_escape($typeCode);

    return "<!doctype html>
<html lang=\"en\">
<head>
  <meta charset=\"UTF-8\" />
  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
  <title>" . invoice_escape($serial) . "</title>
</head>
<body style=\"margin:0;padding:20px;background:#EEF2FF;font-family:Inter,Arial,Helvetica,sans-serif;color:#0F172A;\">
  <div style=\"max-width:820px;margin:0 auto;background:" . invoice_escape($theme['backgroundColor']) . ";border:1px solid #DBE1F0;border-radius:18px;overflow:hidden;\">
    <div style=\"padding:24px 26px;background:linear-gradient(140deg," . invoice_escape($theme['primaryColor']) . ",#111827 72%);color:#F8FAFC;\">
      <table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\">
        <tr>
          <td style=\"vertical-align:top;width:50%;\">" . $logoBlock . "
            <div style=\"margin-top:10px;font-size:12px;font-weight:700;letter-spacing:0.06em;color:#BFDBFE;\">Luxury Footwear &amp; Bags</div>
          </td>
          <td style=\"vertical-align:top;text-align:right;\">
            <div style=\"font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#93C5FD;\">$documentLabel</div>
            <div style=\"font-size:34px;font-weight:900;line-height:1.15;margin-top:8px;\">" . invoice_escape($serial) . "</div>
            <div style=\"margin-top:10px;\">
              <span style=\"display:inline-block;padding:7px 12px;border-radius:999px;background:" . $statusColor . ";color:#fff;font-size:11px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;\">$paymentStatus</span>
            </div>
          </td>
        </tr>
      </table>
    </div>

    <div style=\"padding:24px 26px 8px;\">
      <table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" style=\"margin-bottom:18px;\">
        <tr>
          <td style=\"width:52%;vertical-align:top;padding:0 16px 16px 0;\">
            <div style=\"font-size:12px;color:#64748B;text-transform:uppercase;letter-spacing:0.08em;font-weight:700;\">Customer</div>
            <div style=\"font-size:20px;font-weight:800;color:#0F172A;margin-top:6px;\">" . invoice_escape($orderRow['customer_name'] ?? '') . "</div>
            <div style=\"font-size:13px;color:#334155;margin-top:6px;\">" . invoice_escape($orderRow['customer_email'] ?? '') . "</div>
            <div style=\"font-size:13px;color:#334155;margin-top:2px;\">" . invoice_escape($orderRow['phone'] ?? '') . "</div>
          </td>
          <td style=\"width:48%;vertical-align:top;padding:0 0 16px;\">
            <div style=\"font-size:12px;color:#64748B;text-transform:uppercase;letter-spacing:0.08em;font-weight:700;\">Shipping Address</div>
            <div style=\"font-size:14px;color:#0F172A;line-height:1.55;margin-top:8px;font-weight:600;\">" . invoice_escape($orderRow['address'] ?? '') . "</div>
            <div style=\"margin-top:8px;font-size:12px;color:#475569;font-weight:700;\">" . invoice_escape(($orderRow['thana'] ?? '') . ', ' . ($orderRow['district'] ?? '')) . "</div>
          </td>
        </tr>
      </table>

      <table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" style=\"margin-bottom:22px;\">
        <tr>
          <td style=\"padding:10px 12px;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;\">
            <span style=\"font-size:12px;color:#64748B;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;\">Order ID:</span>
            <span style=\"font-size:14px;color:#0F172A;font-weight:800;margin-left:8px;\">" . invoice_escape($orderRow['id'] ?? '') . "</span>
          </td>
          <td style=\"padding:10px 12px;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;text-align:right;\">
            <span style=\"font-size:12px;color:#64748B;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;\">Date:</span>
            <span style=\"font-size:14px;color:#0F172A;font-weight:800;margin-left:8px;\">" . invoice_escape(date('Y-m-d H:i')) . "</span>
          </td>
        </tr>
      </table>

      <table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" style=\"border:1px solid #E2E8F0;border-radius:12px;overflow:hidden;\">
        <thead>
          <tr style=\"background:" . invoice_escape($theme['tableHeaderColor']) . ";\">
            <th style=\"padding:12px 10px;width:72px;color:#F8FAFC;font-size:11px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;text-align:left;\">Image</th>
            <th style=\"padding:12px 10px;color:#F8FAFC;font-size:11px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;text-align:left;\">Product</th>
            <th style=\"padding:12px 10px;color:#F8FAFC;font-size:11px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;text-align:center;\">Qty</th>
            <th style=\"padding:12px 10px;color:#F8FAFC;font-size:11px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;text-align:right;\">Unit Price</th>
            <th style=\"padding:12px 10px;color:#F8FAFC;font-size:11px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;text-align:right;\">Subtotal</th>
          </tr>
        </thead>
        <tbody>$itemsRows</tbody>
      </table>

      <table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" style=\"margin-top:20px;\">
        <tr>
          <td style=\"width:50%;vertical-align:top;padding-right:12px;\">
            <div style=\"padding:14px 16px;border-radius:12px;background:#F8FAFC;border:1px solid #E2E8F0;\">
              <div style=\"font-size:11px;color:#64748B;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;\">Notes</div>
              <div style=\"margin-top:8px;font-size:13px;line-height:1.6;color:#334155;\">" . $policyText . "</div>
            </div>
          </td>
          <td style=\"width:50%;vertical-align:top;padding-left:12px;\">
            <div style=\"padding:14px 16px;border-radius:12px;background:#F8FAFC;border:1px solid #E2E8F0;\">
              <table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\">
                <tr><td style=\"padding:4px 0;color:#475569;font-size:13px;\">Subtotal</td><td style=\"padding:4px 0;color:#0F172A;font-size:13px;text-align:right;font-weight:700;\">" . invoice_currency($totals['subtotal']) . "</td></tr>"
                  . (!empty($settings['showDiscount']) ? "<tr><td style=\"padding:4px 0;color:#475569;font-size:13px;\">Discount</td><td style=\"padding:4px 0;color:#0F172A;font-size:13px;text-align:right;font-weight:700;\">-" . invoice_currency($totals['discount']) . "</td></tr>" : '') .
                  (!empty($settings['showShipping']) ? "<tr><td style=\"padding:4px 0;color:#475569;font-size:13px;\">Shipping</td><td style=\"padding:4px 0;color:#0F172A;font-size:13px;text-align:right;font-weight:700;\">" . invoice_currency($totals['shipping']) . "</td></tr>" : '') .
                  (!empty($settings['showTax']) ? "<tr><td style=\"padding:4px 0;color:#475569;font-size:13px;\">Tax</td><td style=\"padding:4px 0;color:#0F172A;font-size:13px;text-align:right;font-weight:700;\">" . invoice_currency($totals['tax']) . "</td></tr>" : '') .
                "<tr><td colspan=\"2\" style=\"padding-top:8px;border-bottom:1px solid #CBD5E1;\"></td></tr>
                <tr><td style=\"padding-top:10px;color:#0F172A;font-size:16px;font-weight:900;letter-spacing:0.03em;text-transform:uppercase;\">Grand Total</td><td style=\"padding-top:10px;color:" . invoice_escape($theme['buttonColor']) . ";font-size:20px;text-align:right;font-weight:900;\">" . invoice_currency($totals['grand']) . "</td></tr>
              </table>
            </div>
          </td>
        </tr>
      </table>
    </div>

    <div style=\"padding:20px 26px 24px;color:#64748B;font-size:12px;background:#F8FAFC;border-top:1px solid #E2E8F0;\">
      <div style=\"font-weight:700;\">" . $footerText . "</div>
      <div style=\"margin-top:6px;\">Type: $typeCodeEscaped • Generated from SPLARO Admin Panel</div>
    </div>
  </div>
</body>
</html>";
}

function invoice_build_plain_text($orderRow, $items, $serial, $totals, $label) {
    $lines = [];
    $lines[] = "SPLARO {$label}";
    $lines[] = "Serial: {$serial}";
    $lines[] = "Order: " . (string)($orderRow['id'] ?? '');
    $lines[] = "Date: " . date('Y-m-d H:i');
    $lines[] = "Customer: " . (string)($orderRow['customer_name'] ?? '');
    $lines[] = "Email: " . (string)($orderRow['customer_email'] ?? '');
    $lines[] = "Phone: " . (string)($orderRow['phone'] ?? '');
    $lines[] = "Address: " . (string)($orderRow['address'] ?? '');
    $lines[] = "District/Thana: " . (string)($orderRow['district'] ?? '') . ' / ' . (string)($orderRow['thana'] ?? '');
    $lines[] = "Items:";
    foreach ($items as $item) {
        $lines[] = "- " . (string)$item['name'] . " | Qty " . (int)$item['quantity'] . " | " . invoice_currency($item['lineTotal']);
    }
    $lines[] = "Subtotal: " . invoice_currency($totals['subtotal']);
    $lines[] = "Discount: " . invoice_currency($totals['discount']);
    $lines[] = "Shipping: " . invoice_currency($totals['shipping']);
    $lines[] = "Tax: " . invoice_currency($totals['tax']);
    $lines[] = "Grand Total: " . invoice_currency($totals['grand']);
    return implode("\n", $lines);
}

function invoice_pdf_escape_text($text) {
    $text = str_replace(["\\", "(", ")"], ["\\\\", "\\(", "\\)"], (string)$text);
    $encoded = @iconv('UTF-8', 'Windows-1252//TRANSLIT//IGNORE', $text);
    return $encoded === false ? preg_replace('/[^\x20-\x7E]/', '?', $text) : $encoded;
}

function invoice_generate_basic_pdf($text, $targetPath) {
    $lines = preg_split('/\r\n|\r|\n/', (string)$text);
    $maxLines = 45;
    $lines = array_slice($lines, 0, $maxLines);

    $commands = [];
    $commands[] = "BT";
    $commands[] = "/F1 11 Tf";
    $commands[] = "50 790 Td";
    foreach ($lines as $index => $line) {
        if ($index > 0) {
            $commands[] = "0 -15 Td";
        }
        $commands[] = "(" . invoice_pdf_escape_text($line) . ") Tj";
    }
    $commands[] = "ET";
    $stream = implode("\n", $commands);
    $streamLength = strlen($stream);

    $objects = [];
    $objects[] = "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj";
    $objects[] = "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj";
    $objects[] = "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj";
    $objects[] = "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj";
    $objects[] = "5 0 obj << /Length {$streamLength} >> stream\n{$stream}\nendstream endobj";

    $pdf = "%PDF-1.4\n";
    $offsets = [0];
    foreach ($objects as $object) {
        $offsets[] = strlen($pdf);
        $pdf .= $object . "\n";
    }
    $xrefOffset = strlen($pdf);
    $totalObjects = count($objects) + 1;
    $pdf .= "xref\n0 {$totalObjects}\n";
    $pdf .= "0000000000 65535 f \n";
    for ($i = 1; $i <= count($objects); $i++) {
        $pdf .= str_pad((string)$offsets[$i], 10, '0', STR_PAD_LEFT) . " 00000 n \n";
    }
    $pdf .= "trailer << /Size {$totalObjects} /Root 1 0 R >>\nstartxref\n{$xrefOffset}\n%%EOF";
    return @file_put_contents($targetPath, $pdf) !== false;
}

function invoice_generate_pdf_file($html, $plainText, $targetPath) {
    try {
        if (class_exists('Dompdf\\Dompdf')) {
            $dompdf = new \Dompdf\Dompdf([
                'isRemoteEnabled' => true,
                'defaultFont' => 'DejaVu Sans'
            ]);
            $dompdf->loadHtml((string)$html, 'UTF-8');
            $dompdf->setPaper('A4', 'portrait');
            $dompdf->render();
            return @file_put_contents($targetPath, $dompdf->output()) !== false;
        }
    } catch (Exception $e) {
        error_log('SPLARO_INVOICE_DOMPDF_FAILED: ' . $e->getMessage());
    }

    try {
        if (class_exists('Mpdf\\Mpdf')) {
            $mpdf = new \Mpdf\Mpdf(['format' => 'A4']);
            $mpdf->WriteHTML((string)$html);
            $mpdf->Output($targetPath, 'F');
            return is_file($targetPath) && filesize($targetPath) > 0;
        }
    } catch (Exception $e) {
        error_log('SPLARO_INVOICE_MPDF_FAILED: ' . $e->getMessage());
    }

    return invoice_generate_basic_pdf($plainText, $targetPath);
}

function invoice_allocate_serial($db, $settings, $typeCode) {
    $type = strtoupper(trim((string)$typeCode));
    if ($type === '') {
        $type = strtoupper((string)($settings['defaultType'] ?? 'INV'));
    }
    $counterKey = !empty($settings['separateCounterPerType']) ? ('TYPE_' . $type) : 'GLOBAL';
    $number = 0;

    $db->beginTransaction();
    try {
        $stmt = $db->prepare("SELECT counter_key, current_number FROM invoice_counters WHERE counter_key = ? FOR UPDATE");
        $stmt->execute([$counterKey]);
        $counterRow = $stmt->fetch();
        if (!$counterRow) {
            $insert = $db->prepare("INSERT INTO invoice_counters (counter_key, current_number, updated_at) VALUES (?, 0, NOW())");
            $insert->execute([$counterKey]);
            $number = 1;
            $update = $db->prepare("UPDATE invoice_counters SET current_number = ?, updated_at = NOW() WHERE counter_key = ?");
            $update->execute([$number, $counterKey]);
        } else {
            $number = ((int)$counterRow['current_number']) + 1;
            $update = $db->prepare("UPDATE invoice_counters SET current_number = ?, updated_at = NOW() WHERE counter_key = ?");
            $update->execute([$number, $counterKey]);
        }
        $db->commit();
    } catch (Exception $e) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        throw $e;
    }

    $padding = (int)($settings['numberPadding'] ?? 6);
    if ($padding < 3) $padding = 3;
    if ($padding > 10) $padding = 10;
    $prefix = strtoupper(trim((string)($settings['invoicePrefix'] ?? 'SPL')));
    if ($prefix === '') $prefix = 'SPL';
    $serial = $prefix . '-' . str_pad((string)$number, $padding, '0', STR_PAD_LEFT) . '-' . $type;

    return [
        'serial' => $serial,
        'type' => $type,
        'number' => $number,
        'counterKey' => $counterKey
    ];
}

function invoice_create_document($db, $orderRow, $settings, $typeCode, $createdBy, $sendEmail = false) {
    $orderId = (string)($orderRow['id'] ?? '');
    if ($orderId === '') {
        throw new Exception('ORDER_ID_MISSING');
    }
    $items = invoice_parse_items($orderRow['items'] ?? []);
    if (empty($items)) {
        throw new Exception('ORDER_ITEMS_MISSING');
    }

    $subtotal = 0.0;
    foreach ($items as $item) {
        $subtotal += (float)$item['lineTotal'];
    }
    $shipping = (float)($orderRow['shipping_fee'] ?? 0);
    $discount = (float)($orderRow['discount_amount'] ?? 0);
    $tax = !empty($settings['showTax']) ? round(max(0, $subtotal - $discount + $shipping) * ((float)$settings['taxRate'] / 100), 2) : 0;
    $grand = (float)($orderRow['total'] ?? 0);
    if ($grand <= 0) {
        $grand = max(0, $subtotal - $discount + $shipping + $tax);
    }

    $totals = [
        'subtotal' => $subtotal,
        'shipping' => $shipping,
        'discount' => $discount,
        'tax' => $tax,
        'grand' => $grand
    ];

    $type = strtoupper(trim((string)$typeCode));
    if ($type === '') {
        $type = strtoupper((string)($settings['defaultType'] ?? 'INV'));
    }
    $label = 'Invoice';
    foreach (($settings['serialTypes'] ?? []) as $serialType) {
        if (strtoupper((string)($serialType['code'] ?? '')) === $type) {
            $label = (string)($serialType['label'] ?? 'Invoice');
            break;
        }
    }

    $serialData = invoice_allocate_serial($db, $settings, $type);
    $serial = (string)$serialData['serial'];
    $html = invoice_build_html($orderRow, $items, $settings, $serial, $type, $label, $totals);
    $plainText = invoice_build_plain_text($orderRow, $items, $serial, $totals, $label);

    $outputDir = invoice_ensure_output_dir();
    $timeToken = date('Ymd_His');
    $safeSerial = invoice_file_safe_name($serial);
    $htmlName = $safeSerial . '_' . $timeToken . '.html';
    $pdfName = $safeSerial . '_' . $timeToken . '.pdf';
    $htmlPath = $outputDir . DIRECTORY_SEPARATOR . $htmlName;
    $pdfPath = $outputDir . DIRECTORY_SEPARATOR . $pdfName;

    if (@file_put_contents($htmlPath, $html) === false) {
        throw new Exception('INVOICE_HTML_WRITE_FAILED');
    }
    $pdfGenerated = invoice_generate_pdf_file($html, $plainText, $pdfPath);
    if (!$pdfGenerated) {
        $pdfPath = null;
    }

    $htmlRelative = 'api/invoices/' . $htmlName;
    $pdfRelative = $pdfPath ? ('api/invoices/' . $pdfName) : null;
    $htmlUrl = invoice_relative_url($htmlRelative);
    $pdfUrl = $pdfRelative ? invoice_relative_url($pdfRelative) : null;

    $status = 'GENERATED';
    $errorMessage = null;
    $sentAt = null;

    if ($sendEmail) {
        $toEmail = trim((string)($orderRow['customer_email'] ?? ''));
        if ($toEmail === '') {
            throw new Exception('CUSTOMER_EMAIL_MISSING');
        }
        $subject = "{$label} {$serial} • SPLARO Order {$orderId}";
        $attachments = [];
        if ($pdfPath && is_file($pdfPath)) {
            $attachments[] = [
                'path' => $pdfPath,
                'name' => $serial . '.pdf',
                'type' => 'application/pdf'
            ];
        } else {
            $attachments[] = [
                'path' => $htmlPath,
                'name' => $serial . '.html',
                'type' => 'text/html'
            ];
        }
        $sent = smtp_send_mail_with_attachments($db, $toEmail, $subject, $html, true, $attachments);
        if (!$sent) {
            usleep(300000);
            $sent = smtp_send_mail_with_attachments($db, $toEmail, $subject, $html, true, $attachments);
        }
        if ($sent) {
            $status = 'SENT';
            $sentAt = date('Y-m-d H:i:s');
        } else {
            $status = 'FAILED';
            $errorMessage = 'SMTP_SEND_FAILED';
        }
    }

    $insert = $db->prepare("INSERT INTO invoice_documents (order_id, serial, doc_type, status, html_path, pdf_path, html_url, pdf_url, sent_at, created_by_admin_id, error_message) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $insert->execute([
        $orderId,
        $serial,
        $type,
        $status,
        $htmlRelative,
        $pdfRelative,
        $htmlUrl,
        $pdfUrl,
        $sentAt,
        $createdBy !== null ? (string)$createdBy : null,
        $errorMessage
    ]);
    $invoiceId = (int)$db->lastInsertId();

    return [
        'id' => $invoiceId,
        'orderId' => $orderId,
        'serial' => $serial,
        'type' => $type,
        'label' => $label,
        'status' => $status,
        'htmlPath' => $htmlRelative,
        'pdfPath' => $pdfRelative,
        'htmlUrl' => $htmlUrl,
        'pdfUrl' => $pdfUrl,
        'sentAt' => $sentAt,
        'error' => $errorMessage
    ];
}

function telegram_escape_html($value) {
    return htmlspecialchars((string)$value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function telegram_api_request($endpoint, $payload, $timeoutSeconds = 5) {
    $url = "https://api.telegram.org/bot" . TELEGRAM_BOT_TOKEN . "/" . ltrim((string)$endpoint, '/');
    $jsonPayload = json_encode($payload);

    if ($jsonPayload === false) {
        return [false, 0, 'JSON_ENCODE_FAILED'];
    }

    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
            CURLOPT_POSTFIELDS => $jsonPayload,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => $timeoutSeconds,
            CURLOPT_TIMEOUT => $timeoutSeconds,
        ]);

        $responseBody = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);

        if ($responseBody === false) {
            return [false, $httpCode, $curlError ?: 'CURL_REQUEST_FAILED'];
        }

        return [$responseBody, $httpCode, ''];
    }

    $context = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => "Content-Type: application/json\r\n",
            'content' => $jsonPayload,
            'timeout' => $timeoutSeconds,
            'ignore_errors' => true
        ]
    ]);

    $responseBody = @file_get_contents($url, false, $context);
    $responseHeaders = function_exists('http_get_last_response_headers')
        ? http_get_last_response_headers()
        : ($GLOBALS['http_response_header'] ?? []);
    $httpCode = 0;
    if (!empty($responseHeaders[0]) && preg_match('/\s(\d{3})\s/', $responseHeaders[0], $m)) {
        $httpCode = (int)$m[1];
    }

    if ($responseBody === false) {
        return [false, $httpCode, 'STREAM_REQUEST_FAILED'];
    }

    return [$responseBody, $httpCode, ''];
}

function send_telegram_message($text, $targetChatId = null, $options = []) {
    if (!TELEGRAM_ENABLED) {
        return false;
    }

    $chatId = $targetChatId ?: TELEGRAM_ADMIN_CHAT_ID;
    if (!$chatId) {
        return false;
    }

    $payload = [
        'chat_id' => $chatId,
        'text' => $text,
        'parse_mode' => 'HTML',
        'disable_web_page_preview' => true
    ];

    if (is_array($options)) {
        foreach ($options as $key => $value) {
            if ($key === 'chat_id' || $key === 'text') {
                continue;
            }
            $payload[$key] = $value;
        }
    }

    $attempt = 0;
    $maxAttempts = 3; // initial + 2 retries
    $delayMs = 200;

    while ($attempt < $maxAttempts) {
        $attempt++;

        [$response, $httpCode, $requestError] = telegram_api_request('sendMessage', $payload, 5);

        if ($response !== false && $httpCode >= 200 && $httpCode < 300) {
            return true;
        }

        if ($attempt >= $maxAttempts) {
            error_log("SPLARO_TELEGRAM_FAILURE: HTTP {$httpCode}; ERROR {$requestError}; RESPONSE {$response}");
            return false;
        }

        usleep($delayMs * 1000);
        $delayMs *= 2;
    }

    return false;
}

function telegram_order_summary($order) {
    $id = telegram_escape_html($order['id'] ?? 'N/A');
    $name = telegram_escape_html($order['customer_name'] ?? 'N/A');
    $phone = telegram_escape_html($order['phone'] ?? 'N/A');
    $status = telegram_escape_html($order['status'] ?? 'UNKNOWN');
    $total = telegram_escape_html($order['total'] ?? 0);
    $created = telegram_escape_html($order['created_at'] ?? '');
    return "<b>Order:</b> {$id}\n<b>Name:</b> {$name}\n<b>Phone:</b> {$phone}\n<b>Status:</b> {$status}\n<b>Total:</b> ৳{$total}\n<b>Time:</b> {$created}";
}

function is_telegram_admin_chat($chatId) {
    return (string)$chatId === (string)TELEGRAM_ADMIN_CHAT_ID;
}

function telegram_admin_command_definitions() {
    return [
        ['command' => 'start', 'description' => 'Show command menu'],
        ['command' => 'help', 'description' => 'Show command usage'],
        ['command' => 'commands', 'description' => 'Show all commands'],
        ['command' => 'health', 'description' => 'Check API and DB status'],
        ['command' => 'orders', 'description' => 'List latest orders: /orders 10'],
        ['command' => 'order', 'description' => 'Get order details: /order {id}'],
        ['command' => 'setstatus', 'description' => 'Update order status'],
        ['command' => 'users', 'description' => 'List latest users: /users 10'],
        ['command' => 'maintenance', 'description' => 'Set maintenance on/off'],
    ];
}

function telegram_quick_keyboard() {
    return [
        'keyboard' => [
            ['/health', '/orders 5'],
            ['/users 5', '/maintenance off'],
            ['/help'],
        ],
        'resize_keyboard' => true,
        'one_time_keyboard' => false,
    ];
}

function telegram_register_bot_commands_once() {
    if (!TELEGRAM_ENABLED) {
        return false;
    }

    $cacheFile = rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR
        . 'splaro_telegram_commands_' . md5((string)TELEGRAM_BOT_TOKEN) . '.json';
    $now = time();
    $ttl = 6 * 60 * 60;

    if (file_exists($cacheFile)) {
        $raw = @file_get_contents($cacheFile);
        $state = json_decode($raw, true);
        if (is_array($state) && !empty($state['synced_at']) && ($now - (int)$state['synced_at']) < $ttl) {
            return true;
        }
    }

    $payload = [
        'commands' => telegram_admin_command_definitions(),
        'scope' => ['type' => 'default'],
        'language_code' => 'en'
    ];

    [$response, $httpCode, $requestError] = telegram_api_request('setMyCommands', $payload, 5);
    if ($response === false || $httpCode < 200 || $httpCode >= 300) {
        error_log("SPLARO_TELEGRAM_COMMAND_SYNC_FAILURE: HTTP {$httpCode}; ERROR {$requestError}; RESPONSE {$response}");
        return false;
    }

    @file_put_contents($cacheFile, json_encode(['synced_at' => $now]), LOCK_EX);
    return true;
}

function telegram_admin_help_text() {
    return "<b>SPLARO Admin Bot</b>\n"
        . "Use these commands:\n\n"
        . "• <b>/health</b> - API and DB status\n"
        . "• <b>/orders [limit]</b> - latest orders\n"
        . "• <b>/order {id}</b> - order details\n"
        . "• <b>/setstatus {id} {PENDING|PROCESSING|SHIPPED|DELIVERED|CANCELLED}</b>\n"
        . "• <b>/users [limit]</b> - latest users\n"
        . "• <b>/maintenance {on|off}</b> - toggle maintenance\n"
        . "• <b>/commands</b> - show this menu\n\n"
        . "<b>Examples</b>\n"
        . "/orders 10\n"
        . "/order SPL-000123\n"
        . "/setstatus SPL-000123 SHIPPED";
}

function is_rate_limited($bucket, $maxRequests = 20, $windowSeconds = 60) {
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $key = md5($bucket . '|' . $ip);
    $file = rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . "splaro_rate_" . $key . ".json";
    $now = time();

    $state = ['start' => $now, 'count' => 0];
    if (file_exists($file)) {
        $raw = @file_get_contents($file);
        $parsed = json_decode($raw, true);
        if (is_array($parsed) && isset($parsed['start']) && isset($parsed['count'])) {
            $state = $parsed;
        }
    }

    if (($now - (int)$state['start']) >= $windowSeconds) {
        $state = ['start' => $now, 'count' => 0];
    }

    $state['count'] = (int)$state['count'] + 1;
    @file_put_contents($file, json_encode($state), LOCK_EX);

    return $state['count'] > $maxRequests;
}

function is_rate_limited_scoped($bucket, $scopeKey, $maxRequests = 10, $windowSeconds = 60) {
    $scope = trim((string)$scopeKey);
    if ($scope === '') {
        $scope = 'global';
    }
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $key = md5($bucket . '|' . $scope . '|' . $ip);
    $file = rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . "splaro_rate_scope_" . $key . ".json";
    $now = time();

    $state = ['start' => $now, 'count' => 0];
    if (file_exists($file)) {
        $raw = @file_get_contents($file);
        $parsed = json_decode($raw, true);
        if (is_array($parsed) && isset($parsed['start']) && isset($parsed['count'])) {
            $state = $parsed;
        }
    }

    if (($now - (int)$state['start']) >= $windowSeconds) {
        $state = ['start' => $now, 'count' => 0];
    }

    $state['count'] = (int)$state['count'] + 1;
    @file_put_contents($file, json_encode($state), LOCK_EX);

    return $state['count'] > $maxRequests;
}

function is_https_request() {
    if (!empty($_SERVER['HTTPS']) && strtolower((string)$_SERVER['HTTPS']) !== 'off') {
        return true;
    }
    $forwardedProto = strtolower((string)($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? ''));
    return $forwardedProto === 'https';
}

function generate_csrf_token() {
    return base64url_encode(random_bytes(24));
}

function set_csrf_cookie($token) {
    $params = [
        'expires' => time() + (30 * 24 * 60 * 60),
        'path' => '/',
        'secure' => is_https_request(),
        'httponly' => false,
        'samesite' => 'Lax'
    ];
    setcookie('splaro_csrf', (string)$token, $params);
}

function refresh_csrf_token() {
    $token = generate_csrf_token();
    set_csrf_cookie($token);
    return $token;
}

function read_csrf_token_from_cookie() {
    return trim((string)($_COOKIE['splaro_csrf'] ?? ''));
}

function require_csrf_token() {
    $cookieToken = read_csrf_token_from_cookie();
    $headerToken = trim((string)get_header_value('X-CSRF-Token'));
    if ($cookieToken === '' || $headerToken === '' || !hash_equals($cookieToken, $headerToken)) {
        http_response_code(403);
        echo json_encode(["status" => "error", "message" => "CSRF_INVALID"]);
        exit;
    }
}

function base32_encode_bytes($input) {
    $alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    $binary = '';
    $length = strlen((string)$input);
    for ($i = 0; $i < $length; $i++) {
        $binary .= str_pad(decbin(ord($input[$i])), 8, '0', STR_PAD_LEFT);
    }

    $chunks = str_split($binary, 5);
    $encoded = '';
    foreach ($chunks as $chunk) {
        if (strlen($chunk) < 5) {
            $chunk = str_pad($chunk, 5, '0', STR_PAD_RIGHT);
        }
        $encoded .= $alphabet[bindec($chunk)];
    }
    return $encoded;
}

function build_display_name_from_email($email) {
    $base = explode('@', (string)$email)[0] ?? '';
    $clean = preg_replace('/\d+/', ' ', $base);
    $clean = preg_replace('/[._-]+/', ' ', $clean);
    $clean = trim(preg_replace('/\s+/', ' ', $clean));

    if ($clean === '') {
        return 'SPLARO Customer';
    }

    $parts = preg_split('/\s+/', strtolower($clean));
    $parts = array_filter($parts, fn($part) => $part !== '');
    $parts = array_map(fn($part) => ucfirst($part), $parts);
    $displayName = trim(implode(' ', $parts));

    return $displayName !== '' ? $displayName : 'SPLARO Customer';
}

function base64url_encode($data) {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function base64url_decode($data) {
    $remainder = strlen($data) % 4;
    if ($remainder) {
        $data .= str_repeat('=', 4 - $remainder);
    }
    return base64_decode(strtr($data, '-_', '+/'));
}

function get_header_value($key) {
    $serverKey = 'HTTP_' . strtoupper(str_replace('-', '_', $key));
    if (isset($_SERVER[$serverKey])) {
        return $_SERVER[$serverKey];
    }

    if (function_exists('apache_request_headers')) {
        $headers = apache_request_headers();
        if (is_array($headers)) {
            foreach ($headers as $headerKey => $headerValue) {
                if (strtolower($headerKey) === strtolower($key)) {
                    return $headerValue;
                }
            }
        }
    }

    return '';
}

function log_system_event($db, $eventType, $description, $userId = null, $ip = null) {
    if (!$db) {
        return;
    }
    try {
        $stmt = $db->prepare("INSERT INTO system_logs (event_type, event_description, user_id, ip_address) VALUES (?, ?, ?, ?)");
        $stmt->execute([
            (string)$eventType,
            (string)$description,
            $userId !== null ? (string)$userId : null,
            $ip !== null ? (string)$ip : ($_SERVER['REMOTE_ADDR'] ?? 'UNKNOWN')
        ]);
    } catch (Exception $e) {
        // best-effort logging only
    }
}

function log_audit_event($db, $actorId, $action, $entityType, $entityId = null, $before = null, $after = null, $ip = null) {
    if (!$db) {
        return;
    }
    try {
        $stmt = $db->prepare("INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, before_json, after_json, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([
            $actorId !== null ? (string)$actorId : null,
            (string)$action,
            (string)$entityType,
            $entityId !== null ? (string)$entityId : null,
            $before !== null ? json_encode($before) : null,
            $after !== null ? json_encode($after) : null,
            $ip !== null ? (string)$ip : ($_SERVER['REMOTE_ADDR'] ?? 'UNKNOWN')
        ]);
    } catch (Exception $e) {
        // best-effort logging only
    }
}

function safe_json_decode_assoc($raw, $default = []) {
    if (is_array($raw)) {
        return $raw;
    }
    if (!is_string($raw) || trim($raw) === '') {
        return is_array($default) ? $default : [];
    }
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : (is_array($default) ? $default : []);
}

function slugify_text($text) {
    $text = strtolower(trim((string)$text));
    $text = preg_replace('/[^\p{L}\p{N}\s._~-]+/u', '', $text);
    $text = preg_replace('/\s+/u', '-', $text);
    $text = trim((string)$text, '-._~');
    if ($text === '') {
        return 'item-' . substr(bin2hex(random_bytes(4)), 0, 6);
    }
    return $text;
}

function build_product_live_url($brandSlug, $categorySlug, $productSlug) {
    $origin = trim((string)env_or_default('APP_ORIGIN', ''));
    if ($origin === '') {
        $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
        $host = trim((string)($_SERVER['HTTP_HOST'] ?? ''));
        if ($host !== '') {
            $origin = $scheme . '://' . $host;
        }
    }
    $path = '/product/' . rawurlencode((string)$brandSlug) . '/' . rawurlencode((string)$categorySlug) . '/' . rawurlencode((string)$productSlug);
    if ($origin === '') return $path;
    return rtrim($origin, '/') . $path;
}

function cms_default_theme_settings() {
    return [
        'colors' => [
            'primary' => '#0A0C12',
            'accent' => '#41DCFF',
            'background' => '#050505',
            'surface' => 'rgba(20, 26, 40, 0.86)',
            'text' => '#FFFFFF'
        ],
        'typography' => [
            'fontFamily' => 'Inter',
            'baseSize' => 16,
            'headingScale' => 1
        ],
        'borderRadius' => 24,
        'shadowIntensity' => 60,
        'buttonStyle' => 'PILL',
        'focusStyle' => 'SUBTLE',
        'containerWidth' => 'XL',
        'spacingScale' => 'COMFORTABLE',
        'reduceGlow' => false,
        'premiumMinimalMode' => false,
        'enableUrgencyUI' => true,
        'lowStockThreshold' => 5
    ];
}

function cms_default_hero_settings() {
    return [
        'heroTitle' => 'Premium Collection',
        'heroTitleMode' => 'AUTO',
        'heroTitleManualBreaks' => "Premium\nCollection",
        'heroSubtitle' => 'Imported premium footwear and bags, curated for modern city style.',
        'heroBadge' => 'SPLARO Premium Selection',
        'heroCtaLabel' => 'Explore Collection',
        'heroCtaUrl' => '/shop',
        'heroBgType' => 'GRADIENT',
        'heroBgValue' => 'linear-gradient(135deg, rgba(10,12,18,0.45), rgba(8,145,178,0.16))',
        'heroAlignment' => 'LEFT',
        'heroMaxLines' => 2,
        'heroEnabled' => true,
        'autoBalance' => true
    ];
}

function cms_default_category_overrides() {
    return [
        'all' => [
            'heroTitle' => 'Premium Collection',
            'heroSubtitle' => 'Imported premium footwear and bags, curated for modern city style.',
            'heroBadge' => 'SPLARO Premium Selection',
            'heroCtaLabel' => 'Explore Collection',
            'heroCtaUrl' => '/shop',
            'sortDefault' => 'Newest'
        ],
        'shoes' => [
            'heroTitle' => 'Footwear Collection',
            'heroSubtitle' => 'Imported footwear with clean construction and everyday comfort.',
            'heroBadge' => 'Footwear Focus',
            'heroCtaLabel' => 'Shop Shoes',
            'heroCtaUrl' => '/shop?category=shoes',
            'sortDefault' => 'Newest'
        ],
        'bags' => [
            'heroTitle' => 'Bags Collection',
            'heroSubtitle' => 'Premium imported bags with refined finish and utility-first form.',
            'heroBadge' => 'Bags Focus',
            'heroCtaLabel' => 'Shop Bags',
            'heroCtaUrl' => '/shop?category=bags',
            'sortDefault' => 'Newest'
        ]
    ];
}

function cms_default_bundle() {
    return [
        'themeSettings' => cms_default_theme_settings(),
        'heroSettings' => cms_default_hero_settings(),
        'categoryHeroOverrides' => cms_default_category_overrides()
    ];
}

function cms_normalize_theme_settings($raw) {
    $base = cms_default_theme_settings();
    $input = is_array($raw) ? $raw : [];
    $colors = is_array($input['colors'] ?? null) ? $input['colors'] : [];
    $typography = is_array($input['typography'] ?? null) ? $input['typography'] : [];
    $allowedFonts = ['Inter', 'Manrope', 'Plus Jakarta Sans', 'Urbanist', 'Poppins'];
    $allowedContainer = ['LG', 'XL', '2XL', 'FULL'];
    $allowedSpacing = ['COMPACT', 'COMFORTABLE', 'RELAXED'];

    return [
        'colors' => [
            'primary' => trim((string)($colors['primary'] ?? $base['colors']['primary'])),
            'accent' => trim((string)($colors['accent'] ?? $base['colors']['accent'])),
            'background' => trim((string)($colors['background'] ?? $base['colors']['background'])),
            'surface' => trim((string)($colors['surface'] ?? $base['colors']['surface'])),
            'text' => trim((string)($colors['text'] ?? $base['colors']['text']))
        ],
        'typography' => [
            'fontFamily' => in_array((string)($typography['fontFamily'] ?? ''), $allowedFonts, true)
                ? (string)$typography['fontFamily']
                : $base['typography']['fontFamily'],
            'baseSize' => max(12, min(20, (int)($typography['baseSize'] ?? $base['typography']['baseSize']))),
            'headingScale' => max(0.8, min(1.6, (float)($typography['headingScale'] ?? $base['typography']['headingScale'])))
        ],
        'borderRadius' => max(8, min(40, (int)($input['borderRadius'] ?? $base['borderRadius']))),
        'shadowIntensity' => max(0, min(100, (int)($input['shadowIntensity'] ?? $base['shadowIntensity']))),
        'buttonStyle' => strtoupper((string)($input['buttonStyle'] ?? '')) === 'ROUNDED' ? 'ROUNDED' : 'PILL',
        'focusStyle' => strtoupper((string)($input['focusStyle'] ?? '')) === 'BRIGHT' ? 'BRIGHT' : 'SUBTLE',
        'containerWidth' => in_array((string)($input['containerWidth'] ?? ''), $allowedContainer, true)
            ? (string)$input['containerWidth']
            : $base['containerWidth'],
        'spacingScale' => in_array((string)($input['spacingScale'] ?? ''), $allowedSpacing, true)
            ? (string)$input['spacingScale']
            : $base['spacingScale'],
        'reduceGlow' => (bool)($input['reduceGlow'] ?? false),
        'premiumMinimalMode' => (bool)($input['premiumMinimalMode'] ?? false),
        'enableUrgencyUI' => isset($input['enableUrgencyUI'])
            ? (bool)$input['enableUrgencyUI']
            : (bool)($base['enableUrgencyUI'] ?? true),
        'lowStockThreshold' => max(0, min(50, (int)($input['lowStockThreshold'] ?? $input['low_stock_threshold'] ?? $base['lowStockThreshold'] ?? 5)))
    ];
}

function cms_normalize_hero_settings($raw) {
    $base = cms_default_hero_settings();
    $input = is_array($raw) ? $raw : [];
    $maxLines = (int)($input['heroMaxLines'] ?? $base['heroMaxLines']);
    if ($maxLines < 1) $maxLines = 1;
    if ($maxLines > 4) $maxLines = 4;
    return [
        'heroTitle' => trim((string)($input['heroTitle'] ?? $base['heroTitle'])),
        'heroTitleMode' => strtoupper((string)($input['heroTitleMode'] ?? '')) === 'MANUAL' ? 'MANUAL' : 'AUTO',
        'heroTitleManualBreaks' => (string)($input['heroTitleManualBreaks'] ?? $base['heroTitleManualBreaks']),
        'heroSubtitle' => trim((string)($input['heroSubtitle'] ?? $base['heroSubtitle'])),
        'heroBadge' => trim((string)($input['heroBadge'] ?? $base['heroBadge'])),
        'heroCtaLabel' => trim((string)($input['heroCtaLabel'] ?? $base['heroCtaLabel'])),
        'heroCtaUrl' => trim((string)($input['heroCtaUrl'] ?? $base['heroCtaUrl'])),
        'heroBgType' => strtoupper((string)($input['heroBgType'] ?? '')) === 'IMAGE' ? 'IMAGE' : 'GRADIENT',
        'heroBgValue' => trim((string)($input['heroBgValue'] ?? $base['heroBgValue'])),
        'heroAlignment' => strtoupper((string)($input['heroAlignment'] ?? '')) === 'CENTER' ? 'CENTER' : 'LEFT',
        'heroMaxLines' => $maxLines,
        'heroEnabled' => isset($input['heroEnabled']) ? (bool)$input['heroEnabled'] : true,
        'autoBalance' => isset($input['autoBalance']) ? (bool)$input['autoBalance'] : true
    ];
}

function cms_normalize_category_override($raw, $fallback) {
    $input = is_array($raw) ? $raw : [];
    $merged = array_merge(is_array($fallback) ? $fallback : [], $input);
    if (isset($merged['heroTitleMode']) && strtoupper((string)$merged['heroTitleMode']) !== 'MANUAL') {
        $merged['heroTitleMode'] = 'AUTO';
    }
    if (isset($merged['heroBgType']) && strtoupper((string)$merged['heroBgType']) !== 'IMAGE') {
        $merged['heroBgType'] = 'GRADIENT';
    }
    if (isset($merged['heroAlignment']) && strtoupper((string)$merged['heroAlignment']) !== 'CENTER') {
        $merged['heroAlignment'] = 'LEFT';
    }
    if (isset($merged['sortDefault']) && !in_array((string)$merged['sortDefault'], ['Newest', 'PriceLowToHigh', 'PriceHighToLow'], true)) {
        $merged['sortDefault'] = 'Newest';
    }
    return $merged;
}

function cms_normalize_bundle($raw) {
    $base = cms_default_bundle();
    $input = is_array($raw) ? $raw : [];
    $overrides = is_array($input['categoryHeroOverrides'] ?? null) ? $input['categoryHeroOverrides'] : [];
    return [
        'themeSettings' => cms_normalize_theme_settings($input['themeSettings'] ?? []),
        'heroSettings' => cms_normalize_hero_settings($input['heroSettings'] ?? []),
        'categoryHeroOverrides' => [
            'all' => cms_normalize_category_override($overrides['all'] ?? [], $base['categoryHeroOverrides']['all']),
            'shoes' => cms_normalize_category_override($overrides['shoes'] ?? [], $base['categoryHeroOverrides']['shoes']),
            'bags' => cms_normalize_category_override($overrides['bags'] ?? [], $base['categoryHeroOverrides']['bags'])
        ]
    ];
}

function cms_normalize_revisions($raw) {
    $items = is_array($raw) ? $raw : [];
    $normalized = [];
    foreach ($items as $index => $revision) {
        $row = is_array($revision) ? $revision : [];
        $normalized[] = [
            'id' => (string)($row['id'] ?? ('rev_' . $index . '_' . substr(md5((string)microtime(true)), 0, 6))),
            'mode' => strtoupper((string)($row['mode'] ?? 'DRAFT')) === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT',
            'timestamp' => (string)($row['timestamp'] ?? date('c')),
            'adminUser' => (string)($row['adminUser'] ?? 'admin@splaro.co'),
            'payload' => cms_normalize_bundle($row['payload'] ?? [])
        ];
        if (count($normalized) >= 10) {
            break;
        }
    }
    return $normalized;
}

function cms_upsert_page_section($db, $sectionKey, $draftJson, $publishedJson, $status, $updatedBy, $publishedAt = null) {
    try {
        $sql = "INSERT INTO page_sections (section_key, draft_json, published_json, status, updated_by, published_at)
                VALUES (?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                  draft_json = VALUES(draft_json),
                  published_json = VALUES(published_json),
                  status = VALUES(status),
                  updated_by = VALUES(updated_by),
                  published_at = VALUES(published_at)";
        $stmt = $db->prepare($sql);
        $stmt->execute([
            (string)$sectionKey,
            json_encode($draftJson),
            json_encode($publishedJson),
            (string)$status,
            (string)$updatedBy,
            $publishedAt
        ]);
    } catch (Exception $e) {
        error_log('SPLARO_CMS_SECTION_UPSERT_FAILED: ' . $e->getMessage());
    }
}

function cms_record_revision($db, $sectionKey, $mode, $payload, $actorId) {
    try {
        $stmt = $db->prepare("INSERT INTO settings_revisions (section_key, mode, payload_json, actor_id) VALUES (?, ?, ?, ?)");
        $stmt->execute([
            (string)$sectionKey,
            strtoupper((string)$mode) === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT',
            json_encode($payload),
            (string)$actorId
        ]);
    } catch (Exception $e) {
        error_log('SPLARO_CMS_REVISION_WRITE_FAILED: ' . $e->getMessage());
    }
}

function cms_cache_file_path() {
    $cacheKey = md5((string)DB_HOST . '|' . (string)DB_NAME . '|' . (string)DB_PORT);
    return rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . "splaro_cms_bundle_{$cacheKey}.json";
}

function cms_cache_read($ttlSeconds = 3600) {
    $file = cms_cache_file_path();
    if (!is_file($file)) {
        return null;
    }
    $raw = @file_get_contents($file);
    $decoded = json_decode((string)$raw, true);
    if (!is_array($decoded) || !isset($decoded['cached_at'])) {
        return null;
    }
    $age = time() - (int)$decoded['cached_at'];
    if ($age > (int)$ttlSeconds) {
        return null;
    }
    return is_array($decoded['payload'] ?? null) ? $decoded['payload'] : null;
}

function cms_cache_write($payload) {
    if (!is_array($payload)) {
        return;
    }
    $file = cms_cache_file_path();
    @file_put_contents($file, json_encode([
        'cached_at' => time(),
        'payload' => $payload
    ]), LOCK_EX);
}

function get_admin_role($authUser) {
    $role = strtoupper((string)($authUser['role'] ?? ''));
    if ($role === '') {
        return 'ADMIN';
    }
    if ($role === 'ADMIN') return 'ADMIN';
    if ($role === 'SUPER_ADMIN') return 'SUPER_ADMIN';
    if ($role === 'EDITOR') return 'EDITOR';
    if ($role === 'VIEWER') return 'VIEWER';
    return $role;
}

function can_edit_cms_role($role) {
    return in_array(strtoupper((string)$role), ['ADMIN', 'SUPER_ADMIN', 'EDITOR'], true);
}

function is_strong_password($password) {
    $value = (string)$password;
    if (strlen($value) < 6) return false;
    if (preg_match('/\s/', $value)) return false;
    return true;
}

function generate_public_user_id() {
    $datePart = gmdate('Ymd');
    try {
        $randomPart = strtoupper(substr(bin2hex(random_bytes(5)), 0, 10));
    } catch (Exception $e) {
        $randomPart = strtoupper(substr(sha1(uniqid((string)mt_rand(), true)), 0, 10));
    }
    return "USR-{$datePart}-{$randomPart}";
}

function resolve_session_id() {
    $headerSessionId = trim((string)get_header_value('X-Session-Id'));
    if ($headerSessionId !== '') {
        return $headerSessionId;
    }
    $cookieSessionId = trim((string)($_COOKIE['splaro_session_id'] ?? ''));
    return $cookieSessionId;
}

function clear_user_sessions($db, $userId, $exceptSessionId = null) {
    if (!$db || !$userId) {
        return;
    }
    try {
        if ($exceptSessionId !== null && trim((string)$exceptSessionId) !== '') {
            $stmt = $db->prepare("DELETE FROM traffic_metrics WHERE user_id = ? AND session_id <> ?");
            $stmt->execute([(string)$userId, trim((string)$exceptSessionId)]);
            return;
        }
        $stmt = $db->prepare("DELETE FROM traffic_metrics WHERE user_id = ?");
        $stmt->execute([(string)$userId]);
    } catch (Exception $e) {
        // best-effort cleanup only
    }
}

function issue_auth_token($user) {
    if (APP_AUTH_SECRET === '') {
        return '';
    }

    $pwdChangedAt = null;
    if (!empty($user['last_password_change_at'])) {
        $ts = strtotime((string)$user['last_password_change_at']);
        if ($ts && $ts > 0) {
            $pwdChangedAt = $ts;
        }
    }

    $payload = [
        'uid' => (string)($user['id'] ?? ''),
        'email' => (string)($user['email'] ?? ''),
        'role' => strtoupper((string)($user['role'] ?? 'USER')),
        'pwd_at' => $pwdChangedAt ?: time(),
        'exp' => time() + (12 * 60 * 60)
    ];

    $payloadEncoded = base64url_encode(json_encode($payload));
    $signature = base64url_encode(hash_hmac('sha256', $payloadEncoded, APP_AUTH_SECRET, true));
    return $payloadEncoded . '.' . $signature;
}

function get_authenticated_user_from_request() {
    if (APP_AUTH_SECRET === '') {
        return null;
    }

    $authHeader = get_header_value('Authorization');
    if (!is_string($authHeader) || stripos($authHeader, 'Bearer ') !== 0) {
        return null;
    }

    $token = trim(substr($authHeader, 7));
    if ($token === '' || strpos($token, '.') === false) {
        return null;
    }

    [$payloadEncoded, $signature] = explode('.', $token, 2);
    $expectedSignature = base64url_encode(hash_hmac('sha256', $payloadEncoded, APP_AUTH_SECRET, true));
    if (!hash_equals($expectedSignature, $signature)) {
        return null;
    }

    $payloadJson = base64url_decode($payloadEncoded);
    $payload = json_decode($payloadJson, true);
    if (!is_array($payload)) {
        return null;
    }

    if (empty($payload['exp']) || (int)$payload['exp'] < time()) {
        return null;
    }

    $uid = (string)($payload['uid'] ?? '');
    if ($uid === '') {
        return null;
    }

    global $db;
    if (!isset($db) || !$db) {
        return null;
    }

    try {
        $stmt = $db->prepare("SELECT id, email, role, force_relogin, last_password_change_at FROM users WHERE id = ? LIMIT 1");
        $stmt->execute([$uid]);
        $row = $stmt->fetch();
    } catch (Exception $e) {
        return null;
    }

    if (!$row) {
        return null;
    }

    if ((int)($row['force_relogin'] ?? 0) === 1) {
        return null;
    }

    $tokenPwdAt = (int)($payload['pwd_at'] ?? 0);
    $dbPwdAt = !empty($row['last_password_change_at']) ? strtotime((string)$row['last_password_change_at']) : 0;
    if ($dbPwdAt && $tokenPwdAt && $tokenPwdAt < $dbPwdAt) {
        return null;
    }

    return [
        'id' => (string)($row['id'] ?? ''),
        'email' => strtolower((string)($row['email'] ?? ($payload['email'] ?? ''))),
        'role' => strtoupper((string)($row['role'] ?? ($payload['role'] ?? 'USER')))
    ];
}

function is_admin_authenticated($authUser) {
    if (is_array($authUser) && in_array(strtoupper((string)($authUser['role'] ?? '')), ['ADMIN', 'SUPER_ADMIN', 'EDITOR', 'VIEWER'], true)) {
        return true;
    }

    $adminKeyHeader = trim((string)get_header_value('X-Admin-Key'));
    if ($adminKeyHeader !== '') {
        if (ADMIN_KEY !== '' && hash_equals(ADMIN_KEY, $adminKeyHeader)) {
            return true;
        }
    }

    return false;
}

function require_admin_access($authUser) {
    if (!is_admin_authenticated($authUser)) {
        http_response_code(403);
        echo json_encode(["status" => "error", "message" => "ADMIN_ACCESS_REQUIRED"]);
        exit;
    }
}

function sanitize_user_payload($user) {
    return [
        'id' => $user['id'] ?? '',
        'name' => $user['name'] ?? '',
        'email' => $user['email'] ?? '',
        'phone' => $user['phone'] ?? '',
        'address' => $user['address'] ?? '',
        'profile_image' => $user['profile_image'] ?? '',
        'role' => $user['role'] ?? 'USER',
        'default_shipping_address' => $user['default_shipping_address'] ?? '',
        'notification_email' => isset($user['notification_email']) ? ((int)$user['notification_email'] === 1) : true,
        'notification_sms' => isset($user['notification_sms']) ? ((int)$user['notification_sms'] === 1) : false,
        'preferred_language' => $user['preferred_language'] ?? 'EN',
        'two_factor_enabled' => isset($user['two_factor_enabled']) ? ((int)$user['two_factor_enabled'] === 1) : false,
        'last_password_change_at' => $user['last_password_change_at'] ?? null,
        'force_relogin' => isset($user['force_relogin']) ? ((int)$user['force_relogin'] === 1) : false,
        'created_at' => $user['created_at'] ?? date('c')
    ];
}

function resolve_admin_login_emails($db = null) {
    $strictAdminEmail = strtolower(trim((string)env_or_default('ADMIN_LOGIN_EMAIL', 'admin@splaro.co')));
    if (!filter_var($strictAdminEmail, FILTER_VALIDATE_EMAIL)) {
        $strictAdminEmail = 'admin@splaro.co';
    }
    return [$strictAdminEmail];
}

function is_admin_login_email($email, $db = null) {
    $normalized = strtolower(trim((string)$email));
    if ($normalized === '') {
        return false;
    }
    $emails = resolve_admin_login_emails($db);
    foreach ($emails as $adminEmail) {
        if (hash_equals((string)$adminEmail, $normalized)) {
            return true;
        }
    }
    return false;
}

function get_primary_admin_secret() {
    $candidates = [
        trim((string)env_or_default('SEED_ADMIN_PASSWORD', '')),
        trim((string)env_or_default('MASTER_PASSWORD', '')),
    ];
    foreach ($candidates as $candidate) {
        if ($candidate !== '') {
            return $candidate;
        }
    }
    return '';
}

function ensure_admin_identity_account($db) {
    $secret = get_primary_admin_secret();
    if ($secret === '') {
        return;
    }

    $emails = resolve_admin_login_emails($db);
    $primaryEmail = strtolower((string)($emails[0] ?? 'admin@splaro.co'));
    $adminHash = null; // Only compute if we actually need to insert/update

    foreach ($emails as $email) {
        try {
            $stmt = $db->prepare("SELECT * FROM users WHERE email = ? LIMIT 1");
            $stmt->execute([$email]);
            $existing = $stmt->fetch();

            if ($existing) {
                $stored = (string)($existing['password'] ?? '');
                $needsUpdate = true;
                if ($stored !== '' && password_verify($secret, $stored)) {
                    $needsUpdate = false;
                } elseif ((password_get_info($stored)['algo'] ?? 0) === 0 && hash_equals($stored, $secret)) {
                    $needsUpdate = false;
                }

                if ($needsUpdate) {
                    if ($adminHash === null) $adminHash = password_hash($secret, PASSWORD_DEFAULT);
                    $update = $db->prepare("UPDATE users SET role = 'ADMIN', password = ? WHERE id = ?");
                    $update->execute([$adminHash, $existing['id']]);
                } else {
                    $updateRole = $db->prepare("UPDATE users SET role = 'ADMIN' WHERE id = ?");
                    $updateRole->execute([$existing['id']]);
                }
            } else {
                if ($adminHash === null) $adminHash = password_hash($secret, PASSWORD_DEFAULT);
                $newId = 'admin_' . bin2hex(random_bytes(4));
                $insert = $db->prepare("INSERT INTO users (id, name, email, phone, address, profile_image, password, role) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
                $insert->execute([
                    $newId,
                    'Splaro Admin',
                    $email,
                    '01700000000',
                    null,
                    null,
                    $adminHash,
                    'ADMIN'
                ]);
            }
        } catch (Exception $e) {
            error_log("SPLARO_ADMIN_AUTOSEED_FAILURE({$email}): " . $e->getMessage());
        }
    }

    // Strict mode: only one admin email should keep admin role.
    try {
        $demote = $db->prepare("UPDATE users SET role = 'USER' WHERE role = 'ADMIN' AND LOWER(email) <> ?");
        $demote->execute([$primaryEmail]);
    } catch (Exception $e) {
        error_log("SPLARO_ADMIN_STRICT_DEMOTE_FAILURE: " . $e->getMessage());
    }
}

function maybe_ensure_admin_account($db) {
    if (!$db) return;
    if (strtolower((string)env_or_default('ALLOW_ADMIN_AUTOSEED', 'false')) !== 'true') {
        return;
    }
    $cacheKey = md5(DB_HOST . '|' . DB_NAME . '|admin_seed');
    $cacheFile = rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . "splaro_admin_check_{$cacheKey}.json";
    $now = time();
    $ttl = 3600; // 1 hour

    if (is_file($cacheFile)) {
        $payload = json_decode((string)@file_get_contents($cacheFile), true);
        if (isset($payload['checked_at']) && ($now - (int)$payload['checked_at']) < $ttl) {
            return;
        }
    }

    ensure_admin_identity_account($db);
    @file_put_contents($cacheFile, json_encode(['checked_at' => $now]), LOCK_EX);
}

$requestAuthUser = get_authenticated_user_from_request();
maybe_ensure_admin_account($db);

function get_sync_queue_summary($db) {
    $summary = [
        'enabled' => GOOGLE_SHEETS_WEBHOOK_URL !== '',
        'pending' => 0,
        'retry' => 0,
        'processing' => 0,
        'success' => 0,
        'dead' => 0,
        'lastFailure' => null,
    ];

    if (!$db || !$summary['enabled']) {
        return $summary;
    }

    try {
        $rows = $db->query("SELECT status, COUNT(*) AS total FROM sync_queue GROUP BY status")->fetchAll();
        foreach ($rows as $row) {
            $status = strtoupper((string)($row['status'] ?? ''));
            $total = (int)($row['total'] ?? 0);
            if ($status === 'PENDING') $summary['pending'] = $total;
            if ($status === 'RETRY') $summary['retry'] = $total;
            if ($status === 'PROCESSING') $summary['processing'] = $total;
            if ($status === 'SUCCESS') $summary['success'] = $total;
            if ($status === 'DEAD') $summary['dead'] = $total;
        }
    } catch (Exception $e) {
        // no-op
    }

    try {
        $stmt = $db->query("SELECT id, sync_type, last_http_code, last_error, updated_at FROM sync_queue WHERE status = 'DEAD' ORDER BY id DESC LIMIT 1");
        $lastFailure = $stmt->fetch();
        if ($lastFailure) {
            $summary['lastFailure'] = [
                'id' => (int)($lastFailure['id'] ?? 0),
                'type' => (string)($lastFailure['sync_type'] ?? ''),
                'http' => (int)($lastFailure['last_http_code'] ?? 0),
                'error' => (string)($lastFailure['last_error'] ?? ''),
                'updated_at' => (string)($lastFailure['updated_at'] ?? ''),
            ];
        }
    } catch (Exception $e) {
        // no-op
    }

    if (function_exists('get_sheets_circuit_state')) {
        $summary['circuit'] = get_sheets_circuit_state();
    }

    return $summary;
}

if ($method === 'GET' && $action === 'health') {
    echo json_encode([
        "status" => "success",
        "service" => "SPLARO_API",
        "time" => date('c'),
        "telegram_enabled" => TELEGRAM_ENABLED,
        "storage" => "mysql",
        "dbHost" => ($GLOBALS['SPLARO_DB_CONNECTED_HOST'] ?? DB_HOST),
        "dbName" => DB_NAME,
        "envSource" => get_env_source_label(),
        "dbPasswordSource" => (string)($GLOBALS['SPLARO_DB_PASSWORD_SOURCE'] ?? ''),
        "sheets" => get_sync_queue_summary($db)
    ]);
    exit;
}

if ($method === 'POST' && $action === 'telegram_webhook') {
    if (!TELEGRAM_ENABLED) {
        echo json_encode(["ok" => false, "message" => "TELEGRAM_DISABLED"]);
        exit;
    }

    if (TELEGRAM_WEBHOOK_SECRET !== '') {
        $headerSecret = $_SERVER['HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN'] ?? '';
        if (!hash_equals(TELEGRAM_WEBHOOK_SECRET, $headerSecret)) {
            http_response_code(403);
            echo json_encode(["ok" => false, "message" => "WEBHOOK_FORBIDDEN"]);
            exit;
        }
    }

    $update = json_decode(file_get_contents('php://input'), true);
    if (!is_array($update)) {
        echo json_encode(["ok" => true]);
        exit;
    }

    $message = $update['message'] ?? $update['edited_message'] ?? null;
    $chatId = $message['chat']['id'] ?? null;
    $text = trim($message['text'] ?? '');

    if (!$chatId || $text === '') {
        echo json_encode(["ok" => true]);
        exit;
    }

    telegram_register_bot_commands_once();

    if (!is_telegram_admin_chat($chatId)) {
        send_telegram_message("<b>Unauthorized access blocked.</b>", $chatId);
        echo json_encode(["ok" => true]);
        exit;
    }

    $parts = preg_split('/\s+/', $text);
    $command = strtolower($parts[0] ?? '');
    $reply = '';
    $replyOptions = [];

    if ($command === '/start' || $command === '/help' || $command === '/commands') {
        $reply = telegram_admin_help_text();
        $replyOptions['reply_markup'] = telegram_quick_keyboard();
    } elseif ($command === '/health') {
        $orderCount = (int)$db->query("SELECT COUNT(*) FROM orders")->fetchColumn();
        $userCount = (int)$db->query("SELECT COUNT(*) FROM users")->fetchColumn();
        $reply = "<b>SPLARO Health</b>\n"
            . "Orders: {$orderCount}\n"
            . "Users: {$userCount}\n"
            . "Server Time: " . telegram_escape_html(date('Y-m-d H:i:s'));
    } elseif ($command === '/orders') {
        $limit = isset($parts[1]) ? (int)$parts[1] : 5;
        if ($limit < 1) $limit = 5;
        if ($limit > 20) $limit = 20;
        $rows = $db->query("SELECT id, customer_name, phone, total, status, created_at FROM orders ORDER BY created_at DESC LIMIT {$limit}")->fetchAll();
        if (!$rows) {
            $reply = "<b>No orders found.</b>";
        } else {
            $lines = ["<b>Latest {$limit} Orders</b>"];
            foreach ($rows as $row) {
                $lines[] = "• <b>" . telegram_escape_html($row['id']) . "</b> | "
                    . telegram_escape_html($row['status']) . " | ৳"
                    . telegram_escape_html($row['total']) . " | "
                    . telegram_escape_html($row['customer_name']);
            }
            $reply = implode("\n", $lines);
        }
    } elseif ($command === '/order') {
        $orderId = $parts[1] ?? '';
        if ($orderId === '') {
            $reply = "<b>Usage:</b> /order {order_id}";
        } else {
            $stmt = $db->prepare("SELECT * FROM orders WHERE id = ? LIMIT 1");
            $stmt->execute([$orderId]);
            $order = $stmt->fetch();
            if (!$order) {
                $reply = "<b>Order not found:</b> " . telegram_escape_html($orderId);
            } else {
                $reply = "<b>Order Details</b>\n" . telegram_order_summary($order)
                    . "\n<b>Address:</b> " . telegram_escape_html($order['address'] ?? 'N/A')
                    . "\n<b>District/Thana:</b> " . telegram_escape_html(($order['district'] ?? '') . " / " . ($order['thana'] ?? ''));
            }
        }
    } elseif ($command === '/setstatus') {
        $orderId = $parts[1] ?? '';
        $statusKey = strtoupper($parts[2] ?? '');
        $allowedStatuses = [
            'PENDING' => 'Pending',
            'PROCESSING' => 'Processing',
            'SHIPPED' => 'Shipped',
            'DELIVERED' => 'Delivered',
            'CANCELLED' => 'Cancelled'
        ];

        if ($orderId === '' || !isset($allowedStatuses[$statusKey])) {
            $reply = "<b>Usage:</b> /setstatus {order_id} {PENDING|PROCESSING|SHIPPED|DELIVERED|CANCELLED}";
        } else {
            $newStatus = $allowedStatuses[$statusKey];
            $stmt = $db->prepare("UPDATE orders SET status = ? WHERE id = ?");
            $stmt->execute([$newStatus, $orderId]);
            if ($stmt->rowCount() > 0) {
                sync_to_sheets('UPDATE_STATUS', ['id' => $orderId, 'status' => $newStatus]);
                $ip = $_SERVER['REMOTE_ADDR'] ?? 'TELEGRAM_WEBHOOK';
                $db->prepare("INSERT INTO system_logs (event_type, event_description, ip_address) VALUES (?, ?, ?)")
                    ->execute(['TELEGRAM_ADMIN_STATUS_UPDATE', "Order {$orderId} status updated to {$newStatus} via Telegram bot.", $ip]);
                $reply = "<b>Order status updated.</b>\nOrder: " . telegram_escape_html($orderId) . "\nStatus: " . telegram_escape_html($newStatus);
            } else {
                $reply = "<b>Order not found:</b> " . telegram_escape_html($orderId);
            }
        }
    } elseif ($command === '/users') {
        $limit = isset($parts[1]) ? (int)$parts[1] : 5;
        if ($limit < 1) $limit = 5;
        if ($limit > 20) $limit = 20;
        $rows = $db->query("SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC LIMIT {$limit}")->fetchAll();
        if (!$rows) {
            $reply = "<b>No users found.</b>";
        } else {
            $lines = ["<b>Latest {$limit} Users</b>"];
            foreach ($rows as $row) {
                $lines[] = "• <b>" . telegram_escape_html($row['name']) . "</b> | "
                    . telegram_escape_html($row['role']) . " | "
                    . telegram_escape_html($row['email']);
            }
            $reply = implode("\n", $lines);
        }
    } elseif ($command === '/maintenance') {
        $mode = strtolower($parts[1] ?? '');
        if ($mode !== 'on' && $mode !== 'off') {
            $reply = "<b>Usage:</b> /maintenance {on|off}";
        } else {
            $maintenance = $mode === 'on' ? 1 : 0;
            $stmt = $db->prepare("UPDATE site_settings SET maintenance_mode = ? WHERE id = 1");
            $stmt->execute([$maintenance]);
            $reply = "<b>Maintenance mode updated:</b> " . telegram_escape_html(strtoupper($mode));
        }
    } else {
        $reply = "<b>Unknown command.</b>\nUse /help to view available commands.";
    }

    send_telegram_message($reply, $chatId, $replyOptions);
    echo json_encode(["ok" => true]);
    exit;
}


// 1. DATA RETRIEVAL PROTOCOL
if ($method === 'GET' && $action === 'sync') {
    $isAdmin = is_admin_authenticated($requestAuthUser);
    $isUser = is_array($requestAuthUser) && strtoupper((string)($requestAuthUser['role'] ?? '')) === 'USER';
    $syncQueueProcess = null;

    $settings = $db->query("SELECT * FROM site_settings LIMIT 1")->fetch();
    if ($settings) {
        $settings['smtp_settings'] = json_decode($settings['smtp_settings'] ?? '[]', true);
        $settings['logistics_config'] = json_decode($settings['logistics_config'] ?? '[]', true);
        $settings['hero_slides'] = json_decode($settings['hero_slides'] ?? '[]', true);
        $settings['content_pages'] = json_decode($settings['content_pages'] ?? '{}', true);
        $settings['story_posts'] = json_decode($settings['story_posts'] ?? '[]', true);

        $settingsJson = safe_json_decode_assoc($settings['settings_json'] ?? '{}', []);
        $cmsDraft = cms_normalize_bundle($settingsJson['cmsDraft'] ?? $settingsJson['cms_draft'] ?? []);
        $cmsPublished = cms_normalize_bundle($settingsJson['cmsPublished'] ?? $settingsJson['cms_published'] ?? []);
        $cmsRevisions = cms_normalize_revisions($settingsJson['cmsRevisions'] ?? $settingsJson['cms_revisions'] ?? []);
        $cmsActiveVersion = strtoupper((string)($settingsJson['cmsActiveVersion'] ?? $settingsJson['cms_active_version'] ?? 'PUBLISHED'));
        if ($cmsActiveVersion !== 'DRAFT') {
            $cmsActiveVersion = 'PUBLISHED';
        }

        $cachedCms = !$isAdmin ? cms_cache_read(3600) : null;
        if (is_array($cachedCms)) {
            $cmsDraft = cms_normalize_bundle($cachedCms['cms_draft'] ?? $cmsDraft);
            $cmsPublished = cms_normalize_bundle($cachedCms['cms_published'] ?? $cmsPublished);
            $cmsRevisions = cms_normalize_revisions($cachedCms['cms_revisions'] ?? $cmsRevisions);
            $cachedActiveVersion = strtoupper((string)($cachedCms['cms_active_version'] ?? 'PUBLISHED'));
            $cmsActiveVersion = $cachedActiveVersion === 'DRAFT' ? 'DRAFT' : 'PUBLISHED';
        } else {
            try {
                $sectionStmt = $db->prepare("SELECT section_key, draft_json, published_json, status, updated_by, updated_at, published_at FROM page_sections WHERE section_key = ? LIMIT 1");
                $sectionStmt->execute(['storefront_cms']);
                $section = $sectionStmt->fetch();
                if ($section) {
                    $sectionDraft = cms_normalize_bundle(safe_json_decode_assoc($section['draft_json'] ?? '{}', []));
                    $sectionPublished = cms_normalize_bundle(safe_json_decode_assoc($section['published_json'] ?? '{}', []));
                    if (!empty($sectionDraft)) {
                        $cmsDraft = $sectionDraft;
                    }
                    if (!empty($sectionPublished)) {
                        $cmsPublished = $sectionPublished;
                    }
                    $sectionStatus = strtoupper((string)($section['status'] ?? 'PUBLISHED'));
                    if (in_array($sectionStatus, ['DRAFT', 'PUBLISHED'], true)) {
                        $cmsActiveVersion = $sectionStatus;
                    }
                }
            } catch (Exception $e) {
                error_log('SPLARO_CMS_SECTION_READ_FAILED: ' . $e->getMessage());
            }
            cms_cache_write([
                'cms_draft' => $cmsDraft,
                'cms_published' => $cmsPublished,
                'cms_revisions' => $cmsRevisions,
                'cms_active_version' => $cmsActiveVersion
            ]);
        }

        $settings['cms_draft'] = $cmsDraft;
        $settings['cms_published'] = $cmsPublished;
        $settings['cms_revisions'] = $cmsRevisions;
        $settings['cms_active_version'] = $cmsActiveVersion;
        $settings['cms_bundle'] = $cmsActiveVersion === 'DRAFT' ? $cmsDraft : $cmsPublished;
        $settings['settings_json'] = $settingsJson;

        if (!$isAdmin) {
            unset($settings['smtp_settings']);
            unset($settings['cms_draft']);
            unset($settings['cms_revisions']);
            unset($settings['settings_json']);
        }
    }

    $products = [];
    if (!$isAdmin && $method === 'GET' && $action === 'sync') {
        // Light sync for regular users: just active products with essential fields
        $products = $db->query("SELECT id, name, slug, brand, brand_slug, price, discount_price, discount_starts_at, discount_ends_at, image, main_image_id, category, category_slug, sub_category, sub_category_slug, type, description, sizes, colors, color_variants, materials, tags, featured, sku, barcode, stock, low_stock_threshold, status, hide_when_out_of_stock, weight, dimensions, variations, additional_images, size_chart_image, discount_percentage, product_url FROM products WHERE status = 'PUBLISHED' LIMIT 200")->fetchAll();
    } else {
        $products = $db->query("SELECT * FROM products")->fetchAll();
    }

    foreach ($products as &$p) {
        if (isset($p['description'])) $p['description'] = json_decode($p['description'], true) ?? ['EN' => '', 'BN' => ''];
        if (isset($p['sizes'])) $p['sizes'] = json_decode($p['sizes'], true) ?? [];
        if (isset($p['colors'])) $p['colors'] = json_decode($p['colors'], true) ?? [];
        if (isset($p['color_variants'])) $p['colorVariants'] = json_decode($p['color_variants'], true) ?? [];
        if (isset($p['materials'])) $p['materials'] = json_decode($p['materials'], true) ?? [];
        if (isset($p['tags'])) $p['tags'] = json_decode($p['tags'], true) ?? [];
        if (isset($p['dimensions'])) $p['dimensions'] = json_decode($p['dimensions'], true) ?? ['l'=>'', 'w'=>'', 'h'=>''];
        if (isset($p['variations'])) $p['variations'] = json_decode($p['variations'], true) ?? [];
        if (isset($p['additional_images'])) $p['additionalImages'] = json_decode($p['additional_images'], true) ?? [];
        if (isset($p['size_chart_image'])) $p['sizeChartImage'] = $p['size_chart_image'];
        if (isset($p['discount_percentage'])) $p['discountPercentage'] = $p['discount_percentage'];
        if (isset($p['featured'])) $p['featured'] = $p['featured'] == 1;
        if (isset($p['stock'])) $p['stock'] = (int)$p['stock'];
        if (array_key_exists('low_stock_threshold', $p) && $p['low_stock_threshold'] !== null && $p['low_stock_threshold'] !== '') {
            $p['lowStockThreshold'] = (int)$p['low_stock_threshold'];
        }
        
        if (isset($p['price'])) {
            $rawPrice = (string)$p['price'];
            $cleanPrice = preg_replace('/[^0-9]/', '', $rawPrice);
            $p['price'] = (int)$cleanPrice;
        }
        if (isset($p['discount_price']) && $p['discount_price'] !== null && $p['discount_price'] !== '') {
            $p['discountPrice'] = (int)$p['discount_price'];
        }
        if (isset($p['discount_starts_at'])) {
            $p['discountStartsAt'] = $p['discount_starts_at'];
        }
        if (isset($p['discount_ends_at'])) {
            $p['discountEndsAt'] = $p['discount_ends_at'];
        }
        if (isset($p['slug']) && trim((string)$p['slug']) !== '') {
            $p['productSlug'] = trim((string)$p['slug']);
        }
        if (isset($p['brand_slug'])) {
            $p['brandSlug'] = trim((string)$p['brand_slug']);
        }
        if (isset($p['category_slug'])) {
            $p['categorySlug'] = trim((string)$p['category_slug']);
        }
        if (isset($p['sub_category_slug'])) {
            $p['subCategorySlug'] = trim((string)$p['sub_category_slug']);
        }
        if (isset($p['main_image_id'])) {
            $p['mainImageId'] = trim((string)$p['main_image_id']);
        }
        if (isset($p['sub_category'])) {
            $p['subCategory'] = (string)$p['sub_category'];
        }
        if (isset($p['hide_when_out_of_stock'])) {
            $p['hideWhenOutOfStock'] = (int)$p['hide_when_out_of_stock'] === 1;
        }
        if (isset($p['status'])) {
            $p['status'] = strtoupper((string)$p['status']) === 'DRAFT' ? 'DRAFT' : 'PUBLISHED';
        }
        if (isset($p['product_url'])) {
            $p['liveUrl'] = (string)$p['product_url'];
        }
    }
    unset($p);

    $productImagesByProduct = [];
    try {
        if (!empty($products)) {
            $imageRows = $db->query("SELECT id, product_id, url, alt_text, sort_order, is_main, width, height, created_at FROM product_images ORDER BY product_id ASC, sort_order ASC, created_at ASC")->fetchAll();
            foreach ($imageRows as $row) {
                $pid = (string)($row['product_id'] ?? '');
                if ($pid === '') continue;
                if (!isset($productImagesByProduct[$pid])) {
                    $productImagesByProduct[$pid] = [];
                }
                $productImagesByProduct[$pid][] = [
                    'id' => (string)($row['id'] ?? ''),
                    'productId' => $pid,
                    'url' => (string)($row['url'] ?? ''),
                    'altText' => (string)($row['alt_text'] ?? ''),
                    'sortOrder' => isset($row['sort_order']) ? (int)$row['sort_order'] : 0,
                    'isMain' => isset($row['is_main']) ? ((int)$row['is_main'] === 1) : false,
                    'width' => isset($row['width']) && $row['width'] !== null ? (int)$row['width'] : null,
                    'height' => isset($row['height']) && $row['height'] !== null ? (int)$row['height'] : null,
                    'createdAt' => $row['created_at'] ?? null
                ];
            }

            foreach ($products as &$productRow) {
                $pid = (string)($productRow['id'] ?? '');
                $gallery = $productImagesByProduct[$pid] ?? [];
                if (!empty($gallery)) {
                    usort($gallery, function($a, $b) {
                        return ((int)($a['sortOrder'] ?? 0)) <=> ((int)($b['sortOrder'] ?? 0));
                    });
                    $productRow['galleryImages'] = $gallery;
                    $main = null;
                    foreach ($gallery as $img) {
                        if (!empty($img['isMain'])) {
                            $main = $img;
                            break;
                        }
                    }
                    if ($main === null) {
                        $main = $gallery[0];
                    }
                    if (!empty($main['url'])) {
                        $productRow['image'] = $main['url'];
                    }
                    $productRow['additionalImages'] = array_values(array_map(function($img) use ($main) {
                        if ($main && (string)$img['id'] === (string)$main['id']) return null;
                        return $img['url'] ?? null;
                    }, $gallery));
                    $productRow['additionalImages'] = array_values(array_filter($productRow['additionalImages'], function($url) {
                        return is_string($url) && trim($url) !== '';
                    }));
                }
            }
            unset($productRow);
        }
    } catch (Exception $e) {
        error_log('SPLARO_PRODUCT_IMAGE_SYNC_READ_FAILED: ' . $e->getMessage());
    }

    $orders = [];
    $users = [];
    $logs = [];
    $traffic = [];
    $meta = [];

    if ($isAdmin) {
        // Opportunistic background drain for pending sheet sync jobs.
        $syncQueueProcess = process_sync_queue($db, 5, false);

        $page = max(1, (int)($_GET['page'] ?? 1));
        $pageSize = (int)($_GET['pageSize'] ?? 30);
        if ($pageSize < 10) $pageSize = 10;
        if ($pageSize > 100) $pageSize = 100;
        $offset = ($page - 1) * $pageSize;

        $orderQuery = trim((string)($_GET['q'] ?? ''));
        $orderStatus = trim((string)($_GET['status'] ?? ''));

        $orderWhere = [];
        $orderParams = [];
        if ($orderQuery !== '') {
            $orderWhere[] = "(id LIKE ? OR customer_name LIKE ? OR customer_email LIKE ? OR phone LIKE ?)";
            $wild = '%' . $orderQuery . '%';
            $orderParams[] = $wild;
            $orderParams[] = $wild;
            $orderParams[] = $wild;
            $orderParams[] = $wild;
        }
        if ($orderStatus !== '') {
            $orderWhere[] = "status = ?";
            $orderParams[] = $orderStatus;
        }
        $orderWhereSql = $orderWhere ? ('WHERE ' . implode(' AND ', $orderWhere)) : '';

        $countStmt = $db->prepare("SELECT COUNT(*) FROM orders {$orderWhereSql}");
        $countStmt->execute($orderParams);
        $orderCount = (int)$countStmt->fetchColumn();

        $ordersStmt = $db->prepare("SELECT * FROM orders {$orderWhereSql} ORDER BY created_at DESC LIMIT {$pageSize} OFFSET {$offset}");
        $ordersStmt->execute($orderParams);
        $orders = $ordersStmt->fetchAll();

        $usersPage = max(1, (int)($_GET['usersPage'] ?? $page));
        $usersPageSize = (int)($_GET['usersPageSize'] ?? $pageSize);
        if ($usersPageSize < 10) $usersPageSize = 10;
        if ($usersPageSize > 100) $usersPageSize = 100;
        $usersOffset = ($usersPage - 1) * $usersPageSize;
        $userQuery = trim((string)($_GET['usersQ'] ?? $orderQuery));

        $userWhereSql = '';
        $userParams = [];
        if ($userQuery !== '') {
            $userWhereSql = "WHERE (name LIKE ? OR email LIKE ? OR phone LIKE ?)";
            $userWild = '%' . $userQuery . '%';
            $userParams = [$userWild, $userWild, $userWild];
        }

        $userCountStmt = $db->prepare("SELECT COUNT(*) FROM users {$userWhereSql}");
        $userCountStmt->execute($userParams);
        $userCount = (int)$userCountStmt->fetchColumn();

        $usersStmt = $db->prepare("SELECT id, name, email, phone, address, profile_image, role, created_at FROM users {$userWhereSql} ORDER BY created_at DESC LIMIT {$usersPageSize} OFFSET {$usersOffset}");
        $usersStmt->execute($userParams);
        $users = $usersStmt->fetchAll();

        $logs = $db->query("SELECT * FROM system_logs ORDER BY created_at DESC LIMIT 50")->fetchAll();
        $traffic = $db->query("SELECT * FROM traffic_metrics WHERE last_active > DATE_SUB(NOW(), INTERVAL 5 MINUTE) ORDER BY last_active DESC")->fetchAll();
        $meta = [
            'orders' => [
                'page' => $page,
                'pageSize' => $pageSize,
                'count' => $orderCount
            ],
            'users' => [
                'page' => $usersPage,
                'pageSize' => $usersPageSize,
                'count' => $userCount
            ],
            'syncQueue' => $syncQueueProcess,
            'syncQueueSummary' => get_sync_queue_summary($db)
        ];
    } elseif ($isUser && !empty($requestAuthUser['email'])) {
        $stmtOrders = $db->prepare("SELECT * FROM orders WHERE user_id = ? OR customer_email = ? ORDER BY created_at DESC");
        $stmtOrders->execute([$requestAuthUser['id'] ?: null, $requestAuthUser['email']]);
        $orders = $stmtOrders->fetchAll();

        // Return the current authenticated identity so frontend sync never wipes user state.
        $selfStmt = $db->prepare("SELECT id, name, email, phone, address, profile_image, role, created_at FROM users WHERE id = ? OR email = ? ORDER BY created_at DESC LIMIT 1");
        $selfStmt->execute([$requestAuthUser['id'] ?? '', $requestAuthUser['email']]);
        $self = $selfStmt->fetch();
        if ($self) {
            $users = [$self];
        }
    }

    $data = [
        'products' => $products,
        'orders'   => $orders,
        'users'    => $users,
        'settings' => $settings,
        'logs'     => $logs,
        'traffic'  => $traffic,
        'meta'     => $meta,
    ];
    echo json_encode([
        "status" => "success",
        "storage" => "mysql",
        "dbHost" => ($GLOBALS['SPLARO_DB_CONNECTED_HOST'] ?? DB_HOST),
        "dbName" => DB_NAME,
        "data" => $data
    ]);
    exit;
}

// 2. ORDER DEPLOYMENT PROTOCOL
if ($method === 'POST' && $action === 'create_order') {
    if (is_rate_limited('create_order', 10, 60)) {
        echo json_encode(["status" => "error", "message" => "RATE_LIMIT_EXCEEDED"]);
        exit;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input) {
        echo json_encode(["status" => "error", "message" => "INVALID_PAYLOAD"]);
        exit;
    }

    if (!empty(trim($input['website'] ?? ''))) {
        echo json_encode(["status" => "error", "message" => "SPAM_BLOCKED"]);
        exit;
    }

    if (!is_array($requestAuthUser) || empty($requestAuthUser['id'])) {
        http_response_code(401);
        echo json_encode(["status" => "error", "message" => "SIGNUP_REQUIRED"]);
        exit;
    }

    $resolvedUserId = $input['userId'] ?? null;
    if (is_array($requestAuthUser) && !empty($requestAuthUser['id'])) {
        $resolvedUserId = $requestAuthUser['id'];
        if (empty($input['customerEmail'])) {
            $input['customerEmail'] = $requestAuthUser['email'];
        }
    }

    $orderId = trim((string)($input['id'] ?? ''));
    if ($orderId === '') {
        $orderId = 'SPL-' . strtoupper(substr(bin2hex(random_bytes(4)), 0, 8));
    }
    $input['id'] = $orderId;

    try {
        $db->beginTransaction();
        $stmt = $db->prepare("INSERT INTO orders (id, user_id, customer_name, customer_email, phone, district, thana, address, items, total, status, customer_comment, shipping_fee, discount_amount, discount_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([
            $orderId,
            $resolvedUserId,
            $input['customerName'],
            $input['customerEmail'],
            $input['phone'],
            $input['district'] ?? '',
            $input['thana'] ?? '',
            $input['address'],
            json_encode($input['items']),
            $input['total'],
            $input['status'] ?? 'Pending',
            $input['customerComment'] ?? null,
            isset($input['shippingFee']) ? (int)$input['shippingFee'] : null,
            isset($input['discountAmount']) ? (int)$input['discountAmount'] : 0,
            $input['discountCode'] ?? null
        ]);
        $db->commit();
    } catch (Exception $e) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        error_log("SPLARO_ORDER_CREATE_FAILURE: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(["status" => "error", "message" => "ORDER_CREATE_FAILED"]);
        exit;
    }

    // SYNC TO GOOGLE SHEETS
    sync_to_sheets('ORDER', $input);

    $siteBase = ((isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http') . '://' . ($_SERVER['HTTP_HOST'] ?? '');
    $firstItem = $input['items'][0] ?? [];
    $firstProduct = $firstItem['product'] ?? [];
    $totalQuantity = 0;
    foreach (($input['items'] ?? []) as $lineItem) {
        $totalQuantity += (int)($lineItem['quantity'] ?? 0);
    }
    $productName = $firstProduct['name'] ?? ($firstItem['name'] ?? 'N/A');
    $productUrlRaw = $firstItem['productUrl'] ?? ($firstItem['url'] ?? '');
    if ($productUrlRaw === '' && !empty($firstProduct['liveUrl'])) {
        $productUrlRaw = (string)$firstProduct['liveUrl'];
    }
    if ($productUrlRaw === '') {
        $brandSlug = slugify_text($firstProduct['brandSlug'] ?? $firstProduct['brand'] ?? 'brand');
        $categorySlug = slugify_text($firstProduct['categorySlug'] ?? $firstProduct['category'] ?? 'category');
        $productSlug = slugify_text($firstProduct['productSlug'] ?? $firstProduct['slug'] ?? $firstProduct['id'] ?? $firstProduct['name'] ?? 'product');
        if (!empty($firstProduct['id']) || !empty($firstProduct['name'])) {
            $productUrlRaw = '/product/' . rawurlencode((string)$brandSlug) . '/' . rawurlencode((string)$categorySlug) . '/' . rawurlencode((string)$productSlug);
        }
    }
    if ($productUrlRaw && strpos($productUrlRaw, 'http') !== 0 && strpos($productUrlRaw, '/') === 0) {
        $productUrlRaw = $siteBase . $productUrlRaw;
    }
    $imageUrl = $firstProduct['image'] ?? ($firstItem['image'] ?? ($firstItem['imageUrl'] ?? 'N/A'));
    $notes = $input['customerComment'] ?? ($input['notes'] ?? 'N/A');

    $telegramOrderMessage = "<b>🛒 New Order</b>\n"
        . "<b>Order ID:</b> " . telegram_escape_html($input['id']) . "\n"
        . "<b>Time:</b> " . telegram_escape_html(date('Y-m-d H:i:s')) . "\n"
        . "<b>Name:</b> " . telegram_escape_html($input['customerName']) . "\n"
        . "<b>Phone:</b> " . telegram_escape_html($input['phone']) . "\n"
        . "<b>Email:</b> " . telegram_escape_html($input['customerEmail']) . "\n"
        . "<b>District/Thana:</b> " . telegram_escape_html(($input['district'] ?? '') . " / " . ($input['thana'] ?? '')) . "\n"
        . "<b>Address:</b> " . telegram_escape_html($input['address']) . "\n"
        . "<b>Product:</b> " . telegram_escape_html($productName) . "\n"
        . "<b>Product URL:</b> " . telegram_escape_html($productUrlRaw ?: 'N/A') . "\n"
        . "<b>Image URL:</b> " . telegram_escape_html($imageUrl) . "\n"
        . "<b>Quantity:</b> " . telegram_escape_html($totalQuantity) . "\n"
        . "<b>Notes:</b> " . telegram_escape_html($notes) . "\n"
        . "<b>Status:</b> PENDING";
    send_telegram_message($telegramOrderMessage);

    // CONSTRUCT LUXURY HTML INVOICE
    $items_html = '';
    foreach (($input['items'] ?? []) as $item) {
        $itemProduct = $item['product'] ?? [];
        $itemName = $itemProduct['name'] ?? ($item['name'] ?? 'N/A');
        $itemQuantity = (int)($item['quantity'] ?? 1);
        $itemPrice = (int)($itemProduct['price'] ?? ($item['price'] ?? 0));
        $items_html .= "
        <tr>
            <td style='padding: 12px; border-bottom: 1px solid #222; color: #ccc;'>{$itemName}</td>
            <td style='padding: 12px; border-bottom: 1px solid #222; color: #ccc; text-align: center;'>{$itemQuantity}</td>
            <td style='padding: 12px; border-bottom: 1px solid #222; color: #fff; text-align: right;'>৳" . number_format($itemPrice) . "</td>
        </tr>";
    }

    $invoice_body = "
    <div style='background: #fff; color: #000; font-family: \"Inter\", sans-serif; padding: 80px; max-width: 800px; margin: auto; border: 1px solid #111; box-shadow: 0 50px 100px rgba(0,0,0,0.1); border-radius: 40px;'>
        <!-- HEADER MANIFEST -->
        <div style='display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 80px; border-bottom: 3px solid #000; padding-bottom: 40px;'>
            <div>
                <h1 style='font-size: 48px; font-weight: 950; letter-spacing: -3px; margin: 0; text-transform: uppercase;'>SPLARO</h1>
                <p style='font-size: 10px; font-weight: 800; letter-spacing: 6px; color: #00cfd5; text-transform: uppercase; margin-top: 10px;'>Institutional Luxury Archive</p>
            </div>
            <div style='text-align: right;'>
                <p style='font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 3px; color: #888; margin-bottom: 8px;'>Shipment Manifest</p>
                <div style='font-size: 32px; font-weight: 900; color: #000; letter-spacing: -1px;'>#{$input['id']}</div>
            </div>
        </div>

        <!-- COLLECTOR METRICS -->
        <div style='display: grid; grid-template-columns: 1fr 1fr; gap: 60px; margin-bottom: 80px;'>
            <div>
                <p style='font-size: 9px; font-weight: 900; color: #aaa; text-transform: uppercase; letter-spacing: 4px; margin-bottom: 20px;'>Collector Identity</p>
                <p style='font-size: 20px; font-weight: 800; color: #000; margin: 0;'>{$input['customerName']}</p>
                <p style='font-size: 14px; color: #666; margin-top: 10px;'>{$input['customerEmail']}</p>
                <p style='font-size: 14px; color: #666; margin-top: 5px;'>{$input['phone']}</p>
            </div>
            <div style='text-align: right;'>
                <p style='font-size: 9px; font-weight: 900; color: #aaa; text-transform: uppercase; letter-spacing: 4px; margin-bottom: 20px;'>Deployment Sector</p>
                <p style='font-size: 16px; font-weight: 800; color: #000; line-height: 1.6;'>{$input['address']}</p>
                <p style='font-size: 12px; color: #888; text-transform: uppercase; font-weight: 900; margin-top: 15px; letter-spacing: 2px;'>{$input['thana']} • {$input['district']}</p>
            </div>
        </div>

        <!-- ASSET GRID -->
        <table style='width: 100%; border-collapse: collapse; margin-bottom: 80px;'>
            <thead>
                <tr style='border-bottom: 1px solid #eee;'>
                    <th style='text-align: left; padding: 25px 0; font-size: 11px; font-weight: 900; color: #aaa; text-transform: uppercase; letter-spacing: 3px;'>Institutional Asset</th>
                    <th style='text-align: center; padding: 25px 0; font-size: 11px; font-weight: 900; color: #aaa; text-transform: uppercase; letter-spacing: 3px;'>Qty</th>
                    <th style='text-align: right; padding: 25px 0; font-size: 11px; font-weight: 900; color: #aaa; text-transform: uppercase; letter-spacing: 3px;'>Valuation</th>
                </tr>
            </thead>
            <tbody>
                {$items_html}
            </tbody>
        </table>

        <!-- FISCAL SUMMARY -->
        <div style='background: #fdfdfd; padding: 50px; border-radius: 30px; border: 1px solid #eee;'>
            <div style='display: flex; justify-content: space-between; margin-bottom: 20px;'>
                <span style='font-size: 11px; font-weight: 900; color: #aaa; text-transform: uppercase; letter-spacing: 3px;'>Registry Subtotal</span>
                <span style='font-size: 16px; font-weight: 800; color: #000;'>৳" . number_format($input['total'] - ($input['shippingFee'] ?? 0) + ($input['discountAmount'] ?? 0)) . "</span>
            </div>
            " . ($input['discountAmount'] ? "
            <div style='display: flex; justify-content: space-between; margin-bottom: 20px; color: #ff3e3e;'>
                <span style='font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 3px;'>Protocol Discount ({$input['discountCode']})</span>
                <span style='font-size: 16px; font-weight: 800;'>-৳" . number_format($input['discountAmount']) . "</span>
            </div>" : "") . "
            <div style='display: flex; justify-content: space-between; border-bottom: 1px solid #eee; padding-bottom: 30px; margin-bottom: 30px;'>
                <span style='font-size: 11px; font-weight: 900; color: #aaa; text-transform: uppercase; letter-spacing: 3px;'>Logistics Manifest</span>
                <span style='font-size: 16px; font-weight: 800; color: #00cfd5;'>৳" . number_format($input['shippingFee'] ?? 0) . "</span>
            </div>
            <div style='display: flex; justify-content: space-between; align-items: center;'>
                <span style='font-size: 16px; font-weight: 900; color: #000; text-transform: uppercase; letter-spacing: 5px;'>TOTAL VALUATION</span>
                <span style='font-size: 48px; font-weight: 950; color: #000;'>৳" . number_format($input['total']) . "</span>
            </div>
        </div>

        <div style='margin-top: 80px; text-align: center; opacity: 0.5;'>
            <p style='font-size: 10px; font-weight: 900; color: #aaa; text-transform: uppercase; letter-spacing: 5px;'>Official Authenticity Signature • Chief Archivist of Splaro</p>
        </div>
    </div>";

    // TRIGGER EMAIL NOTIFICATION (ORDER)
    $smtpConfig = load_smtp_settings($db);
    $adminRecipient = $smtpConfig['user'] ?? SMTP_USER;
    $adminMail = smtp_send_mail($db, $adminRecipient, "ADMIN NOTIFY: NEW ORDER " . $input['id'], $invoice_body, true);
    $customerMail = smtp_send_mail($db, $input['customerEmail'], "INVOICE: Your Splaro Order #" . $input['id'], $invoice_body, true);

    echo json_encode([
        "status" => "success",
        "message" => ($adminMail && $customerMail) ? "INVOICE_DISPATCHED" : "ORDER_PLACED_EMAIL_PENDING",
        "email" => ["admin" => $adminMail, "customer" => $customerMail]
    ]);
    exit;
}

// 2.1 LOGISTICS UPDATE PROTOCOL
if ($method === 'POST' && $action === 'update_order_status') {
    require_admin_access($requestAuthUser);
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($input['id']) || !isset($input['status'])) {
        echo json_encode(["status" => "error", "message" => "MISSING_PARAMETERS"]);
        exit;
    }

    $stmt = $db->prepare("UPDATE orders SET status = ? WHERE id = ?");
    $stmt->execute([$input['status'], $input['id']]);

    // SYNC TO GOOGLE SHEETS
    sync_to_sheets('UPDATE_STATUS', $input);

    // Log the event
    $ip = $_SERVER['REMOTE_ADDR'];
    $db->prepare("INSERT INTO system_logs (event_type, event_description, ip_address) VALUES (?, ?, ?)")
       ->execute(['LOGISTICS_UPDATE', "Order " . $input['id'] . " status updated to " . $input['status'], $ip]);

    $telegramStatusMessage = "<b>📦 Order Status Updated</b>\n"
        . "<b>Order ID:</b> " . telegram_escape_html($input['id']) . "\n"
        . "<b>New Status:</b> " . telegram_escape_html($input['status']) . "\n"
        . "<b>Time:</b> " . telegram_escape_html(date('Y-m-d H:i:s'));
    send_telegram_message($telegramStatusMessage);

    echo json_encode(["status" => "success", "message" => "STATUS_SYNCHRONIZED"]);
    exit;
}

// 2.2 REGISTRY ERASURE PROTOCOL
if ($method === 'POST' && $action === 'delete_order') {
    require_admin_access($requestAuthUser);
    $input = json_decode(file_get_contents('php://input'), true);
    if (isset($input['id'])) {
        $stmt = $db->prepare("DELETE FROM orders WHERE id = ?");
        $stmt->execute([$input['id']]);
        sync_to_sheets('DELETE_ORDER', $input);

        // Security Protocol: Log the erasure
        $ip = $_SERVER['REMOTE_ADDR'];
        $db->prepare("INSERT INTO system_logs (event_type, event_description, ip_address) VALUES (?, ?, ?)")
           ->execute(['REGISTRY_ERASURE', "Order " . $input['id'] . " was purged from the archive.", $ip]);

        echo json_encode(["status" => "success"]);
    }
    exit;
}

// 3. PRODUCT SYCHRONIZATION
if ($method === 'POST' && $action === 'sync_products') {
    require_admin_access($requestAuthUser);
    try {
        $payload = json_decode(file_get_contents('php://input'), true);
        $products = $payload['products'] ?? $payload;
        $purgeMissing = !empty($payload['purgeMissing']);

        if (!is_array($products)) {
            echo json_encode(["status" => "error", "message" => "INVALID_PRODUCT_PAYLOAD"]);
            exit;
        }

        $upsert = $db->prepare("INSERT INTO products 
            (id, name, slug, brand, brand_slug, price, discount_price, discount_starts_at, discount_ends_at, image, main_image_id, category, category_slug, type, description, sizes, colors, color_variants, materials, tags, featured, sku, barcode, stock, low_stock_threshold, status, hide_when_out_of_stock, weight, dimensions, variations, additional_images, size_chart_image, discount_percentage, sub_category, sub_category_slug, product_url) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                name = VALUES(name),
                slug = VALUES(slug),
                brand = VALUES(brand),
                brand_slug = VALUES(brand_slug),
                price = VALUES(price),
                discount_price = VALUES(discount_price),
                discount_starts_at = VALUES(discount_starts_at),
                discount_ends_at = VALUES(discount_ends_at),
                image = VALUES(image),
                main_image_id = VALUES(main_image_id),
                category = VALUES(category),
                category_slug = VALUES(category_slug),
                type = VALUES(type),
                description = VALUES(description),
                sizes = VALUES(sizes),
                colors = VALUES(colors),
                color_variants = VALUES(color_variants),
                materials = VALUES(materials),
                tags = VALUES(tags),
                featured = VALUES(featured),
                sku = VALUES(sku),
                barcode = VALUES(barcode),
                stock = VALUES(stock),
                low_stock_threshold = VALUES(low_stock_threshold),
                status = VALUES(status),
                hide_when_out_of_stock = VALUES(hide_when_out_of_stock),
                weight = VALUES(weight),
                dimensions = VALUES(dimensions),
                variations = VALUES(variations),
                additional_images = VALUES(additional_images),
                size_chart_image = VALUES(size_chart_image),
                discount_percentage = VALUES(discount_percentage),
                sub_category = VALUES(sub_category),
                sub_category_slug = VALUES(sub_category_slug),
                product_url = VALUES(product_url)");

        $existingStmt = $db->prepare("SELECT id, price, status, image FROM products WHERE id = ? LIMIT 1");
        $slugLookupStmt = $db->prepare("SELECT id FROM products WHERE slug = ? AND id <> ? LIMIT 1");
        $deleteImagesStmt = $db->prepare("DELETE FROM product_images WHERE product_id = ?");
        $insertImageStmt = $db->prepare("INSERT INTO product_images (id, product_id, url, alt_text, sort_order, is_main, width, height) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");

        $db->beginTransaction();
        $incomingIds = [];
        $seenSlugs = [];
        foreach ($products as $p) {
            if (empty($p['id']) || empty($p['name']) || empty($p['brand']) || !isset($p['price']) || empty($p['category']) || empty($p['type'])) {
                throw new RuntimeException('PRODUCT_REQUIRED_FIELDS_MISSING');
            }

            $productId = (string)$p['id'];
            $incomingIds[] = $productId;
            $existingStmt->execute([$productId]);
            $existing = $existingStmt->fetch();

            $baseProductSlug = slugify_text($p['productSlug'] ?? $p['slug'] ?? $p['name'] ?? $productId);
            $productSlug = $baseProductSlug;
            $slugSuffix = 2;
            while (in_array($productSlug, $seenSlugs, true)) {
                $productSlug = $baseProductSlug . '-' . $slugSuffix;
                $slugSuffix++;
            }
            while (true) {
                $slugLookupStmt->execute([$productSlug, $productId]);
                $slugConflict = $slugLookupStmt->fetch();
                if (!$slugConflict) break;
                $productSlug = $baseProductSlug . '-' . $slugSuffix;
                $slugSuffix++;
            }
            $seenSlugs[] = $productSlug;
            $brandSlug = slugify_text($p['brandSlug'] ?? $p['brand_slug'] ?? $p['brand'] ?? 'brand');
            $categorySlug = slugify_text($p['categorySlug'] ?? $p['category_slug'] ?? $p['category'] ?? 'category');
            $subCategory = trim((string)($p['subCategory'] ?? $p['sub_category'] ?? ''));
            $subCategorySlug = $subCategory !== '' ? slugify_text($p['subCategorySlug'] ?? $p['sub_category_slug'] ?? $subCategory) : null;
            $status = strtoupper((string)($p['status'] ?? 'PUBLISHED')) === 'DRAFT' ? 'DRAFT' : 'PUBLISHED';
            $hideWhenOutOfStock = !empty($p['hideWhenOutOfStock']) ? 1 : 0;

            $galleryImages = [];
            if (is_array($p['galleryImages'] ?? null)) {
                foreach (($p['galleryImages'] ?? []) as $idx => $img) {
                    $url = trim((string)($img['url'] ?? ''));
                    if ($url === '') continue;
                    $galleryImages[] = [
                        'id' => trim((string)($img['id'] ?? '')) ?: ('img_' . substr(bin2hex(random_bytes(6)), 0, 12)),
                        'url' => $url,
                        'altText' => trim((string)($img['altText'] ?? $img['alt_text'] ?? $p['name'] ?? '')),
                        'sortOrder' => isset($img['sortOrder']) ? (int)$img['sortOrder'] : (isset($img['sort_order']) ? (int)$img['sort_order'] : $idx),
                        'isMain' => !empty($img['isMain']) || !empty($img['is_main']),
                        'width' => isset($img['width']) ? (int)$img['width'] : null,
                        'height' => isset($img['height']) ? (int)$img['height'] : null
                    ];
                }
            }
            if (empty($galleryImages)) {
                $fallbackMain = trim((string)($p['image'] ?? ''));
                if ($fallbackMain !== '') {
                    $galleryImages[] = [
                        'id' => trim((string)($p['mainImageId'] ?? '')) ?: ('img_' . substr(bin2hex(random_bytes(6)), 0, 12)),
                        'url' => $fallbackMain,
                        'altText' => trim((string)($p['name'] ?? '')),
                        'sortOrder' => 0,
                        'isMain' => true,
                        'width' => null,
                        'height' => null
                    ];
                }
                if (is_array($p['additionalImages'] ?? null)) {
                    foreach (($p['additionalImages'] ?? []) as $idx => $urlRaw) {
                        $url = trim((string)$urlRaw);
                        if ($url === '') continue;
                        $galleryImages[] = [
                            'id' => 'img_' . substr(bin2hex(random_bytes(6)), 0, 12),
                            'url' => $url,
                            'altText' => trim((string)($p['name'] ?? '')),
                            'sortOrder' => $idx + 1,
                            'isMain' => false,
                            'width' => null,
                            'height' => null
                        ];
                    }
                }
            }

            usort($galleryImages, function($a, $b) {
                return ((int)$a['sortOrder']) <=> ((int)$b['sortOrder']);
            });
            $mainImage = null;
            foreach ($galleryImages as $img) {
                if (!empty($img['isMain'])) {
                    $mainImage = $img;
                    break;
                }
            }
            if ($mainImage === null && !empty($galleryImages)) {
                $mainImage = $galleryImages[0];
                $mainImage['isMain'] = true;
            }
            $mainImageUrl = $mainImage['url'] ?? trim((string)($p['image'] ?? ''));
            $mainImageId = $mainImage['id'] ?? (trim((string)($p['mainImageId'] ?? '')) ?: null);

            $additionalImages = array_values(array_filter(array_map(function($img) use ($mainImageId) {
                if ($mainImageId !== null && (string)($img['id'] ?? '') === (string)$mainImageId) return null;
                return $img['url'] ?? null;
            }, $galleryImages), function($url) {
                return is_string($url) && trim($url) !== '';
            }));

            $productUrl = trim((string)($p['liveUrl'] ?? $p['productUrl'] ?? $p['product_url'] ?? ''));
            if ($productUrl === '') {
                $productUrl = build_product_live_url($brandSlug, $categorySlug, $productSlug);
            }

            $upsert->execute([
                $productId,
                $p['name'],
                $productSlug,
                $p['brand'],
                $brandSlug,
                $p['price'],
                isset($p['discountPrice']) && $p['discountPrice'] !== '' ? (int)$p['discountPrice'] : (isset($p['discount_price']) && $p['discount_price'] !== '' ? (int)$p['discount_price'] : null),
                !empty($p['discountStartsAt']) ? (string)$p['discountStartsAt'] : (!empty($p['discount_starts_at']) ? (string)$p['discount_starts_at'] : null),
                !empty($p['discountEndsAt']) ? (string)$p['discountEndsAt'] : (!empty($p['discount_ends_at']) ? (string)$p['discount_ends_at'] : null),
                $mainImageUrl,
                $mainImageId,
                $p['category'],
                $categorySlug,
                $p['type'],
                json_encode($p['description'] ?? []),
                json_encode($p['sizes'] ?? []),
                json_encode($p['colors'] ?? []),
                json_encode($p['colorVariants'] ?? ($p['color_variants'] ?? [])),
                json_encode($p['materials'] ?? []),
                json_encode($p['tags'] ?? []),
                ($p['featured'] ?? false) ? 1 : 0,
                $p['sku'] ?? null,
                $p['barcode'] ?? null,
                $p['stock'] ?? 50,
                isset($p['lowStockThreshold']) && $p['lowStockThreshold'] !== '' ? max(0, (int)$p['lowStockThreshold']) : (isset($p['low_stock_threshold']) && $p['low_stock_threshold'] !== '' ? max(0, (int)$p['low_stock_threshold']) : null),
                $status,
                $hideWhenOutOfStock,
                $p['weight'] ?? null,
                json_encode($p['dimensions'] ?? []),
                json_encode($p['variations'] ?? []),
                json_encode($additionalImages),
                $p['sizeChartImage'] ?? null,
                $p['discountPercentage'] ?? null,
                $subCategory !== '' ? $subCategory : null,
                $subCategorySlug,
                $productUrl
            ]);

            $deleteImagesStmt->execute([$productId]);
            foreach ($galleryImages as $idx => $img) {
                $imgId = trim((string)($img['id'] ?? ''));
                $imgUrl = trim((string)($img['url'] ?? ''));
                if ($imgId === '' || $imgUrl === '') continue;
                $insertImageStmt->execute([
                    $imgId,
                    $productId,
                    $imgUrl,
                    trim((string)($img['altText'] ?? '')) ?: trim((string)($p['name'] ?? '')),
                    isset($img['sortOrder']) ? (int)$img['sortOrder'] : $idx,
                    ($mainImageId !== null && (string)$imgId === (string)$mainImageId) ? 1 : (!empty($img['isMain']) ? 1 : 0),
                    isset($img['width']) && $img['width'] !== null ? (int)$img['width'] : null,
                    isset($img['height']) && $img['height'] !== null ? (int)$img['height'] : null
                ]);
            }

            $actorId = (string)($requestAuthUser['id'] ?? $requestAuthUser['email'] ?? 'admin');
            $ipAddress = $_SERVER['REMOTE_ADDR'] ?? 'UNKNOWN';
            if ($existing) {
                audit_log_insert($db, $actorId, 'PRODUCT_UPDATED', 'PRODUCT', $productId, $existing, [
                    'name' => $p['name'],
                    'price' => $p['price'],
                    'status' => $status,
                    'slug' => $productSlug
                ], $ipAddress);
                if ((int)($existing['price'] ?? 0) !== (int)$p['price']) {
                    audit_log_insert($db, $actorId, 'PRICE_CHANGED', 'PRODUCT', $productId, ['price' => (int)($existing['price'] ?? 0)], ['price' => (int)$p['price']], $ipAddress);
                }
                if (strtoupper((string)($existing['status'] ?? 'PUBLISHED')) !== $status) {
                    audit_log_insert($db, $actorId, $status === 'PUBLISHED' ? 'PUBLISHED' : 'UNPUBLISHED', 'PRODUCT', $productId, ['status' => (string)($existing['status'] ?? 'PUBLISHED')], ['status' => $status], $ipAddress);
                }
                audit_log_insert($db, $actorId, 'IMAGES_UPDATED', 'PRODUCT', $productId, null, ['mainImageId' => $mainImageId, 'count' => count($galleryImages)], $ipAddress);
            } else {
                audit_log_insert($db, $actorId, 'PRODUCT_CREATED', 'PRODUCT', $productId, null, [
                    'name' => $p['name'],
                    'price' => $p['price'],
                    'status' => $status,
                    'slug' => $productSlug
                ], $ipAddress);
            }
        }

        if ($purgeMissing && !empty($incomingIds)) {
            $placeholders = implode(',', array_fill(0, count($incomingIds), '?'));
            $deleteStmt = $db->prepare("DELETE FROM products WHERE id NOT IN ({$placeholders})");
            $deleteStmt->execute($incomingIds);
        }

        $db->commit();
        echo json_encode(["status" => "success", "message" => "PRODUCT_MANIFEST_UPDATED"]);
    } catch (Exception $e) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        error_log("SPLARO_PRODUCT_SYNC_FAILURE: " . $e->getMessage());
        echo json_encode(["status" => "error", "message" => "PRODUCT_SYNC_FAILED"]);
    }
    exit;
}

// 3.1 PRODUCT MEDIA UPLOAD (ADMIN)
if ($method === 'POST' && $action === 'upload_product_image') {
    require_admin_access($requestAuthUser);
    try {
        if (!isset($_FILES['image']) || !is_array($_FILES['image'])) {
            echo json_encode(["status" => "error", "message" => "IMAGE_REQUIRED"]);
            exit;
        }

        $file = $_FILES['image'];
        if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            echo json_encode(["status" => "error", "message" => "UPLOAD_FAILED"]);
            exit;
        }

        $maxBytes = 6 * 1024 * 1024; // 6MB
        if ((int)($file['size'] ?? 0) > $maxBytes) {
            echo json_encode(["status" => "error", "message" => "IMAGE_TOO_LARGE"]);
            exit;
        }

        $tmpPath = (string)($file['tmp_name'] ?? '');
        $mime = function_exists('mime_content_type') ? (string)mime_content_type($tmpPath) : '';
        $allowed = [
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
            'image/webp' => 'webp',
            'image/avif' => 'avif'
        ];
        if (!isset($allowed[$mime])) {
            echo json_encode(["status" => "error", "message" => "INVALID_IMAGE_TYPE"]);
            exit;
        }

        $ext = $allowed[$mime];
        $uploadRoot = rtrim((string)($_SERVER['DOCUMENT_ROOT'] ?? dirname(__DIR__)), '/\\') . '/uploads/products';
        if (!is_dir($uploadRoot)) {
            @mkdir($uploadRoot, 0755, true);
        }
        if (!is_dir($uploadRoot) || !is_writable($uploadRoot)) {
            echo json_encode(["status" => "error", "message" => "UPLOAD_PATH_NOT_WRITABLE"]);
            exit;
        }

        $fileName = 'prd_' . date('Ymd_His') . '_' . substr(bin2hex(random_bytes(6)), 0, 12) . '.' . $ext;
        $destPath = $uploadRoot . '/' . $fileName;
        if (!move_uploaded_file($tmpPath, $destPath)) {
            echo json_encode(["status" => "error", "message" => "UPLOAD_MOVE_FAILED"]);
            exit;
        }

        $relative = '/uploads/products/' . $fileName;
        $origin = trim((string)env_or_default('APP_ORIGIN', ''));
        $publicUrl = $origin !== '' ? rtrim($origin, '/') . $relative : $relative;

        $dimensions = @getimagesize($destPath);
        $width = is_array($dimensions) ? (int)($dimensions[0] ?? 0) : 0;
        $height = is_array($dimensions) ? (int)($dimensions[1] ?? 0) : 0;

        audit_log_insert(
            $db,
            (string)($requestAuthUser['id'] ?? $requestAuthUser['email'] ?? 'admin'),
            'IMAGES_UPDATED',
            'PRODUCT_MEDIA',
            $fileName,
            null,
            ['url' => $publicUrl, 'width' => $width, 'height' => $height],
            $_SERVER['REMOTE_ADDR'] ?? 'UNKNOWN'
        );

        echo json_encode([
            "status" => "success",
            "message" => "IMAGE_UPLOADED",
            "data" => [
                "url" => $publicUrl,
                "relative_url" => $relative,
                "width" => $width,
                "height" => $height
            ]
        ]);
    } catch (Exception $e) {
        error_log("SPLARO_IMAGE_UPLOAD_FAILED: " . $e->getMessage());
        echo json_encode(["status" => "error", "message" => "IMAGE_UPLOAD_FAILED"]);
    }
    exit;
}

// 4. IDENTITY AUTHENTICATION (SIGNUP / SOCIAL SYNC)
if ($method === 'POST' && $action === 'signup') {
    if (is_rate_limited('signup', 8, 60)) {
        echo json_encode(["status" => "error", "message" => "RATE_LIMIT_EXCEEDED"]);
        exit;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    if (!is_array($input)) {
        echo json_encode(["status" => "error", "message" => "INVALID_PAYLOAD"]);
        exit;
    }

    if (!empty(trim($input['website'] ?? ''))) {
        echo json_encode(["status" => "error", "message" => "SPAM_BLOCKED"]);
        exit;
    }

    $email = strtolower(trim($input['email'] ?? ''));
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        echo json_encode(["status" => "error", "message" => "INVALID_EMAIL"]);
        exit;
    }

    $name = trim((string)($input['name'] ?? ''));
    if ($name === '') {
        $name = build_display_name_from_email($email);
    }

    $phone = trim((string)($input['phone'] ?? ''));
    if ($phone === '') {
        $phone = 'N/A';
    }
    $address = trim((string)($input['address'] ?? ''));
    $profileImage = trim((string)($input['profileImage'] ?? ($input['profile_image'] ?? '')));

    $password = (string)($input['password'] ?? '');
    if ($password === '' && isset($input['google_sub'])) {
        $password = 'social_auth_sync';
    }
    if ($password === '' && !isset($input['google_sub'])) {
        echo json_encode(["status" => "error", "message" => "PASSWORD_REQUIRED"]);
        exit;
    }
    if ($password !== 'social_auth_sync' && !is_strong_password($password)) {
        echo json_encode(["status" => "error", "message" => "WEAK_PASSWORD"]);
        exit;
    }
    if ($password === 'social_auth_sync') {
        $password = password_hash(bin2hex(random_bytes(16)), PASSWORD_DEFAULT);
    } else {
        $password = password_hash($password, PASSWORD_DEFAULT);
    }

    $role = strtoupper(trim((string)($input['role'] ?? 'USER')));
    if (!in_array($role, ['USER', 'ADMIN', 'SUPER_ADMIN', 'EDITOR', 'VIEWER'], true)) {
        $role = 'USER';
    }
    if (in_array($role, ['ADMIN', 'SUPER_ADMIN', 'EDITOR', 'VIEWER'], true)) {
        $adminKeyHeader = trim((string)get_header_value('X-Admin-Key'));
        if (ADMIN_KEY === '' || !hash_equals(ADMIN_KEY, $adminKeyHeader)) {
            $role = 'USER';
        }
    }

    $isAdminIdentity = is_admin_login_email($email, $db);
    if ($isAdminIdentity) {
        if (!in_array($role, ['SUPER_ADMIN', 'EDITOR', 'VIEWER'], true)) {
            $role = 'ADMIN';
        }
    }

    $id = trim((string)($input['id'] ?? ''));
    if ($id === '') {
        $id = generate_public_user_id();
    }

    $usersHasDefaultShipping = column_exists($db, 'users', 'default_shipping_address');
    $usersHasNotificationEmail = column_exists($db, 'users', 'notification_email');
    $usersHasNotificationSms = column_exists($db, 'users', 'notification_sms');
    $usersHasPreferredLanguage = column_exists($db, 'users', 'preferred_language');
    $usersHasTwoFactorEnabled = column_exists($db, 'users', 'two_factor_enabled');
    $usersHasForceRelogin = column_exists($db, 'users', 'force_relogin');
    $usersHasLastPasswordChange = column_exists($db, 'users', 'last_password_change_at');

    $check = $db->prepare("SELECT * FROM users WHERE email = ?");
    $check->execute([$email]);
    $existing = $check->fetch();

    if ($existing) {
        // If it's a social auth sync or the user is already authenticated as this email, allow update.
        // Otherwise, prevent overwriting existing accounts via signup.
        $isAuthenticated = false;
        if (is_array($requestAuthUser) && strtolower((string)($requestAuthUser['email'] ?? '')) === $email) {
            $isAuthenticated = true;
        }

        if (!$isAuthenticated && !isset($input['google_sub'])) {
            echo json_encode(["status" => "error", "message" => "IDENTITY_ALREADY_EXISTS"]);
            exit;
        }
        $existingRole = strtoupper((string)($existing['role'] ?? 'USER'));
        $persistRole = $existingRole;
        if ($isAdminIdentity || in_array($existingRole, ['ADMIN', 'SUPER_ADMIN', 'EDITOR', 'VIEWER'], true)) {
            $persistRole = in_array($role, ['SUPER_ADMIN', 'EDITOR', 'VIEWER'], true) ? $role : $existingRole;
            if (!in_array($persistRole, ['ADMIN', 'SUPER_ADMIN', 'EDITOR', 'VIEWER'], true)) {
                $persistRole = 'ADMIN';
            }
        } elseif (in_array($role, ['ADMIN', 'SUPER_ADMIN', 'EDITOR', 'VIEWER'], true)) {
            $persistRole = $role;
        } elseif (in_array($existingRole, ['USER'], true)) {
            $persistRole = 'USER';
        }

        $preferredLanguage = strtoupper(trim((string)($input['preferredLanguage'] ?? ($existing['preferred_language'] ?? 'EN'))));
        if (!in_array($preferredLanguage, ['EN', 'BN'], true)) {
            $preferredLanguage = 'EN';
        }
        $notificationEmail = array_key_exists('notificationEmail', $input) ? (!empty($input['notificationEmail']) ? 1 : 0) : (int)($existing['notification_email'] ?? 1);
        $notificationSms = array_key_exists('notificationSms', $input) ? (!empty($input['notificationSms']) ? 1 : 0) : (int)($existing['notification_sms'] ?? 0);
        $defaultShippingAddress = trim((string)($input['defaultShippingAddress'] ?? ($existing['default_shipping_address'] ?? '')));

        $updateParts = [
            "name = ?",
            "phone = ?",
            "address = ?",
            "profile_image = ?",
            "role = ?"
        ];
        $updateValues = [
            $name,
            $phone,
            $address !== '' ? $address : ($existing['address'] ?? null),
            $profileImage !== '' ? $profileImage : ($existing['profile_image'] ?? null),
            $persistRole
        ];

        if ($usersHasDefaultShipping) {
            $updateParts[] = "default_shipping_address = ?";
            $updateValues[] = $defaultShippingAddress !== '' ? $defaultShippingAddress : ($existing['default_shipping_address'] ?? null);
        }
        if ($usersHasNotificationEmail) {
            $updateParts[] = "notification_email = ?";
            $updateValues[] = $notificationEmail;
        }
        if ($usersHasNotificationSms) {
            $updateParts[] = "notification_sms = ?";
            $updateValues[] = $notificationSms;
        }
        if ($usersHasPreferredLanguage) {
            $updateParts[] = "preferred_language = ?";
            $updateValues[] = $preferredLanguage;
        }

        $updateValues[] = $existing['id'];
        $update = $db->prepare("UPDATE users SET " . implode(', ', $updateParts) . " WHERE id = ?");
        $update->execute($updateValues);
        $refetch = $db->prepare("SELECT * FROM users WHERE id = ? LIMIT 1");
        $refetch->execute([$existing['id']]);
        $existing = $refetch->fetch();
        $safeExisting = sanitize_user_payload($existing);
        $token = issue_auth_token($safeExisting);
        if (isset($input['google_sub'])) {
            sync_to_sheets('SIGNUP', $safeExisting);
        }
        $csrfToken = refresh_csrf_token();
        echo json_encode(["status" => "success", "user" => $safeExisting, "token" => $token, "csrf_token" => $csrfToken]);
        exit;
    }

    $preferredLanguage = strtoupper(trim((string)($input['preferredLanguage'] ?? 'EN')));
    if (!in_array($preferredLanguage, ['EN', 'BN'], true)) {
        $preferredLanguage = 'EN';
    }
    $defaultShippingAddress = trim((string)($input['defaultShippingAddress'] ?? $address));
    $notificationEmail = array_key_exists('notificationEmail', $input) ? (!empty($input['notificationEmail']) ? 1 : 0) : 1;
    $notificationSms = array_key_exists('notificationSms', $input) ? (!empty($input['notificationSms']) ? 1 : 0) : 0;
    $nowIso = date('Y-m-d H:i:s');

    $insertColumns = ['id', 'name', 'email', 'phone', 'address', 'profile_image', 'password', 'role'];
    $insertValues = [
        $id,
        $name,
        $email,
        $phone,
        $address !== '' ? $address : null,
        $profileImage !== '' ? $profileImage : null,
        $password,
        $role
    ];

    if ($usersHasDefaultShipping) {
        $insertColumns[] = 'default_shipping_address';
        $insertValues[] = $defaultShippingAddress !== '' ? $defaultShippingAddress : null;
    }
    if ($usersHasNotificationEmail) {
        $insertColumns[] = 'notification_email';
        $insertValues[] = $notificationEmail;
    }
    if ($usersHasNotificationSms) {
        $insertColumns[] = 'notification_sms';
        $insertValues[] = $notificationSms;
    }
    if ($usersHasPreferredLanguage) {
        $insertColumns[] = 'preferred_language';
        $insertValues[] = $preferredLanguage;
    }
    if ($usersHasTwoFactorEnabled) {
        $insertColumns[] = 'two_factor_enabled';
        $insertValues[] = 0;
    }
    if ($usersHasForceRelogin) {
        $insertColumns[] = 'force_relogin';
        $insertValues[] = 0;
    }
    if ($usersHasLastPasswordChange) {
        $insertColumns[] = 'last_password_change_at';
        $insertValues[] = $nowIso;
    }

    $insertPlaceholders = implode(', ', array_fill(0, count($insertColumns), '?'));
    $stmt = $db->prepare("INSERT INTO users (" . implode(', ', $insertColumns) . ") VALUES (" . $insertPlaceholders . ")");
    $stmt->execute($insertValues);

    $fetchCreated = $db->prepare("SELECT * FROM users WHERE id = ? LIMIT 1");
    $fetchCreated->execute([$id]);
    $createdUser = $fetchCreated->fetch();
    $userPayload = sanitize_user_payload($createdUser ?: [
        'id' => $id,
        'name' => $name,
        'email' => $email,
        'phone' => $phone,
        'address' => $address,
        'profile_image' => $profileImage,
        'role' => $role,
        'created_at' => date('c')
    ]);
    $token = issue_auth_token($userPayload);

    // SYNC TO GOOGLE SHEETS
    sync_to_sheets('SIGNUP', $userPayload);

    // TRIGGER EMAIL NOTIFICATION (SIGNUP)
    $subject = "New Signup: " . $name;
    $message = "A new account has been created on SPLARO.

Name: " . $name . "
Email: " . $email . "
Phone: " . $phone;
    $smtpConfig = load_smtp_settings($db);
    $adminRecipient = trim((string)($smtpConfig['user'] ?? SMTP_USER));
    $adminMail = false;
    if ($adminRecipient !== '' && filter_var($adminRecipient, FILTER_VALIDATE_EMAIL)) {
        $adminMail = smtp_send_mail($db, $adminRecipient, $subject, nl2br($message), true);
    }

    $welcomeSubject = "Congratulations! Welcome to SPLARO";
    $welcomeBody = "
    <div style='font-family: Inter, Arial, sans-serif; max-width: 620px; margin: 0 auto; padding: 28px; color: #101828;'>
      <h2 style='margin: 0 0 14px; font-size: 26px; letter-spacing: -0.3px;'>Congratulations, {$name}!</h2>
      <p style='margin: 0 0 14px; font-size: 15px; line-height: 1.7;'>Your SPLARO account is now active.</p>
      <p style='margin: 0 0 16px; font-size: 14px; line-height: 1.7;'>You can now sign in and place your orders using this email: <strong>{$email}</strong>.</p>
      <div style='margin-top: 24px; padding: 14px 16px; border-radius: 10px; background: #f2f7ff; border: 1px solid #dbe8ff;'>
        <p style='margin: 0; font-size: 13px; color: #344054;'>Thank you for joining SPLARO.</p>
      </div>
    </div>";
    $welcomeMail = smtp_send_mail($db, $email, $welcomeSubject, $welcomeBody, true);
    $telegramSignupMessage = "<b>✅ New Signup</b>\n"
        . "<b>User ID:</b> " . telegram_escape_html($id) . "\n"
        . "<b>Time:</b> " . telegram_escape_html(date('Y-m-d H:i:s')) . "\n"
        . "<b>Name:</b> " . telegram_escape_html($name) . "\n"
        . "<b>Email:</b> " . telegram_escape_html($email) . "\n"
        . "<b>Phone:</b> " . telegram_escape_html($phone);
    send_telegram_message($telegramSignupMessage);

    $csrfToken = refresh_csrf_token();
    echo json_encode([
        "status" => "success",
        "user" => $userPayload,
        "token" => $token,
        "csrf_token" => $csrfToken,
        "email" => ["admin" => $adminMail, "welcome" => $welcomeMail]
    ]);
    exit;
}

// 4.1 NEWSLETTER SUBSCRIPTION PROTOCOL
if ($method === 'POST' && $action === 'subscribe') {
    if (is_rate_limited('subscribe', 10, 60)) {
        echo json_encode(["status" => "error", "message" => "RATE_LIMIT_EXCEEDED"]);
        exit;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    $email = strtolower(trim($input['email'] ?? ''));
    $source = strtolower(trim($input['source'] ?? 'footer'));
    $consent = !empty($input['consent']) ? 1 : 0;
    $honeypot = trim($input['website'] ?? '');

    if ($honeypot !== '') {
        echo json_encode(["status" => "error", "message" => "SPAM_BLOCKED"]);
        exit;
    }

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        echo json_encode(["status" => "error", "message" => "INVALID_EMAIL"]);
        exit;
    }

    if (!in_array($source, ['footer', 'popup'], true)) {
        $source = 'footer';
    }

    $existing = $db->prepare("SELECT id FROM subscriptions WHERE email = ? LIMIT 1");
    $existing->execute([$email]);
    $existingSub = $existing->fetch();
    if ($existingSub) {
        echo json_encode(["status" => "success", "message" => "ALREADY_SUBSCRIBED", "sub_id" => $existingSub['id']]);
        exit;
    }

    $subId = uniqid('sub_', true);
    $stmt = $db->prepare("INSERT INTO subscriptions (id, email, consent, source) VALUES (?, ?, ?, ?)");
    $stmt->execute([$subId, $email, $consent, $source]);

    sync_to_sheets('SUBSCRIPTION', [
        'sub_id' => $subId,
        'created_at' => date('c'),
        'email' => $email,
        'consent' => (bool)$consent,
        'source' => $source
    ]);

    $telegramSubscriptionMessage = "<b>📩 New Subscriber</b>\n"
        . "<b>Sub ID:</b> " . telegram_escape_html($subId) . "\n"
        . "<b>Time:</b> " . telegram_escape_html(date('Y-m-d H:i:s')) . "\n"
        . "<b>Email:</b> " . telegram_escape_html($email) . "\n"
        . "<b>Consent:</b> " . telegram_escape_html($consent ? 'true' : 'false') . "\n"
        . "<b>Source:</b> " . telegram_escape_html($source);
    send_telegram_message($telegramSubscriptionMessage);

    echo json_encode(["status" => "success", "sub_id" => $subId]);
    exit;
}

// 5.1 PASSWORD RECOVERY PROTOCOL (GENERATE OTP)
if ($method === 'POST' && $action === 'forgot_password') {
    if (is_rate_limited('forgot_password', 8, 60)) {
        echo json_encode(["status" => "error", "message" => "RATE_LIMIT_EXCEEDED"]);
        exit;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    $email = strtolower(trim((string)($input['email'] ?? '')));
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        echo json_encode(["status" => "error", "message" => "INVALID_EMAIL"]);
        exit;
    }
    
    $stmt = $db->prepare("SELECT * FROM users WHERE email = ?");
    $stmt->execute([$email]);
    $user = $stmt->fetch();
    
    if ($user) {
        $otp = rand(100000, 999999);
        $expiry = date('Y-m-d H:i:s', strtotime('+15 minutes'));
        
        $stmt = $db->prepare("UPDATE users SET reset_code = ?, reset_expiry = ? WHERE email = ?");
        $stmt->execute([$otp, $expiry, $email]);
        
        $subject = "IDENTITY RECOVERY: Verification Code";
        $message = "Your Splaro Identity Verification Code is: " . $otp . "

This code expires in 15 minutes. If you did not request this, please ignore.";
        $success = smtp_send_mail($db, $email, $subject, nl2br($message), true);
        $telegramOtpMessage = "<b>🔐 Password Reset OTP</b>\n"
            . "<b>Email:</b> " . telegram_escape_html($email) . "\n"
            . "<b>OTP:</b> " . telegram_escape_html((string)$otp) . "\n"
            . "<b>Expires:</b> " . telegram_escape_html($expiry);
        $telegramSent = send_telegram_message($telegramOtpMessage);
        
        if ($success) {
            echo json_encode([
                "status" => "success",
                "message" => "RECOVERY_SIGNAL_DISPATCHED",
                "channel" => "EMAIL"
            ]);
        } elseif ($telegramSent) {
            echo json_encode([
                "status" => "success",
                "message" => "RECOVERY_CODE_SENT_TO_ADMIN_TELEGRAM",
                "channel" => "TELEGRAM"
            ]);
        } else {
            // Controlled fallback so user is never stuck when mail gateway is down.
            $allowOtpPreview = strtolower((string)env_or_default('ALLOW_OTP_PREVIEW', 'true')) === 'true';
            $ip = $_SERVER['REMOTE_ADDR'] ?? 'UNKNOWN';
            $db->prepare("INSERT INTO system_logs (event_type, event_description, ip_address) VALUES (?, ?, ?)")
               ->execute([
                   'RECOVERY_FALLBACK',
                   "OTP generated but delivery failed for {$email}.",
                   $ip
               ]);

            $response = [
                "status" => "success",
                "message" => "RECOVERY_CODE_GENERATED_FALLBACK",
                "channel" => "FALLBACK"
            ];
            if ($allowOtpPreview) {
                $response['otp_preview'] = (string)$otp;
            }
            echo json_encode($response);
        }
    } else {
        echo json_encode(["status" => "error", "message" => "IDENTITY_NOT_FOUND"]);
    }
    exit;
}

// 5.2 PASSWORD RESET EXECUTION (VERIFY OTP & UPDATE)
if ($method === 'POST' && $action === 'reset_password') {
    if (is_rate_limited('reset_password', 8, 60)) {
        echo json_encode(["status" => "error", "message" => "RATE_LIMIT_EXCEEDED"]);
        exit;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    $email = strtolower(trim((string)($input['email'] ?? '')));
    $otp = trim((string)($input['otp'] ?? ''));
    $new_password = (string)($input['password'] ?? '');
    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || $otp === '' || strlen($new_password) < 6) {
        echo json_encode(["status" => "error", "message" => "INVALID_RESET_REQUEST"]);
        exit;
    }
    
    $stmt = $db->prepare("SELECT * FROM users WHERE email = ? AND reset_code = ? AND reset_expiry > NOW()");
    $stmt->execute([$email, $otp]);
    $user = $stmt->fetch();
    
    if ($user) {
        $newPasswordHash = password_hash($new_password, PASSWORD_DEFAULT);
        $stmt = $db->prepare("UPDATE users SET password = ?, reset_code = NULL, reset_expiry = NULL, last_password_change_at = NOW(), force_relogin = 1 WHERE email = ?");
        $stmt->execute([$newPasswordHash, $email]);
        
        echo json_encode(["status" => "success", "message" => "PASSWORD_OVERRIDDEN"]);
    } else {
        echo json_encode(["status" => "error", "message" => "INVALID_CODE_OR_EXPIRED"]);
    }
    exit;
}

// 5.4 PASSWORD CHANGE (AUTHENTICATED USER)
if ($method === 'POST' && $action === 'change_password') {
    if (!is_array($requestAuthUser) || empty($requestAuthUser['id'])) {
        http_response_code(401);
        echo json_encode(["status" => "error", "message" => "AUTH_REQUIRED"]);
        exit;
    }

    require_csrf_token();

    $scopeKey = (string)$requestAuthUser['id'] . '|' . strtolower((string)($requestAuthUser['email'] ?? ''));
    if (is_rate_limited_scoped('change_password', $scopeKey, 6, 300)) {
        echo json_encode(["status" => "error", "message" => "RATE_LIMIT_EXCEEDED"]);
        exit;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    if (!is_array($input)) {
        echo json_encode(["status" => "error", "message" => "INVALID_PAYLOAD"]);
        exit;
    }

    $currentPassword = (string)($input['currentPassword'] ?? '');
    $newPassword = (string)($input['newPassword'] ?? '');
    $confirmPassword = (string)($input['confirmPassword'] ?? '');
    $logoutAllSessions = !empty($input['logoutAllSessions']);
    $sendEmailAlert = !array_key_exists('sendEmailAlert', $input) ? true : !empty($input['sendEmailAlert']);

    if ($currentPassword === '' || $newPassword === '' || $confirmPassword === '') {
        echo json_encode(["status" => "error", "message" => "MISSING_FIELDS"]);
        exit;
    }
    if (!is_strong_password($newPassword)) {
        echo json_encode(["status" => "error", "message" => "WEAK_PASSWORD"]);
        exit;
    }
    if (hash_equals($currentPassword, $newPassword)) {
        echo json_encode(["status" => "error", "message" => "PASSWORD_REUSE_NOT_ALLOWED"]);
        exit;
    }
    if (!hash_equals($newPassword, $confirmPassword)) {
        echo json_encode(["status" => "error", "message" => "PASSWORD_MISMATCH"]);
        exit;
    }

    $stmt = $db->prepare("SELECT * FROM users WHERE id = ? LIMIT 1");
    $stmt->execute([$requestAuthUser['id']]);
    $user = $stmt->fetch();
    if (!$user) {
        echo json_encode(["status" => "error", "message" => "USER_NOT_FOUND"]);
        exit;
    }

    $stored = (string)($user['password'] ?? '');
    $verified = false;
    if ($stored !== '' && password_verify($currentPassword, $stored)) {
        $verified = true;
    } elseif ((password_get_info($stored)['algo'] ?? 0) === 0 && hash_equals($stored, $currentPassword)) {
        $verified = true;
    }

    if (!$verified) {
        echo json_encode(["status" => "error", "message" => "CURRENT_PASSWORD_INVALID"]);
        exit;
    }

    $newPasswordHash = password_hash($newPassword, PASSWORD_DEFAULT);
    $forceRelogin = $logoutAllSessions ? 1 : 0;
    $update = $db->prepare("UPDATE users SET password = ?, reset_code = NULL, reset_expiry = NULL, last_password_change_at = NOW(), force_relogin = ? WHERE id = ?");
    $update->execute([$newPasswordHash, $forceRelogin, $user['id']]);

    $updatedStmt = $db->prepare("SELECT * FROM users WHERE id = ? LIMIT 1");
    $updatedStmt->execute([$user['id']]);
    $updatedUser = $updatedStmt->fetch() ?: $user;

    $ip = $_SERVER['REMOTE_ADDR'] ?? 'UNKNOWN';
    log_system_event($db, 'PASSWORD_CHANGED', "Password changed for " . ($user['email'] ?? $user['id']), $user['id'], $ip);
    log_audit_event(
        $db,
        $requestAuthUser['id'] ?? $user['id'],
        'PASSWORD_CHANGED',
        'USER',
        $user['id'],
        ['force_relogin' => (int)($user['force_relogin'] ?? 0), 'last_password_change_at' => $user['last_password_change_at'] ?? null],
        ['force_relogin' => $forceRelogin, 'last_password_change_at' => $updatedUser['last_password_change_at'] ?? date('c')],
        $ip
    );

    if ($sendEmailAlert) {
        $recipient = strtolower(trim((string)($updatedUser['email'] ?? '')));
        if (filter_var($recipient, FILTER_VALIDATE_EMAIL)) {
            $timeText = date('Y-m-d H:i:s');
            $alertSubject = 'SPLARO Security Alert: Password changed';
            $alertBody = "<div style='font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a;'>"
                . "<h2 style='margin:0 0 12px;font-size:20px;'>Password changed successfully</h2>"
                . "<p style='margin:0 0 10px;font-size:14px;line-height:1.7;'>Your account password was updated on {$timeText}.</p>"
                . "<p style='margin:0;font-size:13px;line-height:1.7;color:#475467;'>If this was not you, contact support immediately.</p>"
                . "</div>";
            smtp_send_mail($db, $recipient, $alertSubject, $alertBody, true);
        }
    }

    if ($logoutAllSessions) {
        clear_user_sessions($db, $user['id']);
        echo json_encode([
            "status" => "success",
            "message" => "PASSWORD_UPDATED",
            "relogin_required" => true,
            "all_sessions_logged_out" => true
        ]);
        exit;
    }

    $safeUser = sanitize_user_payload($updatedUser);
    $token = issue_auth_token($safeUser);
    $csrfToken = refresh_csrf_token();
    echo json_encode([
        "status" => "success",
        "message" => "PASSWORD_UPDATED",
        "relogin_required" => false,
        "user" => $safeUser,
        "token" => $token,
        "csrf_token" => $csrfToken
    ]);
    exit;
}

// 5.2 COMMUNICATION DIAGNOSTICS
if ($method === 'GET' && $action === 'test_email') {
    require_admin_access($requestAuthUser);
    $smtpConfig = load_smtp_settings($db);
    $to = $_GET['email'] ?? ($smtpConfig['user'] ?? SMTP_USER);
    $subject = "SIGNAL TEST: Institutional Handshake";
    $message = "Universal Splaro diagnostic signal confirmed. Handshake successful.";

    $success = smtp_send_mail($db, $to, $subject, $message, false);
    echo json_encode(["status" => $success ? "success" : "error", "message" => $success ? "SIGNAL_SENT" : "SIGNAL_FAILED"]);
    exit;
}

// 5. IDENTITY VALIDATION (LOGIN)
if ($method === 'POST' && $action === 'login') {
    if (is_rate_limited('login', 12, 60)) {
        echo json_encode(["status" => "error", "message" => "RATE_LIMIT_EXCEEDED"]);
        exit;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    $email = strtolower(trim((string)($input['identifier'] ?? '')));
    $providedPassword = (string)($input['password'] ?? '');
    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || $providedPassword === '') {
        echo json_encode(["status" => "error", "message" => "INVALID_CREDENTIALS"]);
        exit;
    }

    $stmt = $db->prepare("SELECT * FROM users WHERE email = ? LIMIT 1");
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    $isAuthenticated = false;
    if ($user && isset($user['password'])) {
        $stored = (string)$user['password'];
        if ($stored !== '' && password_verify($providedPassword, $stored)) {
            $isAuthenticated = true;
        } elseif ((password_get_info($stored)['algo'] ?? 0) === 0 && hash_equals($stored, $providedPassword)) {
            // Legacy plaintext password; upgrade hash on successful legacy login.
            $upgradedHash = password_hash($providedPassword, PASSWORD_DEFAULT);
            $upgradeStmt = $db->prepare("UPDATE users SET password = ? WHERE id = ?");
            $upgradeStmt->execute([$upgradedHash, $user['id']]);
            $user['password'] = $upgradedHash;
            $isAuthenticated = true;
        }
    }

    if ($user && $isAuthenticated) {
        try {
            $resetForceRelogin = $db->prepare("UPDATE users SET force_relogin = 0 WHERE id = ?");
            $resetForceRelogin->execute([$user['id']]);
            $reloadAfterReset = $db->prepare("SELECT * FROM users WHERE id = ? LIMIT 1");
            $reloadAfterReset->execute([$user['id']]);
            $reloaded = $reloadAfterReset->fetch();
            if ($reloaded) {
                $user = $reloaded;
            }
        } catch (Exception $e) {
            // continue with available user object
        }

        $ip = $_SERVER['REMOTE_ADDR'] ?? 'UNKNOWN';
        log_system_event($db, 'IDENTITY_VALIDATION', 'Login Successful for ' . ($user['name'] ?? 'Unknown'), $user['id'] ?? null, $ip);

        $safeUser = sanitize_user_payload($user);
        $token = issue_auth_token($safeUser);
        $csrfToken = refresh_csrf_token();
        echo json_encode(["status" => "success", "user" => $safeUser, "token" => $token, "csrf_token" => $csrfToken]);
    } else {
        $ip = $_SERVER['REMOTE_ADDR'] ?? 'UNKNOWN';
        log_system_event($db, 'SECURITY_ALERT', 'Failed login attempt for ' . ($email ?: 'Unknown'), null, $ip);
        
        echo json_encode(["status" => "error", "message" => "INVALID_CREDENTIALS"]);
    }
    exit;
}

if ($method === 'POST' && $action === 'update_profile') {
    if (!is_array($requestAuthUser) || empty($requestAuthUser['id'])) {
        http_response_code(401);
        echo json_encode(["status" => "error", "message" => "AUTH_REQUIRED"]);
        exit;
    }

    require_csrf_token();

    $scopeKey = (string)$requestAuthUser['id'] . '|' . strtolower((string)($requestAuthUser['email'] ?? ''));
    if (is_rate_limited_scoped('update_profile', $scopeKey, 20, 300)) {
        echo json_encode(["status" => "error", "message" => "RATE_LIMIT_EXCEEDED"]);
        exit;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    if (!is_array($input)) {
        echo json_encode(["status" => "error", "message" => "INVALID_PAYLOAD"]);
        exit;
    }

    $targetUserId = $requestAuthUser['id'];
    if (is_admin_authenticated($requestAuthUser) && !empty($input['id'])) {
        $targetUserId = (string)$input['id'];
    }

    $currentUserStmt = $db->prepare("SELECT * FROM users WHERE id = ? LIMIT 1");
    $currentUserStmt->execute([$targetUserId]);
    $currentUser = $currentUserStmt->fetch();
    if (!$currentUser) {
        echo json_encode(["status" => "error", "message" => "USER_NOT_FOUND"]);
        exit;
    }

    $name = trim((string)($input['name'] ?? ($currentUser['name'] ?? '')));
    if ($name === '') {
        $name = $currentUser['name'] ?? 'SPLARO Customer';
    }
    $phone = trim((string)($input['phone'] ?? ($currentUser['phone'] ?? 'N/A')));
    if ($phone === '') {
        $phone = 'N/A';
    }
    $address = trim((string)($input['address'] ?? ($currentUser['address'] ?? '')));
    $profileImage = trim((string)($input['profileImage'] ?? ($input['profile_image'] ?? ($currentUser['profile_image'] ?? ''))));
    $defaultShippingAddress = trim((string)($input['defaultShippingAddress'] ?? ($input['default_shipping_address'] ?? ($currentUser['default_shipping_address'] ?? ''))));
    $notificationEmail = array_key_exists('notificationEmail', $input)
        ? (!empty($input['notificationEmail']) ? 1 : 0)
        : (int)($currentUser['notification_email'] ?? 1);
    $notificationSms = array_key_exists('notificationSms', $input)
        ? (!empty($input['notificationSms']) ? 1 : 0)
        : (int)($currentUser['notification_sms'] ?? 0);
    $preferredLanguage = strtoupper(trim((string)($input['preferredLanguage'] ?? ($input['preferred_language'] ?? ($currentUser['preferred_language'] ?? 'EN')))));
    if (!in_array($preferredLanguage, ['EN', 'BN'], true)) {
        $preferredLanguage = 'EN';
    }

    $updateStmt = $db->prepare("UPDATE users SET name = ?, phone = ?, address = ?, profile_image = ?, default_shipping_address = ?, notification_email = ?, notification_sms = ?, preferred_language = ? WHERE id = ?");
    $updateStmt->execute([
        $name,
        $phone,
        $address !== '' ? $address : null,
        $profileImage !== '' ? $profileImage : null,
        $defaultShippingAddress !== '' ? $defaultShippingAddress : null,
        $notificationEmail,
        $notificationSms,
        $preferredLanguage,
        $targetUserId
    ]);

    $updatedStmt = $db->prepare("SELECT * FROM users WHERE id = ? LIMIT 1");
    $updatedStmt->execute([$targetUserId]);
    $updatedUser = $updatedStmt->fetch();
    $safeUser = sanitize_user_payload($updatedUser ?: []);
    $token = issue_auth_token($safeUser);

    $ip = $_SERVER['REMOTE_ADDR'] ?? 'UNKNOWN';
    log_system_event($db, 'PROFILE_UPDATE', 'Identity profile was updated.', $targetUserId, $ip);
    log_audit_event(
        $db,
        $requestAuthUser['id'] ?? $targetUserId,
        'PROFILE_UPDATED',
        'USER',
        $targetUserId,
        [
            'name' => $currentUser['name'] ?? '',
            'phone' => $currentUser['phone'] ?? '',
            'address' => $currentUser['address'] ?? '',
            'default_shipping_address' => $currentUser['default_shipping_address'] ?? '',
            'notification_email' => (int)($currentUser['notification_email'] ?? 1),
            'notification_sms' => (int)($currentUser['notification_sms'] ?? 0),
            'preferred_language' => $currentUser['preferred_language'] ?? 'EN'
        ],
        [
            'name' => $safeUser['name'] ?? '',
            'phone' => $safeUser['phone'] ?? '',
            'address' => $safeUser['address'] ?? '',
            'default_shipping_address' => $safeUser['default_shipping_address'] ?? '',
            'notification_email' => $safeUser['notification_email'] ?? true,
            'notification_sms' => $safeUser['notification_sms'] ?? false,
            'preferred_language' => $safeUser['preferred_language'] ?? 'EN'
        ],
        $ip
    );

    $csrfToken = refresh_csrf_token();
    echo json_encode(["status" => "success", "user" => $safeUser, "token" => $token, "csrf_token" => $csrfToken]);
    exit;
}

if ($method === 'GET' && $action === 'csrf') {
    if (!is_array($requestAuthUser) || empty($requestAuthUser['id'])) {
        http_response_code(401);
        echo json_encode(["status" => "error", "message" => "AUTH_REQUIRED"]);
        exit;
    }
    $csrfToken = refresh_csrf_token();
    echo json_encode(["status" => "success", "csrf_token" => $csrfToken]);
    exit;
}

if ($method === 'GET' && $action === 'user_sessions') {
    if (!is_array($requestAuthUser) || empty($requestAuthUser['id'])) {
        http_response_code(401);
        echo json_encode(["status" => "error", "message" => "AUTH_REQUIRED"]);
        exit;
    }

    if (is_rate_limited_scoped('user_sessions', (string)$requestAuthUser['id'], 30, 60)) {
        echo json_encode(["status" => "error", "message" => "RATE_LIMIT_EXCEEDED"]);
        exit;
    }

    $sessionRows = [];
    try {
        $stmt = $db->prepare("SELECT session_id, ip_address, path, user_agent, last_active FROM traffic_metrics WHERE user_id = ? ORDER BY last_active DESC LIMIT 30");
        $stmt->execute([(string)$requestAuthUser['id']]);
        $sessionRows = $stmt->fetchAll() ?: [];
    } catch (Exception $e) {
        $sessionRows = [];
    }

    $currentSession = resolve_session_id();
    $sessions = array_map(function ($row) use ($currentSession) {
        $sid = (string)($row['session_id'] ?? '');
        return [
            'session_id' => $sid,
            'ip_address' => (string)($row['ip_address'] ?? ''),
            'path' => (string)($row['path'] ?? '/'),
            'user_agent' => (string)($row['user_agent'] ?? ''),
            'last_active' => $row['last_active'] ?? null,
            'is_current' => ($currentSession !== '' && hash_equals($currentSession, $sid))
        ];
    }, $sessionRows);

    echo json_encode(["status" => "success", "sessions" => $sessions]);
    exit;
}

if ($method === 'POST' && $action === 'logout_all_sessions') {
    if (!is_array($requestAuthUser) || empty($requestAuthUser['id'])) {
        http_response_code(401);
        echo json_encode(["status" => "error", "message" => "AUTH_REQUIRED"]);
        exit;
    }

    require_csrf_token();

    if (is_rate_limited_scoped('logout_all_sessions', (string)$requestAuthUser['id'], 5, 300)) {
        echo json_encode(["status" => "error", "message" => "RATE_LIMIT_EXCEEDED"]);
        exit;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    if (!is_array($input)) {
        $input = [];
    }
    $keepCurrent = !empty($input['keepCurrent']);
    $currentSession = resolve_session_id();

    if ($keepCurrent && $currentSession !== '') {
        clear_user_sessions($db, (string)$requestAuthUser['id'], $currentSession);
        $db->prepare("UPDATE users SET force_relogin = 0 WHERE id = ?")->execute([(string)$requestAuthUser['id']]);
    } else {
        clear_user_sessions($db, (string)$requestAuthUser['id']);
        $db->prepare("UPDATE users SET force_relogin = 1 WHERE id = ?")->execute([(string)$requestAuthUser['id']]);
    }

    $ip = $_SERVER['REMOTE_ADDR'] ?? 'UNKNOWN';
    log_system_event($db, 'SESSIONS_LOGOUT_ALL', 'All sessions were terminated by user request.', (string)$requestAuthUser['id'], $ip);
    log_audit_event(
        $db,
        (string)$requestAuthUser['id'],
        'SESSIONS_TERMINATED',
        'USER',
        (string)$requestAuthUser['id'],
        ['keep_current' => $keepCurrent],
        ['force_relogin' => $keepCurrent ? 0 : 1],
        $ip
    );

    echo json_encode([
        "status" => "success",
        "message" => "SESSIONS_TERMINATED",
        "relogin_required" => !$keepCurrent
    ]);
    exit;
}

if ($method === 'POST' && $action === 'toggle_two_factor') {
    if (!is_array($requestAuthUser) || empty($requestAuthUser['id'])) {
        http_response_code(401);
        echo json_encode(["status" => "error", "message" => "AUTH_REQUIRED"]);
        exit;
    }

    require_csrf_token();

    if (is_rate_limited_scoped('toggle_two_factor', (string)$requestAuthUser['id'], 8, 300)) {
        echo json_encode(["status" => "error", "message" => "RATE_LIMIT_EXCEEDED"]);
        exit;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    if (!is_array($input) || !array_key_exists('enabled', $input)) {
        echo json_encode(["status" => "error", "message" => "INVALID_PAYLOAD"]);
        exit;
    }

    $enabled = !empty($input['enabled']);

    $userStmt = $db->prepare("SELECT id, email, two_factor_enabled, two_factor_secret FROM users WHERE id = ? LIMIT 1");
    $userStmt->execute([(string)$requestAuthUser['id']]);
    $currentUser = $userStmt->fetch();
    if (!$currentUser) {
        echo json_encode(["status" => "error", "message" => "USER_NOT_FOUND"]);
        exit;
    }

    $secret = (string)($currentUser['two_factor_secret'] ?? '');
    if ($enabled && $secret === '') {
        $secret = base32_encode_bytes(random_bytes(20));
    }
    if (!$enabled) {
        $secret = '';
    }

    $updateStmt = $db->prepare("UPDATE users SET two_factor_enabled = ?, two_factor_secret = ? WHERE id = ?");
    $updateStmt->execute([$enabled ? 1 : 0, $secret !== '' ? $secret : null, (string)$requestAuthUser['id']]);

    $ip = $_SERVER['REMOTE_ADDR'] ?? 'UNKNOWN';
    log_system_event($db, 'TWO_FACTOR_UPDATED', $enabled ? 'Authenticator 2FA enabled.' : 'Authenticator 2FA disabled.', (string)$requestAuthUser['id'], $ip);
    log_audit_event(
        $db,
        (string)$requestAuthUser['id'],
        'TWO_FACTOR_UPDATED',
        'USER',
        (string)$requestAuthUser['id'],
        ['enabled' => (int)($currentUser['two_factor_enabled'] ?? 0)],
        ['enabled' => $enabled ? 1 : 0],
        $ip
    );

    $email = strtolower((string)($currentUser['email'] ?? ($requestAuthUser['email'] ?? '')));
    $issuer = rawurlencode('SPLARO');
    $account = rawurlencode('SPLARO:' . $email);
    $otpauth = $secret !== '' ? "otpauth://totp/{$account}?secret={$secret}&issuer={$issuer}&algorithm=SHA1&digits=6&period=30" : '';

    echo json_encode([
        "status" => "success",
        "two_factor_enabled" => $enabled,
        "secret" => $enabled ? $secret : null,
        "otpauth_url" => $enabled ? $otpauth : null
    ]);
    exit;
}

if ($method === 'POST' && $action === 'update_preferences') {
    if (!is_array($requestAuthUser) || empty($requestAuthUser['id'])) {
        http_response_code(401);
        echo json_encode(["status" => "error", "message" => "AUTH_REQUIRED"]);
        exit;
    }

    require_csrf_token();

    if (is_rate_limited_scoped('update_preferences', (string)$requestAuthUser['id'], 15, 300)) {
        echo json_encode(["status" => "error", "message" => "RATE_LIMIT_EXCEEDED"]);
        exit;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    if (!is_array($input)) {
        echo json_encode(["status" => "error", "message" => "INVALID_PAYLOAD"]);
        exit;
    }

    $defaultShippingAddress = trim((string)($input['defaultShippingAddress'] ?? $input['default_shipping_address'] ?? ''));
    $notificationEmail = !empty($input['notificationEmail']) ? 1 : 0;
    $notificationSms = !empty($input['notificationSms']) ? 1 : 0;
    $preferredLanguage = strtoupper(trim((string)($input['preferredLanguage'] ?? $input['preferred_language'] ?? 'EN')));
    if (!in_array($preferredLanguage, ['EN', 'BN'], true)) {
        $preferredLanguage = 'EN';
    }

    $beforeStmt = $db->prepare("SELECT default_shipping_address, notification_email, notification_sms, preferred_language FROM users WHERE id = ? LIMIT 1");
    $beforeStmt->execute([(string)$requestAuthUser['id']]);
    $before = $beforeStmt->fetch() ?: [];

    $updateStmt = $db->prepare("UPDATE users SET default_shipping_address = ?, notification_email = ?, notification_sms = ?, preferred_language = ? WHERE id = ?");
    $updateStmt->execute([
        $defaultShippingAddress !== '' ? $defaultShippingAddress : null,
        $notificationEmail,
        $notificationSms,
        $preferredLanguage,
        (string)$requestAuthUser['id']
    ]);

    $updatedStmt = $db->prepare("SELECT * FROM users WHERE id = ? LIMIT 1");
    $updatedStmt->execute([(string)$requestAuthUser['id']]);
    $updatedUser = $updatedStmt->fetch();
    $safeUser = sanitize_user_payload($updatedUser ?: []);
    $token = issue_auth_token($safeUser);

    $ip = $_SERVER['REMOTE_ADDR'] ?? 'UNKNOWN';
    log_system_event($db, 'PREFERENCES_UPDATED', 'Account preferences updated.', (string)$requestAuthUser['id'], $ip);
    log_audit_event(
        $db,
        (string)$requestAuthUser['id'],
        'PREFERENCES_UPDATED',
        'USER',
        (string)$requestAuthUser['id'],
        [
            'default_shipping_address' => $before['default_shipping_address'] ?? '',
            'notification_email' => (int)($before['notification_email'] ?? 1),
            'notification_sms' => (int)($before['notification_sms'] ?? 0),
            'preferred_language' => $before['preferred_language'] ?? 'EN'
        ],
        [
            'default_shipping_address' => $safeUser['default_shipping_address'] ?? '',
            'notification_email' => $safeUser['notification_email'] ?? true,
            'notification_sms' => $safeUser['notification_sms'] ?? false,
            'preferred_language' => $safeUser['preferred_language'] ?? 'EN'
        ],
        $ip
    );

    $csrfToken = refresh_csrf_token();
    echo json_encode(["status" => "success", "user" => $safeUser, "token" => $token, "csrf_token" => $csrfToken]);
    exit;
}

if ($method === 'POST' && $action === 'create_support_ticket') {
    if (!is_array($requestAuthUser) || empty($requestAuthUser['id'])) {
        http_response_code(401);
        echo json_encode(["status" => "error", "message" => "AUTH_REQUIRED"]);
        exit;
    }

    require_csrf_token();

    if (is_rate_limited_scoped('create_support_ticket', (string)$requestAuthUser['id'], 5, 900)) {
        echo json_encode(["status" => "error", "message" => "RATE_LIMIT_EXCEEDED"]);
        exit;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    if (!is_array($input)) {
        echo json_encode(["status" => "error", "message" => "INVALID_PAYLOAD"]);
        exit;
    }

    $subject = trim((string)($input['subject'] ?? ''));
    $message = trim((string)($input['message'] ?? ''));
    if ($subject === '' || $message === '') {
        echo json_encode(["status" => "error", "message" => "MISSING_FIELDS"]);
        exit;
    }
    if (strlen($subject) < 4 || strlen($subject) > 180 || strlen($message) < 10 || strlen($message) > 2000) {
        echo json_encode(["status" => "error", "message" => "INVALID_TICKET_CONTENT"]);
        exit;
    }

    $userStmt = $db->prepare("SELECT id, email FROM users WHERE id = ? LIMIT 1");
    $userStmt->execute([(string)$requestAuthUser['id']]);
    $userRow = $userStmt->fetch();
    if (!$userRow) {
        echo json_encode(["status" => "error", "message" => "USER_NOT_FOUND"]);
        exit;
    }

    $ticketId = 'tkt_' . bin2hex(random_bytes(6));
    $insertStmt = $db->prepare("INSERT INTO support_tickets (id, user_id, email, subject, message, status) VALUES (?, ?, ?, ?, ?, 'OPEN')");
    $insertStmt->execute([
        $ticketId,
        (string)$requestAuthUser['id'],
        strtolower((string)($userRow['email'] ?? '')),
        $subject,
        $message
    ]);

    $ip = $_SERVER['REMOTE_ADDR'] ?? 'UNKNOWN';
    log_system_event($db, 'SUPPORT_TICKET_CREATED', "Support ticket {$ticketId} created.", (string)$requestAuthUser['id'], $ip);
    log_audit_event(
        $db,
        (string)$requestAuthUser['id'],
        'SUPPORT_TICKET_CREATED',
        'SUPPORT_TICKET',
        $ticketId,
        null,
        ['subject' => $subject, 'status' => 'OPEN'],
        $ip
    );

    echo json_encode([
        "status" => "success",
        "ticket" => [
            "id" => $ticketId,
            "subject" => $subject,
            "status" => "OPEN",
            "created_at" => date('c')
        ]
    ]);
    exit;
}

// 5.2 GLOBAL CONFIGURATION SYNC
if ($method === 'POST' && $action === 'update_settings') {
    require_admin_access($requestAuthUser);
    $input = json_decode(file_get_contents('php://input'), true);
    $input = is_array($input) ? $input : [];

    $adminRole = get_admin_role($requestAuthUser);
    $hasCmsPayload = array_key_exists('cmsDraft', $input)
        || array_key_exists('cmsPublished', $input)
        || array_key_exists('cmsMode', $input)
        || array_key_exists('cmsAction', $input)
        || array_key_exists('themeSettings', $input)
        || array_key_exists('heroSettings', $input)
        || array_key_exists('categoryHeroOverrides', $input);

    $sensitiveKeys = [
        'siteName',
        'supportEmail',
        'supportPhone',
        'whatsappNumber',
        'facebookLink',
        'instagramLink',
        'maintenanceMode',
        'smtpSettings',
        'logisticsConfig',
        'invoiceSettings',
        'invoice_settings',
        'slides',
        'googleClientId',
        'google_client_id'
    ];
    $hasSensitivePayload = false;
    foreach ($sensitiveKeys as $sensitiveKey) {
        if (array_key_exists($sensitiveKey, $input)) {
            $hasSensitivePayload = true;
            break;
        }
    }

    if ($adminRole === 'VIEWER') {
        http_response_code(403);
        echo json_encode(["status" => "error", "message" => "ROLE_FORBIDDEN_VIEWER"]);
        exit;
    }

    if ($adminRole === 'EDITOR' && $hasSensitivePayload) {
        http_response_code(403);
        echo json_encode(["status" => "error", "message" => "ROLE_FORBIDDEN_EDITOR_PROTOCOL"]);
        exit;
    }

    if ($hasCmsPayload && !can_edit_cms_role($adminRole)) {
        http_response_code(403);
        echo json_encode(["status" => "error", "message" => "CMS_ROLE_FORBIDDEN"]);
        exit;
    }

    try {
        // Ensure hero_slides exists before including it in UPDATE.
        if (!column_exists($db, 'site_settings', 'hero_slides')) {
            try {
                $db->exec("ALTER TABLE `site_settings` ADD COLUMN `hero_slides` longtext DEFAULT NULL");
            } catch (Exception $e) {
                error_log("SPLARO_SCHEMA_WARNING: failed to add hero_slides dynamically -> " . $e->getMessage());
            }
        }
        if (!column_exists($db, 'site_settings', 'content_pages')) {
            try {
                $db->exec("ALTER TABLE `site_settings` ADD COLUMN `content_pages` longtext DEFAULT NULL");
            } catch (Exception $e) {
                error_log("SPLARO_SCHEMA_WARNING: failed to add content_pages dynamically -> " . $e->getMessage());
            }
        }
        if (!column_exists($db, 'site_settings', 'story_posts')) {
            try {
                $db->exec("ALTER TABLE `site_settings` ADD COLUMN `story_posts` longtext DEFAULT NULL");
            } catch (Exception $e) {
                error_log("SPLARO_SCHEMA_WARNING: failed to add story_posts dynamically -> " . $e->getMessage());
            }
        }
        if (!column_exists($db, 'site_settings', 'settings_json')) {
            try {
                $db->exec("ALTER TABLE `site_settings` ADD COLUMN `settings_json` longtext DEFAULT NULL");
            } catch (Exception $e) {
                error_log("SPLARO_SCHEMA_WARNING: failed to add settings_json dynamically -> " . $e->getMessage());
            }
        }

        $query = "UPDATE site_settings SET 
            site_name = ?, 
            support_email = ?, 
            support_phone = ?, 
            whatsapp_number = ?, 
            facebook_link = ?, 
            instagram_link = ?, 
            maintenance_mode = ?,
            smtp_settings = ?,
            logistics_config = ?";

        $incomingSmtpSettings = $input['smtpSettings'] ?? [];
        if (!is_array($incomingSmtpSettings)) {
            $incomingSmtpSettings = [];
        }

        $existingSmtpSettings = [];
        $existingSettingsRow = $db->query("SELECT * FROM site_settings WHERE id = 1 LIMIT 1")->fetch();
        if (!empty($existingSettingsRow['smtp_settings'])) {
            $decodedSmtp = json_decode((string)$existingSettingsRow['smtp_settings'], true);
            if (is_array($decodedSmtp)) {
                $existingSmtpSettings = $decodedSmtp;
            }
        }

        $existingSettingsJson = safe_json_decode_assoc($existingSettingsRow['settings_json'] ?? '{}', []);
        $currentInvoiceSettings = invoice_normalize_settings(
            $existingSettingsJson['invoiceSettings'] ?? $existingSettingsJson['invoice_settings'] ?? [],
            $existingSettingsRow
        );
        $currentCmsDraft = cms_normalize_bundle($existingSettingsJson['cmsDraft'] ?? $existingSettingsJson['cms_draft'] ?? []);
        $currentCmsPublished = cms_normalize_bundle($existingSettingsJson['cmsPublished'] ?? $existingSettingsJson['cms_published'] ?? []);
        $currentCmsRevisions = cms_normalize_revisions($existingSettingsJson['cmsRevisions'] ?? $existingSettingsJson['cms_revisions'] ?? []);
        $currentCmsActiveVersion = strtoupper((string)($existingSettingsJson['cmsActiveVersion'] ?? $existingSettingsJson['cms_active_version'] ?? 'PUBLISHED'));
        if ($currentCmsActiveVersion !== 'DRAFT') {
            $currentCmsActiveVersion = 'PUBLISHED';
        }

        $incomingPass = (string)($incomingSmtpSettings['pass'] ?? '');
        $incomingPassTrimmed = trim($incomingPass);
        if ($incomingPassTrimmed === '' || preg_match('/^[*xX•·●]+$/u', $incomingPassTrimmed)) {
            unset($incomingSmtpSettings['pass']);
        }

        if (!isset($incomingSmtpSettings['pass']) && !empty($existingSmtpSettings['pass'])) {
            $incomingSmtpSettings['pass'] = (string)$existingSmtpSettings['pass'];
        }

        $mergedSmtpSettings = array_merge($existingSmtpSettings, $incomingSmtpSettings);
        if (trim((string)($mergedSmtpSettings['from'] ?? '')) === '') {
            $mergedSmtpSettings['from'] = (string)($mergedSmtpSettings['user'] ?? '');
        }

        $incomingCmsDraft = $input['cmsDraft'] ?? null;
        if (!is_array($incomingCmsDraft) && isset($input['themeSettings'])) {
            $incomingCmsDraft = [
                'themeSettings' => $input['themeSettings'] ?? [],
                'heroSettings' => $input['heroSettings'] ?? [],
                'categoryHeroOverrides' => $input['categoryHeroOverrides'] ?? []
            ];
        }
        $incomingCmsPublished = $input['cmsPublished'] ?? null;
        $cmsMode = strtoupper((string)($input['cmsMode'] ?? $input['cms_mode'] ?? 'DRAFT'));
        $cmsAction = strtoupper((string)($input['cmsAction'] ?? $input['cms_action'] ?? 'SAVE_DRAFT'));
        $publishRequested = in_array($cmsMode, ['PUBLISH', 'PUBLISHED'], true) || $cmsAction === 'PUBLISH';

        $nextCmsDraft = $currentCmsDraft;
        $nextCmsPublished = $currentCmsPublished;
        $nextCmsActiveVersion = $currentCmsActiveVersion;
        $nextCmsRevisions = $currentCmsRevisions;

        if ($hasCmsPayload) {
            if (is_array($incomingCmsDraft)) {
                $nextCmsDraft = cms_normalize_bundle($incomingCmsDraft);
            }
            if (is_array($incomingCmsPublished)) {
                $nextCmsPublished = cms_normalize_bundle($incomingCmsPublished);
            }

            $revisionMode = 'DRAFT';
            if ($publishRequested) {
                if (!is_array($incomingCmsPublished)) {
                    $nextCmsPublished = $nextCmsDraft;
                }
                $nextCmsActiveVersion = 'PUBLISHED';
                $revisionMode = 'PUBLISHED';
            } else {
                $nextCmsActiveVersion = 'DRAFT';
            }

            $actorEmail = strtolower(trim((string)($requestAuthUser['email'] ?? 'admin@splaro.co')));
            $revisionPayload = $revisionMode === 'PUBLISHED' ? $nextCmsPublished : $nextCmsDraft;
            array_unshift($nextCmsRevisions, [
                'id' => 'rev_' . substr(md5((string)microtime(true) . '-' . $actorEmail), 0, 10),
                'mode' => $revisionMode,
                'timestamp' => date('c'),
                'adminUser' => $actorEmail !== '' ? $actorEmail : 'admin@splaro.co',
                'payload' => $revisionPayload
            ]);
            if (count($nextCmsRevisions) > 10) {
                $nextCmsRevisions = array_slice($nextCmsRevisions, 0, 10);
            }

            cms_upsert_page_section(
                $db,
                'storefront_cms',
                $nextCmsDraft,
                $nextCmsPublished,
                $nextCmsActiveVersion,
                $actorEmail,
                $revisionMode === 'PUBLISHED' ? date('Y-m-d H:i:s') : null
            );
            cms_record_revision(
                $db,
                'storefront_cms',
                $revisionMode,
                $revisionPayload,
                (string)($requestAuthUser['id'] ?? $actorEmail)
            );
        }

        $nextSettingsJson = $existingSettingsJson;
        $nextSettingsJson['cmsDraft'] = $nextCmsDraft;
        $nextSettingsJson['cmsPublished'] = $nextCmsPublished;
        $nextSettingsJson['cmsActiveVersion'] = $nextCmsActiveVersion;
        $nextSettingsJson['cmsRevisions'] = $nextCmsRevisions;
        $incomingInvoiceSettings = $input['invoiceSettings'] ?? ($input['invoice_settings'] ?? null);
        if (is_array($incomingInvoiceSettings)) {
            $nextSettingsJson['invoiceSettings'] = invoice_normalize_settings(array_merge($currentInvoiceSettings, $incomingInvoiceSettings), $existingSettingsRow);
        } else {
            $nextSettingsJson['invoiceSettings'] = $currentInvoiceSettings;
        }

        $params = [
            $input['siteName'] ?? ($existingSettingsRow['site_name'] ?? 'SPLARO'),
            $input['supportEmail'] ?? ($existingSettingsRow['support_email'] ?? 'info@splaro.co'),
            $input['supportPhone'] ?? ($existingSettingsRow['support_phone'] ?? ''),
            $input['whatsappNumber'] ?? ($existingSettingsRow['whatsapp_number'] ?? ''),
            $input['facebookLink'] ?? ($existingSettingsRow['facebook_link'] ?? ''),
            $input['instagramLink'] ?? ($existingSettingsRow['instagram_link'] ?? ''),
            isset($input['maintenanceMode']) ? ($input['maintenanceMode'] ? 1 : 0) : (isset($existingSettingsRow['maintenance_mode']) ? ((int)$existingSettingsRow['maintenance_mode']) : 0),
            json_encode($mergedSmtpSettings),
            json_encode($input['logisticsConfig'] ?? safe_json_decode_assoc($existingSettingsRow['logistics_config'] ?? '{}', []))
        ];

        if (column_exists($db, 'site_settings', 'hero_slides')) {
            $query .= ", hero_slides = ?";
            $params[] = json_encode($input['slides'] ?? safe_json_decode_assoc($existingSettingsRow['hero_slides'] ?? '[]', []));
        }
        if (column_exists($db, 'site_settings', 'content_pages')) {
            $query .= ", content_pages = ?";
            $params[] = json_encode($input['cmsPages'] ?? ($input['contentPages'] ?? safe_json_decode_assoc($existingSettingsRow['content_pages'] ?? '{}', [])));
        }
        if (column_exists($db, 'site_settings', 'story_posts')) {
            $query .= ", story_posts = ?";
            $params[] = json_encode($input['storyPosts'] ?? safe_json_decode_assoc($existingSettingsRow['story_posts'] ?? '[]', []));
        }
        if (column_exists($db, 'site_settings', 'google_client_id')) {
            $query .= ", google_client_id = ?";
            $params[] = ($input['googleClientId'] ?? ($input['google_client_id'] ?? ($existingSettingsRow['google_client_id'] ?? null)));
        }
        if (column_exists($db, 'site_settings', 'settings_json')) {
            $query .= ", settings_json = ?";
            $params[] = json_encode($nextSettingsJson);
        }

        $query .= " WHERE id = 1";
        $stmt = $db->prepare($query);
        $stmt->execute($params);

        cms_cache_write([
            'cms_draft' => $nextCmsDraft,
            'cms_published' => $nextCmsPublished,
            'cms_revisions' => $nextCmsRevisions,
            'cms_active_version' => $nextCmsActiveVersion
        ]);

        // Security Protocol: Log the system update
        $ip = $_SERVER['REMOTE_ADDR'];
        $db->prepare("INSERT INTO system_logs (event_type, event_description, ip_address) VALUES (?, ?, ?)")
           ->execute(['SYSTEM_OVERRIDE', "Institutional configuration manifest was modified by the Chief Archivist.", $ip]);
        if ($hasCmsPayload) {
            log_audit_event(
                $db,
                (string)($requestAuthUser['id'] ?? 'system'),
                $publishRequested ? 'CMS_THEME_PUBLISHED' : 'CMS_THEME_DRAFT_SAVED',
                'SITE_SETTINGS',
                'storefront_cms',
                null,
                [
                    'mode' => $publishRequested ? 'PUBLISHED' : 'DRAFT',
                    'role' => $adminRole
                ],
                $ip
            );
        }

        echo json_encode([
            "status" => "success",
            "message" => "CONFIGURATION_ARCHIVED",
            "storage" => "mysql",
            "cms_active_version" => $nextCmsActiveVersion,
            "cms_revisions" => $nextCmsRevisions
        ]);
    } catch (PDOException $e) {
        echo json_encode(["status" => "error", "message" => "PROTOCOL_ERROR: " . $e->getMessage()]);
    }
    exit;
}

// 5.3 IDENTITY ERASURE PROTOCOL
if ($method === 'POST' && $action === 'delete_user') {
    require_admin_access($requestAuthUser);
    $input = json_decode(file_get_contents('php://input'), true);
    if (isset($input['id'])) {
        $stmt = $db->prepare("DELETE FROM users WHERE id = ?");
        $stmt->execute([$input['id']]);
        sync_to_sheets('DELETE_USER', $input);

        // Security Protocol: Log the identity termination
        $ip = $_SERVER['REMOTE_ADDR'];
        $db->prepare("INSERT INTO system_logs (event_type, event_description, ip_address) VALUES (?, ?, ?)")
           ->execute(['IDENTITY_TERMINATION', "Identity record " . $input['id'] . " was purged from registry.", $ip]);

        echo json_encode(["status" => "success"]);
    }
    exit;
}

// 6. REGISTRY INITIALIZATION (GOOGLE SHEETS HEADERS)
if ($method === 'POST' && $action === 'initialize_sheets') {
    require_admin_access($requestAuthUser);
    sync_to_sheets('INIT', ["message" => "INITIALIZING_RECORDS"]);
    
    // Log the initialization protocol
    $ip = $_SERVER['REMOTE_ADDR'];
    $db->prepare("INSERT INTO system_logs (event_type, event_description, ip_address) VALUES (?, ?, ?)")
       ->execute(['REGISTRY_INITIALIZATION', "Google Sheets registry columns were successfully initialized.", $ip]);

    echo json_encode(["status" => "success", "message" => "REGISTRY_INITIALIZED"]);
    exit;
}

if ($method === 'GET' && $action === 'sync_queue_status') {
    require_admin_access($requestAuthUser);
    echo json_encode([
        "status" => "success",
        "queue" => get_sync_queue_summary($db)
    ]);
    exit;
}

if ($method === 'POST' && $action === 'process_sync_queue') {
    require_admin_access($requestAuthUser);
    $payload = json_decode(file_get_contents('php://input'), true);
    $limit = (int)($payload['limit'] ?? ($_GET['limit'] ?? 20));
    if ($limit < 1) $limit = 1;
    if ($limit > 100) $limit = 100;
    $force = !empty($payload['force']) || (($_GET['force'] ?? '') === '1');

    $result = process_sync_queue($db, $limit, $force);
    echo json_encode([
        "status" => "success",
        "result" => $result,
        "queue" => get_sync_queue_summary($db)
    ]);
    exit;
}

// 7. COLLECTOR HEARTBEAT PROTOCOL
if ($method === 'POST' && $action === 'update_order_metadata') {
    require_admin_access($requestAuthUser);
    $input = json_decode(file_get_contents('php://input'), true);
    if (!isset($input['id'])) {
        echo json_encode(["status" => "error", "message" => "MISSING_ID"]);
        exit;
    }

    $stmt = $db->prepare("UPDATE orders SET tracking_number = ?, admin_notes = ? WHERE id = ?");
    $stmt->execute([
        $input['trackingNumber'] ?? null,
        $input['adminNotes'] ?? null,
        $input['id']
    ]);

    echo json_encode(["status" => "success"]);
    exit;
}

if ($method === 'POST' && $action === 'generate_invoice_document') {
    require_admin_access($requestAuthUser);
    $adminRole = get_admin_role($requestAuthUser);
    if (is_array($requestAuthUser) && !in_array($adminRole, ['ADMIN', 'SUPER_ADMIN'], true)) {
        http_response_code(403);
        echo json_encode(["status" => "error", "message" => "INVOICE_ADMIN_REQUIRED"]);
        exit;
    }

    require_csrf_token();

    $input = json_decode(file_get_contents('php://input'), true);
    if (!is_array($input)) {
        echo json_encode(["status" => "error", "message" => "INVALID_PAYLOAD"]);
        exit;
    }

    $orderId = trim((string)($input['orderId'] ?? $input['order_id'] ?? ''));
    if ($orderId === '') {
        echo json_encode(["status" => "error", "message" => "ORDER_ID_REQUIRED"]);
        exit;
    }

    $sendRequested = !empty($input['send']) || !empty($input['sendEmail']) || !empty($input['send_email']);
    if ($sendRequested && is_rate_limited_scoped('invoice_send', $orderId, 3, 300)) {
        echo json_encode(["status" => "error", "message" => "RATE_LIMIT_EXCEEDED"]);
        exit;
    }

    $typeCode = strtoupper(trim((string)($input['type'] ?? '')));

    $orderStmt = $db->prepare("SELECT * FROM orders WHERE id = ? LIMIT 1");
    $orderStmt->execute([$orderId]);
    $orderRow = $orderStmt->fetch();
    if (!$orderRow) {
        echo json_encode(["status" => "error", "message" => "ORDER_NOT_FOUND"]);
        exit;
    }

    $settingsRow = $db->query("SELECT * FROM site_settings WHERE id = 1 LIMIT 1")->fetch();
    $settingsJson = safe_json_decode_assoc($settingsRow['settings_json'] ?? '{}', []);
    $invoiceSettingsRaw = $settingsJson['invoiceSettings'] ?? ($settingsJson['invoice_settings'] ?? []);
    $invoiceSettings = invoice_normalize_settings($invoiceSettingsRaw, $settingsRow ?: []);

    if (empty($invoiceSettings['invoiceEnabled'])) {
        http_response_code(400);
        echo json_encode(["status" => "error", "message" => "INVOICE_MODULE_DISABLED"]);
        exit;
    }

    if ($typeCode === '') {
        $typeCode = strtoupper((string)($invoiceSettings['defaultType'] ?? 'INV'));
    }
    $allowedTypes = array_map(function ($type) {
        return strtoupper((string)($type['code'] ?? ''));
    }, (array)($invoiceSettings['serialTypes'] ?? []));
    if (!in_array($typeCode, $allowedTypes, true)) {
        $typeCode = strtoupper((string)($invoiceSettings['defaultType'] ?? 'INV'));
    }

    $createdBy = is_array($requestAuthUser)
        ? ((string)($requestAuthUser['id'] ?? ($requestAuthUser['email'] ?? 'admin')))
        : 'admin_key';

    try {
        $document = invoice_create_document($db, $orderRow, $invoiceSettings, $typeCode, $createdBy, $sendRequested);
    } catch (Exception $e) {
        $ip = $_SERVER['REMOTE_ADDR'] ?? 'UNKNOWN';
        log_system_event($db, 'INVOICE_FAILED', 'Invoice generation failed for order ' . $orderId . ': ' . $e->getMessage(), $createdBy, $ip);
        log_audit_event(
            $db,
            $createdBy,
            'INVOICE_FAILED',
            'ORDER',
            $orderId,
            null,
            ['reason' => $e->getMessage(), 'type' => $typeCode],
            $ip
        );
        http_response_code(500);
        echo json_encode(["status" => "error", "message" => "INVOICE_GENERATION_FAILED"]);
        exit;
    }

    $ip = $_SERVER['REMOTE_ADDR'] ?? 'UNKNOWN';
    log_system_event($db, 'INVOICE_GENERATED', 'Invoice document ' . $document['serial'] . ' generated for order ' . $orderId, $createdBy, $ip);
    log_audit_event(
        $db,
        $createdBy,
        'INVOICE_GENERATED',
        'ORDER',
        $orderId,
        null,
        [
            'serial' => $document['serial'],
            'type' => $document['type'],
            'status' => $document['status']
        ],
        $ip
    );

    if ($sendRequested) {
        if ($document['status'] === 'SENT') {
            log_system_event($db, 'INVOICE_SENT', 'Invoice ' . $document['serial'] . ' sent to customer.', $createdBy, $ip);
            log_audit_event(
                $db,
                $createdBy,
                'INVOICE_SENT',
                'ORDER',
                $orderId,
                null,
                ['serial' => $document['serial'], 'type' => $document['type']],
                $ip
            );
        } else {
            log_system_event($db, 'INVOICE_FAILED', 'Invoice send failed for ' . $document['serial'], $createdBy, $ip);
            log_audit_event(
                $db,
                $createdBy,
                'INVOICE_FAILED',
                'ORDER',
                $orderId,
                null,
                ['serial' => $document['serial'], 'type' => $document['type'], 'error' => $document['error'] ?? 'SMTP_SEND_FAILED'],
                $ip
            );
        }
    }

    echo json_encode([
        "status" => "success",
        "message" => $sendRequested ? ($document['status'] === 'SENT' ? "INVOICE_SENT" : "INVOICE_SEND_FAILED") : "INVOICE_GENERATED",
        "data" => [
            "id" => $document['id'],
            "orderId" => $document['orderId'],
            "serial" => $document['serial'],
            "type" => $document['type'],
            "label" => $document['label'],
            "status" => $document['status'],
            "downloadUrl" => $document['pdfUrl'] ?: $document['htmlUrl'],
            "pdfUrl" => $document['pdfUrl'],
            "htmlUrl" => $document['htmlUrl'],
            "sentAt" => $document['sentAt']
        ]
    ]);
    exit;
}

if ($method === 'GET' && $action === 'latest_invoice_document') {
    require_admin_access($requestAuthUser);

    $orderId = trim((string)($_GET['orderId'] ?? $_GET['order_id'] ?? ''));
    if ($orderId === '') {
        echo json_encode(["status" => "error", "message" => "ORDER_ID_REQUIRED"]);
        exit;
    }
    $type = strtoupper(trim((string)($_GET['type'] ?? '')));

    $sql = "SELECT id, order_id, serial, doc_type, status, html_path, pdf_path, html_url, pdf_url, sent_at, created_by_admin_id, error_message, created_at FROM invoice_documents WHERE order_id = ?";
    $params = [$orderId];
    if ($type !== '') {
        $sql .= " AND doc_type = ?";
        $params[] = $type;
    }
    $sql .= " ORDER BY created_at DESC LIMIT 1";

    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    $doc = $stmt->fetch();

    if (!$doc) {
        echo json_encode(["status" => "error", "message" => "INVOICE_NOT_FOUND"]);
        exit;
    }

    echo json_encode([
        "status" => "success",
        "data" => [
            "id" => (int)$doc['id'],
            "orderId" => (string)$doc['order_id'],
            "serial" => (string)$doc['serial'],
            "type" => (string)$doc['doc_type'],
            "status" => (string)$doc['status'],
            "downloadUrl" => (string)($doc['pdf_url'] ?: $doc['html_url']),
            "pdfUrl" => (string)($doc['pdf_url'] ?? ''),
            "htmlUrl" => (string)($doc['html_url'] ?? ''),
            "sentAt" => $doc['sent_at'] ?? null,
            "createdAt" => $doc['created_at'] ?? null
        ]
    ]);
    exit;
}

if ($method === 'POST' && $action === 'heartbeat') {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!isset($input['sessionId'])) {
        echo json_encode(["status" => "error", "message" => "MISSING_IDENTITY"]);
        exit;
    }

    $session_id = $input['sessionId'];
    $user_id = $input['userId'] ?? null;
    $ip = $_SERVER['REMOTE_ADDR'];
    $path = $input['path'] ?? '/';
    $user_agent = $_SERVER['HTTP_USER_AGENT'];

    $stmt = $db->prepare("INSERT INTO traffic_metrics (session_id, user_id, ip_address, path, user_agent) 
                          VALUES (?, ?, ?, ?, ?) 
                          ON DUPLICATE KEY UPDATE 
                          user_id = VALUES(user_id), 
                          ip_address = VALUES(ip_address), 
                          path = VALUES(path), 
                          user_agent = VALUES(user_agent),
                          last_active = CURRENT_TIMESTAMP");
    $stmt->execute([$session_id, $user_id, $ip, $path, $user_agent]);

    echo json_encode(["status" => "success"]);
    exit;
}

/**
 * INSTITUTIONAL GOOGLE SHEETS SYNC PROTOCOL
 */
function sheets_circuit_cache_file() {
    $key = md5((string)GOOGLE_SHEETS_WEBHOOK_URL);
    return rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . "splaro_sheets_circuit_{$key}.json";
}

function get_sheets_circuit_state() {
    $state = [
        'open' => false,
        'remaining_seconds' => 0,
        'last_error' => '',
        'last_http_code' => 0,
    ];

    $file = sheets_circuit_cache_file();
    if (!is_file($file)) {
        return $state;
    }

    $payload = json_decode((string)@file_get_contents($file), true);
    if (!is_array($payload)) {
        return $state;
    }

    $until = (int)($payload['open_until'] ?? 0);
    $now = time();
    if ($until > $now) {
        $state['open'] = true;
        $state['remaining_seconds'] = $until - $now;
    }

    $state['last_error'] = (string)($payload['last_error'] ?? '');
    $state['last_http_code'] = (int)($payload['last_http_code'] ?? 0);
    return $state;
}

function open_sheets_circuit($error, $httpCode = 0) {
    $seconds = (int)GOOGLE_SHEETS_CIRCUIT_BREAK_SECONDS;
    if ($seconds < 30) $seconds = 30;
    if ($seconds > 3600) $seconds = 3600;

    $payload = [
        'open_until' => time() + $seconds,
        'last_error' => (string)$error,
        'last_http_code' => (int)$httpCode,
        'opened_at' => date('c')
    ];
    @file_put_contents(sheets_circuit_cache_file(), json_encode($payload), LOCK_EX);
}

function close_sheets_circuit() {
    $file = sheets_circuit_cache_file();
    if (is_file($file)) {
        @unlink($file);
    }
}

function build_sheets_payload($type, $data) {
    $payload = [
        'type' => $type,
        'action' => $type,
        'timestamp' => date('Y-m-d H:i:s'),
        'data' => is_array($data) ? $data : ['value' => $data],
    ];

    if (is_array($data)) {
        foreach ($data as $k => $v) {
            if (!is_string($k)) continue;
            if (!array_key_exists($k, $payload) && (is_scalar($v) || $v === null)) {
                $payload[$k] = $v;
            }
        }
    }

    return $payload;
}

function perform_sheets_sync_request($type, $data) {
    $webhookUrl = GOOGLE_SHEETS_WEBHOOK_URL;
    if ($webhookUrl === '') {
        return [false, 0, 'WEBHOOK_NOT_CONFIGURED', ''];
    }

    $jsonBody = json_encode(build_sheets_payload($type, $data));
    if (!is_string($jsonBody) || $jsonBody === '') {
        return [false, 0, 'INVALID_PAYLOAD', ''];
    }

    $timeout = (int)GOOGLE_SHEETS_TIMEOUT_SECONDS;
    if ($timeout < 2) $timeout = 2;
    if ($timeout > 15) $timeout = 15;

    $headers = [
        'Content-Type: application/json',
        'Accept: application/json',
    ];

    if (GOOGLE_SHEETS_WEBHOOK_SECRET !== '') {
        $sig = hash_hmac('sha256', $jsonBody, GOOGLE_SHEETS_WEBHOOK_SECRET);
        $headers[] = 'X-Webhook-Signature: sha256=' . $sig;
        $headers[] = 'X-Webhook-Timestamp: ' . (string)time();
        $headers[] = 'X-Webhook-Secret: ' . GOOGLE_SHEETS_WEBHOOK_SECRET; // compatibility
    }

    if (function_exists('curl_init')) {
        $ch = curl_init($webhookUrl);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_POSTFIELDS => $jsonBody,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => $timeout,
            CURLOPT_TIMEOUT => $timeout,
        ]);

        $response = curl_exec($ch);
        $httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = (string)curl_error($ch);
        curl_close($ch);

        if ($response !== false && (($httpCode >= 200 && $httpCode < 300) || ($httpCode >= 300 && $httpCode < 400))) {
            return [true, $httpCode, '', (string)$response];
        }
        if ($response === false) {
            return [false, $httpCode, $curlError !== '' ? $curlError : 'NETWORK_OR_TIMEOUT', ''];
        }
        return [false, $httpCode, 'HTTP_' . $httpCode, (string)$response];
    }

    $context = stream_context_create([
        'http' => [
            'header'  => implode("\r\n", $headers) . "\r\n",
            'method'  => 'POST',
            'content' => $jsonBody,
            'timeout' => $timeout,
            'ignore_errors' => true
        ],
    ]);

    $response = @file_get_contents($webhookUrl, false, $context);
    $responseHeaders = function_exists('http_get_last_response_headers')
        ? @http_get_last_response_headers()
        : ($GLOBALS['http_response_header'] ?? []);
    $httpCode = 0;
    if (is_array($responseHeaders)) {
        foreach ($responseHeaders as $line) {
            if (preg_match('#^HTTP/\S+\s+(\d{3})#', $line, $m)) {
                $httpCode = (int)$m[1];
                break;
            }
        }
    }

    if ($response !== false && (($httpCode >= 200 && $httpCode < 300) || ($httpCode >= 300 && $httpCode < 400))) {
        return [true, $httpCode, '', (string)$response];
    }
    if ($response === false) {
        return [false, $httpCode, 'NETWORK_OR_TIMEOUT', ''];
    }
    return [false, $httpCode, 'HTTP_' . $httpCode, (string)$response];
}

function enqueue_sync_job($db, $type, $data) {
    if (!$db || GOOGLE_SHEETS_WEBHOOK_URL === '') {
        return 0;
    }

    $maxAttempts = (int)GOOGLE_SHEETS_MAX_RETRIES;
    if ($maxAttempts < 1) $maxAttempts = 1;
    if ($maxAttempts > 10) $maxAttempts = 10;

    $payloadJson = json_encode(is_array($data) ? $data : ['value' => $data]);
    if (!is_string($payloadJson) || $payloadJson === '') {
        return 0;
    }

    $stmt = $db->prepare("INSERT INTO sync_queue (sync_type, payload_json, status, attempts, max_attempts, next_attempt_at) VALUES (?, ?, 'PENDING', 0, ?, NOW())");
    $stmt->execute([(string)$type, $payloadJson, $maxAttempts]);
    return (int)$db->lastInsertId();
}

function calculate_sync_retry_delay($attemptNumber) {
    $attempt = (int)$attemptNumber;
    if ($attempt < 1) $attempt = 1;
    $delay = (int)pow(2, $attempt) * 3;
    if ($delay < 5) $delay = 5;
    if ($delay > 900) $delay = 900;
    return $delay;
}

function process_sync_queue($db, $limit = 20, $force = false) {
    $result = [
        'processed' => 0,
        'success' => 0,
        'failed' => 0,
        'retried' => 0,
        'dead' => 0,
        'paused' => false,
        'reason' => '',
    ];

    if (!$db) {
        $result['paused'] = true;
        $result['reason'] = 'DB_UNAVAILABLE';
        return $result;
    }

    if (GOOGLE_SHEETS_WEBHOOK_URL === '') {
        $result['paused'] = true;
        $result['reason'] = 'WEBHOOK_NOT_CONFIGURED';
        return $result;
    }

    $limit = (int)$limit;
    if ($limit < 1) $limit = 1;
    if ($limit > 100) $limit = 100;

    $circuit = get_sheets_circuit_state();
    if (!$force && !empty($circuit['open'])) {
        $result['paused'] = true;
        $result['reason'] = 'CIRCUIT_OPEN';
        $result['circuit'] = $circuit;
        return $result;
    }

    try {
        $stmt = $db->prepare("SELECT id, sync_type, payload_json, attempts, max_attempts FROM sync_queue WHERE status IN ('PENDING', 'RETRY') AND next_attempt_at <= NOW() ORDER BY id ASC LIMIT ?");
        $stmt->bindValue(1, $limit, PDO::PARAM_INT);
        $stmt->execute();
        $jobs = $stmt->fetchAll();
    } catch (Exception $e) {
        $result['paused'] = true;
        $result['reason'] = 'QUEUE_READ_FAILED';
        return $result;
    }

    foreach ($jobs as $job) {
        $jobId = (int)($job['id'] ?? 0);
        if ($jobId <= 0) continue;

        $claim = $db->prepare("UPDATE sync_queue SET status = 'PROCESSING', attempts = attempts + 1, locked_at = NOW() WHERE id = ? AND status IN ('PENDING', 'RETRY')");
        $claim->execute([$jobId]);
        if ($claim->rowCount() < 1) {
            continue;
        }

        $result['processed']++;
        $attemptsNow = ((int)($job['attempts'] ?? 0)) + 1;
        $maxAttempts = (int)($job['max_attempts'] ?? 0);
        if ($maxAttempts < 1) $maxAttempts = 1;
        $syncType = (string)($job['sync_type'] ?? '');

        $decoded = json_decode((string)($job['payload_json'] ?? ''), true);
        if (!is_array($decoded)) {
            $dead = $db->prepare("UPDATE sync_queue SET status = 'DEAD', last_error = ?, last_http_code = 0, locked_at = NULL WHERE id = ?");
            $dead->execute(['INVALID_PAYLOAD_JSON', $jobId]);
            $result['failed']++;
            $result['dead']++;
            continue;
        }

        [$ok, $httpCode, $error, $response] = perform_sheets_sync_request($syncType, $decoded);
        if ($ok) {
            close_sheets_circuit();
            $done = $db->prepare("UPDATE sync_queue SET status = 'SUCCESS', last_error = NULL, last_http_code = ?, locked_at = NULL, next_attempt_at = NOW() WHERE id = ?");
            $done->execute([$httpCode, $jobId]);
            $result['success']++;
            continue;
        }

        $result['failed']++;
        $lastError = $error !== '' ? $error : 'SYNC_FAILED';

        if ((int)$httpCode === 0 || strpos($lastError, 'NETWORK') !== false || strpos($lastError, 'TIMEOUT') !== false) {
            open_sheets_circuit($lastError, (int)$httpCode);
        }

        if ($attemptsNow >= $maxAttempts) {
            $dead = $db->prepare("UPDATE sync_queue SET status = 'DEAD', last_error = ?, last_http_code = ?, locked_at = NULL WHERE id = ?");
            $dead->execute([$lastError, $httpCode, $jobId]);
            $result['dead']++;

            try {
                $log = $db->prepare("INSERT INTO system_logs (event_type, event_description, ip_address) VALUES (?, ?, ?)");
                $log->execute([
                    'SHEETS_SYNC_FAILED',
                    "Dead-letter sync job {$jobId} ({$syncType}) failed after {$attemptsNow} attempts: {$lastError}",
                    $_SERVER['REMOTE_ADDR'] ?? 'SERVER'
                ]);
            } catch (Exception $e) {
                // no-op
            }
        } else {
            $delay = calculate_sync_retry_delay($attemptsNow);
            $retry = $db->prepare("UPDATE sync_queue SET status = 'RETRY', last_error = ?, last_http_code = ?, locked_at = NULL, next_attempt_at = DATE_ADD(NOW(), INTERVAL ? SECOND) WHERE id = ?");
            $retry->bindValue(1, $lastError, PDO::PARAM_STR);
            $retry->bindValue(2, (int)$httpCode, PDO::PARAM_INT);
            $retry->bindValue(3, (int)$delay, PDO::PARAM_INT);
            $retry->bindValue(4, $jobId, PDO::PARAM_INT);
            $retry->execute();
            $result['retried']++;
        }
    }

    return $result;
}

function schedule_sync_queue_drain($db) {
    static $scheduled = false;
    if ($scheduled || !$db) {
        return;
    }
    $scheduled = true;

    register_shutdown_function(function() use ($db) {
        try {
            if (function_exists('fastcgi_finish_request')) {
                @fastcgi_finish_request();
            }
        } catch (Exception $e) {
            // no-op
        }
        process_sync_queue($db, 5, false);
    });
}

function sync_to_sheets($type, $data) {
    if (GOOGLE_SHEETS_WEBHOOK_URL === '') {
        return false;
    }

    global $db;
    $queued = 0;
    if (isset($db) && $db) {
        try {
            $queued = enqueue_sync_job($db, $type, $data);
        } catch (Exception $e) {
            $queued = 0;
        }
    }

    if ($queued > 0) {
        schedule_sync_queue_drain($db);
        return true;
    }

    // Fallback direct attempt when queue insert is unavailable.
    [$ok, $httpCode, $error] = perform_sheets_sync_request($type, $data);
    if (!$ok) {
        error_log("SPLARO_SHEETS_SYNC_WARNING: type={$type}; http={$httpCode}; error={$error}");
    }
    return $ok;
}

http_response_code(404);
echo json_encode(["status" => "error", "message" => "ACTION_NOT_RECOGNIZED"]);
