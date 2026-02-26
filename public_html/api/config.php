<?php
/**
 * SPLARO INSTITUTIONAL CONFIGURATION MANIFEST
 * Target Environment: Hostinger Shared/Business
 */

// Keep API responses JSON-clean in production while still writing diagnostics to server logs.
@ini_set('display_errors', '0');
@ini_set('display_startup_errors', '0');
@ini_set('log_errors', '1');
error_reporting(E_ALL);

function bootstrap_env_files() {
    $docRoot = $_SERVER['DOCUMENT_ROOT'] ?? '';
    $allowOverride = filter_var((string)($_SERVER['SPLARO_ENV_OVERRIDE'] ?? getenv('SPLARO_ENV_OVERRIDE') ?: ''), FILTER_VALIDATE_BOOLEAN);
    $decodePercentEncoded = static function ($value) {
        $value = trim((string)$value);
        if ($value === '') {
            return '';
        }
        // Decode only when URL-encoded byte sequences exist.
        // This avoids turning plain '+' characters into spaces.
        if (!preg_match('/%[0-9A-Fa-f]{2}/', $value)) {
            return '';
        }
        return rawurldecode($value);
    };
    $setRuntimeVar = static function ($key, $value) {
        $key = trim((string)$key);
        $value = (string)$value;
        if ($key === '' || $value === '') {
            return;
        }
        putenv($key . '=' . $value);
        $_ENV[$key] = $value;
        $_SERVER[$key] = $value;
    };

    // Prime plain DB_PASSWORD from runtime encoded aliases before any .env file load.
    $existingPassword = trim((string)getenv('DB_PASSWORD'));
    $existingAlias = trim((string)getenv('DB_PASS'));
    if ($existingPassword === '' && $existingAlias === '') {
        $runtimePassword = '';
        $runtimePasswordSource = '';

        $mysqlPassword = trim((string)getenv('MYSQL_PASSWORD'));
        if ($mysqlPassword !== '') {
            $runtimePassword = $mysqlPassword;
            $runtimePasswordSource = 'MYSQL_PASSWORD';
        }

        if ($runtimePassword === '') {
            $urlEncoded = trim((string)getenv('DB_PASSWORD_URLENC'));
            if ($urlEncoded !== '') {
                $decoded = $decodePercentEncoded($urlEncoded);
                if ($decoded !== '') {
                    $runtimePassword = $decoded;
                    $runtimePasswordSource = 'DB_PASSWORD_URLENC_DECODED';
                } else {
                    $runtimePassword = $urlEncoded;
                    $runtimePasswordSource = 'DB_PASSWORD_URLENC_RAW';
                }
            }
        }

        if ($runtimePassword === '') {
            $b64 = trim((string)getenv('DB_PASSWORD_B64'));
            if ($b64 !== '') {
                $decoded = base64_decode($b64, true);
                if (is_string($decoded) && $decoded !== '') {
                    $runtimePassword = $decoded;
                    $runtimePasswordSource = 'DB_PASSWORD_B64';
                }
            }
        }

        if ($runtimePassword === '') {
            $databaseUrl = trim((string)getenv('DATABASE_URL'));
            if ($databaseUrl !== '') {
                $parts = parse_url($databaseUrl);
                if (is_array($parts) && isset($parts['pass'])) {
                    $decoded = rawurldecode((string)$parts['pass']);
                    if ($decoded !== '') {
                        $runtimePassword = $decoded;
                        $runtimePasswordSource = 'DATABASE_URL';
                    }
                }
            }
        }

        if ($runtimePassword !== '') {
            $setRuntimeVar('DB_PASSWORD', $runtimePassword);
            $setRuntimeVar('DB_PASS', $runtimePassword);
            $GLOBALS['SPLARO_RUNTIME_PASSWORD_PRIMED_FROM'] = $runtimePasswordSource;
        }
    }

    // Consider runtime DB env "ready" only when plain password vars exist.
    // If only encoded variants are present, keep loading .env files to fill DB_PASSWORD/DB_PASS.
    $runtimeDbReady = trim((string)getenv('DB_NAME')) !== '' && trim((string)getenv('DB_USER')) !== '' && (
        trim((string)getenv('DB_PASSWORD')) !== '' ||
        trim((string)getenv('DB_PASS')) !== '' ||
        trim((string)getenv('MYSQL_PASSWORD')) !== ''
    );

    // Do not short-circuit on runtime DB vars.
    // Always attempt .env.local/.env so file-based DB credentials can correct stale runtime values.

    $locations = [];
    if ($docRoot !== '') {
        $cleanDocRoot = rtrim($docRoot, '/\\');
        $locations[] = $cleanDocRoot;
        $locations[] = $cleanDocRoot . '/.builds/config';
        $locations[] = $cleanDocRoot . '/api';
        $locations[] = $cleanDocRoot . '/api/.builds/config';
        $locations[] = dirname($cleanDocRoot);
        $locations[] = dirname($cleanDocRoot) . '/.builds/config';
    }
    $locations[] = __DIR__ . '/..';
    $locations[] = __DIR__;
    $locations[] = __DIR__ . '/../../';
    $locations[] = dirname(__DIR__, 2);

    $locations = array_values(array_unique(array_filter($locations)));
    $localCandidates = [];
    $envCandidates = [];
    foreach ($locations as $location) {
        $location = rtrim((string)$location, '/\\');
        if ($location === '') {
            continue;
        }
        $localCandidates[] = $location . '/.env.local';
        $envCandidates[] = $location . '/.env';
    }

    // Always prefer .env.local across all known locations before falling back to .env.
    $candidates = array_values(array_unique(array_merge($localCandidates, $envCandidates)));
    $tried = [];
    $found = false;

    foreach ($candidates as $file) {
        $tried[] = [
            'path' => $file,
            'exists' => is_file($file),
            'readable' => is_readable($file)
        ];

        if (!is_file($file) || !is_readable($file)) {
            continue;
        }

        $lines = file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        if (!is_array($lines)) {
            continue;
        }

        $GLOBALS['SPLARO_ENV_SOURCE_FILE'] = $file;
        $found = true;

        foreach ($lines as $line) {
            $line = trim($line);
            if ($line === '' || $line[0] === '#') {
                continue;
            }

            if (stripos($line, 'export ') === 0) {
                $line = trim(substr($line, 7));
            }

            $parts = explode('=', $line, 2);
            if (count($parts) !== 2) {
                continue;
            }

            $key = trim($parts[0]);
            $value = trim($parts[1]);
            $value = trim($value, "\"'");
            $forceOverrideKeys = [
                'DB_HOST',
                'DB_PORT',
                'DB_NAME',
                'DB_USER',
                'DB_PASSWORD',
                'DB_PASS',
                'DB_PASSWORD_URLENC',
                'DB_PASSWORD_B64',
                'DATABASE_URL',
                'MYSQL_HOST',
                'MYSQL_PORT',
                'MYSQL_DATABASE',
                'MYSQL_USER',
                'MYSQL_PASSWORD',
            ];

            if ($key !== '') {
                if (!$allowOverride) {
                    $existing = getenv($key);
                    if ($existing !== false && trim((string)$existing) !== '' && !in_array($key, $forceOverrideKeys, true)) {
                        continue;
                    }
                }
                putenv($key . '=' . $value);
                $_ENV[$key] = $value;
                $_SERVER[$key] = $value;
            }
        }
        break; 
    }

    if (!$found) {
        $primedFrom = trim((string)($GLOBALS['SPLARO_RUNTIME_PASSWORD_PRIMED_FROM'] ?? ''));
        $GLOBALS['SPLARO_ENV_SOURCE_FILE'] = $primedFrom !== '' ? ('RUNTIME_ENV:' . $primedFrom) : 'RUNTIME_ENV';
        $GLOBALS['SPLARO_ENV_TRIED_PATHS'] = $tried;
    } else {
         $GLOBALS['SPLARO_ENV_TRIED_PATHS'] = $tried;
    }
}

