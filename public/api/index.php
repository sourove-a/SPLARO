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
    
    // Fetch dynamic SMTP settings from database
    $settings_raw = $db->query("SELECT smtp_settings FROM site_settings LIMIT 1")->fetchColumn();
    $db_settings = json_decode($settings_raw, true) ?? [];

    $mail = new PHPMailer(true);
    try {
        $mail->isSMTP();
        $mail->Host       = !empty($db_settings['host']) ? $db_settings['host'] : SMTP_HOST;
        $mail->SMTPAuth   = true;
        $mail->Username   = !empty($db_settings['user']) ? $db_settings['user'] : SMTP_USER;
        $mail->Password   = !empty($db_settings['pass']) ? $db_settings['pass'] : SMTP_PASS;
        
        $port = !empty($db_settings['port']) ? (int)$db_settings['port'] : SMTP_PORT;
        $mail->Port       = $port;
        
        if ($port === 465) {
            $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
        } else {
            $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        }

        $from_user = !empty($db_settings['user']) ? $db_settings['user'] : SMTP_USER;
        $mail->setFrom($from_user, 'SPLARO HQ');
        $mail->addAddress($to);

        $mail->isHTML($isHtml);
        $mail->Subject = $subject;
        $mail->Body    = $body;
        $mail->AltBody = $altBody ?: strip_tags($body);

        $mail->send();
        return true;
    } catch (Exception $e) {
        error_log("SPLARO_MAIL_FAILURE: " . $mail->ErrorInfo . " | Exception: " . $e->getMessage());
        return false;
    }
}

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

$db = get_db_connection();

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
        // continue with best effort
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
    ensure_column($db, 'site_settings', 'logo_url', 'text DEFAULT NULL');

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

    ensure_column($db, 'orders', 'district', 'varchar(100) DEFAULT NULL');
    ensure_column($db, 'orders', 'thana', 'varchar(100) DEFAULT NULL');
    ensure_column($db, 'orders', 'tracking_number', 'varchar(100) DEFAULT NULL');
    ensure_column($db, 'orders', 'admin_notes', 'text DEFAULT NULL');
    ensure_column($db, 'orders', 'customer_comment', 'text DEFAULT NULL');
    ensure_column($db, 'orders', 'shipping_fee', 'int(11) DEFAULT NULL');

    ensure_table($db, 'users', "CREATE TABLE IF NOT EXISTS `users` (
      `id` varchar(50) NOT NULL,
      `name` varchar(255) NOT NULL,
      `email` varchar(255) NOT NULL,
      `phone` varchar(50) DEFAULT NULL,
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

    try {
        $db->exec("INSERT IGNORE INTO `site_settings` (`id`, `site_name`, `support_email`) VALUES (1, 'Splaro', 'info@splaro.co')");
    } catch (Exception $e) {
        // ignore
    }
}

ensure_core_schema($db);

