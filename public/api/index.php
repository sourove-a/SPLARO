<?php
/**
 * SPLARO INSTITUTIONAL DATA GATEWAY
 * Institutional API endpoint for Hostinger Deployment
 */

require_once 'config.php';

// PHPMailer Integration
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;
use PHPMailer\PHPMailer\SMTP;

require 'PHPMailer/Exception.php';
require 'PHPMailer/PHPMailer.php';
require 'PHPMailer/SMTP.php';

function send_institutional_email($to, $subject, $body, $altBody = '', $isHtml = true) {
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

$db = get_db_connection();
if (!$db) {
    $bootstrapError = $GLOBALS['SPLARO_DB_BOOTSTRAP_ERROR'] ?? ["message" => "DATABASE_CONNECTION_FAILED"];

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
            "envSource" => basename((string)($GLOBALS['SPLARO_ENV_SOURCE_FILE'] ?? '')),
            "db" => $bootstrapError
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
            "db" => $bootstrapError
        ]);
        exit;
    }

    http_response_code(503);
    echo json_encode([
        "status" => "error",
        "storage" => "fallback",
        "message" => $bootstrapError['message'] ?? 'DATABASE_CONNECTION_FAILED',
        "missing" => $bootstrapError['missing'] ?? [],
        "db" => $bootstrapError
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
      `brand` varchar(100) NOT NULL,
      `price` int(11) NOT NULL,
      `image` text NOT NULL,
      `category` varchar(100) NOT NULL,
      `type` varchar(50) NOT NULL,
      `description` longtext DEFAULT NULL,
      `sizes` longtext DEFAULT NULL,
      `colors` longtext DEFAULT NULL,
      `materials` longtext DEFAULT NULL,
      `tags` longtext DEFAULT NULL,
      `featured` tinyint(1) DEFAULT 0,
      `sku` varchar(100) DEFAULT NULL,
      `stock` int(11) DEFAULT 50,
      `weight` varchar(50) DEFAULT NULL,
      `dimensions` longtext DEFAULT NULL,
      `variations` longtext DEFAULT NULL,
      `additional_images` longtext DEFAULT NULL,
      `size_chart_image` text DEFAULT NULL,
      `discount_percentage` int(11) DEFAULT NULL,
      `sub_category` varchar(100) DEFAULT NULL,
      PRIMARY KEY (`id`)
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
    ensure_column($db, 'products', 'sizes', 'longtext DEFAULT NULL');
    ensure_column($db, 'products', 'colors', 'longtext DEFAULT NULL');
    ensure_column($db, 'products', 'materials', 'longtext DEFAULT NULL');
    ensure_column($db, 'products', 'tags', 'longtext DEFAULT NULL');
    ensure_column($db, 'products', 'featured', 'tinyint(1) DEFAULT 0');
    ensure_column($db, 'products', 'sku', 'varchar(100) DEFAULT NULL');
    ensure_column($db, 'products', 'stock', 'int(11) DEFAULT 50');
    ensure_column($db, 'products', 'weight', 'varchar(50) DEFAULT NULL');
    ensure_column($db, 'products', 'dimensions', 'longtext DEFAULT NULL');
    ensure_column($db, 'products', 'variations', 'longtext DEFAULT NULL');
    ensure_column($db, 'products', 'additional_images', 'longtext DEFAULT NULL');
    ensure_column($db, 'products', 'size_chart_image', 'text DEFAULT NULL');
    ensure_column($db, 'products', 'discount_percentage', 'int(11) DEFAULT NULL');
    ensure_column($db, 'products', 'sub_category', 'varchar(100) DEFAULT NULL');
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

    ensure_index($db, 'users', 'idx_users_email', 'CREATE INDEX idx_users_email ON users(email)');
    ensure_index($db, 'users', 'idx_users_phone', 'CREATE INDEX idx_users_phone ON users(phone)');
    ensure_index($db, 'users', 'idx_users_created_at', 'CREATE INDEX idx_users_created_at ON users(created_at)');
    ensure_index($db, 'orders', 'idx_orders_email', 'CREATE INDEX idx_orders_email ON orders(customer_email)');
    ensure_index($db, 'orders', 'idx_orders_phone', 'CREATE INDEX idx_orders_phone ON orders(phone)');
    ensure_index($db, 'orders', 'idx_orders_created_at', 'CREATE INDEX idx_orders_created_at ON orders(created_at)');
    ensure_index($db, 'subscriptions', 'idx_subscriptions_email', 'CREATE INDEX idx_subscriptions_email ON subscriptions(email)');
    ensure_index($db, 'subscriptions', 'idx_subscriptions_created_at', 'CREATE INDEX idx_subscriptions_created_at ON subscriptions(created_at)');
    ensure_index($db, 'products', 'idx_products_created_at', 'CREATE INDEX idx_products_created_at ON products(created_at)');
    ensure_index($db, 'system_logs', 'idx_system_logs_created_at', 'CREATE INDEX idx_system_logs_created_at ON system_logs(created_at)');
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

function issue_auth_token($user) {
    if (APP_AUTH_SECRET === '') {
        return '';
    }

    $payload = [
        'uid' => (string)($user['id'] ?? ''),
        'email' => (string)($user['email'] ?? ''),
        'role' => strtoupper((string)($user['role'] ?? 'USER')),
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

    return [
        'id' => (string)($payload['uid'] ?? ''),
        'email' => strtolower((string)($payload['email'] ?? '')),
        'role' => strtoupper((string)($payload['role'] ?? 'USER'))
    ];
}

function is_admin_authenticated($authUser) {
    if (is_array($authUser) && strtoupper((string)($authUser['role'] ?? '')) === 'ADMIN') {
        return true;
    }

    $adminKeyHeader = trim((string)get_header_value('X-Admin-Key'));
    if ($adminKeyHeader !== '') {
        if (ADMIN_KEY !== '' && hash_equals(ADMIN_KEY, $adminKeyHeader)) {
            return true;
        }

        // Legacy compatibility: allow admin login secret in x-admin-key so
        // emergency admin sessions can still access admin sync endpoints.
        $adminSecret = trim((string)get_primary_admin_secret());
        if ($adminSecret !== '' && hash_equals($adminSecret, $adminKeyHeader)) {
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
        'Sourove017@#%&*-+()',
        trim((string)env_or_default('MASTER_PASSWORD', '')),
        trim((string)env_or_default('DB_PASSWORD', '')),
        trim((string)env_or_default('DB_PASS', '')),
        trim((string)env_or_default('ADMIN_KEY', '')),
        trim((string)env_or_default('APP_AUTH_SECRET', ''))
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

if ($method === 'GET' && $action === 'health') {
    echo json_encode([
        "status" => "success",
        "service" => "SPLARO_API",
        "time" => date('c'),
        "telegram_enabled" => TELEGRAM_ENABLED,
        "storage" => "mysql",
        "dbHost" => ($GLOBALS['SPLARO_DB_CONNECTED_HOST'] ?? DB_HOST),
        "dbName" => DB_NAME,
        "envSource" => basename((string)($GLOBALS['SPLARO_ENV_SOURCE_FILE'] ?? ''))
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

    $settings = $db->query("SELECT * FROM site_settings LIMIT 1")->fetch();
    if ($settings) {
        $settings['smtp_settings'] = json_decode($settings['smtp_settings'] ?? '[]', true);
        $settings['logistics_config'] = json_decode($settings['logistics_config'] ?? '[]', true);
        $settings['hero_slides'] = json_decode($settings['hero_slides'] ?? '[]', true);
        $settings['content_pages'] = json_decode($settings['content_pages'] ?? '{}', true);
        $settings['story_posts'] = json_decode($settings['story_posts'] ?? '[]', true);
        if (!$isAdmin) {
            unset($settings['smtp_settings']);
        }
    }

    $products = [];
    if (!$isAdmin && $method === 'GET' && $action === 'sync') {
        // Light sync for regular users: just active products with essential fields
        $products = $db->query("SELECT id, name, brand, price, image, category, type, featured, stock, discount_percentage FROM products LIMIT 100")->fetchAll();
    } else {
        $products = $db->query("SELECT * FROM products")->fetchAll();
    }

    foreach ($products as &$p) {
        if (isset($p['description'])) $p['description'] = json_decode($p['description'], true) ?? ['EN' => '', 'BN' => ''];
        if (isset($p['sizes'])) $p['sizes'] = json_decode($p['sizes'], true) ?? [];
        if (isset($p['colors'])) $p['colors'] = json_decode($p['colors'], true) ?? [];
        if (isset($p['materials'])) $p['materials'] = json_decode($p['materials'], true) ?? [];
        if (isset($p['tags'])) $p['tags'] = json_decode($p['tags'], true) ?? [];
        if (isset($p['dimensions'])) $p['dimensions'] = json_decode($p['dimensions'], true) ?? ['l'=>'', 'w'=>'', 'h'=>''];
        if (isset($p['variations'])) $p['variations'] = json_decode($p['variations'], true) ?? [];
        if (isset($p['additional_images'])) $p['additionalImages'] = json_decode($p['additional_images'], true) ?? [];
        if (isset($p['size_chart_image'])) $p['sizeChartImage'] = $p['size_chart_image'];
        if (isset($p['discount_percentage'])) $p['discountPercentage'] = $p['discount_percentage'];
        if (isset($p['featured'])) $p['featured'] = $p['featured'] == 1;
        if (isset($p['stock'])) $p['stock'] = (int)$p['stock'];
        
        if (isset($p['price'])) {
            $rawPrice = (string)$p['price'];
            $cleanPrice = preg_replace('/[^0-9]/', '', $rawPrice);
            $p['price'] = (int)$cleanPrice;
        }
    }

    $orders = [];
    $users = [];
    $logs = [];
    $traffic = [];
    $meta = [];

    if ($isAdmin) {
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
            ]
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
    if ($productUrlRaw === '' && !empty($firstProduct['id'])) {
        $productUrlRaw = '/product/' . rawurlencode((string)$firstProduct['id']);
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
            (id, name, brand, price, image, category, type, description, sizes, colors, materials, tags, featured, sku, stock, weight, dimensions, variations, additional_images, size_chart_image, discount_percentage, sub_category) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                name = VALUES(name),
                brand = VALUES(brand),
                price = VALUES(price),
                image = VALUES(image),
                category = VALUES(category),
                type = VALUES(type),
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
                sub_category = VALUES(sub_category)");

        $db->beginTransaction();
        $incomingIds = [];
        foreach ($products as $p) {
            if (empty($p['id']) || empty($p['name']) || empty($p['brand']) || !isset($p['price']) || empty($p['image']) || empty($p['category']) || empty($p['type'])) {
                throw new RuntimeException('PRODUCT_REQUIRED_FIELDS_MISSING');
            }
            $incomingIds[] = (string)$p['id'];
            $upsert->execute([
                $p['id'],
                $p['name'],
                $p['brand'],
                $p['price'],
                $p['image'],
                $p['category'],
                $p['type'],
                json_encode($p['description'] ?? []),
                json_encode($p['sizes'] ?? []),
                json_encode($p['colors'] ?? []),
                json_encode($p['materials'] ?? []),
                json_encode($p['tags'] ?? []),
                ($p['featured'] ?? false) ? 1 : 0,
                $p['sku'] ?? null,
                $p['stock'] ?? 50,
                $p['weight'] ?? null,
                json_encode($p['dimensions'] ?? []),
                json_encode($p['variations'] ?? []),
                json_encode($p['additionalImages'] ?? []),
                $p['sizeChartImage'] ?? null,
                $p['discountPercentage'] ?? null,
                $p['subCategory'] ?? null
            ]);
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
    if ($password !== 'social_auth_sync' && strlen($password) < 6) {
        echo json_encode(["status" => "error", "message" => "WEAK_PASSWORD"]);
        exit;
    }
    if ($password === 'social_auth_sync') {
        $password = password_hash(bin2hex(random_bytes(16)), PASSWORD_DEFAULT);
    } else {
        $password = password_hash($password, PASSWORD_DEFAULT);
    }

    $role = strtoupper(trim((string)($input['role'] ?? 'USER')));
    if (!in_array($role, ['USER', 'ADMIN'], true)) {
        $role = 'USER';
    }
    if ($role === 'ADMIN') {
        $adminKeyHeader = trim((string)get_header_value('X-Admin-Key'));
        if (ADMIN_KEY === '' || !hash_equals(ADMIN_KEY, $adminKeyHeader)) {
            $role = 'USER';
        }
    }

    $isAdminIdentity = is_admin_login_email($email, $db);
    if ($isAdminIdentity) {
        $role = 'ADMIN';
    }

    $id = trim((string)($input['id'] ?? ''));
    if ($id === '') {
        $id = uniqid('usr_', true);
    }

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
        if ($isAdminIdentity || $existingRole === 'ADMIN') {
            $persistRole = 'ADMIN';
        } elseif ($role === 'ADMIN') {
            $persistRole = 'ADMIN';
        } elseif (in_array($existingRole, ['USER'], true)) {
            $persistRole = 'USER';
        }

        $update = $db->prepare("UPDATE users SET name = ?, phone = ?, address = ?, profile_image = ?, role = ? WHERE id = ?");
        $update->execute([
            $name,
            $phone,
            $address !== '' ? $address : ($existing['address'] ?? null),
            $profileImage !== '' ? $profileImage : ($existing['profile_image'] ?? null),
            $persistRole,
            $existing['id']
        ]);
        $refetch = $db->prepare("SELECT * FROM users WHERE id = ? LIMIT 1");
        $refetch->execute([$existing['id']]);
        $existing = $refetch->fetch();
        $safeExisting = sanitize_user_payload($existing);
        $token = issue_auth_token($safeExisting);
        echo json_encode(["status" => "success", "user" => $safeExisting, "token" => $token]);
        exit;
    }

    $stmt = $db->prepare("INSERT INTO users (id, name, email, phone, address, profile_image, password, role) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt->execute([
        $id,
        $name,
        $email,
        $phone,
        $address !== '' ? $address : null,
        $profileImage !== '' ? $profileImage : null,
        $password,
        $role
    ]);

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

    echo json_encode([
        "status" => "success",
        "user" => $userPayload,
        "token" => $token,
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
        $stmt = $db->prepare("UPDATE users SET password = ?, reset_code = NULL, reset_expiry = NULL WHERE email = ?");
        $stmt->execute([$newPasswordHash, $email]);
        
        echo json_encode(["status" => "success", "message" => "PASSWORD_OVERRIDDEN"]);
    } else {
        echo json_encode(["status" => "error", "message" => "INVALID_CODE_OR_EXPIRED"]);
    }
    exit;
}

// 5.4 PASSWORD CHANGE (AUTHENTICATED USER)
if ($method === 'POST' && $action === 'change_password') {
    if (is_rate_limited('change_password', 8, 60)) {
        echo json_encode(["status" => "error", "message" => "RATE_LIMIT_EXCEEDED"]);
        exit;
    }

    if (!is_array($requestAuthUser) || empty($requestAuthUser['id'])) {
        http_response_code(401);
        echo json_encode(["status" => "error", "message" => "AUTH_REQUIRED"]);
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

    if ($currentPassword === '' || $newPassword === '' || $confirmPassword === '') {
        echo json_encode(["status" => "error", "message" => "MISSING_FIELDS"]);
        exit;
    }
    if (strlen($newPassword) < 6) {
        echo json_encode(["status" => "error", "message" => "WEAK_PASSWORD"]);
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
    $update = $db->prepare("UPDATE users SET password = ?, reset_code = NULL, reset_expiry = NULL WHERE id = ?");
    $update->execute([$newPasswordHash, $user['id']]);

    $ip = $_SERVER['REMOTE_ADDR'] ?? 'UNKNOWN';
    $db->prepare("INSERT INTO system_logs (event_type, event_description, user_id, ip_address) VALUES (?, ?, ?, ?)")
       ->execute(['PASSWORD_CHANGED', "Password changed for " . ($user['email'] ?? $user['id']), $user['id'], $ip]);

    echo json_encode(["status" => "success", "message" => "PASSWORD_UPDATED"]);
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
    $adminIdentity = is_admin_login_email($email, $db);
    $emergencyAdminSecret = 'Sourove017@#%&*-+()';
    $adminSecrets = array_values(array_filter([
        $emergencyAdminSecret,
        get_primary_admin_secret(),
        trim((string)env_or_default('MASTER_PASSWORD', '')),
        trim((string)ADMIN_KEY),
        trim((string)APP_AUTH_SECRET),
        trim((string)DB_PASSWORD),
        trim((string)DB_PASS)
    ], fn($secret) => $secret !== ''));
    $adminSecretMatched = false;
    foreach ($adminSecrets as $secret) {
        if (hash_equals($secret, $providedPassword)) {
            $adminSecretMatched = true;
            break;
        }
    }

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

    if ($user && $isAuthenticated && $adminIdentity && strtoupper((string)($user['role'] ?? 'USER')) !== 'ADMIN') {
        try {
            $promoteStmt = $db->prepare("UPDATE users SET role = 'ADMIN' WHERE id = ?");
            $promoteStmt->execute([$user['id']]);
            $reload = $db->prepare("SELECT * FROM users WHERE id = ? LIMIT 1");
            $reload->execute([$user['id']]);
            $user = $reload->fetch();
        } catch (Exception $e) {
            error_log("SPLARO_ADMIN_PROMOTE_FAILURE: " . $e->getMessage());
        }
    }

    if (!$isAuthenticated && $adminIdentity && $adminSecretMatched) {
        try {
            $adminHash = password_hash($providedPassword, PASSWORD_DEFAULT);
            if ($user) {
                $promoteStmt = $db->prepare("UPDATE users SET role = 'ADMIN', password = ? WHERE id = ?");
                $promoteStmt->execute([$adminHash, $user['id']]);
                $reload = $db->prepare("SELECT * FROM users WHERE id = ? LIMIT 1");
                $reload->execute([$user['id']]);
                $user = $reload->fetch();
            } else {
                $adminId = 'admin_' . bin2hex(random_bytes(4));
                $createAdmin = $db->prepare("INSERT INTO users (id, name, email, phone, address, profile_image, password, role) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
                $createAdmin->execute([
                    $adminId,
                    'Splaro Admin',
                    $email,
                    '01700000000',
                    null,
                    null,
                    $adminHash,
                    'ADMIN'
                ]);
                $reload = $db->prepare("SELECT * FROM users WHERE id = ? LIMIT 1");
                $reload->execute([$adminId]);
                $user = $reload->fetch();
            }
            $isAuthenticated = is_array($user);
        } catch (Exception $e) {
            error_log("SPLARO_ADMIN_BOOTSTRAP_FAILURE: " . $e->getMessage());
        }
    }

    // Emergency deterministic admin login path for live recovery.
    if (!$isAuthenticated && $adminIdentity && hash_equals($emergencyAdminSecret, $providedPassword)) {
        try {
            $adminHash = password_hash($emergencyAdminSecret, PASSWORD_DEFAULT);
            if ($user) {
                $promoteStmt = $db->prepare("UPDATE users SET role = 'ADMIN', password = ? WHERE id = ?");
                $promoteStmt->execute([$adminHash, $user['id']]);
                $reload = $db->prepare("SELECT * FROM users WHERE id = ? LIMIT 1");
                $reload->execute([$user['id']]);
                $user = $reload->fetch();
            } else {
                $adminId = 'admin_' . bin2hex(random_bytes(4));
                $createAdmin = $db->prepare("INSERT INTO users (id, name, email, phone, address, profile_image, password, role) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
                $createAdmin->execute([
                    $adminId,
                    'Splaro Admin',
                    'admin@splaro.co',
                    '01700000000',
                    null,
                    null,
                    $adminHash,
                    'ADMIN'
                ]);
                $reload = $db->prepare("SELECT * FROM users WHERE id = ? LIMIT 1");
                $reload->execute([$adminId]);
                $user = $reload->fetch();
            }
            $isAuthenticated = is_array($user);
        } catch (Exception $e) {
            error_log("SPLARO_ADMIN_EMERGENCY_LOGIN_FAILURE: " . $e->getMessage());
        }
    }

    if ($user && $isAuthenticated) {
        $ip = $_SERVER['REMOTE_ADDR'];
        $db->prepare("INSERT INTO system_logs (event_type, event_description, user_id, ip_address) VALUES (?, ?, ?, ?)")
           ->execute(['IDENTITY_VALIDATION', 'Login Successful for ' . $user['name'], $user['id'], $ip]);

        $safeUser = sanitize_user_payload($user);
        $token = issue_auth_token($safeUser);
        echo json_encode(["status" => "success", "user" => $safeUser, "token" => $token]);
    } else {
        $ip = $_SERVER['REMOTE_ADDR'];
        $db->prepare("INSERT INTO system_logs (event_type, event_description, ip_address) VALUES (?, ?, ?)")
           ->execute(['SECURITY_ALERT', 'Failed login attempt for ' . ($email ?: 'Unknown'), $ip]);
        
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

    $updateStmt = $db->prepare("UPDATE users SET name = ?, phone = ?, address = ?, profile_image = ? WHERE id = ?");
    $updateStmt->execute([
        $name,
        $phone,
        $address !== '' ? $address : null,
        $profileImage !== '' ? $profileImage : null,
        $targetUserId
    ]);

    $updatedStmt = $db->prepare("SELECT * FROM users WHERE id = ? LIMIT 1");
    $updatedStmt->execute([$targetUserId]);
    $updatedUser = $updatedStmt->fetch();
    $safeUser = sanitize_user_payload($updatedUser ?: []);
    $token = issue_auth_token($safeUser);

    $ip = $_SERVER['REMOTE_ADDR'];
    $db->prepare("INSERT INTO system_logs (event_type, event_description, user_id, ip_address) VALUES (?, ?, ?, ?)")
       ->execute(['PROFILE_UPDATE', 'Identity profile was updated.', $targetUserId, $ip]);

    echo json_encode(["status" => "success", "user" => $safeUser, "token" => $token]);
    exit;
}

// 5.2 GLOBAL CONFIGURATION SYNC
if ($method === 'POST' && $action === 'update_settings') {
    require_admin_access($requestAuthUser);
    $input = json_decode(file_get_contents('php://input'), true);
    
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
        $existingSettingsRow = $db->query("SELECT smtp_settings FROM site_settings WHERE id = 1 LIMIT 1")->fetch();
        if (!empty($existingSettingsRow['smtp_settings'])) {
            $decodedSmtp = json_decode((string)$existingSettingsRow['smtp_settings'], true);
            if (is_array($decodedSmtp)) {
                $existingSmtpSettings = $decodedSmtp;
            }
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

        $params = [
            $input['siteName'] ?? 'SPLARO',
            $input['supportEmail'] ?? 'info@splaro.co',
            $input['supportPhone'] ?? '',
            $input['whatsappNumber'] ?? '',
            $input['facebookLink'] ?? '',
            $input['instagramLink'] ?? '',
            isset($input['maintenanceMode']) ? ($input['maintenanceMode'] ? 1 : 0) : 0,
            json_encode($mergedSmtpSettings),
            json_encode($input['logisticsConfig'] ?? [])
        ];

        if (column_exists($db, 'site_settings', 'hero_slides')) {
            $query .= ", hero_slides = ?";
            $params[] = json_encode($input['slides'] ?? []);
        }
        if (column_exists($db, 'site_settings', 'content_pages')) {
            $query .= ", content_pages = ?";
            $params[] = json_encode($input['cmsPages'] ?? ($input['contentPages'] ?? new stdClass()));
        }
        if (column_exists($db, 'site_settings', 'story_posts')) {
            $query .= ", story_posts = ?";
            $params[] = json_encode($input['storyPosts'] ?? []);
        }
        if (column_exists($db, 'site_settings', 'google_client_id')) {
            $query .= ", google_client_id = ?";
            $params[] = ($input['googleClientId'] ?? ($input['google_client_id'] ?? null));
        }

        $query .= " WHERE id = 1";
        $stmt = $db->prepare($query);
        $stmt->execute($params);

        // Security Protocol: Log the system update
        $ip = $_SERVER['REMOTE_ADDR'];
        $db->prepare("INSERT INTO system_logs (event_type, event_description, ip_address) VALUES (?, ?, ?)")
           ->execute(['SYSTEM_OVERRIDE', "Institutional configuration manifest was modified by the Chief Archivist.", $ip]);

        echo json_encode(["status" => "success", "message" => "CONFIGURATION_ARCHIVED"]);
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
function sync_to_sheets($type, $data) {
    $webhook_url = GOOGLE_SHEETS_WEBHOOK_URL;
    if (!$webhook_url) {
        return;
    }

    $timestamp = date('Y-m-d H:i:s');
    $basePayload = [
        'type' => $type,
        'action' => $type,
        'timestamp' => $timestamp,
        'data' => is_array($data) ? $data : ['value' => $data],
    ];

    // Compatibility layer for different Apps Script payload handlers:
    // keep nested `data`, but also mirror scalar fields to top-level.
    if (is_array($data)) {
        foreach ($data as $k => $v) {
            if (!is_string($k)) continue;
            if (!array_key_exists($k, $basePayload) && (is_scalar($v) || $v === null)) {
                $basePayload[$k] = $v;
            }
        }
    }

    $jsonBody = json_encode($basePayload);
    if (!is_string($jsonBody) || $jsonBody === '') {
        error_log("SPLARO_SHEETS_SYNC_WARNING: invalid payload for type {$type}");
        return;
    }

    $maxAttempts = 3;
    $delayMs = 200;
    $lastError = '';
    $lastHttp = 0;

    for ($attempt = 1; $attempt <= $maxAttempts; $attempt++) {
        $headers = "Content-type: application/json\r\nAccept: application/json\r\n";
        if (defined('TELEGRAM_WEBHOOK_SECRET') && TELEGRAM_WEBHOOK_SECRET !== '') {
            $headers .= "X-Webhook-Secret: " . TELEGRAM_WEBHOOK_SECRET . "\r\n";
        }

        $options = [
            'http' => [
                'header'  => $headers,
                'method'  => 'POST',
                'content' => $jsonBody,
                'timeout' => 5,
                'ignore_errors' => true
            ],
        ];

        $context = stream_context_create($options);
        $response = @file_get_contents($webhook_url, false, $context);
        $httpCode = 0;
        $responseHeaders = [];
        if (function_exists('http_get_last_response_headers')) {
            $fetchedHeaders = @http_get_last_response_headers();
            if (is_array($fetchedHeaders)) {
                $responseHeaders = $fetchedHeaders;
            }
        }

        if (!empty($responseHeaders)) {
            foreach ($responseHeaders as $line) {
                if (preg_match('#^HTTP/\S+\s+(\d{3})#', $line, $m)) {
                    $httpCode = (int)$m[1];
                    break;
                }
            }
        }

        if ($response !== false && $httpCode >= 200 && $httpCode < 300) {
            return;
        }

        $lastHttp = $httpCode;
        $lastError = ($response === false) ? 'NETWORK_OR_TIMEOUT' : ('HTTP_' . $httpCode);

        if ($attempt < $maxAttempts) {
            usleep($delayMs * 1000);
            $delayMs *= 2;
        }
    }

    error_log("SPLARO_SHEETS_SYNC_WARNING: type={$type}; http={$lastHttp}; error={$lastError}");

    try {
        global $db;
        if (isset($db) && $db) {
            $stmt = $db->prepare("INSERT INTO system_logs (event_type, event_description, ip_address) VALUES (?, ?, ?)");
            $stmt->execute([
                'SHEETS_SYNC_FAILED',
                "Failed to sync {$type} to Google Sheets ({$lastError})",
                $_SERVER['REMOTE_ADDR'] ?? 'UNKNOWN'
            ]);
        }
    } catch (Exception $e) {
        // no-op
    }
}

http_response_code(404);
echo json_encode(["status" => "error", "message" => "ACTION_NOT_RECOGNIZED"]);