bootstrap_env_files();

function normalize_env_value($value) {
    if (!is_string($value)) {
        return $value;
    }

    $normalized = trim($value);
    $length = strlen($normalized);
    if ($length >= 2) {
        $first = $normalized[0];
        $last = $normalized[$length - 1];
        if (($first === '"' && $last === '"') || ($first === "'" && $last === "'")) {
            $normalized = substr($normalized, 1, -1);
        }
    }

    return trim($normalized);
}

function env_or_default($key, $default = '') {
    $candidates = [getenv($key), $_ENV[$key] ?? null, $_SERVER[$key] ?? null];
    foreach ($candidates as $value) {
        if ($value !== false && $value !== null && $value !== '') {
            return normalize_env_value($value);
        }
    }
    return normalize_env_value($default);
}

function env_first(array $keys, $default = '') {
    foreach ($keys as $key) {
        $value = env_or_default($key, '');
        if ($value !== '') return $value;
    }
    return $default;
}

function splaro_env_int($keysOrKey, $default, $min, $max) {
    $raw = '';
    if (is_array($keysOrKey)) {
        $raw = env_first($keysOrKey, '');
    } else {
        $raw = env_or_default((string)$keysOrKey, '');
    }

    $value = $raw === '' ? (int)$default : (int)$raw;
    if ($value < (int)$min) $value = (int)$min;
    if ($value > (int)$max) $value = (int)$max;
    return $value;
}

function splaro_env_bool($keysOrKey, $default = false) {
    $raw = '';
    if (is_array($keysOrKey)) {
        $raw = env_first($keysOrKey, '');
    } else {
        $raw = env_or_default((string)$keysOrKey, '');
    }
    if ($raw === '') {
        return (bool)$default;
    }
    return filter_var($raw, FILTER_VALIDATE_BOOLEAN);
}

function splaro_log_config_exception($stage, $exception, $context = []) {
    if (!($exception instanceof Throwable)) {
        error_log('SPLARO_CONFIG_EXCEPTION {"stage":"' . addslashes((string)$stage) . '","message":"INVALID_EXCEPTION_OBJECT"}');
        return;
    }
    $payload = is_array($context) ? $context : ['value' => $context];
    $payload['stage'] = (string)$stage;
    $payload['error_message'] = (string)$exception->getMessage();
    $payload['error_file'] = (string)$exception->getFile();
    $payload['error_line'] = (int)$exception->getLine();
    $payload['stack_trace'] = substr((string)$exception->getTraceAsString(), 0, 1600);
    $json = json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if (!is_string($json) || $json === '') {
        $json = '{"stage":"CONFIG_EXCEPTION_LOG_ENCODING_FAILED"}';
    }
    error_log('SPLARO_CONFIG_EXCEPTION ' . $json);
}

function parse_origin_host($origin) {
    $parts = parse_url((string)$origin);
    return is_array($parts) ? strtolower((string)($parts['host'] ?? '')) : '';
}

