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
        splaro_log_exception('mail.smtp_settings_load', $e);
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
        splaro_log_exception('mail.send.primary', $e, [
            'to' => splaro_clip_text((string)$to, 120),
            'subject' => splaro_clip_text((string)$subject, 120)
        ]);

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
$__splaroRequestStartedAt = microtime(true);
if (defined('API_MAX_EXECUTION_SECONDS') && (int)API_MAX_EXECUTION_SECONDS > 0) {
    @ini_set('max_execution_time', (string)((int)API_MAX_EXECUTION_SECONDS));
    if (function_exists('set_time_limit')) {
        @set_time_limit((int)API_MAX_EXECUTION_SECONDS);
    }
}

function splaro_structured_log($event, $context = [], $level = 'INFO') {
    $payload = [
        'ts' => date('c'),
        'level' => strtoupper((string)$level),
        'event' => (string)$event,
        'context' => is_array($context) ? $context : ['value' => $context],
    ];
    $json = json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if (is_string($json) && $json !== '') {
        error_log('SPLARO_LOG ' . $json);
    } else {
        error_log('SPLARO_LOG {"event":"LOG_ENCODING_FAILED","json_error":"' . addslashes((string)json_last_error_msg()) . '"}');
    }
}

function splaro_clip_text($value, $max = 300) {
    if (!is_scalar($value) && $value !== null) {
        $encoded = json_encode($value, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        if (!is_string($encoded)) {
            splaro_integration_trace('utils.clip_text.encode_failed', [
                'json_error' => json_last_error_msg()
            ], 'ERROR');
            $encoded = '[unencodable]';
        }
        $value = $encoded;
    }
    $text = trim((string)$value);
    if ($text === '') {
        return '';
    }
    $limit = (int)$max;
    if ($limit < 50) $limit = 50;
    if (function_exists('mb_substr') && mb_strlen($text, 'UTF-8') > $limit) {
        return mb_substr($text, 0, $limit, 'UTF-8') . '…';
    }
    if (strlen($text) > $limit) {
        return substr($text, 0, $limit) . '…';
    }
    return $text;
}

function splaro_request_trace_id() {
    static $traceId = null;
    if (is_string($traceId) && $traceId !== '') {
        return $traceId;
    }

    $headerTrace = trim((string)($_SERVER['HTTP_X_REQUEST_ID'] ?? ''));
    if ($headerTrace === '') {
        $headerTrace = trim((string)($_SERVER['HTTP_X_TRACE_ID'] ?? ''));
    }
    if ($headerTrace !== '') {
        $traceId = preg_replace('/[^A-Za-z0-9._:-]/', '', $headerTrace);
        if ($traceId !== '') {
            $GLOBALS['SPLARO_TRACE_ID'] = $traceId;
            return $traceId;
        }
    }

    try {
        $traceId = 'splaro_' . bin2hex(random_bytes(8));
    } catch (Throwable $e) {
        splaro_log_exception('request.trace_id.random_bytes', $e);
        $traceId = 'splaro_' . uniqid('', true);
    }
    $GLOBALS['SPLARO_TRACE_ID'] = $traceId;
    return $traceId;
}

function splaro_integration_trace($stage, $context = [], $level = 'DEBUG') {
    $enabled = splaro_env_bool('INTEGRATION_TRACE_ENABLED', true);
    if (!$enabled) {
        return;
    }

    $payload = is_array($context) ? $context : ['value' => $context];
    $payload['trace_id'] = splaro_request_trace_id();
    $payload['action'] = (string)($_GET['action'] ?? '');
    $payload['method'] = (string)($_SERVER['REQUEST_METHOD'] ?? '');
    splaro_structured_log('integration.' . (string)$stage, $payload, $level);
}

function splaro_log_exception($stage, $exception, $context = [], $level = 'ERROR') {
    if (!($exception instanceof Throwable)) {
        splaro_integration_trace($stage . '.exception_invalid', ['exception' => (string)$exception], $level);
        return;
    }
    $payload = is_array($context) ? $context : ['value' => $context];
    $payload['error_message'] = $exception->getMessage();
    $payload['error_file'] = $exception->getFile();
    $payload['error_line'] = $exception->getLine();
    $payload['stack_trace'] = splaro_clip_text($exception->getTraceAsString(), 1200);
    splaro_integration_trace($stage . '.exception', $payload, $level);
}

register_shutdown_function(function () use ($method, $action, $__splaroRequestStartedAt) {
    if (!defined('LOG_REQUEST_METRICS') || !LOG_REQUEST_METRICS) {
        if (isset($GLOBALS['SPLARO_DB_CONNECTION']) && $GLOBALS['SPLARO_DB_CONNECTION'] instanceof PDO) {
            $GLOBALS['SPLARO_DB_CONNECTION'] = null;
        }
        return;
    }
    $durationMs = (int)round((microtime(true) - $__splaroRequestStartedAt) * 1000);
    $statusCode = http_response_code();
    if (!$statusCode) $statusCode = 200;
    $dbConnected = isset($GLOBALS['SPLARO_DB_CONNECTION']) && $GLOBALS['SPLARO_DB_CONNECTION'] instanceof PDO;
    splaro_structured_log('api.request', [
        'method' => (string)$method,
        'action' => (string)$action,
        'status' => (int)$statusCode,
        'duration_ms' => $durationMs,
        'storage' => $dbConnected ? 'mysql' : 'fallback',
        'db' => [
            'host' => (string)($GLOBALS['SPLARO_DB_CONNECTED_HOST'] ?? DB_HOST),
            'persistent' => (bool)($GLOBALS['SPLARO_DB_PERSISTENT'] ?? DB_PERSISTENT),
            'pool_target' => (int)DB_POOL_TARGET,
            'connect_attempts' => (int)($GLOBALS['SPLARO_DB_CONNECT_ATTEMPTS'] ?? 0),
            'connect_retries' => (int)($GLOBALS['SPLARO_DB_CONNECT_RETRIES'] ?? 0),
        ]
    ]);
    if (isset($GLOBALS['SPLARO_DB_CONNECTION']) && $GLOBALS['SPLARO_DB_CONNECTION'] instanceof PDO) {
        $GLOBALS['SPLARO_DB_CONNECTION'] = null;
    }
});

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
    if (isset($bootstrapError['code']) && $bootstrapError['code'] !== '') {
        $safeDbStatus['code'] = (string)$bootstrapError['code'];
    }
    if (!empty($bootstrapError['hostsTried']) && is_array($bootstrapError['hostsTried'])) {
        $safeDbStatus['hostsTried'] = array_values($bootstrapError['hostsTried']);
    }
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
        splaro_log_exception('schema.ensure_table', $e, [
            'table' => (string)$table
        ], 'WARNING');
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
        splaro_log_exception('schema.ensure_column', $e, [
            'table' => (string)$table,
            'column' => (string)$column
        ], 'WARNING');
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
        splaro_log_exception('schema.ensure_index', $e, [
            'table' => (string)$table,
            'index_name' => (string)$indexName
        ], 'WARNING');
    }
}

function safe_query_all($db, $sql, $params = []) {
    $applySelectTimeoutHint = static function ($query) {
        $query = (string)$query;
        if (!defined('DB_QUERY_TIMEOUT_MS') || (int)DB_QUERY_TIMEOUT_MS <= 0) {
            return $query;
        }
        if (!preg_match('/^\s*SELECT\b/i', $query)) {
            return $query;
        }
        if (stripos($query, 'MAX_EXECUTION_TIME') !== false) {
            return $query;
        }
        return preg_replace('/^\s*SELECT\b/i', 'SELECT /*+ MAX_EXECUTION_TIME(' . (int)DB_QUERY_TIMEOUT_MS . ') */', $query, 1);
    };

    $attempt = 0;
    $maxRetries = defined('DB_RETRY_MAX') ? (int)DB_RETRY_MAX : 0;
    if ($maxRetries < 0) $maxRetries = 0;
    if ($maxRetries > 3) $maxRetries = 3;
    $querySql = $applySelectTimeoutHint($sql);
    while (true) {
        $attempt++;
        $startedAt = microtime(true);
        try {
            $stmt = $db->prepare($querySql);
            $stmt->execute($params);
            $rows = $stmt->fetchAll();
            $durationMs = (int)round((microtime(true) - $startedAt) * 1000);
            if (defined('DB_SLOW_QUERY_MS') && $durationMs >= (int)DB_SLOW_QUERY_MS) {
                splaro_structured_log('db.slow_query', [
                    'duration_ms' => $durationMs,
                    'query_kind' => 'fetch_all',
                    'attempt' => $attempt
                ], 'WARN');
            }
            return $rows;
        } catch (Throwable $e) {
            $message = (string)$e->getMessage();
            $code = strtoupper(trim((string)$e->getCode()));
            $lower = strtolower($message);
            $isTransient = in_array($code, ['1205', '1213', '2006', '2013', '1040', '08S01'], true)
                || strpos($lower, 'server has gone away') !== false
                || strpos($lower, 'lost connection') !== false
                || strpos($lower, 'deadlock found') !== false
                || strpos($lower, 'lock wait timeout') !== false
                || strpos($lower, 'too many connections') !== false;
            if ($isTransient && $attempt <= $maxRetries) {
                $baseDelay = defined('DB_RETRY_BASE_DELAY_MS') ? (int)DB_RETRY_BASE_DELAY_MS : 120;
                $delayMs = $baseDelay * (int)pow(2, max(0, $attempt - 1));
                if ($delayMs > 5000) $delayMs = 5000;
                usleep($delayMs * 1000);
                continue;
            }
            error_log('SPLARO_SAFE_QUERY_FAILED: ' . $message . ' | SQL=' . $querySql);
            splaro_log_exception('db.safe_query_all', $e, [
                'attempt' => (int)$attempt,
                'query_preview' => splaro_clip_text((string)$querySql, 240)
            ]);
            return [];
        }
    }
}

function safe_query_count($db, $sql, $params = []) {
    $applySelectTimeoutHint = static function ($query) {
        $query = (string)$query;
        if (!defined('DB_QUERY_TIMEOUT_MS') || (int)DB_QUERY_TIMEOUT_MS <= 0) {
            return $query;
        }
        if (!preg_match('/^\s*SELECT\b/i', $query)) {
            return $query;
        }
        if (stripos($query, 'MAX_EXECUTION_TIME') !== false) {
            return $query;
        }
        return preg_replace('/^\s*SELECT\b/i', 'SELECT /*+ MAX_EXECUTION_TIME(' . (int)DB_QUERY_TIMEOUT_MS . ') */', $query, 1);
    };

    $attempt = 0;
    $maxRetries = defined('DB_RETRY_MAX') ? (int)DB_RETRY_MAX : 0;
    if ($maxRetries < 0) $maxRetries = 0;
    if ($maxRetries > 3) $maxRetries = 3;
    $querySql = $applySelectTimeoutHint($sql);
    while (true) {
        $startedAt = microtime(true);
        $attempt++;
        try {
            $stmt = $db->prepare($querySql);
            $stmt->execute($params);
            $count = (int)$stmt->fetchColumn();
            $durationMs = (int)round((microtime(true) - $startedAt) * 1000);
            if (defined('DB_SLOW_QUERY_MS') && $durationMs >= (int)DB_SLOW_QUERY_MS) {
                splaro_structured_log('db.slow_query', [
                    'duration_ms' => $durationMs,
                    'query_kind' => 'count',
                    'attempt' => $attempt
                ], 'WARN');
            }
            return $count;
        } catch (Throwable $e) {
            $message = (string)$e->getMessage();
            $code = strtoupper(trim((string)$e->getCode()));
            $lower = strtolower($message);
            $isTransient = in_array($code, ['1205', '1213', '2006', '2013', '1040', '08S01'], true)
                || strpos($lower, 'server has gone away') !== false
                || strpos($lower, 'lost connection') !== false
                || strpos($lower, 'deadlock found') !== false
                || strpos($lower, 'lock wait timeout') !== false
                || strpos($lower, 'too many connections') !== false;
            if ($isTransient && $attempt <= $maxRetries) {
                $baseDelay = defined('DB_RETRY_BASE_DELAY_MS') ? (int)DB_RETRY_BASE_DELAY_MS : 120;
                $delayMs = $baseDelay * (int)pow(2, max(0, $attempt - 1));
                if ($delayMs > 5000) $delayMs = 5000;
                usleep($delayMs * 1000);
                continue;
            }
            error_log('SPLARO_SAFE_COUNT_FAILED: ' . $message . ' | SQL=' . $querySql);
            splaro_log_exception('db.safe_query_count', $e, [
                'attempt' => (int)$attempt,
                'query_preview' => splaro_clip_text((string)$querySql, 240)
            ]);
            return 0;
        }
    }
}

function column_exists($db, $table, $column) {
    try {
        $stmt = $db->prepare("SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?");
        $stmt->execute([$table, $column]);
        return ((int)$stmt->fetchColumn()) > 0;
    } catch (Exception $e) {
        error_log("SPLARO_SCHEMA_WARNING: column_exists failed for {$table}.{$column} -> " . $e->getMessage());
        splaro_log_exception('schema.column_exists', $e, [
            'table' => (string)$table,
            'column' => (string)$column
        ], 'WARNING');
        return false;
    }
}

function get_table_columns_cached($db, $table) {
    static $cache = [];
    $key = strtolower((string)$table);
    if (isset($cache[$key]) && is_array($cache[$key])) {
        return $cache[$key];
    }
    $columns = [];
    try {
        $stmt = $db->prepare("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?");
        $stmt->execute([$table]);
        $rows = $stmt->fetchAll();
        foreach ($rows as $row) {
            $name = strtolower((string)($row['COLUMN_NAME'] ?? ''));
            if ($name !== '') {
                $columns[$name] = true;
            }
        }
    } catch (Exception $e) {
        error_log("SPLARO_SCHEMA_WARNING: get_table_columns failed for {$table} -> " . $e->getMessage());
        splaro_log_exception('schema.get_table_columns_cached', $e, [
            'table' => (string)$table
        ], 'WARNING');
    }
    $cache[$key] = $columns;
    return $columns;
}

function build_select_fields($db, $table, array $preferredColumns, $fallback = '*') {
    $existing = get_table_columns_cached($db, $table);
    $selected = [];
    foreach ($preferredColumns as $column) {
        $name = trim((string)$column);
        if ($name === '') continue;
        if (!empty($existing[strtolower($name)])) {
            $selected[] = $name;
        }
    }
    if (!empty($selected)) {
        return implode(', ', $selected);
    }
    return $fallback;
}