// Handle Preflight Options
if ($method === 'OPTIONS') {
    exit;
}

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
                $settings['host'] = $custom['host'] ?? $settings['host'];
                $settings['port'] = isset($custom['port']) ? (int)$custom['port'] : (int)$settings['port'];
                $settings['user'] = $custom['user'] ?? $settings['user'];
                $settings['pass'] = $custom['pass'] ?? $settings['pass'];
                $settings['from'] = $custom['from'] ?? $settings['user'];
                $settings['secure'] = strtolower($custom['secure'] ?? $settings['secure']);
            }
        }
    } catch (Exception $e) {
        // fall back to constants
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

function send_telegram_message($text, $targetChatId = null) {
    if (!TELEGRAM_ENABLED) {
        return false;
    }

    $chatId = $targetChatId ?: TELEGRAM_ADMIN_CHAT_ID;
    if (!$chatId) {
        return false;
    }

    $url = "https://api.telegram.org/bot" . TELEGRAM_BOT_TOKEN . "/sendMessage";
    $payload = json_encode([
        'chat_id' => $chatId,
        'text' => $text,
        'parse_mode' => 'HTML',
        'disable_web_page_preview' => true
    ]);

    $attempt = 0;
    $maxAttempts = 3; // initial + 2 retries
    $delayMs = 200;

    while ($attempt < $maxAttempts) {
        $attempt++;

        $response = false;
        $httpCode = 0;
        $curlError = '';

        if (function_exists('curl_init')) {
            $ch = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_POST => true,
                CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
                CURLOPT_POSTFIELDS => $payload,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_CONNECTTIMEOUT => 5,
                CURLOPT_TIMEOUT => 5,
            ]);

            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $curlError = curl_error($ch);
            curl_close($ch);
        } else {
            $context = stream_context_create([
                'http' => [
                    'method' => 'POST',
                    'header' => "Content-Type: application/json\r\n",
                    'content' => $payload,
                    'timeout' => 5,
                    'ignore_errors' => true
                ]
            ]);
            $response = @file_get_contents($url, false, $context);
            $responseHeaders = function_exists('http_get_last_response_headers')
                ? http_get_last_response_headers()
                : ($GLOBALS['http_response_header'] ?? []);
            if (!empty($responseHeaders[0]) && preg_match('/\s(\d{3})\s/', $responseHeaders[0], $m)) {
                $httpCode = (int)$m[1];
            }
        }

        if ($response !== false && $httpCode >= 200 && $httpCode < 300) {
            return true;
        }

        if ($attempt >= $maxAttempts) {
            error_log("SPLARO_TELEGRAM_FAILURE: HTTP {$httpCode}; CURL {$curlError}; RESPONSE {$response}");
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

function telegram_admin_help_text() {
    return "<b>SPLARO Admin Bot Commands</b>\n"
        . "/health - API status\n"
        . "/orders [limit] - latest orders\n"
        . "/order {id} - single order details\n"
        . "/setstatus {id} {PENDING|PROCESSING|SHIPPED|DELIVERED|CANCELLED}\n"
        . "/users [limit] - latest users\n"
        . "/maintenance {on|off} - site maintenance mode";
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

if ($method === 'GET' && $action === 'health') {
    echo json_encode([
        "status" => "success",
        "service" => "SPLARO_API",
        "time" => date('c'),
        "telegram_enabled" => TELEGRAM_ENABLED
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

    if (!is_telegram_admin_chat($chatId)) {
        send_telegram_message("<b>Unauthorized access blocked.</b>", $chatId);
        echo json_encode(["ok" => true]);
        exit;
    }

    $parts = preg_split('/\s+/', $text);
    $command = strtolower($parts[0] ?? '');
    $reply = '';

    if ($command === '/start' || $command === '/help') {
        $reply = telegram_admin_help_text();
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

    send_telegram_message($reply, $chatId);
    echo json_encode(["ok" => true]);
    exit;
}


// 1. DATA RETRIEVAL PROTOCOL
if ($method === 'GET' && $action === 'sync') {
    $settings = $db->query("SELECT * FROM site_settings LIMIT 1")->fetch();
    if ($settings) {
        $settings['smtp_settings'] = json_decode($settings['smtp_settings'], true);
        $settings['logistics_config'] = json_decode($settings['logistics_config'], true);
        $settings['hero_slides'] = json_decode($settings['hero_slides'], true);
    }

    $products = $db->query("SELECT * FROM products")->fetchAll();
    foreach ($products as &$p) {
        $p['description'] = json_decode($p['description'], true) ?? ['EN' => '', 'BN' => ''];
        $p['sizes'] = json_decode($p['sizes'], true) ?? [];
        $p['colors'] = json_decode($p['colors'], true) ?? [];
        $p['materials'] = json_decode($p['materials'], true) ?? [];
        $p['tags'] = json_decode($p['tags'], true) ?? [];
        $p['dimensions'] = json_decode($p['dimensions'], true) ?? ['l'=>'', 'w'=>'', 'h'=>''];
        $p['variations'] = json_decode($p['variations'], true) ?? [];
        $p['additionalImages'] = json_decode($p['additional_images'], true) ?? [];
        $p['sizeChartImage'] = $p['size_chart_image'];
        $p['discountPercentage'] = $p['discount_percentage'];
        $p['featured'] = $p['featured'] == 1;
        $p['stock'] = (int)$p['stock'];
        
        // FISCAL SANITIZATION: Clean numeric signals before archival storage
        $rawPrice = (string)$p['price'];
        $cleanPrice = preg_replace('/[^0-9]/', '', $rawPrice);
        $p['price'] = (int)$cleanPrice;
    }

    $data = [
        'products' => $products,
        'orders'   => $db->query("SELECT * FROM orders ORDER BY created_at DESC")->fetchAll(),
        'users'    => $db->query("SELECT * FROM users")->fetchAll(),
        'settings' => $settings,
        'logs'     => $db->query("SELECT * FROM system_logs ORDER BY created_at DESC LIMIT 50")->fetchAll(),
        'traffic'  => $db->query("SELECT * FROM traffic_metrics WHERE last_active > DATE_SUB(NOW(), INTERVAL 5 MINUTE) ORDER BY last_active DESC")->fetchAll(),
    ];
    echo json_encode(["status" => "success", "data" => $data]);
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

    $stmt = $db->prepare("INSERT INTO orders (id, user_id, customer_name, customer_email, phone, district, thana, address, items, total, status, customer_comment) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt->execute([
        $input['id'],
        $input['userId'] ?? null,
        $input['customerName'],
        $input['customerEmail'],
        $input['phone'],
        $input['district'] ?? '',
        $input['thana'] ?? '',
        $input['address'],
        json_encode($input['items']),
        $input['total'],
        $input['status'],
        $input['customerComment'] ?? null
    ]);

    // SYNC TO GOOGLE SHEETS
    sync_to_sheets('ORDER', $input);

    $siteBase = ((isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http') . '://' . ($_SERVER['HTTP_HOST'] ?? '');
    $firstItem = $input['items'][0] ?? [];
    $totalQuantity = 0;
    foreach (($input['items'] ?? []) as $lineItem) {
        $totalQuantity += (int)($lineItem['quantity'] ?? 0);
    }
    $productName = $firstItem['name'] ?? 'N/A';
    $productUrlRaw = $firstItem['productUrl'] ?? ($firstItem['url'] ?? '');
    if ($productUrlRaw && strpos($productUrlRaw, 'http') !== 0 && strpos($productUrlRaw, '/') === 0) {
        $productUrlRaw = $siteBase . $productUrlRaw;
    }
    $imageUrl = $firstItem['image'] ?? ($firstItem['imageUrl'] ?? 'N/A');
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
    foreach ($input['items'] as $item) {
        $items_html .= "
        <tr>
            <td style='padding: 12px; border-bottom: 1px solid #222; color: #ccc;'>{$item['name']}</td>
            <td style='padding: 12px; border-bottom: 1px solid #222; color: #ccc; text-align: center;'>{$item['quantity']}</td>
            <td style='padding: 12px; border-bottom: 1px solid #222; color: #fff; text-align: right;'>৳" . number_format($item['price']) . "</td>
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
    try {
        $products = json_decode(file_get_contents('php://input'), true);
        if (!is_array($products)) {
            echo json_encode(["status" => "error", "message" => "INVALID_PRODUCT_PAYLOAD"]);
            exit;
        }

        $db->prepare("DELETE FROM products")->execute(); // Flush for fresh sync

        foreach ($products as $p) {
            $stmt = $db->prepare("INSERT INTO products 
                (id, name, brand, price, image, category, type, description, sizes, colors, materials, tags, featured, sku, stock, weight, dimensions, variations, additional_images, size_chart_image, discount_percentage, sub_category) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
            $stmt->execute([
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

        echo json_encode(["status" => "success", "message" => "PRODUCT_MANIFEST_UPDATED"]);
    } catch (PDOException $e) {
        echo json_encode(["status" => "error", "message" => "PROTOCOL_ERROR: " . $e->getMessage()]);
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
    if (!empty(trim($input['website'] ?? ''))) {
        echo json_encode(["status" => "error", "message" => "SPAM_BLOCKED"]);
        exit;
    }
    
    $check = $db->prepare("SELECT * FROM users WHERE email = ?");
    $check->execute([$input['email']]);
    $existing = $check->fetch();
    
    if ($existing) {
        unset($existing['password']);
        echo json_encode(["status" => "success", "user" => $existing]);
        exit;
    }

    $stmt = $db->prepare("INSERT INTO users (id, name, email, phone, password, role) VALUES (?, ?, ?, ?, ?, ?)");
    $stmt->execute([
        $input['id'],
        $input['name'],
        $input['email'],
        $input['phone'],
        $input['password'] ?? 'social_auth_sync',
        $input['role']
    ]);

    // SYNC TO GOOGLE SHEETS
    sync_to_sheets('SIGNUP', $input);

    // TRIGGER EMAIL NOTIFICATION (SIGNUP)
    $subject = "NEW IDENTITY ARCHIVED: " . $input['name'];
    $message = "A new client has joined the Splaro Archive.

Name: " . $input['name'] . "
Email: " . $input['email'];
    $smtpConfig = load_smtp_settings($db);
    $adminRecipient = $smtpConfig['user'] ?? SMTP_USER;
    $signupMail = smtp_send_mail($db, $adminRecipient, $subject, nl2br($message), true);
    $telegramSignupMessage = "<b>✅ New Signup</b>\n"
        . "<b>User ID:</b> " . telegram_escape_html($input['id']) . "\n"
        . "<b>Time:</b> " . telegram_escape_html(date('Y-m-d H:i:s')) . "\n"
        . "<b>Name:</b> " . telegram_escape_html($input['name']) . "\n"
        . "<b>Email:</b> " . telegram_escape_html($input['email']) . "\n"
        . "<b>Phone:</b> " . telegram_escape_html($input['phone'] ?? 'N/A');
    send_telegram_message($telegramSignupMessage);

    echo json_encode(["status" => "success", "user" => $input, "email" => ["admin" => $signupMail]]);
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
    $input = json_decode(file_get_contents('php://input'), true);
    $email = $input['email'];
    
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
        
        if ($success) {
            echo json_encode(["status" => "success", "message" => "RECOVERY_SIGNAL_DISPATCHED"]);
        } else {
            echo json_encode(["status" => "error", "message" => "SIGNAL_DISPATCH_FAILURE"]);
        }
    } else {
        echo json_encode(["status" => "error", "message" => "IDENTITY_NOT_FOUND"]);
    }
    exit;
}

// 5.2 PASSWORD RESET EXECUTION (VERIFY OTP & UPDATE)
if ($method === 'POST' && $action === 'reset_password') {
    $input = json_decode(file_get_contents('php://input'), true);
    $email = $input['email'];
    $otp = $input['otp'];
    $new_password = $input['password'];
    
    $stmt = $db->prepare("SELECT * FROM users WHERE email = ? AND reset_code = ? AND reset_expiry > NOW()");
    $stmt->execute([$email, $otp]);
    $user = $stmt->fetch();
    
    if ($user) {
        $stmt = $db->prepare("UPDATE users SET password = ?, reset_code = NULL, reset_expiry = NULL WHERE email = ?");
        $stmt->execute([$new_password, $email]);
        
        echo json_encode(["status" => "success", "message" => "PASSWORD_OVERRIDDEN"]);
    } else {
        echo json_encode(["status" => "error", "message" => "INVALID_CODE_OR_EXPIRED"]);
    }
    exit;
}

// 5.2 COMMUNICATION DIAGNOSTICS
if ($method === 'GET' && $action === 'test_email') {
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
    $stmt = $db->prepare("SELECT * FROM users WHERE email = ? AND password = ?");
    $stmt->execute([$input['identifier'], $input['password']]);
    $user = $stmt->fetch();

    if ($user) {
        $ip = $_SERVER['REMOTE_ADDR'];
        $db->prepare("INSERT INTO system_logs (event_type, event_description, user_id, ip_address) VALUES (?, ?, ?, ?)")
           ->execute(['IDENTITY_VALIDATION', 'Login Successful for ' . $user['name'], $user['id'], $ip]);

        unset($user['password']); // Safety Protocol
        echo json_encode(["status" => "success", "user" => $user]);
    } else {
        $ip = $_SERVER['REMOTE_ADDR'];
        $db->prepare("INSERT INTO system_logs (event_type, event_description, ip_address) VALUES (?, ?, ?)")
           ->execute(['SECURITY_ALERT', 'Failed login attempt for ' . ($input['identifier'] ?? 'Unknown'), $ip]);
        
        echo json_encode(["status" => "error", "message" => "INVALID_CREDENTIALS"]);
    }
    exit;
}

// 5.2 GLOBAL CONFIGURATION SYNC
if ($method === 'POST' && $action === 'update_settings') {
    $input = json_decode(file_get_contents('php://input'), true);
    
    try {
        // Update basic settings
        $stmt = $db->prepare("UPDATE site_settings SET 
            site_name = ?, 
            support_email = ?, 
            support_phone = ?, 
            whatsapp_number = ?, 
            facebook_link = ?, 
            instagram_link = ?, 
            maintenance_mode = ?,
            smtp_settings = ?,
            logistics_config = ?,
            hero_slides = ?
            WHERE id = 1");
            
        $stmt->execute([
            $input['siteName'] ?? 'SPLARO',
            $input['supportEmail'] ?? 'info@splaro.co',
            $input['supportPhone'] ?? '',
            $input['whatsappNumber'] ?? '',
            $input['facebookLink'] ?? '',
            $input['instagramLink'] ?? '',
            isset($input['maintenanceMode']) ? ($input['maintenanceMode'] ? 1 : 0) : 0,
            json_encode($input['smtpSettings'] ?? []),
            json_encode($input['logisticsConfig'] ?? []),
            json_encode($input['slides'] ?? [])
        ]);

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
    // Updated Final Webhook URL
    $webhook_url = "https://script.google.com/macros/s/AKfycbyZH_H_Sma1J4007WpX8sSrW19Q8UhYKZUd108OV62Y4DIOQ6OTakFEpIxKfQNI9YAS/exec"; 
    
    $payload = [
        'type' => $type,
        'timestamp' => date('Y-m-d H:i:s'),
        'data' => $data
    ];

    $options = [
        'http' => [
            'header'  => "Content-type: application/json\r\n",
            'method'  => 'POST',
            'content' => json_encode($payload),
            'timeout' => 5
        ],
    ];

    $context  = stream_context_create($options);
    @file_get_contents($webhook_url, false, $context);
}

http_response_code(404);
echo json_encode(["status" => "error", "message" => "ACTION_NOT_RECOGNIZED"]);