function add_allowed_origin(array &$origins, $origin) {
    $origin = trim((string)$origin);
    if ($origin === '') {
        return;
    }
    if (!in_array($origin, $origins, true)) {
        $origins[] = $origin;
    }
}

function build_allowed_origins() {
    $originsEnv = env_first(['CORS_ALLOWED_ORIGINS', 'APP_ALLOWED_ORIGINS'], '');
    $origins = [];
    if ($originsEnv !== '') {
        $origins = array_values(array_filter(array_map('trim', explode(',', $originsEnv))));
    }

    $appOrigin = env_or_default('APP_ORIGIN', '');
    if ($appOrigin !== '') {
        add_allowed_origin($origins, $appOrigin);
    }

    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? '';
    if ($host !== '') {
        $sameOrigin = $scheme . '://' . $host;
        add_allowed_origin($origins, $sameOrigin);
    }

    // Default SPLARO production origins as safe fallback even if env is incomplete.
    foreach (['https://splaro.co', 'https://www.splaro.co', 'https://admin.splaro.co'] as $origin) {
        add_allowed_origin($origins, $origin);
    }

    return $origins;
}

function is_origin_allowed($origin, array $allowedOrigins) {
    if ($origin === '') return true;

    $originHost = parse_origin_host($origin);
    if ($originHost === '') return false;

    foreach ($allowedOrigins as $allowed) {
        $allowedHost = parse_origin_host($allowed);
        if ($allowedHost !== '' && hash_equals($allowedHost, $originHost)) {
            return true;
        }
    }

    return false;
}

function apply_cors_headers() {
    $requestOrigin = trim((string)($_SERVER['HTTP_ORIGIN'] ?? ''));
    $allowedOrigins = build_allowed_origins();

    header('Vary: Origin');
    header("Access-Control-Allow-Methods: GET, POST, PATCH, OPTIONS");
    header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Admin-Key, X-Requested-With, X-CSRF-Token");
    header("Access-Control-Allow-Credentials: true");
    header("Access-Control-Max-Age: 600");
    header("Content-Type: application/json");

    if ($requestOrigin !== '' && is_origin_allowed($requestOrigin, $allowedOrigins)) {
        header("Access-Control-Allow-Origin: {$requestOrigin}");
    }
}

apply_cors_headers();

function parse_database_url() {
    $databaseUrl = env_first(['DATABASE_URL', 'MYSQL_URL', 'DB_URL'], '');
    if ($databaseUrl === '') {
        return [
            'host' => '',
            'name' => '',
            'user' => '',
            'pass' => '',
            'port' => '',
        ];
    }

    $parts = parse_url($databaseUrl);
    if (is_array($parts)) {
        $parsedUser = (string)($parts['user'] ?? '');
        $parsedPass = (string)($parts['pass'] ?? '');
        return [
            'host' => $parts['host'] ?? '',
            'name' => isset($parts['path']) ? ltrim($parts['path'], '/') : '',
            'user' => rawurldecode($parsedUser),
            'pass' => rawurldecode($parsedPass),
            'port' => isset($parts['port']) ? (string)$parts['port'] : '',
        ];
    }

    // Fallback parser for unescaped special characters in password (@, #, etc.)
    $url = preg_replace('/^mysql:\/\//i', '', $databaseUrl);
    $atPos = strrpos($url, '@');
    if ($atPos === false) {
        return [
            'host' => '',
            'name' => '',
            'user' => '',
            'pass' => '',
            'port' => '',
        ];
    }

    $authPart = substr($url, 0, $atPos);
    $hostPart = substr($url, $atPos + 1);

    $colonPos = strpos($authPart, ':');
    $user = $colonPos === false ? $authPart : substr($authPart, 0, $colonPos);
    $pass = $colonPos === false ? '' : substr($authPart, $colonPos + 1);

    $slashPos = strpos($hostPart, '/');
    $hostPort = $slashPos === false ? $hostPart : substr($hostPart, 0, $slashPos);
    $dbName = $slashPos === false ? '' : substr($hostPart, $slashPos + 1);

    $host = $hostPort;
    $port = '';
    $hostColonPos = strrpos($hostPort, ':');
    if ($hostColonPos !== false) {
        $host = substr($hostPort, 0, $hostColonPos);
        $port = substr($hostPort, $hostColonPos + 1);
    }

    return [
        'host' => trim($host),
        'name' => trim($dbName),
        'user' => trim(rawurldecode((string)$user)),
        'pass' => rawurldecode((string)$pass),
        'port' => trim($port),
    ];
}