function users_sensitive_select_fields($db) {
    return build_select_fields($db, 'users', [
        'id', 'name', 'email', 'phone', 'address', 'profile_image',
        'password', 'role', 'reset_code', 'reset_expiry', 'created_at',
        'last_password_change_at', 'force_relogin', 'two_factor_enabled',
        'two_factor_secret', 'notification_email', 'notification_sms',
        'preferred_language', 'default_shipping_address'
    ]);
}

function site_settings_select_fields($db) {
    return build_select_fields($db, 'site_settings', [
        'id', 'site_name', 'maintenance_mode', 'support_email', 'support_phone',
        'whatsapp_number', 'facebook_link', 'instagram_link', 'logo_url',
        'smtp_settings', 'logistics_config', 'hero_slides', 'content_pages',
        'story_posts', 'campaigns_data', 'settings_json', 'google_client_id'
    ]);
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

    // Backfill columns for legacy products schema on older Hostinger databases.
    ensure_column($db, 'products', 'slug', "varchar(255) DEFAULT NULL");
    ensure_column($db, 'products', 'brand_slug', "varchar(120) DEFAULT NULL");
    ensure_column($db, 'products', 'discount_price', "int(11) DEFAULT NULL");
    ensure_column($db, 'products', 'discount_starts_at', "datetime DEFAULT NULL");
    ensure_column($db, 'products', 'discount_ends_at', "datetime DEFAULT NULL");
    ensure_column($db, 'products', 'main_image_id', "varchar(80) DEFAULT NULL");
    ensure_column($db, 'products', 'category_slug', "varchar(120) DEFAULT NULL");
    ensure_column($db, 'products', 'color_variants', "longtext DEFAULT NULL");
    ensure_column($db, 'products', 'materials', "longtext DEFAULT NULL");
    ensure_column($db, 'products', 'tags', "longtext DEFAULT NULL");
    ensure_column($db, 'products', 'sku', "varchar(100) DEFAULT NULL");
    ensure_column($db, 'products', 'barcode', "varchar(120) DEFAULT NULL");
    ensure_column($db, 'products', 'stock', "int(11) DEFAULT 50");
    ensure_column($db, 'products', 'low_stock_threshold', "int(11) DEFAULT NULL");
    ensure_column($db, 'products', 'status', "varchar(20) DEFAULT 'PUBLISHED'");
    ensure_column($db, 'products', 'hide_when_out_of_stock', "tinyint(1) DEFAULT 0");
    ensure_column($db, 'products', 'weight', "varchar(50) DEFAULT NULL");
    ensure_column($db, 'products', 'dimensions', "longtext DEFAULT NULL");
    ensure_column($db, 'products', 'variations', "longtext DEFAULT NULL");
    ensure_column($db, 'products', 'additional_images', "longtext DEFAULT NULL");
    ensure_column($db, 'products', 'size_chart_image', "text DEFAULT NULL");
    ensure_column($db, 'products', 'discount_percentage', "int(11) DEFAULT NULL");
    ensure_column($db, 'products', 'sub_category', "varchar(100) DEFAULT NULL");
    ensure_column($db, 'products', 'sub_category_slug', "varchar(120) DEFAULT NULL");
    ensure_column($db, 'products', 'product_url', "text DEFAULT NULL");

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
    ensure_index($db, 'orders', 'idx_orders_status', 'CREATE INDEX idx_orders_status ON orders(status)');
    ensure_index($db, 'orders', 'idx_orders_user_created', 'CREATE INDEX idx_orders_user_created ON orders(user_id, created_at)');
    ensure_index($db, 'orders', 'idx_orders_email_created', 'CREATE INDEX idx_orders_email_created ON orders(customer_email, created_at)');
    ensure_index($db, 'orders', 'idx_orders_tracking_number', 'CREATE INDEX idx_orders_tracking_number ON orders(tracking_number)');
    ensure_index($db, 'subscriptions', 'idx_subscriptions_email', 'CREATE INDEX idx_subscriptions_email ON subscriptions(email)');
    ensure_index($db, 'subscriptions', 'idx_subscriptions_created_at', 'CREATE INDEX idx_subscriptions_created_at ON subscriptions(created_at)');
    ensure_index($db, 'products', 'idx_products_created_at', 'CREATE INDEX idx_products_created_at ON products(created_at)');
    ensure_index($db, 'products', 'idx_products_slug', 'CREATE INDEX idx_products_slug ON products(slug)');
    ensure_index($db, 'products', 'idx_products_brand_slug', 'CREATE INDEX idx_products_brand_slug ON products(brand_slug)');
    ensure_index($db, 'products', 'idx_products_category_slug', 'CREATE INDEX idx_products_category_slug ON products(category_slug)');
    ensure_index($db, 'products', 'idx_products_sub_category_slug', 'CREATE INDEX idx_products_sub_category_slug ON products(sub_category_slug)');
    ensure_index($db, 'products', 'idx_products_status', 'CREATE INDEX idx_products_status ON products(status)');
    ensure_index($db, 'products', 'idx_products_category_type', 'CREATE INDEX idx_products_category_type ON products(category, type)');
    ensure_index($db, 'products', 'idx_products_status_created', 'CREATE INDEX idx_products_status_created ON products(status, created_at)');
    ensure_index($db, 'products', 'idx_products_stock_status', 'CREATE INDEX idx_products_stock_status ON products(stock, status)');
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
        splaro_log_exception('schema.ensure_core_schema', $e, [], 'WARNING');
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
        splaro_log_exception('smtp.settings.load', $e, [], 'WARNING');
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
        splaro_log_exception('invoice.pdf.dompdf', $e, ['target_path' => (string)$targetPath], 'WARNING');
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
        splaro_log_exception('invoice.pdf.mpdf', $e, ['target_path' => (string)$targetPath], 'WARNING');
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
        splaro_log_exception('invoice.serial.allocate', $e, ['type_code' => (string)$typeCode]);
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
    splaro_integration_trace('telegram.http.prepare', [
        'endpoint' => (string)$endpoint,
        'timeout_seconds' => (int)$timeoutSeconds,
        'payload_keys' => is_array($payload) ? array_keys($payload) : []
    ]);
    $jsonPayload = json_encode($payload);

    if ($jsonPayload === false) {
        splaro_integration_trace('telegram.http.json_encode_failed', [
            'endpoint' => (string)$endpoint,
            'json_error' => json_last_error_msg()
        ], 'ERROR');
        return [false, 0, 'JSON_ENCODE_FAILED'];
    }

    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        $connectTimeout = max(1, min((int)$timeoutSeconds, 3));
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
            CURLOPT_POSTFIELDS => $jsonPayload,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => $connectTimeout,
            CURLOPT_TIMEOUT => $timeoutSeconds,
            CURLOPT_NOSIGNAL => 1,
            CURLOPT_TCP_KEEPALIVE => 1,
            CURLOPT_LOW_SPEED_LIMIT => 1,
            CURLOPT_LOW_SPEED_TIME => $timeoutSeconds,
        ]);

        splaro_integration_trace('telegram.http.curl.before_exec', [
            'endpoint' => (string)$endpoint,
            'connect_timeout_seconds' => (int)$connectTimeout,
            'timeout_seconds' => (int)$timeoutSeconds
        ]);
        $responseBody = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlErrNo = curl_errno($ch);
        $curlError = curl_error($ch);
        $sslVerifyResult = defined('CURLINFO_SSL_VERIFYRESULT') ? curl_getinfo($ch, CURLINFO_SSL_VERIFYRESULT) : null;
        curl_close($ch);

        splaro_integration_trace('telegram.http.curl.after_exec', [
            'endpoint' => (string)$endpoint,
            'http_code' => (int)$httpCode,
            'curl_errno' => (int)$curlErrNo,
            'curl_error' => (string)$curlError,
            'ssl_verify_result' => $sslVerifyResult,
            'response_preview' => splaro_clip_text($responseBody, 300)
        ], ($responseBody === false || $httpCode < 200 || $httpCode >= 300) ? 'ERROR' : 'INFO');

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

    splaro_integration_trace('telegram.http.stream.before_exec', [
        'endpoint' => (string)$endpoint,
        'timeout_seconds' => (int)$timeoutSeconds
    ]);
    $responseBody = @file_get_contents($url, false, $context);
    $responseHeaders = function_exists('http_get_last_response_headers')
        ? http_get_last_response_headers()
        : ($GLOBALS['http_response_header'] ?? []);
    $httpCode = 0;
    if (!empty($responseHeaders[0]) && preg_match('/\s(\d{3})\s/', $responseHeaders[0], $m)) {
        $httpCode = (int)$m[1];
    }

    splaro_integration_trace('telegram.http.stream.after_exec', [
        'endpoint' => (string)$endpoint,
        'http_code' => (int)$httpCode,
        'response_preview' => splaro_clip_text($responseBody, 300),
        'headers_preview' => splaro_clip_text(json_encode($responseHeaders), 300)
    ], ($responseBody === false || $httpCode < 200 || $httpCode >= 300) ? 'ERROR' : 'INFO');

    if ($responseBody === false) {
        return [false, $httpCode, 'STREAM_REQUEST_FAILED'];
    }

    return [$responseBody, $httpCode, ''];
}

