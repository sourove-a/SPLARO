<?php
/**
 * SPLARO INSTITUTIONAL CONFIGURATION MANIFEST
 * Target Environment: Hostinger Shared/Business
 */

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Admin-Key");
header("Content-Type: application/json");

function bootstrap_env_files() {
    $candidates = [
        __DIR__ . '/../../.env.local',
        __DIR__ . '/../../.env',
        __DIR__ . '/.env.local',
        __DIR__ . '/.env',
    ];

    foreach ($candidates as $file) {
        if (!is_file($file) || !is_readable($file)) {
            continue;
        }

        $lines = file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        if (!is_array($lines)) {
            continue;
        }

        foreach ($lines as $line) {
            $line = trim($line);
            if ($line === '' || $line[0] === '#') {
                continue;
            }

            $parts = explode('=', $line, 2);
            if (count($parts) !== 2) {
                continue;
            }

            $key = trim($parts[0]);
            $value = trim($parts[1]);
            $value = trim($value, "\"'");

            if ($key !== '' && getenv($key) === false) {
                putenv($key . '=' . $value);
                $_ENV[$key] = $value;
                $_SERVER[$key] = $value;
            }
        }
    }
}

bootstrap_env_files();

function env_or_default($key, $default = '') {
    $value = getenv($key);
    if ($value === false || $value === null || $value === '') {
        return $default;
    }
    return $value;
}

// 1. DATABASE COORDINATES
define('DB_HOST', env_or_default('DB_HOST', 'localhost')); // Hostinger usually uses 'localhost'
define('DB_NAME', env_or_default('DB_NAME', ''));
define('DB_USER', env_or_default('DB_USER', ''));
define('DB_PASS', env_or_default('DB_PASS', ''));

// 2. SMTP COMMAND CENTER
define('SMTP_HOST', env_or_default('SMTP_HOST', 'smtp.hostinger.com'));
define('SMTP_PORT', (int)env_or_default('SMTP_PORT', 465));
define('SMTP_USER', env_or_default('SMTP_USER', ''));
define('SMTP_PASS', env_or_default('SMTP_PASS', ''));

// 2.1 CORE API SECURITY
define('ADMIN_KEY', env_or_default('ADMIN_KEY', ''));
define('APP_AUTH_SECRET', env_or_default('APP_AUTH_SECRET', (ADMIN_KEY !== '' ? ADMIN_KEY : DB_PASS)));

// 3. TELEGRAM COMMAND CENTER (NEVER EXPOSE TO CLIENT)
define('TELEGRAM_BOT_TOKEN', env_or_default('TELEGRAM_BOT_TOKEN', ''));
define('TELEGRAM_ADMIN_CHAT_ID', env_or_default('TELEGRAM_CHAT_ID', ''));
define('TELEGRAM_WEBHOOK_SECRET', env_or_default('TELEGRAM_WEBHOOK_SECRET', ''));
define('TELEGRAM_ENABLED', TELEGRAM_BOT_TOKEN !== '' && TELEGRAM_ADMIN_CHAT_ID !== '');

// 4. GOOGLE SHEETS BRIDGE
define('GOOGLE_SHEETS_WEBHOOK_URL', env_or_default('GOOGLE_SHEETS_WEBHOOK_URL', ''));

/**
 * Establish Security Handshake with MySQL Database
 */
function get_db_connection() {
    if (DB_NAME === '' || DB_USER === '' || DB_PASS === '') {
        http_response_code(500);
        echo json_encode(["status" => "error", "message" => "DATABASE_ENV_NOT_CONFIGURED"]);
        exit;
    }

    try {
        $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4";
        $options = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ];
        return new PDO($dsn, DB_USER, DB_PASS, $options);
    } catch (\PDOException $e) {
        http_response_code(500);
        error_log("SPLARO_DB_CONNECTION_ERROR: " . $e->getMessage());
        echo json_encode(["status" => "error", "message" => "DATABASE_CONNECTION_FAILED"]);
        exit;
    }
}