function resolve_db_password_candidates($fallbackFromDbUrl = '') {
    $candidates = [];
    $seen = [];
    $addCandidate = static function ($source, $value) use (&$candidates, &$seen) {
        $value = (string)$value;
        if ($value === '') {
            return;
        }
        $key = hash('sha256', $value);
        if (isset($seen[$key])) {
            return;
        }
        $seen[$key] = true;
        $candidates[] = [
            'source' => (string)$source,
            'value' => $value
        ];
    };
    $decodePercentEncoded = static function ($value) {
        $value = trim((string)$value);
        if ($value === '' || !preg_match('/%[0-9A-Fa-f]{2}/', $value)) {
            return '';
        }
        return rawurldecode($value);
    };

    // Priority: plain env first, encoded variants as fallback.
    $plainPrimary = trim((string)env_or_default('DB_PASSWORD', ''));
    if ($plainPrimary !== '') {
        $addCandidate('DB_PASSWORD', $plainPrimary);
        $decodedPrimary = $decodePercentEncoded($plainPrimary);
        if ($decodedPrimary !== '') {
            $addCandidate('DB_PASSWORD_DECODED', $decodedPrimary);
        }
    }

    $plainAlias = trim((string)env_or_default('DB_PASS', ''));
    if ($plainAlias !== '') {
        $addCandidate('DB_PASS', $plainAlias);
        $decodedAlias = $decodePercentEncoded($plainAlias);
        if ($decodedAlias !== '') {
            $addCandidate('DB_PASS_DECODED', $decodedAlias);
        }
    }

    $urlEncoded = trim((string)env_or_default('DB_PASSWORD_URLENC', ''));
    if ($urlEncoded !== '') {
        // Some panels store URL-encoded password; others store raw value in this key.
        // Try both to maximize compatibility without changing user-provided password.
        $addCandidate('DB_PASSWORD_URLENC_RAW', $urlEncoded);
        $decoded = $decodePercentEncoded($urlEncoded);
        if ($decoded !== '') {
            $addCandidate('DB_PASSWORD_URLENC', $decoded);
        }
    }

    $b64 = trim((string)env_or_default('DB_PASSWORD_B64', ''));
    if ($b64 !== '') {
        $addCandidate('DB_PASSWORD_B64_RAW', $b64);
        $decoded = base64_decode($b64, true);
        if (is_string($decoded) && $decoded !== '') {
            $addCandidate('DB_PASSWORD_B64', $decoded);
        }
    }

    $mysqlPassword = trim((string)env_or_default('MYSQL_PASSWORD', ''));
    if ($mysqlPassword !== '') {
        $addCandidate('MYSQL_PASSWORD', $mysqlPassword);
    }

    if (trim((string)$fallbackFromDbUrl) !== '') {
        $addCandidate('DATABASE_URL', (string)$fallbackFromDbUrl);
    }

    if (empty($candidates)) {
        $candidates[] = [
            'source' => 'EMPTY',
            'value' => ''
        ];
    }

    return $candidates;
}

$dbUrl = parse_database_url();
$dbPasswordCandidates = resolve_db_password_candidates((string)($dbUrl['pass'] ?? ''));
$primaryDbPassword = (string)($dbPasswordCandidates[0]['value'] ?? '');
$primaryDbPasswordSource = (string)($dbPasswordCandidates[0]['source'] ?? 'EMPTY');
$GLOBALS['SPLARO_DB_PASSWORD_CANDIDATES'] = $dbPasswordCandidates;
$GLOBALS['SPLARO_DB_PASSWORD_SOURCE'] = $primaryDbPasswordSource;

// 1. DATABASE COORDINATES
define('DB_HOST', trim((string)env_first(['DB_HOST', 'MYSQL_HOST', 'MYSQLHOST', 'DB_SERVER'], $dbUrl['host'] !== '' ? $dbUrl['host'] : '127.0.0.1')));
define('DB_NAME', trim((string)env_first(['DB_NAME', 'MYSQL_DATABASE', 'DB_DATABASE'], $dbUrl['name'])));
define('DB_USER', trim((string)env_first(['DB_USER', 'MYSQL_USER', 'MYSQL_USERNAME', 'DB_USERNAME'], $dbUrl['user'])));
define('DB_PASSWORD', $primaryDbPassword);
define('DB_PASS', DB_PASSWORD);
define('DB_PORT', (int)trim((string)env_first(['DB_PORT', 'MYSQL_PORT', 'DATABASE_PORT'], $dbUrl['port'] !== '' ? $dbUrl['port'] : '3306')));
define('DB_CONNECT_TIMEOUT_SECONDS', splaro_env_int('DB_CONNECT_TIMEOUT_SECONDS', 5, 2, 20));
define('DB_QUERY_TIMEOUT_MS', splaro_env_int('DB_QUERY_TIMEOUT_MS', 3500, 250, 20000));
define('DB_LOCK_WAIT_TIMEOUT_SECONDS', splaro_env_int('DB_LOCK_WAIT_TIMEOUT_SECONDS', 10, 2, 120));
define('DB_IDLE_TIMEOUT_SECONDS', splaro_env_int('DB_IDLE_TIMEOUT_SECONDS', 90, 30, 600));
define('DB_RETRY_MAX', splaro_env_int('DB_RETRY_MAX', 3, 0, 3));
define('DB_RETRY_BASE_DELAY_MS', splaro_env_int('DB_RETRY_BASE_DELAY_MS', 120, 50, 2000));
define('DB_SLOW_QUERY_MS', splaro_env_int('DB_SLOW_QUERY_MS', 900, 100, 30000));
define('DB_PERSISTENT', splaro_env_bool('DB_PERSISTENT', false));
define('DB_POOL_TARGET', splaro_env_int('DB_POOL_TARGET', 6, 2, 10));
define('DB_CONNECTION_HINTS_ENABLED', splaro_env_bool('DB_CONNECTION_HINTS_ENABLED', true));
define('API_MAX_EXECUTION_SECONDS', splaro_env_int('API_MAX_EXECUTION_SECONDS', 25, 5, 180));
define('LOG_REQUEST_METRICS', splaro_env_bool('LOG_REQUEST_METRICS', true));
$rateWindowMs = splaro_env_int('RATE_LIMIT_WINDOW_MS', 60000, 1000, 600000);
define('RATE_LIMIT_WINDOW_SECONDS', max(1, (int)ceil($rateWindowMs / 1000)));
define('RATE_LIMIT_MAX', splaro_env_int('RATE_LIMIT_MAX', 120, 10, 5000));
define('ADMIN_RATE_LIMIT_MAX', splaro_env_int('ADMIN_RATE_LIMIT_MAX', 240, 20, 10000));
define('HEAVY_READ_RATE_LIMIT_MAX', splaro_env_int('HEAVY_READ_RATE_LIMIT_MAX', 40, 5, 500));