function send_telegram_message($text, $targetChatId = null, $options = []) {
    if (!TELEGRAM_ENABLED) {
        splaro_integration_trace('telegram.send.skipped', ['reason' => 'TELEGRAM_DISABLED'], 'WARNING');
        return false;
    }

    $chatId = $targetChatId ?: telegram_primary_admin_chat_id();
    if (!$chatId) {
        splaro_integration_trace('telegram.send.skipped', ['reason' => 'CHAT_ID_MISSING'], 'WARNING');
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
        splaro_integration_trace('telegram.send.attempt', [
            'attempt' => (int)$attempt,
            'max_attempts' => (int)$maxAttempts,
            'chat_id_preview' => splaro_clip_text((string)$chatId, 40),
            'text_preview' => splaro_clip_text((string)$text, 180)
        ]);

        [$response, $httpCode, $requestError] = telegram_api_request('sendMessage', $payload, 5);

        $responseDecoded = null;
        if ($response !== false && is_string($response) && $response !== '') {
            $responseDecoded = json_decode($response, true);
            if ($responseDecoded === null && json_last_error() !== JSON_ERROR_NONE) {
                splaro_integration_trace('telegram.send.response_decode_failed', [
                    'attempt' => (int)$attempt,
                    'http_code' => (int)$httpCode,
                    'json_error' => json_last_error_msg(),
                    'response_preview' => splaro_clip_text($response, 300)
                ], 'ERROR');
            }
        }

        $telegramOk = true;
        if (is_array($responseDecoded) && array_key_exists('ok', $responseDecoded)) {
            $telegramOk = (bool)$responseDecoded['ok'];
        }
        if ($response !== false && $httpCode >= 200 && $httpCode < 300 && $telegramOk) {
            splaro_integration_trace('telegram.send.success', [
                'attempt' => (int)$attempt,
                'http_code' => (int)$httpCode,
                'response_preview' => splaro_clip_text($response, 300)
            ]);
            return true;
        }

        splaro_integration_trace('telegram.send.failed_attempt', [
            'attempt' => (int)$attempt,
            'http_code' => (int)$httpCode,
            'request_error' => (string)$requestError,
            'telegram_ok' => (bool)$telegramOk,
            'response_preview' => splaro_clip_text($response, 300)
        ], 'ERROR');

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

function telegram_admin_chat_allowlist() {
    static $allowlist = null;
    if (is_array($allowlist)) {
        return $allowlist;
    }

    $rawParts = [];
    if (defined('TELEGRAM_ADMIN_CHAT_ALLOWLIST_RAW')) {
        $rawParts[] = (string)TELEGRAM_ADMIN_CHAT_ALLOWLIST_RAW;
    }
    if (defined('TELEGRAM_ADMIN_CHAT_ID')) {
        $rawParts[] = (string)TELEGRAM_ADMIN_CHAT_ID;
    }

    $resolved = [];
    foreach ($rawParts as $raw) {
        $parts = preg_split('/[\s,]+/', trim((string)$raw));
        if (!is_array($parts)) {
            continue;
        }
        foreach ($parts as $part) {
            $candidate = trim((string)$part);
            if ($candidate === '') {
                continue;
            }
            if (!in_array($candidate, $resolved, true)) {
                $resolved[] = $candidate;
            }
        }
    }
    $allowlist = $resolved;
    return $allowlist;
}

function telegram_primary_admin_chat_id() {
    $allowlist = telegram_admin_chat_allowlist();
    return (string)($allowlist[0] ?? '');
}

function is_telegram_admin_chat($chatId) {
    $chat = trim((string)$chatId);
    if ($chat === '') {
        return false;
    }
    foreach (telegram_admin_chat_allowlist() as $allowlistedId) {
        if (hash_equals((string)$allowlistedId, $chat)) {
            return true;
        }
    }
    return false;
}

function telegram_order_status_key_to_label($statusKey) {
    $map = [
        'PENDING' => 'Pending',
        'PROCESSING' => 'Processing',
        'SHIPPED' => 'Shipped',
        'DELIVERED' => 'Delivered',
        'CANCELLED' => 'Cancelled',
    ];
    $normalized = strtoupper(trim((string)$statusKey));
    return $map[$normalized] ?? '';
}

function telegram_order_action_keyboard($orderId) {
    $id = trim((string)$orderId);
    if ($id === '') {
        return [];
    }
    return [
        'inline_keyboard' => [
            [
                ['text' => 'Processing', 'callback_data' => "ordst|{$id}|PROCESSING"],
                ['text' => 'Shipped', 'callback_data' => "ordst|{$id}|SHIPPED"]
            ],
            [
                ['text' => 'Delivered', 'callback_data' => "ordst|{$id}|DELIVERED"],
                ['text' => 'Cancel', 'callback_data' => "ordst|{$id}|CANCELLED"]
            ],
            [
                ['text' => 'Refresh', 'callback_data' => "ordrf|{$id}"],
                ['text' => 'Back', 'callback_data' => 'menu|home']
            ]
        ]
    ];
}

function telegram_main_inline_keyboard() {
    return [
        'inline_keyboard' => [
            [
                ['text' => 'Orders', 'callback_data' => 'ordpg|1|5'],
                ['text' => 'Health', 'callback_data' => 'sys|health']
            ],
            [
                ['text' => 'Refresh', 'callback_data' => 'menu|home']
            ]
        ]
    ];
}

function telegram_orders_pagination_keyboard($page, $limit, $hasNext) {
    $currentPage = max(1, (int)$page);
    $pageLimit = max(1, min(10, (int)$limit));
    $navRow = [];
    if ($currentPage > 1) {
        $navRow[] = ['text' => 'Prev', 'callback_data' => 'ordpg|' . ($currentPage - 1) . '|' . $pageLimit];
    }
    if ($hasNext) {
        $navRow[] = ['text' => 'Next', 'callback_data' => 'ordpg|' . ($currentPage + 1) . '|' . $pageLimit];
    }
    $rows = [];
    if (!empty($navRow)) {
        $rows[] = $navRow;
    }
    $rows[] = [
        ['text' => 'Refresh', 'callback_data' => 'ordpg|' . $currentPage . '|' . $pageLimit],
        ['text' => 'Back', 'callback_data' => 'menu|home']
    ];
    return ['inline_keyboard' => $rows];
}

function telegram_compact_order_message($title, $orderId, $customerName, $phone, $total, $statusLabel, $createdAt = '') {
    $lines = [
        '<b>' . telegram_escape_html($title) . '</b>',
        '#' . telegram_escape_html($orderId) . ' • ৳' . telegram_escape_html($total),
        telegram_escape_html($customerName) . ' • ' . telegram_escape_html($phone),
        'Status: ' . telegram_escape_html($statusLabel)
    ];
    if ($createdAt !== '') {
        $lines[] = 'Time: ' . telegram_escape_html($createdAt);
    }
    return implode("\n", $lines);
}

function telegram_compact_signup_message($userId, $name, $email, $phone, $createdAt = '') {
    $lines = [
        '<b>✅ New Signup</b>',
        '#' . telegram_escape_html($userId),
        telegram_escape_html($name),
        telegram_escape_html($email),
        telegram_escape_html($phone)
    ];
    if ($createdAt !== '') {
        $lines[] = 'Time: ' . telegram_escape_html($createdAt);
    }
    return implode("\n", $lines);
}

function telegram_load_order_details($db, $orderId) {
    $id = trim((string)$orderId);
    if ($id === '') {
        return [
            'ok' => false,
            'text' => '<b>Order ID required.</b>',
            'options' => ['reply_markup' => telegram_main_inline_keyboard()]
        ];
    }

    $selectFields = build_select_fields($db, 'orders', [
        'id', 'customer_name', 'phone', 'status', 'total', 'created_at', 'address', 'district', 'thana'
    ]);
    $stmt = $db->prepare("SELECT {$selectFields} FROM orders WHERE id = ? LIMIT 1");
    $stmt->execute([$id]);
    $order = $stmt->fetch();
    if (!$order) {
        return [
            'ok' => false,
            'text' => '<b>Order not found:</b> ' . telegram_escape_html($id),
            'options' => ['reply_markup' => telegram_main_inline_keyboard()]
        ];
    }

    $text = telegram_compact_order_message(
        'Order Details',
        (string)($order['id'] ?? ''),
        (string)($order['customer_name'] ?? 'N/A'),
        (string)($order['phone'] ?? 'N/A'),
        (string)($order['total'] ?? '0'),
        (string)($order['status'] ?? 'Pending'),
        (string)($order['created_at'] ?? '')
    ) . "\n"
        . 'Area: ' . telegram_escape_html(($order['district'] ?? '') . ' / ' . ($order['thana'] ?? ''))
        . "\n"
        . 'Address: ' . telegram_escape_html((string)($order['address'] ?? 'N/A'));

    return [
        'ok' => true,
        'text' => $text,
        'options' => ['reply_markup' => telegram_order_action_keyboard($id)]
    ];
}

function telegram_build_orders_page($db, $page = 1, $limit = 5) {
    $currentPage = max(1, (int)$page);
    $pageLimit = max(1, min(10, (int)$limit));
    $offset = ($currentPage - 1) * $pageLimit;
    $fetchLimit = $pageLimit + 1;

    $stmt = $db->prepare("SELECT id, customer_name, phone, total, status, created_at FROM orders ORDER BY created_at DESC LIMIT ? OFFSET ?");
    $stmt->bindValue(1, $fetchLimit, PDO::PARAM_INT);
    $stmt->bindValue(2, $offset, PDO::PARAM_INT);
    $stmt->execute();
    $rows = $stmt->fetchAll();
    if (!is_array($rows)) {
        $rows = [];
    }

    $hasNext = count($rows) > $pageLimit;
    if ($hasNext) {
        array_pop($rows);
    }

    if (empty($rows)) {
        return [
            'text' => '<b>No orders found.</b>',
            'options' => ['reply_markup' => telegram_orders_pagination_keyboard($currentPage, $pageLimit, false)]
        ];
    }

    $lines = ['<b>Orders Page ' . $currentPage . '</b>'];
    $inlineRows = [];
    foreach ($rows as $row) {
        $id = (string)($row['id'] ?? '');
        $lines[] = '• #' . telegram_escape_html($id)
            . ' | ' . telegram_escape_html((string)($row['status'] ?? 'Pending'))
            . ' | ৳' . telegram_escape_html((string)($row['total'] ?? '0'));
        if ($id !== '') {
            $inlineRows[] = [
                ['text' => '#' . $id . ' details', 'callback_data' => 'ordrf|' . $id]
            ];
        }
    }

    $paginationKeyboard = telegram_orders_pagination_keyboard($currentPage, $pageLimit, $hasNext);
    foreach (($paginationKeyboard['inline_keyboard'] ?? []) as $row) {
        $inlineRows[] = $row;
    }

    return [
        'text' => implode("\n", $lines),
        'options' => ['reply_markup' => ['inline_keyboard' => $inlineRows]]
    ];
}

function telegram_answer_callback_query($callbackQueryId, $text = '', $showAlert = false) {
    $id = trim((string)$callbackQueryId);
    if ($id === '') {
        return false;
    }
    $payload = [
        'callback_query_id' => $id,
        'show_alert' => (bool)$showAlert
    ];
    $text = trim((string)$text);
    if ($text !== '') {
        $payload['text'] = splaro_clip_text($text, 180);
    }
    [$response, $httpCode, $requestError] = telegram_api_request('answerCallbackQuery', $payload, 5);
    if ($response === false || $httpCode < 200 || $httpCode >= 300) {
        splaro_integration_trace('telegram.callback.answer_failed', [
            'http_code' => (int)$httpCode,
            'request_error' => (string)$requestError,
            'callback_query_id_preview' => splaro_clip_text($id, 32)
        ], 'ERROR');
        return false;
    }
    return true;
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

function enforce_global_request_guard($method, $action, $requestAuthUser = null) {
    $method = strtoupper((string)$method);
    $action = strtolower(trim((string)$action));

    if ($method === 'OPTIONS' || $action === 'health') {
        return;
    }

    $windowSeconds = defined('RATE_LIMIT_WINDOW_SECONDS') ? (int)RATE_LIMIT_WINDOW_SECONDS : 60;
    if ($windowSeconds < 1) $windowSeconds = 60;

    $isAdmin = is_admin_authenticated($requestAuthUser);
    $globalMax = $isAdmin
        ? (defined('ADMIN_RATE_LIMIT_MAX') ? (int)ADMIN_RATE_LIMIT_MAX : 240)
        : (defined('RATE_LIMIT_MAX') ? (int)RATE_LIMIT_MAX : 120);

    if (is_rate_limited('global_' . strtolower($method), $globalMax, $windowSeconds)) {
        http_response_code(429);
        echo json_encode(["status" => "error", "message" => "GLOBAL_RATE_LIMIT_EXCEEDED"]);
        exit;
    }

    $heavyActions = ['sync', 'process_sync_queue', 'sync_queue_status'];
    if (in_array($action, $heavyActions, true)) {
        $heavyMax = defined('HEAVY_READ_RATE_LIMIT_MAX') ? (int)HEAVY_READ_RATE_LIMIT_MAX : 40;
        if (is_rate_limited('heavy_' . $action, $heavyMax, $windowSeconds)) {
            http_response_code(429);
            echo json_encode(["status" => "error", "message" => "RATE_LIMIT_EXCEEDED"]);
            exit;
        }
    }
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
        splaro_log_exception('system_log.insert', $e, [
            'event_type' => (string)$eventType
        ]);
    }
}

function log_audit_event($db, $actorId, $action, $entityType, $entityId = null, $before = null, $after = null, $ip = null) {
    if (!$db) {
        return;
    }
    try {
        $beforeJson = null;
        if ($before !== null) {
            $beforeJson = json_encode($before);
            if (!is_string($beforeJson)) {
                splaro_integration_trace('audit.before_encode_failed', [
                    'action' => (string)$action,
                    'json_error' => json_last_error_msg()
                ], 'ERROR');
                $beforeJson = null;
            }
        }
        $afterJson = null;
        if ($after !== null) {
            $afterJson = json_encode($after);
            if (!is_string($afterJson)) {
                splaro_integration_trace('audit.after_encode_failed', [
                    'action' => (string)$action,
                    'json_error' => json_last_error_msg()
                ], 'ERROR');
                $afterJson = null;
            }
        }
        $stmt = $db->prepare("INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, before_json, after_json, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([
            $actorId !== null ? (string)$actorId : null,
            (string)$action,
            (string)$entityType,
            $entityId !== null ? (string)$entityId : null,
            $beforeJson,
            $afterJson,
            $ip !== null ? (string)$ip : ($_SERVER['REMOTE_ADDR'] ?? 'UNKNOWN')
        ]);
    } catch (Exception $e) {
        splaro_log_exception('audit_log.insert', $e, [
            'action' => (string)$action,
            'entity_type' => (string)$entityType,
            'entity_id' => $entityId !== null ? (string)$entityId : null
        ]);
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
    if ($decoded === null && json_last_error() !== JSON_ERROR_NONE) {
        splaro_integration_trace('json.decode_failed', [
            'json_error' => json_last_error_msg(),
            'raw_preview' => splaro_clip_text($raw, 200)
        ], 'ERROR');
    }
    return is_array($decoded) ? $decoded : (is_array($default) ? $default : []);
}

function slugify_text($text) {
    $text = strtolower(trim((string)$text));
    $text = preg_replace("/[^\\p{L}\\p{N}\\s\\-._~!$&'()*+,;=:@]+/u", '', $text);
    $text = preg_replace('/\s+/u', '-', $text);
    $text = preg_replace("/^[-._~!$&'()*+,;=:@]+|[-._~!$&'()*+,;=:@]+$/u", '', (string)$text);
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
        splaro_log_exception('cms.section.upsert', $e, ['section_key' => (string)$sectionKey], 'WARNING');
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
        splaro_log_exception('cms.revision.record', $e, ['section_key' => (string)$sectionKey], 'WARNING');
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
        splaro_log_exception('user.id.random_bytes', $e, [], 'WARNING');
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
        splaro_log_exception('user.sessions.clear', $e, [
            'user_id' => (string)$userId
        ], 'WARNING');
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

    $payloadJson = json_encode($payload);
    if (!is_string($payloadJson) || $payloadJson === '') {
        splaro_integration_trace('auth.issue_token.payload_encode_failed', [
            'json_error' => json_last_error_msg(),
            'user_id' => (string)($user['id'] ?? '')
        ], 'ERROR');
        return '';
    }
    $payloadEncoded = base64url_encode($payloadJson);
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
    if ($payload === null && json_last_error() !== JSON_ERROR_NONE) {
        splaro_integration_trace('auth.token.payload_decode_failed', [
            'json_error' => json_last_error_msg(),
            'token_preview' => splaro_clip_text($payloadEncoded, 80)
        ], 'ERROR');
    }
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
        splaro_log_exception('auth.user_lookup', $e, ['user_id' => (string)$uid]);
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
            $userSelectFields = users_sensitive_select_fields($db);
            $stmt = $db->prepare("SELECT {$userSelectFields} FROM users WHERE email = ? LIMIT 1");
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
            splaro_log_exception('admin.autoseed.identity', $e, [
                'email' => (string)$email
            ]);
        }
    }

    // Strict mode: only one admin email should keep admin role.
    try {
        $demote = $db->prepare("UPDATE users SET role = 'USER' WHERE role = 'ADMIN' AND LOWER(email) <> ?");
        $demote->execute([$primaryEmail]);
    } catch (Exception $e) {
        error_log("SPLARO_ADMIN_STRICT_DEMOTE_FAILURE: " . $e->getMessage());
        splaro_log_exception('admin.autoseed.strict_demote', $e, [
            'primary_email' => (string)$primaryEmail
        ]);
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
enforce_global_request_guard($method, $action, $requestAuthUser);

function get_queue_summary($db, $mode = 'SHEETS') {
    $normalizedMode = strtoupper(trim((string)$mode));
    $isTelegram = $normalizedMode === 'TELEGRAM';
    $whereSql = $isTelegram ? "sync_type LIKE 'TELEGRAM_%'" : "sync_type NOT LIKE 'TELEGRAM_%'";
    $enabled = $isTelegram ? TELEGRAM_ENABLED : (GOOGLE_SHEETS_WEBHOOK_URL !== '');
    $summary = [
        'enabled' => $enabled,
        'pending' => 0,
        'retry' => 0,
        'processing' => 0,
        'success' => 0,
        'dead' => 0,
        'lastFailure' => null,
    ];

    if (!$db || !$enabled) {
        return $summary;
    }

    try {
        $rows = $db->query("SELECT status, COUNT(*) AS total FROM sync_queue WHERE {$whereSql} GROUP BY status")->fetchAll();
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
        splaro_log_exception('queue.summary.status_counts', $e, ['mode' => $normalizedMode]);
    }

    try {
        $stmt = $db->query("SELECT id, sync_type, last_http_code, last_error, updated_at FROM sync_queue WHERE {$whereSql} AND status = 'DEAD' ORDER BY id DESC LIMIT 1");
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
        splaro_log_exception('queue.summary.last_failure', $e, ['mode' => $normalizedMode]);
    }

    if (!$isTelegram && function_exists('get_sheets_circuit_state')) {
        $summary['circuit'] = get_sheets_circuit_state();
    }

    return $summary;
}

function get_sync_queue_summary($db) {
    return get_queue_summary($db, 'SHEETS');
}

function get_telegram_queue_summary($db) {
    return get_queue_summary($db, 'TELEGRAM');
}

function get_db_runtime_metrics($db) {
    $metrics = [
        'threads_connected' => null,
        'threads_running' => null,
        'max_used_connections' => null,
        'aborted_connects' => null
    ];

    if (!$db) {
        return $metrics;
    }

    try {
        $stmt = $db->query("SHOW STATUS WHERE Variable_name IN ('Threads_connected', 'Threads_running', 'Max_used_connections', 'Aborted_connects')");
        $rows = $stmt->fetchAll();
        foreach ($rows as $row) {
            $key = strtolower((string)($row['Variable_name'] ?? ''));
            $value = isset($row['Value']) ? (int)$row['Value'] : null;
            if ($key === 'threads_connected') $metrics['threads_connected'] = $value;
            if ($key === 'threads_running') $metrics['threads_running'] = $value;
            if ($key === 'max_used_connections') $metrics['max_used_connections'] = $value;
            if ($key === 'aborted_connects') $metrics['aborted_connects'] = $value;
        }
    } catch (Throwable $e) {
        splaro_log_exception('health.db.runtime_metrics', $e, [], 'WARNING');
    }

    return $metrics;
}

if ($method === 'GET' && $action === 'health') {
    $dbPingOk = false;
    $dbLatencyMs = null;
    $dbPingError = '';
    $dbRuntimeMetrics = get_db_runtime_metrics($db);
    $pingStartedAt = microtime(true);
    try {
        $pingStmt = $db->query('SELECT 1');
        $pingStmt->fetchColumn();
        $dbPingOk = true;
    } catch (Throwable $e) {
        $dbPingError = (string)$e->getMessage();
        $dbPingOk = false;
        splaro_log_exception('health.db.ping', $e, [], 'WARNING');
    }
    $dbLatencyMs = (int)round((microtime(true) - $pingStartedAt) * 1000);

    echo json_encode([
        "status" => "success",
        "service" => "SPLARO_API",
        "time" => date('c'),
        "mode" => $dbPingOk ? "NORMAL" : "DEGRADED",
        "telegram_enabled" => TELEGRAM_ENABLED,
        "storage" => "mysql",
        "dbHost" => ($GLOBALS['SPLARO_DB_CONNECTED_HOST'] ?? DB_HOST),
        "dbName" => DB_NAME,
        "envSource" => get_env_source_label(),
        "dbPasswordSource" => (string)($GLOBALS['SPLARO_DB_PASSWORD_SOURCE'] ?? ''),
        "db" => [
            "ping" => $dbPingOk ? "ok" : "failed",
            "latency_ms" => $dbLatencyMs,
            "error" => $dbPingOk ? '' : $dbPingError,
            "connectTimeoutSeconds" => (int)DB_CONNECT_TIMEOUT_SECONDS,
            "queryTimeoutMs" => (int)DB_QUERY_TIMEOUT_MS,
            "lockWaitTimeoutSeconds" => (int)DB_LOCK_WAIT_TIMEOUT_SECONDS,
            "idleTimeoutSeconds" => (int)DB_IDLE_TIMEOUT_SECONDS,
            "connectAttempts" => (int)($GLOBALS['SPLARO_DB_CONNECT_ATTEMPTS'] ?? 0),
            "connectRetries" => (int)($GLOBALS['SPLARO_DB_CONNECT_RETRIES'] ?? 0)
        ],
        "pool" => [
            "driver" => "pdo_mysql",
            "persistent" => (bool)DB_PERSISTENT,
            "targetSize" => (int)DB_POOL_TARGET,
            "mode" => "php-request-cache",
            "runtime" => $dbRuntimeMetrics
        ],
        "timeouts" => [
            "apiMaxExecutionSeconds" => (int)API_MAX_EXECUTION_SECONDS,
            "sheetsTimeoutSeconds" => (int)GOOGLE_SHEETS_TIMEOUT_SECONDS
        ],
        "telegram" => [
            "enabled" => TELEGRAM_ENABLED,
            "allowlist_count" => count(telegram_admin_chat_allowlist()),
            "primary_chat_id_preview" => splaro_clip_text(telegram_primary_admin_chat_id(), 32),
            "queue" => get_telegram_queue_summary($db)
        ],
        "sheets" => get_sync_queue_summary($db)
    ]);
    exit;
}

if ($method === 'POST' && $action === 'telegram_webhook') {
    if (!TELEGRAM_ENABLED) {
        splaro_integration_trace('telegram.webhook.disabled', [], 'WARNING');
        echo json_encode(["ok" => false, "message" => "TELEGRAM_DISABLED"]);
        exit;
    }

    if (TELEGRAM_WEBHOOK_SECRET !== '') {
        $headerSecret = $_SERVER['HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN'] ?? '';
        if (!hash_equals(TELEGRAM_WEBHOOK_SECRET, $headerSecret)) {
            splaro_integration_trace('telegram.webhook.secret_mismatch', [
                'header_present' => $headerSecret !== '',
                'remote_ip' => (string)($_SERVER['REMOTE_ADDR'] ?? 'UNKNOWN')
            ], 'ERROR');
            http_response_code(403);
            echo json_encode(["ok" => false, "message" => "WEBHOOK_FORBIDDEN"]);
            exit;
        }
    }

    $rawUpdateBody = file_get_contents('php://input');
    $update = json_decode((string)$rawUpdateBody, true);
    if ($update === null && json_last_error() !== JSON_ERROR_NONE) {
        splaro_integration_trace('telegram.webhook.payload_decode_failed', [
            'json_error' => json_last_error_msg(),
            'body_preview' => splaro_clip_text($rawUpdateBody, 300)
        ], 'ERROR');
    }
    if (!is_array($update)) {
        echo json_encode(["ok" => true]);
        exit;
    }

    splaro_integration_trace('telegram.webhook.received', [
        'update_keys' => array_keys($update),
        'update_id' => (string)($update['update_id'] ?? '')
    ]);

    $callbackQuery = isset($update['callback_query']) && is_array($update['callback_query']) ? $update['callback_query'] : null;
    $message = $update['message'] ?? $update['edited_message'] ?? null;
    $chatId = null;
    if ($callbackQuery) {
        $chatId = $callbackQuery['message']['chat']['id'] ?? ($callbackQuery['from']['id'] ?? null);
    } else {
        $chatId = $message['chat']['id'] ?? null;
    }

    if (!$chatId) {
        splaro_integration_trace('telegram.webhook.skipped', ['reason' => 'CHAT_ID_MISSING'], 'WARNING');
        echo json_encode(["ok" => true]);
        exit;
    }

    telegram_register_bot_commands_once();

    if (!is_telegram_admin_chat($chatId)) {
        splaro_integration_trace('telegram.webhook.unauthorized_chat', [
            'chat_id_preview' => splaro_clip_text((string)$chatId, 40),
            'allowlist_count' => count(telegram_admin_chat_allowlist())
        ], 'WARNING');
        log_system_event($db, 'TELEGRAM_UNAUTHORIZED', 'Unauthorized Telegram chat blocked: ' . splaro_clip_text((string)$chatId, 40), null, $_SERVER['REMOTE_ADDR'] ?? 'UNKNOWN');
        send_telegram_message("<b>Unauthorized access blocked.</b>", $chatId);
        if ($callbackQuery) {
            telegram_answer_callback_query($callbackQuery['id'] ?? '', 'Unauthorized', true);
        }
        echo json_encode(["ok" => true]);
        exit;
    }

    try {
        if ($callbackQuery) {
            $callbackId = (string)($callbackQuery['id'] ?? '');
            $callbackData = trim((string)($callbackQuery['data'] ?? ''));
            $parts = explode('|', $callbackData);
            $callbackAction = strtolower(trim((string)($parts[0] ?? '')));
            $callbackMessage = '';
            $reply = '';
            $replyOptions = ['reply_markup' => telegram_main_inline_keyboard()];

            if ($callbackAction === 'ordst') {
                $orderId = trim((string)($parts[1] ?? ''));
                $statusLabel = telegram_order_status_key_to_label($parts[2] ?? '');
                if ($orderId === '' || $statusLabel === '') {
                    $callbackMessage = 'Invalid status action';
                    $reply = '<b>Invalid action.</b>';
                } else {
                    $stmt = $db->prepare("UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?");
                    $stmt->execute([$statusLabel, $orderId]);
                    $orderExists = $stmt->rowCount() > 0;
                    if (!$orderExists) {
                        $existsStmt = $db->prepare("SELECT id FROM orders WHERE id = ? LIMIT 1");
                        $existsStmt->execute([$orderId]);
                        $orderExists = (bool)$existsStmt->fetch();
                    }
                    if ($orderExists) {
                        sync_to_sheets('UPDATE_STATUS', ['id' => $orderId, 'status' => $statusLabel]);
                        log_system_event(
                            $db,
                            'TELEGRAM_ADMIN_STATUS_UPDATE',
                            "Order {$orderId} status updated to {$statusLabel} via Telegram callback.",
                            null,
                            $_SERVER['REMOTE_ADDR'] ?? 'TELEGRAM_WEBHOOK'
                        );
                        $callbackMessage = "Updated: {$statusLabel}";
                        $detail = telegram_load_order_details($db, $orderId);
                        $reply = "<b>Status updated.</b> #" . telegram_escape_html($orderId) . " -> " . telegram_escape_html($statusLabel) . "\n\n" . $detail['text'];
                        $replyOptions = is_array($detail['options'] ?? null) ? $detail['options'] : ['reply_markup' => telegram_order_action_keyboard($orderId)];
                    } else {
                        $callbackMessage = 'Order not found';
                        $reply = "<b>Order not found:</b> " . telegram_escape_html($orderId);
                    }
                }
            } elseif ($callbackAction === 'ordrf') {
                $orderId = trim((string)($parts[1] ?? ''));
                $detail = telegram_load_order_details($db, $orderId);
                $callbackMessage = $detail['ok'] ? 'Order refreshed' : 'Order unavailable';
                $reply = $detail['text'];
                $replyOptions = is_array($detail['options'] ?? null) ? $detail['options'] : ['reply_markup' => telegram_main_inline_keyboard()];
            } elseif ($callbackAction === 'ordpg') {
                $page = (int)($parts[1] ?? 1);
                $limit = (int)($parts[2] ?? 5);
                $ordersPage = telegram_build_orders_page($db, $page, $limit);
                $callbackMessage = 'Orders refreshed';
                $reply = (string)($ordersPage['text'] ?? '<b>No orders found.</b>');
                $replyOptions = is_array($ordersPage['options'] ?? null) ? $ordersPage['options'] : ['reply_markup' => telegram_main_inline_keyboard()];
            } elseif ($callbackAction === 'menu') {
                $callbackMessage = 'Menu opened';
                $reply = telegram_admin_help_text();
                $replyOptions = ['reply_markup' => telegram_main_inline_keyboard()];
            } elseif ($callbackAction === 'sys' && strtolower(trim((string)($parts[1] ?? ''))) === 'health') {
                $orderCount = (int)$db->query("SELECT COUNT(*) FROM orders")->fetchColumn();
                $userCount = (int)$db->query("SELECT COUNT(*) FROM users")->fetchColumn();
                $telegramQueue = get_telegram_queue_summary($db);
                $reply = "<b>SPLARO Health</b>\n"
                    . "Orders: {$orderCount}\n"
                    . "Users: {$userCount}\n"
                    . "Telegram Queue: P{$telegramQueue['pending']} R{$telegramQueue['retry']} D{$telegramQueue['dead']}\n"
                    . "Time: " . telegram_escape_html(date('Y-m-d H:i:s'));
                $replyOptions = ['reply_markup' => telegram_main_inline_keyboard()];
                $callbackMessage = 'Health refreshed';
            } else {
                $callbackMessage = 'Unknown action';
                $reply = "<b>Unknown action.</b>\nUse /help.";
            }

            telegram_answer_callback_query($callbackId, $callbackMessage, false);
            if ($reply !== '') {
                if ($callbackAction === 'ordst') {
                    $statusCallbackQueued = queue_telegram_message(
                        $reply,
                        (string)$chatId,
                        $replyOptions,
                        'ORDER_STATUS_CALLBACK',
                        ['callback_data' => (string)$callbackData]
                    );
                    splaro_integration_trace('telegram.callback.status_queue_result', [
                        'queued' => (bool)$statusCallbackQueued,
                        'callback_data' => splaro_clip_text((string)$callbackData, 80)
                    ], $statusCallbackQueued ? 'INFO' : 'ERROR');
                    if (!$statusCallbackQueued) {
                        send_telegram_message($reply, $chatId, $replyOptions);
                    }
                } else {
                    send_telegram_message($reply, $chatId, $replyOptions);
                }
            }
            echo json_encode(["ok" => true]);
            exit;
        }

        $text = trim((string)($message['text'] ?? ''));
        if ($text === '') {
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
            $telegramQueue = get_telegram_queue_summary($db);
            $reply = "<b>SPLARO Health</b>\n"
                . "Orders: {$orderCount}\n"
                . "Users: {$userCount}\n"
                . "Telegram Queue: P{$telegramQueue['pending']} R{$telegramQueue['retry']} D{$telegramQueue['dead']}\n"
                . "Time: " . telegram_escape_html(date('Y-m-d H:i:s'));
            $replyOptions['reply_markup'] = telegram_main_inline_keyboard();
        } elseif ($command === '/orders') {
            $limit = isset($parts[1]) ? (int)$parts[1] : 5;
            $page = isset($parts[2]) ? (int)$parts[2] : 1;
            $ordersPage = telegram_build_orders_page($db, $page, $limit);
            $reply = (string)($ordersPage['text'] ?? '<b>No orders found.</b>');
            $replyOptions = is_array($ordersPage['options'] ?? null) ? $ordersPage['options'] : ['reply_markup' => telegram_main_inline_keyboard()];
        } elseif ($command === '/order') {
            $orderId = trim((string)($parts[1] ?? ''));
            $detail = telegram_load_order_details($db, $orderId);
            $reply = $detail['text'];
            $replyOptions = is_array($detail['options'] ?? null) ? $detail['options'] : ['reply_markup' => telegram_main_inline_keyboard()];
        } elseif ($command === '/setstatus') {
            $orderId = trim((string)($parts[1] ?? ''));
            $statusLabel = telegram_order_status_key_to_label($parts[2] ?? '');
            if ($orderId === '' || $statusLabel === '') {
                $reply = "<b>Usage:</b> /setstatus {order_id} {PENDING|PROCESSING|SHIPPED|DELIVERED|CANCELLED}";
            } else {
                $stmt = $db->prepare("UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?");
                $stmt->execute([$statusLabel, $orderId]);
                $orderExists = $stmt->rowCount() > 0;
                if (!$orderExists) {
                    $existsStmt = $db->prepare("SELECT id FROM orders WHERE id = ? LIMIT 1");
                    $existsStmt->execute([$orderId]);
                    $orderExists = (bool)$existsStmt->fetch();
                }
                if ($orderExists) {
                    sync_to_sheets('UPDATE_STATUS', ['id' => $orderId, 'status' => $statusLabel]);
                    log_system_event(
                        $db,
                        'TELEGRAM_ADMIN_STATUS_UPDATE',
                        "Order {$orderId} status updated to {$statusLabel} via Telegram command.",
                        null,
                        $_SERVER['REMOTE_ADDR'] ?? 'TELEGRAM_WEBHOOK'
                    );
                    $reply = "<b>Status updated.</b>\n#" . telegram_escape_html($orderId) . " -> " . telegram_escape_html($statusLabel);
                    $replyOptions['reply_markup'] = telegram_order_action_keyboard($orderId);
                } else {
                    $reply = "<b>Order not found:</b> " . telegram_escape_html($orderId);
                }
            }
        } elseif ($command === '/users') {
            $limit = isset($parts[1]) ? (int)$parts[1] : 5;
            if ($limit < 1) $limit = 5;
            if ($limit > 10) $limit = 10;
            $stmt = $db->prepare("SELECT id, name, email, role FROM users ORDER BY created_at DESC LIMIT ?");
            $stmt->bindValue(1, $limit, PDO::PARAM_INT);
            $stmt->execute();
            $rows = $stmt->fetchAll();
            if (!$rows) {
                $reply = "<b>No users found.</b>";
            } else {
                $lines = ["<b>Users ({$limit})</b>"];
                foreach ($rows as $row) {
                    $lines[] = '• ' . telegram_escape_html((string)($row['name'] ?? 'N/A'))
                        . ' | ' . telegram_escape_html((string)($row['role'] ?? 'USER'));
                }
                $reply = implode("\n", $lines);
            }
            $replyOptions['reply_markup'] = telegram_main_inline_keyboard();
        } elseif ($command === '/maintenance') {
            $mode = strtolower(trim((string)($parts[1] ?? '')));
            if ($mode !== 'on' && $mode !== 'off') {
                $reply = "<b>Usage:</b> /maintenance {on|off}";
            } else {
                $maintenance = $mode === 'on' ? 1 : 0;
                $stmt = $db->prepare("UPDATE site_settings SET maintenance_mode = ? WHERE id = 1");
                $stmt->execute([$maintenance]);
                $reply = "<b>Maintenance:</b> " . telegram_escape_html(strtoupper($mode));
            }
            $replyOptions['reply_markup'] = telegram_main_inline_keyboard();
        } else {
            $reply = "<b>Unknown command.</b>\nUse /help.";
            $replyOptions['reply_markup'] = telegram_main_inline_keyboard();
        }

        send_telegram_message($reply, $chatId, $replyOptions);
        echo json_encode(["ok" => true]);
        exit;
    } catch (Throwable $e) {
        splaro_log_exception('telegram.webhook.handler', $e, [
            'chat_id_preview' => splaro_clip_text((string)$chatId, 40),
            'update_keys' => array_keys($update)
        ]);
        send_telegram_message("<b>Action failed.</b>\nPlease retry or run /health.", $chatId, [
            'reply_markup' => telegram_main_inline_keyboard()
        ]);
        echo json_encode(["ok" => false, "message" => "WEBHOOK_HANDLER_FAILED"]);
        exit;
    }
}


// 1. DATA RETRIEVAL PROTOCOL
if ($method === 'GET' && $action === 'sync') {
    $isAdmin = is_admin_authenticated($requestAuthUser);
    $isUser = is_array($requestAuthUser) && strtoupper((string)($requestAuthUser['role'] ?? '')) === 'USER';
    $syncQueueProcess = null;

    $settingsSelectFields = site_settings_select_fields($db);
    $settings = $db->query("SELECT {$settingsSelectFields} FROM site_settings LIMIT 1")->fetch();
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
                splaro_log_exception('cms.section.read', $e, ['section_key' => 'storefront_cms'], 'WARNING');
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
    $productsPage = max(1, (int)($_GET['productsPage'] ?? 1));
    $productsPageSize = (int)($_GET['productsPageSize'] ?? ($isAdmin ? 200 : 200));
    if ($productsPageSize < 20) $productsPageSize = 20;
    if ($productsPageSize > 500) $productsPageSize = 500;
    $productsOffset = ($productsPage - 1) * $productsPageSize;
    $productCount = 0;
    $productSelectFields = build_select_fields($db, 'products', [
        'id', 'name', 'brand', 'type', 'price', 'image', 'description', 'slug',
        'sizes', 'colors', 'color_variants', 'materials', 'tags', 'brand_slug',
        'featured', 'sku', 'barcode', 'stock', 'low_stock_threshold', 'status',
        'hide_when_out_of_stock', 'discount_price', 'discount_starts_at', 'discount_ends_at',
        'main_image_id', 'category', 'category_slug', 'weight', 'dimensions', 'variations',
        'additional_images', 'size_chart_image', 'discount_percentage',
        'sub_category', 'sub_category_slug', 'product_url', 'created_at'
    ]);
    $productsHasStatus = column_exists($db, 'products', 'status');
    if (!$isAdmin && $method === 'GET' && $action === 'sync') {
        // Light sync for regular users: keep schema-tolerant query for legacy databases.
        $productCount = safe_query_count($db, "SELECT COUNT(*) FROM products");
        if ($productsHasStatus) {
            $products = safe_query_all($db, "SELECT {$productSelectFields} FROM products WHERE status = 'PUBLISHED' ORDER BY created_at DESC LIMIT {$productsPageSize}");
        } else {
            $products = safe_query_all($db, "SELECT {$productSelectFields} FROM products ORDER BY created_at DESC LIMIT {$productsPageSize}");
        }
    } else {
        $productCount = safe_query_count($db, "SELECT COUNT(*) FROM products");
        $products = safe_query_all($db, "SELECT {$productSelectFields} FROM products ORDER BY created_at DESC LIMIT {$productsPageSize} OFFSET {$productsOffset}");
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
        splaro_log_exception('sync.product_images.read', $e, [], 'WARNING');
    }

    $orders = [];
    $users = [];
    $logs = [];
    $traffic = [];
    $meta = [];

    if ($isAdmin) {
        // Opportunistic background drain for pending integration jobs.
        try {
            $syncQueueProcess = [
                'telegram' => process_telegram_queue($db, 10),
                'sheets' => process_sync_queue($db, 5, false)
            ];
        } catch (Exception $e) {
            error_log('SPLARO_SYNC_QUEUE_PROCESS_FAILED: ' . $e->getMessage());
            splaro_log_exception('sheets.queue.process.opportunistic_admin_sync', $e);
            $syncQueueProcess = [
                'telegram' => [
                    'processed' => 0,
                    'success' => 0,
                    'failed' => 0,
                    'retried' => 0,
                    'dead' => 0,
                    'paused' => true,
                    'reason' => 'SYNC_QUEUE_PROCESS_FAILED'
                ],
                'sheets' => [
                    'processed' => 0,
                    'success' => 0,
                    'failed' => 0,
                    'retried' => 0,
                    'dead' => 0,
                    'paused' => true,
                    'reason' => 'SYNC_QUEUE_PROCESS_FAILED'
                ]
            ];
        }

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

        $orderCount = safe_query_count($db, "SELECT COUNT(*) FROM orders {$orderWhereSql}", $orderParams);
        $orderSelectFields = build_select_fields($db, 'orders', [
            'id', 'user_id', 'customer_name', 'customer_email', 'phone', 'district', 'thana',
            'address', 'items', 'total', 'status', 'tracking_number', 'admin_notes',
            'customer_comment', 'shipping_fee', 'discount_amount', 'discount_code', 'created_at'
        ]);
        $orders = safe_query_all(
            $db,
            "SELECT {$orderSelectFields} FROM orders {$orderWhereSql} ORDER BY created_at DESC LIMIT {$pageSize} OFFSET {$offset}",
            $orderParams
        );

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

        $userCount = safe_query_count($db, "SELECT COUNT(*) FROM users {$userWhereSql}", $userParams);
        $users = safe_query_all($db, "SELECT id, name, email, phone, address, profile_image, role, created_at FROM users {$userWhereSql} ORDER BY created_at DESC LIMIT {$usersPageSize} OFFSET {$usersOffset}", $userParams);

        $logSelectFields = build_select_fields($db, 'system_logs', ['id', 'event_type', 'event_description', 'user_id', 'ip_address', 'created_at']);
        $trafficSelectFields = build_select_fields($db, 'traffic_metrics', ['id', 'session_id', 'user_id', 'ip_address', 'path', 'user_agent', 'last_active']);
        $logs = safe_query_all($db, "SELECT {$logSelectFields} FROM system_logs ORDER BY created_at DESC LIMIT 50");
        $traffic = safe_query_all($db, "SELECT {$trafficSelectFields} FROM traffic_metrics WHERE last_active > DATE_SUB(NOW(), INTERVAL 5 MINUTE) ORDER BY last_active DESC");
        $meta = [
            'products' => [
                'page' => $productsPage,
                'pageSize' => $productsPageSize,
                'count' => $productCount
            ],
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
            'syncQueueSummary' => [
                'telegram' => get_telegram_queue_summary($db),
                'sheets' => get_sync_queue_summary($db)
            ]
        ];
    } elseif ($isUser && !empty($requestAuthUser['email'])) {
        $userOrderSelectFields = build_select_fields($db, 'orders', [
            'id', 'user_id', 'customer_name', 'customer_email', 'phone', 'district', 'thana',
            'address', 'items', 'total', 'status', 'tracking_number', 'admin_notes',
            'customer_comment', 'shipping_fee', 'discount_amount', 'discount_code', 'created_at'
        ]);
        $stmtOrders = $db->prepare("SELECT {$userOrderSelectFields} FROM orders WHERE user_id = ? OR customer_email = ? ORDER BY created_at DESC LIMIT 200");
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
    splaro_integration_trace('order.handler.start', [
        'ip' => $_SERVER['REMOTE_ADDR'] ?? 'UNKNOWN',
        'auth_user_id' => (string)($requestAuthUser['id'] ?? ''),
        'auth_user_email' => (string)($requestAuthUser['email'] ?? '')
    ]);

    if (is_rate_limited('create_order', 10, 60)) {
        splaro_integration_trace('order.handler.rate_limited', ['window_seconds' => 60, 'limit' => 10], 'WARNING');
        echo json_encode(["status" => "error", "message" => "RATE_LIMIT_EXCEEDED"]);
        exit;
    }

    $orderRawBody = file_get_contents('php://input');
    splaro_integration_trace('order.handler.payload_read', [
        'bytes' => is_string($orderRawBody) ? strlen($orderRawBody) : 0
    ]);
    $input = json_decode((string)$orderRawBody, true);
    if ($input === null && json_last_error() !== JSON_ERROR_NONE) {
        splaro_integration_trace('order.handler.payload_decode_failed', [
            'json_error' => json_last_error_msg(),
            'body_preview' => splaro_clip_text($orderRawBody, 300)
        ], 'ERROR');
    }

    if (!$input) {
        splaro_integration_trace('order.handler.invalid_payload', [
            'reason' => 'EMPTY_OR_INVALID_JSON',
            'json_error' => json_last_error_msg(),
            'body_preview' => splaro_clip_text($orderRawBody, 300)
        ], 'ERROR');
        echo json_encode(["status" => "error", "message" => "INVALID_PAYLOAD"]);
        exit;
    }

    if (!empty(trim($input['website'] ?? ''))) {
        splaro_integration_trace('order.handler.honeypot_blocked', [], 'WARNING');
        echo json_encode(["status" => "error", "message" => "SPAM_BLOCKED"]);
        exit;
    }

    if (!is_array($requestAuthUser) || empty($requestAuthUser['id'])) {
        splaro_integration_trace('order.handler.auth_missing', [], 'WARNING');
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
    splaro_integration_trace('order.handler.validated', [
        'order_id' => $orderId,
        'customer_email' => (string)($input['customerEmail'] ?? ''),
        'items_count' => is_array($input['items'] ?? null) ? count($input['items']) : 0
    ]);

    $orderItemsJson = json_encode($input['items'] ?? []);
    if (!is_string($orderItemsJson)) {
        splaro_integration_trace('order.handler.items_encode_failed', [
            'order_id' => $orderId,
            'json_error' => json_last_error_msg()
        ], 'ERROR');
        echo json_encode(["status" => "error", "message" => "INVALID_ORDER_ITEMS"]);
        exit;
    }

    try {
        splaro_integration_trace('order.db.insert.begin', ['order_id' => $orderId]);
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
            $orderItemsJson,
            $input['total'],
            $input['status'] ?? 'Pending',
            $input['customerComment'] ?? null,
            isset($input['shippingFee']) ? (int)$input['shippingFee'] : null,
            isset($input['discountAmount']) ? (int)$input['discountAmount'] : 0,
            $input['discountCode'] ?? null
        ]);
        $db->commit();
        splaro_integration_trace('order.db.insert.committed', ['order_id' => $orderId]);
    } catch (Exception $e) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        error_log("SPLARO_ORDER_CREATE_FAILURE: " . $e->getMessage());
        splaro_log_exception('order.db.insert', $e, ['order_id' => $orderId]);
        http_response_code(500);
        echo json_encode(["status" => "error", "message" => "ORDER_CREATE_FAILED"]);
        exit;
    }

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

    // SYNC TO GOOGLE SHEETS (normalized payload for stable header mapping)
    $orderSyncPayload = [
        'order_id' => $orderId,
        'created_at' => date('c'),
        'name' => (string)($input['customerName'] ?? ''),
        'email' => (string)($input['customerEmail'] ?? ''),
        'phone' => (string)($input['phone'] ?? ''),
        'address' => (string)($input['address'] ?? ''),
        'district' => (string)($input['district'] ?? ''),
        'thana' => (string)($input['thana'] ?? ''),
        'product_name' => (string)$productName,
        'product_url' => (string)($productUrlRaw ?: ''),
        'image_url' => (string)$imageUrl,
        'quantity' => (int)$totalQuantity,
        'notes' => (string)$notes,
        'status' => (string)($input['status'] ?? 'PENDING'),
        // compatibility fields for old script variants
        'id' => $orderId,
        'customerName' => (string)($input['customerName'] ?? ''),
        'customerEmail' => (string)($input['customerEmail'] ?? ''),
        'items' => $input['items'] ?? [],
        'total' => (int)($input['total'] ?? 0)
    ];
    splaro_integration_trace('order.integration.sync_trigger', [
        'order_id' => $orderId,
        'payload_keys' => array_keys($orderSyncPayload)
    ]);
    $orderSyncQueued = sync_to_sheets('ORDER', $orderSyncPayload);
    splaro_integration_trace('order.integration.sync_trigger_result', [
        'order_id' => $orderId,
        'queued' => (bool)$orderSyncQueued
    ]);

    $telegramOrderMessage = telegram_compact_order_message(
        '🛒 New Order',
        (string)$orderId,
        (string)($input['customerName'] ?? 'N/A'),
        (string)($input['phone'] ?? 'N/A'),
        (string)($input['total'] ?? '0'),
        (string)($input['status'] ?? 'Pending'),
        date('Y-m-d H:i:s')
    );
    $telegramOrderOptions = [
        'reply_markup' => telegram_order_action_keyboard($orderId)
    ];
    splaro_integration_trace('order.integration.telegram_queue_trigger', ['order_id' => $orderId]);
    $telegramOrderQueued = queue_telegram_message(
        $telegramOrderMessage,
        null,
        $telegramOrderOptions,
        'ORDER_CREATED',
        ['order_id' => $orderId, 'customer_email' => (string)($input['customerEmail'] ?? '')]
    );
    splaro_integration_trace('order.integration.telegram_queue_result', [
        'order_id' => $orderId,
        'queued' => (bool)$telegramOrderQueued
    ], $telegramOrderQueued ? 'INFO' : 'ERROR');

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
        "email" => ["admin" => $adminMail, "customer" => $customerMail],
        "integrations" => [
            "sheets" => ["queued" => (bool)$orderSyncQueued],
            "telegram" => ["queued" => (bool)$telegramOrderQueued]
        ]
    ]);
    exit;
}