// 2. SMTP COMMAND CENTER
define('SMTP_HOST', env_or_default('SMTP_HOST', 'smtp.hostinger.com'));
define('SMTP_PORT', (int)env_or_default('SMTP_PORT', 465));
define('SMTP_USER', env_or_default('SMTP_USER', ''));
define('SMTP_PASS', env_or_default('SMTP_PASS', ''));

// 2.1 CORE API SECURITY
define('ADMIN_KEY', env_or_default('ADMIN_KEY', ''));
$appAuthSecret = trim((string)env_or_default('APP_AUTH_SECRET', ''));
if ($appAuthSecret === '') {
    $appAuthSecret = hash('sha256', 'splaro|' . DB_HOST . '|' . DB_NAME . '|' . DB_USER);
}
define('APP_AUTH_SECRET', $appAuthSecret);

// 3. TELEGRAM COMMAND CENTER (NEVER EXPOSE TO CLIENT)
define('TELEGRAM_BOT_TOKEN', env_or_default('TELEGRAM_BOT_TOKEN', ''));
$telegramAllowlistRaw = trim((string)env_first(
    ['TELEGRAM_ADMIN_ALLOWLIST_IDS', 'TELEGRAM_CHAT_ALLOWLIST_IDS', 'TELEGRAM_CHAT_ID'],
    env_or_default('TELEGRAM_CHAT_ID', '')
));
$telegramPrimaryChatId = '';
if ($telegramAllowlistRaw !== '') {
    $telegramAllowlistParts = preg_split('/[\s,]+/', $telegramAllowlistRaw);
    if (is_array($telegramAllowlistParts)) {
        foreach ($telegramAllowlistParts as $allowlistedChatId) {
            $normalizedChatId = trim((string)$allowlistedChatId);
            if ($normalizedChatId !== '') {
                $telegramPrimaryChatId = $normalizedChatId;
                break;
            }
        }
    }
}
define('TELEGRAM_ADMIN_CHAT_ALLOWLIST_RAW', $telegramAllowlistRaw);
define('TELEGRAM_ADMIN_CHAT_ID', $telegramPrimaryChatId);
define('TELEGRAM_WEBHOOK_SECRET', env_or_default('TELEGRAM_WEBHOOK_SECRET', ''));
define('TELEGRAM_ENABLED', TELEGRAM_BOT_TOKEN !== '' && TELEGRAM_ADMIN_CHAT_ID !== '');
define('TELEGRAM_MAX_RETRIES', splaro_env_int('TELEGRAM_MAX_RETRIES', 3, 1, 10));

// 4. GOOGLE SHEETS BRIDGE
define('GOOGLE_SHEETS_WEBHOOK_URL', env_or_default('GOOGLE_SHEETS_WEBHOOK_URL', ''));
define('GOOGLE_SHEETS_WEBHOOK_SECRET', env_or_default('GOOGLE_SHEETS_WEBHOOK_SECRET', env_or_default('TELEGRAM_WEBHOOK_SECRET', '')));
define('GOOGLE_SHEETS_MAX_RETRIES', splaro_env_int('GOOGLE_SHEETS_MAX_RETRIES', 5, 1, 10));
define('GOOGLE_SHEETS_TIMEOUT_SECONDS', splaro_env_int('GOOGLE_SHEETS_TIMEOUT_SECONDS', 8, 2, 30));
define('GOOGLE_SHEETS_CIRCUIT_BREAK_SECONDS', splaro_env_int('GOOGLE_SHEETS_CIRCUIT_BREAK_SECONDS', 600, 30, 3600));

// 4.5 PAYMENT/SHIPPING GATEWAY SAFETY DEFAULTS
define('SSLCOMMERZ_INIT_URL_SANDBOX', env_or_default('SSLCOMMERZ_INIT_URL_SANDBOX', 'https://sandbox.sslcommerz.com/gwprocess/v4/api.php'));
define('SSLCOMMERZ_INIT_URL_LIVE', env_or_default('SSLCOMMERZ_INIT_URL_LIVE', 'https://securepay.sslcommerz.com/gwprocess/v4/api.php'));
define('SSLCOMMERZ_VALIDATION_URL_SANDBOX', env_or_default('SSLCOMMERZ_VALIDATION_URL_SANDBOX', 'https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php'));
define('SSLCOMMERZ_VALIDATION_URL_LIVE', env_or_default('SSLCOMMERZ_VALIDATION_URL_LIVE', 'https://securepay.sslcommerz.com/validator/api/validationserverAPI.php'));
define('SSLCOMMERZ_HTTP_TIMEOUT_SECONDS', splaro_env_int('SSLCOMMERZ_HTTP_TIMEOUT_SECONDS', 10, 3, 30));
define('STEADFAST_HTTP_TIMEOUT_SECONDS', splaro_env_int('STEADFAST_HTTP_TIMEOUT_SECONDS', 10, 3, 30));