// 2.1 LOGISTICS UPDATE PROTOCOL
if ($method === 'POST' && $action === 'update_order_status') {
    require_admin_access($requestAuthUser);
    $rawInput = file_get_contents('php://input');
    $input = json_decode((string)$rawInput, true);
    if ($input === null && json_last_error() !== JSON_ERROR_NONE) {
        splaro_integration_trace('order.status_update.payload_decode_failed', [
            'json_error' => json_last_error_msg(),
            'body_preview' => splaro_clip_text($rawInput, 300)
        ], 'ERROR');
    }
    if (!is_array($input)) {
        echo json_encode(["status" => "error", "message" => "INVALID_PAYLOAD"]);
        exit;
    }

    if (!isset($input['id']) || !isset($input['status'])) {
        echo json_encode(["status" => "error", "message" => "MISSING_PARAMETERS"]);
        exit;
    }

    $orderId = trim((string)$input['id']);
    $statusLabel = trim((string)$input['status']);
    if ($orderId === '' || $statusLabel === '') {
        echo json_encode(["status" => "error", "message" => "MISSING_PARAMETERS"]);
        exit;
    }

    try {
        $stmt = $db->prepare("UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?");
        $stmt->execute([$statusLabel, $orderId]);
        if ($stmt->rowCount() < 1) {
            $existsStmt = $db->prepare("SELECT id FROM orders WHERE id = ? LIMIT 1");
            $existsStmt->execute([$orderId]);
            if (!$existsStmt->fetch()) {
                echo json_encode(["status" => "error", "message" => "ORDER_NOT_FOUND"]);
                exit;
            }
        }

        sync_to_sheets('UPDATE_STATUS', ['id' => $orderId, 'status' => $statusLabel]);

        $ip = $_SERVER['REMOTE_ADDR'] ?? 'UNKNOWN';
        log_system_event($db, 'LOGISTICS_UPDATE', "Order {$orderId} status updated to {$statusLabel}", $requestAuthUser['id'] ?? null, $ip);

        $telegramStatusMessage = telegram_compact_order_message(
            '📦 Order Status Updated',
            (string)$orderId,
            (string)($input['customerName'] ?? 'N/A'),
            (string)($input['phone'] ?? 'N/A'),
            (string)($input['total'] ?? '0'),
            (string)$statusLabel,
            date('Y-m-d H:i:s')
        );
        $telegramStatusQueued = queue_telegram_message(
            $telegramStatusMessage,
            null,
            ['reply_markup' => telegram_order_action_keyboard($orderId)],
            'ORDER_STATUS_UPDATED',
            ['order_id' => (string)$orderId, 'status' => (string)$statusLabel]
        );
        splaro_integration_trace('order.status_update.telegram_queue_result', [
            'order_id' => (string)$orderId,
            'status' => (string)$statusLabel,
            'queued' => (bool)$telegramStatusQueued
        ], $telegramStatusQueued ? 'INFO' : 'ERROR');

        echo json_encode([
            "status" => "success",
            "message" => "STATUS_SYNCHRONIZED",
            "telegram" => ["queued" => (bool)$telegramStatusQueued]
        ]);
        exit;
    } catch (Exception $e) {
        splaro_log_exception('order.status_update.handler', $e, [
            'order_id' => (string)$orderId,
            'status' => (string)$statusLabel
        ]);
        http_response_code(500);
        echo json_encode(["status" => "error", "message" => "STATUS_UPDATE_FAILED"]);
        exit;
    }
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
        splaro_log_exception('products.sync', $e);
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
        splaro_log_exception('products.image_upload', $e);
        echo json_encode(["status" => "error", "message" => "IMAGE_UPLOAD_FAILED"]);
    }
    exit;
}