// 5. WEB PUSH (VAPID)
define('PUSH_VAPID_PUBLIC_KEY', trim((string)env_first(['PUSH_VAPID_PUBLIC_KEY', 'VAPID_PUBLIC_KEY'], '')));
define('PUSH_VAPID_PRIVATE_KEY', trim((string)env_first(['PUSH_VAPID_PRIVATE_KEY', 'VAPID_PRIVATE_KEY'], '')));
define('PUSH_VAPID_SUBJECT', trim((string)env_first(['PUSH_VAPID_SUBJECT', 'VAPID_SUBJECT'], 'mailto:info@splaro.co')));
define('PUSH_MAX_RETRIES', splaro_env_int('PUSH_MAX_RETRIES', 3, 1, 3));
define('PUSH_BATCH_LIMIT', splaro_env_int('PUSH_BATCH_LIMIT', 25, 1, 200));
define('PUSH_ENABLED', PUSH_VAPID_PUBLIC_KEY !== '' && PUSH_VAPID_PRIVATE_KEY !== '');

// Health monitoring thresholds (Hostinger-friendly defaults)
define('HEALTH_ALERT_RATE_LIMIT_SECONDS', splaro_env_int('HEALTH_ALERT_RATE_LIMIT_SECONDS', 300, 60, 3600));
define('HEALTH_DB_THREADS_WARN_THRESHOLD', splaro_env_int('HEALTH_DB_THREADS_WARN_THRESHOLD', 80, 10, 500));
define('HEALTH_DB_ABORTED_CONNECTS_WARN_THRESHOLD', splaro_env_int('HEALTH_DB_ABORTED_CONNECTS_WARN_THRESHOLD', 50, 1, 10000));
define('HEALTH_DB_ABORTED_CONNECTS_DELTA_WARN_THRESHOLD', splaro_env_int('HEALTH_DB_ABORTED_CONNECTS_DELTA_WARN_THRESHOLD', 8, 1, 1000));
define('HEALTH_DB_ABORTED_CONNECTS_DELTA_WINDOW_SECONDS', splaro_env_int('HEALTH_DB_ABORTED_CONNECTS_DELTA_WINDOW_SECONDS', 900, 60, 3600));
define('HEALTH_DB_ABORTED_CONNECTS_MIN_ELAPSED_SECONDS', splaro_env_int('HEALTH_DB_ABORTED_CONNECTS_MIN_ELAPSED_SECONDS', 45, 10, 900));
define('HEALTH_DB_ABORTED_CONNECTS_RATE_WARN_PER_MINUTE', splaro_env_int('HEALTH_DB_ABORTED_CONNECTS_RATE_WARN_PER_MINUTE', 18, 1, 1000));
define('HEALTH_QUEUE_DEAD_WARN_THRESHOLD', splaro_env_int('HEALTH_QUEUE_DEAD_WARN_THRESHOLD', 1, 1, 1000));
define('HEALTH_QUEUE_DEAD_DOWN_WINDOW_MINUTES', splaro_env_int('HEALTH_QUEUE_DEAD_DOWN_WINDOW_MINUTES', 360, 1, 10080));
define('HEALTH_QUEUE_HISTORICAL_WARN_THRESHOLD', splaro_env_int('HEALTH_QUEUE_HISTORICAL_WARN_THRESHOLD', 25, 1, 50000));
define('HEALTH_PROBE_STALE_MINUTES', splaro_env_int('HEALTH_PROBE_STALE_MINUTES', 45, 5, 1440));
define('HEALTH_SHEETS_PROBE_RETRIES', splaro_env_int('HEALTH_SHEETS_PROBE_RETRIES', 2, 1, 3));

// Enterprise admin/security controls
define('ADMIN_IP_ALLOWLIST_ENFORCED', splaro_env_bool(['ADMIN_IP_ALLOWLIST_ENFORCED', 'IP_ALLOWLIST_ENFORCED'], false));
define('ADMIN_API_KEY_PREFIX', trim((string)env_or_default('ADMIN_API_KEY_PREFIX', 'splaro_live')));
define('ABANDONED_CART_MINUTES', splaro_env_int('ABANDONED_CART_MINUTES', 30, 5, 10080));
define('EXPORT_MAX_ROWS', splaro_env_int('EXPORT_MAX_ROWS', 5000, 100, 50000));

/**
 * Establish Security Handshake with MySQL Database
 */
function splaro_db_connection_hint_file() {
    $scopeKey = md5((string)DB_HOST . '|' . (string)DB_NAME . '|' . (string)DB_USER);
    return rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR
        . 'splaro_db_connection_hint_' . $scopeKey . '.json';
}

function splaro_db_read_connection_hint() {
    $file = splaro_db_connection_hint_file();
    if (!is_file($file)) {
        return [
            'host' => '',
            'password_source' => ''
        ];
    }
    $raw = @file_get_contents($file);
    $decoded = json_decode((string)$raw, true);
    if (!is_array($decoded)) {
        return [
            'host' => '',
            'password_source' => ''
        ];
    }
    return [
        'host' => trim((string)($decoded['host'] ?? '')),
        'password_source' => trim((string)($decoded['password_source'] ?? ''))
    ];
}

function splaro_db_write_connection_hint($host, $passwordSource) {
    $payload = [
        'host' => trim((string)$host),
        'password_source' => trim((string)$passwordSource),
        'updated_at' => date('c')
    ];
    @file_put_contents(
        splaro_db_connection_hint_file(),
        json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
        LOCK_EX
    );
}