// 4. IDENTITY AUTHENTICATION (SIGNUP / SOCIAL SYNC)
if ($method === 'POST' && $action === 'signup') {
    splaro_integration_trace('signup.handler.start', [
        'ip' => $_SERVER['REMOTE_ADDR'] ?? 'UNKNOWN'
    ]);

    if (is_rate_limited('signup', 8, 60)) {
        splaro_integration_trace('signup.handler.rate_limited', ['window_seconds' => 60, 'limit' => 8], 'WARNING');
        echo json_encode(["status" => "error", "message" => "RATE_LIMIT_EXCEEDED"]);
        exit;
    }

    $signupRawBody = file_get_contents('php://input');
    splaro_integration_trace('signup.handler.payload_read', [
        'bytes' => is_string($signupRawBody) ? strlen($signupRawBody) : 0
    ]);
    $input = json_decode((string)$signupRawBody, true);
    if ($input === null && json_last_error() !== JSON_ERROR_NONE) {
        splaro_integration_trace('signup.handler.payload_decode_failed', [
            'json_error' => json_last_error_msg(),
            'body_preview' => splaro_clip_text($signupRawBody, 300)
        ], 'ERROR');
    }
    if (!is_array($input)) {
        splaro_integration_trace('signup.handler.invalid_payload', [
            'json_error' => json_last_error_msg(),
            'body_preview' => splaro_clip_text($signupRawBody, 300)
        ], 'ERROR');
        echo json_encode(["status" => "error", "message" => "INVALID_PAYLOAD"]);
        exit;
    }

    if (!empty(trim($input['website'] ?? ''))) {
        splaro_integration_trace('signup.handler.honeypot_blocked', [], 'WARNING');
        echo json_encode(["status" => "error", "message" => "SPAM_BLOCKED"]);
        exit;
    }

    $email = strtolower(trim($input['email'] ?? ''));
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        splaro_integration_trace('signup.handler.invalid_email', [
            'email_preview' => splaro_clip_text($email, 120)
        ], 'WARNING');
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
    splaro_integration_trace('signup.handler.validated', [
        'user_id' => $id,
        'email' => $email,
        'has_google_sub' => isset($input['google_sub'])
    ]);

    $usersHasDefaultShipping = column_exists($db, 'users', 'default_shipping_address');
    $usersHasNotificationEmail = column_exists($db, 'users', 'notification_email');
    $usersHasNotificationSms = column_exists($db, 'users', 'notification_sms');
    $usersHasPreferredLanguage = column_exists($db, 'users', 'preferred_language');
    $usersHasTwoFactorEnabled = column_exists($db, 'users', 'two_factor_enabled');
    $usersHasForceRelogin = column_exists($db, 'users', 'force_relogin');
    $usersHasLastPasswordChange = column_exists($db, 'users', 'last_password_change_at');

    $userSelectFields = users_sensitive_select_fields($db);
    $check = $db->prepare("SELECT {$userSelectFields} FROM users WHERE email = ?");
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
        $refetch = $db->prepare("SELECT {$userSelectFields} FROM users WHERE id = ? LIMIT 1");
        $refetch->execute([$existing['id']]);
        $existing = $refetch->fetch();
        $safeExisting = sanitize_user_payload($existing);
        $token = issue_auth_token($safeExisting);
        if (isset($input['google_sub'])) {
            splaro_integration_trace('signup.integration.sync_trigger_existing_google', [
                'user_id' => (string)($safeExisting['id'] ?? '')
            ]);
            $signupSyncExisting = sync_to_sheets('SIGNUP', $safeExisting);
            splaro_integration_trace('signup.integration.sync_result_existing_google', [
                'user_id' => (string)($safeExisting['id'] ?? ''),
                'queued' => (bool)$signupSyncExisting
            ], $signupSyncExisting ? 'INFO' : 'ERROR');
        }
        $csrfToken = refresh_csrf_token();
        splaro_integration_trace('signup.handler.success_existing', [
            'user_id' => (string)($safeExisting['id'] ?? '')
        ]);
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

    $fetchCreated = $db->prepare("SELECT {$userSelectFields} FROM users WHERE id = ? LIMIT 1");
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
    splaro_integration_trace('signup.db.insert.committed', [
        'user_id' => $id,
        'email' => $email
    ]);

    // SYNC TO GOOGLE SHEETS (normalized payload for stable header mapping)
    $signupSyncPayload = [
        'user_id' => (string)$id,
        'created_at' => date('c'),
        'name' => (string)$name,
        'email' => (string)$email,
        'phone' => (string)$phone,
        'district' => (string)($input['district'] ?? ''),
        'thana' => (string)($input['thana'] ?? ''),
        'address' => (string)$address,
        'source' => 'web',
        'verified' => false,
        // compatibility fields for old script variants
        'id' => (string)$id,
        'role' => (string)$role
    ];
    splaro_integration_trace('signup.integration.sync_trigger', [
        'user_id' => $id,
        'payload_keys' => array_keys($signupSyncPayload)
    ]);
    $signupSyncQueued = sync_to_sheets('SIGNUP', $signupSyncPayload);
    splaro_integration_trace('signup.integration.sync_result', [
        'user_id' => $id,
        'queued' => (bool)$signupSyncQueued
    ], $signupSyncQueued ? 'INFO' : 'ERROR');

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
    $telegramSignupMessage = telegram_compact_signup_message(
        (string)$id,
        (string)$name,
        (string)$email,
        (string)$phone,
        date('Y-m-d H:i:s')
    );
    $telegramSignupOptions = [
        'reply_markup' => telegram_main_inline_keyboard()
    ];
    splaro_integration_trace('signup.integration.telegram_queue_trigger', [
        'user_id' => $id
    ]);
    $telegramSignupQueued = queue_telegram_message(
        $telegramSignupMessage,
        null,
        $telegramSignupOptions,
        'SIGNUP_CREATED',
        ['user_id' => (string)$id, 'email' => (string)$email]
    );
    splaro_integration_trace('signup.integration.telegram_queue_result', [
        'user_id' => $id,
        'queued' => (bool)$telegramSignupQueued
    ], $telegramSignupQueued ? 'INFO' : 'ERROR');

    $csrfToken = refresh_csrf_token();
    echo json_encode([
        "status" => "success",
        "user" => $userPayload,
        "token" => $token,
        "csrf_token" => $csrfToken,
        "email" => ["admin" => $adminMail, "welcome" => $welcomeMail],
        "integrations" => [
            "sheets" => ["queued" => (bool)$signupSyncQueued],
            "telegram" => ["queued" => (bool)$telegramSignupQueued]
        ]
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
        'sub_id' => (string)$subId,
        'created_at' => date('c'),
        'email' => (string)$email,
        'consent' => (bool)$consent,
        'source' => (string)$source
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
    
    $userSelectFields = users_sensitive_select_fields($db);
    $stmt = $db->prepare("SELECT {$userSelectFields} FROM users WHERE email = ?");
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
    
    $userSelectFields = users_sensitive_select_fields($db);
    $stmt = $db->prepare("SELECT {$userSelectFields} FROM users WHERE email = ? AND reset_code = ? AND reset_expiry > NOW()");
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

    $userSelectFields = users_sensitive_select_fields($db);
    $stmt = $db->prepare("SELECT {$userSelectFields} FROM users WHERE id = ? LIMIT 1");
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

    $updatedStmt = $db->prepare("SELECT {$userSelectFields} FROM users WHERE id = ? LIMIT 1");
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

    $userSelectFields = users_sensitive_select_fields($db);
    $stmt = $db->prepare("SELECT {$userSelectFields} FROM users WHERE email = ? LIMIT 1");
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
            $reloadAfterReset = $db->prepare("SELECT {$userSelectFields} FROM users WHERE id = ? LIMIT 1");
            $reloadAfterReset->execute([$user['id']]);
            $reloaded = $reloadAfterReset->fetch();
            if ($reloaded) {
                $user = $reloaded;
            }
        } catch (Exception $e) {
            splaro_log_exception('login.reset_force_relogin', $e, [
                'user_id' => (string)($user['id'] ?? '')
            ], 'WARNING');
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

    $userSelectFields = users_sensitive_select_fields($db);
    $currentUserStmt = $db->prepare("SELECT {$userSelectFields} FROM users WHERE id = ? LIMIT 1");
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

    $updatedStmt = $db->prepare("SELECT {$userSelectFields} FROM users WHERE id = ? LIMIT 1");
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
        splaro_log_exception('user_sessions.read', $e, [
            'user_id' => (string)($requestAuthUser['id'] ?? '')
        ], 'WARNING');
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

    $userSelectFields = users_sensitive_select_fields($db);
    $updatedStmt = $db->prepare("SELECT {$userSelectFields} FROM users WHERE id = ? LIMIT 1");
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
                splaro_log_exception('settings.schema.add_hero_slides', $e, [], 'WARNING');
            }
        }
        if (!column_exists($db, 'site_settings', 'content_pages')) {
            try {
                $db->exec("ALTER TABLE `site_settings` ADD COLUMN `content_pages` longtext DEFAULT NULL");
            } catch (Exception $e) {
                error_log("SPLARO_SCHEMA_WARNING: failed to add content_pages dynamically -> " . $e->getMessage());
                splaro_log_exception('settings.schema.add_content_pages', $e, [], 'WARNING');
            }
        }
        if (!column_exists($db, 'site_settings', 'story_posts')) {
            try {
                $db->exec("ALTER TABLE `site_settings` ADD COLUMN `story_posts` longtext DEFAULT NULL");
            } catch (Exception $e) {
                error_log("SPLARO_SCHEMA_WARNING: failed to add story_posts dynamically -> " . $e->getMessage());
                splaro_log_exception('settings.schema.add_story_posts', $e, [], 'WARNING');
            }
        }
        if (!column_exists($db, 'site_settings', 'settings_json')) {
            try {
                $db->exec("ALTER TABLE `site_settings` ADD COLUMN `settings_json` longtext DEFAULT NULL");
            } catch (Exception $e) {
                error_log("SPLARO_SCHEMA_WARNING: failed to add settings_json dynamically -> " . $e->getMessage());
                splaro_log_exception('settings.schema.add_settings_json', $e, [], 'WARNING');
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
        $settingsSelectFields = site_settings_select_fields($db);
        $existingSettingsRow = $db->query("SELECT {$settingsSelectFields} FROM site_settings WHERE id = 1 LIMIT 1")->fetch();
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
        splaro_log_exception('settings.update', $e, ['admin_role' => (string)$adminRole]);
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
        "queue" => [
            "telegram" => get_telegram_queue_summary($db),
            "sheets" => get_sync_queue_summary($db)
        ]
    ]);
    exit;
}

if ($method === 'POST' && $action === 'process_sync_queue') {
    require_admin_access($requestAuthUser);
    $payloadRaw = file_get_contents('php://input');
    $payload = json_decode((string)$payloadRaw, true);
    if ($payload === null && json_last_error() !== JSON_ERROR_NONE) {
        splaro_integration_trace('queue.process.payload_decode_failed', [
            'json_error' => json_last_error_msg(),
            'body_preview' => splaro_clip_text($payloadRaw, 300)
        ], 'ERROR');
    }
    if (!is_array($payload)) {
        $payload = [];
    }
    $limit = (int)($payload['limit'] ?? ($_GET['limit'] ?? 20));
    if ($limit < 1) $limit = 1;
    if ($limit > 100) $limit = 100;
    $force = !empty($payload['force']) || (($_GET['force'] ?? '') === '1');
    $telegramLimit = (int)($payload['telegram_limit'] ?? $limit);
    if ($telegramLimit < 1) $telegramLimit = 1;
    if ($telegramLimit > 100) $telegramLimit = 100;

    $telegramResult = process_telegram_queue($db, $telegramLimit);
    $sheetsResult = process_sync_queue($db, $limit, $force);
    echo json_encode([
        "status" => "success",
        "result" => [
            "telegram" => $telegramResult,
            "sheets" => $sheetsResult
        ],
        "queue" => [
            "telegram" => get_telegram_queue_summary($db),
            "sheets" => get_sync_queue_summary($db)
        ]
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

    $invoiceOrderSelectFields = build_select_fields($db, 'orders', [
        'id', 'user_id', 'customer_name', 'customer_email', 'phone', 'district', 'thana',
        'address', 'items', 'total', 'status', 'tracking_number', 'admin_notes',
        'customer_comment', 'shipping_fee', 'discount_amount', 'discount_code', 'created_at'
    ]);
    $orderStmt = $db->prepare("SELECT {$invoiceOrderSelectFields} FROM orders WHERE id = ? LIMIT 1");
    $orderStmt->execute([$orderId]);
    $orderRow = $orderStmt->fetch();
    if (!$orderRow) {
        echo json_encode(["status" => "error", "message" => "ORDER_NOT_FOUND"]);
        exit;
    }

    $settingsSelectFields = site_settings_select_fields($db);
    $settingsRow = $db->query("SELECT {$settingsSelectFields} FROM site_settings WHERE id = 1 LIMIT 1")->fetch();
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
        splaro_log_exception('invoice.generate_document', $e, [
            'order_id' => (string)$orderId,
            'type_code' => (string)$typeCode
        ]);
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
    splaro_integration_trace('sheets.http.prepare', [
        'type' => (string)$type,
        'webhook_configured' => $webhookUrl !== '',
        'timeout_seconds' => (int)GOOGLE_SHEETS_TIMEOUT_SECONDS
    ]);
    if ($webhookUrl === '') {
        splaro_integration_trace('sheets.http.skipped', [
            'type' => (string)$type,
            'reason' => 'WEBHOOK_NOT_CONFIGURED'
        ], 'WARNING');
        return [false, 0, 'WEBHOOK_NOT_CONFIGURED', ''];
    }

    $jsonBody = json_encode(build_sheets_payload($type, $data));
    if (!is_string($jsonBody) || $jsonBody === '') {
        splaro_integration_trace('sheets.http.json_encode_failed', [
            'type' => (string)$type,
            'json_error' => json_last_error_msg()
        ], 'ERROR');
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
        $connectTimeout = max(1, min($timeout, 3));
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_POSTFIELDS => $jsonBody,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => $connectTimeout,
            CURLOPT_TIMEOUT => $timeout,
            CURLOPT_NOSIGNAL => 1,
            CURLOPT_TCP_KEEPALIVE => 1,
            CURLOPT_LOW_SPEED_LIMIT => 1,
            CURLOPT_LOW_SPEED_TIME => $timeout,
        ]);

        splaro_integration_trace('sheets.http.curl.before_exec', [
            'type' => (string)$type,
            'connect_timeout_seconds' => (int)$connectTimeout,
            'timeout_seconds' => (int)$timeout,
            'payload_bytes' => strlen($jsonBody)
        ]);
        $response = curl_exec($ch);
        $httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlErrNo = curl_errno($ch);
        $curlError = (string)curl_error($ch);
        $sslVerifyResult = defined('CURLINFO_SSL_VERIFYRESULT') ? curl_getinfo($ch, CURLINFO_SSL_VERIFYRESULT) : null;
        curl_close($ch);

        splaro_integration_trace('sheets.http.curl.after_exec', [
            'type' => (string)$type,
            'http_code' => (int)$httpCode,
            'curl_errno' => (int)$curlErrNo,
            'curl_error' => (string)$curlError,
            'ssl_verify_result' => $sslVerifyResult,
            'response_preview' => splaro_clip_text($response, 300)
        ], ($response === false || $httpCode < 200 || $httpCode >= 400) ? 'ERROR' : 'INFO');
        if (is_string($response) && trim($response) !== '') {
            $decoded = json_decode($response, true);
            if ($decoded === null && json_last_error() !== JSON_ERROR_NONE) {
                splaro_integration_trace('sheets.http.response_decode_failed', [
                    'type' => (string)$type,
                    'json_error' => json_last_error_msg(),
                    'response_preview' => splaro_clip_text($response, 300)
                ], 'ERROR');
            }
        }

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

    splaro_integration_trace('sheets.http.stream.before_exec', [
        'type' => (string)$type,
        'timeout_seconds' => (int)$timeout,
        'payload_bytes' => strlen($jsonBody)
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

    splaro_integration_trace('sheets.http.stream.after_exec', [
        'type' => (string)$type,
        'http_code' => (int)$httpCode,
        'response_preview' => splaro_clip_text($response, 300),
        'headers_preview' => splaro_clip_text(json_encode($responseHeaders), 300)
    ], ($response === false || $httpCode < 200 || $httpCode >= 400) ? 'ERROR' : 'INFO');
    if (is_string($response) && trim($response) !== '') {
        $decoded = json_decode($response, true);
        if ($decoded === null && json_last_error() !== JSON_ERROR_NONE) {
            splaro_integration_trace('sheets.http.response_decode_failed', [
                'type' => (string)$type,
                'json_error' => json_last_error_msg(),
                'response_preview' => splaro_clip_text($response, 300)
            ], 'ERROR');
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

function telegram_queue_sync_type() {
    return 'TELEGRAM_SEND';
}

function is_telegram_queue_sync_type($syncType) {
    $type = strtoupper(trim((string)$syncType));
    return $type === telegram_queue_sync_type() || strpos($type, 'TELEGRAM_') === 0;
}

function enqueue_telegram_message_job($db, $text, $targetChatId = null, $options = [], $eventType = 'GENERIC', $context = []) {
    if (!$db) {
        splaro_integration_trace('telegram.queue.insert.skipped', ['reason' => 'DB_UNAVAILABLE'], 'WARNING');
        return 0;
    }
    if (!TELEGRAM_ENABLED) {
        splaro_integration_trace('telegram.queue.insert.skipped', ['reason' => 'TELEGRAM_DISABLED'], 'WARNING');
        return 0;
    }

    $chatId = trim((string)($targetChatId ?: telegram_primary_admin_chat_id()));
    if ($chatId === '') {
        splaro_integration_trace('telegram.queue.insert.skipped', ['reason' => 'CHAT_ID_MISSING'], 'ERROR');
        return 0;
    }

    $maxAttempts = defined('TELEGRAM_MAX_RETRIES') ? (int)TELEGRAM_MAX_RETRIES : 3;
    if ($maxAttempts < 1) $maxAttempts = 1;
    if ($maxAttempts > 10) $maxAttempts = 10;

    $payload = [
        'chat_id' => $chatId,
        'text' => (string)$text,
        'options' => is_array($options) ? $options : [],
        'event_type' => (string)$eventType,
        'context' => is_array($context) ? $context : ['value' => $context],
        'queued_at' => date('c'),
    ];
    $payloadJson = json_encode($payload);
    if (!is_string($payloadJson) || $payloadJson === '') {
        splaro_integration_trace('telegram.queue.insert.payload_encode_failed', [
            'event_type' => (string)$eventType,
            'json_error' => json_last_error_msg()
        ], 'ERROR');
        return 0;
    }

    $stmt = $db->prepare("INSERT INTO sync_queue (sync_type, payload_json, status, attempts, max_attempts, next_attempt_at) VALUES (?, ?, 'PENDING', 0, ?, NOW())");
    $stmt->execute([telegram_queue_sync_type(), $payloadJson, $maxAttempts]);
    $queueId = (int)$db->lastInsertId();
    splaro_integration_trace('telegram.queue.insert.success', [
        'queue_id' => $queueId,
        'event_type' => (string)$eventType,
        'max_attempts' => $maxAttempts,
        'chat_id_preview' => splaro_clip_text($chatId, 40)
    ]);
    return $queueId;
}

function queue_telegram_message($text, $targetChatId = null, $options = [], $eventType = 'GENERIC', $context = []) {
    global $db;
    $queuedId = 0;
    if (isset($db) && $db) {
        try {
            $queuedId = enqueue_telegram_message_job($db, $text, $targetChatId, $options, $eventType, $context);
        } catch (Exception $e) {
            $queuedId = 0;
            splaro_log_exception('telegram.queue.insert', $e, [
                'event_type' => (string)$eventType
            ]);
        }
    }

    if ($queuedId > 0) {
        schedule_sync_queue_drain($db);
        return true;
    }

    splaro_integration_trace('telegram.queue.insert.deferred', [
        'event_type' => (string)$eventType,
        'reason' => isset($db) && $db ? 'QUEUE_INSERT_FAILED' : 'DB_UNAVAILABLE'
    ], 'ERROR');
    return false;
}

function perform_telegram_queue_request($payload) {
    if (!is_array($payload)) {
        return [false, 0, 'INVALID_PAYLOAD_SHAPE', ''];
    }

    $chatId = trim((string)($payload['chat_id'] ?? ''));
    $text = (string)($payload['text'] ?? '');
    if ($chatId === '' || $text === '') {
        return [false, 0, 'INVALID_TELEGRAM_PAYLOAD', ''];
    }

    $sendPayload = [
        'chat_id' => $chatId,
        'text' => $text,
        'parse_mode' => 'HTML',
        'disable_web_page_preview' => true
    ];
    $options = $payload['options'] ?? [];
    if (is_array($options)) {
        foreach ($options as $key => $value) {
            if ($key === 'chat_id' || $key === 'text') {
                continue;
            }
            $sendPayload[$key] = $value;
        }
    }

    [$response, $httpCode, $requestError] = telegram_api_request('sendMessage', $sendPayload, 5);
    $responseDecoded = null;
    if ($response !== false && is_string($response) && $response !== '') {
        $responseDecoded = json_decode($response, true);
        if ($responseDecoded === null && json_last_error() !== JSON_ERROR_NONE) {
            splaro_integration_trace('telegram.queue.delivery.response_decode_failed', [
                'http_code' => (int)$httpCode,
                'json_error' => json_last_error_msg(),
                'response_preview' => splaro_clip_text($response, 300)
            ], 'ERROR');
        }
    }

    $telegramOk = true;
    $telegramDescription = '';
    if (is_array($responseDecoded) && array_key_exists('ok', $responseDecoded)) {
        $telegramOk = (bool)$responseDecoded['ok'];
        $telegramDescription = (string)($responseDecoded['description'] ?? '');
    }

    if ($response !== false && $httpCode >= 200 && $httpCode < 300 && $telegramOk) {
        return [true, $httpCode, '', (string)$response];
    }

    $errorMessage = trim((string)$requestError);
    if ($errorMessage === '' && $telegramDescription !== '') {
        $errorMessage = $telegramDescription;
    }
    if ($errorMessage === '') {
        $errorMessage = 'TELEGRAM_SEND_FAILED';
    }
    return [false, (int)$httpCode, $errorMessage, is_string($response) ? $response : ''];
}

function process_telegram_queue($db, $limit = 20) {
    $result = [
        'processed' => 0,
        'success' => 0,
        'failed' => 0,
        'retried' => 0,
        'dead' => 0,
        'paused' => false,
        'reason' => '',
    ];
    splaro_integration_trace('telegram.queue.process.start', [
        'limit' => (int)$limit,
        'db_available' => (bool)$db,
        'telegram_enabled' => TELEGRAM_ENABLED
    ]);

    if (!$db) {
        $result['paused'] = true;
        $result['reason'] = 'DB_UNAVAILABLE';
        return $result;
    }
    if (!TELEGRAM_ENABLED) {
        $result['paused'] = true;
        $result['reason'] = 'TELEGRAM_DISABLED';
        return $result;
    }

    $limit = (int)$limit;
    if ($limit < 1) $limit = 1;
    if ($limit > 100) $limit = 100;

    try {
        $stmt = $db->prepare("SELECT id, sync_type, payload_json, attempts, max_attempts FROM sync_queue WHERE sync_type = ? AND status IN ('PENDING', 'RETRY') AND next_attempt_at <= NOW() ORDER BY id ASC LIMIT ?");
        $stmt->bindValue(1, telegram_queue_sync_type(), PDO::PARAM_STR);
        $stmt->bindValue(2, $limit, PDO::PARAM_INT);
        $stmt->execute();
        $jobs = $stmt->fetchAll();
    } catch (Exception $e) {
        $result['paused'] = true;
        $result['reason'] = 'QUEUE_READ_FAILED';
        splaro_log_exception('telegram.queue.process.read', $e);
        return $result;
    }

    foreach ($jobs as $job) {
        $jobId = (int)($job['id'] ?? 0);
        if ($jobId <= 0) {
            continue;
        }

        $claim = $db->prepare("UPDATE sync_queue SET status = 'PROCESSING', attempts = attempts + 1, locked_at = NOW() WHERE id = ? AND status IN ('PENDING', 'RETRY')");
        $claim->execute([$jobId]);
        if ($claim->rowCount() < 1) {
            continue;
        }

        $result['processed']++;
        $attemptsNow = ((int)($job['attempts'] ?? 0)) + 1;
        $maxAttempts = (int)($job['max_attempts'] ?? 0);
        if ($maxAttempts < 1) $maxAttempts = 1;
        if ($maxAttempts > 10) $maxAttempts = 10;

        $payloadRaw = (string)($job['payload_json'] ?? '');
        $payload = json_decode($payloadRaw, true);
        if (!is_array($payload)) {
            $decodeError = json_last_error() !== JSON_ERROR_NONE ? json_last_error_msg() : 'INVALID_JSON_SHAPE';
            $dead = $db->prepare("UPDATE sync_queue SET status = 'DEAD', last_error = ?, last_http_code = 0, locked_at = NULL WHERE id = ?");
            $dead->execute(['INVALID_PAYLOAD_JSON: ' . $decodeError, $jobId]);
            $result['failed']++;
            $result['dead']++;
            splaro_integration_trace('telegram.queue.job.payload_decode_failed', [
                'job_id' => $jobId,
                'json_error' => $decodeError,
                'payload_preview' => splaro_clip_text($payloadRaw, 300)
            ], 'ERROR');
            continue;
        }

        splaro_integration_trace('telegram.queue.job.dispatch', [
            'job_id' => $jobId,
            'attempt' => $attemptsNow,
            'max_attempts' => $maxAttempts,
            'event_type' => (string)($payload['event_type'] ?? '')
        ]);
        [$ok, $httpCode, $error, $response] = perform_telegram_queue_request($payload);
        splaro_integration_trace('telegram.queue.job.result', [
            'job_id' => $jobId,
            'ok' => (bool)$ok,
            'http_code' => (int)$httpCode,
            'error' => (string)$error,
            'response_preview' => splaro_clip_text($response, 300)
        ], $ok ? 'INFO' : 'ERROR');

        if ($ok) {
            $done = $db->prepare("UPDATE sync_queue SET status = 'SUCCESS', last_error = NULL, last_http_code = ?, locked_at = NULL, next_attempt_at = NOW() WHERE id = ?");
            $done->execute([(int)$httpCode, $jobId]);
            $result['success']++;
            continue;
        }

        $result['failed']++;
        $lastError = $error !== '' ? $error : 'TELEGRAM_SEND_FAILED';

        if ($attemptsNow >= $maxAttempts) {
            $dead = $db->prepare("UPDATE sync_queue SET status = 'DEAD', last_error = ?, last_http_code = ?, locked_at = NULL WHERE id = ?");
            $dead->execute([$lastError, (int)$httpCode, $jobId]);
            $result['dead']++;
            try {
                $log = $db->prepare("INSERT INTO system_logs (event_type, event_description, ip_address) VALUES (?, ?, ?)");
                $log->execute([
                    'TELEGRAM_DELIVERY_FAILED',
                    "Dead-letter telegram job {$jobId} failed after {$attemptsNow} attempts: {$lastError}",
                    $_SERVER['REMOTE_ADDR'] ?? 'SERVER'
                ]);
            } catch (Exception $e) {
                splaro_log_exception('telegram.queue.dead_log_write', $e, ['job_id' => $jobId]);
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

    splaro_integration_trace('telegram.queue.process.done', $result);
    return $result;
}

function enqueue_sync_job($db, $type, $data) {
    splaro_integration_trace('sheets.queue.insert.begin', [
        'type' => (string)$type,
        'db_available' => (bool)$db,
        'webhook_configured' => GOOGLE_SHEETS_WEBHOOK_URL !== ''
    ]);
    if (!$db || GOOGLE_SHEETS_WEBHOOK_URL === '') {
        splaro_integration_trace('sheets.queue.insert.skipped', [
            'type' => (string)$type,
            'reason' => !$db ? 'DB_UNAVAILABLE' : 'WEBHOOK_NOT_CONFIGURED'
        ], 'WARNING');
        return 0;
    }

    $maxAttempts = (int)GOOGLE_SHEETS_MAX_RETRIES;
    if ($maxAttempts < 1) $maxAttempts = 1;
    if ($maxAttempts > 10) $maxAttempts = 10;

    $payloadJson = json_encode(is_array($data) ? $data : ['value' => $data]);
    if (!is_string($payloadJson) || $payloadJson === '') {
        splaro_integration_trace('sheets.queue.insert.payload_encode_failed', [
            'type' => (string)$type,
            'json_error' => json_last_error_msg()
        ], 'ERROR');
        return 0;
    }

    $stmt = $db->prepare("INSERT INTO sync_queue (sync_type, payload_json, status, attempts, max_attempts, next_attempt_at) VALUES (?, ?, 'PENDING', 0, ?, NOW())");
    $stmt->execute([(string)$type, $payloadJson, $maxAttempts]);
    $queueId = (int)$db->lastInsertId();
    splaro_integration_trace('sheets.queue.insert.success', [
        'type' => (string)$type,
        'queue_id' => $queueId,
        'max_attempts' => (int)$maxAttempts
    ]);
    return $queueId;
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
    splaro_integration_trace('sheets.queue.process.start', [
        'db_available' => (bool)$db,
        'limit' => (int)$limit,
        'force' => (bool)$force
    ]);
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
        splaro_integration_trace('sheets.queue.process.paused', ['reason' => $result['reason']], 'WARNING');
        return $result;
    }

    if (GOOGLE_SHEETS_WEBHOOK_URL === '') {
        $result['paused'] = true;
        $result['reason'] = 'WEBHOOK_NOT_CONFIGURED';
        splaro_integration_trace('sheets.queue.process.paused', ['reason' => $result['reason']], 'WARNING');
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
        splaro_integration_trace('sheets.queue.process.paused', [
            'reason' => $result['reason'],
            'circuit' => $circuit
        ], 'WARNING');
        return $result;
    }

    try {
        $stmt = $db->prepare("SELECT id, sync_type, payload_json, attempts, max_attempts FROM sync_queue WHERE sync_type NOT LIKE 'TELEGRAM_%' AND status IN ('PENDING', 'RETRY') AND next_attempt_at <= NOW() ORDER BY id ASC LIMIT ?");
        $stmt->bindValue(1, $limit, PDO::PARAM_INT);
        $stmt->execute();
        $jobs = $stmt->fetchAll();
    } catch (Exception $e) {
        $result['paused'] = true;
        $result['reason'] = 'QUEUE_READ_FAILED';
        splaro_log_exception('sheets.queue.process.read', $e, [
            'reason' => $result['reason'],
            'limit' => (int)$limit
        ]);
        return $result;
    }

    splaro_integration_trace('sheets.queue.process.jobs_loaded', [
        'count' => is_array($jobs) ? count($jobs) : 0
    ]);

    foreach ($jobs as $job) {
        $jobId = (int)($job['id'] ?? 0);
        if ($jobId <= 0) continue;

        $claim = $db->prepare("UPDATE sync_queue SET status = 'PROCESSING', attempts = attempts + 1, locked_at = NOW() WHERE id = ? AND status IN ('PENDING', 'RETRY')");
        $claim->execute([$jobId]);
        if ($claim->rowCount() < 1) {
            splaro_integration_trace('sheets.queue.job.claim_skipped', ['job_id' => $jobId], 'WARNING');
            continue;
        }

        $result['processed']++;
        $attemptsNow = ((int)($job['attempts'] ?? 0)) + 1;
        $maxAttempts = (int)($job['max_attempts'] ?? 0);
        if ($maxAttempts < 1) $maxAttempts = 1;
        $syncType = (string)($job['sync_type'] ?? '');
        splaro_integration_trace('sheets.queue.job.claimed', [
            'job_id' => $jobId,
            'sync_type' => $syncType,
            'attempt' => (int)$attemptsNow,
            'max_attempts' => (int)$maxAttempts
        ]);

        $decoded = json_decode((string)($job['payload_json'] ?? ''), true);
        if (!is_array($decoded)) {
            $payloadJsonRaw = (string)($job['payload_json'] ?? '');
            $decodeError = json_last_error() !== JSON_ERROR_NONE ? json_last_error_msg() : 'INVALID_JSON_SHAPE';
            splaro_integration_trace('sheets.queue.job.payload_decode_failed', [
                'job_id' => $jobId,
                'sync_type' => $syncType,
                'json_error' => $decodeError,
                'payload_preview' => splaro_clip_text($payloadJsonRaw, 300)
            ], 'ERROR');
            $dead = $db->prepare("UPDATE sync_queue SET status = 'DEAD', last_error = ?, last_http_code = 0, locked_at = NULL WHERE id = ?");
            $dead->execute(['INVALID_PAYLOAD_JSON', $jobId]);
            $result['failed']++;
            $result['dead']++;
            continue;
        }

        splaro_integration_trace('sheets.queue.job.http_dispatch', [
            'job_id' => $jobId,
            'sync_type' => $syncType
        ]);
        [$ok, $httpCode, $error, $response] = perform_sheets_sync_request($syncType, $decoded);
        splaro_integration_trace('sheets.queue.job.http_result', [
            'job_id' => $jobId,
            'sync_type' => $syncType,
            'ok' => (bool)$ok,
            'http_code' => (int)$httpCode,
            'error' => (string)$error,
            'response_preview' => splaro_clip_text($response, 300)
        ], $ok ? 'INFO' : 'ERROR');
        if ($ok) {
            close_sheets_circuit();
            $done = $db->prepare("UPDATE sync_queue SET status = 'SUCCESS', last_error = NULL, last_http_code = ?, locked_at = NULL, next_attempt_at = NOW() WHERE id = ?");
            $done->execute([$httpCode, $jobId]);
            $result['success']++;
            splaro_integration_trace('sheets.queue.job.success', [
                'job_id' => $jobId,
                'sync_type' => $syncType,
                'http_code' => (int)$httpCode
            ]);
            continue;
        }

        $result['failed']++;
        $lastError = $error !== '' ? $error : 'SYNC_FAILED';

        $httpClass = (int)floor(((int)$httpCode) / 100);
        $shouldOpenCircuit = ((int)$httpCode === 0)
            || $httpClass === 5
            || (int)$httpCode === 429
            || strpos($lastError, 'NETWORK') !== false
            || strpos($lastError, 'TIMEOUT') !== false;
        if ($shouldOpenCircuit) {
            open_sheets_circuit($lastError, (int)$httpCode);
            splaro_integration_trace('sheets.queue.circuit.opened', [
                'job_id' => $jobId,
                'sync_type' => $syncType,
                'http_code' => (int)$httpCode,
                'error' => (string)$lastError
            ], 'WARNING');
        }

        if ($attemptsNow >= $maxAttempts) {
            $dead = $db->prepare("UPDATE sync_queue SET status = 'DEAD', last_error = ?, last_http_code = ?, locked_at = NULL WHERE id = ?");
            $dead->execute([$lastError, $httpCode, $jobId]);
            $result['dead']++;
            splaro_integration_trace('sheets.queue.job.dead', [
                'job_id' => $jobId,
                'sync_type' => $syncType,
                'attempts' => (int)$attemptsNow,
                'max_attempts' => (int)$maxAttempts,
                'http_code' => (int)$httpCode,
                'error' => (string)$lastError
            ], 'ERROR');

            try {
                $log = $db->prepare("INSERT INTO system_logs (event_type, event_description, ip_address) VALUES (?, ?, ?)");
                $log->execute([
                    'SHEETS_SYNC_FAILED',
                    "Dead-letter sync job {$jobId} ({$syncType}) failed after {$attemptsNow} attempts: {$lastError}",
                    $_SERVER['REMOTE_ADDR'] ?? 'SERVER'
                ]);
            } catch (Exception $e) {
                splaro_log_exception('sheets.queue.dead_log_write', $e, [
                    'job_id' => $jobId,
                    'sync_type' => $syncType
                ]);
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
            splaro_integration_trace('sheets.queue.job.retry_scheduled', [
                'job_id' => $jobId,
                'sync_type' => $syncType,
                'attempt' => (int)$attemptsNow,
                'next_delay_seconds' => (int)$delay,
                'http_code' => (int)$httpCode,
                'error' => (string)$lastError
            ], 'WARNING');
        }
    }

    splaro_integration_trace('sheets.queue.process.done', $result);
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
            splaro_log_exception('sheets.queue.shutdown.fastcgi_finish_request', $e);
        }
        splaro_integration_trace('telegram.queue.shutdown.drain_start', ['limit' => 10]);
        $telegramDrainResult = process_telegram_queue($db, 10);
        splaro_integration_trace('telegram.queue.shutdown.drain_done', $telegramDrainResult);
        splaro_integration_trace('sheets.queue.shutdown.drain_start', ['limit' => 5]);
        $drainResult = process_sync_queue($db, 5, false);
        splaro_integration_trace('sheets.queue.shutdown.drain_done', $drainResult);
    });
}

function sync_to_sheets($type, $data) {
    splaro_integration_trace('sheets.trigger.start', [
        'type' => (string)$type,
        'webhook_configured' => GOOGLE_SHEETS_WEBHOOK_URL !== '',
        'db_available' => isset($GLOBALS['SPLARO_DB_CONNECTION']) && $GLOBALS['SPLARO_DB_CONNECTION'] instanceof PDO
    ]);
    if (GOOGLE_SHEETS_WEBHOOK_URL === '') {
        splaro_integration_trace('sheets.trigger.skipped', [
            'type' => (string)$type,
            'reason' => 'WEBHOOK_NOT_CONFIGURED'
        ], 'WARNING');
        return false;
    }

    global $db;
    $queued = 0;
    if (isset($db) && $db) {
        try {
            $queued = enqueue_sync_job($db, $type, $data);
        } catch (Exception $e) {
            $queued = 0;
            splaro_log_exception('sheets.trigger.enqueue', $e, [
                'type' => (string)$type
            ]);
        }
    }

    if ($queued > 0) {
        splaro_integration_trace('sheets.trigger.queued', [
            'type' => (string)$type,
            'queue_id' => (int)$queued
        ]);
        schedule_sync_queue_drain($db);
        return true;
    }

    // Never block core services on external sheet connectivity.
    // If queue insert fails, record and continue without direct network call.
    error_log("SPLARO_SHEETS_SYNC_DEFERRED: type={$type}; reason=QUEUE_INSERT_UNAVAILABLE");
    splaro_integration_trace('sheets.trigger.deferred', [
        'type' => (string)$type,
        'reason' => 'QUEUE_INSERT_UNAVAILABLE'
    ], 'ERROR');
    return false;
}

http_response_code(404);
echo json_encode(["status" => "error", "message" => "ACTION_NOT_RECOGNIZED"]);