function get_db_connection() {
    if (isset($GLOBALS['SPLARO_DB_CONNECTION']) && $GLOBALS['SPLARO_DB_CONNECTION'] instanceof PDO) {
        return $GLOBALS['SPLARO_DB_CONNECTION'];
    }

    if (DB_NAME === '' || DB_USER === '' || DB_PASSWORD === '') {
        $missing = [];
        if (DB_NAME === '') $missing[] = 'DB_NAME';
        if (DB_USER === '') $missing[] = 'DB_USER';
        if (DB_PASSWORD === '') $missing[] = 'DB_PASSWORD';
        $GLOBALS['SPLARO_DB_BOOTSTRAP_ERROR'] = [
            "message" => "DATABASE_ENV_NOT_CONFIGURED",
            "missing" => $missing
        ];
        error_log("SPLARO_DB_CONFIG_MISSING: " . implode(',', $missing));
        return null;
    }

    $hostFallbackRaw = trim((string)env_or_default('DB_HOST_FALLBACK', ''));
    $allowHostFallback = $hostFallbackRaw === ''
        ? in_array(DB_HOST, ['127.0.0.1', 'localhost'], true)
        : filter_var($hostFallbackRaw, FILTER_VALIDATE_BOOLEAN);
    $hostCandidates = [DB_HOST];
    if ($allowHostFallback) {
        if (DB_HOST === '127.0.0.1') {
            $hostCandidates[] = 'localhost';
        } elseif (DB_HOST === 'localhost') {
            $hostCandidates[] = '127.0.0.1';
        }
    }
    $hostCandidates = array_values(array_unique(array_filter($hostCandidates)));

    $connectionHint = DB_CONNECTION_HINTS_ENABLED ? splaro_db_read_connection_hint() : ['host' => '', 'password_source' => ''];
    $hintHost = trim((string)($connectionHint['host'] ?? ''));
    if ($hintHost !== '' && count($hostCandidates) > 1 && in_array($hintHost, $hostCandidates, true)) {
        $prioritizedHosts = [$hintHost];
        foreach ($hostCandidates as $candidateHost) {
            if ($candidateHost !== $hintHost) {
                $prioritizedHosts[] = $candidateHost;
            }
        }
        $hostCandidates = $prioritizedHosts;
    }

    $lastError = '';
    $lastSqlState = '';
    $lastPasswordSource = (string)($GLOBALS['SPLARO_DB_PASSWORD_SOURCE'] ?? 'EMPTY');
    $attemptedHosts = [];
    $passwordSourcesTried = [];
    $connectAttempts = 0;
    $connectRetries = 0;
    $dbSocket = trim((string)env_or_default('DB_SOCKET', ''));
    $passwordCandidates = $GLOBALS['SPLARO_DB_PASSWORD_CANDIDATES'] ?? [];
    if (!is_array($passwordCandidates) || empty($passwordCandidates)) {
        $passwordCandidates = [
            ['source' => (string)($GLOBALS['SPLARO_DB_PASSWORD_SOURCE'] ?? 'DB_PASSWORD'), 'value' => (string)DB_PASSWORD]
        ];
    }
    $hintPasswordSource = trim((string)($connectionHint['password_source'] ?? ''));
    if ($hintPasswordSource !== '' && count($passwordCandidates) > 1) {
        $preferredCandidates = [];
        $otherCandidates = [];
        foreach ($passwordCandidates as $candidate) {
            $source = trim((string)($candidate['source'] ?? ''));
            if ($source !== '' && hash_equals($hintPasswordSource, $source)) {
                $preferredCandidates[] = $candidate;
            } else {
                $otherCandidates[] = $candidate;
            }
        }
        if (!empty($preferredCandidates)) {
            $passwordCandidates = array_values(array_merge($preferredCandidates, $otherCandidates));
        }
    }

    $isTransientDbError = static function ($code, $message) {
        $code = strtoupper(trim((string)$code));
        $message = strtolower((string)$message);
        $transientCodes = [
            '1205', // lock wait timeout
            '1213', // deadlock
            '2002', // can't connect
            '2003', // can't connect to host
            '2006', // server has gone away
            '2013', // lost connection
            '1040', // too many connections
            '1158', '1159', '1160', '1161',
            '08S01'
        ];
        if (in_array($code, $transientCodes, true)) {
            return true;
        }
        $needles = [
            'server has gone away',
            'lost connection',
            'lock wait timeout',
            'deadlock found',
            'too many connections',
            'connection timed out',
            'network is unreachable',
            'temporarily unavailable'
        ];
        foreach ($needles as $needle) {
            if ($needle !== '' && strpos($message, $needle) !== false) {
                return true;
            }
        }
        return false;
    };

    $retryDelayMicroseconds = static function ($attemptNumber) {
        $attempt = (int)$attemptNumber;
        if ($attempt < 1) $attempt = 1;
        $base = (int)DB_RETRY_BASE_DELAY_MS;
        $delayMs = $base * (int)pow(2, max(0, $attempt - 1));
        if ($delayMs > 5000) $delayMs = 5000;
        return $delayMs * 1000;
    };

    $applySessionTimeouts = static function ($pdo) {
        try {
            $pdo->exec("SET SESSION innodb_lock_wait_timeout = " . (int)DB_LOCK_WAIT_TIMEOUT_SECONDS);
        } catch (\Throwable $e) {
            splaro_log_config_exception('db.connection.session.innodb_lock_wait_timeout', $e);
        }
        try {
            $pdo->exec("SET SESSION wait_timeout = " . (int)DB_IDLE_TIMEOUT_SECONDS);
            $pdo->exec("SET SESSION interactive_timeout = " . (int)DB_IDLE_TIMEOUT_SECONDS);
        } catch (\Throwable $e) {
            splaro_log_config_exception('db.connection.session.wait_timeout', $e);
        }
        try {
            $pdo->exec("SET SESSION MAX_EXECUTION_TIME = " . (int)DB_QUERY_TIMEOUT_MS);
        } catch (\Throwable $e) {
            splaro_log_config_exception('db.connection.session.max_execution_time', $e);
            try {
                $seconds = ((int)DB_QUERY_TIMEOUT_MS) / 1000;
                $pdo->exec("SET SESSION max_statement_time = " . number_format($seconds, 3, '.', ''));
            } catch (\Throwable $ignored) {
                splaro_log_config_exception('db.connection.session.max_statement_time', $ignored);
            }
        }
    };

    $maxRetries = (int)DB_RETRY_MAX;
    if ($maxRetries < 0) $maxRetries = 0;
    if ($maxRetries > 3) $maxRetries = 3;

    foreach ($hostCandidates as $host) {
        $attemptedHosts[] = $host;
        foreach ($passwordCandidates as $candidate) {
            $candidatePassword = (string)($candidate['value'] ?? '');
            $candidateSource = (string)($candidate['source'] ?? 'UNKNOWN');
            $passwordSourcesTried[] = $candidateSource;
            $attempt = 0;
            while (true) {
                $attempt++;
                $connectAttempts++;
                try {
                    if ($dbSocket !== '') {
                        $dsn = "mysql:unix_socket=" . $dbSocket . ";dbname=" . DB_NAME . ";charset=utf8mb4";
                    } elseif ($host === 'localhost') {
                        // Keep localhost socket-friendly on shared hosting; forcing port can route as 127.0.0.1.
                        $dsn = "mysql:host=localhost;dbname=" . DB_NAME . ";charset=utf8mb4";
                    } else {
                        $dsn = "mysql:host=" . $host . ";port=" . DB_PORT . ";dbname=" . DB_NAME . ";charset=utf8mb4";
                    }
                    $options = [
                        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                        PDO::ATTR_EMULATE_PREPARES   => false,
                        PDO::ATTR_TIMEOUT            => (int)DB_CONNECT_TIMEOUT_SECONDS,
                        PDO::ATTR_PERSISTENT         => (bool)DB_PERSISTENT,
                    ];
                    $pdo = new PDO($dsn, DB_USER, $candidatePassword, $options);
                    $applySessionTimeouts($pdo);
                    $GLOBALS['SPLARO_DB_CONNECTION'] = $pdo;
                    $GLOBALS['SPLARO_DB_CONNECTED_HOST'] = $host;
                    $GLOBALS['SPLARO_DB_PASSWORD_SOURCE'] = $candidateSource;
                    $GLOBALS['SPLARO_DB_CONNECT_ATTEMPTS'] = $connectAttempts;
                    $GLOBALS['SPLARO_DB_CONNECT_RETRIES'] = $connectRetries;
                    $GLOBALS['SPLARO_DB_PERSISTENT'] = (bool)DB_PERSISTENT;
                    if (DB_CONNECTION_HINTS_ENABLED) {
                        splaro_db_write_connection_hint($host, $candidateSource);
                    }
                    return $pdo;
                } catch (\PDOException $e) {
                    $lastError = $e->getMessage();
                    $lastSqlState = (string)$e->getCode();
                    $lastPasswordSource = $candidateSource;
                    $isTransient = $isTransientDbError($lastSqlState, $lastError);
                    splaro_log_config_exception('db.connection.connect', $e, [
                        'host' => (string)$host,
                        'password_source' => (string)$candidateSource,
                        'attempt' => (int)$attempt
                    ]);
                    error_log("SPLARO_DB_CONNECTION_ERROR[{$host}|{$candidateSource}|attempt={$attempt}]: " . $lastError);
                    if (!$isTransient || $attempt > $maxRetries) {
                        break;
                    }
                    $connectRetries++;
                    usleep($retryDelayMicroseconds($attempt));
                }
            }
        }
    }

    $GLOBALS['SPLARO_DB_BOOTSTRAP_ERROR'] = [
        "message" => "DATABASE_CONNECTION_FAILED",
        "code" => $lastSqlState,
        "reason" => $lastError,
        "passwordSource" => $lastPasswordSource,
        "passwordSourcesTried" => array_values(array_unique($passwordSourcesTried)),
        "hostsTried" => $attemptedHosts,
        "hostFallbackEnabled" => $allowHostFallback,
        "connectTimeoutSeconds" => (int)DB_CONNECT_TIMEOUT_SECONDS,
        "retryMax" => $maxRetries,
        "connectionAttempts" => $connectAttempts,
        "connectionRetries" => $connectRetries,
        "persistent" => (bool)DB_PERSISTENT,
        "hintHost" => $hintHost,
        "hintPasswordSource" => $hintPasswordSource
    ];
    $GLOBALS['SPLARO_DB_CONNECT_ATTEMPTS'] = $connectAttempts;
    $GLOBALS['SPLARO_DB_CONNECT_RETRIES'] = $connectRetries;
    $GLOBALS['SPLARO_DB_PERSISTENT'] = (bool)DB_PERSISTENT;
    return null;
}
