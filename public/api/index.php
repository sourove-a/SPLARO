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

function smtp_collect_env_settings() {
    $secureRaw = strtolower(trim((string)env_first(
        ['SMTP_SECURE', 'SMTP_ENCRYPTION', 'MAIL_ENCRYPTION'],
        ((int)SMTP_PORT === 465 ? 'ssl' : 'tls')
    )));
    if ($secureRaw === 'smtps') $secureRaw = 'ssl';
    if ($secureRaw === 'starttls') $secureRaw = 'tls';

    return [
        'host' => trim((string)env_first(['SMTP_HOST', 'MAIL_HOST'], SMTP_HOST)),
        'port' => (int)env_first(['SMTP_PORT', 'MAIL_PORT'], (string)SMTP_PORT),
        'user' => trim((string)env_first(['SMTP_USER', 'SMTP_USERNAME', 'MAIL_USERNAME', 'MAIL_USER'], SMTP_USER)),
        'pass' => (string)env_first(['SMTP_PASS', 'SMTP_PASSWORD', 'MAIL_PASSWORD', 'MAIL_PASS'], SMTP_PASS),
        'from' => trim((string)env_first(['SMTP_FROM', 'SMTP_FROM_ADDRESS', 'MAIL_FROM_ADDRESS'], '')),
        'secure' => $secureRaw
    ];
}

function smtp_fetch_db_settings($db) {
    $settings = [];
    if (!$db) {
        return $settings;
    }

    try {
        $row = $db->query("SELECT smtp_settings FROM site_settings WHERE id = 1 LIMIT 1")->fetch();
        if (empty($row['smtp_settings'])) {
            return $settings;
        }

        $raw = trim((string)$row['smtp_settings']);
        if ($raw === '') {
            return $settings;
        }

        $decoded = json_decode($raw, true);
        if (!is_array($decoded)) {
            if (json_last_error() !== JSON_ERROR_NONE) {
                splaro_structured_log('smtp.settings.decode_failed', [
                    'json_error' => json_last_error_msg()
                ], 'WARNING');
            }
            return $settings;
        }

        $host = trim((string)($decoded['host'] ?? ''));
        $user = trim((string)($decoded['user'] ?? ''));
        $pass = (string)($decoded['pass'] ?? '');
        $from = trim((string)($decoded['from'] ?? ''));
        $secure = strtolower(trim((string)($decoded['secure'] ?? '')));
        $port = isset($decoded['port']) ? (int)$decoded['port'] : 0;

        if ($host !== '') $settings['host'] = $host;
        if ($port > 0) $settings['port'] = $port;
        if ($user !== '') $settings['user'] = $user;
        if ($pass !== '') $settings['pass'] = $pass;
        if ($from !== '') $settings['from'] = $from;
        if ($secure !== '') $settings['secure'] = $secure;
    } catch (Exception $e) {
        splaro_log_exception('smtp.settings.load', $e, [], 'WARNING');
    }

    return $settings;
}

function smtp_normalize_secure_label($secure, $port) {
    $candidate = strtolower(trim((string)$secure));
    if ($candidate === 'smtps') $candidate = 'ssl';
    if ($candidate === 'starttls') $candidate = 'tls';
    if ($candidate === '') {
        $candidate = ((int)$port === 465 ? 'ssl' : 'tls');
    }
    if (!in_array($candidate, ['ssl', 'tls', 'none'], true)) {
        $candidate = ((int)$port === 465 ? 'ssl' : 'tls');
    }
    return $candidate;
}

function smtp_settings_signature($settings) {
    $host = trim((string)($settings['host'] ?? ''));
    $port = (int)($settings['port'] ?? 0);
    $user = trim((string)($settings['user'] ?? ''));
    $pass = (string)($settings['pass'] ?? '');
    $from = trim((string)($settings['from'] ?? ''));
    $secure = smtp_normalize_secure_label($settings['secure'] ?? '', $port);
    return hash('sha256', $host . '|' . $port . '|' . $user . '|' . $pass . '|' . $from . '|' . $secure);
}

function smtp_profile_redacted($settings) {
    $host = trim((string)($settings['host'] ?? ''));
    $port = (int)($settings['port'] ?? 0);
    $user = trim((string)($settings['user'] ?? ''));
    $pass = (string)($settings['pass'] ?? '');
    $from = trim((string)($settings['from'] ?? ''));
    $secure = smtp_normalize_secure_label($settings['secure'] ?? '', $port);
    return [
        'host' => splaro_clip_text($host, 120),
        'port' => $port,
        'secure' => $secure,
        'user' => splaro_clip_text($user, 120),
        'from' => splaro_clip_text($from, 120),
        'auth' => ($user !== '' || $pass !== ''),
        'pass_set' => $pass !== '',
        'pass_len' => strlen($pass)
    ];
}

function smtp_try_send_profile($settings, $to, $subject, $body, $altBody = '', $isHtml = true, $attachments = []) {
    $smtpHost = trim((string)($settings['host'] ?? ''));
    $smtpPort = (int)($settings['port'] ?? SMTP_PORT);
    $smtpUser = trim((string)($settings['user'] ?? ''));
    $smtpPass = (string)($settings['pass'] ?? '');
    $fromAddress = trim((string)($settings['from'] ?? $smtpUser));
    if ($fromAddress === '') {
        $fromAddress = $smtpUser !== '' ? $smtpUser : 'info@splaro.co';
    }
    $secure = smtp_normalize_secure_label($settings['secure'] ?? '', $smtpPort);

    $mail = new PHPMailer(true);
    try {
        $mail->isSMTP();
        $mail->Host = $smtpHost !== '' ? $smtpHost : SMTP_HOST;
        $mail->Port = $smtpPort > 0 ? $smtpPort : (int)SMTP_PORT;
        $mail->CharSet = 'UTF-8';
        $mail->Timeout = 12;
        $mail->SMTPAuth = ($smtpUser !== '' || $smtpPass !== '');
        $mail->Username = $smtpUser;
        $mail->Password = $smtpPass;
        $mail->AuthType = 'LOGIN';

        if ($secure === 'ssl') {
            if ($mail->Port <= 0) {
                $mail->Port = 465;
            }
            $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
        } elseif ($secure === 'tls') {
            if ($mail->Port <= 0) {
                $mail->Port = 587;
            }
            $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        } else {
            $mail->SMTPSecure = '';
            $mail->SMTPAutoTLS = false;
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
        $mail->Body = $body;
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
        return [
            'ok' => true,
            'from' => $fromAddress,
            'error_info' => '',
            'error_message' => ''
        ];
    } catch (Throwable $e) {
        return [
            'ok' => false,
            'from' => $fromAddress,
            'error_info' => (string)$mail->ErrorInfo,
            'error_message' => $e->getMessage(),
            'exception' => $e
        ];
    }
}

function send_institutional_email($to, $subject, $body, $altBody = '', $isHtml = true, $attachments = []) {
    global $db;

    $envSettings = smtp_collect_env_settings();
    $smtpSettings = $envSettings;
    $settingsSource = 'ENV_DEFAULT';

    try {
        if (isset($db) && $db && function_exists('load_smtp_settings')) {
            $resolved = load_smtp_settings($db);
            if (is_array($resolved)) {
                $smtpSettings = array_merge($smtpSettings, $resolved);
                $settingsSource = (string)($resolved['source'] ?? 'DB_RESOLVED');
            }
        }
    } catch (Exception $e) {
        splaro_log_exception('mail.smtp_settings_load', $e);
    }

    $smtpUser = trim((string)($smtpSettings['user'] ?? ''));
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

    $profiles = [];
    $seenSignatures = [];
    $primarySignature = smtp_settings_signature($smtpSettings);
    $profiles[] = ['label' => 'primary', 'settings' => $smtpSettings, 'source' => $settingsSource];
    $seenSignatures[$primarySignature] = true;

    if (isset($db) && $db) {
        $dbSettings = smtp_fetch_db_settings($db);
        if (!empty($dbSettings)) {
            $dbPreferred = array_merge($envSettings, $dbSettings);
            $dbSignature = smtp_settings_signature($dbPreferred);
            if (!isset($seenSignatures[$dbSignature])) {
                $profiles[] = ['label' => 'db_fallback', 'settings' => $dbPreferred, 'source' => 'DB_DIRECT'];
                $seenSignatures[$dbSignature] = true;
            }
        }
    }

    $envSignature = smtp_settings_signature($envSettings);
    if (!isset($seenSignatures[$envSignature])) {
        $profiles[] = ['label' => 'env_fallback', 'settings' => $envSettings, 'source' => 'ENV_DIRECT'];
        $seenSignatures[$envSignature] = true;
    }

    $attempts = [];
    foreach ($profiles as $profile) {
        $label = (string)($profile['label'] ?? 'attempt');
        $source = (string)($profile['source'] ?? 'UNKNOWN');
        $settings = is_array($profile['settings'] ?? null) ? $profile['settings'] : [];
        $result = smtp_try_send_profile($settings, $to, $subject, $body, $altBody, $isHtml, $attachments);
        if (!empty($result['ok'])) {
            if (!empty($attempts)) {
                splaro_structured_log('mail.send.recovered', [
                    'to' => splaro_clip_text((string)$to, 120),
                    'subject' => splaro_clip_text((string)$subject, 120),
                    'recovered_by' => $label,
                    'source' => $source
                ], 'WARNING');
            }
            return true;
        }

        $attemptContext = [
            'to' => splaro_clip_text((string)$to, 120),
            'subject' => splaro_clip_text((string)$subject, 120),
            'attempt' => $label,
            'source' => $source,
            'error_info' => splaro_clip_text((string)($result['error_info'] ?? ''), 220),
            'smtp_profile' => smtp_profile_redacted($settings)
        ];
        $attempts[] = $attemptContext;
        $attemptException = $result['exception'] ?? null;
        if ($attemptException instanceof Throwable) {
            splaro_log_exception('mail.send.' . $label, $attemptException, $attemptContext);
        } else {
            splaro_structured_log('mail.send.attempt_failed', $attemptContext, 'ERROR');
        }
    }

    // Last-resort fallback: native PHP mail() on shared hosting
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
        $fallbackSent = @mail($to, $subject, $mailBody, implode("\r\n", $headers));
        if ($fallbackSent) {
            splaro_structured_log('mail.send.php_mail_fallback_success', [
                'to' => splaro_clip_text((string)$to, 120),
                'subject' => splaro_clip_text((string)$subject, 120),
                'smtp_attempts' => count($attempts)
            ], 'WARNING');
            return true;
        }
    }

    return false;
}

$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'CLI'));
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

function splaro_redact_sensitive_text($value) {
    $text = (string)$value;
    if ($text === '') {
        return '';
    }

    $text = (string)preg_replace('/bot\d{6,}:[A-Za-z0-9_-]{20,}/', '[REDACTED_BOT_TOKEN]', $text);
    $text = (string)preg_replace('/Bearer\s+[A-Za-z0-9\-._~+\/]+=*/i', 'Bearer [REDACTED]', $text);
    $text = (string)preg_replace('/(password|pass|token|secret|authorization)\s*[:=]\s*["\']?[^"\',\s]{4,}/i', '$1=[REDACTED]', $text);

    $rawSecrets = [
        (string)TELEGRAM_BOT_TOKEN,
        (string)GOOGLE_SHEETS_WEBHOOK_SECRET,
        (string)PUSH_VAPID_PRIVATE_KEY,
        (string)env_or_default('DB_PASSWORD', ''),
        (string)env_or_default('DB_PASS', ''),
        (string)env_or_default('MYSQL_PASSWORD', '')
    ];
    foreach ($rawSecrets as $secret) {
        $secret = trim((string)$secret);
        if ($secret === '' || strlen($secret) < 6) {
            continue;
        }
        $text = str_replace($secret, '[REDACTED]', $text);
    }

    return $text;
}

function splaro_redact_sensitive_context($value, $depth = 0) {
    if ($depth > 8) {
        return '[MAX_DEPTH_REACHED]';
    }
    if (is_array($value)) {
        $out = [];
        foreach ($value as $k => $v) {
            $key = (string)$k;
            if (preg_match('/(token|secret|password|authorization|cookie|key|otp)/i', $key)) {
                $out[$key] = '[REDACTED]';
                continue;
            }
            $out[$key] = splaro_redact_sensitive_context($v, $depth + 1);
        }
        return $out;
    }
    if (is_object($value)) {
        return splaro_redact_sensitive_context((array)$value, $depth + 1);
    }
    if (is_string($value)) {
        return splaro_redact_sensitive_text($value);
    }
    return $value;
}

function splaro_record_system_error($service, $level, $message, $context = []) {
    $db = $GLOBALS['SPLARO_DB_CONNECTION'] ?? null;
    if (!($db instanceof PDO)) {
        return false;
    }

    $serviceSafe = splaro_clip_text((string)$service, 80);
    $levelSafe = strtoupper(splaro_clip_text((string)$level, 20));
    $messageSafe = splaro_clip_text(splaro_redact_sensitive_text((string)$message), 1200);
    $contextSafe = splaro_redact_sensitive_context(is_array($context) ? $context : ['value' => $context]);
    $contextJson = json_encode($contextSafe, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if (!is_string($contextJson)) {
        $contextJson = json_encode([
            'message' => 'CONTEXT_ENCODE_FAILED',
            'json_error' => json_last_error_msg()
        ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        if (!is_string($contextJson)) {
            $contextJson = '{}';
        }
    }

    try {
        $stmt = $db->prepare("INSERT INTO system_errors (service, level, message, context_json, created_at) VALUES (?, ?, ?, ?, NOW())");
        $stmt->execute([$serviceSafe, $levelSafe, $messageSafe, $contextJson]);
        return true;
    } catch (Throwable $e) {
        error_log('SPLARO_SYSTEM_ERROR_LOG_WRITE_FAILED: ' . splaro_redact_sensitive_text((string)$e->getMessage()));
        return false;
    }
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
    $payload = splaro_redact_sensitive_context(is_array($context) ? $context : ['value' => $context]);
    $payload['error_message'] = splaro_redact_sensitive_text((string)$exception->getMessage());
    $payload['error_file'] = $exception->getFile();
    $payload['error_line'] = $exception->getLine();
    $payload['stack_trace'] = splaro_clip_text(splaro_redact_sensitive_text($exception->getTraceAsString()), 1200);
    splaro_integration_trace($stage . '.exception', $payload, $level);
    splaro_record_system_error(
        (string)$stage,
        strtoupper((string)$level),
        (string)$payload['error_message'],
        $payload
    );
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

function splaro_normalize_path_string($path) {
    $raw = trim((string)$path);
    if ($raw === '') return '';
    $normalized = str_replace(['\\', '//'], ['/', '/'], $raw);
    return rtrim($normalized, '/');
}

function splaro_path_is_child_of($path, $parent) {
    $p = splaro_normalize_path_string($path);
    $r = splaro_normalize_path_string($parent);
    if ($p === '' || $r === '') return false;
    if ($p === $r) return true;
    return strpos($p . '/', $r . '/') === 0;
}

function splaro_is_admin_bundle_dir($dirPath) {
    $dir = splaro_normalize_path_string((string)$dirPath);
    if ($dir === '' || !is_dir($dir)) return false;
    return is_file($dir . '/index.html') && is_file($dir . '/api/index.php');
}

function splaro_copy_directory_tree($sourceDir, $targetDir, $maxEntries = 20000) {
    $source = splaro_normalize_path_string((string)$sourceDir);
    $target = splaro_normalize_path_string((string)$targetDir);
    $result = [
        'files_copied' => 0,
        'dirs_created' => 0,
        'errors' => []
    ];

    if ($source === '' || $target === '' || !is_dir($source)) {
        $result['errors'][] = 'INVALID_SOURCE_OR_TARGET';
        return $result;
    }

    if (!is_dir($target)) {
        if (!@mkdir($target, 0755, true) && !is_dir($target)) {
            $result['errors'][] = 'TARGET_MKDIR_FAILED';
            return $result;
        }
        @chmod($target, 0755);
        $result['dirs_created']++;
    }

    $max = (int)$maxEntries;
    if ($max < 100) $max = 100;
    if ($max > 100000) $max = 100000;

    $sourceLen = strlen($source);
    $entries = 0;

    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($source, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::SELF_FIRST
    );

    foreach ($iterator as $item) {
        $entries++;
        if ($entries > $max) {
            $result['errors'][] = 'MAX_ENTRIES_EXCEEDED';
            break;
        }

        $itemPath = splaro_normalize_path_string((string)$item->getPathname());
        if ($itemPath === '' || !splaro_path_is_child_of($itemPath, $source)) {
            continue;
        }

        $relativePath = ltrim(substr($itemPath, $sourceLen), '/');
        if ($relativePath === '') continue;

        $targetPath = $target . '/' . $relativePath;
        if ($item->isDir()) {
            if (!is_dir($targetPath)) {
                if (!@mkdir($targetPath, 0755, true) && !is_dir($targetPath)) {
                    $result['errors'][] = 'DIR_CREATE_FAILED:' . splaro_clip_text($targetPath, 220);
                    continue;
                }
                $result['dirs_created']++;
            }
            @chmod($targetPath, 0755);
            continue;
        }

        if ($item->isFile()) {
            $targetParent = dirname($targetPath);
            if (!is_dir($targetParent) && !@mkdir($targetParent, 0755, true) && !is_dir($targetParent)) {
                $result['errors'][] = 'PARENT_DIR_CREATE_FAILED:' . splaro_clip_text($targetParent, 220);
                continue;
            }

            if (!@copy($itemPath, $targetPath)) {
                $result['errors'][] = 'COPY_FAILED:' . splaro_clip_text($targetPath, 220);
                continue;
            }
            @chmod($targetPath, 0644);
            $result['files_copied']++;
        }
    }

    return $result;
}

function splaro_copy_file_entry($sourceFile, $targetFile) {
    $src = splaro_normalize_path_string((string)$sourceFile);
    $dst = splaro_normalize_path_string((string)$targetFile);
    if ($src === '' || $dst === '' || !is_file($src)) {
        return false;
    }
    $parent = splaro_normalize_path_string(dirname($dst));
    if ($parent === '' || (!is_dir($parent) && !@mkdir($parent, 0755, true) && !is_dir($parent))) {
        return false;
    }
    if (!@copy($src, $dst)) {
        return false;
    }
    @chmod($dst, 0644);
    return true;
}

function splaro_build_admin_bundle_source_from_web_root($webRoot) {
    $root = splaro_normalize_path_string((string)$webRoot);
    if ($root === '') {
        return ['ok' => false, 'source' => '', 'summary' => []];
    }
    if (!is_file($root . '/index.html') || !is_file($root . '/api/index.php')) {
        return ['ok' => false, 'source' => '', 'summary' => []];
    }

    $tempSource = rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'splaro_admin_source_' . md5($root);
    if (!is_dir($tempSource) && !@mkdir($tempSource, 0755, true) && !is_dir($tempSource)) {
        return ['ok' => false, 'source' => '', 'summary' => []];
    }

    $entries = [
        '.htaccess',
        'index.html',
        'index.php',
        'api',
        'assets',
        'favicon-192.png',
        'favicon-32.png',
        'favicon-512.png',
        'favicon.ico',
        'favicon.svg',
        'apple-touch-icon.png',
        'site.webmanifest',
        'logo-mark.svg',
        'push-sw.js',
        'invoice-template.html',
        'ornaments'
    ];

    $summary = [];
    foreach ($entries as $entry) {
        $srcPath = $root . '/' . $entry;
        $dstPath = $tempSource . '/' . $entry;
        if (is_dir($srcPath)) {
            $copyResult = splaro_copy_directory_tree($srcPath, $dstPath, 30000);
            $summary[] = [
                'entry' => $entry,
                'files_copied' => (int)($copyResult['files_copied'] ?? 0),
                'errors' => (int)(is_array($copyResult['errors'] ?? null) ? count($copyResult['errors']) : 0)
            ];
            continue;
        }
        if (is_file($srcPath)) {
            $ok = splaro_copy_file_entry($srcPath, $dstPath);
            $summary[] = [
                'entry' => $entry,
                'files_copied' => $ok ? 1 : 0,
                'errors' => $ok ? 0 : 1
            ];
        }
    }

    return [
        'ok' => splaro_is_admin_bundle_dir($tempSource),
        'source' => splaro_normalize_path_string($tempSource),
        'summary' => $summary
    ];
}

function splaro_admin_subdomain_repair_cache_file() {
    $cacheKey = md5(__DIR__ . '|admin_subdomain_self_heal_v3');
    return rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . "splaro_admin_subdomain_heal_{$cacheKey}.json";
}

function splaro_read_admin_subdomain_repair_status() {
    $cacheFile = splaro_admin_subdomain_repair_cache_file();
    if (!is_file($cacheFile)) {
        return [
            'ok' => false,
            'reason' => 'NO_ATTEMPT_RECORDED'
        ];
    }
    $raw = @file_get_contents($cacheFile);
    $decoded = is_string($raw) ? json_decode($raw, true) : null;
    if (!is_array($decoded)) {
        return [
            'ok' => false,
            'reason' => 'CACHE_PARSE_FAILED'
        ];
    }
    return $decoded;
}

function maybe_repair_admin_subdomain_bundle($forceRun = false) {
    $enabled = splaro_env_bool('ADMIN_SUBDOMAIN_SELF_HEAL_ENABLED', true);
    if (!$enabled) {
        return [
            'ok' => false,
            'reason' => 'SELF_HEAL_DISABLED'
        ];
    }

    $ttl = (int)env_or_default('ADMIN_SUBDOMAIN_SELF_HEAL_TTL_SECONDS', 3600);
    if ($ttl < 60) $ttl = 60;
    if ($ttl > 3600) $ttl = 3600;

    $cacheFile = splaro_admin_subdomain_repair_cache_file();
    $now = time();
    if (!$forceRun) {
        $cached = splaro_read_admin_subdomain_repair_status();
        $lastAttempt = (int)($cached['attempt_at'] ?? 0);
        if ($lastAttempt > 0 && ($now - $lastAttempt) < $ttl) {
            $cached['cached'] = true;
            return $cached;
        }
    }

    $writeCache = static function ($payload) use ($cacheFile, $now) {
        $data = is_array($payload) ? $payload : [];
        $data['attempt_at'] = $now;
        $data['attempt_at_iso'] = gmdate('c', $now);
        @file_put_contents($cacheFile, json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), LOCK_EX);
        $GLOBALS['SPLARO_ADMIN_SUBDOMAIN_REPAIR_LAST'] = $data;
        return $data;
    };

    try {
        $apiDir = splaro_normalize_path_string(__DIR__);
        $webRoot = splaro_normalize_path_string(dirname($apiDir));
        if ($apiDir === '' || $webRoot === '') {
            return $writeCache(['ok' => false, 'reason' => 'PATH_RESOLVE_FAILED']);
        }

        $sourceCandidates = [];
        $sourceCandidates[] = $webRoot;
        $sourceCandidates[] = $webRoot . '/admin';
        $sourceCandidates[] = $webRoot . '/public_html/admin';
        $sourceCandidates[] = dirname($webRoot) . '/public_html/admin';

        $sourceBundle = '';
        $sourceDerivedFromWebRoot = false;
        $sourceDerivedSummary = [];
        foreach (array_values(array_unique($sourceCandidates)) as $candidate) {
            if (splaro_is_admin_bundle_dir($candidate)) {
                $sourceBundle = splaro_normalize_path_string($candidate);
                break;
            }
        }

        if ($sourceBundle !== '' && $sourceBundle === $webRoot) {
            $fallbackBuild = splaro_build_admin_bundle_source_from_web_root($webRoot);
            if (!empty($fallbackBuild['ok']) && !empty($fallbackBuild['source'])) {
                $sourceBundle = splaro_normalize_path_string((string)$fallbackBuild['source']);
                $sourceDerivedFromWebRoot = true;
                $sourceDerivedSummary = is_array($fallbackBuild['summary'] ?? null) ? $fallbackBuild['summary'] : [];
            }
        }

        if ($sourceBundle === '') {
            $fallbackBuild = splaro_build_admin_bundle_source_from_web_root($webRoot);
            if (!empty($fallbackBuild['ok']) && !empty($fallbackBuild['source'])) {
                $sourceBundle = splaro_normalize_path_string((string)$fallbackBuild['source']);
                $sourceDerivedFromWebRoot = true;
                $sourceDerivedSummary = is_array($fallbackBuild['summary'] ?? null) ? $fallbackBuild['summary'] : [];
            }
        }

        if ($sourceBundle === '') {
            splaro_integration_trace('admin_subdomain.repair.source_missing', [
                'web_root' => $webRoot
            ], 'WARNING');
            return $writeCache([
                'ok' => false,
                'reason' => 'SOURCE_BUNDLE_NOT_FOUND',
                'web_root' => $webRoot
            ]);
        }

        $targetCandidates = [];
        $configuredRoot = splaro_normalize_path_string((string)env_or_default('ADMIN_SUBDOMAIN_ROOT', ''));
        if ($configuredRoot !== '') {
            $targetCandidates[] = $configuredRoot;
        }

        // Candidate 1: common subfolder root when subdomain points to /splaro.co/public_html/admin
        $targetCandidates[] = $webRoot . '/admin';
        $targetCandidates[] = $webRoot . '/admin/admin';

        $domainsRoot = splaro_normalize_path_string(dirname(dirname($webRoot)));
        if ($domainsRoot !== '') {
            $targetCandidates[] = $domainsRoot . '/admin.splaro.co/public_html';
            $targetCandidates[] = $domainsRoot . '/admin.splaro.co';
            $targetCandidates[] = $domainsRoot . '/splaro.co/public_html/admin';
        }

        $accountHome = splaro_normalize_path_string(dirname($domainsRoot));
        if ($accountHome !== '') {
            $targetCandidates[] = $accountHome . '/public_html/admin';
            $targetCandidates[] = $accountHome . '/public_html';
        }

        $targetCandidates[] = '/home/u134578371/domains/admin.splaro.co/public_html';
        $targetCandidates[] = '/home/u134578371/domains/admin.splaro.co';
        $targetCandidates[] = '/home/u134578371/domains/splaro.co/admin.splaro.co/public_html';
        $targetCandidates[] = '/home/u134578371/domains/splaro.co/admin.splaro.co';
        $targetCandidates[] = '/home/u134578371/domains/splaro.co/public_html/admin';
        $targetCandidates[] = '/home/u134578371/public_html/admin';
        $targetCandidates[] = '/home/u134578371/public_html';
        $targetCandidates = array_values(array_unique($targetCandidates));

        $targetsTouched = 0;
        $targetsAttempted = 0;
        $copySummaries = [];
        $sourceReal = splaro_normalize_path_string((string)(realpath($sourceBundle) ?: $sourceBundle));
        $placeholderFiles = ['default.php', 'index2.php', 'index.default.php'];

        foreach ($targetCandidates as $targetPathRaw) {
            $targetPath = splaro_normalize_path_string($targetPathRaw);
            if ($targetPath === '') {
                continue;
            }
            if ($targetPath === $sourceReal || splaro_path_is_child_of($targetPath, $sourceReal)) {
                continue;
            }

            $targetParent = splaro_normalize_path_string(dirname($targetPath));
            if ($targetParent === '' || (!is_dir($targetParent) && !@mkdir($targetParent, 0755, true))) {
                $copySummaries[] = [
                    'target' => $targetPath,
                    'files_copied' => 0,
                    'dirs_created' => 0,
                    'errors' => 1,
                    'last_error' => 'TARGET_PARENT_UNAVAILABLE'
                ];
                continue;
            }
            if (!is_dir($targetPath) && !@mkdir($targetPath, 0755, true) && !is_dir($targetPath)) {
                $copySummaries[] = [
                    'target' => $targetPath,
                    'files_copied' => 0,
                    'dirs_created' => 0,
                    'errors' => 1,
                    'last_error' => 'TARGET_PATH_UNAVAILABLE'
                ];
                continue;
            }

            foreach ($placeholderFiles as $placeholder) {
                $placeholderPath = $targetPath . '/' . $placeholder;
                if (is_file($placeholderPath)) {
                    @unlink($placeholderPath);
                }
            }

            $targetsAttempted++;
            $copyResult = splaro_copy_directory_tree($sourceBundle, $targetPath, 20000);
            $copySummaries[] = [
                'target' => $targetPath,
                'files_copied' => (int)($copyResult['files_copied'] ?? 0),
                'dirs_created' => (int)($copyResult['dirs_created'] ?? 0),
                'errors' => (int)(is_array($copyResult['errors'] ?? null) ? count($copyResult['errors']) : 0),
                'last_error' => is_array($copyResult['errors'] ?? null) && !empty($copyResult['errors']) ? (string)end($copyResult['errors']) : ''
            ];

            if ((int)($copyResult['files_copied'] ?? 0) > 0 && splaro_is_admin_bundle_dir($targetPath)) {
                $targetsTouched++;
                @chmod($targetPath, 0755);
            }
        }

        splaro_integration_trace('admin_subdomain.repair.attempt', [
            'source' => $sourceBundle,
            'source_derived_from_web_root' => $sourceDerivedFromWebRoot,
            'source_derived_summary' => $sourceDerivedSummary,
            'targets_touched' => $targetsTouched,
            'summaries' => $copySummaries
        ], $targetsTouched > 0 ? 'INFO' : 'WARNING');

        return $writeCache([
            'ok' => $targetsTouched > 0,
            'reason' => $targetsTouched > 0 ? 'REPAIRED' : ($targetsAttempted > 0 ? 'COPY_ATTEMPTED_NO_SUCCESS' : 'NO_TARGETS_AVAILABLE'),
            'targets_touched' => $targetsTouched,
            'targets_attempted' => $targetsAttempted,
            'source' => $sourceBundle,
            'source_derived_from_web_root' => $sourceDerivedFromWebRoot,
            'source_derived_summary' => $sourceDerivedSummary,
            'target_candidates' => $targetCandidates,
            'summaries' => $copySummaries
        ]);
    } catch (Throwable $e) {
        splaro_log_exception('admin_subdomain.repair', $e, [], 'WARNING');
        return $writeCache([
            'ok' => false,
            'reason' => 'EXCEPTION',
            'error' => splaro_clip_text(splaro_redact_sensitive_text((string)$e->getMessage()), 300)
        ]);
    }
}

maybe_repair_admin_subdomain_bundle();

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

    $fallbackAdminHeader = trim((string)($_SERVER['HTTP_X_ADMIN_KEY'] ?? ''));
    $fallbackAdminAllowed = ($fallbackAdminHeader !== '' && ADMIN_KEY !== '' && hash_equals(ADMIN_KEY, $fallbackAdminHeader));
    $healthActions = ['health', 'health_probe', 'health_events', 'system_errors', 'recover_dead_queue'];
    if (in_array($action, $healthActions, true) && !$fallbackAdminAllowed) {
        http_response_code(403);
        echo json_encode([
            "status" => "error",
            "message" => "ADMIN_ACCESS_REQUIRED",
            "storage" => "fallback"
        ]);
        exit;
    }

    if ($method === 'GET' && $action === 'health') {
        $diskRoot = __DIR__;
        $diskTotal = @disk_total_space($diskRoot);
        $diskFree = @disk_free_space($diskRoot);
        $diskUsedPercent = null;
        if (is_numeric($diskTotal) && is_numeric($diskFree) && (float)$diskTotal > 0) {
            $diskUsedPercent = round((((float)$diskTotal - (float)$diskFree) / (float)$diskTotal) * 100, 2);
        }
        echo json_encode([
            "status" => "success",
            "service" => "SPLARO_API",
            "timestamp" => date('c'),
            "time" => date('c'),
            "mode" => "DEGRADED",
            "storage" => "fallback",
            "push_enabled" => PUSH_ENABLED,
            "dbHost" => DB_HOST,
            "dbName" => DB_NAME,
            "envSource" => get_env_source_label(),
            "dbPasswordSource" => (string)($GLOBALS['SPLARO_DB_PASSWORD_SOURCE'] ?? ''),
            "db" => $safeDbStatus,
            "server" => [
                "php_version" => PHP_VERSION,
                "sapi" => PHP_SAPI,
                "memory_limit" => (string)ini_get('memory_limit'),
                "max_execution_time" => (int)ini_get('max_execution_time')
            ],
            "disk" => [
                "path" => $diskRoot,
                "total_bytes" => is_numeric($diskTotal) ? (float)$diskTotal : null,
                "free_bytes" => is_numeric($diskFree) ? (float)$diskFree : null,
                "used_percent" => $diskUsedPercent
            ],
            "services" => [
                "db" => [
                    "status" => "DOWN",
                    "latency_ms" => null,
                    "last_checked_at" => date('c'),
                    "error" => (string)($safeDbStatus['message'] ?? 'DATABASE_CONNECTION_FAILED'),
                    "next_action" => health_recommended_action('db', (string)($safeDbStatus['message'] ?? 'DATABASE_CONNECTION_FAILED'))
                ]
            ],
            "health_events" => [],
            "recent_errors" => []
        ]);
        exit;
    }

    if ($method === 'POST' && $action === 'health_probe') {
        http_response_code(503);
        echo json_encode([
            "status" => "error",
            "message" => "DATABASE_CONNECTION_FAILED",
            "result" => [
                "probe" => health_normalize_probe((string)($_GET['probe'] ?? '')),
                "status" => "FAIL",
                "latency_ms" => 0,
                "error" => "DATABASE_CONNECTION_FAILED",
                "checked_at" => date('c')
            ]
        ]);
        exit;
    }

    if ($method === 'GET' && ($action === 'health_events' || $action === 'system_errors')) {
        echo json_encode([
            "status" => "success",
            "events" => [],
            "errors" => []
        ]);
        exit;
    }

    if ($method === 'POST' && $action === 'recover_dead_queue') {
        http_response_code(503);
        echo json_encode([
            "status" => "error",
            "message" => "DATABASE_CONNECTION_FAILED",
            "result" => [
                "recovered" => 0,
                "skipped_permanent" => 0,
                "total_dead_scanned" => 0
            ]
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

function ensure_unique_index_when_clean($db, $table, $indexName, $columnName) {
    try {
        $idx = $db->prepare("SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?");
        $idx->execute([$table, $indexName]);
        if ((int)$idx->fetchColumn() > 0) {
            return true;
        }

        $column = trim((string)$columnName);
        if ($column === '') {
            return false;
        }

        $dupSql = "SELECT {$column} AS col_value, COUNT(*) AS c
                   FROM {$table}
                   WHERE {$column} IS NOT NULL AND {$column} <> ''
                   GROUP BY {$column}
                   HAVING COUNT(*) > 1
                   LIMIT 1";
        $dup = $db->query($dupSql)->fetch();
        if ($dup) {
            splaro_structured_log('schema.unique_index_skipped_duplicates', [
                'table' => (string)$table,
                'index_name' => (string)$indexName,
                'column' => (string)$column,
                'sample_value' => splaro_clip_text((string)($dup['col_value'] ?? ''), 120),
                'sample_count' => (int)($dup['c'] ?? 0)
            ], 'WARN');
            return false;
        }

        $db->exec("CREATE UNIQUE INDEX {$indexName} ON {$table}({$column})");
        return true;
    } catch (Throwable $e) {
        splaro_log_exception('schema.ensure_unique_index_when_clean', $e, [
            'table' => (string)$table,
            'index_name' => (string)$indexName,
            'column' => (string)$columnName
        ], 'WARNING');
        return false;
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
        'preferred_language', 'default_shipping_address',
        'email_verified', 'phone_verified', 'email_verify_code', 'email_verify_expiry'
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
      `order_no` varchar(50) DEFAULT NULL,
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
      `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      `deleted_at` datetime DEFAULT NULL,
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

    ensure_table($db, 'system_errors', "CREATE TABLE IF NOT EXISTS `system_errors` (
      `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
      `service` varchar(80) NOT NULL,
      `level` varchar(20) NOT NULL DEFAULT 'ERROR',
      `message` text NOT NULL,
      `context_json` longtext DEFAULT NULL,
      `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (`id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    ensure_table($db, 'health_events', "CREATE TABLE IF NOT EXISTS `health_events` (
      `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
      `probe` varchar(40) NOT NULL,
      `status` varchar(20) NOT NULL,
      `latency_ms` int(11) DEFAULT NULL,
      `error` text DEFAULT NULL,
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

    ensure_table($db, 'user_addresses', "CREATE TABLE IF NOT EXISTS `user_addresses` (
      `id` varchar(80) NOT NULL,
      `user_id` varchar(50) NOT NULL,
      `label` varchar(60) DEFAULT 'Home',
      `recipient_name` varchar(255) DEFAULT NULL,
      `phone` varchar(50) DEFAULT NULL,
      `district` varchar(100) DEFAULT NULL,
      `thana` varchar(100) DEFAULT NULL,
      `address_line` text DEFAULT NULL,
      `postal_code` varchar(20) DEFAULT NULL,
      `is_default` tinyint(1) DEFAULT 0,
      `is_verified` tinyint(1) DEFAULT 0,
      `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      `deleted_at` datetime DEFAULT NULL,
      PRIMARY KEY (`id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    ensure_table($db, 'order_items', "CREATE TABLE IF NOT EXISTS `order_items` (
      `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
      `order_id` varchar(50) NOT NULL,
      `product_id` varchar(80) DEFAULT NULL,
      `product_name` varchar(255) NOT NULL,
      `product_slug` varchar(255) DEFAULT NULL,
      `brand` varchar(120) DEFAULT NULL,
      `category` varchar(120) DEFAULT NULL,
      `variant_size` varchar(60) DEFAULT NULL,
      `variant_color` varchar(80) DEFAULT NULL,
      `quantity` int(11) NOT NULL DEFAULT 1,
      `unit_price` decimal(12,2) NOT NULL DEFAULT 0.00,
      `line_total` decimal(12,2) NOT NULL DEFAULT 0.00,
      `product_url` text DEFAULT NULL,
      `image_url` text DEFAULT NULL,
      `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (`id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    ensure_table($db, 'order_status_history', "CREATE TABLE IF NOT EXISTS `order_status_history` (
      `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
      `order_id` varchar(50) NOT NULL,
      `from_status` varchar(50) DEFAULT NULL,
      `to_status` varchar(50) NOT NULL,
      `note` text DEFAULT NULL,
      `changed_by` varchar(80) DEFAULT NULL,
      `changed_by_role` varchar(40) DEFAULT NULL,
      `ip_address` varchar(45) DEFAULT NULL,
      `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (`id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    ensure_table($db, 'payments', "CREATE TABLE IF NOT EXISTS `payments` (
      `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
      `order_id` varchar(50) NOT NULL,
      `payment_method` varchar(80) DEFAULT NULL,
      `provider` varchar(80) DEFAULT NULL,
      `transaction_ref` varchar(120) DEFAULT NULL,
      `amount` decimal(12,2) NOT NULL DEFAULT 0.00,
      `currency` varchar(10) DEFAULT 'BDT',
      `status` varchar(40) NOT NULL DEFAULT 'PENDING',
      `payload_json` longtext DEFAULT NULL,
      `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (`id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    ensure_table($db, 'payment_events', "CREATE TABLE IF NOT EXISTS `payment_events` (
      `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
      `order_id` varchar(50) NOT NULL,
      `provider` varchar(80) NOT NULL,
      `event_type` varchar(80) NOT NULL,
      `event_key` varchar(191) DEFAULT NULL,
      `transaction_ref` varchar(120) DEFAULT NULL,
      `val_id` varchar(120) DEFAULT NULL,
      `amount` decimal(12,2) DEFAULT NULL,
      `currency` varchar(10) DEFAULT 'BDT',
      `status` varchar(40) DEFAULT NULL,
      `request_payload_json` longtext DEFAULT NULL,
      `response_payload_json` longtext DEFAULT NULL,
      `http_code` int(11) DEFAULT NULL,
      `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (`id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    ensure_table($db, 'shipments', "CREATE TABLE IF NOT EXISTS `shipments` (
      `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
      `order_id` varchar(50) NOT NULL,
      `carrier` varchar(120) DEFAULT NULL,
      `tracking_number` varchar(120) DEFAULT NULL,
      `status` varchar(40) NOT NULL DEFAULT 'PENDING',
      `payload_json` longtext DEFAULT NULL,
      `shipped_at` datetime DEFAULT NULL,
      `delivered_at` datetime DEFAULT NULL,
      `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (`id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    ensure_table($db, 'integration_logs', "CREATE TABLE IF NOT EXISTS `integration_logs` (
      `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
      `service` varchar(60) NOT NULL,
      `event_type` varchar(80) NOT NULL,
      `status` varchar(20) NOT NULL DEFAULT 'INFO',
      `reference_type` varchar(60) DEFAULT NULL,
      `reference_id` varchar(120) DEFAULT NULL,
      `http_code` int(11) DEFAULT NULL,
      `error_message` text DEFAULT NULL,
      `response_preview` text DEFAULT NULL,
      `meta_json` longtext DEFAULT NULL,
      `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (`id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    ensure_table($db, 'refunds', "CREATE TABLE IF NOT EXISTS `refunds` (
      `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
      `order_id` varchar(50) NOT NULL,
      `user_id` varchar(50) DEFAULT NULL,
      `amount` decimal(12,2) NOT NULL DEFAULT 0.00,
      `reason` text DEFAULT NULL,
      `status` varchar(40) NOT NULL DEFAULT 'PENDING',
      `created_by` varchar(80) DEFAULT NULL,
      `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (`id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    ensure_table($db, 'cancellations', "CREATE TABLE IF NOT EXISTS `cancellations` (
      `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
      `order_id` varchar(50) NOT NULL,
      `user_id` varchar(50) DEFAULT NULL,
      `reason` text DEFAULT NULL,
      `status` varchar(40) NOT NULL DEFAULT 'CONFIRMED',
      `created_by` varchar(80) DEFAULT NULL,
      `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (`id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    ensure_table($db, 'admin_roles', "CREATE TABLE IF NOT EXISTS `admin_roles` (
      `id` varchar(50) NOT NULL,
      `name` varchar(80) NOT NULL,
      `description` text DEFAULT NULL,
      `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (`id`),
      UNIQUE KEY `uniq_admin_roles_name` (`name`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    ensure_table($db, 'admin_permissions', "CREATE TABLE IF NOT EXISTS `admin_permissions` (
      `id` varchar(80) NOT NULL,
      `label` varchar(120) DEFAULT NULL,
      `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (`id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    ensure_table($db, 'admin_role_permissions', "CREATE TABLE IF NOT EXISTS `admin_role_permissions` (
      `role_id` varchar(50) NOT NULL,
      `permission_id` varchar(80) NOT NULL,
      `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (`role_id`, `permission_id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    ensure_table($db, 'admin_user_roles', "CREATE TABLE IF NOT EXISTS `admin_user_roles` (
      `user_id` varchar(50) NOT NULL,
      `role_id` varchar(50) NOT NULL,
      `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (`user_id`, `role_id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    ensure_table($db, 'admin_user_notes', "CREATE TABLE IF NOT EXISTS `admin_user_notes` (
      `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
      `user_id` varchar(50) NOT NULL,
      `admin_id` varchar(80) DEFAULT NULL,
      `note` text NOT NULL,
      `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (`id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    ensure_table($db, 'product_variants', "CREATE TABLE IF NOT EXISTS `product_variants` (
      `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
      `product_id` varchar(50) NOT NULL,
      `variant_sku` varchar(120) NOT NULL,
      `attributes_json` longtext DEFAULT NULL,
      `price_delta` decimal(12,2) NOT NULL DEFAULT 0.00,
      `stock` int(11) NOT NULL DEFAULT 0,
      `status` varchar(20) NOT NULL DEFAULT 'ACTIVE',
      `sort_order` int(11) NOT NULL DEFAULT 0,
      `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      `deleted_at` datetime DEFAULT NULL,
      PRIMARY KEY (`id`),
      UNIQUE KEY `uniq_product_variants_sku` (`variant_sku`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    ensure_table($db, 'stock_movements', "CREATE TABLE IF NOT EXISTS `stock_movements` (
      `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
      `product_id` varchar(50) NOT NULL,
      `variant_id` bigint(20) unsigned DEFAULT NULL,
      `movement_type` varchar(30) NOT NULL DEFAULT 'ADJUSTMENT',
      `delta_qty` int(11) NOT NULL,
      `stock_before` int(11) DEFAULT NULL,
      `stock_after` int(11) DEFAULT NULL,
      `reason` varchar(191) DEFAULT NULL,
      `reference_type` varchar(60) DEFAULT NULL,
      `reference_id` varchar(100) DEFAULT NULL,
      `actor_id` varchar(80) DEFAULT NULL,
      `ip_address` varchar(45) DEFAULT NULL,
      `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (`id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    ensure_table($db, 'abandoned_carts', "CREATE TABLE IF NOT EXISTS `abandoned_carts` (
      `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
      `session_id` varchar(100) NOT NULL,
      `user_id` varchar(50) DEFAULT NULL,
      `email` varchar(255) DEFAULT NULL,
      `phone` varchar(50) DEFAULT NULL,
      `cart_hash` char(64) NOT NULL,
      `items_json` longtext NOT NULL,
      `subtotal` decimal(12,2) NOT NULL DEFAULT 0.00,
      `currency` varchar(10) NOT NULL DEFAULT 'BDT',
      `status` varchar(20) NOT NULL DEFAULT 'ABANDONED',
      `last_activity_at` datetime NOT NULL,
      `recovered_order_id` varchar(50) DEFAULT NULL,
      `notes` text DEFAULT NULL,
      `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (`id`),
      UNIQUE KEY `uniq_abandoned_carts_hash` (`cart_hash`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    ensure_table($db, 'admin_api_keys', "CREATE TABLE IF NOT EXISTS `admin_api_keys` (
      `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
      `key_name` varchar(120) NOT NULL,
      `key_prefix` varchar(32) NOT NULL,
      `key_hash` char(64) NOT NULL,
      `scopes_json` longtext DEFAULT NULL,
      `created_by` varchar(80) DEFAULT NULL,
      `last_used_at` datetime DEFAULT NULL,
      `last_used_ip` varchar(45) DEFAULT NULL,
      `expires_at` datetime DEFAULT NULL,
      `revoked_at` datetime DEFAULT NULL,
      `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (`id`),
      UNIQUE KEY `uniq_admin_api_keys_hash` (`key_hash`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    ensure_table($db, 'admin_ip_allowlist', "CREATE TABLE IF NOT EXISTS `admin_ip_allowlist` (
      `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
      `cidr` varchar(120) NOT NULL,
      `label` varchar(120) DEFAULT NULL,
      `is_active` tinyint(1) NOT NULL DEFAULT 1,
      `created_by` varchar(80) DEFAULT NULL,
      `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (`id`),
      UNIQUE KEY `uniq_admin_ip_allowlist_cidr` (`cidr`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    ensure_table($db, 'user_events', "CREATE TABLE IF NOT EXISTS `user_events` (
      `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
      `user_id` varchar(50) NOT NULL,
      `event_type` varchar(80) NOT NULL,
      `event_payload` longtext DEFAULT NULL,
      `ip_address` varchar(45) DEFAULT NULL,
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

    ensure_table($db, 'push_subscriptions', "CREATE TABLE IF NOT EXISTS `push_subscriptions` (
      `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
      `user_id` varchar(50) DEFAULT NULL,
      `endpoint` text NOT NULL,
      `endpoint_hash` char(64) NOT NULL,
      `p256dh` text NOT NULL,
      `auth` varchar(255) NOT NULL,
      `user_agent` text DEFAULT NULL,
      `is_active` tinyint(1) NOT NULL DEFAULT 1,
      `failure_count` int(11) NOT NULL DEFAULT 0,
      `last_http_code` int(11) DEFAULT NULL,
      `last_error` text DEFAULT NULL,
      `last_failure_at` datetime DEFAULT NULL,
      `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      `last_seen_at` datetime DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (`id`),
      UNIQUE KEY `uniq_push_subscriptions_endpoint_hash` (`endpoint_hash`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    ensure_table($db, 'notifications', "CREATE TABLE IF NOT EXISTS `notifications` (
      `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
      `user_id` varchar(50) NOT NULL,
      `title` varchar(191) NOT NULL,
      `message` text NOT NULL,
      `url` text DEFAULT NULL,
      `type` varchar(30) NOT NULL DEFAULT 'system',
      `campaign_id` bigint(20) unsigned DEFAULT NULL,
      `is_read` tinyint(1) NOT NULL DEFAULT 0,
      `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      `read_at` datetime DEFAULT NULL,
      PRIMARY KEY (`id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    ensure_table($db, 'campaigns', "CREATE TABLE IF NOT EXISTS `campaigns` (
      `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
      `title` varchar(191) NOT NULL,
      `message` text NOT NULL,
      `image_url` text DEFAULT NULL,
      `target_type` varchar(60) NOT NULL,
      `filters_json` longtext DEFAULT NULL,
      `scheduled_at` datetime DEFAULT NULL,
      `status` varchar(20) NOT NULL DEFAULT 'draft',
      `created_by` varchar(80) DEFAULT NULL,
      `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (`id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    ensure_table($db, 'campaign_logs', "CREATE TABLE IF NOT EXISTS `campaign_logs` (
      `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
      `campaign_id` bigint(20) unsigned NOT NULL,
      `subscription_id` bigint(20) unsigned DEFAULT NULL,
      `status` varchar(20) NOT NULL,
      `error_message` text DEFAULT NULL,
      `sent_at` datetime DEFAULT NULL,
      `clicked_at` datetime DEFAULT NULL,
      `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
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
    ensure_column($db, 'push_subscriptions', 'endpoint_hash', 'char(64) DEFAULT NULL');
    ensure_column($db, 'push_subscriptions', 'failure_count', 'int(11) NOT NULL DEFAULT 0');
    ensure_column($db, 'push_subscriptions', 'last_http_code', 'int(11) DEFAULT NULL');
    ensure_column($db, 'push_subscriptions', 'last_error', 'text DEFAULT NULL');
    ensure_column($db, 'push_subscriptions', 'last_failure_at', 'datetime DEFAULT NULL');
    ensure_column($db, 'push_subscriptions', 'last_seen_at', 'datetime DEFAULT CURRENT_TIMESTAMP');
    ensure_column($db, 'notifications', 'campaign_id', 'bigint(20) unsigned DEFAULT NULL');
    ensure_column($db, 'notifications', 'read_at', 'datetime DEFAULT NULL');
    ensure_column($db, 'campaigns', 'image_url', 'text DEFAULT NULL');
    ensure_column($db, 'campaigns', 'filters_json', 'longtext DEFAULT NULL');
    ensure_column($db, 'campaigns', 'scheduled_at', 'datetime DEFAULT NULL');
    ensure_column($db, 'campaigns', 'status', 'varchar(20) NOT NULL DEFAULT \"draft\"');
    ensure_column($db, 'campaigns', 'created_by', 'varchar(80) DEFAULT NULL');
    ensure_column($db, 'campaigns', 'updated_at', 'timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
    ensure_column($db, 'campaign_logs', 'subscription_id', 'bigint(20) unsigned DEFAULT NULL');
    ensure_column($db, 'campaign_logs', 'clicked_at', 'datetime DEFAULT NULL');

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
    ensure_column($db, 'products', 'updated_at', 'timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');

    ensure_column($db, 'orders', 'order_no', 'varchar(50) DEFAULT NULL');
    ensure_column($db, 'orders', 'district', 'varchar(100) DEFAULT NULL');
    ensure_column($db, 'orders', 'thana', 'varchar(100) DEFAULT NULL');
    ensure_column($db, 'orders', 'tracking_number', 'varchar(100) DEFAULT NULL');
    ensure_column($db, 'orders', 'payment_method', 'varchar(80) DEFAULT NULL');
    ensure_column($db, 'orders', 'payment_status', "varchar(40) DEFAULT 'PENDING'");
    ensure_column($db, 'orders', 'paid_at', 'datetime DEFAULT NULL');
    ensure_column($db, 'orders', 'admin_notes', 'text DEFAULT NULL');
    ensure_column($db, 'orders', 'customer_comment', 'text DEFAULT NULL');
    ensure_column($db, 'orders', 'shipping_fee', 'int(11) DEFAULT NULL');
    ensure_column($db, 'orders', 'discount_amount', 'int(11) DEFAULT 0');
    ensure_column($db, 'orders', 'discount_code', 'varchar(100) DEFAULT NULL');
    ensure_column($db, 'payments', 'validation_ref', 'varchar(120) DEFAULT NULL');
    ensure_column($db, 'payments', 'validated_at', 'datetime DEFAULT NULL');
    ensure_column($db, 'payments', 'idempotency_key', 'varchar(191) DEFAULT NULL');
    ensure_column($db, 'shipments', 'provider', 'varchar(80) DEFAULT NULL');
    ensure_column($db, 'shipments', 'consignment_id', 'varchar(120) DEFAULT NULL');
    ensure_column($db, 'shipments', 'external_status', 'varchar(120) DEFAULT NULL');
    ensure_column($db, 'shipments', 'tracking_url', 'text DEFAULT NULL');
    ensure_column($db, 'shipments', 'timeline_json', 'longtext DEFAULT NULL');
    ensure_column($db, 'shipments', 'booking_payload_json', 'longtext DEFAULT NULL');
    ensure_column($db, 'shipments', 'last_synced_at', 'datetime DEFAULT NULL');
    ensure_column($db, 'shipments', 'last_error', 'text DEFAULT NULL');

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
    ensure_column($db, 'users', 'preferred_language', "varchar(8) DEFAULT 'EN'");
    ensure_column($db, 'users', 'default_shipping_address', 'text DEFAULT NULL');
    ensure_column($db, 'users', 'is_blocked', 'tinyint(1) NOT NULL DEFAULT 0');
    ensure_column($db, 'users', 'email_verified', 'tinyint(1) NOT NULL DEFAULT 0');
    ensure_column($db, 'users', 'phone_verified', 'tinyint(1) NOT NULL DEFAULT 0');
    ensure_column($db, 'users', 'email_verify_code', 'varchar(10) DEFAULT NULL');
    ensure_column($db, 'users', 'email_verify_expiry', 'datetime DEFAULT NULL');
    ensure_column($db, 'users', 'updated_at', 'timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
    ensure_column($db, 'users', 'deleted_at', 'datetime DEFAULT NULL');

    ensure_index($db, 'users', 'idx_users_email', 'CREATE INDEX idx_users_email ON users(email)');
    ensure_index($db, 'users', 'idx_users_phone', 'CREATE INDEX idx_users_phone ON users(phone)');
    ensure_index($db, 'users', 'idx_users_created_at', 'CREATE INDEX idx_users_created_at ON users(created_at)');
    ensure_index($db, 'users', 'idx_users_force_relogin', 'CREATE INDEX idx_users_force_relogin ON users(force_relogin)');
    ensure_index($db, 'users', 'idx_users_role_blocked', 'CREATE INDEX idx_users_role_blocked ON users(role, is_blocked)');
    ensure_index($db, 'users', 'idx_users_verified', 'CREATE INDEX idx_users_verified ON users(email_verified, phone_verified)');
    ensure_index($db, 'orders', 'idx_orders_email', 'CREATE INDEX idx_orders_email ON orders(customer_email)');
    ensure_index($db, 'orders', 'idx_orders_phone', 'CREATE INDEX idx_orders_phone ON orders(phone)');
    ensure_index($db, 'orders', 'idx_orders_created_at', 'CREATE INDEX idx_orders_created_at ON orders(created_at)');
    ensure_index($db, 'orders', 'idx_orders_status', 'CREATE INDEX idx_orders_status ON orders(status)');
    ensure_index($db, 'orders', 'idx_orders_payment_status_created', 'CREATE INDEX idx_orders_payment_status_created ON orders(payment_status, created_at)');
    ensure_index($db, 'orders', 'idx_orders_status_created_at', 'CREATE INDEX idx_orders_status_created_at ON orders(status, created_at)');
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
    ensure_index($db, 'products', 'idx_products_updated_at', 'CREATE INDEX idx_products_updated_at ON products(updated_at)');
    ensure_index($db, 'products', 'idx_products_status_category', 'CREATE INDEX idx_products_status_category ON products(status, category)');
    ensure_index($db, 'products', 'idx_products_category_type', 'CREATE INDEX idx_products_category_type ON products(category, type)');
    ensure_index($db, 'products', 'idx_products_status_created', 'CREATE INDEX idx_products_status_created ON products(status, created_at)');
    ensure_index($db, 'products', 'idx_products_stock_status', 'CREATE INDEX idx_products_stock_status ON products(stock, status)');
    try {
        $db->exec("UPDATE orders SET order_no = id WHERE (order_no IS NULL OR order_no = '') AND id IS NOT NULL");
    } catch (Exception $e) {
        splaro_log_exception('schema.backfill.order_no', $e, [], 'WARNING');
    }
    ensure_unique_index_when_clean($db, 'orders', 'uniq_orders_order_no', 'order_no');
    ensure_unique_index_when_clean($db, 'products', 'uniq_products_slug', 'slug');
    ensure_unique_index_when_clean($db, 'products', 'uniq_products_sku', 'sku');
    ensure_index($db, 'product_images', 'idx_product_images_product', 'CREATE INDEX idx_product_images_product ON product_images(product_id)');
    ensure_index($db, 'product_images', 'idx_product_images_sort', 'CREATE INDEX idx_product_images_sort ON product_images(product_id, sort_order)');
    ensure_index($db, 'order_items', 'idx_order_items_order', 'CREATE INDEX idx_order_items_order ON order_items(order_id)');
    ensure_index($db, 'order_items', 'idx_order_items_product', 'CREATE INDEX idx_order_items_product ON order_items(product_id)');
    ensure_index($db, 'order_items', 'idx_order_items_order_product_created', 'CREATE INDEX idx_order_items_order_product_created ON order_items(order_id, product_id, created_at)');
    ensure_index($db, 'order_status_history', 'idx_order_status_history_order_created', 'CREATE INDEX idx_order_status_history_order_created ON order_status_history(order_id, created_at)');
    ensure_index($db, 'payments', 'idx_payments_order_status_created', 'CREATE INDEX idx_payments_order_status_created ON payments(order_id, status, created_at)');
    ensure_index($db, 'payments', 'idx_payments_transaction_ref', 'CREATE INDEX idx_payments_transaction_ref ON payments(transaction_ref)');
    ensure_index($db, 'payments', 'idx_payments_idempotency_key', 'CREATE INDEX idx_payments_idempotency_key ON payments(idempotency_key)');
    ensure_unique_index_when_clean($db, 'payments', 'uniq_payments_transaction_ref', 'transaction_ref');
    ensure_index($db, 'shipments', 'idx_shipments_order_status_created', 'CREATE INDEX idx_shipments_order_status_created ON shipments(order_id, status, created_at)');
    ensure_index($db, 'shipments', 'idx_shipments_consignment_id', 'CREATE INDEX idx_shipments_consignment_id ON shipments(consignment_id)');
    ensure_unique_index_when_clean($db, 'shipments', 'uniq_shipments_consignment_id', 'consignment_id');
    ensure_index($db, 'payment_events', 'idx_payment_events_order_created', 'CREATE INDEX idx_payment_events_order_created ON payment_events(order_id, created_at)');
    ensure_index($db, 'payment_events', 'idx_payment_events_provider_status_created', 'CREATE INDEX idx_payment_events_provider_status_created ON payment_events(provider, status, created_at)');
    ensure_unique_index_when_clean($db, 'payment_events', 'uniq_payment_events_event_key', 'event_key');
    ensure_index($db, 'integration_logs', 'idx_integration_logs_service_created', 'CREATE INDEX idx_integration_logs_service_created ON integration_logs(service, created_at)');
    ensure_index($db, 'integration_logs', 'idx_integration_logs_status_created', 'CREATE INDEX idx_integration_logs_status_created ON integration_logs(status, created_at)');
    ensure_index($db, 'integration_logs', 'idx_integration_logs_reference', 'CREATE INDEX idx_integration_logs_reference ON integration_logs(reference_type, reference_id)');
    ensure_index($db, 'refunds', 'idx_refunds_order_status_created', 'CREATE INDEX idx_refunds_order_status_created ON refunds(order_id, status, created_at)');
    ensure_index($db, 'refunds', 'idx_refunds_user_created', 'CREATE INDEX idx_refunds_user_created ON refunds(user_id, created_at)');
    ensure_index($db, 'cancellations', 'idx_cancellations_order_status_created', 'CREATE INDEX idx_cancellations_order_status_created ON cancellations(order_id, status, created_at)');
    ensure_index($db, 'cancellations', 'idx_cancellations_user_created', 'CREATE INDEX idx_cancellations_user_created ON cancellations(user_id, created_at)');
    ensure_index($db, 'admin_user_notes', 'idx_admin_user_notes_user_created', 'CREATE INDEX idx_admin_user_notes_user_created ON admin_user_notes(user_id, created_at)');
    ensure_index($db, 'product_variants', 'idx_product_variants_product_status_updated', 'CREATE INDEX idx_product_variants_product_status_updated ON product_variants(product_id, status, updated_at)');
    ensure_index($db, 'product_variants', 'idx_product_variants_product_created', 'CREATE INDEX idx_product_variants_product_created ON product_variants(product_id, created_at)');
    ensure_index($db, 'stock_movements', 'idx_stock_movements_product_created', 'CREATE INDEX idx_stock_movements_product_created ON stock_movements(product_id, created_at)');
    ensure_index($db, 'stock_movements', 'idx_stock_movements_variant_created', 'CREATE INDEX idx_stock_movements_variant_created ON stock_movements(variant_id, created_at)');
    ensure_index($db, 'abandoned_carts', 'idx_abandoned_carts_status_activity', 'CREATE INDEX idx_abandoned_carts_status_activity ON abandoned_carts(status, last_activity_at)');
    ensure_index($db, 'abandoned_carts', 'idx_abandoned_carts_user_activity', 'CREATE INDEX idx_abandoned_carts_user_activity ON abandoned_carts(user_id, last_activity_at)');
    ensure_index($db, 'abandoned_carts', 'idx_abandoned_carts_session_activity', 'CREATE INDEX idx_abandoned_carts_session_activity ON abandoned_carts(session_id, last_activity_at)');
    ensure_index($db, 'admin_api_keys', 'idx_admin_api_keys_revoked_expires', 'CREATE INDEX idx_admin_api_keys_revoked_expires ON admin_api_keys(revoked_at, expires_at)');
    ensure_index($db, 'admin_api_keys', 'idx_admin_api_keys_last_used', 'CREATE INDEX idx_admin_api_keys_last_used ON admin_api_keys(last_used_at)');
    ensure_index($db, 'admin_ip_allowlist', 'idx_admin_ip_allowlist_active_updated', 'CREATE INDEX idx_admin_ip_allowlist_active_updated ON admin_ip_allowlist(is_active, updated_at)');
    ensure_index($db, 'user_events', 'idx_user_events_user_created', 'CREATE INDEX idx_user_events_user_created ON user_events(user_id, created_at)');
    ensure_index($db, 'user_events', 'idx_user_events_type_created', 'CREATE INDEX idx_user_events_type_created ON user_events(event_type, created_at)');
    ensure_index($db, 'system_logs', 'idx_system_logs_created_at', 'CREATE INDEX idx_system_logs_created_at ON system_logs(created_at)');
    ensure_index($db, 'system_errors', 'idx_system_errors_service_created', 'CREATE INDEX idx_system_errors_service_created ON system_errors(service, created_at)');
    ensure_index($db, 'system_errors', 'idx_system_errors_level_created', 'CREATE INDEX idx_system_errors_level_created ON system_errors(level, created_at)');
    ensure_index($db, 'health_events', 'idx_health_events_probe_created', 'CREATE INDEX idx_health_events_probe_created ON health_events(probe, created_at)');
    ensure_index($db, 'health_events', 'idx_health_events_status_created', 'CREATE INDEX idx_health_events_status_created ON health_events(status, created_at)');
    ensure_index($db, 'audit_logs', 'idx_audit_logs_created_at', 'CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at)');
    ensure_index($db, 'audit_logs', 'idx_audit_logs_entity', 'CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id)');
    ensure_index($db, 'support_tickets', 'idx_support_tickets_created_at', 'CREATE INDEX idx_support_tickets_created_at ON support_tickets(created_at)');
    ensure_index($db, 'support_tickets', 'idx_support_tickets_user', 'CREATE INDEX idx_support_tickets_user ON support_tickets(user_id)');
    ensure_index($db, 'page_sections', 'idx_page_sections_updated_at', 'CREATE INDEX idx_page_sections_updated_at ON page_sections(updated_at)');
    ensure_index($db, 'settings_revisions', 'idx_settings_revisions_section_created', 'CREATE INDEX idx_settings_revisions_section_created ON settings_revisions(section_key, created_at)');
    ensure_index($db, 'sync_queue', 'idx_sync_queue_status_next', 'CREATE INDEX idx_sync_queue_status_next ON sync_queue(status, next_attempt_at)');
    ensure_index($db, 'sync_queue', 'idx_sync_queue_created_at', 'CREATE INDEX idx_sync_queue_created_at ON sync_queue(created_at)');
    ensure_index($db, 'push_subscriptions', 'uniq_push_subscriptions_endpoint_hash', 'CREATE UNIQUE INDEX uniq_push_subscriptions_endpoint_hash ON push_subscriptions(endpoint_hash)');
    ensure_index($db, 'push_subscriptions', 'idx_push_subscriptions_user_active', 'CREATE INDEX idx_push_subscriptions_user_active ON push_subscriptions(user_id, is_active)');
    ensure_index($db, 'notifications', 'idx_notifications_user_created', 'CREATE INDEX idx_notifications_user_created ON notifications(user_id, created_at)');
    ensure_index($db, 'notifications', 'idx_notifications_user_read_created', 'CREATE INDEX idx_notifications_user_read_created ON notifications(user_id, is_read, created_at)');
    ensure_index($db, 'campaigns', 'idx_campaigns_status_scheduled', 'CREATE INDEX idx_campaigns_status_scheduled ON campaigns(status, scheduled_at)');
    ensure_index($db, 'campaign_logs', 'idx_campaign_logs_campaign_status_sent', 'CREATE INDEX idx_campaign_logs_campaign_status_sent ON campaign_logs(campaign_id, status, sent_at)');
    ensure_index($db, 'campaign_logs', 'idx_campaign_logs_subscription_created', 'CREATE INDEX idx_campaign_logs_subscription_created ON campaign_logs(subscription_id, created_at)');
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

    $cacheKey = md5(DB_HOST . '|' . DB_NAME . '|' . DB_PORT . '|schema_v20260225_1');
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

function maybe_seed_admin_rbac_defaults($db) {
    if (!($db instanceof PDO)) {
        return;
    }
    $ttl = 43200; // 12h
    $cacheKey = md5(DB_HOST . '|' . DB_NAME . '|rbac_seed_v1');
    $cacheFile = rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . "splaro_rbac_seed_{$cacheKey}.json";
    $now = time();
    if (is_file($cacheFile)) {
        $payload = json_decode((string)@file_get_contents($cacheFile), true);
        if (is_array($payload) && isset($payload['checked_at']) && ($now - (int)$payload['checked_at']) < $ttl) {
            return;
        }
    }
    seed_admin_rbac_defaults($db);
    @file_put_contents($cacheFile, json_encode(['checked_at' => $now]), LOCK_EX);
}

maybe_seed_admin_rbac_defaults($db);

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
ensure_table($db, 'push_subscriptions', "CREATE TABLE IF NOT EXISTS `push_subscriptions` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` varchar(50) DEFAULT NULL,
  `endpoint` text NOT NULL,
  `endpoint_hash` char(64) NOT NULL,
  `p256dh` text NOT NULL,
  `auth` varchar(255) NOT NULL,
  `user_agent` text DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `failure_count` int(11) NOT NULL DEFAULT 0,
  `last_http_code` int(11) DEFAULT NULL,
  `last_error` text DEFAULT NULL,
  `last_failure_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `last_seen_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_push_subscriptions_endpoint_hash` (`endpoint_hash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
ensure_table($db, 'notifications', "CREATE TABLE IF NOT EXISTS `notifications` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` varchar(50) NOT NULL,
  `title` varchar(191) NOT NULL,
  `message` text NOT NULL,
  `url` text DEFAULT NULL,
  `type` varchar(30) NOT NULL DEFAULT 'system',
  `campaign_id` bigint(20) unsigned DEFAULT NULL,
  `is_read` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `read_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
ensure_table($db, 'campaigns', "CREATE TABLE IF NOT EXISTS `campaigns` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `title` varchar(191) NOT NULL,
  `message` text NOT NULL,
  `image_url` text DEFAULT NULL,
  `target_type` varchar(60) NOT NULL,
  `filters_json` longtext DEFAULT NULL,
  `scheduled_at` datetime DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'draft',
  `created_by` varchar(80) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
ensure_table($db, 'campaign_logs', "CREATE TABLE IF NOT EXISTS `campaign_logs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `campaign_id` bigint(20) unsigned NOT NULL,
  `subscription_id` bigint(20) unsigned DEFAULT NULL,
  `status` varchar(20) NOT NULL,
  `error_message` text DEFAULT NULL,
  `sent_at` datetime DEFAULT NULL,
  `clicked_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
ensure_table($db, 'system_errors', "CREATE TABLE IF NOT EXISTS `system_errors` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `service` varchar(80) NOT NULL,
  `level` varchar(20) NOT NULL DEFAULT 'ERROR',
  `message` text NOT NULL,
  `context_json` longtext DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
ensure_table($db, 'health_events', "CREATE TABLE IF NOT EXISTS `health_events` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `probe` varchar(40) NOT NULL,
  `status` varchar(20) NOT NULL,
  `latency_ms` int(11) DEFAULT NULL,
  `error` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
ensure_index($db, 'push_subscriptions', 'uniq_push_subscriptions_endpoint_hash', 'CREATE UNIQUE INDEX uniq_push_subscriptions_endpoint_hash ON push_subscriptions(endpoint_hash)');
ensure_index($db, 'push_subscriptions', 'idx_push_subscriptions_user_active', 'CREATE INDEX idx_push_subscriptions_user_active ON push_subscriptions(user_id, is_active)');
ensure_index($db, 'notifications', 'idx_notifications_user_created', 'CREATE INDEX idx_notifications_user_created ON notifications(user_id, created_at)');
ensure_index($db, 'notifications', 'idx_notifications_user_read_created', 'CREATE INDEX idx_notifications_user_read_created ON notifications(user_id, is_read, created_at)');
ensure_index($db, 'campaigns', 'idx_campaigns_status_scheduled', 'CREATE INDEX idx_campaigns_status_scheduled ON campaigns(status, scheduled_at)');
ensure_index($db, 'campaign_logs', 'idx_campaign_logs_campaign_status_sent', 'CREATE INDEX idx_campaign_logs_campaign_status_sent ON campaign_logs(campaign_id, status, sent_at)');
ensure_index($db, 'campaign_logs', 'idx_campaign_logs_subscription_created', 'CREATE INDEX idx_campaign_logs_subscription_created ON campaign_logs(subscription_id, created_at)');
ensure_index($db, 'system_errors', 'idx_system_errors_service_created', 'CREATE INDEX idx_system_errors_service_created ON system_errors(service, created_at)');
ensure_index($db, 'system_errors', 'idx_system_errors_level_created', 'CREATE INDEX idx_system_errors_level_created ON system_errors(level, created_at)');
ensure_index($db, 'health_events', 'idx_health_events_probe_created', 'CREATE INDEX idx_health_events_probe_created ON health_events(probe, created_at)');
ensure_index($db, 'health_events', 'idx_health_events_status_created', 'CREATE INDEX idx_health_events_status_created ON health_events(status, created_at)');
ensure_table($db, 'payment_events', "CREATE TABLE IF NOT EXISTS `payment_events` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `order_id` varchar(50) NOT NULL,
  `provider` varchar(80) NOT NULL,
  `event_type` varchar(80) NOT NULL,
  `event_key` varchar(191) DEFAULT NULL,
  `transaction_ref` varchar(120) DEFAULT NULL,
  `val_id` varchar(120) DEFAULT NULL,
  `amount` decimal(12,2) DEFAULT NULL,
  `currency` varchar(10) DEFAULT 'BDT',
  `status` varchar(40) DEFAULT NULL,
  `request_payload_json` longtext DEFAULT NULL,
  `response_payload_json` longtext DEFAULT NULL,
  `http_code` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
ensure_table($db, 'integration_logs', "CREATE TABLE IF NOT EXISTS `integration_logs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `service` varchar(60) NOT NULL,
  `event_type` varchar(80) NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'INFO',
  `reference_type` varchar(60) DEFAULT NULL,
  `reference_id` varchar(120) DEFAULT NULL,
  `http_code` int(11) DEFAULT NULL,
  `error_message` text DEFAULT NULL,
  `response_preview` text DEFAULT NULL,
  `meta_json` longtext DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
ensure_column($db, 'orders', 'payment_method', 'varchar(80) DEFAULT NULL');
ensure_column($db, 'orders', 'payment_status', "varchar(40) DEFAULT 'PENDING'");
ensure_column($db, 'orders', 'paid_at', 'datetime DEFAULT NULL');
ensure_column($db, 'payments', 'validation_ref', 'varchar(120) DEFAULT NULL');
ensure_column($db, 'payments', 'validated_at', 'datetime DEFAULT NULL');
ensure_column($db, 'payments', 'idempotency_key', 'varchar(191) DEFAULT NULL');
ensure_column($db, 'shipments', 'provider', 'varchar(80) DEFAULT NULL');
ensure_column($db, 'shipments', 'consignment_id', 'varchar(120) DEFAULT NULL');
ensure_column($db, 'shipments', 'external_status', 'varchar(120) DEFAULT NULL');
ensure_column($db, 'shipments', 'tracking_url', 'text DEFAULT NULL');
ensure_column($db, 'shipments', 'timeline_json', 'longtext DEFAULT NULL');
ensure_column($db, 'shipments', 'booking_payload_json', 'longtext DEFAULT NULL');
ensure_column($db, 'shipments', 'last_synced_at', 'datetime DEFAULT NULL');
ensure_column($db, 'shipments', 'last_error', 'text DEFAULT NULL');
ensure_index($db, 'orders', 'idx_orders_payment_status_created', 'CREATE INDEX idx_orders_payment_status_created ON orders(payment_status, created_at)');
ensure_index($db, 'payments', 'idx_payments_transaction_ref', 'CREATE INDEX idx_payments_transaction_ref ON payments(transaction_ref)');
ensure_index($db, 'payments', 'idx_payments_idempotency_key', 'CREATE INDEX idx_payments_idempotency_key ON payments(idempotency_key)');
ensure_unique_index_when_clean($db, 'payments', 'uniq_payments_transaction_ref', 'transaction_ref');
ensure_index($db, 'shipments', 'idx_shipments_consignment_id', 'CREATE INDEX idx_shipments_consignment_id ON shipments(consignment_id)');
ensure_unique_index_when_clean($db, 'shipments', 'uniq_shipments_consignment_id', 'consignment_id');
ensure_index($db, 'payment_events', 'idx_payment_events_order_created', 'CREATE INDEX idx_payment_events_order_created ON payment_events(order_id, created_at)');
ensure_index($db, 'payment_events', 'idx_payment_events_provider_status_created', 'CREATE INDEX idx_payment_events_provider_status_created ON payment_events(provider, status, created_at)');
ensure_unique_index_when_clean($db, 'payment_events', 'uniq_payment_events_event_key', 'event_key');
ensure_index($db, 'integration_logs', 'idx_integration_logs_service_created', 'CREATE INDEX idx_integration_logs_service_created ON integration_logs(service, created_at)');
ensure_index($db, 'integration_logs', 'idx_integration_logs_status_created', 'CREATE INDEX idx_integration_logs_status_created ON integration_logs(status, created_at)');
ensure_index($db, 'integration_logs', 'idx_integration_logs_reference', 'CREATE INDEX idx_integration_logs_reference ON integration_logs(reference_type, reference_id)');
ensure_column($db, 'push_subscriptions', 'endpoint_hash', 'char(64) DEFAULT NULL');
ensure_column($db, 'push_subscriptions', 'failure_count', 'int(11) NOT NULL DEFAULT 0');
ensure_column($db, 'push_subscriptions', 'last_http_code', 'int(11) DEFAULT NULL');
ensure_column($db, 'push_subscriptions', 'last_error', 'text DEFAULT NULL');
ensure_column($db, 'push_subscriptions', 'last_failure_at', 'datetime DEFAULT NULL');
ensure_column($db, 'push_subscriptions', 'last_seen_at', 'datetime DEFAULT CURRENT_TIMESTAMP');
ensure_column($db, 'notifications', 'campaign_id', 'bigint(20) unsigned DEFAULT NULL');
ensure_column($db, 'notifications', 'read_at', 'datetime DEFAULT NULL');
ensure_column($db, 'campaigns', 'image_url', 'text DEFAULT NULL');
ensure_column($db, 'campaigns', 'filters_json', 'longtext DEFAULT NULL');
ensure_column($db, 'campaigns', 'scheduled_at', 'datetime DEFAULT NULL');
ensure_column($db, 'campaigns', 'status', 'varchar(20) NOT NULL DEFAULT \"draft\"');
ensure_column($db, 'campaigns', 'created_by', 'varchar(80) DEFAULT NULL');
ensure_column($db, 'campaigns', 'updated_at', 'timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
ensure_column($db, 'campaign_logs', 'subscription_id', 'bigint(20) unsigned DEFAULT NULL');
ensure_column($db, 'campaign_logs', 'clicked_at', 'datetime DEFAULT NULL');
ensure_table($db, 'product_variants', "CREATE TABLE IF NOT EXISTS `product_variants` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `product_id` varchar(50) NOT NULL,
  `variant_sku` varchar(120) NOT NULL,
  `attributes_json` longtext DEFAULT NULL,
  `price_delta` decimal(12,2) NOT NULL DEFAULT 0.00,
  `stock` int(11) NOT NULL DEFAULT 0,
  `status` varchar(20) NOT NULL DEFAULT 'ACTIVE',
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_product_variants_sku` (`variant_sku`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
ensure_table($db, 'stock_movements', "CREATE TABLE IF NOT EXISTS `stock_movements` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `product_id` varchar(50) NOT NULL,
  `variant_id` bigint(20) unsigned DEFAULT NULL,
  `movement_type` varchar(30) NOT NULL DEFAULT 'ADJUSTMENT',
  `delta_qty` int(11) NOT NULL,
  `stock_before` int(11) DEFAULT NULL,
  `stock_after` int(11) DEFAULT NULL,
  `reason` varchar(191) DEFAULT NULL,
  `reference_type` varchar(60) DEFAULT NULL,
  `reference_id` varchar(100) DEFAULT NULL,
  `actor_id` varchar(80) DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
ensure_table($db, 'abandoned_carts', "CREATE TABLE IF NOT EXISTS `abandoned_carts` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `session_id` varchar(100) NOT NULL,
  `user_id` varchar(50) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `phone` varchar(50) DEFAULT NULL,
  `cart_hash` char(64) NOT NULL,
  `items_json` longtext NOT NULL,
  `subtotal` decimal(12,2) NOT NULL DEFAULT 0.00,
  `currency` varchar(10) NOT NULL DEFAULT 'BDT',
  `status` varchar(20) NOT NULL DEFAULT 'ABANDONED',
  `last_activity_at` datetime NOT NULL,
  `recovered_order_id` varchar(50) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_abandoned_carts_hash` (`cart_hash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
ensure_table($db, 'admin_api_keys', "CREATE TABLE IF NOT EXISTS `admin_api_keys` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `key_name` varchar(120) NOT NULL,
  `key_prefix` varchar(32) NOT NULL,
  `key_hash` char(64) NOT NULL,
  `scopes_json` longtext DEFAULT NULL,
  `created_by` varchar(80) DEFAULT NULL,
  `last_used_at` datetime DEFAULT NULL,
  `last_used_ip` varchar(45) DEFAULT NULL,
  `expires_at` datetime DEFAULT NULL,
  `revoked_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_admin_api_keys_hash` (`key_hash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
ensure_table($db, 'admin_ip_allowlist', "CREATE TABLE IF NOT EXISTS `admin_ip_allowlist` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `cidr` varchar(120) NOT NULL,
  `label` varchar(120) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_by` varchar(80) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_admin_ip_allowlist_cidr` (`cidr`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
ensure_index($db, 'product_variants', 'idx_product_variants_product_status_updated', 'CREATE INDEX idx_product_variants_product_status_updated ON product_variants(product_id, status, updated_at)');
ensure_index($db, 'product_variants', 'idx_product_variants_product_created', 'CREATE INDEX idx_product_variants_product_created ON product_variants(product_id, created_at)');
ensure_index($db, 'stock_movements', 'idx_stock_movements_product_created', 'CREATE INDEX idx_stock_movements_product_created ON stock_movements(product_id, created_at)');
ensure_index($db, 'stock_movements', 'idx_stock_movements_variant_created', 'CREATE INDEX idx_stock_movements_variant_created ON stock_movements(variant_id, created_at)');
ensure_index($db, 'abandoned_carts', 'idx_abandoned_carts_status_activity', 'CREATE INDEX idx_abandoned_carts_status_activity ON abandoned_carts(status, last_activity_at)');
ensure_index($db, 'abandoned_carts', 'idx_abandoned_carts_user_activity', 'CREATE INDEX idx_abandoned_carts_user_activity ON abandoned_carts(user_id, last_activity_at)');
ensure_index($db, 'abandoned_carts', 'idx_abandoned_carts_session_activity', 'CREATE INDEX idx_abandoned_carts_session_activity ON abandoned_carts(session_id, last_activity_at)');
ensure_index($db, 'admin_api_keys', 'idx_admin_api_keys_revoked_expires', 'CREATE INDEX idx_admin_api_keys_revoked_expires ON admin_api_keys(revoked_at, expires_at)');
ensure_index($db, 'admin_api_keys', 'idx_admin_api_keys_last_used', 'CREATE INDEX idx_admin_api_keys_last_used ON admin_api_keys(last_used_at)');
ensure_index($db, 'admin_ip_allowlist', 'idx_admin_ip_allowlist_active_updated', 'CREATE INDEX idx_admin_ip_allowlist_active_updated ON admin_ip_allowlist(is_active, updated_at)');
ensure_unique_index_when_clean($db, 'products', 'uniq_products_slug', 'slug');
ensure_unique_index_when_clean($db, 'products', 'uniq_products_sku', 'sku');

function load_smtp_settings($db) {
    $envSettings = smtp_collect_env_settings();
    $dbSettings = smtp_fetch_db_settings($db);
    $forceEnv = filter_var((string)env_or_default('SMTP_FORCE_ENV', 'false'), FILTER_VALIDATE_BOOLEAN);

    // DB settings are preferred so admin panel updates take effect instantly.
    // Set SMTP_FORCE_ENV=true when infrastructure policy requires env-only SMTP.
    if ($forceEnv) {
        $settings = array_merge($dbSettings, $envSettings);
        $source = 'ENV_FORCED';
    } else {
        $settings = array_merge($envSettings, $dbSettings);
        $source = !empty($dbSettings) ? 'DB_PREFERRED' : 'ENV_DEFAULT';
    }

    if (!isset($settings['port']) || (int)$settings['port'] <= 0) {
        $settings['port'] = (int)SMTP_PORT > 0 ? (int)SMTP_PORT : 465;
    } else {
        $settings['port'] = (int)$settings['port'];
    }

    if (trim((string)($settings['host'] ?? '')) === '') {
        $settings['host'] = trim((string)SMTP_HOST);
    }
    if (trim((string)($settings['user'] ?? '')) === '') {
        $settings['user'] = trim((string)SMTP_USER);
    }
    if ((string)($settings['pass'] ?? '') === '') {
        $settings['pass'] = (string)SMTP_PASS;
    }
    if (trim((string)($settings['from'] ?? '')) === '') {
        $settings['from'] = trim((string)($settings['user'] ?? ''));
    }

    $settings['secure'] = smtp_normalize_secure_label($settings['secure'] ?? '', (int)$settings['port']);
    $settings['source'] = $source;

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
        'showOrderId' => false,
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

function invoice_hex_to_rgba($hex, $alpha, $fallback) {
    $candidate = trim((string)$hex);
    if (!preg_match('/^#([0-9a-fA-F]{6})$/', $candidate, $matches)) {
        return $fallback;
    }

    $normalizedAlpha = (float)$alpha;
    if ($normalizedAlpha < 0) $normalizedAlpha = 0;
    if ($normalizedAlpha > 1) $normalizedAlpha = 1;

    $hexValue = $matches[1];
    $r = hexdec(substr($hexValue, 0, 2));
    $g = hexdec(substr($hexValue, 2, 2));
    $b = hexdec(substr($hexValue, 4, 2));
    $alphaText = rtrim(rtrim(number_format($normalizedAlpha, 3, '.', ''), '0'), '.');
    if ($alphaText === '') $alphaText = '0';

    return "rgba($r,$g,$b,$alphaText)";
}

function invoice_theme_from_cms_bundle($cmsBundle, $fallbackTheme) {
    $fallback = is_array($fallbackTheme) ? $fallbackTheme : invoice_default_settings()['theme'];
    $bundle = is_array($cmsBundle) ? $cmsBundle : [];
    $themeSettings = is_array($bundle['themeSettings'] ?? null) ? $bundle['themeSettings'] : [];
    $colors = is_array($themeSettings['colors'] ?? null) ? $themeSettings['colors'] : [];

    $primary = invoice_valid_color($colors['primary'] ?? '', $fallback['primaryColor']);
    $accent = invoice_valid_color($colors['accent'] ?? '', $fallback['accentColor']);
    $background = invoice_valid_color($colors['background'] ?? '', $fallback['backgroundColor']);

    return [
        'primaryColor' => $primary,
        'accentColor' => $accent,
        'backgroundColor' => $background,
        'tableHeaderColor' => $primary,
        'buttonColor' => $accent
    ];
}

function invoice_theme_defaults_from_site_settings($siteSettingsRow, $fallbackTheme) {
    $fallback = is_array($fallbackTheme) ? $fallbackTheme : invoice_default_settings()['theme'];
    if (!is_array($siteSettingsRow)) {
        return $fallback;
    }

    $settingsJson = safe_json_decode_assoc($siteSettingsRow['settings_json'] ?? '{}', []);
    $cmsRaw = $settingsJson['cmsDraft']
        ?? ($settingsJson['cms_draft']
            ?? ($settingsJson['cmsPublished']
                ?? ($settingsJson['cms_published'] ?? [])));
    if (!is_array($cmsRaw)) {
        return $fallback;
    }
    $cmsBundle = cms_normalize_bundle($cmsRaw);
    return invoice_theme_from_cms_bundle($cmsBundle, $fallback);
}

function invoice_normalize_settings($raw, $siteSettingsRow = null) {
    $base = invoice_default_settings();
    $input = is_array($raw) ? $raw : [];
    $themeInput = isset($input['theme']) && is_array($input['theme']) ? $input['theme'] : [];
    $themeDefaults = invoice_theme_defaults_from_site_settings($siteSettingsRow, $base['theme']);

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
            'primaryColor' => invoice_valid_color($themeInput['primaryColor'] ?? '', $themeDefaults['primaryColor']),
            'accentColor' => invoice_valid_color($themeInput['accentColor'] ?? '', $themeDefaults['accentColor']),
            'backgroundColor' => invoice_valid_color($themeInput['backgroundColor'] ?? '', $themeDefaults['backgroundColor']),
            'tableHeaderColor' => invoice_valid_color($themeInput['tableHeaderColor'] ?? '', $themeDefaults['tableHeaderColor']),
            'buttonColor' => invoice_valid_color($themeInput['buttonColor'] ?? '', $themeDefaults['buttonColor'])
        ],
        'logoUrl' => $logoUrl,
        'footerText' => trim((string)($input['footerText'] ?? $base['footerText'])),
        'policyText' => trim((string)($input['policyText'] ?? $base['policyText'])),
        'showProductImages' => isset($input['showProductImages']) ? (bool)$input['showProductImages'] : (bool)$base['showProductImages'],
        'showOrderId' => isset($input['showOrderId']) ? (bool)$input['showOrderId'] : (bool)$base['showOrderId'],
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
    $themePrimary = invoice_valid_color($theme['primaryColor'] ?? '', '#0A0C12');
    $themeAccent = invoice_valid_color($theme['accentColor'] ?? '', '#41DCFF');
    $themeBackground = invoice_valid_color($theme['backgroundColor'] ?? '', '#F4F7FF');
    $themeHeader = invoice_valid_color($theme['tableHeaderColor'] ?? '', '#111827');
    $themeButton = invoice_valid_color($theme['buttonColor'] ?? '', '#2563EB');
    $primaryGlow = invoice_hex_to_rgba($themePrimary, 0.34, 'rgba(10,12,18,0.34)');
    $primarySoft = invoice_hex_to_rgba($themePrimary, 0.16, 'rgba(10,12,18,0.16)');
    $accentGlow = invoice_hex_to_rgba($themeAccent, 0.26, 'rgba(65,220,255,0.26)');
    $accentSoft = invoice_hex_to_rgba($themeAccent, 0.14, 'rgba(65,220,255,0.14)');
    $headerOverlayOne = invoice_hex_to_rgba($themeAccent, 0.28, 'rgba(65,220,255,0.28)');
    $headerOverlayTwo = invoice_hex_to_rgba($themePrimary, 0.32, 'rgba(10,12,18,0.32)');
    $tableHeaderBorder = invoice_hex_to_rgba($themeHeader, 0.34, 'rgba(17,24,39,0.34)');
    $totalPanelBorder = invoice_hex_to_rgba($themeButton, 0.35, 'rgba(37,99,235,0.35)');
    $paymentStatus = invoice_payment_status($orderRow);
    $statusColor = $paymentStatus === 'PAID'
        ? '#16A34A'
        : ($paymentStatus === 'PENDING' ? '#D97706' : '#2563EB');
    $logoUrl = trim((string)($settings['logoUrl'] ?? ''));
    $siteName = trim((string)($orderRow['site_name'] ?? ($settings['siteName'] ?? 'SPLARO')));
    if ($siteName === '') $siteName = 'SPLARO';
    $showOrderId = !empty($settings['showOrderId']);
    $orderReferenceRaw = trim((string)($orderRow['order_no'] ?? $orderRow['id'] ?? ''));
    $orderReferenceLabel = !empty($orderRow['order_no']) ? 'Order Ref:' : 'Order ID:';
    $dateCellAlign = $showOrderId ? 'right' : 'left';
    $issuedAt = date('d M Y • H:i');
    $orderMetaCell = '';
    if ($showOrderId && $orderReferenceRaw !== '') {
        $orderMetaCell = "<td style=\"padding:10px 12px;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;\">"
            . "<span style=\"font-size:12px;color:#64748B;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;\">" . invoice_escape($orderReferenceLabel) . "</span>"
            . "<span style=\"font-size:14px;color:#0F172A;font-weight:800;margin-left:8px;\">" . invoice_escape($orderReferenceRaw) . "</span>"
            . "</td>";
    }

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
        ? "<img src=\"" . invoice_escape($logoUrl) . "\" alt=\"" . invoice_escape($siteName) . "\" style=\"height:38px;max-width:160px;object-fit:contain;display:block;\" />"
        : "<div style=\"font-size:36px;font-weight:900;line-height:1;letter-spacing:-0.03em;color:#F8FAFC;\">" . invoice_escape($siteName) . "</div>";

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
<body style=\"margin:0;padding:24px;background:radial-gradient(circle at 8% 8%," . invoice_escape($accentGlow) . ",transparent 36%),radial-gradient(circle at 90% 4%," . invoice_escape($primarySoft) . ",transparent 42%),linear-gradient(160deg,#E5ECFF 0%,#EEF3FF 48%,#E0E8FF 100%);font-family:'Inter','Segoe UI',Arial,sans-serif;color:#0F172A;\">
  <div style=\"max-width:860px;margin:0 auto;background:" . invoice_escape($themeBackground) . ";border:1px solid " . invoice_escape($primarySoft) . ";border-radius:24px;overflow:hidden;box-shadow:0 34px 75px " . invoice_escape($primaryGlow) . ";\">
    <div style=\"position:relative;padding:30px;background:linear-gradient(132deg," . invoice_escape($themePrimary) . " 0%,#060B1A 48%," . invoice_escape($themeAccent) . " 150%);color:#F8FAFC;\">
      <div style=\"position:absolute;inset:0;background:radial-gradient(circle at 84% 16%," . invoice_escape($headerOverlayOne) . ",transparent 42%),radial-gradient(circle at 12% 88%," . invoice_escape($headerOverlayTwo) . ",transparent 48%);pointer-events:none;\"></div>
      <div style=\"position:absolute;left:0;right:0;bottom:0;height:2px;background:linear-gradient(90deg,transparent 0%," . invoice_escape($themeAccent) . " 50%,transparent 100%);opacity:0.9;\"></div>
      <table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" style=\"position:relative;z-index:1;\">
        <tr>
          <td style=\"vertical-align:top;width:50%;\">" . $logoBlock . "
            <div style=\"margin-top:10px;font-size:12px;font-weight:800;letter-spacing:0.08em;color:#D7EEFF;text-transform:uppercase;\">Luxury Footwear &amp; Bags</div>
          </td>
          <td style=\"vertical-align:top;text-align:right;\">
            <div style=\"font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#93C5FD;\">$documentLabel</div>
            <div style=\"font-size:46px;font-weight:900;line-height:1.06;margin-top:8px;letter-spacing:-0.03em;text-shadow:0 10px 26px " . invoice_escape($primaryGlow) . ";\">" . invoice_escape($serial) . "</div>
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
          " . $orderMetaCell . "
          <td style=\"padding:10px 12px;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;text-align:" . invoice_escape($dateCellAlign) . ";\">
            <span style=\"font-size:12px;color:#64748B;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;\">Issued:</span>
            <span style=\"font-size:14px;color:#0F172A;font-weight:800;margin-left:8px;\">" . invoice_escape($issuedAt) . "</span>
          </td>
        </tr>
      </table>

      <table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" style=\"border:1px solid #E2E8F0;border-radius:14px;overflow:hidden;\">
        <thead>
          <tr style=\"background:" . invoice_escape($themeHeader) . ";box-shadow:inset 0 -1px 0 " . invoice_escape($tableHeaderBorder) . ";\">
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
            <div style=\"padding:14px 16px;border-radius:12px;background:linear-gradient(160deg,#FFFFFF 0%,#F8FBFF 100%);border:1px solid " . invoice_escape($totalPanelBorder) . ";\">
              <table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\">
                <tr><td style=\"padding:4px 0;color:#475569;font-size:13px;\">Subtotal</td><td style=\"padding:4px 0;color:#0F172A;font-size:13px;text-align:right;font-weight:700;\">" . invoice_currency($totals['subtotal']) . "</td></tr>"
                  . (!empty($settings['showDiscount']) ? "<tr><td style=\"padding:4px 0;color:#475569;font-size:13px;\">Discount</td><td style=\"padding:4px 0;color:#0F172A;font-size:13px;text-align:right;font-weight:700;\">-" . invoice_currency($totals['discount']) . "</td></tr>" : '') .
                  (!empty($settings['showShipping']) ? "<tr><td style=\"padding:4px 0;color:#475569;font-size:13px;\">Shipping</td><td style=\"padding:4px 0;color:#0F172A;font-size:13px;text-align:right;font-weight:700;\">" . invoice_currency($totals['shipping']) . "</td></tr>" : '') .
                  (!empty($settings['showTax']) ? "<tr><td style=\"padding:4px 0;color:#475569;font-size:13px;\">Tax</td><td style=\"padding:4px 0;color:#0F172A;font-size:13px;text-align:right;font-weight:700;\">" . invoice_currency($totals['tax']) . "</td></tr>" : '') .
                "<tr><td colspan=\"2\" style=\"padding-top:8px;border-bottom:1px solid #CBD5E1;\"></td></tr>
                <tr><td style=\"padding-top:10px;color:#0F172A;font-size:16px;font-weight:900;letter-spacing:0.03em;text-transform:uppercase;\">Grand Total</td><td style=\"padding-top:10px;color:" . invoice_escape($themeButton) . ";font-size:30px;text-align:right;font-weight:900;letter-spacing:-0.02em;text-shadow:0 8px 18px " . invoice_escape($accentSoft) . ";\">" . invoice_currency($totals['grand']) . "</td></tr>
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

function invoice_build_plain_text($orderRow, $items, $serial, $totals, $label, $settings = []) {
    $lines = [];
    $lines[] = "SPLARO {$label}";
    $lines[] = "Serial: {$serial}";
    if (!empty($settings['showOrderId'])) {
        $reference = trim((string)($orderRow['order_no'] ?? $orderRow['id'] ?? ''));
        if ($reference !== '') {
            $lines[] = "Order: " . $reference;
        }
    }
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
    if (!empty($settings['showDiscount'])) {
        $lines[] = "Discount: " . invoice_currency($totals['discount']);
    }
    if (!empty($settings['showShipping'])) {
        $lines[] = "Shipping: " . invoice_currency($totals['shipping']);
    }
    if (!empty($settings['showTax'])) {
        $lines[] = "Tax: " . invoice_currency($totals['tax']);
    }
    $lines[] = "Grand Total: " . invoice_currency($totals['grand']);
    return implode("\n", $lines);
}

function invoice_basic_pdf_fallback_enabled() {
    return strtolower(trim((string)env_or_default('INVOICE_ALLOW_BASIC_PDF_FALLBACK', 'false'))) === 'true';
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

    if (!invoice_basic_pdf_fallback_enabled()) {
        splaro_structured_log('invoice.pdf.basic_fallback_skipped', [
            'target_path' => (string)$targetPath,
            'reason' => 'NO_PDF_ENGINE',
            'hint' => 'Set INVOICE_ALLOW_BASIC_PDF_FALLBACK=true to re-enable plain text PDF fallback'
        ], 'WARNING');
        return false;
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
            $number = 0;
        } else {
            $currentNumber = (int)($counterRow['current_number'] ?? 0);
            $number = $currentNumber + 1;
            if ($currentNumber > 0) {
                $docCountStmt = $db->prepare("SELECT COUNT(*) FROM invoice_documents WHERE doc_type = ?");
                $docCountStmt->execute([$type]);
                $existingTypeDocs = (int)$docCountStmt->fetchColumn();
                if ($existingTypeDocs === 0) {
                    $number = 0;
                }
            }
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
    $serialBase = $prefix . '-' . str_pad((string)$number, $padding, '0', STR_PAD_LEFT);
    $defaultType = strtoupper(trim((string)($settings['defaultType'] ?? 'INV')));
    $serial = $type === $defaultType
        ? $serialBase
        : ($serialBase . '-' . $type);

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
    $plainText = invoice_build_plain_text($orderRow, $items, $serial, $totals, $label, $settings);

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

    $heavyActions = [
        'sync', 'process_sync_queue', 'sync_queue_status', 'health_probe', 'health_events', 'system_errors',
        'recover_dead_queue', 'admin_audit_logs', 'admin_export_products', 'admin_export_orders',
        'admin_export_customers', 'admin_abandoned_carts', 'admin_stock_movements'
    ];
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

function csrf_cookie_domain() {
    $host = strtolower(trim((string)($_SERVER['HTTP_HOST'] ?? '')));
    if ($host === '') {
        return '';
    }
    $host = preg_replace('/:\d+$/', '', $host);
    if ($host === '' || $host === 'localhost' || filter_var($host, FILTER_VALIDATE_IP)) {
        return '';
    }
    if ($host === 'splaro.co' || str_ends_with($host, '.splaro.co')) {
        return '.splaro.co';
    }
    return '';
}

function set_csrf_cookie($token) {
    $params = [
        'expires' => time() + (30 * 24 * 60 * 60),
        'path' => '/',
        'secure' => is_https_request(),
        'httponly' => false,
        'samesite' => 'Lax'
    ];
    $cookieDomain = csrf_cookie_domain();
    if ($cookieDomain !== '') {
        $params['domain'] = $cookieDomain;
    }
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

function csv_escape_value($value) {
    if ($value === null) return '';
    if (is_bool($value)) return $value ? '1' : '0';
    if (!is_scalar($value)) {
        $encoded = json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if (!is_string($encoded)) {
            $encoded = '';
        }
        $value = $encoded;
    }
    $raw = (string)$value;
    $escaped = str_replace('"', '""', $raw);
    if (strpos($escaped, ',') !== false || strpos($escaped, "\n") !== false || strpos($escaped, "\r") !== false || strpos($escaped, '"') !== false) {
        return '"' . $escaped . '"';
    }
    return $escaped;
}

function emit_csv_download($filename, array $headers, array $rows) {
    if (!headers_sent()) {
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="' . preg_replace('/[^A-Za-z0-9._-]/', '-', (string)$filename) . '"');
        header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    }
    echo implode(',', array_map('csv_escape_value', $headers)) . "\n";
    foreach ($rows as $row) {
        $line = [];
        foreach ($headers as $headerName) {
            $line[] = csv_escape_value($row[$headerName] ?? '');
        }
        echo implode(',', $line) . "\n";
    }
}

function get_request_ip() {
    $forwardedFor = trim((string)($_SERVER['HTTP_X_FORWARDED_FOR'] ?? ''));
    if ($forwardedFor !== '') {
        $parts = explode(',', $forwardedFor);
        foreach ($parts as $part) {
            $ip = trim((string)$part);
            if ($ip !== '' && filter_var($ip, FILTER_VALIDATE_IP)) {
                return $ip;
            }
        }
    }
    $remote = trim((string)($_SERVER['REMOTE_ADDR'] ?? ''));
    if ($remote !== '' && filter_var($remote, FILTER_VALIDATE_IP)) {
        return $remote;
    }
    return 'UNKNOWN';
}

function ip_matches_cidr($ip, $cidr) {
    $ipValue = trim((string)$ip);
    $cidrValue = trim((string)$cidr);
    if ($ipValue === '' || $cidrValue === '') {
        return false;
    }

    if (strpos($cidrValue, '/') === false) {
        return hash_equals($cidrValue, $ipValue);
    }

    [$range, $bitsRaw] = explode('/', $cidrValue, 2);
    $bits = (int)$bitsRaw;
    $rangeBin = @inet_pton($range);
    $ipBin = @inet_pton($ipValue);
    if ($rangeBin === false || $ipBin === false || strlen($rangeBin) !== strlen($ipBin)) {
        return false;
    }
    $maxBits = strlen($rangeBin) * 8;
    if ($bits < 0) $bits = 0;
    if ($bits > $maxBits) $bits = $maxBits;

    $bytes = intdiv($bits, 8);
    $remainder = $bits % 8;
    if ($bytes > 0 && substr($rangeBin, 0, $bytes) !== substr($ipBin, 0, $bytes)) {
        return false;
    }
    if ($remainder === 0) {
        return true;
    }
    $mask = (0xFF << (8 - $remainder)) & 0xFF;
    return ((ord($rangeBin[$bytes]) & $mask) === (ord($ipBin[$bytes]) & $mask));
}

function is_valid_ip_or_cidr($value) {
    $cidrValue = trim((string)$value);
    if ($cidrValue === '') {
        return false;
    }
    if (strpos($cidrValue, '/') === false) {
        return filter_var($cidrValue, FILTER_VALIDATE_IP) !== false;
    }
    [$range, $bitsRaw] = explode('/', $cidrValue, 2);
    if (filter_var($range, FILTER_VALIDATE_IP) === false) {
        return false;
    }
    if (!preg_match('/^\d+$/', (string)$bitsRaw)) {
        return false;
    }
    $bits = (int)$bitsRaw;
    $rangeBin = @inet_pton($range);
    if ($rangeBin === false) {
        return false;
    }
    $maxBits = strlen($rangeBin) * 8;
    return $bits >= 0 && $bits <= $maxBits;
}

function normalize_admin_scopes($scopesRaw) {
    $scopes = [];
    if (is_string($scopesRaw)) {
        $scopesRaw = preg_split('/[\s,]+/', $scopesRaw);
    }
    if (is_array($scopesRaw)) {
        foreach ($scopesRaw as $scope) {
            $value = strtolower(trim((string)$scope));
            if ($value === '') continue;
            $value = preg_replace('/[^a-z0-9_.:-]/', '', $value);
            if ($value === '') continue;
            $scopes[$value] = true;
        }
    }
    return array_values(array_keys($scopes));
}

function admin_api_key_hash($rawKey) {
    return hash_hmac('sha256', (string)$rawKey, (string)APP_AUTH_SECRET);
}

function authenticate_admin_api_key($rawKey) {
    $key = trim((string)$rawKey);
    if ($key === '') {
        return false;
    }
    $db = $GLOBALS['SPLARO_DB_CONNECTION'] ?? null;
    if (!($db instanceof PDO)) {
        return false;
    }
    $hash = admin_api_key_hash($key);
    try {
        $stmt = $db->prepare("SELECT id, revoked_at, expires_at FROM admin_api_keys WHERE key_hash = ? LIMIT 1");
        $stmt->execute([$hash]);
        $row = $stmt->fetch();
        if (!$row) {
            return false;
        }
        if (!empty($row['revoked_at'])) {
            return false;
        }
        if (!empty($row['expires_at']) && strtotime((string)$row['expires_at']) !== false && strtotime((string)$row['expires_at']) < time()) {
            return false;
        }
        $touch = $db->prepare("UPDATE admin_api_keys SET last_used_at = NOW(), last_used_ip = ? WHERE id = ?");
        $touch->execute([get_request_ip(), (int)$row['id']]);
        return true;
    } catch (Throwable $e) {
        splaro_log_exception('admin_api_key.authenticate', $e, [], 'WARNING');
        return false;
    }
}

function admin_ip_allowlist_is_allowed($db, $ip) {
    if (!($db instanceof PDO)) {
        return true;
    }
    try {
        $rows = safe_query_all($db, "SELECT cidr FROM admin_ip_allowlist WHERE is_active = 1 ORDER BY id ASC");
        if (empty($rows)) {
            return true;
        }
        foreach ($rows as $row) {
            $cidr = trim((string)($row['cidr'] ?? ''));
            if ($cidr === '') continue;
            if (ip_matches_cidr($ip, $cidr)) {
                return true;
            }
        }
        return false;
    } catch (Throwable $e) {
        splaro_log_exception('admin_ip_allowlist.check', $e, ['ip' => (string)$ip], 'WARNING');
        return true;
    }
}

function record_stock_movement($db, $productId, $variantId, $movementType, $deltaQty, $stockBefore, $stockAfter, $reason = '', $referenceType = '', $referenceId = '', $actorId = null) {
    if (!($db instanceof PDO)) {
        return false;
    }
    try {
        $stmt = $db->prepare("INSERT INTO stock_movements (product_id, variant_id, movement_type, delta_qty, stock_before, stock_after, reason, reference_type, reference_id, actor_id, ip_address, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())");
        $stmt->execute([
            (string)$productId,
            $variantId !== null ? (int)$variantId : null,
            splaro_clip_text(strtoupper((string)$movementType), 30),
            (int)$deltaQty,
            $stockBefore !== null ? (int)$stockBefore : null,
            $stockAfter !== null ? (int)$stockAfter : null,
            splaro_clip_text((string)$reason, 191),
            splaro_clip_text((string)$referenceType, 60),
            splaro_clip_text((string)$referenceId, 100),
            $actorId !== null ? (string)$actorId : null,
            get_request_ip()
        ]);
        return true;
    } catch (Throwable $e) {
        splaro_log_exception('stock_movement.insert', $e, [
            'product_id' => (string)$productId,
            'variant_id' => $variantId !== null ? (int)$variantId : null
        ], 'WARNING');
        return false;
    }
}

function seed_admin_rbac_defaults($db) {
    if (!($db instanceof PDO)) {
        return;
    }
    try {
        $roles = [
            ['SUPER_ADMIN', 'Super Admin', 'Full unrestricted access'],
            ['ADMIN', 'Admin', 'Operational admin access'],
            ['STAFF', 'Staff', 'Operational staff access for orders/catalog/campaigns'],
            ['EDITOR', 'Editor', 'Catalog + content editor'],
            ['VIEWER', 'Viewer', 'Read-only visibility']
        ];
        $roleStmt = $db->prepare("INSERT IGNORE INTO admin_roles (id, name, description, created_at) VALUES (?, ?, ?, NOW())");
        foreach ($roles as $roleRow) {
            $roleStmt->execute([$roleRow[0], $roleRow[1], $roleRow[2]]);
        }

        $permissions = [
            ['orders.view', 'View orders'],
            ['orders.manage', 'Manage order lifecycle'],
            ['catalog.view', 'View product catalog'],
            ['catalog.manage', 'Manage products and variants'],
            ['customers.view', 'View customers'],
            ['customers.manage', 'Manage customer records'],
            ['campaigns.manage', 'Manage campaigns'],
            ['reports.view', 'View analytics and reports'],
            ['settings.manage', 'Manage store settings'],
            ['health.view', 'View system health'],
            ['security.manage', 'Manage security settings and keys'],
            ['exports.manage', 'Export/import data']
        ];
        $permStmt = $db->prepare("INSERT IGNORE INTO admin_permissions (id, label, created_at) VALUES (?, ?, NOW())");
        foreach ($permissions as $permissionRow) {
            $permStmt->execute([$permissionRow[0], $permissionRow[1]]);
        }

        $defaultRolePermissions = [
            'SUPER_ADMIN' => array_map(function ($row) { return (string)$row[0]; }, $permissions),
            'ADMIN' => ['orders.view', 'orders.manage', 'catalog.view', 'catalog.manage', 'customers.view', 'customers.manage', 'campaigns.manage', 'reports.view', 'settings.manage', 'health.view', 'exports.manage'],
            'STAFF' => ['orders.view', 'orders.manage', 'catalog.view', 'catalog.manage', 'customers.view', 'campaigns.manage', 'reports.view', 'exports.manage'],
            'EDITOR' => ['catalog.view', 'catalog.manage', 'customers.view', 'campaigns.manage', 'reports.view', 'exports.manage'],
            'VIEWER' => ['orders.view', 'catalog.view', 'customers.view', 'reports.view', 'health.view']
        ];

        $linkStmt = $db->prepare("INSERT IGNORE INTO admin_role_permissions (role_id, permission_id, created_at) VALUES (?, ?, NOW())");
        foreach ($defaultRolePermissions as $roleId => $rolePermissions) {
            foreach ($rolePermissions as $permissionId) {
                $linkStmt->execute([(string)$roleId, (string)$permissionId]);
            }
        }
    } catch (Throwable $e) {
        splaro_log_exception('rbac.seed_defaults', $e, [], 'WARNING');
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

function normalize_logistics_config($raw, $fallback = null) {
    $base = [
        'metro' => 90,
        'regional' => 140
    ];

    if (is_array($fallback)) {
        $fallbackMetro = isset($fallback['metro']) ? (int)$fallback['metro'] : $base['metro'];
        $fallbackRegional = isset($fallback['regional']) ? (int)$fallback['regional'] : $base['regional'];
        if ($fallbackMetro >= 0) $base['metro'] = $fallbackMetro;
        if ($fallbackRegional >= 0) $base['regional'] = $fallbackRegional;
    }

    $input = is_array($raw) ? $raw : [];
    $pick = static function (array $source, array $keys) {
        foreach ($keys as $key) {
            if (!array_key_exists($key, $source)) continue;
            if ($source[$key] === null || $source[$key] === '') continue;
            if (!is_numeric($source[$key])) continue;
            $value = (int)$source[$key];
            if ($value < 0) continue;
            return $value;
        }
        return null;
    };

    $metro = $pick($input, ['metro', 'dhaka', 'metropolitan', 'inside', 'insideDhaka', 'metro_fee', 'metroFee']);
    $regional = $pick($input, ['regional', 'outside', 'outsideDhaka', 'outside_dhaka', 'regional_fee', 'regionalFee']);

    return [
        'metro' => $metro !== null ? $metro : $base['metro'],
        'regional' => $regional !== null ? $regional : $base['regional']
    ];
}

function splaro_public_origin() {
    $origin = trim((string)env_or_default('APP_ORIGIN', ''));
    if ($origin !== '') {
        return rtrim($origin, '/');
    }
    $scheme = (!empty($_SERVER['HTTPS']) && strtolower((string)$_SERVER['HTTPS']) !== 'off') ? 'https' : 'http';
    $host = trim((string)($_SERVER['HTTP_HOST'] ?? ''));
    if ($host === '') {
        return '';
    }
    return $scheme . '://' . $host;
}

function integration_default_settings() {
    $baseOrigin = splaro_public_origin();
    $returnBase = $baseOrigin !== '' ? ($baseOrigin . '/api/index.php?action=sslcommerz_return') : '/api/index.php?action=sslcommerz_return';
    return [
        'sslcommerz' => [
            'enabled' => false,
            'mode' => 'SANDBOX',
            'store_id' => '',
            'store_password' => '',
            'init_url_sandbox' => SSLCOMMERZ_INIT_URL_SANDBOX,
            'init_url_live' => SSLCOMMERZ_INIT_URL_LIVE,
            'validation_url_sandbox' => SSLCOMMERZ_VALIDATION_URL_SANDBOX,
            'validation_url_live' => SSLCOMMERZ_VALIDATION_URL_LIVE,
            'ipn_url' => $baseOrigin !== '' ? ($baseOrigin . '/api/index.php?action=sslcommerz_ipn') : '/api/index.php?action=sslcommerz_ipn',
            'success_url' => $returnBase . '&result=success',
            'fail_url' => $returnBase . '&result=fail',
            'cancel_url' => $returnBase . '&result=cancel',
            'global_counter' => true
        ],
        'steadfast' => [
            'enabled' => false,
            'api_base_url' => 'https://portal.packzy.com/api/v1',
            'api_key' => '',
            'api_secret' => '',
            'api_token' => '',
            'default_pickup_address' => '',
            'default_pickup_phone' => '',
            'default_pickup_name' => 'SPLARO',
            'create_order_path' => '/create_order',
            'track_order_path' => '/status_by_cid',
            'delivery_charge_inside_dhaka' => 90,
            'delivery_charge_outside_dhaka' => 140
        ]
    ];
}

function integration_mask_secret_value($value) {
    $raw = trim((string)$value);
    if ($raw === '') {
        return '';
    }
    $len = strlen($raw);
    if ($len <= 4) {
        return str_repeat('*', $len);
    }
    return substr($raw, 0, 2) . str_repeat('*', max(2, $len - 4)) . substr($raw, -2);
}

function normalize_sslcommerz_settings($raw, $fallback = null) {
    $defaults = integration_default_settings()['sslcommerz'];
    $base = is_array($fallback) ? array_merge($defaults, $fallback) : $defaults;
    $input = is_array($raw) ? $raw : [];
    $boolInput = static function ($value, $default) {
        if (is_bool($value)) return $value;
        if (is_numeric($value)) return ((int)$value) === 1;
        $normalized = strtolower(trim((string)$value));
        if ($normalized === '') return (bool)$default;
        return in_array($normalized, ['1', 'true', 'yes', 'on', 'enabled'], true);
    };

    $mode = strtoupper(trim((string)($input['mode'] ?? $base['mode'] ?? 'SANDBOX')));
    if (!in_array($mode, ['SANDBOX', 'LIVE'], true)) {
        $mode = 'SANDBOX';
    }

    $normalized = [
        'enabled' => $boolInput($input['enabled'] ?? $base['enabled'], $base['enabled']),
        'mode' => $mode,
        'store_id' => trim((string)($input['store_id'] ?? $input['storeId'] ?? $base['store_id'] ?? '')),
        'store_password' => trim((string)($input['store_password'] ?? $input['storePassword'] ?? $base['store_password'] ?? '')),
        'init_url_sandbox' => trim((string)($input['init_url_sandbox'] ?? $base['init_url_sandbox'] ?? SSLCOMMERZ_INIT_URL_SANDBOX)),
        'init_url_live' => trim((string)($input['init_url_live'] ?? $base['init_url_live'] ?? SSLCOMMERZ_INIT_URL_LIVE)),
        'validation_url_sandbox' => trim((string)($input['validation_url_sandbox'] ?? $base['validation_url_sandbox'] ?? SSLCOMMERZ_VALIDATION_URL_SANDBOX)),
        'validation_url_live' => trim((string)($input['validation_url_live'] ?? $base['validation_url_live'] ?? SSLCOMMERZ_VALIDATION_URL_LIVE)),
        'ipn_url' => trim((string)($input['ipn_url'] ?? $input['ipnUrl'] ?? $base['ipn_url'] ?? '')),
        'success_url' => trim((string)($input['success_url'] ?? $input['successUrl'] ?? $base['success_url'] ?? '')),
        'fail_url' => trim((string)($input['fail_url'] ?? $input['failUrl'] ?? $base['fail_url'] ?? '')),
        'cancel_url' => trim((string)($input['cancel_url'] ?? $input['cancelUrl'] ?? $base['cancel_url'] ?? '')),
        'global_counter' => $boolInput($input['global_counter'] ?? $input['globalCounter'] ?? $base['global_counter'], $base['global_counter']),
    ];

    foreach (['store_password'] as $secretKey) {
        $incoming = trim((string)($input[$secretKey] ?? ''));
        if ($incoming === '' || preg_match('/^[*xX•·●]+$/u', $incoming)) {
            $normalized[$secretKey] = trim((string)($base[$secretKey] ?? ''));
        }
    }

    if ($normalized['ipn_url'] === '') {
        $normalized['ipn_url'] = ($base['ipn_url'] ?? '');
    }
    return $normalized;
}

function normalize_steadfast_settings($raw, $fallback = null) {
    $defaults = integration_default_settings()['steadfast'];
    $base = is_array($fallback) ? array_merge($defaults, $fallback) : $defaults;
    $input = is_array($raw) ? $raw : [];
    $boolInput = static function ($value, $default) {
        if (is_bool($value)) return $value;
        if (is_numeric($value)) return ((int)$value) === 1;
        $normalized = strtolower(trim((string)$value));
        if ($normalized === '') return (bool)$default;
        return in_array($normalized, ['1', 'true', 'yes', 'on', 'enabled'], true);
    };
    $numberInput = static function ($value, $default) {
        if (!is_numeric($value)) return (int)$default;
        $v = (int)$value;
        if ($v < 0) return (int)$default;
        return $v;
    };

    $normalized = [
        'enabled' => $boolInput($input['enabled'] ?? $base['enabled'], $base['enabled']),
        'api_base_url' => rtrim(trim((string)($input['api_base_url'] ?? $input['apiBaseUrl'] ?? $base['api_base_url'] ?? 'https://portal.packzy.com/api/v1')), '/'),
        'api_key' => trim((string)($input['api_key'] ?? $input['apiKey'] ?? $base['api_key'] ?? '')),
        'api_secret' => trim((string)($input['api_secret'] ?? $input['apiSecret'] ?? $base['api_secret'] ?? '')),
        'api_token' => trim((string)($input['api_token'] ?? $input['apiToken'] ?? $base['api_token'] ?? '')),
        'default_pickup_address' => trim((string)($input['default_pickup_address'] ?? $input['defaultPickupAddress'] ?? $base['default_pickup_address'] ?? '')),
        'default_pickup_phone' => trim((string)($input['default_pickup_phone'] ?? $input['defaultPickupPhone'] ?? $base['default_pickup_phone'] ?? '')),
        'default_pickup_name' => trim((string)($input['default_pickup_name'] ?? $input['defaultPickupName'] ?? $base['default_pickup_name'] ?? 'SPLARO')),
        'create_order_path' => '/' . ltrim(trim((string)($input['create_order_path'] ?? $input['createOrderPath'] ?? $base['create_order_path'] ?? '/create_order')), '/'),
        'track_order_path' => '/' . ltrim(trim((string)($input['track_order_path'] ?? $input['trackOrderPath'] ?? $base['track_order_path'] ?? '/status_by_cid')), '/'),
        'delivery_charge_inside_dhaka' => $numberInput($input['delivery_charge_inside_dhaka'] ?? $input['deliveryChargeInsideDhaka'] ?? $base['delivery_charge_inside_dhaka'], $base['delivery_charge_inside_dhaka']),
        'delivery_charge_outside_dhaka' => $numberInput($input['delivery_charge_outside_dhaka'] ?? $input['deliveryChargeOutsideDhaka'] ?? $base['delivery_charge_outside_dhaka'], $base['delivery_charge_outside_dhaka']),
    ];

    foreach (['api_key', 'api_secret', 'api_token'] as $secretKey) {
        $incoming = trim((string)($input[$secretKey] ?? ''));
        if ($incoming === '' || preg_match('/^[*xX•·●]+$/u', $incoming)) {
            $normalized[$secretKey] = trim((string)($base[$secretKey] ?? ''));
        }
    }

    return $normalized;
}

function normalize_integration_settings($raw, $fallback = null) {
    $defaults = integration_default_settings();
    $base = is_array($fallback) ? $fallback : [];
    return [
        'sslcommerz' => normalize_sslcommerz_settings(
            is_array($raw) ? ($raw['sslcommerz'] ?? []) : [],
            is_array($base['sslcommerz'] ?? null) ? $base['sslcommerz'] : $defaults['sslcommerz']
        ),
        'steadfast' => normalize_steadfast_settings(
            is_array($raw) ? ($raw['steadfast'] ?? []) : [],
            is_array($base['steadfast'] ?? null) ? $base['steadfast'] : $defaults['steadfast']
        ),
    ];
}

function integration_mask_settings_for_output($settings) {
    $copy = normalize_integration_settings(is_array($settings) ? $settings : []);
    if (isset($copy['sslcommerz']['store_password'])) {
        $copy['sslcommerz']['store_password'] = integration_mask_secret_value($copy['sslcommerz']['store_password']);
    }
    foreach (['api_key', 'api_secret', 'api_token'] as $key) {
        if (isset($copy['steadfast'][$key])) {
            $copy['steadfast'][$key] = integration_mask_secret_value($copy['steadfast'][$key]);
        }
    }
    return $copy;
}

function load_integration_settings($db, $siteSettingsRow = null) {
    $row = $siteSettingsRow;
    if (!is_array($row)) {
        $settingsSelectFields = site_settings_select_fields($db);
        $row = $db->query("SELECT {$settingsSelectFields} FROM site_settings WHERE id = 1 LIMIT 1")->fetch();
    }
    $settingsJson = safe_json_decode_assoc($row['settings_json'] ?? '{}', []);
    $raw = $settingsJson['integrationSettings']
        ?? $settingsJson['integration_settings']
        ?? [
            'sslcommerz' => $settingsJson['sslcommerz'] ?? [],
            'steadfast' => $settingsJson['steadfast'] ?? []
        ];
    return normalize_integration_settings($raw);
}

function integration_log_event($db, $service, $eventType, $status = 'INFO', $referenceType = '', $referenceId = '', $httpCode = null, $errorMessage = '', $responsePreview = '', $meta = []) {
    if (!($db instanceof PDO)) {
        return;
    }
    try {
        $metaJson = json_encode(is_array($meta) ? $meta : ['value' => $meta]);
        $stmt = $db->prepare("INSERT INTO integration_logs (service, event_type, status, reference_type, reference_id, http_code, error_message, response_preview, meta_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())");
        $stmt->execute([
            strtoupper(trim((string)$service)),
            trim((string)$eventType),
            strtoupper(trim((string)$status)) !== '' ? strtoupper(trim((string)$status)) : 'INFO',
            trim((string)$referenceType) !== '' ? trim((string)$referenceType) : null,
            trim((string)$referenceId) !== '' ? trim((string)$referenceId) : null,
            $httpCode !== null ? (int)$httpCode : null,
            trim((string)$errorMessage) !== '' ? splaro_redact_sensitive_text((string)$errorMessage) : null,
            trim((string)$responsePreview) !== '' ? splaro_clip_text((string)$responsePreview, 300) : null,
            is_string($metaJson) ? $metaJson : null
        ]);
    } catch (Throwable $e) {
        splaro_log_exception('integration.log_event', $e, [
            'service' => (string)$service,
            'event_type' => (string)$eventType
        ], 'WARNING');
    }
}

function integration_fetch_latest_log($db, $service, $eventType = '') {
    if (!($db instanceof PDO)) {
        return null;
    }
    try {
        if ($eventType !== '') {
            $stmt = $db->prepare("SELECT id, service, event_type, status, reference_type, reference_id, http_code, error_message, response_preview, meta_json, created_at FROM integration_logs WHERE service = ? AND event_type = ? ORDER BY id DESC LIMIT 1");
            $stmt->execute([strtoupper(trim((string)$service)), trim((string)$eventType)]);
            return $stmt->fetch() ?: null;
        }
        $stmt = $db->prepare("SELECT id, service, event_type, status, reference_type, reference_id, http_code, error_message, response_preview, meta_json, created_at FROM integration_logs WHERE service = ? ORDER BY id DESC LIMIT 1");
        $stmt->execute([strtoupper(trim((string)$service))]);
        return $stmt->fetch() ?: null;
    } catch (Throwable $e) {
        splaro_log_exception('integration.fetch_latest_log', $e, [
            'service' => (string)$service,
            'event_type' => (string)$eventType
        ], 'WARNING');
        return null;
    }
}

function integration_http_request($url, $method = 'POST', $payload = [], $headers = [], $timeoutSeconds = 10, $asForm = false) {
    $timeout = (int)$timeoutSeconds;
    if ($timeout < 2) $timeout = 2;
    if ($timeout > 30) $timeout = 30;

    $requestMethod = strtoupper(trim((string)$method));
    if (!in_array($requestMethod, ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], true)) {
        $requestMethod = 'POST';
    }

    $requestHeaders = is_array($headers) ? $headers : [];
    $body = '';
    if ($requestMethod !== 'GET') {
        if ($asForm) {
            $body = http_build_query(is_array($payload) ? $payload : [], '', '&');
            $requestHeaders[] = 'Content-Type: application/x-www-form-urlencoded';
        } else {
            $body = json_encode(is_array($payload) ? $payload : ['value' => $payload]);
            if (!is_string($body)) {
                return [false, 0, 'PAYLOAD_ENCODE_FAILED', '', []];
            }
            $requestHeaders[] = 'Content-Type: application/json';
        }
    } elseif (is_array($payload) && !empty($payload)) {
        $query = http_build_query($payload, '', '&');
        if ($query !== '') {
            $url .= (strpos($url, '?') === false ? '?' : '&') . $query;
        }
    }

    $response = '';
    $httpCode = 0;
    $error = '';
    $responseHeaders = [];
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        $connectTimeout = max(1, min($timeout - 1, 8));
        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST => $requestMethod,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => $connectTimeout,
            CURLOPT_TIMEOUT => $timeout,
            CURLOPT_NOSIGNAL => 1,
            CURLOPT_HTTPHEADER => $requestHeaders,
            CURLOPT_HEADER => true,
            CURLOPT_TCP_KEEPALIVE => 1,
        ]);
        if ($requestMethod !== 'GET') {
            curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
        }

        $rawResponse = curl_exec($ch);
        $errno = curl_errno($ch);
        $error = (string)curl_error($ch);
        $httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $headerSize = (int)curl_getinfo($ch, CURLINFO_HEADER_SIZE);
        if (is_string($rawResponse)) {
            $headerText = substr($rawResponse, 0, $headerSize);
            $response = substr($rawResponse, $headerSize);
            $responseHeaders = preg_split("/\r\n|\n|\r/", (string)$headerText) ?: [];
        }
        curl_close($ch);

        if ($errno !== 0) {
            return [false, $httpCode, $error !== '' ? $error : 'CURL_ERROR_' . $errno, $response, $responseHeaders];
        }
        $ok = $httpCode >= 200 && $httpCode < 300;
        return [$ok, $httpCode, $ok ? '' : ('HTTP_' . $httpCode), (string)$response, $responseHeaders];
    }

    $streamContext = stream_context_create([
        'http' => [
            'method' => $requestMethod,
            'header' => implode("\r\n", $requestHeaders) . "\r\n",
            'content' => $requestMethod !== 'GET' ? $body : '',
            'timeout' => $timeout,
            'ignore_errors' => true
        ]
    ]);
    $streamResponse = @file_get_contents($url, false, $streamContext);
    $responseHeaders = function_exists('http_get_last_response_headers')
        ? (http_get_last_response_headers() ?: [])
        : ($GLOBALS['http_response_header'] ?? []);
    if (is_array($responseHeaders)) {
        foreach ($responseHeaders as $line) {
            if (preg_match('#^HTTP/\S+\s+(\d{3})#', (string)$line, $m)) {
                $httpCode = (int)$m[1];
                break;
            }
        }
    }
    if ($streamResponse === false) {
        return [false, $httpCode, 'NETWORK_OR_TIMEOUT', '', $responseHeaders];
    }
    $ok = $httpCode >= 200 && $httpCode < 300;
    return [$ok, $httpCode, $ok ? '' : ('HTTP_' . $httpCode), (string)$streamResponse, $responseHeaders];
}

function sslcommerz_is_enabled($config) {
    if (!is_array($config)) return false;
    if (empty($config['enabled'])) return false;
    return trim((string)($config['store_id'] ?? '')) !== '' && trim((string)($config['store_password'] ?? '')) !== '';
}

function sslcommerz_mode($config) {
    $mode = strtoupper(trim((string)($config['mode'] ?? 'SANDBOX')));
    return $mode === 'LIVE' ? 'LIVE' : 'SANDBOX';
}

function sslcommerz_init_url($config) {
    $mode = sslcommerz_mode($config);
    if ($mode === 'LIVE') {
        return trim((string)($config['init_url_live'] ?? SSLCOMMERZ_INIT_URL_LIVE));
    }
    return trim((string)($config['init_url_sandbox'] ?? SSLCOMMERZ_INIT_URL_SANDBOX));
}

function sslcommerz_validation_url($config) {
    $mode = sslcommerz_mode($config);
    if ($mode === 'LIVE') {
        return trim((string)($config['validation_url_live'] ?? SSLCOMMERZ_VALIDATION_URL_LIVE));
    }
    return trim((string)($config['validation_url_sandbox'] ?? SSLCOMMERZ_VALIDATION_URL_SANDBOX));
}

function sslcommerz_payment_status_from_gateway($statusRaw) {
    $status = strtoupper(trim((string)$statusRaw));
    if (in_array($status, ['VALID', 'VALIDATED', 'SUCCESS', 'PAID'], true)) {
        return 'PAID';
    }
    if (in_array($status, ['FAILED', 'FAIL', 'DECLINED', 'ERROR'], true)) {
        return 'FAILED';
    }
    if (in_array($status, ['CANCELLED', 'CANCELED'], true)) {
        return 'CANCELED';
    }
    if (in_array($status, ['REFUNDED'], true)) {
        return 'REFUNDED';
    }
    return 'PENDING';
}

function steadfast_is_enabled($config) {
    if (!is_array($config)) return false;
    if (empty($config['enabled'])) return false;
    $hasToken = trim((string)($config['api_token'] ?? '')) !== '';
    $hasKeySecret = trim((string)($config['api_key'] ?? '')) !== '' && trim((string)($config['api_secret'] ?? '')) !== '';
    return $hasToken || $hasKeySecret;
}

function steadfast_build_headers($config) {
    $headers = ['Accept: application/json'];
    $token = trim((string)($config['api_token'] ?? ''));
    if ($token !== '') {
        $headers[] = 'Authorization: Bearer ' . $token;
    }
    $apiKey = trim((string)($config['api_key'] ?? ''));
    $apiSecret = trim((string)($config['api_secret'] ?? ''));
    if ($apiKey !== '') {
        $headers[] = 'Api-Key: ' . $apiKey;
        $headers[] = 'X-API-KEY: ' . $apiKey;
    }
    if ($apiSecret !== '') {
        $headers[] = 'Secret-Key: ' . $apiSecret;
        $headers[] = 'X-API-SECRET: ' . $apiSecret;
    }
    return $headers;
}

function payment_event_idempotency_key($provider, $eventType, $transactionRef, $valId, $status, $amount) {
    $parts = [
        strtoupper(trim((string)$provider)),
        strtoupper(trim((string)$eventType)),
        trim((string)$transactionRef),
        trim((string)$valId),
        strtoupper(trim((string)$status)),
        trim((string)$amount),
    ];
    return substr(hash('sha256', implode('|', $parts)), 0, 64);
}

function record_payment_event($db, $payload = []) {
    $eventKey = trim((string)($payload['event_key'] ?? ''));
    if ($eventKey === '') {
        return ['inserted' => false, 'duplicate' => false, 'id' => 0];
    }
    try {
        $exists = $db->prepare("SELECT id FROM payment_events WHERE event_key = ? LIMIT 1");
        $exists->execute([$eventKey]);
        $row = $exists->fetch();
        if ($row) {
            return ['inserted' => false, 'duplicate' => true, 'id' => (int)($row['id'] ?? 0)];
        }

        $stmt = $db->prepare("INSERT INTO payment_events (order_id, provider, event_type, event_key, transaction_ref, val_id, amount, currency, status, request_payload_json, response_payload_json, http_code, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())");
        $stmt->execute([
            trim((string)($payload['order_id'] ?? '')),
            trim((string)($payload['provider'] ?? 'SSLCommerz')),
            trim((string)($payload['event_type'] ?? 'IPN')),
            $eventKey,
            trim((string)($payload['transaction_ref'] ?? '')) !== '' ? trim((string)$payload['transaction_ref']) : null,
            trim((string)($payload['val_id'] ?? '')) !== '' ? trim((string)$payload['val_id']) : null,
            isset($payload['amount']) && is_numeric($payload['amount']) ? (float)$payload['amount'] : null,
            trim((string)($payload['currency'] ?? 'BDT')),
            trim((string)($payload['status'] ?? 'PENDING')),
            is_string($payload['request_payload_json'] ?? null) ? $payload['request_payload_json'] : json_encode($payload['request_payload'] ?? []),
            is_string($payload['response_payload_json'] ?? null) ? $payload['response_payload_json'] : json_encode($payload['response_payload'] ?? []),
            isset($payload['http_code']) ? (int)$payload['http_code'] : null,
        ]);
        return ['inserted' => true, 'duplicate' => false, 'id' => (int)$db->lastInsertId()];
    } catch (Throwable $e) {
        splaro_log_exception('payment.event.record', $e, ['provider' => (string)($payload['provider'] ?? '')], 'WARNING');
        return ['inserted' => false, 'duplicate' => false, 'id' => 0];
    }
}

function find_order_for_payment_reference($db, $transactionRef = '', $orderId = '') {
    $transaction = trim((string)$transactionRef);
    $oid = trim((string)$orderId);
    if ($transaction !== '') {
        $stmt = $db->prepare("SELECT id, order_no, status, payment_status, customer_email, customer_name, phone, total FROM orders WHERE order_no = ? OR id = ? LIMIT 1");
        $stmt->execute([$transaction, $transaction]);
        $row = $stmt->fetch();
        if ($row) return $row;
    }
    if ($oid !== '') {
        $stmt = $db->prepare("SELECT id, order_no, status, payment_status, customer_email, customer_name, phone, total FROM orders WHERE id = ? OR order_no = ? LIMIT 1");
        $stmt->execute([$oid, $oid]);
        $row = $stmt->fetch();
        if ($row) return $row;
    }
    return null;
}

function integration_decode_json_or_query($raw) {
    $text = trim((string)$raw);
    if ($text === '') {
        return [];
    }
    $decoded = json_decode($text, true);
    if (is_array($decoded)) {
        return $decoded;
    }
    $queryDecoded = [];
    parse_str($text, $queryDecoded);
    return is_array($queryDecoded) ? $queryDecoded : [];
}

function integration_extract_first_value($source, $paths = []) {
    if (!is_array($source)) {
        return null;
    }
    foreach ($paths as $path) {
        $segments = explode('.', (string)$path);
        $cursor = $source;
        $found = true;
        foreach ($segments as $segment) {
            if (!is_array($cursor) || !array_key_exists($segment, $cursor)) {
                $found = false;
                break;
            }
            $cursor = $cursor[$segment];
        }
        if ($found) {
            return $cursor;
        }
    }
    return null;
}

function sslcommerz_extract_gateway_url($payload) {
    $url = integration_extract_first_value($payload, [
        'GatewayPageURL',
        'gatewayPageURL',
        'gateway_page_url',
        'data.GatewayPageURL',
        'data.gatewayPageURL',
        'data.gateway_page_url'
    ]);
    return trim((string)$url);
}

function sslcommerz_resolve_validation_status($ipnPayload, $validationPayload) {
    $validationStatus = strtoupper(trim((string)integration_extract_first_value($validationPayload, [
        'status',
        'APIConnect',
        'APIConnectStatus',
        'element.0.status',
        'data.status'
    ])));
    $ipnStatus = strtoupper(trim((string)integration_extract_first_value($ipnPayload, [
        'status',
        'payment_status',
        'pay_status'
    ])));

    if ($validationStatus !== '') {
        if (in_array($validationStatus, ['VALID', 'VALIDATED', 'SUCCESS', 'PAID', 'PROCESSING'], true)) {
            return 'PAID';
        }
        if (in_array($validationStatus, ['FAILED', 'FAIL', 'CANCELLED', 'CANCELED', 'REFUNDED', 'INVALID_TRANSACTION', 'INVALID'], true)) {
            return sslcommerz_payment_status_from_gateway($validationStatus);
        }
    }
    if ($ipnStatus !== '') {
        return sslcommerz_payment_status_from_gateway($ipnStatus);
    }
    return 'PENDING';
}

function sslcommerz_upsert_payment_row($db, $orderId, $transactionRef, $status, $amount, $currency, $payload, $validationRef = null, $idempotencyKey = null) {
    $orderId = trim((string)$orderId);
    $transactionRef = trim((string)$transactionRef);
    if ($orderId === '') {
        return;
    }

    $payloadJson = json_encode($payload);
    if (!is_string($payloadJson)) {
        $payloadJson = '{}';
    }
    $currencyCode = strtoupper(trim((string)$currency));
    if ($currencyCode === '') {
        $currencyCode = 'BDT';
    }
    $normalizedStatus = strtoupper(trim((string)$status));
    if ($normalizedStatus === '') {
        $normalizedStatus = 'PENDING';
    }

    $existing = null;
    if ($transactionRef !== '') {
        $findStmt = $db->prepare("SELECT id FROM payments WHERE transaction_ref = ? LIMIT 1");
        $findStmt->execute([$transactionRef]);
        $existing = $findStmt->fetch();
    }
    if (!$existing) {
        $findByOrderStmt = $db->prepare("SELECT id FROM payments WHERE order_id = ? ORDER BY id DESC LIMIT 1");
        $findByOrderStmt->execute([$orderId]);
        $existing = $findByOrderStmt->fetch();
    }

    if ($existing) {
        $updateStmt = $db->prepare("UPDATE payments SET payment_method = 'SSLCommerz', provider = 'SSLCommerz', transaction_ref = ?, amount = ?, currency = ?, status = ?, payload_json = ?, validation_ref = ?, validated_at = NOW(), idempotency_key = ?, updated_at = NOW() WHERE id = ?");
        $updateStmt->execute([
            $transactionRef !== '' ? $transactionRef : null,
            (float)$amount,
            $currencyCode,
            $normalizedStatus,
            $payloadJson,
            $validationRef !== null && trim((string)$validationRef) !== '' ? trim((string)$validationRef) : null,
            $idempotencyKey !== null && trim((string)$idempotencyKey) !== '' ? trim((string)$idempotencyKey) : null,
            (int)$existing['id']
        ]);
        return;
    }

    $insertStmt = $db->prepare("INSERT INTO payments (order_id, payment_method, provider, transaction_ref, amount, currency, status, payload_json, validation_ref, validated_at, idempotency_key, created_at, updated_at) VALUES (?, 'SSLCommerz', 'SSLCommerz', ?, ?, ?, ?, ?, ?, NOW(), ?, NOW(), NOW())");
    $insertStmt->execute([
        $orderId,
        $transactionRef !== '' ? $transactionRef : null,
        (float)$amount,
        $currencyCode,
        $normalizedStatus,
        $payloadJson,
        $validationRef !== null && trim((string)$validationRef) !== '' ? trim((string)$validationRef) : null,
        $idempotencyKey !== null && trim((string)$idempotencyKey) !== '' ? trim((string)$idempotencyKey) : null
    ]);
}

function steadfast_extract_consignment_id($payload) {
    $value = integration_extract_first_value($payload, [
        'consignment_id',
        'consignmentId',
        'tracking_code',
        'tracking_number',
        'data.consignment_id',
        'data.consignmentId',
        'data.tracking_code',
        'data.tracking_number',
        'courier.consignment_id'
    ]);
    return trim((string)$value);
}

function steadfast_extract_tracking_url($payload) {
    $value = integration_extract_first_value($payload, [
        'tracking_url',
        'trackingUrl',
        'data.tracking_url',
        'data.trackingUrl'
    ]);
    return trim((string)$value);
}

function steadfast_extract_status($payload) {
    $value = integration_extract_first_value($payload, [
        'status',
        'delivery_status',
        'data.status',
        'data.delivery_status',
        'courier.status'
    ]);
    return trim((string)$value);
}

function steadfast_map_order_status($rawStatus, $fallback = 'Processing') {
    $status = strtoupper(trim((string)$rawStatus));
    if ($status === '') {
        return admin_normalize_order_status($fallback);
    }
    if (preg_match('/DELIVERED|COMPLETED|RECEIVED/', $status)) {
        return 'Delivered';
    }
    if (preg_match('/CANCEL|FAILED|RETURN|REJECT|HOLD/', $status)) {
        return 'Cancelled';
    }
    if (preg_match('/SHIP|TRANSIT|DISPATCH|PICK/', $status)) {
        return 'Shipped';
    }
    if (preg_match('/PENDING|WAIT|CREATE|BOOK|PROCESS/', $status)) {
        return 'Processing';
    }
    return admin_normalize_order_status($fallback);
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
    if ($role === 'OWNER') return 'OWNER';
    if ($role === 'STAFF') return 'STAFF';
    if ($role === 'ADMIN') return 'ADMIN';
    if ($role === 'SUPER_ADMIN') return 'SUPER_ADMIN';
    if ($role === 'EDITOR') return 'EDITOR';
    if ($role === 'VIEWER') return 'VIEWER';
    return $role;
}

function admin_role_bucket($role) {
    $normalized = strtoupper(trim((string)$role));
    if ($normalized === 'OWNER') return 'OWNER';
    if (in_array($normalized, ['ADMIN', 'SUPER_ADMIN', 'EDITOR', 'STAFF'], true)) return 'STAFF';
    if ($normalized === 'VIEWER') return 'VIEWER';
    return 'USER';
}

function can_edit_cms_role($role) {
    $bucket = admin_role_bucket($role);
    return in_array($bucket, ['OWNER', 'STAFF'], true);
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

function generate_order_reference($db) {
    $attempt = 0;
    while ($attempt < 8) {
        $attempt++;
        try {
            $suffix = strtoupper(substr(bin2hex(random_bytes(4)), 0, 8));
        } catch (Exception $e) {
            splaro_log_exception('order.reference.random_bytes', $e, ['attempt' => $attempt], 'WARNING');
            $suffix = strtoupper(substr(sha1(uniqid((string)$attempt, true)), 0, 8));
        }
        $candidate = 'ORD-' . gmdate('Ymd') . '-' . $suffix;
        try {
            $stmt = $db->prepare("SELECT id FROM orders WHERE order_no = ? LIMIT 1");
            $stmt->execute([$candidate]);
            if (!$stmt->fetch()) {
                return $candidate;
            }
        } catch (Exception $e) {
            splaro_log_exception('order.reference.lookup', $e, ['candidate' => $candidate], 'WARNING');
            return $candidate;
        }
    }

    return 'ORD-' . gmdate('YmdHis') . '-' . strtoupper(substr(sha1(uniqid('', true)), 0, 6));
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
    if (is_array($authUser) && in_array(strtoupper((string)($authUser['role'] ?? '')), ['OWNER', 'STAFF', 'ADMIN', 'SUPER_ADMIN', 'EDITOR', 'VIEWER'], true)) {
        return true;
    }

    $adminKeyHeader = trim((string)get_header_value('X-Admin-Key'));
    if ($adminKeyHeader !== '') {
        if (ADMIN_KEY !== '' && hash_equals(ADMIN_KEY, $adminKeyHeader)) {
            return true;
        }
        if (authenticate_admin_api_key($adminKeyHeader)) {
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
    if (ADMIN_IP_ALLOWLIST_ENFORCED) {
        $requestIp = get_request_ip();
        $db = $GLOBALS['SPLARO_DB_CONNECTION'] ?? null;
        if ($requestIp === 'UNKNOWN' || !admin_ip_allowlist_is_allowed($db, $requestIp)) {
            splaro_record_system_error('ADMIN_SECURITY', 'ERROR', 'Admin access denied by IP allowlist.', [
                'ip' => $requestIp,
                'action' => (string)($_GET['action'] ?? '')
            ]);
            http_response_code(403);
            echo json_encode(["status" => "error", "message" => "ADMIN_IP_NOT_ALLOWED"]);
            exit;
        }
    }
}

function admin_parse_pagination_params($defaultLimit = 20, $maxLimit = 100) {
    $limit = (int)($_GET['limit'] ?? $defaultLimit);
    if ($limit < 1) $limit = $defaultLimit;
    if ($limit > $maxLimit) $limit = $maxLimit;
    $page = (int)($_GET['page'] ?? 1);
    if ($page < 1) $page = 1;
    $offset = ($page - 1) * $limit;
    $cursorRaw = trim((string)($_GET['cursor'] ?? ''));
    return [
        'limit' => $limit,
        'page' => $page,
        'offset' => $offset,
        'cursor' => admin_decode_cursor($cursorRaw)
    ];
}

function admin_decode_cursor($cursorRaw) {
    if ($cursorRaw === '') {
        return null;
    }
    $normalized = strtr($cursorRaw, '-_', '+/');
    $padding = strlen($normalized) % 4;
    if ($padding > 0) {
        $normalized .= str_repeat('=', 4 - $padding);
    }
    $decoded = base64_decode($normalized, true);
    if ($decoded === false) {
        return null;
    }
    $payload = json_decode($decoded, true);
    if (!is_array($payload)) {
        return null;
    }
    $createdAt = trim((string)($payload['created_at'] ?? ''));
    $id = trim((string)($payload['id'] ?? ''));
    if ($createdAt === '' || $id === '') {
        return null;
    }
    return ['created_at' => $createdAt, 'id' => $id];
}

function admin_encode_cursor($createdAt, $id) {
    $payload = json_encode([
        'created_at' => (string)$createdAt,
        'id' => (string)$id
    ]);
    if (!is_string($payload) || $payload === '') {
        return null;
    }
    return rtrim(strtr(base64_encode($payload), '+/', '-_'), '=');
}

function admin_user_select_fields($db) {
    return build_select_fields($db, 'users', [
        'id', 'name', 'email', 'phone', 'address', 'profile_image', 'role',
        'is_blocked', 'email_verified', 'phone_verified',
        'default_shipping_address', 'notification_email', 'notification_sms',
        'preferred_language', 'two_factor_enabled', 'last_password_change_at',
        'force_relogin', 'created_at'
    ]);
}

function admin_order_select_fields($db) {
    return build_select_fields($db, 'orders', [
        'id', 'order_no', 'user_id', 'customer_name', 'customer_email', 'phone',
        'district', 'thana', 'address', 'items', 'total', 'status',
        'payment_method', 'payment_status', 'paid_at',
        'tracking_number', 'admin_notes', 'customer_comment', 'shipping_fee',
        'discount_amount', 'discount_code', 'created_at', 'updated_at', 'deleted_at'
    ]);
}

function admin_shipment_select_fields($db) {
    return build_select_fields($db, 'shipments', [
        'id', 'order_id', 'carrier', 'provider', 'tracking_number', 'consignment_id',
        'status', 'external_status', 'tracking_url',
        'payload_json', 'booking_payload_json', 'timeline_json',
        'last_synced_at', 'last_error',
        'shipped_at', 'delivered_at', 'created_at', 'updated_at'
    ]);
}

function admin_fetch_user_or_fail($db, $userId) {
    $userId = trim((string)$userId);
    if ($userId === '') {
        http_response_code(400);
        echo json_encode(["status" => "error", "message" => "USER_ID_REQUIRED"]);
        exit;
    }
    $fields = admin_user_select_fields($db);
    $stmt = $db->prepare("SELECT {$fields} FROM users WHERE id = ? LIMIT 1");
    $stmt->execute([$userId]);
    $userRow = $stmt->fetch();
    if (!$userRow) {
        http_response_code(404);
        echo json_encode(["status" => "error", "message" => "USER_NOT_FOUND"]);
        exit;
    }
    return $userRow;
}

function admin_normalize_user($row) {
    return [
        'id' => (string)($row['id'] ?? ''),
        'name' => (string)($row['name'] ?? ''),
        'email' => (string)($row['email'] ?? ''),
        'phone' => (string)($row['phone'] ?? ''),
        'address' => (string)($row['address'] ?? ''),
        'profileImage' => (string)($row['profile_image'] ?? ''),
        'role' => strtoupper((string)($row['role'] ?? 'USER')),
        'isBlocked' => (int)($row['is_blocked'] ?? 0) === 1,
        'emailVerified' => (int)($row['email_verified'] ?? 0) === 1,
        'phoneVerified' => (int)($row['phone_verified'] ?? 0) === 1,
        'defaultShippingAddress' => (string)($row['default_shipping_address'] ?? ''),
        'notificationEmail' => (int)($row['notification_email'] ?? 1) === 1,
        'notificationSms' => (int)($row['notification_sms'] ?? 0) === 1,
        'preferredLanguage' => (string)($row['preferred_language'] ?? 'EN'),
        'twoFactorEnabled' => (int)($row['two_factor_enabled'] ?? 0) === 1,
        'lastPasswordChangeAt' => $row['last_password_change_at'] ?? null,
        'forceRelogin' => (int)($row['force_relogin'] ?? 0) === 1,
        'createdAt' => (string)($row['created_at'] ?? '')
    ];
}

function admin_normalize_order_status($status) {
    $normalized = strtoupper(trim((string)$status));
    $map = [
        'PENDING' => 'Pending',
        'CONFIRMED' => 'Processing',
        'PROCESSING' => 'Processing',
        'SHIPPED' => 'Shipped',
        'DELIVERED' => 'Delivered',
        'CANCELLED' => 'Cancelled',
        'CANCELED' => 'Cancelled',
    ];
    return $map[$normalized] ?? (trim((string)$status) !== '' ? trim((string)$status) : 'Pending');
}

function admin_order_status_db_value($status) {
    $label = admin_normalize_order_status($status);
    $map = [
        'Pending' => 'PENDING',
        'Processing' => 'PROCESSING',
        'Shipped' => 'SHIPPED',
        'Delivered' => 'DELIVERED',
        'Cancelled' => 'CANCELLED',
    ];
    return $map[$label] ?? strtoupper(trim((string)$status));
}

function admin_user_order_scope_sql($db, $alias = 'o') {
    $safeAlias = preg_replace('/[^a-zA-Z0-9_]/', '', (string)$alias);
    if ($safeAlias === '') $safeAlias = 'o';
    $sql = "({$safeAlias}.user_id = ? OR LOWER({$safeAlias}.customer_email) = ?)";
    if (column_exists($db, 'orders', 'deleted_at')) {
        $sql .= " AND {$safeAlias}.deleted_at IS NULL";
    }
    return $sql;
}

function admin_normalize_order_row($row) {
    $items = invoice_parse_items($row['items'] ?? []);
    $total = (float)($row['total'] ?? 0);
    $shipping = (float)($row['shipping_fee'] ?? 0);
    $discount = (float)($row['discount_amount'] ?? 0);
    return [
        'id' => (string)($row['id'] ?? ''),
        'orderNo' => (string)($row['order_no'] ?? ($row['id'] ?? '')),
        'userId' => (string)($row['user_id'] ?? ''),
        'customerName' => (string)($row['customer_name'] ?? ''),
        'customerEmail' => (string)($row['customer_email'] ?? ''),
        'phone' => (string)($row['phone'] ?? ''),
        'district' => (string)($row['district'] ?? ''),
        'thana' => (string)($row['thana'] ?? ''),
        'address' => (string)($row['address'] ?? ''),
        'status' => admin_normalize_order_status($row['status'] ?? 'Pending'),
        'paymentMethod' => (string)($row['payment_method'] ?? ''),
        'paymentStatus' => strtoupper(trim((string)($row['payment_status'] ?? 'PENDING'))),
        'paidAt' => $row['paid_at'] ?? null,
        'trackingNumber' => (string)($row['tracking_number'] ?? ''),
        'adminNotes' => (string)($row['admin_notes'] ?? ''),
        'customerComment' => (string)($row['customer_comment'] ?? ''),
        'shippingFee' => $shipping,
        'discountAmount' => $discount,
        'discountCode' => (string)($row['discount_code'] ?? ''),
        'total' => $total,
        'itemCount' => count($items),
        'items' => $items,
        'createdAt' => (string)($row['created_at'] ?? ''),
        'updatedAt' => (string)($row['updated_at'] ?? ($row['created_at'] ?? ''))
    ];
}

function admin_write_order_status_history($db, $orderId, $fromStatus, $toStatus, $note, $requestAuthUser) {
    try {
        $stmt = $db->prepare("INSERT INTO order_status_history (order_id, from_status, to_status, note, changed_by, changed_by_role, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([
            (string)$orderId,
            $fromStatus !== null ? (string)$fromStatus : null,
            (string)$toStatus,
            $note !== null ? (string)$note : null,
            (string)($requestAuthUser['id'] ?? $requestAuthUser['email'] ?? 'system'),
            strtoupper((string)($requestAuthUser['role'] ?? 'SYSTEM')),
            $_SERVER['REMOTE_ADDR'] ?? 'UNKNOWN'
        ]);
    } catch (Exception $e) {
        splaro_log_exception('orders.status_history.write', $e, [
            'order_id' => (string)$orderId,
            'to_status' => (string)$toStatus
        ], 'WARNING');
    }
}

function admin_build_user_stats_payload($db, $userRow) {
    $userId = (string)($userRow['id'] ?? '');
    $email = strtolower(trim((string)($userRow['email'] ?? '')));
    $orderScope = admin_user_order_scope_sql($db, 'o');

    $ordersCountStmt = $db->prepare("SELECT COUNT(*) FROM orders o WHERE {$orderScope}");
    $ordersCountStmt->execute([$userId, $email]);
    $totalOrders = (int)$ordersCountStmt->fetchColumn();

    $spentStmt = $db->prepare("SELECT COALESCE(SUM(o.total), 0) FROM orders o WHERE {$orderScope}");
    $spentStmt->execute([$userId, $email]);
    $lifetimeValue = (float)$spentStmt->fetchColumn();

    $lastOrderStmt = $db->prepare("SELECT o.id, o.created_at, o.status FROM orders o WHERE {$orderScope} ORDER BY o.created_at DESC LIMIT 1");
    $lastOrderStmt->execute([$userId, $email]);
    $lastOrder = $lastOrderStmt->fetch();

    $refundCountStmt = $db->prepare("SELECT COUNT(*) FROM refunds r INNER JOIN orders o ON o.id = r.order_id WHERE {$orderScope}");
    $refundCountStmt->execute([$userId, $email]);
    $refundCount = (int)$refundCountStmt->fetchColumn();

    $refundAmountStmt = $db->prepare("SELECT COALESCE(SUM(r.amount), 0) FROM refunds r INNER JOIN orders o ON o.id = r.order_id WHERE {$orderScope}");
    $refundAmountStmt->execute([$userId, $email]);
    $refundAmount = (float)$refundAmountStmt->fetchColumn();

    $cancellationCountStmt = $db->prepare("SELECT COUNT(*) FROM cancellations c INNER JOIN orders o ON o.id = c.order_id WHERE {$orderScope}");
    $cancellationCountStmt->execute([$userId, $email]);
    $cancellationCount = (int)$cancellationCountStmt->fetchColumn();

    $paymentCountStmt = $db->prepare("SELECT COUNT(*) FROM payments p INNER JOIN orders o ON o.id = p.order_id WHERE {$orderScope}");
    $paymentCountStmt->execute([$userId, $email]);
    $paymentCount = (int)$paymentCountStmt->fetchColumn();

    $deliveredCountStmt = $db->prepare("SELECT COUNT(*) FROM shipments s INNER JOIN orders o ON o.id = s.order_id WHERE {$orderScope} AND UPPER(COALESCE(s.status, '')) = 'DELIVERED'");
    $deliveredCountStmt->execute([$userId, $email]);
    $deliveredCount = (int)$deliveredCountStmt->fetchColumn();

    return [
        'totalOrders' => $totalOrders,
        'lifetimeValue' => $lifetimeValue,
        'totalRefunds' => $refundCount,
        'refundAmount' => $refundAmount,
        'totalCancellations' => $cancellationCount,
        'totalPayments' => $paymentCount,
        'deliveredShipments' => $deliveredCount,
        'lastOrderId' => (string)($lastOrder['id'] ?? ''),
        'lastOrderDate' => $lastOrder['created_at'] ?? null,
        'lastOrderStatus' => admin_normalize_order_status($lastOrder['status'] ?? '')
    ];
}

function sanitize_user_payload($user) {
    $normalizedEmail = strtolower(trim((string)($user['email'] ?? '')));
    $rawRole = strtoupper(trim((string)($user['role'] ?? 'USER')));
    if ($rawRole === '') {
        $rawRole = 'USER';
    }
    $effectiveRole = is_owner_identity_email($normalizedEmail) ? 'OWNER' : $rawRole;

    return [
        'id' => $user['id'] ?? '',
        'name' => $user['name'] ?? '',
        'email' => $user['email'] ?? '',
        'phone' => $user['phone'] ?? '',
        'address' => $user['address'] ?? '',
        'profile_image' => $user['profile_image'] ?? '',
        'role' => $effectiveRole,
        'email_verified' => isset($user['email_verified']) ? ((int)$user['email_verified'] === 1) : false,
        'phone_verified' => isset($user['phone_verified']) ? ((int)$user['phone_verified'] === 1) : false,
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

function owner_login_email($db = null) {
    $emails = resolve_admin_login_emails($db);
    $ownerEmail = strtolower(trim((string)($emails[0] ?? 'admin@splaro.co')));
    if (!filter_var($ownerEmail, FILTER_VALIDATE_EMAIL)) {
        $ownerEmail = 'admin@splaro.co';
    }
    return $ownerEmail;
}

function is_owner_identity_email($email, $db = null) {
    $normalized = strtolower(trim((string)$email));
    if ($normalized === '') {
        return false;
    }
    if (hash_equals('admin@splaro.co', $normalized)) {
        return true;
    }
    return hash_equals(owner_login_email($db), $normalized);
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
    $primaryEmail = owner_login_email($db);
    $adminHash = null; // Only compute if we actually need to insert/update
    $hasEmailVerified = column_exists($db, 'users', 'email_verified');

    foreach ($emails as $email) {
        $roleToApply = is_owner_identity_email($email, $db) ? 'OWNER' : 'ADMIN';
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
                    if ($hasEmailVerified) {
                        $update = $db->prepare("UPDATE users SET role = ?, password = ?, email_verified = CASE WHEN ? = 'OWNER' THEN 1 ELSE email_verified END WHERE id = ?");
                        $update->execute([$roleToApply, $adminHash, $roleToApply, $existing['id']]);
                    } else {
                        $update = $db->prepare("UPDATE users SET role = ?, password = ? WHERE id = ?");
                        $update->execute([$roleToApply, $adminHash, $existing['id']]);
                    }
                } else {
                    if ($hasEmailVerified) {
                        $updateRole = $db->prepare("UPDATE users SET role = ?, email_verified = CASE WHEN ? = 'OWNER' THEN 1 ELSE email_verified END WHERE id = ?");
                        $updateRole->execute([$roleToApply, $roleToApply, $existing['id']]);
                    } else {
                        $updateRole = $db->prepare("UPDATE users SET role = ? WHERE id = ?");
                        $updateRole->execute([$roleToApply, $existing['id']]);
                    }
                }
            } else {
                if ($adminHash === null) $adminHash = password_hash($secret, PASSWORD_DEFAULT);
                $newId = 'admin_' . bin2hex(random_bytes(4));
                if ($hasEmailVerified) {
                    $insert = $db->prepare("INSERT INTO users (id, name, email, phone, address, profile_image, password, role, email_verified) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
                    $insert->execute([
                        $newId,
                        $roleToApply === 'OWNER' ? 'Splaro Owner' : 'Splaro Admin',
                        $email,
                        '01700000000',
                        null,
                        null,
                        $adminHash,
                        $roleToApply,
                        $roleToApply === 'OWNER' ? 1 : 0
                    ]);
                } else {
                    $insert = $db->prepare("INSERT INTO users (id, name, email, phone, address, profile_image, password, role) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
                    $insert->execute([
                        $newId,
                        $roleToApply === 'OWNER' ? 'Splaro Owner' : 'Splaro Admin',
                        $email,
                        '01700000000',
                        null,
                        null,
                        $adminHash,
                        $roleToApply
                    ]);
                }
            }
        } catch (Exception $e) {
            error_log("SPLARO_ADMIN_AUTOSEED_FAILURE({$email}): " . $e->getMessage());
            splaro_log_exception('admin.autoseed.identity', $e, [
                'email' => (string)$email
            ]);
        }
    }

    // Ensure only the configured owner email stays OWNER.
    try {
        $demoteOwners = $db->prepare("UPDATE users SET role = 'ADMIN' WHERE role = 'OWNER' AND LOWER(email) <> ?");
        $demoteOwners->execute([$primaryEmail]);
    } catch (Exception $e) {
        error_log("SPLARO_OWNER_STRICT_DEMOTE_FAILURE: " . $e->getMessage());
        splaro_log_exception('admin.autoseed.owner_demote', $e, [
            'primary_email' => (string)$primaryEmail
        ]);
    }

    // Keep only the configured owner/admin identity as privileged from strict autoseed.
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

if ($method === 'GET' && $action === 'admin_subdomain_repair_status') {
    require_admin_access($requestAuthUser);
    $statusPayload = splaro_read_admin_subdomain_repair_status();
    echo json_encode([
        "status" => "success",
        "data" => $statusPayload
    ]);
    exit;
}

if (($method === 'GET' || $method === 'POST') && $action === 'admin_subdomain_repair') {
    require_admin_access($requestAuthUser);
    if ($method === 'POST') {
        require_csrf_token();
    }
    $repairResult = maybe_repair_admin_subdomain_bundle(true);
    $httpCode = !empty($repairResult['ok']) ? 200 : 207;
    http_response_code($httpCode);
    echo json_encode([
        "status" => !empty($repairResult['ok']) ? "success" : "warning",
        "data" => is_array($repairResult) ? $repairResult : ['ok' => false, 'reason' => 'UNKNOWN']
    ]);
    exit;
}

function queue_scope_from_mode($mode = 'SHEETS') {
    $normalizedMode = strtoupper(trim((string)$mode));
    if (!in_array($normalizedMode, ['SHEETS', 'TELEGRAM', 'PUSH', 'ALL'], true)) {
        $normalizedMode = 'SHEETS';
    }
    $isTelegram = $normalizedMode === 'TELEGRAM';
    $isPush = $normalizedMode === 'PUSH';
    $isAll = $normalizedMode === 'ALL';
    $isSheets = !$isTelegram && !$isPush && !$isAll;
    if ($isTelegram) {
        $whereSql = "sync_type LIKE 'TELEGRAM_%'";
    } elseif ($isPush) {
        $whereSql = "sync_type LIKE 'PUSH_%'";
    } elseif ($isAll) {
        $whereSql = "1=1";
    } else {
        $whereSql = "sync_type NOT LIKE 'TELEGRAM_%' AND sync_type NOT LIKE 'PUSH_%'";
    }
    if ($isTelegram) {
        $enabled = TELEGRAM_ENABLED;
    } elseif ($isPush) {
        $enabled = PUSH_ENABLED;
    } elseif ($isAll) {
        $enabled = true;
    } else {
        $enabled = (GOOGLE_SHEETS_WEBHOOK_URL !== '');
    }
    return [
        'mode' => $normalizedMode,
        'where_sql' => $whereSql,
        'enabled' => (bool)$enabled,
        'is_sheets' => (bool)$isSheets,
    ];
}

function queue_dead_recent_count($db, $mode = 'ALL', $minutes = null) {
    if (!$db) {
        return 0;
    }
    $scope = queue_scope_from_mode($mode);
    $windowMinutes = $minutes === null ? (int)HEALTH_QUEUE_DEAD_DOWN_WINDOW_MINUTES : (int)$minutes;
    if ($windowMinutes < 1) $windowMinutes = 1;
    if ($windowMinutes > 10080) $windowMinutes = 10080;
    try {
        $stmt = $db->prepare("SELECT COUNT(*) FROM sync_queue WHERE {$scope['where_sql']} AND status = 'DEAD' AND updated_at >= DATE_SUB(NOW(), INTERVAL ? MINUTE)");
        $stmt->bindValue(1, $windowMinutes, PDO::PARAM_INT);
        $stmt->execute();
        return (int)$stmt->fetchColumn();
    } catch (Throwable $e) {
        splaro_log_exception('queue.summary.dead_recent', $e, [
            'mode' => (string)$scope['mode'],
            'minutes' => (int)$windowMinutes
        ], 'WARNING');
        return 0;
    }
}

function queue_summary_active_workload($summary) {
    if (!is_array($summary)) {
        return 0;
    }
    return (int)($summary['pending'] ?? 0)
        + (int)($summary['retry'] ?? 0)
        + (int)($summary['processing'] ?? 0);
}

function queue_dead_recent_breakdown($db, $mode = 'ALL', $minutes = null, $scanLimit = 2000) {
    $scope = queue_scope_from_mode($mode);
    $windowMinutes = $minutes === null ? (int)HEALTH_QUEUE_DEAD_DOWN_WINDOW_MINUTES : (int)$minutes;
    if ($windowMinutes < 1) $windowMinutes = 1;
    if ($windowMinutes > 10080) $windowMinutes = 10080;
    $limit = (int)$scanLimit;
    if ($limit < 1) $limit = 1;
    if ($limit > 5000) $limit = 5000;

    $out = [
        'mode' => (string)$scope['mode'],
        'window_minutes' => (int)$windowMinutes,
        'total' => 0,
        'scanned' => 0,
        'permanent' => 0,
        'transient' => 0,
        'truncated' => false
    ];
    if (!$db) {
        return $out;
    }

    try {
        $countStmt = $db->prepare("SELECT COUNT(*) FROM sync_queue WHERE {$scope['where_sql']} AND status = 'DEAD' AND updated_at >= DATE_SUB(NOW(), INTERVAL ? MINUTE)");
        $countStmt->bindValue(1, $windowMinutes, PDO::PARAM_INT);
        $countStmt->execute();
        $out['total'] = (int)$countStmt->fetchColumn();
    } catch (Throwable $e) {
        splaro_log_exception('queue.summary.dead_breakdown.count', $e, [
            'mode' => (string)$scope['mode'],
            'minutes' => (int)$windowMinutes
        ], 'WARNING');
        return $out;
    }

    if ($out['total'] <= 0) {
        return $out;
    }

    try {
        $scanStmt = $db->prepare("SELECT sync_type, last_http_code, last_error FROM sync_queue WHERE {$scope['where_sql']} AND status = 'DEAD' AND updated_at >= DATE_SUB(NOW(), INTERVAL ? MINUTE) ORDER BY id DESC LIMIT ?");
        $scanStmt->bindValue(1, $windowMinutes, PDO::PARAM_INT);
        $scanStmt->bindValue(2, $limit, PDO::PARAM_INT);
        $scanStmt->execute();
        $rows = $scanStmt->fetchAll();
    } catch (Throwable $e) {
        splaro_log_exception('queue.summary.dead_breakdown.scan', $e, [
            'mode' => (string)$scope['mode'],
            'minutes' => (int)$windowMinutes
        ], 'WARNING');
        return $out;
    }

    $out['scanned'] = is_array($rows) ? count($rows) : 0;
    $out['truncated'] = $out['total'] > $out['scanned'];

    foreach ($rows as $row) {
        $syncType = (string)($row['sync_type'] ?? '');
        $httpCode = (int)($row['last_http_code'] ?? 0);
        $lastError = (string)($row['last_error'] ?? '');
        if (queue_dead_reason_is_permanent($syncType, $httpCode, $lastError)) {
            $out['permanent']++;
        } else {
            $out['transient']++;
        }
    }

    return $out;
}

function get_queue_summary($db, $mode = 'SHEETS') {
    $scope = queue_scope_from_mode($mode);
    $normalizedMode = (string)$scope['mode'];
    $whereSql = (string)$scope['where_sql'];
    $enabled = (bool)$scope['enabled'];
    $summary = [
        'enabled' => $enabled,
        'pending' => 0,
        'retry' => 0,
        'processing' => 0,
        'success' => 0,
        'dead' => 0,
        'dead_recent' => 0,
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
    $summary['dead_recent'] = queue_dead_recent_count($db, $normalizedMode);

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

    if (!empty($scope['is_sheets']) && function_exists('get_sheets_circuit_state')) {
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

function get_push_queue_summary($db) {
    return get_queue_summary($db, 'PUSH');
}

function queue_dead_reason_is_permanent($syncType, $httpCode, $lastError) {
    $type = strtoupper(trim((string)$syncType));
    $error = strtoupper(trim((string)$lastError));
    $http = (int)$httpCode;

    if ($error === '') {
        $error = 'UNKNOWN';
    }

    $alwaysPermanentTokens = [
        'INVALID_PAYLOAD_JSON',
        'INVALID_JSON_SHAPE',
        'INVALID_TELEGRAM_PAYLOAD',
        'ENDPOINT_MISSING',
        'INVALID_ENDPOINT_AUDIENCE',
        'SUBSCRIPTION_INACTIVE'
    ];
    foreach ($alwaysPermanentTokens as $token) {
        if (strpos($error, $token) !== false) {
            return true;
        }
    }

    if (strpos($type, 'PUSH_') === 0) {
        if (in_array($http, [404, 410], true)) {
            return true;
        }
        foreach (['PUSH_DISABLED', 'VAPID_JWT_FAILED'] as $token) {
            if (strpos($error, $token) !== false) {
                return true;
            }
        }
        return false;
    }

    if (strpos($type, 'TELEGRAM_') === 0) {
        if (in_array($http, [400, 401, 403], true)) {
            return true;
        }
        $telegramPermanentTokens = [
            'CHAT NOT FOUND',
            'BOT WAS BLOCKED',
            'USER IS DEACTIVATED',
            'TELEGRAM_DISABLED',
            'TELEGRAM_BOT_TOKEN_MISSING'
        ];
        foreach ($telegramPermanentTokens as $token) {
            if (strpos($error, $token) !== false) {
                return true;
            }
        }
        return false;
    }

    if (in_array($http, [400, 401, 403, 404], true)) {
        $looksTransient = strpos($error, 'NETWORK') !== false || strpos($error, 'TIMEOUT') !== false || strpos($error, 'HTTP_429') !== false;
        if (!$looksTransient) {
            return true;
        }
    }

    return false;
}

function recover_dead_queue_jobs($db, $options = []) {
    $mode = strtoupper(trim((string)($options['mode'] ?? 'ALL')));
    if (!in_array($mode, ['ALL', 'TELEGRAM', 'PUSH', 'SHEETS'], true)) {
        $mode = 'ALL';
    }
    $limit = (int)($options['limit'] ?? 100);
    if ($limit < 1) $limit = 1;
    if ($limit > 1000) $limit = 1000;
    $scope = queue_scope_from_mode($mode);

    $result = [
        'mode' => $scope['mode'],
        'limit' => $limit,
        'total_dead_scanned' => 0,
        'recovered' => 0,
        'skipped_permanent' => 0,
        'failed_updates' => 0,
        'skipped_examples' => []
    ];
    if (!$db) {
        return $result;
    }

    try {
        $stmt = $db->prepare("SELECT id, sync_type, last_http_code, last_error FROM sync_queue WHERE {$scope['where_sql']} AND status = 'DEAD' ORDER BY id ASC LIMIT ?");
        $stmt->bindValue(1, $limit, PDO::PARAM_INT);
        $stmt->execute();
        $jobs = $stmt->fetchAll();
    } catch (Throwable $e) {
        splaro_log_exception('queue.recover.read', $e, [
            'mode' => (string)$scope['mode'],
            'limit' => (int)$limit
        ]);
        return $result;
    }

    $result['total_dead_scanned'] = is_array($jobs) ? count($jobs) : 0;
    if (empty($jobs)) {
        return $result;
    }

    $retryStmt = $db->prepare("UPDATE sync_queue SET status = 'RETRY', attempts = 0, next_attempt_at = NOW(), locked_at = NULL, last_http_code = NULL, last_error = ? WHERE id = ? AND status = 'DEAD'");
    foreach ($jobs as $job) {
        $jobId = (int)($job['id'] ?? 0);
        if ($jobId <= 0) {
            continue;
        }
        $syncType = (string)($job['sync_type'] ?? '');
        $httpCode = (int)($job['last_http_code'] ?? 0);
        $lastError = (string)($job['last_error'] ?? '');
        if (queue_dead_reason_is_permanent($syncType, $httpCode, $lastError)) {
            $result['skipped_permanent']++;
            if (count($result['skipped_examples']) < 15) {
                $result['skipped_examples'][] = [
                    'id' => $jobId,
                    'sync_type' => $syncType,
                    'http_code' => $httpCode,
                    'error' => splaro_clip_text($lastError, 220)
                ];
            }
            continue;
        }

        try {
            $retryStmt->execute([
                'RECOVERED_FROM_DEAD_AT_' . date('c'),
                $jobId
            ]);
            if ($retryStmt->rowCount() > 0) {
                $result['recovered']++;
            }
        } catch (Throwable $e) {
            $result['failed_updates']++;
            splaro_log_exception('queue.recover.update', $e, [
                'job_id' => $jobId,
                'sync_type' => $syncType
            ]);
        }
    }

    return $result;
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

function health_normalize_probe($probe) {
    $normalized = strtolower(trim((string)$probe));
    $aliases = [
        'database' => 'db',
        'tele' => 'telegram',
        'google_sheets' => 'sheets',
        'sheet' => 'sheets',
        'order' => 'orders',
        'authentication' => 'auth',
        'queue_worker' => 'queue'
    ];
    if (isset($aliases[$normalized])) {
        $normalized = $aliases[$normalized];
    }
    $allowed = ['db', 'telegram', 'sheets', 'queue', 'orders', 'auth'];
    return in_array($normalized, $allowed, true) ? $normalized : '';
}

function health_recommended_action($service, $error = '', $context = []) {
    $serviceKey = strtoupper(trim((string)$service));
    $errorText = strtoupper((string)$error);
    if ($serviceKey === 'DB') {
        if (strpos($errorText, 'ABORTED_CONNECTS') !== false) {
            return 'DB aborted_connects rising fast. Check credentials, bot traffic, and connection reuse.';
        }
        return 'Validate DB credentials/host, reduce connection churn, and verify MySQL process limits.';
    }
    if ($serviceKey === 'TELEGRAM') {
        return 'Verify bot token, admin allowlist, webhook secret, and Telegram API reachability.';
    }
    if ($serviceKey === 'SHEETS') {
        if (strpos($errorText, 'TRANSIENT') !== false || strpos($errorText, 'TIMEOUT') !== false) {
            return 'Sheets timeout/network issue detected. Increase timeout, verify Apps Script latency, recover dead queue, then rerun probe.';
        }
        return 'Check Apps Script URL/secret, circuit state, and sheet permissions for the service account.';
    }
    if ($serviceKey === 'QUEUE') {
        if (strpos($errorText, 'TRANSIENT') !== false) {
            return 'Transient queue dead jobs detected. Run recover_dead_queue with drain, then monitor retry backlog until zero.';
        }
        return 'Queue dead/retry increased. Inspect sync_queue last_error, run recover_dead_queue, then drain worker with low batch.';
    }
    if ($serviceKey === 'ORDERS') {
        return 'Orders API probe failed. Validate orders table health, write permissions, and payload validation logs.';
    }
    if ($serviceKey === 'AUTH') {
        return 'Auth probe failed. Validate users table, JWT secret consistency, and token validation path.';
    }
    if ($serviceKey === 'PUSH') {
        if (strpos($errorText, 'PUSH_DISABLED') !== false) {
            return 'Enable VAPID public/private keys, then run Push probe and drain push queue.';
        }
        return 'Push failures detected. Check VAPID keys, inactive endpoints, and queue dead-letter reasons.';
    }
    return 'Inspect recent system_errors context and retry probe.';
}

function health_record_event($db, $probe, $status, $latencyMs, $error = '') {
    if (!$db) {
        return false;
    }
    $probeSafe = health_normalize_probe($probe);
    if ($probeSafe === '') {
        $probeSafe = splaro_clip_text((string)$probe, 40);
    }
    $statusSafe = strtoupper(trim((string)$status));
    if (!in_array($statusSafe, ['PASS', 'FAIL', 'WARNING'], true)) {
        $statusSafe = 'FAIL';
    }
    $latencySafe = max(0, (int)$latencyMs);
    $errorSafe = splaro_clip_text(splaro_redact_sensitive_text((string)$error), 1200);

    try {
        $stmt = $db->prepare("INSERT INTO health_events (probe, status, latency_ms, error, created_at) VALUES (?, ?, ?, ?, NOW())");
        $stmt->execute([$probeSafe, $statusSafe, $latencySafe, $errorSafe]);
        return true;
    } catch (Throwable $e) {
        splaro_log_exception('health.events.insert', $e, [
            'probe' => (string)$probeSafe,
            'status' => (string)$statusSafe
        ], 'WARNING');
        return false;
    }
}

function health_fetch_events($db, $limit = 50, $probe = '') {
    if (!$db) {
        return [];
    }
    $max = max(1, min((int)$limit, 200));
    $probeSafe = health_normalize_probe($probe);
    $sql = "SELECT id, probe, status, latency_ms, error, created_at FROM health_events";
    $params = [];
    if ($probeSafe !== '') {
        $sql .= " WHERE probe = ?";
        $params[] = $probeSafe;
    }
    $sql .= " ORDER BY id DESC LIMIT " . $max;

    try {
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll();
        $out = [];
        foreach ($rows as $row) {
            $out[] = [
                'id' => (int)($row['id'] ?? 0),
                'probe' => (string)($row['probe'] ?? ''),
                'status' => strtoupper((string)($row['status'] ?? '')),
                'latency_ms' => isset($row['latency_ms']) ? (int)$row['latency_ms'] : null,
                'error' => (string)($row['error'] ?? ''),
                'created_at' => (string)($row['created_at'] ?? '')
            ];
        }
        return $out;
    } catch (Throwable $e) {
        splaro_log_exception('health.events.list', $e, ['probe' => $probeSafe], 'WARNING');
        return [];
    }
}

function health_fetch_system_errors($db, $limit = 50, $service = '', $level = '') {
    if (!$db) {
        return [];
    }
    $max = max(1, min((int)$limit, 200));
    $serviceSafe = trim((string)$service);
    $levelSafe = strtoupper(trim((string)$level));
    $where = [];
    $params = [];
    if ($serviceSafe !== '') {
        $where[] = 'service = ?';
        $params[] = splaro_clip_text($serviceSafe, 80);
    }
    if ($levelSafe !== '') {
        $where[] = 'level = ?';
        $params[] = splaro_clip_text($levelSafe, 20);
    }
    $sql = "SELECT id, service, level, message, context_json, created_at FROM system_errors";
    if (!empty($where)) {
        $sql .= ' WHERE ' . implode(' AND ', $where);
    }
    $sql .= ' ORDER BY id DESC LIMIT ' . $max;

    try {
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll();
        $out = [];
        foreach ($rows as $row) {
            $contextJson = (string)($row['context_json'] ?? '');
            $decodedContext = json_decode($contextJson, true);
            if (!is_array($decodedContext)) {
                $decodedContext = [];
            }
            $out[] = [
                'id' => (int)($row['id'] ?? 0),
                'service' => (string)($row['service'] ?? ''),
                'level' => strtoupper((string)($row['level'] ?? 'ERROR')),
                'message' => (string)($row['message'] ?? ''),
                'context_json' => $contextJson,
                'context' => $decodedContext,
                'created_at' => (string)($row['created_at'] ?? '')
            ];
        }
        return $out;
    } catch (Throwable $e) {
        splaro_log_exception('health.system_errors.list', $e, [
            'service' => $serviceSafe,
            'level' => $levelSafe
        ], 'WARNING');
        return [];
    }
}

function health_fetch_recent_db_errors($db, $limit = 20) {
    $rows = health_fetch_system_errors($db, $limit);
    if (!empty($rows)) {
        return $rows;
    }
    if (!$db) {
        return [];
    }
    $max = max(1, min((int)$limit, 100));
    try {
        $stmt = $db->query("SELECT id, event_type, event_description, created_at FROM system_logs ORDER BY id DESC LIMIT {$max}");
        $logs = $stmt->fetchAll();
        $out = [];
        foreach ($logs as $row) {
            $eventType = strtoupper((string)($row['event_type'] ?? ''));
            $desc = (string)($row['event_description'] ?? '');
            if (
                strpos($eventType, 'ERROR') === false &&
                strpos($eventType, 'FAIL') === false &&
                strpos($eventType, 'DEAD') === false &&
                strpos(strtoupper($desc), 'ERROR') === false &&
                strpos(strtoupper($desc), 'FAIL') === false
            ) {
                continue;
            }
            $out[] = [
                'id' => (int)($row['id'] ?? 0),
                'service' => (string)$eventType,
                'level' => 'ERROR',
                'message' => $desc,
                'context_json' => '{}',
                'context' => [],
                'created_at' => (string)($row['created_at'] ?? '')
            ];
        }
        return $out;
    } catch (Throwable $e) {
        splaro_log_exception('health.system_logs.errors.list', $e, [], 'WARNING');
        return [];
    }
}

function health_latest_probe_map($db) {
    $map = [];
    foreach (['db', 'orders', 'auth', 'queue', 'telegram', 'sheets'] as $probe) {
        $map[$probe] = null;
    }
    if (!$db) {
        return $map;
    }
    try {
        $stmt = $db->query("SELECT id, probe, status, latency_ms, error, created_at FROM health_events ORDER BY id DESC LIMIT 400");
        $rows = $stmt->fetchAll();
        foreach ($rows as $row) {
            $probe = health_normalize_probe((string)($row['probe'] ?? ''));
            if ($probe === '' || isset($map[$probe]) && $map[$probe] !== null) {
                continue;
            }
            $map[$probe] = [
                'id' => (int)($row['id'] ?? 0),
                'probe' => $probe,
                'status' => strtoupper((string)($row['status'] ?? 'FAIL')),
                'latency_ms' => isset($row['latency_ms']) ? (int)$row['latency_ms'] : null,
                'error' => (string)($row['error'] ?? ''),
                'created_at' => (string)($row['created_at'] ?? '')
            ];
        }
    } catch (Throwable $e) {
        splaro_log_exception('health.events.latest_map', $e, [], 'WARNING');
    }
    return $map;
}

function health_probe_age_seconds($probeRow) {
    if (!is_array($probeRow)) {
        return null;
    }
    $createdAt = trim((string)($probeRow['created_at'] ?? ''));
    if ($createdAt === '') {
        return null;
    }
    $ts = strtotime($createdAt);
    if ($ts === false) {
        return null;
    }
    $age = time() - (int)$ts;
    if ($age < 0) {
        $age = 0;
    }
    return $age;
}

function health_probe_is_recent($probeRow, $maxAgeMinutes = null) {
    $age = health_probe_age_seconds($probeRow);
    if ($age === null) {
        return false;
    }
    $minutes = $maxAgeMinutes === null ? (int)HEALTH_PROBE_STALE_MINUTES : (int)$maxAgeMinutes;
    if ($minutes < 1) $minutes = 1;
    return $age <= ($minutes * 60);
}

function health_latest_probe_latency($probeRow, $maxAgeMinutes = null) {
    if (!health_probe_is_recent($probeRow, $maxAgeMinutes)) {
        return null;
    }
    if (!is_array($probeRow)) {
        return null;
    }
    return isset($probeRow['latency_ms']) ? (int)$probeRow['latency_ms'] : null;
}

function health_latest_probe_error($probeRow, $maxAgeMinutes = null) {
    if (!health_probe_is_recent($probeRow, $maxAgeMinutes)) {
        return '';
    }
    if (!is_array($probeRow)) {
        return '';
    }
    $status = strtoupper(trim((string)($probeRow['status'] ?? '')));
    if ($status === 'PASS' || $status === 'OK') {
        return '';
    }
    return (string)($probeRow['error'] ?? '');
}

function health_counter_state_file($bucket) {
    $safeBucket = preg_replace('/[^a-z0-9_-]/i', '_', strtolower((string)$bucket));
    if (!is_string($safeBucket) || $safeBucket === '') {
        $safeBucket = md5((string)$bucket);
    }
    $scopeKey = md5((string)DB_HOST . '|' . (string)DB_NAME . '|' . (string)DB_USER);
    return rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR
        . "splaro_health_counter_{$scopeKey}_{$safeBucket}.json";
}

function health_track_monotonic_counter($bucket, $currentValue, $windowSeconds = 900) {
    $window = max(60, min((int)$windowSeconds, 3600));
    $current = max(0, (int)$currentValue);
    $now = time();
    $file = health_counter_state_file($bucket);

    $previousValue = null;
    $previousTime = 0;
    if (is_file($file)) {
        $raw = @file_get_contents($file);
        $parsed = json_decode((string)$raw, true);
        if (is_array($parsed)) {
            $previousValue = isset($parsed['value']) ? (int)$parsed['value'] : null;
            $previousTime = isset($parsed['time']) ? (int)$parsed['time'] : 0;
        }
    }

    $elapsed = $previousTime > 0 ? max(0, $now - $previousTime) : 0;
    $counterReset = false;
    $delta = 0;
    if ($previousValue !== null) {
        if ($current >= $previousValue) {
            $delta = $current - $previousValue;
        } else {
            $counterReset = true;
        }
    }

    @file_put_contents($file, json_encode([
        'value' => $current,
        'time' => $now
    ]), LOCK_EX);

    $withinWindow = $elapsed > 0 && $elapsed <= $window;
    $ratePerMinute = $elapsed > 0 ? round(($delta / max(1, $elapsed)) * 60, 2) : 0.0;

    return [
        'current' => $current,
        'previous' => $previousValue,
        'delta' => $delta,
        'elapsed_seconds' => $elapsed,
        'rate_per_minute' => $ratePerMinute,
        'within_window' => $withinWindow,
        'counter_reset' => $counterReset,
        'window_seconds' => $window
    ];
}

function health_alert_rate_limited($bucket, $windowSeconds = 300) {
    $seconds = max(60, min((int)$windowSeconds, 3600));
    $key = md5('health_alert|' . (string)$bucket);
    $file = rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'splaro_health_alert_' . $key . '.json';
    $now = time();
    $payload = ['last_sent_at' => 0];
    if (is_file($file)) {
        $parsed = json_decode((string)@file_get_contents($file), true);
        if (is_array($parsed)) {
            $payload = array_merge($payload, $parsed);
        }
    }
    $last = (int)($payload['last_sent_at'] ?? 0);
    if ($last > 0 && ($now - $last) < $seconds) {
        return true;
    }
    $payload['last_sent_at'] = $now;
    @file_put_contents($file, json_encode($payload), LOCK_EX);
    return false;
}

function health_maybe_send_telegram_alert($service, $severity, $message, $context = []) {
    if (!TELEGRAM_ENABLED) {
        return false;
    }
    $serviceSafe = strtoupper(splaro_clip_text((string)$service, 40));
    $severitySafe = strtoupper(splaro_clip_text((string)$severity, 20));
    $messageSafe = splaro_clip_text(splaro_redact_sensitive_text((string)$message), 350);
    $alertKey = md5($serviceSafe . '|' . $severitySafe . '|' . $messageSafe);
    if (health_alert_rate_limited($alertKey, (int)HEALTH_ALERT_RATE_LIMIT_SECONDS)) {
        return false;
    }
    $text = "<b>Health Alert</b>\n"
        . "Service: " . telegram_escape_html($serviceSafe) . "\n"
        . "Severity: " . telegram_escape_html($severitySafe) . "\n"
        . "Message: " . telegram_escape_html($messageSafe) . "\n"
        . "Time: " . telegram_escape_html(date('Y-m-d H:i:s'));
    $sent = send_telegram_message($text);
    if (!$sent) {
        splaro_record_system_error('HEALTH_ALERT', 'ERROR', 'Failed to send Telegram health alert.', [
            'service' => $serviceSafe,
            'severity' => $severitySafe,
            'message' => $messageSafe
        ]);
    }
    return (bool)$sent;
}

function health_probe_status_card($statusRaw) {
    $status = strtoupper((string)$statusRaw);
    if ($status === 'PASS' || $status === 'OK') {
        return 'OK';
    }
    if ($status === 'WARNING' || $status === 'WARN') {
        return 'WARNING';
    }
    return 'DOWN';
}

function health_sheets_probe_is_transient_failure($httpCode, $error) {
    $code = (int)$httpCode;
    $err = strtoupper(trim((string)$error));
    if ($code === 0 || $code === 408 || $code === 429 || $code >= 500) {
        return true;
    }
    if (
        strpos($err, 'TIMEOUT') !== false
        || strpos($err, 'TIMED OUT') !== false
        || strpos($err, 'NETWORK') !== false
        || strpos($err, 'CONNECTION') !== false
    ) {
        return true;
    }
    return false;
}

function run_health_probe($db, $probe, $requestAuthUser = null) {
    $probeKey = health_normalize_probe($probe);
    $startedAt = microtime(true);
    $result = [
        'probe' => $probeKey !== '' ? $probeKey : strtolower(trim((string)$probe)),
        'status' => 'FAIL',
        'latency_ms' => 0,
        'error' => '',
        'checked_at' => date('c'),
        'details' => []
    ];

    if ($probeKey === '') {
        $result['error'] = 'INVALID_PROBE';
        $result['latency_ms'] = (int)round((microtime(true) - $startedAt) * 1000);
        health_record_event($db, 'invalid', 'FAIL', $result['latency_ms'], $result['error']);
        return $result;
    }

    try {
        if ($probeKey === 'db') {
            $q = $db->query('SELECT 1');
            $q->fetchColumn();
            $result['status'] = 'PASS';
            $result['details'] = [
                'db_host' => (string)($GLOBALS['SPLARO_DB_CONNECTED_HOST'] ?? DB_HOST),
                'connect_timeout_seconds' => (int)DB_CONNECT_TIMEOUT_SECONDS,
                'query_timeout_ms' => (int)DB_QUERY_TIMEOUT_MS
            ];
        } elseif ($probeKey === 'telegram') {
            if (!TELEGRAM_ENABLED) {
                throw new RuntimeException('TELEGRAM_DISABLED');
            }
            $actor = is_array($requestAuthUser) ? ((string)($requestAuthUser['email'] ?? $requestAuthUser['id'] ?? 'ADMIN')) : 'ADMIN_KEY';
            $text = "<b>Health Probe</b>\nService: TELEGRAM\nBy: " . telegram_escape_html($actor) . "\nTime: " . telegram_escape_html(date('Y-m-d H:i:s'));
            $sent = send_telegram_message($text);
            if (!$sent) {
                throw new RuntimeException('TELEGRAM_SEND_FAILED');
            }
            $result['status'] = 'PASS';
            $result['details'] = ['sent' => true];
        } elseif ($probeKey === 'sheets') {
            if (trim((string)GOOGLE_SHEETS_WEBHOOK_URL) === '') {
                throw new RuntimeException('SHEETS_DISABLED');
            }
            $probeAttempts = (int)HEALTH_SHEETS_PROBE_RETRIES;
            if ($probeAttempts < 1) $probeAttempts = 1;
            if ($probeAttempts > 3) $probeAttempts = 3;
            $attemptDetails = [];
            $finalHttpCode = 0;
            $finalError = '';
            $probeOk = false;
            $probeResponse = '';

            for ($attempt = 1; $attempt <= $probeAttempts; $attempt++) {
                [$ok, $httpCode, $error, $response] = perform_sheets_sync_request('HEALTH_PROBE', [
                    'probe' => 'sheets',
                    'checked_at' => date('c'),
                    'source' => 'admin_system_health',
                    'attempt' => $attempt
                ]);
                $finalHttpCode = (int)$httpCode;
                $finalError = trim((string)$error);
                $probeResponse = (string)$response;
                $attemptDetails[] = [
                    'attempt' => $attempt,
                    'ok' => (bool)$ok,
                    'http_code' => (int)$httpCode,
                    'error' => $finalError
                ];

                if ($ok) {
                    $probeOk = true;
                    break;
                }

                $isTransient = health_sheets_probe_is_transient_failure($httpCode, $finalError);
                $hasMoreAttempts = $attempt < $probeAttempts;
                if (!$isTransient || !$hasMoreAttempts) {
                    break;
                }
                usleep($attempt * 350000);
            }

            if (!$probeOk) {
                throw new RuntimeException($finalError !== '' ? $finalError : ('SHEETS_HTTP_' . (int)$finalHttpCode));
            }
            $result['status'] = 'PASS';
            $result['details'] = [
                'http_code' => (int)$finalHttpCode,
                'response_preview' => splaro_clip_text($probeResponse, 180),
                'attempts' => $attemptDetails
            ];
        } elseif ($probeKey === 'queue') {
            $before = [
                'telegram' => get_telegram_queue_summary($db),
                'push' => get_push_queue_summary($db),
                'sheets' => get_sync_queue_summary($db)
            ];
            $recoveryResult = recover_dead_queue_jobs($db, [
                'mode' => 'ALL',
                'limit' => 200
            ]);
            $campaignResult = process_due_campaigns($db, 2);
            $telegramResult = process_telegram_queue($db, 4);
            $pushResult = process_push_queue($db, 8);
            $sheetsResult = process_sync_queue($db, 4, true);
            $after = [
                'telegram' => get_telegram_queue_summary($db),
                'push' => get_push_queue_summary($db),
                'sheets' => get_sync_queue_summary($db)
            ];
            $deadBefore = (int)($before['telegram']['dead'] ?? 0) + (int)($before['push']['dead'] ?? 0) + (int)($before['sheets']['dead'] ?? 0);
            $deadAfter = (int)($after['telegram']['dead'] ?? 0) + (int)($after['push']['dead'] ?? 0) + (int)($after['sheets']['dead'] ?? 0);
            $deadBreakdown = queue_dead_recent_breakdown($db, 'ALL');
            $hasPermanentRecentDead = (int)($deadBreakdown['permanent'] ?? 0) > 0;

            if ($deadAfter > $deadBefore && $hasPermanentRecentDead) {
                throw new RuntimeException('QUEUE_DEAD_COUNT_INCREASED');
            }
            if ($deadAfter > $deadBefore && !$hasPermanentRecentDead) {
                $result['status'] = 'WARNING';
                $result['error'] = 'QUEUE_DEAD_TRANSIENT_PRESENT';
            } else {
                $result['status'] = 'PASS';
            }
            $result['details'] = [
                'recovery' => $recoveryResult,
                'campaigns' => $campaignResult,
                'telegram' => $telegramResult,
                'push' => $pushResult,
                'sheets' => $sheetsResult,
                'dead_before' => $deadBefore,
                'dead_after' => $deadAfter,
                'dead_recent_breakdown' => $deadBreakdown
            ];
        } elseif ($probeKey === 'orders') {
            $count = (int)$db->query("SELECT COUNT(*) FROM orders")->fetchColumn();
            $latest = $db->query("SELECT id, status, created_at FROM orders ORDER BY created_at DESC LIMIT 1")->fetch();
            $result['status'] = 'PASS';
            $result['details'] = [
                'orders_total' => $count,
                'latest_order_id' => (string)($latest['id'] ?? ''),
                'latest_order_status' => (string)($latest['status'] ?? '')
            ];
        } elseif ($probeKey === 'auth') {
            $row = $db->query("SELECT id, email, role, last_password_change_at FROM users ORDER BY created_at DESC LIMIT 1")->fetch();
            if (!$row) {
                throw new RuntimeException('AUTH_NO_USERS_FOUND');
            }
            $pwdAt = !empty($row['last_password_change_at']) ? strtotime((string)$row['last_password_change_at']) : null;
            $token = issue_auth_token([
                'id' => (string)($row['id'] ?? ''),
                'email' => strtolower((string)($row['email'] ?? '')),
                'role' => strtoupper((string)($row['role'] ?? 'USER')),
                'pwd_at' => $pwdAt ?: null
            ]);
            if (trim((string)$token) === '') {
                throw new RuntimeException('AUTH_TOKEN_GENERATION_FAILED');
            }
            $validated = validate_auth_token((string)$token);
            if (!is_array($validated) || (string)($validated['id'] ?? '') !== (string)($row['id'] ?? '')) {
                throw new RuntimeException('AUTH_TOKEN_VALIDATION_FAILED');
            }
            $result['status'] = 'PASS';
            $result['details'] = [
                'user_id' => (string)($row['id'] ?? ''),
                'role' => strtoupper((string)($row['role'] ?? 'USER'))
            ];
        }
    } catch (Throwable $e) {
        $result['status'] = 'FAIL';
        $result['error'] = splaro_clip_text(splaro_redact_sensitive_text($e->getMessage()), 500);
        $result['details'] = [
            'recommended_action' => health_recommended_action($probeKey, $result['error'])
        ];
        splaro_log_exception('health.probe.' . $probeKey, $e, [], 'ERROR');
        splaro_record_system_error('HEALTH_' . strtoupper($probeKey), 'ERROR', $result['error'], [
            'probe' => $probeKey,
            'recommended_action' => health_recommended_action($probeKey, $result['error'])
        ]);
        health_maybe_send_telegram_alert(strtoupper($probeKey), 'DOWN', $result['error'], [
            'probe' => $probeKey
        ]);
    }

    $result['latency_ms'] = (int)round((microtime(true) - $startedAt) * 1000);
    $result['checked_at'] = date('c');
    health_record_event($db, $probeKey, $result['status'], $result['latency_ms'], $result['error']);
    return $result;
}

function push_queue_sync_type() {
    return 'PUSH_SEND';
}

function is_push_queue_sync_type($syncType) {
    $type = strtoupper(trim((string)$syncType));
    return $type === push_queue_sync_type() || strpos($type, 'PUSH_') === 0;
}

function push_vapid_private_key_normalized() {
    $raw = trim((string)PUSH_VAPID_PRIVATE_KEY);
    if ($raw === '') {
        return '';
    }
    $normalized = str_replace(["\r\n", "\r"], "\n", $raw);
    $normalized = str_replace('\\n', "\n", $normalized);
    return trim($normalized);
}

function push_ecdsa_der_to_jose($derSignature, $partLength = 32) {
    $der = (string)$derSignature;
    if ($der === '' || !is_string($derSignature)) {
        return '';
    }
    $offset = 0;
    $len = strlen($der);
    if ($len < 8 || ord($der[$offset]) !== 0x30) {
        return '';
    }
    $offset++;
    $seqLen = ord($der[$offset]);
    $offset++;
    if ($seqLen > 0x80) {
        $num = $seqLen - 0x80;
        if ($num < 1 || $num > 4 || ($offset + $num) > $len) {
            return '';
        }
        $seqLen = 0;
        for ($i = 0; $i < $num; $i++) {
            $seqLen = ($seqLen << 8) | ord($der[$offset + $i]);
        }
        $offset += $num;
    }
    if (($offset + $seqLen) > $len) {
        return '';
    }

    if ($offset >= $len || ord($der[$offset]) !== 0x02) {
        return '';
    }
    $offset++;
    if ($offset >= $len) return '';
    $rLen = ord($der[$offset]);
    $offset++;
    if ($rLen > 0x80) {
        $num = $rLen - 0x80;
        if ($num < 1 || $num > 4 || ($offset + $num) > $len) return '';
        $rLen = 0;
        for ($i = 0; $i < $num; $i++) {
            $rLen = ($rLen << 8) | ord($der[$offset + $i]);
        }
        $offset += $num;
    }
    if (($offset + $rLen) > $len) return '';
    $r = substr($der, $offset, $rLen);
    $offset += $rLen;

    if ($offset >= $len || ord($der[$offset]) !== 0x02) {
        return '';
    }
    $offset++;
    if ($offset >= $len) return '';
    $sLen = ord($der[$offset]);
    $offset++;
    if ($sLen > 0x80) {
        $num = $sLen - 0x80;
        if ($num < 1 || $num > 4 || ($offset + $num) > $len) return '';
        $sLen = 0;
        for ($i = 0; $i < $num; $i++) {
            $sLen = ($sLen << 8) | ord($der[$offset + $i]);
        }
        $offset += $num;
    }
    if (($offset + $sLen) > $len) return '';
    $s = substr($der, $offset, $sLen);

    $r = ltrim($r, "\x00");
    $s = ltrim($s, "\x00");
    if ($r === '') $r = "\x00";
    if ($s === '') $s = "\x00";
    if (strlen($r) > $partLength || strlen($s) > $partLength) {
        return '';
    }

    $r = str_pad($r, $partLength, "\x00", STR_PAD_LEFT);
    $s = str_pad($s, $partLength, "\x00", STR_PAD_LEFT);
    return $r . $s;
}

function push_extract_audience($endpoint) {
    $parts = parse_url((string)$endpoint);
    if (!is_array($parts)) {
        return '';
    }
    $scheme = strtolower(trim((string)($parts['scheme'] ?? '')));
    $host = trim((string)($parts['host'] ?? ''));
    if ($scheme === '' || $host === '') {
        return '';
    }
    $port = isset($parts['port']) ? (int)$parts['port'] : 0;
    if ($port > 0) {
        $isDefault = ($scheme === 'https' && $port === 443) || ($scheme === 'http' && $port === 80);
        if (!$isDefault) {
            return $scheme . '://' . $host . ':' . $port;
        }
    }
    return $scheme . '://' . $host;
}

function push_build_vapid_jwt($audience) {
    $aud = trim((string)$audience);
    if ($aud === '') {
        splaro_integration_trace('push.jwt.audience_missing', [], 'ERROR');
        return '';
    }
    if (!PUSH_ENABLED) {
        splaro_integration_trace('push.jwt.disabled', [], 'WARNING');
        return '';
    }

    $privateKeyPem = push_vapid_private_key_normalized();
    if ($privateKeyPem === '') {
        splaro_integration_trace('push.jwt.private_key_missing', [], 'ERROR');
        return '';
    }
    $privateKey = @openssl_pkey_get_private($privateKeyPem);
    if (!$privateKey) {
        splaro_integration_trace('push.jwt.private_key_invalid', [], 'ERROR');
        return '';
    }

    $header = ['alg' => 'ES256', 'typ' => 'JWT'];
    $payload = [
        'aud' => $aud,
        'exp' => time() + (12 * 60 * 60),
        'sub' => PUSH_VAPID_SUBJECT !== '' ? PUSH_VAPID_SUBJECT : 'mailto:info@splaro.co'
    ];

    $headerJson = json_encode($header, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    $payloadJson = json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if (!is_string($headerJson) || !is_string($payloadJson) || $headerJson === '' || $payloadJson === '') {
        splaro_integration_trace('push.jwt.encode_failed', [
            'json_error' => json_last_error_msg()
        ], 'ERROR');
        return '';
    }

    $headerEncoded = base64url_encode($headerJson);
    $payloadEncoded = base64url_encode($payloadJson);
    $unsigned = $headerEncoded . '.' . $payloadEncoded;
    $derSignature = '';
    $signed = @openssl_sign($unsigned, $derSignature, $privateKey, OPENSSL_ALGO_SHA256);
    if (!$signed) {
        splaro_integration_trace('push.jwt.sign_failed', [
            'openssl_error' => splaro_clip_text((string)openssl_error_string(), 200)
        ], 'ERROR');
        return '';
    }
    $joseSignature = push_ecdsa_der_to_jose($derSignature, 32);
    if ($joseSignature === '') {
        splaro_integration_trace('push.jwt.signature_convert_failed', [], 'ERROR');
        return '';
    }
    return $unsigned . '.' . base64url_encode($joseSignature);
}

function push_is_transient_failure($httpCode, $errorText = '') {
    $http = (int)$httpCode;
    if ($http === 0) {
        return true;
    }
    if (in_array($http, [408, 425, 429, 500, 502, 503, 504], true)) {
        return true;
    }
    $message = strtolower((string)$errorText);
    $needles = ['timeout', 'temporarily', 'network', 'connection', 'rate limit'];
    foreach ($needles as $needle) {
        if ($needle !== '' && strpos($message, $needle) !== false) {
            return true;
        }
    }
    return false;
}

function push_api_request($endpoint, $headers = [], $timeoutSeconds = 8) {
    $url = trim((string)$endpoint);
    if ($url === '') {
        return [false, 0, 'ENDPOINT_MISSING', ''];
    }

    $timeout = (int)$timeoutSeconds;
    if ($timeout < 3) $timeout = 3;
    if ($timeout > 20) $timeout = 20;

    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        $connectTimeout = max(1, min($timeout, 4));
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => is_array($headers) ? $headers : [],
            CURLOPT_POSTFIELDS => '',
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => $connectTimeout,
            CURLOPT_TIMEOUT => $timeout,
            CURLOPT_NOSIGNAL => 1,
            CURLOPT_TCP_KEEPALIVE => 1,
            CURLOPT_LOW_SPEED_LIMIT => 1,
            CURLOPT_LOW_SPEED_TIME => $timeout,
        ]);
        splaro_integration_trace('push.http.curl.before_exec', [
            'endpoint_preview' => splaro_clip_text($url, 160),
            'connect_timeout_seconds' => (int)$connectTimeout,
            'timeout_seconds' => (int)$timeout
        ]);
        $responseBody = curl_exec($ch);
        $httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlErrNo = (int)curl_errno($ch);
        $curlError = (string)curl_error($ch);
        $sslVerifyResult = defined('CURLINFO_SSL_VERIFYRESULT') ? curl_getinfo($ch, CURLINFO_SSL_VERIFYRESULT) : null;
        curl_close($ch);

        splaro_integration_trace('push.http.curl.after_exec', [
            'endpoint_preview' => splaro_clip_text($url, 160),
            'http_code' => (int)$httpCode,
            'curl_errno' => (int)$curlErrNo,
            'curl_error' => (string)$curlError,
            'ssl_verify_result' => $sslVerifyResult,
            'response_preview' => splaro_clip_text($responseBody, 300)
        ], ($responseBody === false || $httpCode < 200 || $httpCode >= 300) ? 'ERROR' : 'INFO');

        if ($responseBody === false) {
            return [false, $httpCode, $curlError !== '' ? $curlError : 'CURL_REQUEST_FAILED', ''];
        }
        return [(string)$responseBody, $httpCode, '', (string)$responseBody];
    }

    $context = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => implode("\r\n", is_array($headers) ? $headers : []) . "\r\n",
            'content' => '',
            'timeout' => $timeout,
            'ignore_errors' => true
        ]
    ]);

    splaro_integration_trace('push.http.stream.before_exec', [
        'endpoint_preview' => splaro_clip_text($url, 160),
        'timeout_seconds' => (int)$timeout
    ]);
    $responseBody = @file_get_contents($url, false, $context);
    $responseHeaders = function_exists('http_get_last_response_headers')
        ? @http_get_last_response_headers()
        : ($GLOBALS['http_response_header'] ?? []);
    $httpCode = 0;
    if (is_array($responseHeaders)) {
        foreach ($responseHeaders as $line) {
            if (preg_match('#^HTTP/\S+\s+(\d{3})#', (string)$line, $m)) {
                $httpCode = (int)$m[1];
                break;
            }
        }
    }
    splaro_integration_trace('push.http.stream.after_exec', [
        'endpoint_preview' => splaro_clip_text($url, 160),
        'http_code' => (int)$httpCode,
        'response_preview' => splaro_clip_text($responseBody, 300),
        'headers_preview' => splaro_clip_text(json_encode($responseHeaders), 300)
    ], ($responseBody === false || $httpCode < 200 || $httpCode >= 300) ? 'ERROR' : 'INFO');

    if ($responseBody === false) {
        return [false, $httpCode, 'STREAM_REQUEST_FAILED', ''];
    }
    return [(string)$responseBody, $httpCode, '', (string)$responseBody];
}

function push_subscription_endpoint_hash($endpoint) {
    return hash('sha256', trim((string)$endpoint));
}

function push_upsert_subscription($db, $userId, $endpoint, $p256dh, $auth, $userAgent = '') {
    if (!$db) return 0;
    $endpointText = trim((string)$endpoint);
    $p256dhText = trim((string)$p256dh);
    $authText = trim((string)$auth);
    if ($endpointText === '' || $p256dhText === '' || $authText === '') {
        return 0;
    }
    $endpointHash = push_subscription_endpoint_hash($endpointText);

    $existingStmt = $db->prepare("SELECT id FROM push_subscriptions WHERE endpoint_hash = ? LIMIT 1");
    $existingStmt->execute([$endpointHash]);
    $existing = $existingStmt->fetch();
    if ($existing) {
        $update = $db->prepare("UPDATE push_subscriptions SET user_id = ?, endpoint = ?, p256dh = ?, auth = ?, user_agent = ?, is_active = 1, last_seen_at = NOW(), last_error = NULL, last_http_code = NULL WHERE id = ?");
        $update->execute([
            $userId !== '' ? $userId : null,
            $endpointText,
            $p256dhText,
            $authText,
            trim((string)$userAgent),
            (int)$existing['id']
        ]);
        return (int)$existing['id'];
    }

    $insert = $db->prepare("INSERT INTO push_subscriptions (user_id, endpoint, endpoint_hash, p256dh, auth, user_agent, is_active, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, 1, NOW())");
    $insert->execute([
        $userId !== '' ? $userId : null,
        $endpointText,
        $endpointHash,
        $p256dhText,
        $authText,
        trim((string)$userAgent)
    ]);
    return (int)$db->lastInsertId();
}

function insert_user_notification($db, $userId, $title, $message, $url = '', $type = 'system', $campaignId = null) {
    if (!$db) return 0;
    $uid = trim((string)$userId);
    if ($uid === '') return 0;
    $safeTitle = trim((string)$title);
    $safeMessage = trim((string)$message);
    if ($safeTitle === '' || $safeMessage === '') {
        return 0;
    }
    if (function_exists('mb_substr')) {
        $safeTitle = mb_substr($safeTitle, 0, 180, 'UTF-8');
        $safeMessage = mb_substr($safeMessage, 0, 2000, 'UTF-8');
    } else {
        $safeTitle = substr($safeTitle, 0, 180);
        $safeMessage = substr($safeMessage, 0, 2000);
    }
    $safeType = strtolower(trim((string)$type));
    if (!in_array($safeType, ['offer', 'order', 'system'], true)) {
        $safeType = 'system';
    }

    $stmt = $db->prepare("INSERT INTO notifications (user_id, title, message, url, type, campaign_id, is_read) VALUES (?, ?, ?, ?, ?, ?, 0)");
    $stmt->execute([
        $uid,
        $safeTitle,
        $safeMessage,
        trim((string)$url),
        $safeType,
        $campaignId !== null ? (int)$campaignId : null
    ]);
    return (int)$db->lastInsertId();
}

function enqueue_push_send_job($db, $payload) {
    if (!$db || !is_array($payload)) {
        return 0;
    }
    if (!PUSH_ENABLED) {
        splaro_integration_trace('push.queue.insert.skipped', ['reason' => 'PUSH_DISABLED'], 'WARNING');
        return 0;
    }
    $normalized = [
        'subscription_id' => (int)($payload['subscription_id'] ?? 0),
        'user_id' => (string)($payload['user_id'] ?? ''),
        'endpoint' => (string)($payload['endpoint'] ?? ''),
        'title' => (string)($payload['title'] ?? ''),
        'message' => (string)($payload['message'] ?? ''),
        'url' => (string)($payload['url'] ?? ''),
        'type' => (string)($payload['type'] ?? 'system'),
        'campaign_id' => isset($payload['campaign_id']) ? (int)$payload['campaign_id'] : null,
        'notification_id' => isset($payload['notification_id']) ? (int)$payload['notification_id'] : null,
        'queued_at' => date('c')
    ];
    $payloadJson = json_encode($normalized, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if (!is_string($payloadJson) || $payloadJson === '') {
        splaro_integration_trace('push.queue.payload_encode_failed', [
            'json_error' => json_last_error_msg(),
            'subscription_id' => (int)$normalized['subscription_id']
        ], 'ERROR');
        return 0;
    }
    $maxAttempts = (int)PUSH_MAX_RETRIES;
    if ($maxAttempts < 1) $maxAttempts = 1;
    if ($maxAttempts > 3) $maxAttempts = 3;

    $stmt = $db->prepare("INSERT INTO sync_queue (sync_type, payload_json, status, attempts, max_attempts, next_attempt_at) VALUES (?, ?, 'PENDING', 0, ?, NOW())");
    $stmt->execute([push_queue_sync_type(), $payloadJson, $maxAttempts]);
    return (int)$db->lastInsertId();
}

function queue_push_for_user($db, $userId, $title, $message, $url = '', $type = 'system', $campaignId = null) {
    $result = [
        'notification_id' => 0,
        'subscription_count' => 0,
        'queued_jobs' => 0
    ];
    if (!$db) {
        return $result;
    }
    $uid = trim((string)$userId);
    if ($uid === '') {
        return $result;
    }

    try {
        $notificationId = insert_user_notification($db, $uid, $title, $message, $url, $type, $campaignId);
        $result['notification_id'] = $notificationId;
    } catch (Exception $e) {
        splaro_log_exception('push.queue.user_notification_insert', $e, ['user_id' => $uid]);
    }

    try {
        $subsStmt = $db->prepare("SELECT id, user_id, endpoint FROM push_subscriptions WHERE is_active = 1 AND user_id = ?");
        $subsStmt->execute([$uid]);
        $subscriptions = $subsStmt->fetchAll();
        $result['subscription_count'] = is_array($subscriptions) ? count($subscriptions) : 0;
        foreach ($subscriptions as $subscription) {
            $queueId = enqueue_push_send_job($db, [
                'subscription_id' => (int)($subscription['id'] ?? 0),
                'user_id' => $uid,
                'endpoint' => (string)($subscription['endpoint'] ?? ''),
                'title' => (string)$title,
                'message' => (string)$message,
                'url' => (string)$url,
                'type' => (string)$type,
                'campaign_id' => $campaignId !== null ? (int)$campaignId : null,
                'notification_id' => (int)$result['notification_id']
            ]);
            if ($queueId > 0) {
                $result['queued_jobs']++;
            }
        }
    } catch (Exception $e) {
        splaro_log_exception('push.queue.subscription_fetch_or_insert', $e, ['user_id' => $uid]);
    }

    if ($result['queued_jobs'] > 0) {
        schedule_push_queue_drain($db);
    }
    return $result;
}

function queue_order_created_notification($db, $orderId, $userId, $totalAmount = 0) {
    $uid = trim((string)$userId);
    if ($uid === '' || !$db) {
        return ['notification_id' => 0, 'subscription_count' => 0, 'queued_jobs' => 0];
    }
    $title = 'Order Confirmed';
    $message = 'Order #' . trim((string)$orderId) . ' placed successfully. Total ৳' . (int)$totalAmount . '.';
    return queue_push_for_user($db, $uid, $title, $message, '/order-tracking', 'order', null);
}

function queue_signup_notification($db, $userId, $name = '') {
    $uid = trim((string)$userId);
    if ($uid === '' || !$db) {
        return ['notification_id' => 0, 'subscription_count' => 0, 'queued_jobs' => 0];
    }
    $displayName = trim((string)$name);
    if ($displayName === '') {
        $displayName = 'there';
    }
    $title = 'Welcome to SPLARO';
    $message = 'Hi ' . $displayName . ', your account is ready. Start exploring premium collections.';
    return queue_push_for_user($db, $uid, $title, $message, '/shop', 'system', null);
}

function queue_order_status_notification($db, $orderId, $statusLabel) {
    if (!$db) {
        return ['notification_id' => 0, 'subscription_count' => 0, 'queued_jobs' => 0];
    }
    $orderIdentifier = trim((string)$orderId);
    if ($orderIdentifier === '') {
        return ['notification_id' => 0, 'subscription_count' => 0, 'queued_jobs' => 0];
    }
    try {
        $stmt = $db->prepare("SELECT id, user_id FROM orders WHERE id = ? LIMIT 1");
        $stmt->execute([$orderIdentifier]);
        $order = $stmt->fetch();
        if (!$order || trim((string)($order['user_id'] ?? '')) === '') {
            return ['notification_id' => 0, 'subscription_count' => 0, 'queued_jobs' => 0];
        }
        $title = 'Order Status Updated';
        $message = 'Order #' . $orderIdentifier . ' is now ' . trim((string)$statusLabel) . '.';
        return queue_push_for_user($db, (string)$order['user_id'], $title, $message, '/order-tracking', 'order', null);
    } catch (Exception $e) {
        splaro_log_exception('order.status.push.queue', $e, [
            'order_id' => (string)$orderIdentifier,
            'status' => (string)$statusLabel
        ], 'WARNING');
    }
    return ['notification_id' => 0, 'subscription_count' => 0, 'queued_jobs' => 0];
}

function campaign_target_type_normalize($targetType) {
    $normalized = strtolower(trim((string)$targetType));
    $allowed = [
        'all_users',
        'subscribed_users',
        'bought_category',
        'bought_last_30_days',
        'inactive_60_days'
    ];
    if (!in_array($normalized, $allowed, true)) {
        return 'all_users';
    }
    return $normalized;
}

function campaign_resolve_user_ids($db, $targetType, $filters = []) {
    if (!$db) return [];
    $target = campaign_target_type_normalize($targetType);
    $resolved = [];
    try {
        if ($target === 'all_users') {
            $stmt = $db->query("SELECT id FROM users ORDER BY created_at DESC");
            foreach ($stmt->fetchAll() as $row) {
                $id = trim((string)($row['id'] ?? ''));
                if ($id !== '') $resolved[] = $id;
            }
        } elseif ($target === 'subscribed_users') {
            $stmt = $db->query("SELECT DISTINCT user_id FROM push_subscriptions WHERE is_active = 1 AND user_id IS NOT NULL AND user_id <> ''");
            foreach ($stmt->fetchAll() as $row) {
                $id = trim((string)($row['user_id'] ?? ''));
                if ($id !== '') $resolved[] = $id;
            }
        } elseif ($target === 'bought_category') {
            $category = trim((string)($filters['category'] ?? $filters['category_x'] ?? ''));
            if ($category !== '') {
                $needle = '%"category":"' . str_replace('%', '\\%', str_replace('_', '\\_', $category)) . '"%';
                $stmt = $db->prepare("SELECT DISTINCT user_id FROM orders WHERE user_id IS NOT NULL AND user_id <> '' AND items LIKE ?");
                $stmt->execute([$needle]);
                foreach ($stmt->fetchAll() as $row) {
                    $id = trim((string)($row['user_id'] ?? ''));
                    if ($id !== '') $resolved[] = $id;
                }
            }
        } elseif ($target === 'bought_last_30_days') {
            $days = (int)($filters['days'] ?? 30);
            if ($days < 1) $days = 30;
            if ($days > 365) $days = 365;
            $threshold = date('Y-m-d H:i:s', time() - ($days * 86400));
            $stmt = $db->prepare("SELECT DISTINCT user_id FROM orders WHERE user_id IS NOT NULL AND user_id <> '' AND created_at >= ?");
            $stmt->execute([$threshold]);
            foreach ($stmt->fetchAll() as $row) {
                $id = trim((string)($row['user_id'] ?? ''));
                if ($id !== '') $resolved[] = $id;
            }
        } elseif ($target === 'inactive_60_days') {
            $days = (int)($filters['days'] ?? 60);
            if ($days < 1) $days = 60;
            if ($days > 365) $days = 365;
            $threshold = date('Y-m-d H:i:s', time() - ($days * 86400));
            $stmt = $db->prepare("SELECT u.id FROM users u LEFT JOIN orders o ON o.user_id = u.id AND o.created_at >= ? WHERE o.id IS NULL");
            $stmt->execute([$threshold]);
            foreach ($stmt->fetchAll() as $row) {
                $id = trim((string)($row['id'] ?? ''));
                if ($id !== '') $resolved[] = $id;
            }
        }
    } catch (Exception $e) {
        splaro_log_exception('campaign.resolve_user_ids', $e, [
            'target_type' => (string)$target
        ]);
        return [];
    }
    return array_values(array_unique($resolved));
}

function campaign_resolve_subscriptions($db, $targetType, $userIds = []) {
    if (!$db) return [];
    $target = campaign_target_type_normalize($targetType);
    if ($target === 'subscribed_users') {
        try {
            $stmt = $db->query("SELECT id, user_id, endpoint FROM push_subscriptions WHERE is_active = 1 ORDER BY id DESC");
            $rows = $stmt->fetchAll();
            return is_array($rows) ? $rows : [];
        } catch (Exception $e) {
            splaro_log_exception('campaign.resolve_subscriptions.all', $e);
            return [];
        }
    }
    if (!is_array($userIds) || empty($userIds)) {
        return [];
    }

    $results = [];
    $chunkSize = 250;
    $chunks = array_chunk(array_values(array_unique($userIds)), $chunkSize);
    foreach ($chunks as $chunk) {
        if (empty($chunk)) continue;
        $placeholders = implode(', ', array_fill(0, count($chunk), '?'));
        try {
            $stmt = $db->prepare("SELECT id, user_id, endpoint FROM push_subscriptions WHERE is_active = 1 AND user_id IN ({$placeholders}) ORDER BY id DESC");
            $stmt->execute($chunk);
            $rows = $stmt->fetchAll();
            if (is_array($rows)) {
                foreach ($rows as $row) {
                    $results[] = $row;
                }
            }
        } catch (Exception $e) {
            splaro_log_exception('campaign.resolve_subscriptions.chunk', $e, [
                'chunk_size' => count($chunk)
            ]);
        }
    }
    return $results;
}

function campaign_dispatch_to_queue($db, $campaignId, $campaignPayload) {
    $result = [
        'user_count' => 0,
        'subscription_count' => 0,
        'queued_jobs' => 0,
        'notifications_created' => 0
    ];
    if (!$db || !is_array($campaignPayload)) {
        return $result;
    }
    splaro_integration_trace('campaign.dispatch.start', [
        'campaign_id' => (int)$campaignId
    ]);

    $targetType = campaign_target_type_normalize((string)($campaignPayload['target_type'] ?? 'all_users'));
    $filters = safe_json_decode_assoc($campaignPayload['filters_json'] ?? '{}', []);
    $title = trim((string)($campaignPayload['title'] ?? ''));
    $message = trim((string)($campaignPayload['message'] ?? ''));
    $url = trim((string)($filters['url'] ?? $campaignPayload['url'] ?? ''));
    if ($title === '' || $message === '') {
        return $result;
    }

    $userIds = campaign_resolve_user_ids($db, $targetType, $filters);
    $result['user_count'] = count($userIds);

    $notificationStmt = null;
    if (!empty($userIds)) {
        try {
            $notificationStmt = $db->prepare("INSERT INTO notifications (user_id, title, message, url, type, campaign_id, is_read) VALUES (?, ?, ?, ?, 'offer', ?, 0)");
        } catch (Exception $e) {
            splaro_log_exception('campaign.dispatch.notification_prepare', $e, ['campaign_id' => (int)$campaignId]);
        }
    }
    if ($notificationStmt) {
        foreach ($userIds as $uid) {
            try {
                $notificationStmt->execute([(string)$uid, $title, $message, $url, (int)$campaignId]);
                $result['notifications_created']++;
            } catch (Exception $e) {
                splaro_log_exception('campaign.dispatch.notification_insert', $e, [
                    'campaign_id' => (int)$campaignId,
                    'user_id' => (string)$uid
                ]);
            }
        }
    }

    $subscriptions = campaign_resolve_subscriptions($db, $targetType, $userIds);
    $result['subscription_count'] = is_array($subscriptions) ? count($subscriptions) : 0;

    foreach ($subscriptions as $subscription) {
        $queueId = 0;
        try {
            $queueId = enqueue_push_send_job($db, [
                'subscription_id' => (int)($subscription['id'] ?? 0),
                'user_id' => (string)($subscription['user_id'] ?? ''),
                'endpoint' => (string)($subscription['endpoint'] ?? ''),
                'title' => $title,
                'message' => $message,
                'url' => $url,
                'type' => 'offer',
                'campaign_id' => (int)$campaignId
            ]);
        } catch (Exception $e) {
            splaro_log_exception('campaign.dispatch.queue_insert', $e, [
                'campaign_id' => (int)$campaignId,
                'subscription_id' => (int)($subscription['id'] ?? 0)
            ]);
        }
        if ($queueId > 0) {
            $result['queued_jobs']++;
        }
    }

    if ($result['queued_jobs'] > 0) {
        schedule_push_queue_drain($db);
    }

    splaro_integration_trace('campaign.dispatch.done', [
        'campaign_id' => (int)$campaignId,
        'result' => $result
    ]);

    return $result;
}

function process_due_campaigns($db, $limit = 3) {
    $result = [
        'processed' => 0,
        'queued_jobs' => 0
    ];
    if (!$db) {
        return $result;
    }
    $max = (int)$limit;
    if ($max < 1) $max = 1;
    if ($max > 20) $max = 20;

    try {
        $stmt = $db->prepare("SELECT id, title, message, target_type, filters_json, scheduled_at FROM campaigns WHERE status = 'scheduled' AND scheduled_at IS NOT NULL AND scheduled_at <= NOW() ORDER BY scheduled_at ASC LIMIT ?");
        $stmt->bindValue(1, $max, PDO::PARAM_INT);
        $stmt->execute();
        $campaigns = $stmt->fetchAll();
    } catch (Exception $e) {
        splaro_log_exception('campaign.process_due.read', $e);
        return $result;
    }

    foreach ($campaigns as $campaign) {
        $campaignId = (int)($campaign['id'] ?? 0);
        if ($campaignId <= 0) {
            continue;
        }
        try {
            $claim = $db->prepare("UPDATE campaigns SET status = 'sending' WHERE id = ? AND status = 'scheduled'");
            $claim->execute([$campaignId]);
            if ($claim->rowCount() < 1) {
                continue;
            }
            $dispatch = campaign_dispatch_to_queue($db, $campaignId, $campaign);
            $done = $db->prepare("UPDATE campaigns SET status = 'sent', updated_at = NOW() WHERE id = ?");
            $done->execute([$campaignId]);
            $result['processed']++;
            $result['queued_jobs'] += (int)($dispatch['queued_jobs'] ?? 0);
        } catch (Exception $e) {
            splaro_log_exception('campaign.process_due.dispatch', $e, ['campaign_id' => $campaignId]);
            try {
                $db->prepare("UPDATE campaigns SET status = 'scheduled', updated_at = NOW() WHERE id = ?")->execute([$campaignId]);
            } catch (Exception $inner) {
                splaro_log_exception('campaign.process_due.restore_status', $inner, ['campaign_id' => $campaignId], 'WARNING');
            }
        }
    }
    return $result;
}

function log_campaign_delivery($db, $campaignId, $subscriptionId, $status, $errorMessage = null) {
    if (!$db || (int)$campaignId <= 0) {
        return;
    }
    try {
        $stmt = $db->prepare("INSERT INTO campaign_logs (campaign_id, subscription_id, status, error_message, sent_at, created_at) VALUES (?, ?, ?, ?, ?, NOW())");
        $normalizedStatus = strtolower(trim((string)$status));
        if (!in_array($normalizedStatus, ['sent', 'failed', 'clicked'], true)) {
            $normalizedStatus = 'failed';
        }
        $sentAt = $normalizedStatus === 'sent' ? date('Y-m-d H:i:s') : null;
        $stmt->execute([
            (int)$campaignId,
            $subscriptionId !== null ? (int)$subscriptionId : null,
            $normalizedStatus,
            $errorMessage !== null ? (string)$errorMessage : null,
            $sentAt
        ]);
    } catch (Exception $e) {
        splaro_log_exception('campaign.log_delivery', $e, [
            'campaign_id' => (int)$campaignId,
            'subscription_id' => $subscriptionId !== null ? (int)$subscriptionId : null,
            'status' => (string)$status
        ], 'WARNING');
    }
}

function perform_push_queue_request($payload) {
    if (!is_array($payload)) {
        return [
            'ok' => false,
            'http_code' => 0,
            'error' => 'INVALID_PAYLOAD',
            'response' => '',
            'transient' => false,
            'invalid_endpoint' => false
        ];
    }
    $endpoint = trim((string)($payload['endpoint'] ?? ''));
    if ($endpoint === '') {
        return [
            'ok' => false,
            'http_code' => 0,
            'error' => 'ENDPOINT_MISSING',
            'response' => '',
            'transient' => false,
            'invalid_endpoint' => false
        ];
    }
    if (!PUSH_ENABLED) {
        return [
            'ok' => false,
            'http_code' => 0,
            'error' => 'PUSH_DISABLED',
            'response' => '',
            'transient' => false,
            'invalid_endpoint' => false
        ];
    }

    $audience = push_extract_audience($endpoint);
    if ($audience === '') {
        return [
            'ok' => false,
            'http_code' => 0,
            'error' => 'INVALID_ENDPOINT_AUDIENCE',
            'response' => '',
            'transient' => false,
            'invalid_endpoint' => false
        ];
    }

    $jwt = push_build_vapid_jwt($audience);
    if ($jwt === '') {
        return [
            'ok' => false,
            'http_code' => 0,
            'error' => 'VAPID_JWT_FAILED',
            'response' => '',
            'transient' => false,
            'invalid_endpoint' => false
        ];
    }

    $publicKey = trim((string)PUSH_VAPID_PUBLIC_KEY);
    $headers = [
        'TTL: 60',
        'Urgency: normal',
        'Authorization: vapid t=' . $jwt . ', k=' . $publicKey,
        'Crypto-Key: p256ecdsa=' . $publicKey,
        'Content-Length: 0'
    ];

    [$response, $httpCode, $requestError, $responseText] = push_api_request($endpoint, $headers, 8);

    if (is_string($responseText) && trim($responseText) !== '') {
        $decoded = json_decode($responseText, true);
        if ($decoded === null && json_last_error() !== JSON_ERROR_NONE) {
            splaro_integration_trace('push.http.response_decode_failed', [
                'http_code' => (int)$httpCode,
                'json_error' => json_last_error_msg(),
                'response_preview' => splaro_clip_text($responseText, 300)
            ], 'ERROR');
        }
    }

    $ok = $response !== false && (int)$httpCode >= 200 && (int)$httpCode < 300;
    if ($ok) {
        return [
            'ok' => true,
            'http_code' => (int)$httpCode,
            'error' => '',
            'response' => is_string($responseText) ? $responseText : '',
            'transient' => false,
            'invalid_endpoint' => false
        ];
    }

    $errorText = trim((string)$requestError);
    if ($errorText === '') {
        $errorText = 'HTTP_' . (int)$httpCode;
    }
    return [
        'ok' => false,
        'http_code' => (int)$httpCode,
        'error' => $errorText,
        'response' => is_string($responseText) ? $responseText : '',
        'transient' => push_is_transient_failure((int)$httpCode, $errorText),
        'invalid_endpoint' => in_array((int)$httpCode, [404, 410], true)
    ];
}

function process_push_queue($db, $limit = 25) {
    $result = [
        'processed' => 0,
        'success' => 0,
        'failed' => 0,
        'retried' => 0,
        'dead' => 0,
        'paused' => false,
        'reason' => ''
    ];
    splaro_integration_trace('push.queue.process.start', [
        'limit' => (int)$limit,
        'db_available' => (bool)$db,
        'push_enabled' => PUSH_ENABLED
    ]);
    if (!$db) {
        $result['paused'] = true;
        $result['reason'] = 'DB_UNAVAILABLE';
        splaro_integration_trace('push.queue.process.paused', $result, 'WARNING');
        return $result;
    }
    if (!PUSH_ENABLED) {
        $result['paused'] = true;
        $result['reason'] = 'PUSH_DISABLED';
        splaro_integration_trace('push.queue.process.paused', $result, 'WARNING');
        return $result;
    }

    $batchLimit = (int)$limit;
    if ($batchLimit < 1) $batchLimit = 1;
    if ($batchLimit > 200) $batchLimit = 200;
    try {
        $stmt = $db->prepare("SELECT id, sync_type, payload_json, attempts, max_attempts FROM sync_queue WHERE sync_type = ? AND status IN ('PENDING', 'RETRY') AND next_attempt_at <= NOW() ORDER BY id ASC LIMIT ?");
        $stmt->bindValue(1, push_queue_sync_type(), PDO::PARAM_STR);
        $stmt->bindValue(2, $batchLimit, PDO::PARAM_INT);
        $stmt->execute();
        $jobs = $stmt->fetchAll();
    } catch (Exception $e) {
        $result['paused'] = true;
        $result['reason'] = 'QUEUE_READ_FAILED';
        splaro_log_exception('push.queue.process.read', $e);
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
        $maxAttempts = (int)($job['max_attempts'] ?? PUSH_MAX_RETRIES);
        if ($maxAttempts < 1) $maxAttempts = 1;
        if ($maxAttempts > 3) $maxAttempts = 3;

        $payloadRaw = (string)($job['payload_json'] ?? '');
        $payload = json_decode($payloadRaw, true);
        if (!is_array($payload)) {
            $decodeError = json_last_error() !== JSON_ERROR_NONE ? json_last_error_msg() : 'INVALID_JSON_SHAPE';
            $db->prepare("UPDATE sync_queue SET status = 'DEAD', last_error = ?, last_http_code = 0, locked_at = NULL WHERE id = ?")
               ->execute(['INVALID_PAYLOAD_JSON: ' . $decodeError, $jobId]);
            $result['failed']++;
            $result['dead']++;
            splaro_integration_trace('push.queue.payload_decode_failed', [
                'job_id' => $jobId,
                'json_error' => $decodeError,
                'payload_preview' => splaro_clip_text($payloadRaw, 280)
            ], 'ERROR');
            continue;
        }

        $subscriptionId = (int)($payload['subscription_id'] ?? 0);
        if ($subscriptionId > 0) {
            try {
                $subStmt = $db->prepare("SELECT is_active FROM push_subscriptions WHERE id = ? LIMIT 1");
                $subStmt->execute([$subscriptionId]);
                $subRow = $subStmt->fetch();
                if (!$subRow || (int)($subRow['is_active'] ?? 0) !== 1) {
                    $db->prepare("UPDATE sync_queue SET status = 'DEAD', last_error = ?, last_http_code = 0, locked_at = NULL WHERE id = ?")
                       ->execute(['SUBSCRIPTION_INACTIVE', $jobId]);
                    $result['failed']++;
                    $result['dead']++;
                    continue;
                }
            } catch (Exception $e) {
                splaro_log_exception('push.queue.subscription_active_check', $e, [
                    'job_id' => $jobId,
                    'subscription_id' => $subscriptionId
                ], 'WARNING');
            }
        }

        $dispatch = perform_push_queue_request($payload);
        $campaignId = (int)($payload['campaign_id'] ?? 0);

        if (!empty($dispatch['ok'])) {
            $db->prepare("UPDATE sync_queue SET status = 'SUCCESS', last_error = NULL, last_http_code = ?, locked_at = NULL, next_attempt_at = NOW() WHERE id = ?")
               ->execute([(int)($dispatch['http_code'] ?? 0), $jobId]);
            if ($subscriptionId > 0) {
                $db->prepare("UPDATE push_subscriptions SET is_active = 1, failure_count = 0, last_error = NULL, last_http_code = ?, last_failure_at = NULL, last_seen_at = NOW() WHERE id = ?")
                   ->execute([(int)($dispatch['http_code'] ?? 0), $subscriptionId]);
            }
            if ($campaignId > 0) {
                log_campaign_delivery($db, $campaignId, $subscriptionId > 0 ? $subscriptionId : null, 'sent', null);
            }
            $result['success']++;
            continue;
        }

        $result['failed']++;
        $lastError = (string)($dispatch['error'] ?? 'PUSH_SEND_FAILED');
        $httpCode = (int)($dispatch['http_code'] ?? 0);
        $isTransient = !empty($dispatch['transient']);
        $isInvalidEndpoint = !empty($dispatch['invalid_endpoint']);

        if ($subscriptionId > 0) {
            $disable = $isInvalidEndpoint ? 0 : 1;
            $db->prepare("UPDATE push_subscriptions SET is_active = ?, failure_count = failure_count + 1, last_http_code = ?, last_error = ?, last_failure_at = NOW(), last_seen_at = NOW() WHERE id = ?")
               ->execute([$disable, $httpCode, $lastError, $subscriptionId]);
        }

        $shouldRetry = $isTransient && !$isInvalidEndpoint && $attemptsNow < $maxAttempts;
        if ($shouldRetry) {
            $delay = calculate_sync_retry_delay($attemptsNow);
            $retry = $db->prepare("UPDATE sync_queue SET status = 'RETRY', last_error = ?, last_http_code = ?, locked_at = NULL, next_attempt_at = DATE_ADD(NOW(), INTERVAL ? SECOND) WHERE id = ?");
            $retry->bindValue(1, $lastError, PDO::PARAM_STR);
            $retry->bindValue(2, $httpCode, PDO::PARAM_INT);
            $retry->bindValue(3, (int)$delay, PDO::PARAM_INT);
            $retry->bindValue(4, $jobId, PDO::PARAM_INT);
            $retry->execute();
            $result['retried']++;
            continue;
        }

        $db->prepare("UPDATE sync_queue SET status = 'DEAD', last_error = ?, last_http_code = ?, locked_at = NULL WHERE id = ?")
           ->execute([$lastError, $httpCode, $jobId]);
        if ($campaignId > 0) {
            log_campaign_delivery($db, $campaignId, $subscriptionId > 0 ? $subscriptionId : null, 'failed', $lastError);
        }
        $result['dead']++;
        log_system_event(
            $db,
            'PUSH_DELIVERY_FAILED',
            "Dead-letter push job {$jobId} failed after {$attemptsNow} attempts: {$lastError}",
            null,
            $_SERVER['REMOTE_ADDR'] ?? 'SERVER'
        );
    }
    splaro_integration_trace('push.queue.process.done', $result);
    return $result;
}

function schedule_push_queue_drain($db) {
    static $scheduled = false;
    if ($scheduled || !$db) {
        return;
    }
    $scheduled = true;
    register_shutdown_function(function () use ($db) {
        try {
            if (function_exists('fastcgi_finish_request')) {
                @fastcgi_finish_request();
            }
        } catch (Exception $e) {
            splaro_log_exception('push.queue.shutdown.fastcgi_finish_request', $e, [], 'WARNING');
        }
        $dueCampaigns = process_due_campaigns($db, 3);
        splaro_integration_trace('campaign.queue.shutdown.due_processed', $dueCampaigns);
        $pushLimit = defined('PUSH_BATCH_LIMIT') ? (int)PUSH_BATCH_LIMIT : 25;
        if ($pushLimit < 1) $pushLimit = 25;
        $pushResult = process_push_queue($db, $pushLimit);
        splaro_integration_trace('push.queue.shutdown.drain_done', $pushResult);
    });
}

function read_request_json_payload($stage = 'request.payload') {
    $raw = file_get_contents('php://input');
    $decoded = json_decode((string)$raw, true);
    if ($decoded === null && json_last_error() !== JSON_ERROR_NONE) {
        splaro_integration_trace($stage . '.decode_failed', [
            'json_error' => json_last_error_msg(),
            'body_preview' => splaro_clip_text($raw, 320)
        ], 'ERROR');
    }
    return [is_array($decoded) ? $decoded : [], (string)$raw];
}

function require_campaign_write_access($authUser) {
    require_admin_access($authUser);
    if (is_array($authUser)) {
        $roleBucket = admin_role_bucket(get_admin_role($authUser));
        if (!in_array($roleBucket, ['OWNER', 'STAFF'], true)) {
            http_response_code(403);
            echo json_encode(["status" => "error", "message" => "CAMPAIGN_WRITE_ACCESS_REQUIRED"]);
            exit;
        }
    }
}

if ($method === 'GET' && $action === 'health') {
    require_admin_access($requestAuthUser);

    $dbPingOk = false;
    $dbLatencyMs = null;
    $dbPingError = '';
    $ordersOk = false;
    $ordersError = '';
    $ordersLatencyMs = 0;
    $authOk = false;
    $authError = '';
    $authLatencyMs = 0;
    $activePushSubscriptions = 0;
    $scheduledCampaigns = 0;
    $dbRuntimeMetrics = get_db_runtime_metrics($db);
    $latestProbeMap = health_latest_probe_map($db);
    $checkedAt = date('c');

    $pingStartedAt = microtime(true);
    try {
        $pingStmt = $db->query('SELECT 1');
        $pingStmt->fetchColumn();
        $dbPingOk = true;
    } catch (Throwable $e) {
        $dbPingError = splaro_redact_sensitive_text((string)$e->getMessage());
        $dbPingOk = false;
        splaro_log_exception('health.db.ping', $e, [], 'WARNING');
    }
    $dbLatencyMs = (int)round((microtime(true) - $pingStartedAt) * 1000);

    $ordersStartedAt = microtime(true);
    try {
        $db->query("SELECT COUNT(*) FROM orders")->fetchColumn();
        $ordersOk = true;
    } catch (Throwable $e) {
        $ordersOk = false;
        $ordersError = splaro_redact_sensitive_text((string)$e->getMessage());
        splaro_log_exception('health.orders.ping', $e, [], 'WARNING');
    }
    $ordersLatencyMs = (int)round((microtime(true) - $ordersStartedAt) * 1000);

    $authStartedAt = microtime(true);
    try {
        $userCount = (int)$db->query("SELECT COUNT(*) FROM users")->fetchColumn();
        if ($userCount < 1) {
            throw new RuntimeException('AUTH_NO_USERS_FOUND');
        }
        if (trim((string)APP_AUTH_SECRET) === '') {
            throw new RuntimeException('APP_AUTH_SECRET_MISSING');
        }
        $authOk = true;
    } catch (Throwable $e) {
        $authOk = false;
        $authError = splaro_redact_sensitive_text((string)$e->getMessage());
        splaro_log_exception('health.auth.ping', $e, [], 'WARNING');
    }
    $authLatencyMs = (int)round((microtime(true) - $authStartedAt) * 1000);

    try {
        $activePushSubscriptions = (int)$db->query("SELECT COUNT(*) FROM push_subscriptions WHERE is_active = 1")->fetchColumn();
    } catch (Throwable $e) {
        splaro_log_exception('health.push.active_subscriptions', $e, [], 'WARNING');
    }
    try {
        $scheduledCampaigns = (int)$db->query("SELECT COUNT(*) FROM campaigns WHERE status = 'scheduled'")->fetchColumn();
    } catch (Throwable $e) {
        splaro_log_exception('health.push.scheduled_campaigns', $e, [], 'WARNING');
    }

    $sheetsEnabled = trim((string)GOOGLE_SHEETS_WEBHOOK_URL) !== '';
    $queueStateLoader = function () use ($db, $sheetsEnabled) {
        $telegramQueueLocal = get_telegram_queue_summary($db);
        $pushQueueLocal = get_push_queue_summary($db);
        $sheetsQueueLocal = get_sync_queue_summary($db);

        $telegramBreakdown = queue_dead_recent_breakdown($db, 'TELEGRAM');
        $pushBreakdown = queue_dead_recent_breakdown($db, 'PUSH');
        $sheetsBreakdown = queue_dead_recent_breakdown($db, 'SHEETS');

        $telegramAffectsQueue = TELEGRAM_ENABLED || queue_summary_active_workload($telegramQueueLocal) > 0;
        $pushAffectsQueue = PUSH_ENABLED || queue_summary_active_workload($pushQueueLocal) > 0;
        $sheetsAffectsQueue = $sheetsEnabled || queue_summary_active_workload($sheetsQueueLocal) > 0;

        $queueDeadLocal = 0;
        $queueRetryLocal = 0;
        $queuePendingLocal = 0;
        $queueDeadRecentPermanentLocal = 0;
        $queueDeadRecentTransientLocal = 0;

        if ($telegramAffectsQueue) {
            $queueDeadLocal += (int)($telegramQueueLocal['dead'] ?? 0);
            $queueRetryLocal += (int)($telegramQueueLocal['retry'] ?? 0);
            $queuePendingLocal += (int)($telegramQueueLocal['pending'] ?? 0);
            $queueDeadRecentPermanentLocal += (int)($telegramBreakdown['permanent'] ?? 0);
            $queueDeadRecentTransientLocal += (int)($telegramBreakdown['transient'] ?? 0);
        }
        if ($pushAffectsQueue) {
            $queueDeadLocal += (int)($pushQueueLocal['dead'] ?? 0);
            $queueRetryLocal += (int)($pushQueueLocal['retry'] ?? 0);
            $queuePendingLocal += (int)($pushQueueLocal['pending'] ?? 0);
            $queueDeadRecentPermanentLocal += (int)($pushBreakdown['permanent'] ?? 0);
            $queueDeadRecentTransientLocal += (int)($pushBreakdown['transient'] ?? 0);
        }
        if ($sheetsAffectsQueue) {
            $queueDeadLocal += (int)($sheetsQueueLocal['dead'] ?? 0);
            $queueRetryLocal += (int)($sheetsQueueLocal['retry'] ?? 0);
            $queuePendingLocal += (int)($sheetsQueueLocal['pending'] ?? 0);
            $queueDeadRecentPermanentLocal += (int)($sheetsBreakdown['permanent'] ?? 0);
            $queueDeadRecentTransientLocal += (int)($sheetsBreakdown['transient'] ?? 0);
        }

        $queueDeadRecentLocal = $queueDeadRecentPermanentLocal + $queueDeadRecentTransientLocal;
        $queueHistoricalDeadLocal = $queueDeadLocal - $queueDeadRecentLocal;
        if ($queueHistoricalDeadLocal < 0) $queueHistoricalDeadLocal = 0;

        return [
            'telegram' => $telegramQueueLocal,
            'push' => $pushQueueLocal,
            'sheets' => $sheetsQueueLocal,
            'breakdown' => [
                'telegram' => $telegramBreakdown,
                'push' => $pushBreakdown,
                'sheets' => $sheetsBreakdown,
            ],
            'global' => [
                'dead' => (int)$queueDeadLocal,
                'retry' => (int)$queueRetryLocal,
                'pending' => (int)$queuePendingLocal,
                'dead_recent' => (int)$queueDeadRecentLocal,
                'dead_recent_permanent' => (int)$queueDeadRecentPermanentLocal,
                'dead_recent_transient' => (int)$queueDeadRecentTransientLocal,
                'dead_historical' => (int)$queueHistoricalDeadLocal
            ]
        ];
    };

    $queueAutoRecovery = [
        'attempted' => false,
        'throttled' => false,
        'result' => [
            'recovered' => 0,
            'skipped_permanent' => 0,
            'total_dead_scanned' => 0
        ],
        'processed' => [
            'campaigns' => ['processed' => 0, 'queued_jobs' => 0],
            'telegram' => ['processed' => 0, 'success' => 0, 'failed' => 0, 'retried' => 0, 'dead' => 0],
            'push' => ['processed' => 0, 'success' => 0, 'failed' => 0, 'retried' => 0, 'dead' => 0],
            'sheets' => ['processed' => 0, 'success' => 0, 'failed' => 0, 'retried' => 0, 'dead' => 0]
        ]
    ];

    $queueState = $queueStateLoader();
    $queueGlobal = is_array($queueState['global'] ?? null) ? $queueState['global'] : [];
    $needsQueueAutoRecovery = ((int)($queueGlobal['dead_recent_transient'] ?? 0) > 0) || ((int)($queueGlobal['retry'] ?? 0) > 0);
    if ($needsQueueAutoRecovery) {
        if (health_alert_rate_limited('queue_auto_recover', 90)) {
            $queueAutoRecovery['throttled'] = true;
        } else {
            $queueAutoRecovery['attempted'] = true;
            try {
                $recover = recover_dead_queue_jobs($db, [
                    'mode' => 'ALL',
                    'limit' => 300
                ]);
                $queueAutoRecovery['result'] = [
                    'recovered' => (int)($recover['recovered'] ?? 0),
                    'skipped_permanent' => (int)($recover['skipped_permanent'] ?? 0),
                    'total_dead_scanned' => (int)($recover['total_dead_scanned'] ?? 0)
                ];
                if ((int)($recover['recovered'] ?? 0) > 0 || (int)($queueGlobal['retry'] ?? 0) > 0) {
                    $queueAutoRecovery['processed']['campaigns'] = process_due_campaigns($db, 2);
                    $queueAutoRecovery['processed']['telegram'] = process_telegram_queue($db, 6);
                    $queueAutoRecovery['processed']['push'] = process_push_queue($db, 8);
                    $queueAutoRecovery['processed']['sheets'] = process_sync_queue($db, 6, true);
                }
                log_system_event(
                    $db,
                    'HEALTH_QUEUE_AUTO_RECOVERY',
                    'Auto recovery attempted from health endpoint; recovered=' . (int)($recover['recovered'] ?? 0),
                    (string)($requestAuthUser['id'] ?? $requestAuthUser['email'] ?? 'admin'),
                    $_SERVER['REMOTE_ADDR'] ?? 'SERVER'
                );
            } catch (Throwable $e) {
                splaro_log_exception('health.queue.auto_recovery', $e, [], 'WARNING');
            }
            $queueState = $queueStateLoader();
        }
    }

    $telegramQueue = is_array($queueState['telegram'] ?? null) ? $queueState['telegram'] : [];
    $pushQueue = is_array($queueState['push'] ?? null) ? $queueState['push'] : [];
    $sheetsQueue = is_array($queueState['sheets'] ?? null) ? $queueState['sheets'] : [];
    $queueBreakdown = is_array($queueState['breakdown'] ?? null) ? $queueState['breakdown'] : [];
    $telegramDeadBreakdown = is_array($queueBreakdown['telegram'] ?? null) ? $queueBreakdown['telegram'] : [];
    $pushDeadBreakdown = is_array($queueBreakdown['push'] ?? null) ? $queueBreakdown['push'] : [];
    $sheetsDeadBreakdown = is_array($queueBreakdown['sheets'] ?? null) ? $queueBreakdown['sheets'] : [];

    $queueGlobal = is_array($queueState['global'] ?? null) ? $queueState['global'] : [];
    $queueDead = (int)($queueGlobal['dead'] ?? 0);
    $queueDeadRecent = (int)($queueGlobal['dead_recent'] ?? 0);
    $queueDeadRecentPermanent = (int)($queueGlobal['dead_recent_permanent'] ?? 0);
    $queueDeadRecentTransient = (int)($queueGlobal['dead_recent_transient'] ?? 0);
    $queueHistoricalDead = (int)($queueGlobal['dead_historical'] ?? 0);
    $queueRetry = (int)($queueGlobal['retry'] ?? 0);
    $queuePending = (int)($queueGlobal['pending'] ?? 0);

    $queueStatus = 'OK';
    $queueError = '';
    if ($queueDeadRecentPermanent > 0) {
        $queueStatus = 'DOWN';
        $queueError = 'QUEUE_DEAD_JOBS_PRESENT';
    } elseif ($queueDeadRecentTransient > 0) {
        $queueStatus = 'WARNING';
        $queueError = 'QUEUE_DEAD_TRANSIENT_PRESENT';
    } elseif ($queueHistoricalDead >= (int)HEALTH_QUEUE_HISTORICAL_WARN_THRESHOLD) {
        $queueStatus = 'WARNING';
        $queueError = 'QUEUE_HISTORICAL_DEAD_JOBS_PRESENT';
    } elseif ($queueRetry > 0 || $queuePending > 250) {
        $queueStatus = 'WARNING';
        $queueError = $queueRetry > 0 ? 'QUEUE_RETRY_JOBS_PRESENT' : 'QUEUE_PENDING_BACKLOG_HIGH';
    }

    $telegramDead = (int)($telegramQueue['dead'] ?? 0);
    $telegramDeadRecentPermanent = (int)($telegramDeadBreakdown['permanent'] ?? 0);
    $telegramDeadRecentTransient = (int)($telegramDeadBreakdown['transient'] ?? 0);
    $telegramDeadRecent = $telegramDeadRecentPermanent + $telegramDeadRecentTransient;
    $telegramHistoricalDead = $telegramDead - $telegramDeadRecent;
    if ($telegramHistoricalDead < 0) $telegramHistoricalDead = 0;
    $telegramStatus = TELEGRAM_ENABLED ? 'OK' : 'WARNING';
    $telegramError = '';
    if (!TELEGRAM_ENABLED) {
        $telegramError = 'TELEGRAM_DISABLED';
    } elseif ($telegramDeadRecentPermanent > 0) {
        $telegramStatus = 'DOWN';
        $telegramError = 'TELEGRAM_QUEUE_DEAD_PRESENT';
    } elseif ($telegramDeadRecentTransient > 0) {
        $telegramStatus = 'WARNING';
        $telegramError = 'TELEGRAM_QUEUE_DEAD_TRANSIENT_PRESENT';
    } elseif ($telegramHistoricalDead >= (int)HEALTH_QUEUE_HISTORICAL_WARN_THRESHOLD) {
        $telegramStatus = 'WARNING';
        $telegramError = 'TELEGRAM_QUEUE_HISTORICAL_DEAD_PRESENT';
    } elseif ((int)($telegramQueue['retry'] ?? 0) > 0) {
        $telegramStatus = 'WARNING';
        $telegramError = 'TELEGRAM_QUEUE_RETRY_PRESENT';
    }

    $sheetsCircuit = is_array($sheetsQueue['circuit'] ?? null) ? $sheetsQueue['circuit'] : ['open' => false];
    $sheetsDead = (int)($sheetsQueue['dead'] ?? 0);
    $sheetsDeadRecentPermanent = (int)($sheetsDeadBreakdown['permanent'] ?? 0);
    $sheetsDeadRecentTransient = (int)($sheetsDeadBreakdown['transient'] ?? 0);
    $sheetsDeadRecent = $sheetsDeadRecentPermanent + $sheetsDeadRecentTransient;
    $sheetsHistoricalDead = $sheetsDead - $sheetsDeadRecent;
    if ($sheetsHistoricalDead < 0) $sheetsHistoricalDead = 0;
    $sheetsStatus = $sheetsEnabled ? 'OK' : 'WARNING';
    $sheetsError = '';
    if (!$sheetsEnabled) {
        $sheetsError = 'SHEETS_DISABLED';
    } elseif (!empty($sheetsCircuit['open'])) {
        $sheetsStatus = 'DOWN';
        $sheetsError = (string)($sheetsCircuit['last_error'] ?? 'SHEETS_CIRCUIT_OPEN');
    } elseif ($sheetsDeadRecentPermanent > 0) {
        $sheetsStatus = 'DOWN';
        $sheetsError = 'SHEETS_QUEUE_DEAD_PRESENT';
    } elseif ($sheetsDeadRecentTransient > 0) {
        $sheetsStatus = 'WARNING';
        $sheetsError = 'SHEETS_QUEUE_DEAD_TRANSIENT_PRESENT';
    } elseif ($sheetsHistoricalDead >= (int)HEALTH_QUEUE_HISTORICAL_WARN_THRESHOLD) {
        $sheetsStatus = 'WARNING';
        $sheetsError = 'SHEETS_QUEUE_HISTORICAL_DEAD_PRESENT';
    } elseif ((int)($sheetsQueue['retry'] ?? 0) > 0) {
        $sheetsStatus = 'WARNING';
        $sheetsError = 'SHEETS_QUEUE_RETRY_PRESENT';
    }

    $pushDead = (int)($pushQueue['dead'] ?? 0);
    $pushDeadRecentPermanent = (int)($pushDeadBreakdown['permanent'] ?? 0);
    $pushDeadRecentTransient = (int)($pushDeadBreakdown['transient'] ?? 0);
    $pushDeadRecent = $pushDeadRecentPermanent + $pushDeadRecentTransient;
    $pushHistoricalDead = $pushDead - $pushDeadRecent;
    if ($pushHistoricalDead < 0) $pushHistoricalDead = 0;
    $pushWorkload = queue_summary_active_workload($pushQueue);
    $pushNeedsAudience = $pushWorkload > 0 || $scheduledCampaigns > 0;
    $pushStatus = 'OK';
    $pushError = '';
    if (!PUSH_ENABLED) {
        if ($pushNeedsAudience || $activePushSubscriptions > 0) {
            $pushStatus = 'WARNING';
            $pushError = 'PUSH_DISABLED';
        }
    } elseif ($pushDeadRecentPermanent > 0) {
        $pushStatus = 'DOWN';
        $pushError = 'PUSH_QUEUE_DEAD_PRESENT';
    } elseif ($pushDeadRecentTransient > 0) {
        $pushStatus = 'WARNING';
        $pushError = 'PUSH_QUEUE_DEAD_TRANSIENT_PRESENT';
    } elseif ($pushHistoricalDead >= (int)HEALTH_QUEUE_HISTORICAL_WARN_THRESHOLD) {
        $pushStatus = 'WARNING';
        $pushError = 'PUSH_QUEUE_HISTORICAL_DEAD_PRESENT';
    } elseif ((int)($pushQueue['retry'] ?? 0) > 0) {
        $pushStatus = 'WARNING';
        $pushError = 'PUSH_QUEUE_RETRY_PRESENT';
    } elseif ($pushNeedsAudience && $activePushSubscriptions < 1) {
        $pushStatus = 'WARNING';
        $pushError = 'NO_ACTIVE_PUSH_SUBSCRIPTIONS';
    }

    $integrationSettings = load_integration_settings($db);
    $sslConfig = is_array($integrationSettings['sslcommerz'] ?? null) ? $integrationSettings['sslcommerz'] : [];
    $steadfastConfig = is_array($integrationSettings['steadfast'] ?? null) ? $integrationSettings['steadfast'] : [];
    $sslEnabled = sslcommerz_is_enabled($sslConfig);
    $steadfastEnabled = steadfast_is_enabled($steadfastConfig);
    $sslLastIpn = integration_fetch_latest_log($db, 'SSLCOMMERZ', 'IPN');
    $sslLastValidation = integration_fetch_latest_log($db, 'SSLCOMMERZ', 'VALIDATE');
    $sslLastAny = integration_fetch_latest_log($db, 'SSLCOMMERZ');
    $steadfastLastBooking = integration_fetch_latest_log($db, 'STEADFAST', 'BOOKING');
    $steadfastLastTrack = integration_fetch_latest_log($db, 'STEADFAST', 'TRACK');
    $steadfastLastSync = integration_fetch_latest_log($db, 'STEADFAST', 'SYNC');
    $steadfastLastAny = integration_fetch_latest_log($db, 'STEADFAST');

    $sslStatus = 'OK';
    $sslError = '';
    if ($sslEnabled) {
        $lastSslState = strtoupper(trim((string)($sslLastAny['status'] ?? '')));
        if ($lastSslState === 'ERROR') {
            $sslStatus = 'WARNING';
            $sslError = trim((string)($sslLastAny['error_message'] ?? 'SSL_LAST_EVENT_ERROR'));
        }
    }

    $steadfastStatus = 'OK';
    $steadfastError = '';
    if ($steadfastEnabled) {
        $lastSteadfastState = strtoupper(trim((string)($steadfastLastAny['status'] ?? '')));
        if (in_array($lastSteadfastState, ['ERROR', 'WARNING'], true)) {
            $steadfastStatus = 'WARNING';
            $steadfastError = trim((string)($steadfastLastAny['error_message'] ?? 'STEADFAST_LAST_EVENT_ERROR'));
        }
    }

    $services = [
        'db' => [
            'status' => $dbPingOk ? (($dbLatencyMs > 2500) ? 'WARNING' : 'OK') : 'DOWN',
            'latency_ms' => $dbLatencyMs,
            'last_checked_at' => $checkedAt,
            'error' => $dbPingOk ? '' : $dbPingError,
            'next_action' => $dbPingOk ? '' : health_recommended_action('db', $dbPingError)
        ],
        'orders_api' => [
            'status' => $ordersOk ? (($ordersLatencyMs > 2500) ? 'WARNING' : 'OK') : 'DOWN',
            'latency_ms' => $ordersLatencyMs,
            'last_checked_at' => $checkedAt,
            'error' => $ordersOk ? '' : $ordersError,
            'next_action' => $ordersOk ? '' : health_recommended_action('orders', $ordersError)
        ],
        'auth_api' => [
            'status' => $authOk ? (($authLatencyMs > 2500) ? 'WARNING' : 'OK') : 'DOWN',
            'latency_ms' => $authLatencyMs,
            'last_checked_at' => $checkedAt,
            'error' => $authOk ? '' : $authError,
            'next_action' => $authOk ? '' : health_recommended_action('auth', $authError)
        ],
        'queue' => [
            'status' => $queueStatus,
            'latency_ms' => null,
            'last_checked_at' => $checkedAt,
            'error' => $queueError,
            'next_action' => $queueStatus === 'OK' ? '' : health_recommended_action('queue', $queueError)
        ],
        'telegram' => [
            'status' => $telegramStatus,
            'latency_ms' => health_latest_probe_latency($latestProbeMap['telegram'] ?? null),
            'last_checked_at' => $checkedAt,
            'error' => $telegramError !== '' ? $telegramError : health_latest_probe_error($latestProbeMap['telegram'] ?? null),
            'next_action' => $telegramStatus === 'OK' ? '' : health_recommended_action('telegram', $telegramError)
        ],
        'sheets' => [
            'status' => $sheetsStatus,
            'latency_ms' => health_latest_probe_latency($latestProbeMap['sheets'] ?? null),
            'last_checked_at' => $checkedAt,
            'error' => $sheetsError !== '' ? $sheetsError : health_latest_probe_error($latestProbeMap['sheets'] ?? null),
            'next_action' => $sheetsStatus === 'OK' ? '' : health_recommended_action('sheets', $sheetsError)
        ],
        'push' => [
            'status' => $pushStatus,
            'latency_ms' => null,
            'last_checked_at' => $checkedAt,
            'error' => $pushError,
            'next_action' => $pushStatus === 'OK' ? '' : health_recommended_action('push', $pushError)
        ],
        'sslcommerz' => [
            'status' => $sslStatus,
            'latency_ms' => null,
            'last_checked_at' => $checkedAt,
            'error' => $sslError,
            'next_action' => $sslStatus === 'OK' ? '' : health_recommended_action('sheets', $sslError)
        ],
        'steadfast' => [
            'status' => $steadfastStatus,
            'latency_ms' => null,
            'last_checked_at' => $checkedAt,
            'error' => $steadfastError,
            'next_action' => $steadfastStatus === 'OK' ? '' : health_recommended_action('queue', $steadfastError)
        ]
    ];

    $abortedConnectsWindow = health_track_monotonic_counter(
        'db_aborted_connects',
        (int)($dbRuntimeMetrics['aborted_connects'] ?? 0),
        (int)HEALTH_DB_ABORTED_CONNECTS_DELTA_WINDOW_SECONDS
    );
    $dbRuntimeMetrics['aborted_connects_delta'] = (int)($abortedConnectsWindow['delta'] ?? 0);
    $dbRuntimeMetrics['aborted_connects_delta_elapsed_seconds'] = (int)($abortedConnectsWindow['elapsed_seconds'] ?? 0);
    $dbRuntimeMetrics['aborted_connects_delta_rate_per_minute'] = (float)($abortedConnectsWindow['rate_per_minute'] ?? 0.0);
    $dbRuntimeMetrics['aborted_connects_delta_window_seconds'] = (int)($abortedConnectsWindow['window_seconds'] ?? (int)HEALTH_DB_ABORTED_CONNECTS_DELTA_WINDOW_SECONDS);

    $mode = 'NORMAL';
    foreach ($services as $service) {
        if ((string)($service['status'] ?? '') === 'DOWN') {
            $mode = 'DEGRADED';
            break;
        }
    }
    if ($mode === 'NORMAL') {
        foreach ($services as $service) {
            if ((string)($service['status'] ?? '') === 'WARNING') {
                $mode = 'DEGRADED';
                break;
            }
        }
    }

    $diskRoot = __DIR__;
    $diskTotal = @disk_total_space($diskRoot);
    $diskFree = @disk_free_space($diskRoot);
    $diskUsedPercent = null;
    if (is_numeric($diskTotal) && is_numeric($diskFree) && (float)$diskTotal > 0) {
        $diskUsedPercent = round((((float)$diskTotal - (float)$diskFree) / (float)$diskTotal) * 100, 2);
    }

    if (!$dbPingOk) {
        health_maybe_send_telegram_alert('DB', 'DOWN', $dbPingError !== '' ? $dbPingError : 'DB_PING_FAILED');
    }
    if ((int)($dbRuntimeMetrics['threads_connected'] ?? 0) > (int)HEALTH_DB_THREADS_WARN_THRESHOLD) {
        health_maybe_send_telegram_alert('DB', 'WARNING', 'threads_connected above threshold');
    }
    if (
        (bool)($abortedConnectsWindow['within_window'] ?? false)
        && !(bool)($abortedConnectsWindow['counter_reset'] ?? false)
        && (int)($abortedConnectsWindow['elapsed_seconds'] ?? 0) >= (int)HEALTH_DB_ABORTED_CONNECTS_MIN_ELAPSED_SECONDS
        && (int)($abortedConnectsWindow['delta'] ?? 0) >= (int)HEALTH_DB_ABORTED_CONNECTS_DELTA_WARN_THRESHOLD
        && (float)($abortedConnectsWindow['rate_per_minute'] ?? 0.0) >= (float)HEALTH_DB_ABORTED_CONNECTS_RATE_WARN_PER_MINUTE
    ) {
        $abortedDelta = (int)($abortedConnectsWindow['delta'] ?? 0);
        $abortedElapsed = max(1, (int)($abortedConnectsWindow['elapsed_seconds'] ?? 0));
        $abortedRate = (float)($abortedConnectsWindow['rate_per_minute'] ?? 0.0);
        health_maybe_send_telegram_alert('DB', 'WARNING', "aborted_connects rising fast: +{$abortedDelta} in {$abortedElapsed}s (~{$abortedRate}/min)");
    }
    if ($queueDeadRecent >= (int)HEALTH_QUEUE_DEAD_WARN_THRESHOLD) {
        health_maybe_send_telegram_alert('QUEUE', 'WARNING', 'dead queue count increased');
    }

    echo json_encode([
        "status" => "success",
        "service" => "SPLARO_API",
        "timestamp" => $checkedAt,
        "time" => $checkedAt,
        "mode" => $mode,
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
        "queue" => [
            "totals" => [
                "pending" => $queuePending,
                "retry" => $queueRetry,
                "dead" => $queueDead,
                "dead_recent" => $queueDeadRecent,
                "dead_recent_permanent" => $queueDeadRecentPermanent,
                "dead_recent_transient" => $queueDeadRecentTransient,
                "dead_historical" => $queueHistoricalDead,
                "dead_recent_window_minutes" => (int)HEALTH_QUEUE_DEAD_DOWN_WINDOW_MINUTES
            ],
            "telegram" => array_merge($telegramQueue, [
                "dead_recent_breakdown" => $telegramDeadBreakdown
            ]),
            "push" => array_merge($pushQueue, [
                "dead_recent_breakdown" => $pushDeadBreakdown
            ]),
            "sheets" => array_merge($sheetsQueue, [
                "dead_recent_breakdown" => $sheetsDeadBreakdown
            ]),
            "auto_recovery" => $queueAutoRecovery
        ],
        "telegram" => [
            "enabled" => TELEGRAM_ENABLED,
            "allowlist_count" => count(telegram_admin_chat_allowlist()),
            "primary_chat_id_preview" => splaro_clip_text(telegram_primary_admin_chat_id(), 32),
            "queue" => $telegramQueue,
            "last_probe" => $latestProbeMap['telegram']
        ],
        "sheets" => [
            "enabled" => $sheetsEnabled,
            "queue" => $sheetsQueue,
            "circuit" => $sheetsCircuit,
            "last_probe" => $latestProbeMap['sheets']
        ],
        "push" => [
            "enabled" => PUSH_ENABLED,
            "active_subscriptions" => (int)$activePushSubscriptions,
            "scheduled_campaigns" => (int)$scheduledCampaigns,
            "queue" => $pushQueue
        ],
        "sslcommerz" => [
            "enabled" => $sslEnabled,
            "mode" => sslcommerz_mode($sslConfig),
            "last_ipn_at" => $sslLastIpn['created_at'] ?? null,
            "last_validation_result" => strtoupper(trim((string)($sslLastValidation['status'] ?? ($sslLastAny['status'] ?? '')))),
            "last_error" => trim((string)($sslLastAny['error_message'] ?? ''))
        ],
        "steadfast" => [
            "enabled" => $steadfastEnabled,
            "last_booking_at" => $steadfastLastBooking['created_at'] ?? null,
            "last_tracking_sync_at" => $steadfastLastTrack['created_at'] ?? ($steadfastLastSync['created_at'] ?? null),
            "last_error" => trim((string)($steadfastLastAny['error_message'] ?? ''))
        ],
        "services" => $services,
        "timeouts" => [
            "apiMaxExecutionSeconds" => (int)API_MAX_EXECUTION_SECONDS,
            "sheetsTimeoutSeconds" => (int)GOOGLE_SHEETS_TIMEOUT_SECONDS
        ],
        "server" => [
            "php_version" => PHP_VERSION,
            "sapi" => PHP_SAPI,
            "memory_limit" => (string)ini_get('memory_limit'),
            "max_execution_time" => (int)ini_get('max_execution_time'),
            "post_max_size" => (string)ini_get('post_max_size'),
            "upload_max_filesize" => (string)ini_get('upload_max_filesize')
        ],
        "disk" => [
            "path" => $diskRoot,
            "total_bytes" => is_numeric($diskTotal) ? (float)$diskTotal : null,
            "free_bytes" => is_numeric($diskFree) ? (float)$diskFree : null,
            "used_percent" => $diskUsedPercent
        ],
        "health_events" => health_fetch_events($db, 20),
        "recent_errors" => health_fetch_recent_db_errors($db, 20)
    ]);
    exit;
}

if ($method === 'POST' && $action === 'health_probe') {
    require_admin_access($requestAuthUser);
    require_csrf_token();
    [$payload] = read_request_json_payload('health.probe.payload');
    $probe = health_normalize_probe((string)($payload['probe'] ?? ''));
    if ($probe === '') {
        http_response_code(400);
        echo json_encode(["status" => "error", "message" => "INVALID_PROBE"]);
        exit;
    }
    $result = run_health_probe($db, $probe, $requestAuthUser);
    echo json_encode([
        "status" => "success",
        "result" => $result
    ]);
    exit;
}

if ($method === 'GET' && $action === 'health_events') {
    require_admin_access($requestAuthUser);
    $limit = (int)($_GET['limit'] ?? 50);
    $probe = (string)($_GET['probe'] ?? '');
    echo json_encode([
        "status" => "success",
        "events" => health_fetch_events($db, $limit, $probe)
    ]);
    exit;
}

if ($method === 'GET' && $action === 'system_errors') {
    require_admin_access($requestAuthUser);
    $limit = (int)($_GET['limit'] ?? 50);
    $service = trim((string)($_GET['service'] ?? ''));
    $level = strtoupper(trim((string)($_GET['level'] ?? '')));
    echo json_encode([
        "status" => "success",
        "errors" => health_fetch_system_errors($db, $limit, $service, $level)
    ]);
    exit;
}

if ($method === 'GET' && $action === 'push_public_key') {
    echo json_encode([
        "status" => "success",
        "enabled" => PUSH_ENABLED,
        "public_key" => (string)PUSH_VAPID_PUBLIC_KEY
    ]);
    exit;
}

if ($method === 'POST' && $action === 'push_subscribe') {
    $scopeKey = ($_SERVER['REMOTE_ADDR'] ?? 'unknown') . '|' . substr(md5((string)($_SERVER['HTTP_USER_AGENT'] ?? '')), 0, 12);
    if (is_rate_limited_scoped('push_subscribe', $scopeKey, 30, 60)) {
        http_response_code(429);
        echo json_encode(["status" => "error", "message" => "RATE_LIMIT_EXCEEDED"]);
        exit;
    }

    [$input, $raw] = read_request_json_payload('push.subscribe.payload');
    if (strlen($raw) > 16384) {
        http_response_code(413);
        echo json_encode(["status" => "error", "message" => "PAYLOAD_TOO_LARGE"]);
        exit;
    }

    $subscription = is_array($input['subscription'] ?? null) ? $input['subscription'] : $input;
    $keys = is_array($subscription['keys'] ?? null) ? $subscription['keys'] : [];
    $endpoint = trim((string)($subscription['endpoint'] ?? ''));
    $p256dh = trim((string)($keys['p256dh'] ?? ($input['p256dh'] ?? '')));
    $authKey = trim((string)($keys['auth'] ?? ($input['auth'] ?? '')));
    if ($endpoint === '' || $p256dh === '' || $authKey === '') {
        echo json_encode(["status" => "error", "message" => "INVALID_SUBSCRIPTION_PAYLOAD"]);
        exit;
    }
    if (strlen($endpoint) > 3000 || strlen($p256dh) > 1024 || strlen($authKey) > 1024) {
        echo json_encode(["status" => "error", "message" => "SUBSCRIPTION_PAYLOAD_INVALID_LENGTH"]);
        exit;
    }

    $authUserId = is_array($requestAuthUser) && !empty($requestAuthUser['id']) ? (string)$requestAuthUser['id'] : '';
    $userAgent = trim((string)($_SERVER['HTTP_USER_AGENT'] ?? ($input['user_agent'] ?? '')));
    if (function_exists('mb_substr')) {
        $userAgent = mb_substr($userAgent, 0, 500, 'UTF-8');
    } else {
        $userAgent = substr($userAgent, 0, 500);
    }

    try {
        $subscriptionId = push_upsert_subscription($db, $authUserId, $endpoint, $p256dh, $authKey, $userAgent);
        if ($subscriptionId <= 0) {
            echo json_encode(["status" => "error", "message" => "SUBSCRIPTION_SAVE_FAILED"]);
            exit;
        }
        log_system_event($db, 'PUSH_SUBSCRIBED', 'Push subscription upserted: #' . $subscriptionId, $authUserId !== '' ? $authUserId : null, $_SERVER['REMOTE_ADDR'] ?? 'UNKNOWN');
        echo json_encode([
            "status" => "success",
            "subscription_id" => $subscriptionId,
            "push_enabled" => PUSH_ENABLED
        ]);
    } catch (Exception $e) {
        splaro_log_exception('push.subscribe.handler', $e, [
            'user_id' => (string)$authUserId
        ]);
        http_response_code(500);
        echo json_encode(["status" => "error", "message" => "SUBSCRIPTION_SAVE_FAILED"]);
    }
    exit;
}

if ($method === 'POST' && $action === 'push_unsubscribe') {
    [$input] = read_request_json_payload('push.unsubscribe.payload');
    $endpoint = trim((string)($input['endpoint'] ?? ''));
    $authKey = trim((string)($input['auth'] ?? ''));
    $subscriptionId = (int)($input['subscription_id'] ?? 0);
    $deactivated = 0;

    try {
        if ($subscriptionId > 0) {
            $stmt = $db->prepare("UPDATE push_subscriptions SET is_active = 0, last_seen_at = NOW(), last_error = ?, last_http_code = NULL WHERE id = ?");
            $stmt->execute(['CLIENT_UNSUBSCRIBE', $subscriptionId]);
            $deactivated = $stmt->rowCount();
        } elseif ($endpoint !== '') {
            $endpointHash = push_subscription_endpoint_hash($endpoint);
            if ($authKey !== '') {
                $stmt = $db->prepare("UPDATE push_subscriptions SET is_active = 0, last_seen_at = NOW(), last_error = ?, last_http_code = NULL WHERE endpoint_hash = ? AND auth = ?");
                $stmt->execute(['CLIENT_UNSUBSCRIBE', $endpointHash, $authKey]);
            } else {
                $stmt = $db->prepare("UPDATE push_subscriptions SET is_active = 0, last_seen_at = NOW(), last_error = ?, last_http_code = NULL WHERE endpoint_hash = ?");
                $stmt->execute(['CLIENT_UNSUBSCRIBE', $endpointHash]);
            }
            $deactivated = $stmt->rowCount();
        } else {
            echo json_encode(["status" => "error", "message" => "MISSING_ENDPOINT_OR_ID"]);
            exit;
        }
    } catch (Exception $e) {
        splaro_log_exception('push.unsubscribe.handler', $e);
        http_response_code(500);
        echo json_encode(["status" => "error", "message" => "UNSUBSCRIBE_FAILED"]);
        exit;
    }

    echo json_encode([
        "status" => "success",
        "deactivated" => (int)$deactivated
    ]);
    exit;
}

if ($method === 'GET' && $action === 'push_latest') {
    $endpoint = trim((string)($_GET['endpoint'] ?? ''));
    $authKey = trim((string)($_GET['auth'] ?? ''));
    if ($endpoint === '') {
        echo json_encode(["status" => "error", "message" => "ENDPOINT_REQUIRED"]);
        exit;
    }
    if ($authKey === '') {
        http_response_code(400);
        echo json_encode(["status" => "error", "message" => "AUTH_KEY_REQUIRED"]);
        exit;
    }
    $scopeKey = push_subscription_endpoint_hash($endpoint);
    if (is_rate_limited_scoped('push_latest', $scopeKey, 120, 60)) {
        http_response_code(429);
        echo json_encode(["status" => "error", "message" => "RATE_LIMIT_EXCEEDED"]);
        exit;
    }

    try {
        $subStmt = $db->prepare("SELECT id, user_id, auth FROM push_subscriptions WHERE endpoint_hash = ? AND is_active = 1 LIMIT 1");
        $subStmt->execute([push_subscription_endpoint_hash($endpoint)]);
        $subscription = $subStmt->fetch();
    } catch (Exception $e) {
        splaro_log_exception('push.latest.subscription_lookup', $e);
        http_response_code(500);
        echo json_encode(["status" => "error", "message" => "LOOKUP_FAILED"]);
        exit;
    }

    if (!$subscription) {
        echo json_encode(["status" => "success", "payload" => [
            "title" => "SPLARO",
            "message" => "New update available.",
            "url" => "/",
            "type" => "system"
        ]]);
        exit;
    }
    if (!hash_equals((string)($subscription['auth'] ?? ''), $authKey)) {
        http_response_code(403);
        echo json_encode(["status" => "error", "message" => "UNAUTHORIZED_SUBSCRIPTION"]);
        exit;
    }

    $payload = [
        "title" => "SPLARO",
        "message" => "New update available.",
        "url" => "/",
        "type" => "system"
    ];
    $userId = trim((string)($subscription['user_id'] ?? ''));
    if ($userId !== '') {
        try {
            $notificationStmt = $db->prepare("SELECT id, title, message, url, type, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 1");
            $notificationStmt->execute([$userId]);
            $notification = $notificationStmt->fetch();
            if ($notification) {
                $payload = [
                    "title" => (string)($notification['title'] ?? $payload['title']),
                    "message" => (string)($notification['message'] ?? $payload['message']),
                    "url" => (string)($notification['url'] ?? '/'),
                    "type" => (string)($notification['type'] ?? 'system'),
                    "notification_id" => (int)($notification['id'] ?? 0),
                    "created_at" => (string)($notification['created_at'] ?? '')
                ];
            }
        } catch (Exception $e) {
            splaro_log_exception('push.latest.notification_lookup', $e, ['user_id' => $userId]);
        }
    }
    try {
        $db->prepare("UPDATE push_subscriptions SET last_seen_at = NOW() WHERE id = ?")->execute([(int)($subscription['id'] ?? 0)]);
    } catch (Exception $e) {
        splaro_log_exception('push.latest.subscription_touch', $e, ['subscription_id' => (int)($subscription['id'] ?? 0)], 'WARNING');
    }

    echo json_encode(["status" => "success", "payload" => $payload]);
    exit;
}

if ($method === 'GET' && $action === 'notifications') {
    if (!is_array($requestAuthUser) || empty($requestAuthUser['id'])) {
        http_response_code(401);
        echo json_encode(["status" => "error", "message" => "AUTH_REQUIRED"]);
        exit;
    }
    $userId = (string)$requestAuthUser['id'];
    $page = (int)($_GET['page'] ?? 1);
    $pageSize = (int)($_GET['page_size'] ?? $_GET['limit'] ?? 10);
    if ($page < 1) $page = 1;
    if ($pageSize < 1) $pageSize = 10;
    if ($pageSize > 50) $pageSize = 50;
    $offset = ($page - 1) * $pageSize;

    try {
        $countStmt = $db->prepare("SELECT COUNT(*) FROM notifications WHERE user_id = ?");
        $countStmt->execute([$userId]);
        $total = (int)$countStmt->fetchColumn();

        $unreadStmt = $db->prepare("SELECT COUNT(*) FROM notifications WHERE user_id = ? AND is_read = 0");
        $unreadStmt->execute([$userId]);
        $unread = (int)$unreadStmt->fetchColumn();

        $listStmt = $db->prepare("SELECT id, title, message, url, type, is_read, campaign_id, created_at, read_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?");
        $listStmt->bindValue(1, $userId, PDO::PARAM_STR);
        $listStmt->bindValue(2, $pageSize, PDO::PARAM_INT);
        $listStmt->bindValue(3, $offset, PDO::PARAM_INT);
        $listStmt->execute();
        $items = $listStmt->fetchAll();
    } catch (Exception $e) {
        splaro_log_exception('notifications.list', $e, ['user_id' => $userId]);
        http_response_code(500);
        echo json_encode(["status" => "error", "message" => "NOTIFICATION_READ_FAILED"]);
        exit;
    }

    echo json_encode([
        "status" => "success",
        "data" => is_array($items) ? $items : [],
        "meta" => [
            "page" => $page,
            "page_size" => $pageSize,
            "total" => (int)$total,
            "total_pages" => $pageSize > 0 ? (int)ceil($total / $pageSize) : 1,
            "unread" => (int)$unread
        ]
    ]);
    exit;
}

if ($method === 'POST' && $action === 'notifications_read') {
    if (!is_array($requestAuthUser) || empty($requestAuthUser['id'])) {
        http_response_code(401);
        echo json_encode(["status" => "error", "message" => "AUTH_REQUIRED"]);
        exit;
    }
    require_csrf_token();
    $userId = (string)$requestAuthUser['id'];
    [$input] = read_request_json_payload('notifications.read.payload');

    $marked = 0;
    try {
        if (!empty($input['all'])) {
            $stmt = $db->prepare("UPDATE notifications SET is_read = 1, read_at = NOW() WHERE user_id = ? AND is_read = 0");
            $stmt->execute([$userId]);
            $marked = (int)$stmt->rowCount();
        } else {
            $idsInput = $input['ids'] ?? ($input['id'] ?? []);
            if (!is_array($idsInput)) {
                $idsInput = [$idsInput];
            }
            $ids = [];
            foreach ($idsInput as $idValue) {
                $id = (int)$idValue;
                if ($id > 0) $ids[] = $id;
            }
            $ids = array_values(array_unique($ids));
            if (!empty($ids)) {
                $placeholders = implode(', ', array_fill(0, count($ids), '?'));
                $params = array_merge([$userId], $ids);
                $stmt = $db->prepare("UPDATE notifications SET is_read = 1, read_at = NOW() WHERE user_id = ? AND id IN ({$placeholders})");
                $stmt->execute($params);
                $marked = (int)$stmt->rowCount();
            }
        }
    } catch (Exception $e) {
        splaro_log_exception('notifications.mark_read', $e, ['user_id' => $userId]);
        http_response_code(500);
        echo json_encode(["status" => "error", "message" => "NOTIFICATION_UPDATE_FAILED"]);
        exit;
    }

    echo json_encode([
        "status" => "success",
        "marked" => (int)$marked
    ]);
    exit;
}

if ($method === 'POST' && $action === 'notifications_click') {
    if (!is_array($requestAuthUser) || empty($requestAuthUser['id'])) {
        http_response_code(401);
        echo json_encode(["status" => "error", "message" => "AUTH_REQUIRED"]);
        exit;
    }
    require_csrf_token();
    $userId = (string)$requestAuthUser['id'];
    [$input] = read_request_json_payload('notifications.click.payload');
    $notificationId = (int)($input['id'] ?? 0);
    if ($notificationId <= 0) {
        echo json_encode(["status" => "error", "message" => "NOTIFICATION_ID_REQUIRED"]);
        exit;
    }

    try {
        $update = $db->prepare("UPDATE notifications SET is_read = 1, read_at = NOW() WHERE id = ? AND user_id = ?");
        $update->execute([$notificationId, $userId]);
        $fetch = $db->prepare("SELECT campaign_id FROM notifications WHERE id = ? AND user_id = ? LIMIT 1");
        $fetch->execute([$notificationId, $userId]);
        $row = $fetch->fetch();
        $campaignId = (int)($row['campaign_id'] ?? 0);
        if ($campaignId > 0) {
            $clickLog = $db->prepare("INSERT INTO campaign_logs (campaign_id, subscription_id, status, error_message, sent_at, clicked_at, created_at) VALUES (?, NULL, 'clicked', NULL, NOW(), NOW(), NOW())");
            $clickLog->execute([$campaignId]);
        }
    } catch (Exception $e) {
        splaro_log_exception('notifications.click', $e, [
            'user_id' => $userId,
            'notification_id' => $notificationId
        ]);
        http_response_code(500);
        echo json_encode(["status" => "error", "message" => "NOTIFICATION_CLICK_FAILED"]);
        exit;
    }
    echo json_encode(["status" => "success"]);
    exit;
}

if ($method === 'POST' && $action === 'notifications_create') {
    require_campaign_write_access($requestAuthUser);
    require_csrf_token();
    [$input] = read_request_json_payload('notifications.create.payload');

    $title = trim((string)($input['title'] ?? ''));
    $message = trim((string)($input['message'] ?? ''));
    $url = trim((string)($input['url'] ?? ''));
    $type = trim((string)($input['type'] ?? 'system'));
    if ($title === '' || $message === '') {
        echo json_encode(["status" => "error", "message" => "TITLE_AND_MESSAGE_REQUIRED"]);
        exit;
    }

    $targetType = trim((string)($input['target_type'] ?? ''));
    $filters = is_array($input['filters'] ?? null) ? $input['filters'] : [];
    $userIds = [];

    if (!empty($input['user_id'])) {
        $userIds[] = trim((string)$input['user_id']);
    }
    if (is_array($input['user_ids'] ?? null)) {
        foreach ($input['user_ids'] as $uid) {
            $candidate = trim((string)$uid);
            if ($candidate !== '') $userIds[] = $candidate;
        }
    }
    if ($targetType !== '') {
        $resolved = campaign_resolve_user_ids($db, $targetType, $filters);
        foreach ($resolved as $uid) {
            $userIds[] = (string)$uid;
        }
    }
    $userIds = array_values(array_unique(array_filter($userIds, static fn($v) => trim((string)$v) !== '')));
    if (empty($userIds)) {
        echo json_encode(["status" => "error", "message" => "NO_TARGET_USERS"]);
        exit;
    }

    $created = 0;
    $queued = 0;
    foreach ($userIds as $uid) {
        try {
            $res = queue_push_for_user($db, $uid, $title, $message, $url, $type, null);
            $created += ((int)($res['notification_id'] ?? 0) > 0) ? 1 : 0;
            $queued += (int)($res['queued_jobs'] ?? 0);
        } catch (Exception $e) {
            splaro_log_exception('notifications.create.enqueue_user', $e, ['user_id' => (string)$uid], 'WARNING');
        }
    }

    echo json_encode([
        "status" => "success",
        "users_targeted" => count($userIds),
        "notifications_created" => (int)$created,
        "queued_push_jobs" => (int)$queued
    ]);
    exit;
}

if ($method === 'POST' && $action === 'campaign_preview') {
    require_campaign_write_access($requestAuthUser);
    require_csrf_token();
    [$input] = read_request_json_payload('campaign.preview.payload');
    $targetType = campaign_target_type_normalize((string)($input['target_type'] ?? 'all_users'));
    $filters = is_array($input['filters'] ?? null) ? $input['filters'] : [];

    $userIds = campaign_resolve_user_ids($db, $targetType, $filters);
    $subscriptions = campaign_resolve_subscriptions($db, $targetType, $userIds);

    echo json_encode([
        "status" => "success",
        "preview" => [
            "target_type" => $targetType,
            "users" => count($userIds),
            "subscriptions" => is_array($subscriptions) ? count($subscriptions) : 0,
            "sample_user_ids" => array_slice($userIds, 0, 10)
        ]
    ]);
    exit;
}

if ($method === 'POST' && $action === 'campaign_create') {
    require_campaign_write_access($requestAuthUser);
    require_csrf_token();
    [$input] = read_request_json_payload('campaign.create.payload');

    $title = trim((string)($input['title'] ?? ''));
    $message = trim((string)($input['message'] ?? ''));
    $imageUrl = trim((string)($input['image'] ?? $input['image_url'] ?? ''));
    $targetType = campaign_target_type_normalize((string)($input['target_type'] ?? 'all_users'));
    $filters = is_array($input['filters'] ?? null) ? $input['filters'] : [];
    $url = trim((string)($input['url'] ?? ''));
    if ($url !== '') {
        $filters['url'] = $url;
    }
    $filtersJson = json_encode($filters, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if (!is_string($filtersJson)) {
        splaro_integration_trace('campaign.create.filters_encode_failed', [
            'json_error' => json_last_error_msg()
        ], 'ERROR');
        echo json_encode(["status" => "error", "message" => "INVALID_FILTERS"]);
        exit;
    }
    if ($title === '' || $message === '') {
        echo json_encode(["status" => "error", "message" => "TITLE_AND_MESSAGE_REQUIRED"]);
        exit;
    }

    $sendNow = !empty($input['send_now']) || strtolower(trim((string)($input['mode'] ?? ''))) === 'send_now';
    $scheduledAtRaw = trim((string)($input['scheduled_at'] ?? ''));
    $scheduledAt = null;
    if ($scheduledAtRaw !== '') {
        $ts = strtotime($scheduledAtRaw);
        if ($ts === false) {
            echo json_encode(["status" => "error", "message" => "INVALID_SCHEDULED_AT"]);
            exit;
        }
        $scheduledAt = date('Y-m-d H:i:s', $ts);
    }

    $status = 'draft';
    if ($sendNow) {
        $status = 'sending';
    } elseif ($scheduledAt !== null) {
        $status = 'scheduled';
    }
    $createdBy = is_array($requestAuthUser) ? (string)($requestAuthUser['id'] ?? $requestAuthUser['email'] ?? 'admin') : 'admin';

    try {
        $insert = $db->prepare("INSERT INTO campaigns (title, message, image_url, target_type, filters_json, scheduled_at, status, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())");
        $insert->execute([$title, $message, $imageUrl, $targetType, $filtersJson, $scheduledAt, $status, $createdBy]);
        $campaignId = (int)$db->lastInsertId();
    } catch (Exception $e) {
        splaro_log_exception('campaign.create.insert', $e, [
            'target_type' => $targetType
        ]);
        http_response_code(500);
        echo json_encode(["status" => "error", "message" => "CAMPAIGN_CREATE_FAILED"]);
        exit;
    }

    $dispatchResult = null;
    if ($sendNow) {
        try {
            $campaignPayload = [
                'title' => $title,
                'message' => $message,
                'target_type' => $targetType,
                'filters_json' => $filtersJson
            ];
            $dispatchResult = campaign_dispatch_to_queue($db, $campaignId, $campaignPayload);
            $db->prepare("UPDATE campaigns SET status = 'sent', updated_at = NOW() WHERE id = ?")->execute([$campaignId]);
        } catch (Exception $e) {
            splaro_log_exception('campaign.create.dispatch_now', $e, ['campaign_id' => $campaignId]);
            try {
                $db->prepare("UPDATE campaigns SET status = 'draft', updated_at = NOW() WHERE id = ?")->execute([$campaignId]);
            } catch (Exception $inner) {
                splaro_log_exception('campaign.create.dispatch_now.restore_status', $inner, ['campaign_id' => $campaignId], 'WARNING');
            }
        }
    }

    echo json_encode([
        "status" => "success",
        "campaign_id" => (int)$campaignId,
        "campaign_status" => $sendNow ? 'sent' : $status,
        "dispatch" => $dispatchResult
    ]);
    exit;
}

if ($method === 'POST' && $action === 'campaign_send') {
    require_campaign_write_access($requestAuthUser);
    require_csrf_token();
    [$input] = read_request_json_payload('campaign.send.payload');
    $campaignId = (int)($input['campaign_id'] ?? $input['id'] ?? 0);
    if ($campaignId <= 0) {
        echo json_encode(["status" => "error", "message" => "CAMPAIGN_ID_REQUIRED"]);
        exit;
    }
    $mode = strtolower(trim((string)($input['mode'] ?? 'send_now')));
    if (!in_array($mode, ['send_now', 'schedule'], true)) {
        $mode = 'send_now';
    }

    try {
        $stmt = $db->prepare("SELECT id, title, message, target_type, filters_json, status FROM campaigns WHERE id = ? LIMIT 1");
        $stmt->execute([$campaignId]);
        $campaign = $stmt->fetch();
    } catch (Exception $e) {
        splaro_log_exception('campaign.send.read', $e, ['campaign_id' => $campaignId]);
        http_response_code(500);
        echo json_encode(["status" => "error", "message" => "CAMPAIGN_LOOKUP_FAILED"]);
        exit;
    }
    if (!$campaign) {
        echo json_encode(["status" => "error", "message" => "CAMPAIGN_NOT_FOUND"]);
        exit;
    }

    if ($mode === 'schedule') {
        $scheduledAtRaw = trim((string)($input['scheduled_at'] ?? ''));
        if ($scheduledAtRaw === '') {
            echo json_encode(["status" => "error", "message" => "SCHEDULED_AT_REQUIRED"]);
            exit;
        }
        $ts = strtotime($scheduledAtRaw);
        if ($ts === false) {
            echo json_encode(["status" => "error", "message" => "INVALID_SCHEDULED_AT"]);
            exit;
        }
        $scheduledAt = date('Y-m-d H:i:s', $ts);
        try {
            $db->prepare("UPDATE campaigns SET status = 'scheduled', scheduled_at = ?, updated_at = NOW() WHERE id = ?")->execute([$scheduledAt, $campaignId]);
        } catch (Exception $e) {
            splaro_log_exception('campaign.send.schedule_update', $e, ['campaign_id' => $campaignId]);
            http_response_code(500);
            echo json_encode(["status" => "error", "message" => "CAMPAIGN_SCHEDULE_FAILED"]);
            exit;
        }
        echo json_encode([
            "status" => "success",
            "campaign_id" => $campaignId,
            "campaign_status" => "scheduled",
            "scheduled_at" => $scheduledAt
        ]);
        exit;
    }

    try {
        $db->prepare("UPDATE campaigns SET status = 'sending', updated_at = NOW() WHERE id = ?")->execute([$campaignId]);
        $dispatchResult = campaign_dispatch_to_queue($db, $campaignId, $campaign);
        $db->prepare("UPDATE campaigns SET status = 'sent', updated_at = NOW() WHERE id = ?")->execute([$campaignId]);
    } catch (Exception $e) {
        splaro_log_exception('campaign.send.dispatch_now', $e, ['campaign_id' => $campaignId]);
        try {
            $db->prepare("UPDATE campaigns SET status = 'draft', updated_at = NOW() WHERE id = ?")->execute([$campaignId]);
        } catch (Exception $inner) {
            splaro_log_exception('campaign.send.dispatch_now.restore_status', $inner, ['campaign_id' => $campaignId], 'WARNING');
        }
        http_response_code(500);
        echo json_encode(["status" => "error", "message" => "CAMPAIGN_SEND_FAILED"]);
        exit;
    }

    echo json_encode([
        "status" => "success",
        "campaign_id" => $campaignId,
        "campaign_status" => "sent",
        "dispatch" => $dispatchResult
    ]);
    exit;
}

if ($method === 'GET' && $action === 'campaign_list') {
    require_admin_access($requestAuthUser);
    $page = (int)($_GET['page'] ?? 1);
    $pageSize = (int)($_GET['page_size'] ?? $_GET['limit'] ?? 10);
    if ($page < 1) $page = 1;
    if ($pageSize < 1) $pageSize = 10;
    if ($pageSize > 50) $pageSize = 50;
    $offset = ($page - 1) * $pageSize;

    try {
        $total = (int)$db->query("SELECT COUNT(*) FROM campaigns")->fetchColumn();
        $stmt = $db->prepare("SELECT id, title, message, image_url, target_type, filters_json, scheduled_at, status, created_by, created_at, updated_at FROM campaigns ORDER BY created_at DESC LIMIT ? OFFSET ?");
        $stmt->bindValue(1, $pageSize, PDO::PARAM_INT);
        $stmt->bindValue(2, $offset, PDO::PARAM_INT);
        $stmt->execute();
        $items = $stmt->fetchAll();
    } catch (Exception $e) {
        splaro_log_exception('campaign.list', $e);
        http_response_code(500);
        echo json_encode(["status" => "error", "message" => "CAMPAIGN_LIST_FAILED"]);
        exit;
    }

    echo json_encode([
        "status" => "success",
        "data" => is_array($items) ? $items : [],
        "meta" => [
            "page" => $page,
            "page_size" => $pageSize,
            "total" => (int)$total,
            "total_pages" => $pageSize > 0 ? (int)ceil($total / $pageSize) : 1
        ]
    ]);
    exit;
}

if ($method === 'GET' && $action === 'campaign_logs') {
    require_admin_access($requestAuthUser);
    $campaignId = (int)($_GET['campaign_id'] ?? $_GET['id'] ?? 0);
    $page = (int)($_GET['page'] ?? 1);
    $pageSize = (int)($_GET['page_size'] ?? $_GET['limit'] ?? 20);
    if ($page < 1) $page = 1;
    if ($pageSize < 1) $pageSize = 20;
    if ($pageSize > 100) $pageSize = 100;
    $offset = ($page - 1) * $pageSize;

    $whereSql = '';
    $params = [];
    if ($campaignId > 0) {
        $whereSql = 'WHERE campaign_id = ?';
        $params[] = $campaignId;
    }
    try {
        if ($campaignId > 0) {
            $countStmt = $db->prepare("SELECT COUNT(*) FROM campaign_logs WHERE campaign_id = ?");
            $countStmt->execute([$campaignId]);
            $total = (int)$countStmt->fetchColumn();
            $stmt = $db->prepare("SELECT id, campaign_id, subscription_id, status, error_message, sent_at, clicked_at, created_at FROM campaign_logs WHERE campaign_id = ? ORDER BY id DESC LIMIT ? OFFSET ?");
            $stmt->bindValue(1, $campaignId, PDO::PARAM_INT);
            $stmt->bindValue(2, $pageSize, PDO::PARAM_INT);
            $stmt->bindValue(3, $offset, PDO::PARAM_INT);
            $stmt->execute();
            $items = $stmt->fetchAll();
        } else {
            $total = (int)$db->query("SELECT COUNT(*) FROM campaign_logs")->fetchColumn();
            $stmt = $db->prepare("SELECT id, campaign_id, subscription_id, status, error_message, sent_at, clicked_at, created_at FROM campaign_logs ORDER BY id DESC LIMIT ? OFFSET ?");
            $stmt->bindValue(1, $pageSize, PDO::PARAM_INT);
            $stmt->bindValue(2, $offset, PDO::PARAM_INT);
            $stmt->execute();
            $items = $stmt->fetchAll();
        }
    } catch (Exception $e) {
        splaro_log_exception('campaign.logs', $e, [
            'campaign_id' => $campaignId > 0 ? $campaignId : null
        ]);
        http_response_code(500);
        echo json_encode(["status" => "error", "message" => "CAMPAIGN_LOGS_FAILED"]);
        exit;
    }

    echo json_encode([
        "status" => "success",
        "data" => is_array($items) ? $items : [],
        "meta" => [
            "page" => $page,
            "page_size" => $pageSize,
            "total" => (int)$total,
            "total_pages" => $pageSize > 0 ? (int)ceil($total / $pageSize) : 1
        ]
    ]);
    exit;
}

if ($method === 'GET' && $action === 'push_subscribers') {
    require_admin_access($requestAuthUser);
    $page = (int)($_GET['page'] ?? 1);
    $pageSize = (int)($_GET['page_size'] ?? $_GET['limit'] ?? 20);
    if ($page < 1) $page = 1;
    if ($pageSize < 1) $pageSize = 20;
    if ($pageSize > 100) $pageSize = 100;
    $offset = ($page - 1) * $pageSize;

    $activeOnly = isset($_GET['active_only']) && $_GET['active_only'] !== '0';
    $whereSql = $activeOnly ? "WHERE is_active = 1" : "";

    try {
        $count = (int)$db->query("SELECT COUNT(*) FROM push_subscriptions {$whereSql}")->fetchColumn();
        $activeCount = (int)$db->query("SELECT COUNT(*) FROM push_subscriptions WHERE is_active = 1")->fetchColumn();
        $stmt = $db->prepare("SELECT id, user_id, endpoint, user_agent, is_active, failure_count, last_http_code, last_error, last_failure_at, created_at, last_seen_at FROM push_subscriptions {$whereSql} ORDER BY id DESC LIMIT ? OFFSET ?");
        $stmt->bindValue(1, $pageSize, PDO::PARAM_INT);
        $stmt->bindValue(2, $offset, PDO::PARAM_INT);
        $stmt->execute();
        $items = $stmt->fetchAll();
    } catch (Exception $e) {
        splaro_log_exception('push.subscribers.list', $e);
        http_response_code(500);
        echo json_encode(["status" => "error", "message" => "PUSH_SUBSCRIBER_LIST_FAILED"]);
        exit;
    }

    echo json_encode([
        "status" => "success",
        "data" => is_array($items) ? $items : [],
        "meta" => [
            "page" => $page,
            "page_size" => $pageSize,
            "total" => (int)$count,
            "total_pages" => $pageSize > 0 ? (int)ceil($count / $pageSize) : 1,
            "active_subscriptions" => (int)$activeCount
        ]
    ]);
    exit;
}

if ($method === 'POST' && $action === 'push_subscription_toggle') {
    require_campaign_write_access($requestAuthUser);
    require_csrf_token();
    [$input] = read_request_json_payload('push.subscriber.toggle.payload');
    $id = (int)($input['id'] ?? 0);
    if ($id <= 0) {
        echo json_encode(["status" => "error", "message" => "SUBSCRIPTION_ID_REQUIRED"]);
        exit;
    }
    $isActive = !empty($input['is_active']) ? 1 : 0;
    try {
        $stmt = $db->prepare("UPDATE push_subscriptions SET is_active = ?, last_seen_at = NOW(), last_error = ? WHERE id = ?");
        $stmt->execute([$isActive, $isActive === 1 ? null : 'ADMIN_DISABLED', $id]);
    } catch (Exception $e) {
        splaro_log_exception('push.subscriber.toggle', $e, ['subscription_id' => $id]);
        http_response_code(500);
        echo json_encode(["status" => "error", "message" => "SUBSCRIBER_TOGGLE_FAILED"]);
        exit;
    }
    echo json_encode([
        "status" => "success",
        "subscription_id" => $id,
        "is_active" => $isActive === 1
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
                $statusDb = admin_order_status_db_value($statusLabel);
                if ($orderId === '' || $statusLabel === '') {
                    $callbackMessage = 'Invalid status action';
                    $reply = '<b>Invalid action.</b>';
                } else {
                    $beforeStmt = $db->prepare("SELECT id, status FROM orders WHERE id = ? LIMIT 1");
                    $beforeStmt->execute([$orderId]);
                    $beforeOrder = $beforeStmt->fetch();
                    $orderExists = (bool)$beforeOrder;
                    if ($orderExists) {
                        try {
                            $db->beginTransaction();
                            $stmt = $db->prepare("UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?");
                            $stmt->execute([$statusDb, $orderId]);
                            admin_write_order_status_history(
                                $db,
                                $orderId,
                                admin_normalize_order_status((string)($beforeOrder['status'] ?? 'Pending')),
                                $statusLabel,
                                'Status updated via Telegram callback',
                                ['id' => 'telegram_bot', 'role' => 'SYSTEM']
                            );
                            $db->commit();
                        } catch (Exception $e) {
                            if ($db->inTransaction()) {
                                $db->rollBack();
                            }
                            throw $e;
                        }
                        sync_to_sheets('UPDATE_STATUS', ['id' => $orderId, 'status' => $statusLabel]);
                        log_system_event(
                            $db,
                            'TELEGRAM_ADMIN_STATUS_UPDATE',
                            "Order {$orderId} status updated to {$statusLabel} via Telegram callback.",
                            null,
                            $_SERVER['REMOTE_ADDR'] ?? 'TELEGRAM_WEBHOOK'
                        );
                        try {
                            $pushStatusResult = queue_order_status_notification($db, (string)$orderId, (string)$statusLabel);
                            splaro_integration_trace('telegram.callback.order_status.push_queue_result', [
                                'order_id' => (string)$orderId,
                                'status' => (string)$statusLabel,
                                'notification_id' => (int)($pushStatusResult['notification_id'] ?? 0),
                                'queued_jobs' => (int)($pushStatusResult['queued_jobs'] ?? 0)
                            ]);
                        } catch (Exception $e) {
                            splaro_log_exception('telegram.callback.order_status.push_queue', $e, [
                                'order_id' => (string)$orderId,
                                'status' => (string)$statusLabel
                            ], 'WARNING');
                        }
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
                $pushQueue = get_push_queue_summary($db);
                $reply = "<b>SPLARO Health</b>\n"
                    . "Orders: {$orderCount}\n"
                    . "Users: {$userCount}\n"
                    . "Telegram Queue: P{$telegramQueue['pending']} R{$telegramQueue['retry']} D{$telegramQueue['dead']}\n"
                    . "Push Queue: P{$pushQueue['pending']} R{$pushQueue['retry']} D{$pushQueue['dead']}\n"
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
            $pushQueue = get_push_queue_summary($db);
            $reply = "<b>SPLARO Health</b>\n"
                . "Orders: {$orderCount}\n"
                . "Users: {$userCount}\n"
                . "Telegram Queue: P{$telegramQueue['pending']} R{$telegramQueue['retry']} D{$telegramQueue['dead']}\n"
                . "Push Queue: P{$pushQueue['pending']} R{$pushQueue['retry']} D{$pushQueue['dead']}\n"
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
            $statusDb = admin_order_status_db_value($statusLabel);
            if ($orderId === '' || $statusLabel === '') {
                $reply = "<b>Usage:</b> /setstatus {order_id} {PENDING|PROCESSING|SHIPPED|DELIVERED|CANCELLED}";
            } else {
                $beforeStmt = $db->prepare("SELECT id, status FROM orders WHERE id = ? LIMIT 1");
                $beforeStmt->execute([$orderId]);
                $beforeOrder = $beforeStmt->fetch();
                $orderExists = (bool)$beforeOrder;
                if ($orderExists) {
                    try {
                        $db->beginTransaction();
                        $stmt = $db->prepare("UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?");
                        $stmt->execute([$statusDb, $orderId]);
                        admin_write_order_status_history(
                            $db,
                            $orderId,
                            admin_normalize_order_status((string)($beforeOrder['status'] ?? 'Pending')),
                            $statusLabel,
                            'Status updated via Telegram command',
                            ['id' => 'telegram_bot', 'role' => 'SYSTEM']
                        );
                        $db->commit();
                    } catch (Exception $e) {
                        if ($db->inTransaction()) {
                            $db->rollBack();
                        }
                        throw $e;
                    }
                    sync_to_sheets('UPDATE_STATUS', ['id' => $orderId, 'status' => $statusLabel]);
                    log_system_event(
                        $db,
                        'TELEGRAM_ADMIN_STATUS_UPDATE',
                        "Order {$orderId} status updated to {$statusLabel} via Telegram command.",
                        null,
                        $_SERVER['REMOTE_ADDR'] ?? 'TELEGRAM_WEBHOOK'
                    );
                    try {
                        $pushStatusResult = queue_order_status_notification($db, (string)$orderId, (string)$statusLabel);
                        splaro_integration_trace('telegram.command.order_status.push_queue_result', [
                            'order_id' => (string)$orderId,
                            'status' => (string)$statusLabel,
                            'notification_id' => (int)($pushStatusResult['notification_id'] ?? 0),
                            'queued_jobs' => (int)($pushStatusResult['queued_jobs'] ?? 0)
                        ]);
                    } catch (Exception $e) {
                        splaro_log_exception('telegram.command.order_status.push_queue', $e, [
                            'order_id' => (string)$orderId,
                            'status' => (string)$statusLabel
                        ], 'WARNING');
                    }
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
        $settings['logistics_config'] = normalize_logistics_config(json_decode($settings['logistics_config'] ?? '[]', true));
        $settings['hero_slides'] = json_decode($settings['hero_slides'] ?? '[]', true);
        $settings['content_pages'] = json_decode($settings['content_pages'] ?? '{}', true);
        $settings['story_posts'] = json_decode($settings['story_posts'] ?? '[]', true);

        $settingsJson = safe_json_decode_assoc($settings['settings_json'] ?? '{}', []);
        $cmsDraft = cms_normalize_bundle($settingsJson['cmsDraft'] ?? $settingsJson['cms_draft'] ?? []);
        $cmsPublished = cms_normalize_bundle($settingsJson['cmsPublished'] ?? $settingsJson['cms_published'] ?? []);
        $cmsRevisions = cms_normalize_revisions($settingsJson['cmsRevisions'] ?? $settingsJson['cms_revisions'] ?? []);
        $integrationSettings = load_integration_settings($db, $settings);
        $settingsJson['integrationSettings'] = $integrationSettings;
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
        $settings['integration_settings'] = integration_mask_settings_for_output($integrationSettings);
        $settings['settings_json'] = $settingsJson;

        if (!$isAdmin) {
            unset($settings['smtp_settings']);
            unset($settings['cms_draft']);
            unset($settings['cms_revisions']);
            unset($settings['settings_json']);
            unset($settings['integration_settings']);
        } else {
            if (is_array($settings['settings_json'])) {
                $settings['settings_json']['integrationSettings'] = $settings['integration_settings'];
            }
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
            $campaignProcess = process_due_campaigns($db, 3);
            $syncQueueProcess = [
                'campaigns' => $campaignProcess,
                'telegram' => process_telegram_queue($db, 10),
                'push' => process_push_queue($db, 10),
                'sheets' => process_sync_queue($db, 5, false)
            ];
        } catch (Exception $e) {
            error_log('SPLARO_SYNC_QUEUE_PROCESS_FAILED: ' . $e->getMessage());
            splaro_log_exception('sheets.queue.process.opportunistic_admin_sync', $e);
            $syncQueueProcess = [
                'campaigns' => [
                    'processed' => 0,
                    'queued_jobs' => 0
                ],
                'telegram' => [
                    'processed' => 0,
                    'success' => 0,
                    'failed' => 0,
                    'retried' => 0,
                    'dead' => 0,
                    'paused' => true,
                    'reason' => 'SYNC_QUEUE_PROCESS_FAILED'
                ],
                'push' => [
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
            $orderWhere[] = "UPPER(COALESCE(status, '')) = ?";
            $orderParams[] = admin_order_status_db_value($orderStatus);
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
        foreach ($orders as &$orderRow) {
            $orderRow['status'] = admin_normalize_order_status($orderRow['status'] ?? 'Pending');
        }
        unset($orderRow);

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
                'push' => get_push_queue_summary($db),
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
        foreach ($orders as &$orderRow) {
            $orderRow['status'] = admin_normalize_order_status($orderRow['status'] ?? 'Pending');
        }
        unset($orderRow);

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

// 1.1 ADMIN USER MANAGEMENT (WOO-COMMERCE STYLE CUSTOMER VIEW)
if ($method === 'GET' && $action === 'admin_users') {
    require_admin_access($requestAuthUser);
    $pagination = admin_parse_pagination_params(20, 100);
    $limit = (int)$pagination['limit'];
    $offset = (int)$pagination['offset'];
    $cursor = $pagination['cursor'];

    $search = trim((string)($_GET['search'] ?? $_GET['q'] ?? ''));
    $status = strtoupper(trim((string)($_GET['status'] ?? '')));
    $where = [];
    $params = [];

    if (column_exists($db, 'users', 'deleted_at')) {
        $where[] = "deleted_at IS NULL";
    }
    if ($search !== '') {
        $wild = '%' . $search . '%';
        $where[] = "(id LIKE ? OR name LIKE ? OR email LIKE ? OR phone LIKE ?)";
        $params[] = $wild;
        $params[] = $wild;
        $params[] = $wild;
        $params[] = $wild;
    }
    if ($status !== '') {
        if ($status === 'BLOCKED' && column_exists($db, 'users', 'is_blocked')) {
            $where[] = "is_blocked = 1";
        } elseif ($status === 'ACTIVE' && column_exists($db, 'users', 'is_blocked')) {
            $where[] = "is_blocked = 0";
        } else {
            $where[] = "UPPER(role) = ?";
            $params[] = $status;
        }
    }
    if (is_array($cursor)) {
        $where[] = "(created_at < ? OR (created_at = ? AND id < ?))";
        $params[] = (string)$cursor['created_at'];
        $params[] = (string)$cursor['created_at'];
        $params[] = (string)$cursor['id'];
    }

    $whereSql = $where ? ('WHERE ' . implode(' AND ', $where)) : '';
    $fields = admin_user_select_fields($db);
    $sql = "SELECT {$fields} FROM users {$whereSql} ORDER BY created_at DESC, id DESC LIMIT " . ($limit + 1);
    if (!is_array($cursor)) {
        $sql .= " OFFSET {$offset}";
    }
    $rows = safe_query_all($db, $sql, $params);
    $hasMore = count($rows) > $limit;
    if ($hasMore) {
        array_pop($rows);
    }

    $usersData = array_map('admin_normalize_user', $rows);
    $statsByUserId = [];
    $statsByEmail = [];
    if (!empty($usersData)) {
        $userIds = [];
        $emails = [];
        foreach ($usersData as $u) {
            if ($u['id'] !== '') $userIds[] = $u['id'];
            if ($u['email'] !== '') $emails[] = strtolower($u['email']);
        }
        $userIds = array_values(array_unique($userIds));
        $emails = array_values(array_unique($emails));

        if (!empty($userIds)) {
            $placeholders = implode(', ', array_fill(0, count($userIds), '?'));
            $ordersWhere = "user_id IN ({$placeholders})";
            if (column_exists($db, 'orders', 'deleted_at')) {
                $ordersWhere .= " AND deleted_at IS NULL";
            }
            $statsRows = safe_query_all(
                $db,
                "SELECT user_id, COUNT(*) AS total_orders, COALESCE(SUM(total), 0) AS total_spent, MAX(created_at) AS last_order_at
                 FROM orders
                 WHERE {$ordersWhere}
                 GROUP BY user_id",
                $userIds
            );
            foreach ($statsRows as $row) {
                $key = (string)($row['user_id'] ?? '');
                if ($key === '') continue;
                $statsByUserId[$key] = [
                    'total_orders' => (int)($row['total_orders'] ?? 0),
                    'total_spent' => (float)($row['total_spent'] ?? 0),
                    'last_order_at' => $row['last_order_at'] ?? null
                ];
            }
        }

        if (!empty($emails)) {
            $emailPlaceholders = implode(', ', array_fill(0, count($emails), '?'));
            $ordersWhere = "LOWER(customer_email) IN ({$emailPlaceholders})";
            if (column_exists($db, 'orders', 'deleted_at')) {
                $ordersWhere .= " AND deleted_at IS NULL";
            }
            $statsRowsByEmail = safe_query_all(
                $db,
                "SELECT LOWER(customer_email) AS email_key, COUNT(*) AS total_orders, COALESCE(SUM(total), 0) AS total_spent, MAX(created_at) AS last_order_at
                 FROM orders
                 WHERE {$ordersWhere}
                 GROUP BY LOWER(customer_email)",
                $emails
            );
            foreach ($statsRowsByEmail as $row) {
                $key = (string)($row['email_key'] ?? '');
                if ($key === '') continue;
                $statsByEmail[$key] = [
                    'total_orders' => (int)($row['total_orders'] ?? 0),
                    'total_spent' => (float)($row['total_spent'] ?? 0),
                    'last_order_at' => $row['last_order_at'] ?? null
                ];
            }
        }
    }

    foreach ($usersData as &$u) {
        $byUserId = $statsByUserId[$u['id']] ?? ['total_orders' => 0, 'total_spent' => 0, 'last_order_at' => null];
        $byEmail = $statsByEmail[strtolower((string)$u['email'])] ?? ['total_orders' => 0, 'total_spent' => 0, 'last_order_at' => null];
        $u['totalOrders'] = (int)$byUserId['total_orders'] + (int)$byEmail['total_orders'];
        $u['lifetimeValue'] = (float)$byUserId['total_spent'] + (float)$byEmail['total_spent'];
        $u['lastOrderAt'] = $byUserId['last_order_at'] ?: $byEmail['last_order_at'];
    }
    unset($u);

    $nextCursor = null;
    if ($hasMore && !empty($usersData)) {
        $last = $usersData[count($usersData) - 1];
        $nextCursor = admin_encode_cursor((string)($last['createdAt'] ?? ''), (string)($last['id'] ?? ''));
    }
    $countTotal = null;
    if (!is_array($cursor)) {
        $countWhere = [];
        $countParams = [];
        if (column_exists($db, 'users', 'deleted_at')) {
            $countWhere[] = "deleted_at IS NULL";
        }
        if ($search !== '') {
            $wild = '%' . $search . '%';
            $countWhere[] = "(id LIKE ? OR name LIKE ? OR email LIKE ? OR phone LIKE ?)";
            $countParams[] = $wild;
            $countParams[] = $wild;
            $countParams[] = $wild;
            $countParams[] = $wild;
        }
        if ($status !== '') {
            if ($status === 'BLOCKED' && column_exists($db, 'users', 'is_blocked')) {
                $countWhere[] = "is_blocked = 1";
            } elseif ($status === 'ACTIVE' && column_exists($db, 'users', 'is_blocked')) {
                $countWhere[] = "is_blocked = 0";
            } else {
                $countWhere[] = "UPPER(role) = ?";
                $countParams[] = $status;
            }
        }
        $countWhereSql = $countWhere ? ('WHERE ' . implode(' AND ', $countWhere)) : '';
        $countTotal = safe_query_count($db, "SELECT COUNT(*) FROM users {$countWhereSql}", $countParams);
    }

    echo json_encode([
        "status" => "success",
        "data" => $usersData,
        "meta" => [
            "page" => (int)$pagination['page'],
            "limit" => $limit,
            "hasMore" => $hasMore,
            "nextCursor" => $nextCursor,
            "count" => $countTotal
        ]
    ]);
    exit;
}

if ($method === 'GET' && $action === 'admin_user_stats') {
    require_admin_access($requestAuthUser);
    $userId = trim((string)($_GET['id'] ?? $_GET['userId'] ?? ''));
    $userRow = admin_fetch_user_or_fail($db, $userId);
    $stats = admin_build_user_stats_payload($db, $userRow);
    echo json_encode([
        "status" => "success",
        "data" => [
            'userId' => (string)$userRow['id'],
            'email' => (string)$userRow['email'],
            'stats' => $stats
        ]
    ]);
    exit;
}

if ($method === 'GET' && $action === 'admin_user_orders') {
    require_admin_access($requestAuthUser);
    $userId = trim((string)($_GET['id'] ?? $_GET['userId'] ?? ''));
    $userRow = admin_fetch_user_or_fail($db, $userId);
    $pagination = admin_parse_pagination_params(20, 100);
    $limit = (int)$pagination['limit'];
    $offset = (int)$pagination['offset'];
    $cursor = $pagination['cursor'];
    $search = trim((string)($_GET['search'] ?? $_GET['q'] ?? ''));
    $status = trim((string)($_GET['status'] ?? ''));
    $scopeSql = admin_user_order_scope_sql($db, 'o');
    $where = [$scopeSql];
    $params = [(string)$userRow['id'], strtolower((string)$userRow['email'])];
    if ($status !== '') {
        $where[] = "UPPER(o.status) = ?";
        $params[] = strtoupper($status);
    }
    if ($search !== '') {
        $wild = '%' . $search . '%';
        $where[] = "(o.id LIKE ? OR o.order_no LIKE ? OR o.customer_name LIKE ? OR o.customer_email LIKE ? OR o.phone LIKE ?)";
        $params[] = $wild;
        $params[] = $wild;
        $params[] = $wild;
        $params[] = $wild;
        $params[] = $wild;
    }
    if (is_array($cursor)) {
        $where[] = "(o.created_at < ? OR (o.created_at = ? AND o.id < ?))";
        $params[] = (string)$cursor['created_at'];
        $params[] = (string)$cursor['created_at'];
        $params[] = (string)$cursor['id'];
    }
    $whereSql = 'WHERE ' . implode(' AND ', $where);
    $orderFields = admin_order_select_fields($db);
    $sql = "SELECT {$orderFields} FROM orders o {$whereSql} ORDER BY o.created_at DESC, o.id DESC LIMIT " . ($limit + 1);
    if (!is_array($cursor)) {
        $sql .= " OFFSET {$offset}";
    }
    $rows = safe_query_all($db, $sql, $params);
    $hasMore = count($rows) > $limit;
    if ($hasMore) array_pop($rows);

    $ordersData = [];
    foreach ($rows as $row) {
        $ordersData[] = admin_normalize_order_row($row);
    }

    if (!empty($ordersData)) {
        $orderIds = array_values(array_filter(array_map(function ($o) { return (string)($o['id'] ?? ''); }, $ordersData)));
        if (!empty($orderIds)) {
            $placeholders = implode(', ', array_fill(0, count($orderIds), '?'));
            $itemCountRows = safe_query_all(
                $db,
                "SELECT order_id, COALESCE(SUM(quantity), 0) AS qty FROM order_items WHERE order_id IN ({$placeholders}) GROUP BY order_id",
                $orderIds
            );
            $qtyMap = [];
            foreach ($itemCountRows as $r) {
                $qtyMap[(string)($r['order_id'] ?? '')] = (int)($r['qty'] ?? 0);
            }
            foreach ($ordersData as &$o) {
                $oid = (string)$o['id'];
                if (isset($qtyMap[$oid])) {
                    $o['itemCount'] = (int)$qtyMap[$oid];
                }
            }
            unset($o);
        }
    }

    $nextCursor = null;
    if ($hasMore && !empty($ordersData)) {
        $last = $ordersData[count($ordersData) - 1];
        $nextCursor = admin_encode_cursor((string)($last['createdAt'] ?? ''), (string)($last['id'] ?? ''));
    }

    echo json_encode([
        "status" => "success",
        "data" => $ordersData,
        "meta" => [
            "page" => (int)$pagination['page'],
            "limit" => $limit,
            "hasMore" => $hasMore,
            "nextCursor" => $nextCursor
        ]
    ]);
    exit;
}

if ($method === 'GET' && $action === 'admin_user_activity') {
    require_admin_access($requestAuthUser);
    $userId = trim((string)($_GET['id'] ?? $_GET['userId'] ?? ''));
    $userRow = admin_fetch_user_or_fail($db, $userId);
    $pagination = admin_parse_pagination_params(20, 100);
    $limit = (int)$pagination['limit'];
    $offset = (int)$pagination['offset'];
    $scope = admin_user_order_scope_sql($db, 'o');
    $email = strtolower((string)$userRow['email']);
    $uid = (string)$userRow['id'];

    $unionSql = "
        SELECT * FROM (
            SELECT CONCAT('ORDER_STATUS:', osh.id) AS event_id, 'ORDER_STATUS' AS event_type, osh.order_id AS reference_id, osh.note AS details, osh.created_at AS created_at
            FROM order_status_history osh
            INNER JOIN orders o ON o.id = osh.order_id
            WHERE {$scope}
            UNION ALL
            SELECT CONCAT('PAYMENT:', p.id) AS event_id, 'PAYMENT' AS event_type, p.order_id AS reference_id,
                   CONCAT(COALESCE(p.payment_method, 'Payment'), ' • ', COALESCE(p.status, 'PENDING'), ' • BDT ', FORMAT(COALESCE(p.amount,0), 2)) AS details,
                   p.created_at AS created_at
            FROM payments p
            INNER JOIN orders o ON o.id = p.order_id
            WHERE {$scope}
            UNION ALL
            SELECT CONCAT('SHIPMENT:', s.id) AS event_id, 'SHIPMENT' AS event_type, s.order_id AS reference_id,
                   CONCAT('Shipment ', COALESCE(s.status, 'PENDING'), IFNULL(CONCAT(' • ', s.tracking_number), '')) AS details,
                   s.created_at AS created_at
            FROM shipments s
            INNER JOIN orders o ON o.id = s.order_id
            WHERE {$scope}
            UNION ALL
            SELECT CONCAT('REFUND:', r.id) AS event_id, 'REFUND' AS event_type, r.order_id AS reference_id,
                   CONCAT('Refund ', COALESCE(r.status, 'PENDING'), ' • BDT ', FORMAT(COALESCE(r.amount,0), 2)) AS details,
                   r.created_at AS created_at
            FROM refunds r
            INNER JOIN orders o ON o.id = r.order_id
            WHERE {$scope}
            UNION ALL
            SELECT CONCAT('CANCEL:', c.id) AS event_id, 'CANCELLATION' AS event_type, c.order_id AS reference_id,
                   CONCAT('Cancellation ', COALESCE(c.status, 'CONFIRMED')) AS details,
                   c.created_at AS created_at
            FROM cancellations c
            INNER JOIN orders o ON o.id = c.order_id
            WHERE {$scope}
            UNION ALL
            SELECT CONCAT('NOTE:', an.id) AS event_id, 'ADMIN_NOTE' AS event_type, an.user_id AS reference_id, an.note AS details, an.created_at AS created_at
            FROM admin_user_notes an
            WHERE an.user_id = ?
            UNION ALL
            SELECT CONCAT('USER_EVENT:', ue.id) AS event_id, COALESCE(ue.event_type, 'USER_EVENT') AS event_type, ue.user_id AS reference_id,
                   COALESCE(ue.event_payload, '') AS details, ue.created_at AS created_at
            FROM user_events ue
            WHERE ue.user_id = ?
        ) activity
        ORDER BY created_at DESC
        LIMIT " . ($limit + 1) . " OFFSET {$offset}";

    $params = [
        $uid, $email,
        $uid, $email,
        $uid, $email,
        $uid, $email,
        $uid, $email,
        $uid,
        $uid
    ];
    $rows = safe_query_all($db, $unionSql, $params);
    $hasMore = count($rows) > $limit;
    if ($hasMore) array_pop($rows);
    $events = [];
    foreach ($rows as $row) {
        $events[] = [
            'id' => (string)($row['event_id'] ?? ''),
            'type' => (string)($row['event_type'] ?? 'EVENT'),
            'referenceId' => (string)($row['reference_id'] ?? ''),
            'details' => (string)($row['details'] ?? ''),
            'createdAt' => (string)($row['created_at'] ?? '')
        ];
    }

    echo json_encode([
        "status" => "success",
        "data" => $events,
        "meta" => [
            "page" => (int)$pagination['page'],
            "limit" => $limit,
            "hasMore" => $hasMore
        ]
    ]);
    exit;
}

if ($method === 'POST' && $action === 'admin_user_note') {
    require_admin_access($requestAuthUser);
    require_csrf_token();
    $inputRaw = file_get_contents('php://input');
    $input = json_decode((string)$inputRaw, true);
    if (!is_array($input)) {
        echo json_encode(["status" => "error", "message" => "INVALID_PAYLOAD"]);
        exit;
    }
    $userId = trim((string)($input['id'] ?? $input['userId'] ?? ''));
    $note = trim((string)($input['note'] ?? ''));
    if ($userId === '' || $note === '') {
        echo json_encode(["status" => "error", "message" => "USER_ID_AND_NOTE_REQUIRED"]);
        exit;
    }
    if (mb_strlen($note) > 2000) {
        $note = mb_substr($note, 0, 2000);
    }
    admin_fetch_user_or_fail($db, $userId);
    $stmt = $db->prepare("INSERT INTO admin_user_notes (user_id, admin_id, note) VALUES (?, ?, ?)");
    $adminActorId = (string)($requestAuthUser['id'] ?? $requestAuthUser['email'] ?? 'admin_key');
    $stmt->execute([$userId, $adminActorId, $note]);
    $noteId = (int)$db->lastInsertId();
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'UNKNOWN';
    log_system_event($db, 'ADMIN_USER_NOTE', "Admin note added for user {$userId}", $adminActorId, $ip);
    log_audit_event($db, $adminActorId, 'USER_NOTE_ADDED', 'USER', $userId, null, ['noteId' => $noteId], $ip);
    echo json_encode([
        "status" => "success",
        "data" => [
            "id" => $noteId,
            "userId" => $userId,
            "adminId" => $adminActorId,
            "note" => $note,
            "createdAt" => date('Y-m-d H:i:s')
        ]
    ]);
    exit;
}

if ($method === 'POST' && $action === 'admin_user_block') {
    require_admin_access($requestAuthUser);
    require_csrf_token();
    $input = json_decode(file_get_contents('php://input'), true);
    if (!is_array($input)) {
        echo json_encode(["status" => "error", "message" => "INVALID_PAYLOAD"]);
        exit;
    }
    $userId = trim((string)($input['id'] ?? $input['userId'] ?? ''));
    if ($userId === '') {
        echo json_encode(["status" => "error", "message" => "USER_ID_REQUIRED"]);
        exit;
    }
    $blockedInput = $input['blocked'] ?? $input['isBlocked'] ?? null;
    $blocked = filter_var($blockedInput, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
    if ($blocked === null) {
        echo json_encode(["status" => "error", "message" => "BLOCKED_FLAG_REQUIRED"]);
        exit;
    }
    $user = admin_fetch_user_or_fail($db, $userId);
    $isSelfTarget = is_array($requestAuthUser) && !empty($requestAuthUser['id']) && hash_equals((string)$requestAuthUser['id'], (string)$userId);
    $targetRole = strtoupper((string)($user['role'] ?? 'USER'));
    $targetEmail = strtolower(trim((string)($user['email'] ?? '')));
    if ($isSelfTarget) {
        echo json_encode(["status" => "error", "message" => "SELF_BLOCK_NOT_ALLOWED"]);
        exit;
    }
    if ($targetRole === 'OWNER' || is_owner_identity_email($targetEmail, $db)) {
        echo json_encode(["status" => "error", "message" => "OWNER_BLOCK_NOT_ALLOWED"]);
        exit;
    }
    if (!column_exists($db, 'users', 'is_blocked')) {
        echo json_encode(["status" => "error", "message" => "USER_BLOCK_FIELD_MISSING"]);
        exit;
    }
    $update = $db->prepare("UPDATE users SET is_blocked = ?, updated_at = NOW() WHERE id = ?");
    $update->execute([$blocked ? 1 : 0, $userId]);
    $actor = (string)($requestAuthUser['id'] ?? $requestAuthUser['email'] ?? 'admin_key');
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'UNKNOWN';
    log_system_event($db, 'ADMIN_USER_BLOCK_TOGGLE', "User {$userId} block status set to " . ($blocked ? 'BLOCKED' : 'ACTIVE'), $actor, $ip);
    log_audit_event(
        $db,
        $actor,
        $blocked ? 'USER_BLOCKED' : 'USER_UNBLOCKED',
        'USER',
        $userId,
        ['isBlocked' => ((int)($user['is_blocked'] ?? 0) === 1)],
        ['isBlocked' => $blocked],
        $ip
    );
    echo json_encode([
        "status" => "success",
        "data" => [
            "id" => $userId,
            "isBlocked" => $blocked
        ]
    ]);
    exit;
}

if ($method === 'POST' && $action === 'admin_user_role') {
    require_admin_access($requestAuthUser);
    require_csrf_token();
    $input = json_decode(file_get_contents('php://input'), true);
    if (!is_array($input)) {
        echo json_encode(["status" => "error", "message" => "INVALID_PAYLOAD"]);
        exit;
    }
    $userId = trim((string)($input['id'] ?? $input['userId'] ?? ''));
    $nextRole = strtoupper(trim((string)($input['role'] ?? '')));
    if ($userId === '' || $nextRole === '') {
        echo json_encode(["status" => "error", "message" => "USER_ID_AND_ROLE_REQUIRED"]);
        exit;
    }
    $allowedRoles = ['USER', 'VIEWER', 'STAFF', 'EDITOR', 'ADMIN', 'OWNER', 'SUPER_ADMIN'];
    if (!in_array($nextRole, $allowedRoles, true)) {
        echo json_encode(["status" => "error", "message" => "INVALID_ROLE"]);
        exit;
    }
    $user = admin_fetch_user_or_fail($db, $userId);
    $isSelfTarget = is_array($requestAuthUser) && !empty($requestAuthUser['id']) && hash_equals((string)$requestAuthUser['id'], (string)$userId);
    $targetRole = strtoupper((string)($user['role'] ?? 'USER'));
    $targetEmail = strtolower(trim((string)($user['email'] ?? '')));
    $requestRole = get_admin_role($requestAuthUser);
    if ($targetRole === 'OWNER' || is_owner_identity_email($targetEmail, $db)) {
        if ($nextRole !== 'OWNER') {
            echo json_encode(["status" => "error", "message" => "OWNER_ROLE_LOCKED"]);
            exit;
        }
    }
    if ($isSelfTarget && $requestRole === 'OWNER' && $nextRole !== 'OWNER') {
        echo json_encode(["status" => "error", "message" => "OWNER_SELF_DEMOTE_NOT_ALLOWED"]);
        exit;
    }
    if ($isSelfTarget && in_array($requestRole, ['ADMIN', 'SUPER_ADMIN'], true) && $nextRole === 'USER') {
        echo json_encode(["status" => "error", "message" => "SELF_DEMOTE_NOT_ALLOWED"]);
        exit;
    }
    $update = $db->prepare("UPDATE users SET role = ?, updated_at = NOW() WHERE id = ?");
    $update->execute([$nextRole, $userId]);
    $actor = (string)($requestAuthUser['id'] ?? $requestAuthUser['email'] ?? 'admin_key');
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'UNKNOWN';
    log_system_event($db, 'ADMIN_USER_ROLE_UPDATE', "User {$userId} role updated to {$nextRole}", $actor, $ip);
    log_audit_event(
        $db,
        $actor,
        'USER_ROLE_UPDATED',
        'USER',
        $userId,
        ['role' => strtoupper((string)($user['role'] ?? 'USER'))],
        ['role' => $nextRole],
        $ip
    );
    echo json_encode([
        "status" => "success",
        "data" => [
            "id" => $userId,
            "role" => $nextRole
        ]
    ]);
    exit;
}

if ($method === 'GET' && $action === 'admin_permission_matrix') {
    require_admin_access($requestAuthUser);
    try {
        $roles = safe_query_all($db, "SELECT id, name, description, created_at FROM admin_roles ORDER BY FIELD(id, 'SUPER_ADMIN', 'ADMIN', 'STAFF', 'EDITOR', 'VIEWER'), id ASC");
        $permissions = safe_query_all($db, "SELECT id, label, created_at FROM admin_permissions ORDER BY id ASC");
        $links = safe_query_all($db, "SELECT role_id, permission_id FROM admin_role_permissions");

        $matrix = [];
        foreach ($roles as $roleRow) {
            $roleId = (string)($roleRow['id'] ?? '');
            if ($roleId === '') continue;
            $matrix[$roleId] = [];
        }
        foreach ($links as $linkRow) {
            $roleId = (string)($linkRow['role_id'] ?? '');
            $permissionId = (string)($linkRow['permission_id'] ?? '');
            if ($roleId === '' || $permissionId === '') continue;
            if (!isset($matrix[$roleId])) {
                $matrix[$roleId] = [];
            }
            $matrix[$roleId][] = $permissionId;
        }
        foreach ($matrix as $roleId => $permissionIds) {
            $unique = array_values(array_unique(array_map('strval', $permissionIds)));
            sort($unique, SORT_STRING);
            $matrix[$roleId] = $unique;
        }

        echo json_encode([
            "status" => "success",
            "data" => [
                "roles" => array_map(function ($role) {
                    return [
                        "id" => (string)($role['id'] ?? ''),
                        "name" => (string)($role['name'] ?? ''),
                        "description" => (string)($role['description'] ?? ''),
                        "createdAt" => (string)($role['created_at'] ?? '')
                    ];
                }, $roles),
                "permissions" => array_map(function ($permission) {
                    return [
                        "id" => (string)($permission['id'] ?? ''),
                        "label" => (string)($permission['label'] ?? ''),
                        "createdAt" => (string)($permission['created_at'] ?? '')
                    ];
                }, $permissions),
                "matrix" => $matrix
            ]
        ]);
    } catch (Throwable $e) {
        splaro_log_exception('admin.permission_matrix.get', $e);
        echo json_encode(["status" => "error", "message" => "PERMISSION_MATRIX_FETCH_FAILED"]);
    }
    exit;
}

if ($method === 'POST' && $action === 'admin_permission_matrix_update') {
    require_admin_access($requestAuthUser);
    require_csrf_token();
    $adminRole = get_admin_role($requestAuthUser);
    if (is_array($requestAuthUser) && !in_array($adminRole, ['OWNER', 'ADMIN', 'SUPER_ADMIN'], true)) {
        echo json_encode(["status" => "error", "message" => "PERMISSION_UPDATE_ACCESS_REQUIRED"]);
        exit;
    }

    $rawBody = file_get_contents('php://input');
    $input = json_decode((string)$rawBody, true);
    if ($input === null && json_last_error() !== JSON_ERROR_NONE) {
        splaro_integration_trace('admin.permission_matrix_update.decode_failed', [
            'json_error' => json_last_error_msg(),
            'body_preview' => splaro_clip_text((string)$rawBody, 300)
        ], 'ERROR');
    }
    if (!is_array($input)) {
        echo json_encode(["status" => "error", "message" => "INVALID_PAYLOAD"]);
        exit;
    }

    $roleId = strtoupper(trim((string)($input['roleId'] ?? $input['role_id'] ?? '')));
    $permissionIdsRaw = $input['permissionIds'] ?? ($input['permission_ids'] ?? []);
    if ($roleId === '') {
        echo json_encode(["status" => "error", "message" => "ROLE_ID_REQUIRED"]);
        exit;
    }
    if (!is_array($permissionIdsRaw)) {
        echo json_encode(["status" => "error", "message" => "PERMISSION_IDS_REQUIRED"]);
        exit;
    }

    $permissionIds = [];
    foreach ($permissionIdsRaw as $permissionIdRaw) {
        $permissionId = strtolower(trim((string)$permissionIdRaw));
        if ($permissionId === '') continue;
        $permissionIds[$permissionId] = true;
    }
    $permissionIds = array_values(array_keys($permissionIds));

    try {
        $roleStmt = $db->prepare("SELECT id FROM admin_roles WHERE id = ? LIMIT 1");
        $roleStmt->execute([$roleId]);
        $roleRow = $roleStmt->fetch();
        if (!$roleRow) {
            echo json_encode(["status" => "error", "message" => "ROLE_NOT_FOUND"]);
            exit;
        }

        $validPermissionIds = [];
        if (!empty($permissionIds)) {
            $in = implode(',', array_fill(0, count($permissionIds), '?'));
            $permissionRows = safe_query_all($db, "SELECT id FROM admin_permissions WHERE id IN ({$in})", $permissionIds);
            foreach ($permissionRows as $permissionRow) {
                $validPermissionIds[] = (string)($permissionRow['id'] ?? '');
            }
            sort($validPermissionIds, SORT_STRING);
            sort($permissionIds, SORT_STRING);
            if ($validPermissionIds !== $permissionIds) {
                echo json_encode(["status" => "error", "message" => "INVALID_PERMISSION_IDS"]);
                exit;
            }
        }

        $db->beginTransaction();
        $beforeRows = safe_query_all($db, "SELECT permission_id FROM admin_role_permissions WHERE role_id = ?", [$roleId]);
        $beforeIds = [];
        foreach ($beforeRows as $beforeRow) {
            $beforeIds[] = (string)($beforeRow['permission_id'] ?? '');
        }
        sort($beforeIds, SORT_STRING);

        $db->prepare("DELETE FROM admin_role_permissions WHERE role_id = ?")->execute([$roleId]);
        if (!empty($permissionIds)) {
            $insert = $db->prepare("INSERT INTO admin_role_permissions (role_id, permission_id, created_at) VALUES (?, ?, NOW())");
            foreach ($permissionIds as $permissionId) {
                $insert->execute([$roleId, $permissionId]);
            }
        }
        $db->commit();

        $actor = (string)($requestAuthUser['id'] ?? $requestAuthUser['email'] ?? 'admin_key');
        $ip = get_request_ip();
        log_system_event($db, 'ADMIN_PERMISSION_MATRIX_UPDATE', "Permissions updated for role {$roleId}", $actor, $ip);
        log_audit_event(
            $db,
            $actor,
            'RBAC_PERMISSION_MATRIX_UPDATED',
            'ADMIN_ROLE',
            $roleId,
            ['permissionIds' => $beforeIds],
            ['permissionIds' => $permissionIds],
            $ip
        );

        echo json_encode([
            "status" => "success",
            "data" => [
                "roleId" => $roleId,
                "permissionIds" => $permissionIds
            ]
        ]);
    } catch (Throwable $e) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        splaro_log_exception('admin.permission_matrix.update', $e, [
            'role_id' => (string)$roleId
        ]);
        echo json_encode(["status" => "error", "message" => "PERMISSION_MATRIX_UPDATE_FAILED"]);
    }
    exit;
}

if ($method === 'GET' && $action === 'admin_api_keys') {
    require_admin_access($requestAuthUser);
    $adminRole = get_admin_role($requestAuthUser);
    if (is_array($requestAuthUser) && !in_array($adminRole, ['OWNER', 'ADMIN', 'SUPER_ADMIN'], true)) {
        echo json_encode(["status" => "error", "message" => "API_KEY_VIEW_ACCESS_REQUIRED"]);
        exit;
    }

    $pagination = admin_parse_pagination_params(20, 100);
    $limit = (int)$pagination['limit'];
    $offset = (int)$pagination['offset'];
    $search = trim((string)($_GET['search'] ?? ''));
    $activeFilter = trim((string)($_GET['active'] ?? ''));

    $where = [];
    $params = [];
    if ($search !== '') {
        $wild = '%' . $search . '%';
        $where[] = "(key_name LIKE ? OR key_prefix LIKE ? OR created_by LIKE ? OR last_used_ip LIKE ?)";
        $params[] = $wild;
        $params[] = $wild;
        $params[] = $wild;
        $params[] = $wild;
    }
    if ($activeFilter !== '') {
        $active = filter_var($activeFilter, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
        if ($active !== null) {
            if ($active) {
                $where[] = "revoked_at IS NULL AND (expires_at IS NULL OR expires_at > NOW())";
            } else {
                $where[] = "(revoked_at IS NOT NULL OR (expires_at IS NOT NULL AND expires_at <= NOW()))";
            }
        }
    }
    $whereSql = $where ? ('WHERE ' . implode(' AND ', $where)) : '';

    $total = safe_query_count($db, "SELECT COUNT(*) FROM admin_api_keys {$whereSql}", $params);
    $rows = safe_query_all(
        $db,
        "SELECT id, key_name, key_prefix, scopes_json, created_by, last_used_at, last_used_ip, expires_at, revoked_at, created_at, updated_at
         FROM admin_api_keys
         {$whereSql}
         ORDER BY id DESC
         LIMIT {$limit} OFFSET {$offset}",
        $params
    );

    $items = [];
    foreach ($rows as $row) {
        $scopes = safe_json_decode_assoc($row['scopes_json'] ?? '[]', []);
        if (!is_array($scopes)) $scopes = [];
        $isExpired = !empty($row['expires_at']) && strtotime((string)$row['expires_at']) !== false && strtotime((string)$row['expires_at']) <= time();
        $items[] = [
            "id" => (int)($row['id'] ?? 0),
            "keyName" => (string)($row['key_name'] ?? ''),
            "keyPrefix" => (string)($row['key_prefix'] ?? ''),
            "scopes" => array_values(array_map('strval', $scopes)),
            "createdBy" => (string)($row['created_by'] ?? ''),
            "lastUsedAt" => $row['last_used_at'] ?? null,
            "lastUsedIp" => (string)($row['last_used_ip'] ?? ''),
            "expiresAt" => $row['expires_at'] ?? null,
            "revokedAt" => $row['revoked_at'] ?? null,
            "isActive" => empty($row['revoked_at']) && !$isExpired,
            "createdAt" => (string)($row['created_at'] ?? ''),
            "updatedAt" => (string)($row['updated_at'] ?? '')
        ];
    }

    echo json_encode([
        "status" => "success",
        "data" => $items,
        "meta" => [
            "page" => (int)$pagination['page'],
            "limit" => $limit,
            "total" => $total
        ]
    ]);
    exit;
}

if ($method === 'POST' && $action === 'admin_api_key_create') {
    require_admin_access($requestAuthUser);
    require_csrf_token();
    $adminRole = get_admin_role($requestAuthUser);
    if (is_array($requestAuthUser) && !in_array($adminRole, ['OWNER', 'ADMIN', 'SUPER_ADMIN'], true)) {
        echo json_encode(["status" => "error", "message" => "API_KEY_CREATE_ACCESS_REQUIRED"]);
        exit;
    }

    $rawBody = file_get_contents('php://input');
    $input = json_decode((string)$rawBody, true);
    if ($input === null && json_last_error() !== JSON_ERROR_NONE) {
        splaro_integration_trace('admin.api_key_create.decode_failed', [
            'json_error' => json_last_error_msg(),
            'body_preview' => splaro_clip_text((string)$rawBody, 300)
        ], 'ERROR');
    }
    if (!is_array($input)) {
        echo json_encode(["status" => "error", "message" => "INVALID_PAYLOAD"]);
        exit;
    }

    $keyName = splaro_clip_text(trim((string)($input['keyName'] ?? $input['key_name'] ?? '')), 120);
    if ($keyName === '') {
        echo json_encode(["status" => "error", "message" => "KEY_NAME_REQUIRED"]);
        exit;
    }
    $scopes = normalize_admin_scopes($input['scopes'] ?? []);

    $expiresAtRaw = trim((string)($input['expiresAt'] ?? $input['expires_at'] ?? ''));
    $expiresAt = null;
    if ($expiresAtRaw !== '') {
        $expiresTs = strtotime($expiresAtRaw);
        if ($expiresTs === false) {
            echo json_encode(["status" => "error", "message" => "INVALID_EXPIRES_AT"]);
            exit;
        }
        if ($expiresTs <= time()) {
            echo json_encode(["status" => "error", "message" => "EXPIRES_AT_MUST_BE_FUTURE"]);
            exit;
        }
        $expiresAt = date('Y-m-d H:i:s', $expiresTs);
    }

    $scopesJson = json_encode($scopes, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if (!is_string($scopesJson)) {
        splaro_integration_trace('admin.api_key_create.scopes_encode_failed', [
            'json_error' => json_last_error_msg(),
            'scope_count' => count($scopes)
        ], 'ERROR');
        echo json_encode(["status" => "error", "message" => "INVALID_SCOPES"]);
        exit;
    }

    try {
        $entropy = bin2hex(random_bytes(24));
    } catch (Throwable $e) {
        splaro_log_exception('admin.api_key_create.random_bytes', $e);
        $entropy = bin2hex(openssl_random_pseudo_bytes(24));
    }
    $rawApiKey = ADMIN_API_KEY_PREFIX . '_' . $entropy;
    $keyPrefix = substr($rawApiKey, 0, 32);
    $keyHash = admin_api_key_hash($rawApiKey);

    try {
        $stmt = $db->prepare("INSERT INTO admin_api_keys (key_name, key_prefix, key_hash, scopes_json, created_by, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())");
        $actor = (string)($requestAuthUser['id'] ?? $requestAuthUser['email'] ?? 'admin_key');
        $stmt->execute([
            $keyName,
            $keyPrefix,
            $keyHash,
            $scopesJson,
            $actor,
            $expiresAt
        ]);
        $keyId = (int)$db->lastInsertId();

        $ip = get_request_ip();
        log_system_event($db, 'ADMIN_API_KEY_CREATED', "Admin API key {$keyId} created", $actor, $ip);
        log_audit_event(
            $db,
            $actor,
            'ADMIN_API_KEY_CREATED',
            'ADMIN_API_KEY',
            (string)$keyId,
            null,
            [
                'keyName' => $keyName,
                'keyPrefix' => $keyPrefix,
                'scopes' => $scopes,
                'expiresAt' => $expiresAt
            ],
            $ip
        );

        echo json_encode([
            "status" => "success",
            "data" => [
                "id" => $keyId,
                "keyName" => $keyName,
                "keyPrefix" => $keyPrefix,
                "scopes" => $scopes,
                "expiresAt" => $expiresAt,
                "apiKey" => $rawApiKey
            ]
        ]);
    } catch (Throwable $e) {
        splaro_log_exception('admin.api_key_create', $e, ['key_name' => (string)$keyName]);
        echo json_encode(["status" => "error", "message" => "API_KEY_CREATE_FAILED"]);
    }
    exit;
}

if ($method === 'POST' && $action === 'admin_api_key_revoke') {
    require_admin_access($requestAuthUser);
    require_csrf_token();
    $adminRole = get_admin_role($requestAuthUser);
    if (is_array($requestAuthUser) && !in_array($adminRole, ['OWNER', 'ADMIN', 'SUPER_ADMIN'], true)) {
        echo json_encode(["status" => "error", "message" => "API_KEY_REVOKE_ACCESS_REQUIRED"]);
        exit;
    }

    $rawBody = file_get_contents('php://input');
    $input = json_decode((string)$rawBody, true);
    if ($input === null && json_last_error() !== JSON_ERROR_NONE) {
        splaro_integration_trace('admin.api_key_revoke.decode_failed', [
            'json_error' => json_last_error_msg(),
            'body_preview' => splaro_clip_text((string)$rawBody, 300)
        ], 'ERROR');
    }
    if (!is_array($input)) {
        echo json_encode(["status" => "error", "message" => "INVALID_PAYLOAD"]);
        exit;
    }

    $keyId = (int)($input['id'] ?? $input['keyId'] ?? 0);
    if ($keyId <= 0) {
        echo json_encode(["status" => "error", "message" => "KEY_ID_REQUIRED"]);
        exit;
    }

    try {
        $lookup = $db->prepare("SELECT id, revoked_at FROM admin_api_keys WHERE id = ? LIMIT 1");
        $lookup->execute([$keyId]);
        $row = $lookup->fetch();
        if (!$row) {
            echo json_encode(["status" => "error", "message" => "API_KEY_NOT_FOUND"]);
            exit;
        }

        if (!empty($row['revoked_at'])) {
            echo json_encode(["status" => "success", "message" => "ALREADY_REVOKED"]);
            exit;
        }

        $db->prepare("UPDATE admin_api_keys SET revoked_at = NOW(), updated_at = NOW() WHERE id = ?")->execute([$keyId]);
        $actor = (string)($requestAuthUser['id'] ?? $requestAuthUser['email'] ?? 'admin_key');
        $ip = get_request_ip();
        log_system_event($db, 'ADMIN_API_KEY_REVOKED', "Admin API key {$keyId} revoked", $actor, $ip);
        log_audit_event(
            $db,
            $actor,
            'ADMIN_API_KEY_REVOKED',
            'ADMIN_API_KEY',
            (string)$keyId,
            ['revokedAt' => null],
            ['revokedAt' => date('Y-m-d H:i:s')],
            $ip
        );

        echo json_encode(["status" => "success", "message" => "API_KEY_REVOKED"]);
    } catch (Throwable $e) {
        splaro_log_exception('admin.api_key_revoke', $e, ['id' => $keyId]);
        echo json_encode(["status" => "error", "message" => "API_KEY_REVOKE_FAILED"]);
    }
    exit;
}

if ($method === 'GET' && $action === 'admin_ip_allowlist') {
    require_admin_access($requestAuthUser);
    $adminRole = get_admin_role($requestAuthUser);
    if (is_array($requestAuthUser) && !in_array($adminRole, ['OWNER', 'ADMIN', 'SUPER_ADMIN'], true)) {
        echo json_encode(["status" => "error", "message" => "IP_ALLOWLIST_VIEW_ACCESS_REQUIRED"]);
        exit;
    }

    try {
        $rows = safe_query_all(
            $db,
            "SELECT id, cidr, label, is_active, created_by, created_at, updated_at
             FROM admin_ip_allowlist
             ORDER BY is_active DESC, updated_at DESC, id DESC"
        );
        $requestIp = get_request_ip();
        $allowed = admin_ip_allowlist_is_allowed($db, $requestIp);
        echo json_encode([
            "status" => "success",
            "data" => array_map(function ($row) {
                return [
                    "id" => (int)($row['id'] ?? 0),
                    "cidr" => (string)($row['cidr'] ?? ''),
                    "label" => (string)($row['label'] ?? ''),
                    "isActive" => (int)($row['is_active'] ?? 0) === 1,
                    "createdBy" => (string)($row['created_by'] ?? ''),
                    "createdAt" => (string)($row['created_at'] ?? ''),
                    "updatedAt" => (string)($row['updated_at'] ?? '')
                ];
            }, $rows),
            "meta" => [
                "requestIp" => $requestIp,
                "requestAllowed" => $allowed
            ]
        ]);
    } catch (Throwable $e) {
        splaro_log_exception('admin.ip_allowlist.get', $e);
        echo json_encode(["status" => "error", "message" => "IP_ALLOWLIST_FETCH_FAILED"]);
    }
    exit;
}

if ($method === 'POST' && $action === 'admin_ip_allowlist_upsert') {
    require_admin_access($requestAuthUser);
    require_csrf_token();
    $adminRole = get_admin_role($requestAuthUser);
    if (is_array($requestAuthUser) && !in_array($adminRole, ['OWNER', 'ADMIN', 'SUPER_ADMIN'], true)) {
        echo json_encode(["status" => "error", "message" => "IP_ALLOWLIST_UPDATE_ACCESS_REQUIRED"]);
        exit;
    }

    $rawBody = file_get_contents('php://input');
    $input = json_decode((string)$rawBody, true);
    if ($input === null && json_last_error() !== JSON_ERROR_NONE) {
        splaro_integration_trace('admin.ip_allowlist_upsert.decode_failed', [
            'json_error' => json_last_error_msg(),
            'body_preview' => splaro_clip_text((string)$rawBody, 300)
        ], 'ERROR');
    }
    if (!is_array($input)) {
        echo json_encode(["status" => "error", "message" => "INVALID_PAYLOAD"]);
        exit;
    }

    $id = (int)($input['id'] ?? 0);
    $cidr = trim((string)($input['cidr'] ?? ''));
    $label = splaro_clip_text(trim((string)($input['label'] ?? '')), 120);
    $isActiveInput = $input['isActive'] ?? ($input['is_active'] ?? true);
    $isActive = filter_var($isActiveInput, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
    if ($isActive === null) $isActive = true;

    if ($cidr === '' || !is_valid_ip_or_cidr($cidr)) {
        echo json_encode(["status" => "error", "message" => "VALID_CIDR_REQUIRED"]);
        exit;
    }

    try {
        $actor = (string)($requestAuthUser['id'] ?? $requestAuthUser['email'] ?? 'admin_key');
        if ($id > 0) {
            $beforeStmt = $db->prepare("SELECT id, cidr, label, is_active FROM admin_ip_allowlist WHERE id = ? LIMIT 1");
            $beforeStmt->execute([$id]);
            $before = $beforeStmt->fetch();
            if (!$before) {
                echo json_encode(["status" => "error", "message" => "ALLOWLIST_ENTRY_NOT_FOUND"]);
                exit;
            }

            $stmt = $db->prepare("UPDATE admin_ip_allowlist SET cidr = ?, label = ?, is_active = ?, updated_at = NOW() WHERE id = ?");
            $stmt->execute([$cidr, $label !== '' ? $label : null, $isActive ? 1 : 0, $id]);
            $entryId = $id;

            log_audit_event(
                $db,
                $actor,
                'ADMIN_IP_ALLOWLIST_UPDATED',
                'ADMIN_IP_ALLOWLIST',
                (string)$entryId,
                [
                    'cidr' => (string)($before['cidr'] ?? ''),
                    'label' => (string)($before['label'] ?? ''),
                    'isActive' => (int)($before['is_active'] ?? 0) === 1
                ],
                [
                    'cidr' => $cidr,
                    'label' => $label,
                    'isActive' => (bool)$isActive
                ],
                get_request_ip()
            );
        } else {
            $stmt = $db->prepare("INSERT INTO admin_ip_allowlist (cidr, label, is_active, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())");
            $stmt->execute([$cidr, $label !== '' ? $label : null, $isActive ? 1 : 0, $actor]);
            $entryId = (int)$db->lastInsertId();

            log_audit_event(
                $db,
                $actor,
                'ADMIN_IP_ALLOWLIST_CREATED',
                'ADMIN_IP_ALLOWLIST',
                (string)$entryId,
                null,
                [
                    'cidr' => $cidr,
                    'label' => $label,
                    'isActive' => (bool)$isActive
                ],
                get_request_ip()
            );
        }

        log_system_event($db, 'ADMIN_IP_ALLOWLIST_UPSERT', "Admin IP allowlist entry {$entryId} upserted", $actor, get_request_ip());
        echo json_encode([
            "status" => "success",
            "data" => [
                "id" => $entryId,
                "cidr" => $cidr,
                "label" => $label,
                "isActive" => (bool)$isActive
            ]
        ]);
    } catch (Throwable $e) {
        $code = strtoupper((string)$e->getCode());
        $message = strtolower((string)$e->getMessage());
        if ($code === '23000' || strpos($message, 'duplicate') !== false) {
            echo json_encode(["status" => "error", "message" => "ALLOWLIST_ENTRY_DUPLICATE"]);
        } else {
            splaro_log_exception('admin.ip_allowlist.upsert', $e, ['id' => $id, 'cidr' => $cidr]);
            echo json_encode(["status" => "error", "message" => "IP_ALLOWLIST_UPSERT_FAILED"]);
        }
    }
    exit;
}

if ($method === 'POST' && $action === 'admin_ip_allowlist_delete') {
    require_admin_access($requestAuthUser);
    require_csrf_token();
    $adminRole = get_admin_role($requestAuthUser);
    if (is_array($requestAuthUser) && !in_array($adminRole, ['OWNER', 'ADMIN', 'SUPER_ADMIN'], true)) {
        echo json_encode(["status" => "error", "message" => "IP_ALLOWLIST_DELETE_ACCESS_REQUIRED"]);
        exit;
    }

    $rawBody = file_get_contents('php://input');
    $input = json_decode((string)$rawBody, true);
    if ($input === null && json_last_error() !== JSON_ERROR_NONE) {
        splaro_integration_trace('admin.ip_allowlist_delete.decode_failed', [
            'json_error' => json_last_error_msg(),
            'body_preview' => splaro_clip_text((string)$rawBody, 300)
        ], 'ERROR');
    }
    if (!is_array($input)) {
        echo json_encode(["status" => "error", "message" => "INVALID_PAYLOAD"]);
        exit;
    }

    $id = (int)($input['id'] ?? 0);
    if ($id <= 0) {
        echo json_encode(["status" => "error", "message" => "ALLOWLIST_ID_REQUIRED"]);
        exit;
    }

    try {
        $beforeStmt = $db->prepare("SELECT id, cidr, label, is_active FROM admin_ip_allowlist WHERE id = ? LIMIT 1");
        $beforeStmt->execute([$id]);
        $before = $beforeStmt->fetch();
        if (!$before) {
            echo json_encode(["status" => "error", "message" => "ALLOWLIST_ENTRY_NOT_FOUND"]);
            exit;
        }

        $db->prepare("DELETE FROM admin_ip_allowlist WHERE id = ?")->execute([$id]);
        $actor = (string)($requestAuthUser['id'] ?? $requestAuthUser['email'] ?? 'admin_key');
        $ip = get_request_ip();
        log_system_event($db, 'ADMIN_IP_ALLOWLIST_DELETED', "Admin IP allowlist entry {$id} deleted", $actor, $ip);
        log_audit_event(
            $db,
            $actor,
            'ADMIN_IP_ALLOWLIST_DELETED',
            'ADMIN_IP_ALLOWLIST',
            (string)$id,
            [
                'cidr' => (string)($before['cidr'] ?? ''),
                'label' => (string)($before['label'] ?? ''),
                'isActive' => (int)($before['is_active'] ?? 0) === 1
            ],
            null,
            $ip
        );

        echo json_encode(["status" => "success", "message" => "ALLOWLIST_ENTRY_DELETED"]);
    } catch (Throwable $e) {
        splaro_log_exception('admin.ip_allowlist.delete', $e, ['id' => $id]);
        echo json_encode(["status" => "error", "message" => "IP_ALLOWLIST_DELETE_FAILED"]);
    }
    exit;
}

if ($method === 'GET' && $action === 'admin_stock_movements') {
    require_admin_access($requestAuthUser);
    $pagination = admin_parse_pagination_params(30, 200);
    $limit = (int)$pagination['limit'];
    $offset = (int)$pagination['offset'];
    $search = trim((string)($_GET['search'] ?? ''));
    $productId = trim((string)($_GET['productId'] ?? $_GET['product_id'] ?? ''));
    $variantId = (int)($_GET['variantId'] ?? $_GET['variant_id'] ?? 0);
    $movementType = strtoupper(trim((string)($_GET['movementType'] ?? $_GET['movement_type'] ?? '')));

    $where = [];
    $params = [];
    if ($search !== '') {
        $wild = '%' . $search . '%';
        $where[] = "(sm.product_id LIKE ? OR p.name LIKE ? OR sm.reason LIKE ? OR sm.reference_id LIKE ? OR sm.actor_id LIKE ?)";
        $params[] = $wild;
        $params[] = $wild;
        $params[] = $wild;
        $params[] = $wild;
        $params[] = $wild;
    }
    if ($productId !== '') {
        $where[] = "sm.product_id = ?";
        $params[] = $productId;
    }
    if ($variantId > 0) {
        $where[] = "sm.variant_id = ?";
        $params[] = $variantId;
    }
    if ($movementType !== '') {
        $where[] = "UPPER(sm.movement_type) = ?";
        $params[] = $movementType;
    }
    $whereSql = $where ? ('WHERE ' . implode(' AND ', $where)) : '';

    $total = safe_query_count(
        $db,
        "SELECT COUNT(*)
         FROM stock_movements sm
         LEFT JOIN products p ON p.id = sm.product_id
         LEFT JOIN product_variants pv ON pv.id = sm.variant_id
         {$whereSql}",
        $params
    );
    $rows = safe_query_all(
        $db,
        "SELECT
            sm.id,
            sm.product_id,
            p.name AS product_name,
            sm.variant_id,
            pv.variant_sku,
            sm.movement_type,
            sm.delta_qty,
            sm.stock_before,
            sm.stock_after,
            sm.reason,
            sm.reference_type,
            sm.reference_id,
            sm.actor_id,
            sm.ip_address,
            sm.created_at
         FROM stock_movements sm
         LEFT JOIN products p ON p.id = sm.product_id
         LEFT JOIN product_variants pv ON pv.id = sm.variant_id
         {$whereSql}
         ORDER BY sm.id DESC
         LIMIT {$limit} OFFSET {$offset}",
        $params
    );

    echo json_encode([
        "status" => "success",
        "data" => array_map(function ($row) {
            return [
                "id" => (int)($row['id'] ?? 0),
                "productId" => (string)($row['product_id'] ?? ''),
                "productName" => (string)($row['product_name'] ?? ''),
                "variantId" => !empty($row['variant_id']) ? (int)$row['variant_id'] : null,
                "variantSku" => (string)($row['variant_sku'] ?? ''),
                "movementType" => (string)($row['movement_type'] ?? ''),
                "deltaQty" => (int)($row['delta_qty'] ?? 0),
                "stockBefore" => isset($row['stock_before']) ? (int)$row['stock_before'] : null,
                "stockAfter" => isset($row['stock_after']) ? (int)$row['stock_after'] : null,
                "reason" => (string)($row['reason'] ?? ''),
                "referenceType" => (string)($row['reference_type'] ?? ''),
                "referenceId" => (string)($row['reference_id'] ?? ''),
                "actorId" => (string)($row['actor_id'] ?? ''),
                "ipAddress" => (string)($row['ip_address'] ?? ''),
                "createdAt" => (string)($row['created_at'] ?? '')
            ];
        }, $rows),
        "meta" => [
            "page" => (int)$pagination['page'],
            "limit" => $limit,
            "total" => $total
        ]
    ]);
    exit;
}

if ($method === 'POST' && $action === 'admin_stock_adjust') {
    require_admin_access($requestAuthUser);
    require_csrf_token();
    $adminRole = get_admin_role($requestAuthUser);
    if (is_array($requestAuthUser) && !in_array($adminRole, ['OWNER', 'ADMIN', 'SUPER_ADMIN', 'EDITOR', 'STAFF'], true)) {
        echo json_encode(["status" => "error", "message" => "STOCK_ADJUST_ACCESS_REQUIRED"]);
        exit;
    }

    $rawBody = file_get_contents('php://input');
    $input = json_decode((string)$rawBody, true);
    if ($input === null && json_last_error() !== JSON_ERROR_NONE) {
        splaro_integration_trace('admin.stock_adjust.decode_failed', [
            'json_error' => json_last_error_msg(),
            'body_preview' => splaro_clip_text((string)$rawBody, 300)
        ], 'ERROR');
    }
    if (!is_array($input)) {
        echo json_encode(["status" => "error", "message" => "INVALID_PAYLOAD"]);
        exit;
    }

    $productId = trim((string)($input['productId'] ?? $input['product_id'] ?? ''));
    $variantId = (int)($input['variantId'] ?? $input['variant_id'] ?? 0);
    $deltaQtyRaw = $input['deltaQty'] ?? $input['delta_qty'] ?? null;
    $stockAfterRaw = $input['stockAfter'] ?? $input['stock_after'] ?? null;
    $reason = splaro_clip_text(trim((string)($input['reason'] ?? 'Manual stock adjustment')), 191);

    if ($productId === '' && $variantId <= 0) {
        echo json_encode(["status" => "error", "message" => "PRODUCT_OR_VARIANT_REQUIRED"]);
        exit;
    }
    if ($deltaQtyRaw === null && $stockAfterRaw === null) {
        echo json_encode(["status" => "error", "message" => "DELTA_OR_STOCK_REQUIRED"]);
        exit;
    }

    try {
        $db->beginTransaction();
        $stockBefore = 0;
        $stockAfter = 0;
        $deltaQty = 0;
        $resolvedProductId = $productId;
        $resolvedVariantId = $variantId > 0 ? $variantId : null;

        if ($variantId > 0) {
            $variantStmt = $db->prepare("SELECT id, product_id, stock FROM product_variants WHERE id = ? AND deleted_at IS NULL LIMIT 1");
            $variantStmt->execute([$variantId]);
            $variant = $variantStmt->fetch();
            if (!$variant) {
                if ($db->inTransaction()) $db->rollBack();
                echo json_encode(["status" => "error", "message" => "VARIANT_NOT_FOUND"]);
                exit;
            }
            $resolvedProductId = (string)($variant['product_id'] ?? '');
            $stockBefore = (int)($variant['stock'] ?? 0);
            if ($deltaQtyRaw !== null) {
                $deltaQty = (int)$deltaQtyRaw;
                $stockAfter = $stockBefore + $deltaQty;
            } else {
                $stockAfter = (int)$stockAfterRaw;
                $deltaQty = $stockAfter - $stockBefore;
            }
            if ($stockAfter < 0) {
                if ($db->inTransaction()) $db->rollBack();
                echo json_encode(["status" => "error", "message" => "NEGATIVE_STOCK_NOT_ALLOWED"]);
                exit;
            }
            $db->prepare("UPDATE product_variants SET stock = ?, updated_at = NOW() WHERE id = ?")->execute([$stockAfter, $variantId]);
        } else {
            $productStmt = $db->prepare("SELECT id, stock FROM products WHERE id = ? LIMIT 1");
            $productStmt->execute([$productId]);
            $productRow = $productStmt->fetch();
            if (!$productRow) {
                if ($db->inTransaction()) $db->rollBack();
                echo json_encode(["status" => "error", "message" => "PRODUCT_NOT_FOUND"]);
                exit;
            }
            $stockBefore = (int)($productRow['stock'] ?? 0);
            if ($deltaQtyRaw !== null) {
                $deltaQty = (int)$deltaQtyRaw;
                $stockAfter = $stockBefore + $deltaQty;
            } else {
                $stockAfter = (int)$stockAfterRaw;
                $deltaQty = $stockAfter - $stockBefore;
            }
            if ($stockAfter < 0) {
                if ($db->inTransaction()) $db->rollBack();
                echo json_encode(["status" => "error", "message" => "NEGATIVE_STOCK_NOT_ALLOWED"]);
                exit;
            }
            $db->prepare("UPDATE products SET stock = ?, updated_at = NOW() WHERE id = ?")->execute([$stockAfter, $productId]);
        }

        $actorId = (string)($requestAuthUser['id'] ?? $requestAuthUser['email'] ?? 'admin_key');
        $movementOk = record_stock_movement(
            $db,
            $resolvedProductId,
            $resolvedVariantId,
            'ADJUSTMENT',
            $deltaQty,
            $stockBefore,
            $stockAfter,
            $reason,
            'ADMIN',
            (string)($resolvedVariantId !== null ? $resolvedVariantId : $resolvedProductId),
            $actorId
        );
        $db->commit();

        $ip = get_request_ip();
        log_system_event($db, 'ADMIN_STOCK_ADJUST', "Stock adjusted for product {$resolvedProductId}", $actorId, $ip);
        log_audit_event(
            $db,
            $actorId,
            'STOCK_ADJUSTED',
            $resolvedVariantId !== null ? 'PRODUCT_VARIANT' : 'PRODUCT',
            (string)($resolvedVariantId !== null ? $resolvedVariantId : $resolvedProductId),
            ['stock' => $stockBefore],
            ['stock' => $stockAfter, 'deltaQty' => $deltaQty, 'reason' => $reason],
            $ip
        );

        echo json_encode([
            "status" => "success",
            "data" => [
                "productId" => $resolvedProductId,
                "variantId" => $resolvedVariantId,
                "stockBefore" => $stockBefore,
                "stockAfter" => $stockAfter,
                "deltaQty" => $deltaQty,
                "movementLogged" => $movementOk
            ]
        ]);
    } catch (Throwable $e) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        splaro_log_exception('admin.stock_adjust', $e, [
            'product_id' => (string)$productId,
            'variant_id' => $variantId > 0 ? $variantId : null
        ]);
        echo json_encode(["status" => "error", "message" => "STOCK_ADJUST_FAILED"]);
    }
    exit;
}

if ($method === 'GET' && $action === 'admin_product_variants') {
    require_admin_access($requestAuthUser);
    $pagination = admin_parse_pagination_params(20, 100);
    $limit = (int)$pagination['limit'];
    $offset = (int)$pagination['offset'];
    $productId = trim((string)($_GET['productId'] ?? $_GET['product_id'] ?? ''));
    $search = trim((string)($_GET['search'] ?? ''));
    $status = strtoupper(trim((string)($_GET['status'] ?? '')));

    $where = ["pv.deleted_at IS NULL"];
    $params = [];
    if ($productId !== '') {
        $where[] = "pv.product_id = ?";
        $params[] = $productId;
    }
    if ($search !== '') {
        $wild = '%' . $search . '%';
        $where[] = "(pv.variant_sku LIKE ? OR p.name LIKE ?)";
        $params[] = $wild;
        $params[] = $wild;
    }
    if ($status !== '') {
        $where[] = "UPPER(pv.status) = ?";
        $params[] = $status;
    }
    $whereSql = 'WHERE ' . implode(' AND ', $where);

    $total = safe_query_count(
        $db,
        "SELECT COUNT(*)
         FROM product_variants pv
         INNER JOIN products p ON p.id = pv.product_id
         {$whereSql}",
        $params
    );
    $rows = safe_query_all(
        $db,
        "SELECT
            pv.id,
            pv.product_id,
            pv.variant_sku,
            pv.attributes_json,
            pv.price_delta,
            pv.stock,
            pv.status,
            pv.sort_order,
            pv.created_at,
            pv.updated_at,
            p.name AS product_name
         FROM product_variants pv
         INNER JOIN products p ON p.id = pv.product_id
         {$whereSql}
         ORDER BY pv.updated_at DESC, pv.id DESC
         LIMIT {$limit} OFFSET {$offset}",
        $params
    );

    $data = [];
    foreach ($rows as $row) {
        $attributes = safe_json_decode_assoc($row['attributes_json'] ?? '[]', []);
        $data[] = [
            'id' => (int)($row['id'] ?? 0),
            'productId' => (string)($row['product_id'] ?? ''),
            'productName' => (string)($row['product_name'] ?? ''),
            'variantSku' => (string)($row['variant_sku'] ?? ''),
            'attributes' => is_array($attributes) ? $attributes : [],
            'priceDelta' => (float)($row['price_delta'] ?? 0),
            'stock' => (int)($row['stock'] ?? 0),
            'status' => (string)($row['status'] ?? 'ACTIVE'),
            'sortOrder' => (int)($row['sort_order'] ?? 0),
            'createdAt' => (string)($row['created_at'] ?? ''),
            'updatedAt' => (string)($row['updated_at'] ?? '')
        ];
    }

    echo json_encode([
        "status" => "success",
        "data" => $data,
        "meta" => [
            "page" => (int)$pagination['page'],
            "limit" => $limit,
            "total" => $total
        ]
    ]);
    exit;
}

if ($method === 'POST' && $action === 'admin_product_variant_upsert') {
    require_admin_access($requestAuthUser);
    require_csrf_token();
    $adminRole = get_admin_role($requestAuthUser);
    if (is_array($requestAuthUser) && !in_array($adminRole, ['OWNER', 'ADMIN', 'SUPER_ADMIN', 'EDITOR', 'STAFF'], true)) {
        echo json_encode(["status" => "error", "message" => "VARIANT_WRITE_ACCESS_REQUIRED"]);
        exit;
    }

    $rawBody = file_get_contents('php://input');
    $input = json_decode((string)$rawBody, true);
    if ($input === null && json_last_error() !== JSON_ERROR_NONE) {
        splaro_integration_trace('admin.variant_upsert.decode_failed', [
            'json_error' => json_last_error_msg(),
            'body_preview' => splaro_clip_text((string)$rawBody, 300)
        ], 'ERROR');
    }
    if (!is_array($input)) {
        echo json_encode(["status" => "error", "message" => "INVALID_PAYLOAD"]);
        exit;
    }

    $variantId = (int)($input['id'] ?? 0);
    $productId = trim((string)($input['productId'] ?? $input['product_id'] ?? ''));
    $variantSku = splaro_clip_text(trim((string)($input['variantSku'] ?? $input['variant_sku'] ?? '')), 120);
    $status = strtoupper(trim((string)($input['status'] ?? 'ACTIVE')));
    if (!in_array($status, ['ACTIVE', 'INACTIVE'], true)) {
        $status = 'ACTIVE';
    }
    $sortOrder = (int)($input['sortOrder'] ?? $input['sort_order'] ?? 0);
    $priceDelta = (float)($input['priceDelta'] ?? $input['price_delta'] ?? 0);
    $stock = (int)($input['stock'] ?? 0);
    if ($stock < 0) $stock = 0;

    if ($productId === '' || $variantSku === '') {
        echo json_encode(["status" => "error", "message" => "PRODUCT_AND_SKU_REQUIRED"]);
        exit;
    }

    $attributesRaw = $input['attributes'] ?? ($input['attributes_json'] ?? []);
    if (is_string($attributesRaw)) {
        $decodedAttrs = json_decode($attributesRaw, true);
        if ($decodedAttrs === null && json_last_error() !== JSON_ERROR_NONE) {
            splaro_integration_trace('admin.variant_upsert.attributes_decode_failed', [
                'json_error' => json_last_error_msg()
            ], 'ERROR');
            echo json_encode(["status" => "error", "message" => "INVALID_ATTRIBUTES"]);
            exit;
        }
        $attributesRaw = $decodedAttrs;
    }
    if (!is_array($attributesRaw)) {
        $attributesRaw = [];
    }
    $attributesJson = json_encode($attributesRaw, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if (!is_string($attributesJson)) {
        splaro_integration_trace('admin.variant_upsert.attributes_encode_failed', [
            'json_error' => json_last_error_msg()
        ], 'ERROR');
        echo json_encode(["status" => "error", "message" => "INVALID_ATTRIBUTES"]);
        exit;
    }

    try {
        $productStmt = $db->prepare("SELECT id FROM products WHERE id = ? LIMIT 1");
        $productStmt->execute([$productId]);
        if (!$productStmt->fetch()) {
            echo json_encode(["status" => "error", "message" => "PRODUCT_NOT_FOUND"]);
            exit;
        }

        $db->beginTransaction();
        $actorId = (string)($requestAuthUser['id'] ?? $requestAuthUser['email'] ?? 'admin_key');
        $ip = get_request_ip();

        if ($variantId > 0) {
            $existingStmt = $db->prepare("SELECT id, product_id, variant_sku, attributes_json, price_delta, stock, status, sort_order FROM product_variants WHERE id = ? AND deleted_at IS NULL LIMIT 1");
            $existingStmt->execute([$variantId]);
            $existing = $existingStmt->fetch();
            if (!$existing) {
                if ($db->inTransaction()) $db->rollBack();
                echo json_encode(["status" => "error", "message" => "VARIANT_NOT_FOUND"]);
                exit;
            }

            $dupStmt = $db->prepare("SELECT id FROM product_variants WHERE variant_sku = ? AND id <> ? AND deleted_at IS NULL LIMIT 1");
            $dupStmt->execute([$variantSku, $variantId]);
            if ($dupStmt->fetch()) {
                if ($db->inTransaction()) $db->rollBack();
                echo json_encode(["status" => "error", "message" => "VARIANT_SKU_ALREADY_EXISTS"]);
                exit;
            }

            $db->prepare("UPDATE product_variants SET product_id = ?, variant_sku = ?, attributes_json = ?, price_delta = ?, stock = ?, status = ?, sort_order = ?, updated_at = NOW() WHERE id = ?")
               ->execute([$productId, $variantSku, $attributesJson, $priceDelta, $stock, $status, $sortOrder, $variantId]);

            if ((int)($existing['stock'] ?? 0) !== $stock) {
                $deltaQty = $stock - (int)($existing['stock'] ?? 0);
                record_stock_movement(
                    $db,
                    $productId,
                    $variantId,
                    'ADJUSTMENT',
                    $deltaQty,
                    (int)($existing['stock'] ?? 0),
                    $stock,
                    'Variant stock upsert adjustment',
                    'VARIANT',
                    (string)$variantId,
                    $actorId
                );
            }

            log_audit_event(
                $db,
                $actorId,
                'PRODUCT_VARIANT_UPDATED',
                'PRODUCT_VARIANT',
                (string)$variantId,
                [
                    'variantSku' => (string)($existing['variant_sku'] ?? ''),
                    'priceDelta' => (float)($existing['price_delta'] ?? 0),
                    'stock' => (int)($existing['stock'] ?? 0),
                    'status' => (string)($existing['status'] ?? 'ACTIVE'),
                    'sortOrder' => (int)($existing['sort_order'] ?? 0)
                ],
                [
                    'variantSku' => $variantSku,
                    'priceDelta' => $priceDelta,
                    'stock' => $stock,
                    'status' => $status,
                    'sortOrder' => $sortOrder
                ],
                $ip
            );
            $resultId = $variantId;
        } else {
            $dupStmt = $db->prepare("SELECT id FROM product_variants WHERE variant_sku = ? AND deleted_at IS NULL LIMIT 1");
            $dupStmt->execute([$variantSku]);
            if ($dupStmt->fetch()) {
                if ($db->inTransaction()) $db->rollBack();
                echo json_encode(["status" => "error", "message" => "VARIANT_SKU_ALREADY_EXISTS"]);
                exit;
            }

            $db->prepare("INSERT INTO product_variants (product_id, variant_sku, attributes_json, price_delta, stock, status, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())")
               ->execute([$productId, $variantSku, $attributesJson, $priceDelta, $stock, $status, $sortOrder]);
            $resultId = (int)$db->lastInsertId();

            if ($stock !== 0) {
                record_stock_movement(
                    $db,
                    $productId,
                    $resultId,
                    'INITIAL',
                    $stock,
                    0,
                    $stock,
                    'Variant created with initial stock',
                    'VARIANT',
                    (string)$resultId,
                    $actorId
                );
            }

            log_audit_event(
                $db,
                $actorId,
                'PRODUCT_VARIANT_CREATED',
                'PRODUCT_VARIANT',
                (string)$resultId,
                null,
                [
                    'variantSku' => $variantSku,
                    'priceDelta' => $priceDelta,
                    'stock' => $stock,
                    'status' => $status,
                    'sortOrder' => $sortOrder
                ],
                $ip
            );
        }

        $db->commit();
        log_system_event($db, 'ADMIN_PRODUCT_VARIANT_UPSERT', "Variant {$resultId} upserted", $actorId, $ip);
        echo json_encode([
            "status" => "success",
            "data" => [
                "id" => $resultId,
                "productId" => $productId,
                "variantSku" => $variantSku,
                "attributes" => $attributesRaw,
                "priceDelta" => $priceDelta,
                "stock" => $stock,
                "status" => $status,
                "sortOrder" => $sortOrder
            ]
        ]);
    } catch (Throwable $e) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        splaro_log_exception('admin.variant_upsert', $e, [
            'variant_id' => $variantId > 0 ? $variantId : null,
            'product_id' => $productId
        ]);
        echo json_encode(["status" => "error", "message" => "VARIANT_UPSERT_FAILED"]);
    }
    exit;
}

if ($method === 'POST' && $action === 'admin_product_variant_delete') {
    require_admin_access($requestAuthUser);
    require_csrf_token();
    $adminRole = get_admin_role($requestAuthUser);
    if (is_array($requestAuthUser) && !in_array($adminRole, ['OWNER', 'ADMIN', 'SUPER_ADMIN', 'EDITOR', 'STAFF'], true)) {
        echo json_encode(["status" => "error", "message" => "VARIANT_DELETE_ACCESS_REQUIRED"]);
        exit;
    }

    $rawBody = file_get_contents('php://input');
    $input = json_decode((string)$rawBody, true);
    if ($input === null && json_last_error() !== JSON_ERROR_NONE) {
        splaro_integration_trace('admin.variant_delete.decode_failed', [
            'json_error' => json_last_error_msg(),
            'body_preview' => splaro_clip_text((string)$rawBody, 300)
        ], 'ERROR');
    }
    if (!is_array($input)) {
        echo json_encode(["status" => "error", "message" => "INVALID_PAYLOAD"]);
        exit;
    }

    $variantId = (int)($input['id'] ?? 0);
    if ($variantId <= 0) {
        echo json_encode(["status" => "error", "message" => "VARIANT_ID_REQUIRED"]);
        exit;
    }

    try {
        $beforeStmt = $db->prepare("SELECT id, product_id, variant_sku, status FROM product_variants WHERE id = ? AND deleted_at IS NULL LIMIT 1");
        $beforeStmt->execute([$variantId]);
        $before = $beforeStmt->fetch();
        if (!$before) {
            echo json_encode(["status" => "error", "message" => "VARIANT_NOT_FOUND"]);
            exit;
        }
        $db->prepare("UPDATE product_variants SET deleted_at = NOW(), status = 'INACTIVE', updated_at = NOW() WHERE id = ?")->execute([$variantId]);

        $actor = (string)($requestAuthUser['id'] ?? $requestAuthUser['email'] ?? 'admin_key');
        $ip = get_request_ip();
        log_system_event($db, 'ADMIN_PRODUCT_VARIANT_DELETED', "Variant {$variantId} soft-deleted", $actor, $ip);
        log_audit_event(
            $db,
            $actor,
            'PRODUCT_VARIANT_DELETED',
            'PRODUCT_VARIANT',
            (string)$variantId,
            [
                'status' => (string)($before['status'] ?? 'ACTIVE'),
                'deleted' => false
            ],
            [
                'status' => 'INACTIVE',
                'deleted' => true
            ],
            $ip
        );
        echo json_encode(["status" => "success", "message" => "VARIANT_DELETED"]);
    } catch (Throwable $e) {
        splaro_log_exception('admin.variant_delete', $e, ['id' => $variantId]);
        echo json_encode(["status" => "error", "message" => "VARIANT_DELETE_FAILED"]);
    }
    exit;
}

if ($method === 'GET' && $action === 'admin_abandoned_carts') {
    require_admin_access($requestAuthUser);
    $pagination = admin_parse_pagination_params(20, 100);
    $limit = (int)$pagination['limit'];
    $offset = (int)$pagination['offset'];
    $status = strtoupper(trim((string)($_GET['status'] ?? '')));
    $search = trim((string)($_GET['search'] ?? ''));

    $where = [];
    $params = [];
    if ($status !== '') {
        $where[] = "UPPER(ac.status) = ?";
        $params[] = $status;
    }
    if ($search !== '') {
        $wild = '%' . $search . '%';
        $where[] = "(ac.session_id LIKE ? OR ac.user_id LIKE ? OR ac.email LIKE ? OR ac.phone LIKE ? OR ac.recovered_order_id LIKE ?)";
        $params[] = $wild;
        $params[] = $wild;
        $params[] = $wild;
        $params[] = $wild;
        $params[] = $wild;
    }
    $whereSql = $where ? ('WHERE ' . implode(' AND ', $where)) : '';

    $total = safe_query_count($db, "SELECT COUNT(*) FROM abandoned_carts ac {$whereSql}", $params);
    $rows = safe_query_all(
        $db,
        "SELECT
            ac.id,
            ac.session_id,
            ac.user_id,
            ac.email,
            ac.phone,
            ac.cart_hash,
            ac.items_json,
            ac.subtotal,
            ac.currency,
            ac.status,
            ac.last_activity_at,
            ac.recovered_order_id,
            ac.notes,
            ac.created_at,
            ac.updated_at
         FROM abandoned_carts ac
         {$whereSql}
         ORDER BY ac.last_activity_at DESC, ac.id DESC
         LIMIT {$limit} OFFSET {$offset}",
        $params
    );

    $data = [];
    foreach ($rows as $row) {
        $items = safe_json_decode_assoc($row['items_json'] ?? '[]', []);
        $data[] = [
            "id" => (int)($row['id'] ?? 0),
            "sessionId" => (string)($row['session_id'] ?? ''),
            "userId" => (string)($row['user_id'] ?? ''),
            "email" => (string)($row['email'] ?? ''),
            "phone" => (string)($row['phone'] ?? ''),
            "cartHash" => (string)($row['cart_hash'] ?? ''),
            "items" => is_array($items) ? $items : [],
            "subtotal" => (float)($row['subtotal'] ?? 0),
            "currency" => (string)($row['currency'] ?? 'BDT'),
            "status" => (string)($row['status'] ?? 'ABANDONED'),
            "lastActivityAt" => (string)($row['last_activity_at'] ?? ''),
            "recoveredOrderId" => (string)($row['recovered_order_id'] ?? ''),
            "notes" => (string)($row['notes'] ?? ''),
            "createdAt" => (string)($row['created_at'] ?? ''),
            "updatedAt" => (string)($row['updated_at'] ?? '')
        ];
    }

    echo json_encode([
        "status" => "success",
        "data" => $data,
        "meta" => [
            "page" => (int)$pagination['page'],
            "limit" => $limit,
            "total" => $total
        ]
    ]);
    exit;
}

if ($method === 'POST' && $action === 'upsert_abandoned_cart') {
    if (is_rate_limited('upsert_abandoned_cart_' . get_request_ip(), 80, 60)) {
        echo json_encode(["status" => "error", "message" => "RATE_LIMIT_EXCEEDED"]);
        exit;
    }

    $rawBody = file_get_contents('php://input');
    $input = json_decode((string)$rawBody, true);
    if ($input === null && json_last_error() !== JSON_ERROR_NONE) {
        splaro_integration_trace('abandoned_cart.upsert.decode_failed', [
            'json_error' => json_last_error_msg(),
            'body_preview' => splaro_clip_text((string)$rawBody, 300)
        ], 'ERROR');
    }
    if (!is_array($input)) {
        echo json_encode(["status" => "error", "message" => "INVALID_PAYLOAD"]);
        exit;
    }

    $sessionId = trim((string)($input['sessionId'] ?? $input['session_id'] ?? resolve_session_id()));
    if ($sessionId === '') {
        try {
            $sessionId = 'sess_' . bin2hex(random_bytes(8));
        } catch (Throwable $e) {
            splaro_log_exception('abandoned_cart.session_id.generate', $e, [], 'WARNING');
            $sessionId = 'sess_' . uniqid('', true);
        }
    }

    $authUserId = is_array($requestAuthUser) ? (string)($requestAuthUser['id'] ?? '') : '';
    $userId = trim((string)($input['userId'] ?? $input['user_id'] ?? $authUserId));
    $email = trim((string)($input['email'] ?? ''));
    $phone = trim((string)($input['phone'] ?? ''));
    $currency = strtoupper(trim((string)($input['currency'] ?? 'BDT')));
    if ($currency === '') $currency = 'BDT';
    $status = strtoupper(trim((string)($input['status'] ?? 'ABANDONED')));
    if (!in_array($status, ['ACTIVE', 'ABANDONED', 'RECOVERED', 'RESOLVED'], true)) {
        $status = 'ABANDONED';
    }
    $items = $input['items'] ?? [];
    if (!is_array($items)) $items = [];
    $subtotal = isset($input['subtotal']) ? (float)$input['subtotal'] : 0.0;
    $notes = splaro_clip_text(trim((string)($input['notes'] ?? '')), 1000);

    $itemsJson = json_encode($items, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if (!is_string($itemsJson)) {
        splaro_integration_trace('abandoned_cart.upsert.items_encode_failed', [
            'json_error' => json_last_error_msg(),
            'item_count' => count($items)
        ], 'ERROR');
        echo json_encode(["status" => "error", "message" => "INVALID_ITEMS_PAYLOAD"]);
        exit;
    }

    $cartHash = hash('sha256', implode('|', [
        $sessionId,
        $userId,
        strtolower($email),
        $itemsJson
    ]));
    $lastActivityAt = date('Y-m-d H:i:s');
    $recoveredOrderId = trim((string)($input['recoveredOrderId'] ?? $input['recovered_order_id'] ?? ''));

    try {
        $existingStmt = $db->prepare("SELECT id, status FROM abandoned_carts WHERE cart_hash = ? LIMIT 1");
        $existingStmt->execute([$cartHash]);
        $existing = $existingStmt->fetch();

        if ($existing) {
            $db->prepare("UPDATE abandoned_carts
                SET session_id = ?, user_id = ?, email = ?, phone = ?, items_json = ?, subtotal = ?, currency = ?, status = ?, last_activity_at = ?, recovered_order_id = ?, notes = ?, updated_at = NOW()
                WHERE id = ?")
               ->execute([
                   $sessionId,
                   $userId !== '' ? $userId : null,
                   $email !== '' ? $email : null,
                   $phone !== '' ? $phone : null,
                   $itemsJson,
                   $subtotal,
                   $currency,
                   $status,
                   $lastActivityAt,
                   $recoveredOrderId !== '' ? $recoveredOrderId : null,
                   $notes !== '' ? $notes : null,
                   (int)$existing['id']
               ]);
            $recordId = (int)$existing['id'];
        } else {
            $db->prepare("INSERT INTO abandoned_carts (session_id, user_id, email, phone, cart_hash, items_json, subtotal, currency, status, last_activity_at, recovered_order_id, notes, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())")
               ->execute([
                   $sessionId,
                   $userId !== '' ? $userId : null,
                   $email !== '' ? $email : null,
                   $phone !== '' ? $phone : null,
                   $cartHash,
                   $itemsJson,
                   $subtotal,
                   $currency,
                   $status,
                   $lastActivityAt,
                   $recoveredOrderId !== '' ? $recoveredOrderId : null,
                   $notes !== '' ? $notes : null
               ]);
            $recordId = (int)$db->lastInsertId();
        }

        echo json_encode([
            "status" => "success",
            "data" => [
                "id" => $recordId,
                "sessionId" => $sessionId,
                "status" => $status,
                "lastActivityAt" => $lastActivityAt
            ]
        ]);
    } catch (Throwable $e) {
        splaro_log_exception('abandoned_cart.upsert', $e, [
            'session_id' => (string)$sessionId,
            'user_id' => (string)$userId
        ]);
        echo json_encode(["status" => "error", "message" => "ABANDONED_CART_UPSERT_FAILED"]);
    }
    exit;
}

if ($method === 'POST' && $action === 'admin_abandoned_cart_resolve') {
    require_admin_access($requestAuthUser);
    require_csrf_token();

    $rawBody = file_get_contents('php://input');
    $input = json_decode((string)$rawBody, true);
    if ($input === null && json_last_error() !== JSON_ERROR_NONE) {
        splaro_integration_trace('admin.abandoned_cart_resolve.decode_failed', [
            'json_error' => json_last_error_msg(),
            'body_preview' => splaro_clip_text((string)$rawBody, 300)
        ], 'ERROR');
    }
    if (!is_array($input)) {
        echo json_encode(["status" => "error", "message" => "INVALID_PAYLOAD"]);
        exit;
    }

    $id = (int)($input['id'] ?? 0);
    $recoveredOrderId = trim((string)($input['recoveredOrderId'] ?? $input['recovered_order_id'] ?? ''));
    $notes = splaro_clip_text(trim((string)($input['notes'] ?? '')), 1000);
    if ($id <= 0) {
        echo json_encode(["status" => "error", "message" => "ABANDONED_CART_ID_REQUIRED"]);
        exit;
    }

    try {
        $beforeStmt = $db->prepare("SELECT id, status, recovered_order_id, notes FROM abandoned_carts WHERE id = ? LIMIT 1");
        $beforeStmt->execute([$id]);
        $before = $beforeStmt->fetch();
        if (!$before) {
            echo json_encode(["status" => "error", "message" => "ABANDONED_CART_NOT_FOUND"]);
            exit;
        }

        $nextStatus = $recoveredOrderId !== '' ? 'RECOVERED' : 'RESOLVED';
        $db->prepare("UPDATE abandoned_carts SET status = ?, recovered_order_id = ?, notes = ?, updated_at = NOW() WHERE id = ?")
           ->execute([
               $nextStatus,
               $recoveredOrderId !== '' ? $recoveredOrderId : null,
               $notes !== '' ? $notes : null,
               $id
           ]);

        $actor = (string)($requestAuthUser['id'] ?? $requestAuthUser['email'] ?? 'admin_key');
        $ip = get_request_ip();
        log_system_event($db, 'ADMIN_ABANDONED_CART_RESOLVE', "Abandoned cart {$id} marked {$nextStatus}", $actor, $ip);
        log_audit_event(
            $db,
            $actor,
            'ABANDONED_CART_STATUS_UPDATED',
            'ABANDONED_CART',
            (string)$id,
            [
                'status' => (string)($before['status'] ?? ''),
                'recoveredOrderId' => (string)($before['recovered_order_id'] ?? ''),
                'notes' => (string)($before['notes'] ?? '')
            ],
            [
                'status' => $nextStatus,
                'recoveredOrderId' => $recoveredOrderId,
                'notes' => $notes
            ],
            $ip
        );

        echo json_encode([
            "status" => "success",
            "data" => [
                "id" => $id,
                "status" => $nextStatus,
                "recoveredOrderId" => $recoveredOrderId
            ]
        ]);
    } catch (Throwable $e) {
        splaro_log_exception('admin.abandoned_cart_resolve', $e, ['id' => $id]);
        echo json_encode(["status" => "error", "message" => "ABANDONED_CART_RESOLVE_FAILED"]);
    }
    exit;
}

if ($method === 'GET' && $action === 'admin_audit_logs') {
    require_admin_access($requestAuthUser);
    $pagination = admin_parse_pagination_params(50, 200);
    $limit = (int)$pagination['limit'];
    $offset = (int)$pagination['offset'];
    $actorId = trim((string)($_GET['actorId'] ?? $_GET['actor_id'] ?? ''));
    $actionFilter = trim((string)($_GET['eventAction'] ?? $_GET['action_name'] ?? ''));
    $entityType = strtoupper(trim((string)($_GET['entityType'] ?? $_GET['entity_type'] ?? '')));
    $search = trim((string)($_GET['search'] ?? ''));
    $dateFrom = trim((string)($_GET['date_from'] ?? ''));
    $dateTo = trim((string)($_GET['date_to'] ?? ''));

    $where = [];
    $params = [];
    if ($actorId !== '') {
        $where[] = "al.actor_id = ?";
        $params[] = $actorId;
    }
    if ($actionFilter !== '') {
        $where[] = "al.action = ?";
        $params[] = $actionFilter;
    }
    if ($entityType !== '') {
        $where[] = "UPPER(al.entity_type) = ?";
        $params[] = $entityType;
    }
    if ($search !== '') {
        $wild = '%' . $search . '%';
        $where[] = "(al.actor_id LIKE ? OR al.action LIKE ? OR al.entity_type LIKE ? OR al.entity_id LIKE ?)";
        $params[] = $wild;
        $params[] = $wild;
        $params[] = $wild;
        $params[] = $wild;
    }
    if ($dateFrom !== '') {
        $where[] = "al.created_at >= ?";
        $params[] = $dateFrom . ' 00:00:00';
    }
    if ($dateTo !== '') {
        $where[] = "al.created_at <= ?";
        $params[] = $dateTo . ' 23:59:59';
    }
    $whereSql = $where ? ('WHERE ' . implode(' AND ', $where)) : '';

    $total = safe_query_count($db, "SELECT COUNT(*) FROM audit_logs al {$whereSql}", $params);
    $rows = safe_query_all(
        $db,
        "SELECT id, actor_id, action, entity_type, entity_id, before_json, after_json, ip_address, created_at
         FROM audit_logs al
         {$whereSql}
         ORDER BY id DESC
         LIMIT {$limit} OFFSET {$offset}",
        $params
    );

    $data = [];
    foreach ($rows as $row) {
        $before = safe_json_decode_assoc($row['before_json'] ?? null, []);
        $after = safe_json_decode_assoc($row['after_json'] ?? null, []);
        $data[] = [
            "id" => (int)($row['id'] ?? 0),
            "actorId" => (string)($row['actor_id'] ?? ''),
            "action" => (string)($row['action'] ?? ''),
            "entityType" => (string)($row['entity_type'] ?? ''),
            "entityId" => (string)($row['entity_id'] ?? ''),
            "before" => is_array($before) ? $before : [],
            "after" => is_array($after) ? $after : [],
            "ipAddress" => (string)($row['ip_address'] ?? ''),
            "createdAt" => (string)($row['created_at'] ?? '')
        ];
    }

    echo json_encode([
        "status" => "success",
        "data" => $data,
        "meta" => [
            "page" => (int)$pagination['page'],
            "limit" => $limit,
            "total" => $total
        ]
    ]);
    exit;
}

if ($method === 'GET' && $action === 'admin_export_products') {
    require_admin_access($requestAuthUser);
    $adminRole = get_admin_role($requestAuthUser);
    if (is_array($requestAuthUser) && !in_array($adminRole, ['OWNER', 'ADMIN', 'SUPER_ADMIN', 'EDITOR', 'STAFF'], true)) {
        echo json_encode(["status" => "error", "message" => "EXPORT_ACCESS_REQUIRED"]);
        exit;
    }

    $limit = (int)($_GET['limit'] ?? EXPORT_MAX_ROWS);
    if ($limit < 1) $limit = 1;
    if ($limit > EXPORT_MAX_ROWS) $limit = EXPORT_MAX_ROWS;
    $rows = safe_query_all(
        $db,
        "SELECT id, name, slug, brand, category, type, price, discount_price, stock, sku, barcode, status, featured, created_at, updated_at
         FROM products
         ORDER BY updated_at DESC
         LIMIT {$limit}"
    );

    emit_csv_download('products_export_' . date('Ymd_His') . '.csv', [
        'id', 'name', 'slug', 'brand', 'category', 'type', 'price', 'discount_price', 'stock', 'sku', 'barcode', 'status', 'featured', 'created_at', 'updated_at'
    ], $rows);
    exit;
}

if ($method === 'GET' && $action === 'admin_export_orders') {
    require_admin_access($requestAuthUser);
    $adminRole = get_admin_role($requestAuthUser);
    if (is_array($requestAuthUser) && !in_array($adminRole, ['OWNER', 'ADMIN', 'SUPER_ADMIN', 'EDITOR', 'STAFF', 'VIEWER'], true)) {
        echo json_encode(["status" => "error", "message" => "EXPORT_ACCESS_REQUIRED"]);
        exit;
    }

    $limit = (int)($_GET['limit'] ?? EXPORT_MAX_ROWS);
    if ($limit < 1) $limit = 1;
    if ($limit > EXPORT_MAX_ROWS) $limit = EXPORT_MAX_ROWS;
    $rows = safe_query_all(
        $db,
        "SELECT
            o.id,
            o.order_no,
            o.user_id,
            o.customer_name,
            o.customer_email,
            o.phone,
            o.total,
            o.status,
            o.payment_method,
            o.payment_status,
            o.tracking_number,
            o.created_at,
            o.updated_at,
            (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS items_count
         FROM orders o
         ORDER BY o.created_at DESC
         LIMIT {$limit}"
    );

    emit_csv_download('orders_export_' . date('Ymd_His') . '.csv', [
        'id', 'order_no', 'user_id', 'customer_name', 'customer_email', 'phone', 'total', 'status', 'payment_method', 'payment_status', 'tracking_number', 'items_count', 'created_at', 'updated_at'
    ], $rows);
    exit;
}

if ($method === 'GET' && $action === 'admin_export_customers') {
    require_admin_access($requestAuthUser);
    $adminRole = get_admin_role($requestAuthUser);
    if (is_array($requestAuthUser) && !in_array($adminRole, ['OWNER', 'ADMIN', 'SUPER_ADMIN', 'EDITOR', 'STAFF', 'VIEWER'], true)) {
        echo json_encode(["status" => "error", "message" => "EXPORT_ACCESS_REQUIRED"]);
        exit;
    }

    $limit = (int)($_GET['limit'] ?? EXPORT_MAX_ROWS);
    if ($limit < 1) $limit = 1;
    if ($limit > EXPORT_MAX_ROWS) $limit = EXPORT_MAX_ROWS;
    $rows = safe_query_all(
        $db,
        "SELECT
            u.id,
            u.name,
            u.email,
            u.phone,
            u.role,
            u.is_blocked,
            u.created_at,
            u.updated_at,
            COALESCE((SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id), 0) AS total_orders,
            COALESCE((SELECT SUM(o.total) FROM orders o WHERE o.user_id = u.id), 0) AS lifetime_value
         FROM users u
         WHERE u.deleted_at IS NULL
         ORDER BY u.created_at DESC
         LIMIT {$limit}"
    );

    emit_csv_download('customers_export_' . date('Ymd_His') . '.csv', [
        'id', 'name', 'email', 'phone', 'role', 'is_blocked', 'total_orders', 'lifetime_value', 'created_at', 'updated_at'
    ], $rows);
    exit;
}

if ($method === 'GET' && $action === 'admin_user_profile') {
    require_admin_access($requestAuthUser);
    $userId = trim((string)($_GET['id'] ?? $_GET['userId'] ?? ''));
    $userRow = admin_fetch_user_or_fail($db, $userId);
    $normalizedUser = admin_normalize_user($userRow);
    $stats = admin_build_user_stats_payload($db, $userRow);

    $addressesRows = safe_query_all(
        $db,
        "SELECT id, label, recipient_name, phone, district, thana, address_line, postal_code, is_default, is_verified, created_at, updated_at
         FROM user_addresses
         WHERE user_id = ? AND (deleted_at IS NULL OR deleted_at = '0000-00-00 00:00:00')
         ORDER BY is_default DESC, updated_at DESC",
        [(string)$userRow['id']]
    );
    $addresses = [];
    foreach ($addressesRows as $address) {
        $addresses[] = [
            'id' => (string)($address['id'] ?? ''),
            'label' => (string)($address['label'] ?? 'Address'),
            'recipientName' => (string)($address['recipient_name'] ?? ''),
            'phone' => (string)($address['phone'] ?? ''),
            'district' => (string)($address['district'] ?? ''),
            'thana' => (string)($address['thana'] ?? ''),
            'addressLine' => (string)($address['address_line'] ?? ''),
            'postalCode' => (string)($address['postal_code'] ?? ''),
            'isDefault' => (int)($address['is_default'] ?? 0) === 1,
            'isVerified' => (int)($address['is_verified'] ?? 0) === 1,
            'createdAt' => (string)($address['created_at'] ?? ''),
            'updatedAt' => (string)($address['updated_at'] ?? '')
        ];
    }

    $scopeSql = admin_user_order_scope_sql($db, 'o');
    $purchasedRows = safe_query_all(
        $db,
        "SELECT
            COALESCE(oi.product_id, '') AS product_id,
            oi.product_name,
            MAX(oi.image_url) AS image_url,
            SUM(oi.quantity) AS total_qty,
            SUM(oi.line_total) AS total_spent,
            MAX(o.created_at) AS last_purchased_at
         FROM order_items oi
         INNER JOIN orders o ON o.id = oi.order_id
         WHERE {$scopeSql}
         GROUP BY COALESCE(oi.product_id, ''), oi.product_name
         ORDER BY total_spent DESC, total_qty DESC
         LIMIT 100",
        [(string)$userRow['id'], strtolower((string)$userRow['email'])]
    );
    $purchasedProducts = [];
    foreach ($purchasedRows as $row) {
        $purchasedProducts[] = [
            'productId' => (string)($row['product_id'] ?? ''),
            'productName' => (string)($row['product_name'] ?? 'Product'),
            'imageUrl' => (string)($row['image_url'] ?? ''),
            'totalQuantity' => (int)($row['total_qty'] ?? 0),
            'totalSpent' => (float)($row['total_spent'] ?? 0),
            'lastPurchasedAt' => $row['last_purchased_at'] ?? null
        ];
    }

    $orderFields = admin_order_select_fields($db);
    $recentOrderRows = safe_query_all(
        $db,
        "SELECT {$orderFields} FROM orders o WHERE {$scopeSql} ORDER BY o.created_at DESC LIMIT 20",
        [(string)$userRow['id'], strtolower((string)$userRow['email'])]
    );
    $recentOrders = [];
    foreach ($recentOrderRows as $row) {
        $recentOrders[] = admin_normalize_order_row($row);
    }

    echo json_encode([
        "status" => "success",
        "data" => [
            'user' => $normalizedUser,
            'stats' => $stats,
            'addresses' => $addresses,
            'purchasedProducts' => $purchasedProducts,
            'recentOrders' => $recentOrders
        ]
    ]);
    exit;
}

if ($method === 'GET' && $action === 'admin_orders') {
    require_admin_access($requestAuthUser);
    $pagination = admin_parse_pagination_params(20, 100);
    $limit = (int)$pagination['limit'];
    $offset = (int)$pagination['offset'];
    $cursor = $pagination['cursor'];
    $search = trim((string)($_GET['search'] ?? $_GET['q'] ?? ''));
    $status = strtoupper(trim((string)($_GET['status'] ?? '')));
    $dateFrom = trim((string)($_GET['date_from'] ?? ''));
    $dateTo = trim((string)($_GET['date_to'] ?? ''));

    $where = [];
    $params = [];
    if (column_exists($db, 'orders', 'deleted_at')) {
        $where[] = "o.deleted_at IS NULL";
    }
    if ($search !== '') {
        $wild = '%' . $search . '%';
        $where[] = "(o.id LIKE ? OR o.order_no LIKE ? OR o.customer_name LIKE ? OR o.customer_email LIKE ? OR o.phone LIKE ?)";
        $params[] = $wild;
        $params[] = $wild;
        $params[] = $wild;
        $params[] = $wild;
        $params[] = $wild;
    }
    if ($status !== '') {
        $where[] = "UPPER(o.status) = ?";
        $params[] = $status;
    }
    if ($dateFrom !== '') {
        $where[] = "o.created_at >= ?";
        $params[] = $dateFrom . ' 00:00:00';
    }
    if ($dateTo !== '') {
        $where[] = "o.created_at <= ?";
        $params[] = $dateTo . ' 23:59:59';
    }
    if (is_array($cursor)) {
        $where[] = "(o.created_at < ? OR (o.created_at = ? AND o.id < ?))";
        $params[] = (string)$cursor['created_at'];
        $params[] = (string)$cursor['created_at'];
        $params[] = (string)$cursor['id'];
    }
    $whereSql = $where ? ('WHERE ' . implode(' AND ', $where)) : '';
    $orderFields = admin_order_select_fields($db);
    $sql = "SELECT {$orderFields} FROM orders o {$whereSql} ORDER BY o.created_at DESC, o.id DESC LIMIT " . ($limit + 1);
    if (!is_array($cursor)) {
        $sql .= " OFFSET {$offset}";
    }
    $rows = safe_query_all($db, $sql, $params);
    $hasMore = count($rows) > $limit;
    if ($hasMore) array_pop($rows);

    $ordersData = [];
    foreach ($rows as $row) {
        $ordersData[] = admin_normalize_order_row($row);
    }
    $nextCursor = null;
    if ($hasMore && !empty($ordersData)) {
        $last = $ordersData[count($ordersData) - 1];
        $nextCursor = admin_encode_cursor((string)($last['createdAt'] ?? ''), (string)($last['id'] ?? ''));
    }

    echo json_encode([
        "status" => "success",
        "data" => $ordersData,
        "meta" => [
            "page" => (int)$pagination['page'],
            "limit" => $limit,
            "hasMore" => $hasMore,
            "nextCursor" => $nextCursor
        ]
    ]);
    exit;
}

if ($method === 'GET' && $action === 'admin_order_detail') {
    require_admin_access($requestAuthUser);
    $orderId = trim((string)($_GET['id'] ?? $_GET['orderId'] ?? ''));
    if ($orderId === '') {
        echo json_encode(["status" => "error", "message" => "ORDER_ID_REQUIRED"]);
        exit;
    }
    $orderFields = admin_order_select_fields($db);
    $stmt = $db->prepare("SELECT {$orderFields} FROM orders WHERE id = ? LIMIT 1");
    $stmt->execute([$orderId]);
    $orderRow = $stmt->fetch();
    if (!$orderRow) {
        http_response_code(404);
        echo json_encode(["status" => "error", "message" => "ORDER_NOT_FOUND"]);
        exit;
    }

    $orderData = admin_normalize_order_row($orderRow);
    $itemRows = safe_query_all($db, "SELECT id, product_id, product_name, product_slug, brand, category, variant_size, variant_color, quantity, unit_price, line_total, product_url, image_url, created_at FROM order_items WHERE order_id = ? ORDER BY id ASC", [$orderId]);
    if (!empty($itemRows)) {
        $orderData['items'] = array_map(function ($row) {
            return [
                'id' => (int)($row['id'] ?? 0),
                'productId' => (string)($row['product_id'] ?? ''),
                'productName' => (string)($row['product_name'] ?? ''),
                'productSlug' => (string)($row['product_slug'] ?? ''),
                'brand' => (string)($row['brand'] ?? ''),
                'category' => (string)($row['category'] ?? ''),
                'size' => (string)($row['variant_size'] ?? ''),
                'color' => (string)($row['variant_color'] ?? ''),
                'quantity' => (int)($row['quantity'] ?? 0),
                'unitPrice' => (float)($row['unit_price'] ?? 0),
                'lineTotal' => (float)($row['line_total'] ?? 0),
                'productUrl' => (string)($row['product_url'] ?? ''),
                'imageUrl' => (string)($row['image_url'] ?? ''),
                'createdAt' => (string)($row['created_at'] ?? '')
            ];
        }, $itemRows);
        $orderData['itemCount'] = array_sum(array_map(function ($item) {
            return (int)($item['quantity'] ?? 0);
        }, $orderData['items']));
    }

    $timelineRows = safe_query_all($db, "SELECT id, from_status, to_status, note, changed_by, changed_by_role, ip_address, created_at FROM order_status_history WHERE order_id = ? ORDER BY created_at ASC, id ASC", [$orderId]);
    $paymentsRows = safe_query_all($db, "SELECT id, payment_method, provider, transaction_ref, amount, currency, status, validation_ref, validated_at, created_at, updated_at FROM payments WHERE order_id = ? ORDER BY created_at DESC", [$orderId]);
    $shipmentFields = admin_shipment_select_fields($db);
    $shipmentsRows = safe_query_all($db, "SELECT {$shipmentFields} FROM shipments WHERE order_id = ? ORDER BY created_at DESC", [$orderId]);
    $refundRows = safe_query_all($db, "SELECT id, amount, reason, status, created_by, created_at, updated_at FROM refunds WHERE order_id = ? ORDER BY created_at DESC", [$orderId]);
    $cancelRows = safe_query_all($db, "SELECT id, reason, status, created_by, created_at, updated_at FROM cancellations WHERE order_id = ? ORDER BY created_at DESC", [$orderId]);

    echo json_encode([
        "status" => "success",
        "data" => [
            "order" => $orderData,
            "timeline" => $timelineRows,
            "payments" => $paymentsRows,
            "shipments" => $shipmentsRows,
            "refunds" => $refundRows,
            "cancellations" => $cancelRows
        ]
    ]);
    exit;
}

if ($method === 'GET' && $action === 'admin_order_timeline') {
    require_admin_access($requestAuthUser);
    $orderId = trim((string)($_GET['id'] ?? $_GET['orderId'] ?? ''));
    if ($orderId === '') {
        echo json_encode(["status" => "error", "message" => "ORDER_ID_REQUIRED"]);
        exit;
    }
    $rows = safe_query_all($db, "SELECT id, from_status, to_status, note, changed_by, changed_by_role, ip_address, created_at FROM order_status_history WHERE order_id = ? ORDER BY created_at ASC, id ASC", [$orderId]);
    echo json_encode(["status" => "success", "data" => $rows]);
    exit;
}

if ($method === 'POST' && $action === 'admin_order_status') {
    require_admin_access($requestAuthUser);
    require_csrf_token();
    $input = json_decode(file_get_contents('php://input'), true);
    if (!is_array($input)) {
        echo json_encode(["status" => "error", "message" => "INVALID_PAYLOAD"]);
        exit;
    }
    $orderId = trim((string)($input['id'] ?? $input['orderId'] ?? ''));
    $nextStatus = admin_normalize_order_status($input['status'] ?? '');
    $nextStatusDb = admin_order_status_db_value($nextStatus);
    $note = trim((string)($input['note'] ?? ''));
    if ($orderId === '' || $nextStatus === '') {
        echo json_encode(["status" => "error", "message" => "ORDER_ID_AND_STATUS_REQUIRED"]);
        exit;
    }
    $stmt = $db->prepare("SELECT id, status FROM orders WHERE id = ? LIMIT 1");
    $stmt->execute([$orderId]);
    $order = $stmt->fetch();
    if (!$order) {
        http_response_code(404);
        echo json_encode(["status" => "error", "message" => "ORDER_NOT_FOUND"]);
        exit;
    }
    $db->beginTransaction();
    try {
        $update = $db->prepare("UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?");
        $update->execute([$nextStatusDb, $orderId]);
        admin_write_order_status_history($db, $orderId, admin_normalize_order_status((string)($order['status'] ?? 'Pending')), $nextStatus, $note !== '' ? $note : 'Updated from admin panel', $requestAuthUser);
        $db->commit();
    } catch (Exception $e) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        splaro_log_exception('admin.order.status', $e, ['order_id' => $orderId, 'status' => $nextStatus]);
        http_response_code(500);
        echo json_encode(["status" => "error", "message" => "ORDER_STATUS_UPDATE_FAILED"]);
        exit;
    }
    log_audit_event(
        $db,
        (string)($requestAuthUser['id'] ?? $requestAuthUser['email'] ?? 'admin_key'),
        'ORDER_STATUS_UPDATED',
        'ORDER',
        $orderId,
        ['status' => admin_normalize_order_status((string)($order['status'] ?? 'Pending'))],
        ['status' => $nextStatus, 'note' => $note],
        $_SERVER['REMOTE_ADDR'] ?? 'UNKNOWN'
    );
    echo json_encode(["status" => "success", "message" => "ORDER_STATUS_UPDATED"]);
    exit;
}

if ($method === 'POST' && $action === 'admin_order_cancel') {
    require_admin_access($requestAuthUser);
    require_csrf_token();
    $input = json_decode(file_get_contents('php://input'), true);
    if (!is_array($input)) {
        echo json_encode(["status" => "error", "message" => "INVALID_PAYLOAD"]);
        exit;
    }
    $orderId = trim((string)($input['id'] ?? $input['orderId'] ?? ''));
    $reason = trim((string)($input['reason'] ?? 'Cancelled by admin'));
    if ($orderId === '') {
        echo json_encode(["status" => "error", "message" => "ORDER_ID_REQUIRED"]);
        exit;
    }
    $orderStmt = $db->prepare("SELECT id, user_id, status FROM orders WHERE id = ? LIMIT 1");
    $orderStmt->execute([$orderId]);
    $order = $orderStmt->fetch();
    if (!$order) {
        http_response_code(404);
        echo json_encode(["status" => "error", "message" => "ORDER_NOT_FOUND"]);
        exit;
    }
    $actor = (string)($requestAuthUser['id'] ?? $requestAuthUser['email'] ?? 'admin_key');
    $cancelledStatus = admin_normalize_order_status('Cancelled');
    $cancelledStatusDb = admin_order_status_db_value($cancelledStatus);
    $db->beginTransaction();
    try {
        $insert = $db->prepare("INSERT INTO cancellations (order_id, user_id, reason, status, created_by) VALUES (?, ?, ?, ?, ?)");
        $insert->execute([$orderId, (string)($order['user_id'] ?? ''), $reason, 'CONFIRMED', $actor]);
        $update = $db->prepare("UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?");
        $update->execute([$cancelledStatusDb, $orderId]);
        admin_write_order_status_history($db, $orderId, admin_normalize_order_status((string)($order['status'] ?? 'Pending')), $cancelledStatus, $reason, $requestAuthUser);
        $db->commit();
    } catch (Exception $e) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        splaro_log_exception('admin.order.cancel', $e, ['order_id' => $orderId]);
        http_response_code(500);
        echo json_encode(["status" => "error", "message" => "ORDER_CANCEL_FAILED"]);
        exit;
    }
    log_audit_event($db, $actor, 'ORDER_CANCELLED', 'ORDER', $orderId, ['status' => admin_normalize_order_status((string)($order['status'] ?? 'Pending'))], ['status' => $cancelledStatus, 'reason' => $reason], $_SERVER['REMOTE_ADDR'] ?? 'UNKNOWN');
    echo json_encode(["status" => "success", "message" => "ORDER_CANCELLED"]);
    exit;
}

if ($method === 'POST' && $action === 'admin_order_refund') {
    require_admin_access($requestAuthUser);
    require_csrf_token();
    $input = json_decode(file_get_contents('php://input'), true);
    if (!is_array($input)) {
        echo json_encode(["status" => "error", "message" => "INVALID_PAYLOAD"]);
        exit;
    }
    $orderId = trim((string)($input['id'] ?? $input['orderId'] ?? ''));
    if ($orderId === '') {
        echo json_encode(["status" => "error", "message" => "ORDER_ID_REQUIRED"]);
        exit;
    }
    $reason = trim((string)($input['reason'] ?? 'Refund processed by admin'));
    $amountInput = $input['amount'] ?? null;
    $actor = (string)($requestAuthUser['id'] ?? $requestAuthUser['email'] ?? 'admin_key');

    $orderStmt = $db->prepare("SELECT id, user_id, total, status FROM orders WHERE id = ? LIMIT 1");
    $orderStmt->execute([$orderId]);
    $order = $orderStmt->fetch();
    if (!$order) {
        http_response_code(404);
        echo json_encode(["status" => "error", "message" => "ORDER_NOT_FOUND"]);
        exit;
    }
    $amount = $amountInput !== null ? (float)$amountInput : (float)($order['total'] ?? 0);
    if ($amount < 0) $amount = 0;

    $db->beginTransaction();
    try {
        $insert = $db->prepare("INSERT INTO refunds (order_id, user_id, amount, reason, status, created_by) VALUES (?, ?, ?, ?, ?, ?)");
        $insert->execute([$orderId, (string)($order['user_id'] ?? ''), $amount, $reason, 'APPROVED', $actor]);
        admin_write_order_status_history($db, $orderId, (string)($order['status'] ?? ''), admin_normalize_order_status((string)($order['status'] ?? '')), 'Refund approved: BDT ' . number_format($amount, 2), $requestAuthUser);
        $db->commit();
    } catch (Exception $e) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        splaro_log_exception('admin.order.refund', $e, ['order_id' => $orderId]);
        http_response_code(500);
        echo json_encode(["status" => "error", "message" => "ORDER_REFUND_FAILED"]);
        exit;
    }
    log_audit_event($db, $actor, 'ORDER_REFUNDED', 'ORDER', $orderId, null, ['amount' => $amount, 'reason' => $reason], $_SERVER['REMOTE_ADDR'] ?? 'UNKNOWN');
    echo json_encode([
        "status" => "success",
        "message" => "ORDER_REFUND_RECORDED",
        "data" => [
            "orderId" => $orderId,
            "amount" => $amount
        ]
    ]);
    exit;
}

if ($method === 'GET' && $action === 'admin_reports_summary') {
    require_admin_access($requestAuthUser);
    $range = strtoupper(trim((string)($_GET['range'] ?? 'MONTH')));
    $rangeWhere = '';
    if ($range === 'TODAY') {
        $rangeWhere = " AND o.created_at >= DATE(NOW())";
    } elseif ($range === 'WEEK') {
        $rangeWhere = " AND o.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)";
    } elseif ($range === 'MONTH') {
        $rangeWhere = " AND o.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)";
    }

    $ordersScope = "WHERE 1=1";
    if (column_exists($db, 'orders', 'deleted_at')) {
        $ordersScope .= " AND o.deleted_at IS NULL";
    }
    $summaryRow = $db->query(
        "SELECT
            COUNT(*) AS total_orders,
            COALESCE(SUM(o.total), 0) AS gross_sales,
            COALESCE(SUM(CASE WHEN UPPER(o.status) IN ('CANCELLED','CANCELED') THEN 1 ELSE 0 END), 0) AS cancelled_orders
         FROM orders o {$ordersScope}{$rangeWhere}"
    )->fetch();

    $usersCreated = $db->query("SELECT COUNT(*) FROM users WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)")->fetchColumn();
    $subsCreated = $db->query("SELECT COUNT(*) FROM subscriptions WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)")->fetchColumn();
    $refundAmount = $db->query("SELECT COALESCE(SUM(amount), 0) FROM refunds WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)")->fetchColumn();

    echo json_encode([
        "status" => "success",
        "data" => [
            "range" => strtolower($range),
            "totalOrders" => (int)($summaryRow['total_orders'] ?? 0),
            "grossSales" => (float)($summaryRow['gross_sales'] ?? 0),
            "cancelledOrders" => (int)($summaryRow['cancelled_orders'] ?? 0),
            "newUsers30d" => (int)$usersCreated,
            "newSubscribers30d" => (int)$subsCreated,
            "refundAmount30d" => (float)$refundAmount
        ]
    ]);
    exit;
}

if ($method === 'GET' && $action === 'admin_reports_top_products') {
    require_admin_access($requestAuthUser);
    $limit = max(1, min(100, (int)($_GET['limit'] ?? 20)));
    $rows = safe_query_all(
        $db,
        "SELECT
            COALESCE(NULLIF(oi.product_name, ''), 'Product') AS product_name,
            COALESCE(NULLIF(oi.product_id, ''), '') AS product_id,
            COALESCE(SUM(oi.quantity), 0) AS total_qty,
            COALESCE(SUM(oi.line_total), 0) AS total_sales,
            MAX(oi.image_url) AS image_url
         FROM order_items oi
         GROUP BY COALESCE(NULLIF(oi.product_id, ''), oi.product_name), COALESCE(NULLIF(oi.product_name, ''), 'Product')
         ORDER BY total_sales DESC, total_qty DESC
         LIMIT {$limit}"
    );
    echo json_encode(["status" => "success", "data" => $rows]);
    exit;
}

if ($method === 'GET' && $action === 'admin_reports_top_customers') {
    require_admin_access($requestAuthUser);
    $limit = max(1, min(100, (int)($_GET['limit'] ?? 20)));
    $ordersScope = "";
    if (column_exists($db, 'orders', 'deleted_at')) {
        $ordersScope = "WHERE o.deleted_at IS NULL";
    }
    $rows = safe_query_all(
        $db,
        "SELECT
            COALESCE(NULLIF(o.user_id, ''), CONCAT('email:', LOWER(o.customer_email))) AS customer_key,
            MAX(o.customer_name) AS customer_name,
            LOWER(MAX(o.customer_email)) AS customer_email,
            MAX(o.phone) AS phone,
            COUNT(*) AS total_orders,
            COALESCE(SUM(o.total), 0) AS total_spent,
            MAX(o.created_at) AS last_order_at
         FROM orders o
         {$ordersScope}
         GROUP BY COALESCE(NULLIF(o.user_id, ''), CONCAT('email:', LOWER(o.customer_email)))
         ORDER BY total_spent DESC, total_orders DESC
         LIMIT {$limit}"
    );
    echo json_encode(["status" => "success", "data" => $rows]);
    exit;
}

if ($method === 'GET' && $action === 'admin_reports_cancellations') {
    require_admin_access($requestAuthUser);
    $limit = max(1, min(200, (int)($_GET['limit'] ?? 50)));
    $rows = safe_query_all(
        $db,
        "SELECT c.id, c.order_id, c.user_id, c.reason, c.status, c.created_by, c.created_at, o.customer_name, o.customer_email, o.total
         FROM cancellations c
         LEFT JOIN orders o ON o.id = c.order_id
         ORDER BY c.created_at DESC
         LIMIT {$limit}"
    );
    echo json_encode(["status" => "success", "data" => $rows]);
    exit;
}

if ($method === 'GET' && $action === 'admin_reports_refunds') {
    require_admin_access($requestAuthUser);
    $limit = max(1, min(200, (int)($_GET['limit'] ?? 50)));
    $rows = safe_query_all(
        $db,
        "SELECT r.id, r.order_id, r.user_id, r.amount, r.reason, r.status, r.created_by, r.created_at, o.customer_name, o.customer_email, o.total
         FROM refunds r
         LEFT JOIN orders o ON o.id = r.order_id
         ORDER BY r.created_at DESC
         LIMIT {$limit}"
    );
    echo json_encode(["status" => "success", "data" => $rows]);
    exit;
}

if ($method === 'POST' && $action === 'sslcommerz_init') {
    if (is_rate_limited('sslcommerz_init', 20, 60)) {
        http_response_code(429);
        echo json_encode(["status" => "error", "message" => "RATE_LIMIT_EXCEEDED"]);
        exit;
    }

    [$input] = read_request_json_payload('sslcommerz.init.payload');
    if (!is_array($input)) {
        $input = [];
    }
    $integrationSettings = load_integration_settings($db);
    $ssl = $integrationSettings['sslcommerz'] ?? [];
    if (!sslcommerz_is_enabled($ssl)) {
        http_response_code(503);
        echo json_encode(["status" => "error", "message" => "SSLCOMMERZ_DISABLED"]);
        exit;
    }

    $orderRef = trim((string)($input['order_id'] ?? $input['orderId'] ?? $input['id'] ?? $input['order_no'] ?? $input['orderNo'] ?? ''));
    if ($orderRef === '') {
        http_response_code(400);
        echo json_encode(["status" => "error", "message" => "ORDER_ID_REQUIRED"]);
        exit;
    }

    $orderStmt = $db->prepare("SELECT id, order_no, customer_name, customer_email, phone, district, thana, address, total, status, payment_status FROM orders WHERE id = ? OR order_no = ? LIMIT 1");
    $orderStmt->execute([$orderRef, $orderRef]);
    $orderRow = $orderStmt->fetch();
    if (!$orderRow) {
        http_response_code(404);
        echo json_encode(["status" => "error", "message" => "ORDER_NOT_FOUND"]);
        exit;
    }

    $tranId = trim((string)($orderRow['order_no'] ?? $orderRow['id']));
    if ($tranId === '') {
        $tranId = trim((string)$orderRow['id']);
    }
    $amount = (float)($input['amount'] ?? $orderRow['total'] ?? 0);
    if ($amount <= 0) {
        http_response_code(400);
        echo json_encode(["status" => "error", "message" => "INVALID_AMOUNT"]);
        exit;
    }

    $successUrl = trim((string)($ssl['success_url'] ?? ''));
    $failUrl = trim((string)($ssl['fail_url'] ?? ''));
    $cancelUrl = trim((string)($ssl['cancel_url'] ?? ''));
    $ipnUrl = trim((string)($ssl['ipn_url'] ?? ''));
    if ($successUrl === '' || $failUrl === '' || $cancelUrl === '' || $ipnUrl === '') {
        http_response_code(500);
        echo json_encode(["status" => "error", "message" => "SSLCOMMERZ_URLS_NOT_CONFIGURED"]);
        exit;
    }

    $postData = [
        'store_id' => trim((string)($ssl['store_id'] ?? '')),
        'store_passwd' => trim((string)($ssl['store_password'] ?? '')),
        'total_amount' => number_format($amount, 2, '.', ''),
        'currency' => strtoupper(trim((string)($input['currency'] ?? 'BDT'))),
        'tran_id' => $tranId,
        'success_url' => $successUrl,
        'fail_url' => $failUrl,
        'cancel_url' => $cancelUrl,
        'ipn_url' => $ipnUrl,
        'product_name' => trim((string)($input['product_name'] ?? 'SPLARO Order')),
        'product_category' => trim((string)($input['product_category'] ?? 'Fashion')),
        'product_profile' => trim((string)($input['product_profile'] ?? 'general')),
        'cus_name' => trim((string)($orderRow['customer_name'] ?? 'Customer')),
        'cus_email' => trim((string)($orderRow['customer_email'] ?? '')),
        'cus_add1' => trim((string)($orderRow['address'] ?? '')),
        'cus_city' => trim((string)($orderRow['district'] ?? 'Dhaka')),
        'cus_state' => trim((string)($orderRow['thana'] ?? '')),
        'cus_postcode' => trim((string)($input['cus_postcode'] ?? '1200')),
        'cus_country' => trim((string)($input['cus_country'] ?? 'Bangladesh')),
        'cus_phone' => trim((string)($orderRow['phone'] ?? '')),
        'shipping_method' => trim((string)($input['shipping_method'] ?? 'NO')),
        'num_of_item' => (string)max(1, (int)($input['num_of_item'] ?? 1)),
        'value_a' => trim((string)$orderRow['id']),
        'value_b' => trim((string)$orderRow['order_no']),
        'value_c' => trim((string)($orderRow['customer_email'] ?? ''))
    ];

    $initUrl = sslcommerz_init_url($ssl);
    [$ok, $httpCode, $error, $responseBody] = integration_http_request(
        $initUrl,
        'POST',
        $postData,
        ['Accept: application/json'],
        (int)SSLCOMMERZ_HTTP_TIMEOUT_SECONDS,
        true
    );
    $decoded = integration_decode_json_or_query($responseBody);
    $gatewayPageUrl = sslcommerz_extract_gateway_url($decoded);

    if (!$ok || $gatewayPageUrl === '') {
        integration_log_event(
            $db,
            'SSLCOMMERZ',
            'INIT',
            'ERROR',
            'ORDER',
            (string)$orderRow['id'],
            $httpCode,
            $error !== '' ? $error : 'GATEWAY_URL_MISSING',
            splaro_clip_text($responseBody, 300),
            ['tran_id' => $tranId]
        );
        http_response_code(502);
        echo json_encode([
            "status" => "error",
            "message" => "SSLCOMMERZ_INIT_FAILED",
            "details" => $error !== '' ? $error : 'GATEWAY_URL_MISSING'
        ]);
        exit;
    }

    $idempotencyKey = payment_event_idempotency_key('SSLCOMMERZ', 'INIT', $tranId, '', 'INITIATED', (string)$amount);
    try {
        $db->beginTransaction();
        sslcommerz_upsert_payment_row(
            $db,
            (string)$orderRow['id'],
            $tranId,
            'INITIATED',
            $amount,
            (string)$postData['currency'],
            ['init_request' => $postData, 'init_response' => $decoded],
            null,
            $idempotencyKey
        );
        $orderUpdate = $db->prepare("UPDATE orders SET payment_method = 'SSLCommerz', payment_status = 'PENDING', updated_at = NOW() WHERE id = ?");
        $orderUpdate->execute([(string)$orderRow['id']]);
        $db->commit();
    } catch (Throwable $e) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        splaro_log_exception('sslcommerz.init.persist', $e, ['order_id' => (string)$orderRow['id']]);
        http_response_code(500);
        echo json_encode(["status" => "error", "message" => "PAYMENT_INIT_PERSIST_FAILED"]);
        exit;
    }

    integration_log_event(
        $db,
        'SSLCOMMERZ',
        'INIT',
        'SUCCESS',
        'ORDER',
        (string)$orderRow['id'],
        $httpCode,
        '',
        splaro_clip_text($responseBody, 300),
        ['tran_id' => $tranId]
    );

    echo json_encode([
        "status" => "success",
        "order_id" => (string)$orderRow['id'],
        "order_no" => (string)($orderRow['order_no'] ?? ''),
        "tran_id" => $tranId,
        "gateway_url" => $gatewayPageUrl,
        "mode" => sslcommerz_mode($ssl)
    ]);
    exit;
}

if ($method === 'POST' && $action === 'sslcommerz_ipn') {
    $ipnPayload = $_POST;
    if (!is_array($ipnPayload) || empty($ipnPayload)) {
        [$payloadFromBody] = read_request_json_payload('sslcommerz.ipn.payload');
        if (is_array($payloadFromBody) && !empty($payloadFromBody)) {
            $ipnPayload = $payloadFromBody;
        }
    }
    if (!is_array($ipnPayload)) {
        $ipnPayload = [];
    }

    $integrationSettings = load_integration_settings($db);
    $ssl = $integrationSettings['sslcommerz'] ?? [];
    if (!sslcommerz_is_enabled($ssl)) {
        http_response_code(503);
        echo json_encode(["status" => "error", "message" => "SSLCOMMERZ_DISABLED"]);
        exit;
    }

    $tranId = trim((string)($ipnPayload['tran_id'] ?? $ipnPayload['transaction_id'] ?? $ipnPayload['transaction_ref'] ?? ''));
    $orderHint = trim((string)($ipnPayload['value_a'] ?? $ipnPayload['order_id'] ?? $ipnPayload['order_no'] ?? ''));
    if ($tranId === '' && $orderHint === '') {
        http_response_code(400);
        echo json_encode(["status" => "error", "message" => "TRANSACTION_REFERENCE_REQUIRED"]);
        exit;
    }

    $orderRow = find_order_for_payment_reference($db, $tranId, $orderHint);
    if (!$orderRow) {
        integration_log_event(
            $db,
            'SSLCOMMERZ',
            'IPN',
            'ERROR',
            'ORDER',
            $tranId !== '' ? $tranId : $orderHint,
            null,
            'ORDER_NOT_FOUND_FOR_IPN',
            splaro_clip_text(json_encode($ipnPayload), 300),
            ['tran_id' => $tranId, 'order_hint' => $orderHint]
        );
        http_response_code(404);
        echo json_encode(["status" => "error", "message" => "ORDER_NOT_FOUND"]);
        exit;
    }

    $valId = trim((string)($ipnPayload['val_id'] ?? $ipnPayload['validation_id'] ?? ''));
    $validationPayload = [];
    $validationHttpCode = 0;
    $validationError = '';
    if ($valId !== '') {
        $validationQuery = http_build_query([
            'val_id' => $valId,
            'store_id' => trim((string)($ssl['store_id'] ?? '')),
            'store_passwd' => trim((string)($ssl['store_password'] ?? '')),
            'format' => 'json',
            'v' => 1
        ]);
        $validationUrl = sslcommerz_validation_url($ssl);
        $validationTarget = $validationUrl . (strpos($validationUrl, '?') === false ? '?' : '&') . $validationQuery;
        [$validationOk, $validationHttpCode, $validationError, $validationRaw] = integration_http_request(
            $validationTarget,
            'GET',
            [],
            ['Accept: application/json'],
            (int)SSLCOMMERZ_HTTP_TIMEOUT_SECONDS
        );
        $validationPayload = integration_decode_json_or_query($validationRaw);
        if (!$validationOk && $validationError === '') {
            $validationError = 'VALIDATION_HTTP_FAILED';
        }
        integration_log_event(
            $db,
            'SSLCOMMERZ',
            'VALIDATE',
            $validationOk ? 'SUCCESS' : 'ERROR',
            'ORDER',
            (string)($orderRow['id'] ?? ''),
            $validationHttpCode > 0 ? $validationHttpCode : null,
            $validationOk ? '' : $validationError,
            splaro_clip_text((string)$validationRaw, 300),
            ['tran_id' => $tranId, 'val_id' => $valId]
        );
    }

    $effectiveTranId = $tranId !== '' ? $tranId : trim((string)($orderRow['order_no'] ?? $orderRow['id']));
    $paymentStatus = sslcommerz_resolve_validation_status($ipnPayload, $validationPayload);
    $amountRaw = integration_extract_first_value($validationPayload, ['amount', 'amount_original', 'store_amount']);
    if ($amountRaw === null || !is_numeric((string)$amountRaw)) {
        $amountRaw = integration_extract_first_value($ipnPayload, ['amount', 'store_amount']);
    }
    $amount = is_numeric((string)$amountRaw) ? (float)$amountRaw : (float)($orderRow['total'] ?? 0);
    $currency = strtoupper(trim((string)(integration_extract_first_value($validationPayload, ['currency', 'currency_type']) ?? ($ipnPayload['currency'] ?? 'BDT'))));
    if ($currency === '') {
        $currency = 'BDT';
    }

    $eventKey = payment_event_idempotency_key('SSLCOMMERZ', 'IPN', $effectiveTranId, $valId, $paymentStatus, (string)$amount);
    $recorded = ['inserted' => false, 'duplicate' => false, 'id' => 0];
    $orderStatusBefore = admin_normalize_order_status((string)($orderRow['status'] ?? 'Pending'));
    $nextOrderStatus = $orderStatusBefore;
    if ($paymentStatus === 'PAID' && in_array(strtoupper($orderStatusBefore), ['PENDING', 'PAYMENT PENDING'], true)) {
        $nextOrderStatus = 'Processing';
    }
    $nextOrderStatusDb = admin_order_status_db_value($nextOrderStatus);

    try {
        $db->beginTransaction();
        $recorded = record_payment_event($db, [
            'order_id' => (string)$orderRow['id'],
            'provider' => 'SSLCommerz',
            'event_type' => 'IPN',
            'event_key' => $eventKey,
            'transaction_ref' => $effectiveTranId,
            'val_id' => $valId,
            'amount' => $amount,
            'currency' => $currency,
            'status' => $paymentStatus,
            'request_payload' => $ipnPayload,
            'response_payload' => $validationPayload,
            'http_code' => $validationHttpCode > 0 ? $validationHttpCode : null
        ]);

        if (!$recorded['duplicate']) {
            sslcommerz_upsert_payment_row(
                $db,
                (string)$orderRow['id'],
                $effectiveTranId,
                $paymentStatus,
                $amount,
                $currency,
                ['ipn' => $ipnPayload, 'validation' => $validationPayload],
                $valId !== '' ? $valId : null,
                $eventKey
            );

            $updateOrder = $db->prepare("UPDATE orders SET payment_method = 'SSLCommerz', payment_status = ?, paid_at = CASE WHEN ? = 'PAID' THEN COALESCE(paid_at, NOW()) ELSE paid_at END, status = ?, updated_at = NOW() WHERE id = ?");
            $updateOrder->execute([
                $paymentStatus,
                $paymentStatus,
                $nextOrderStatusDb,
                (string)$orderRow['id']
            ]);

            if ($nextOrderStatus !== $orderStatusBefore) {
                admin_write_order_status_history(
                    $db,
                    (string)$orderRow['id'],
                    $orderStatusBefore,
                    $nextOrderStatus,
                    'Payment validated via SSLCommerz IPN',
                    ['id' => 'sslcommerz_ipn', 'role' => 'SYSTEM', 'email' => 'sslcommerz@system']
                );
            }
        }

        $db->commit();
    } catch (Throwable $e) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        splaro_log_exception('sslcommerz.ipn.persist', $e, [
            'order_id' => (string)($orderRow['id'] ?? ''),
            'tran_id' => $effectiveTranId
        ]);
        integration_log_event(
            $db,
            'SSLCOMMERZ',
            'IPN',
            'ERROR',
            'ORDER',
            (string)($orderRow['id'] ?? ''),
            $validationHttpCode > 0 ? $validationHttpCode : null,
            $e->getMessage(),
            splaro_clip_text(json_encode($ipnPayload), 300),
            ['tran_id' => $effectiveTranId]
        );
        http_response_code(500);
        echo json_encode(["status" => "error", "message" => "SSLCOMMERZ_IPN_PROCESS_FAILED"]);
        exit;
    }

    $logLevel = $paymentStatus === 'PAID' ? 'SUCCESS' : ($paymentStatus === 'PENDING' ? 'INFO' : 'WARNING');
    integration_log_event(
        $db,
        'SSLCOMMERZ',
        'IPN',
        $logLevel,
        'ORDER',
        (string)$orderRow['id'],
        $validationHttpCode > 0 ? $validationHttpCode : null,
        $validationError,
        splaro_clip_text(json_encode($validationPayload), 300),
        [
            'tran_id' => $effectiveTranId,
            'payment_status' => $paymentStatus,
            'duplicate' => (bool)$recorded['duplicate']
        ]
    );

    echo json_encode([
        "status" => "success",
        "message" => $recorded['duplicate'] ? "IPN_ALREADY_PROCESSED" : "IPN_PROCESSED",
        "order_id" => (string)$orderRow['id'],
        "order_no" => (string)($orderRow['order_no'] ?? ''),
        "transaction_ref" => $effectiveTranId,
        "payment_status" => $paymentStatus,
        "duplicate" => (bool)$recorded['duplicate']
    ]);
    exit;
}

if ($method === 'GET' && $action === 'sslcommerz_return') {
    $result = strtolower(trim((string)($_GET['result'] ?? $_GET['status'] ?? '')));
    $tranId = trim((string)($_GET['tran_id'] ?? $_GET['transaction_id'] ?? $_GET['order_no'] ?? ''));
    $origin = splaro_public_origin();
    if ($origin === '') {
        $origin = '/';
    }
    $path = '/checkout';
    if (in_array($result, ['success', 'valid', 'paid'], true)) {
        $path = '/order_success';
    } elseif (in_array($result, ['cancel', 'cancelled', 'canceled'], true)) {
        $path = '/checkout';
        $result = 'cancelled';
    } else {
        $result = $result !== '' ? $result : 'pending';
    }

    $separator = strpos($path, '?') === false ? '?' : '&';
    $qs = 'payment=' . rawurlencode($result);
    if ($tranId !== '') {
        $qs .= '&order_no=' . rawurlencode($tranId);
    }
    $redirectTarget = rtrim($origin, '/') . $path . $separator . $qs;

    if (strtolower(trim((string)($_GET['format'] ?? ''))) === 'json') {
        echo json_encode([
            "status" => "success",
            "result" => $result,
            "order_no" => $tranId,
            "redirect_url" => $redirectTarget
        ]);
        exit;
    }

    header('Location: ' . $redirectTarget, true, 302);
    exit;
}

if ($method === 'POST' && in_array($action, ['admin_shipments_steadfast_create', 'steadfast_create_shipment'], true)) {
    require_admin_access($requestAuthUser);
    require_csrf_token();
    $roleBucket = admin_role_bucket(get_admin_role($requestAuthUser));
    if (!in_array($roleBucket, ['OWNER', 'STAFF'], true)) {
        http_response_code(403);
        echo json_encode(["status" => "error", "message" => "SHIPMENT_WRITE_ACCESS_REQUIRED"]);
        exit;
    }

    [$input] = read_request_json_payload('steadfast.create.payload');
    if (!is_array($input)) {
        $input = [];
    }
    $integrationSettings = load_integration_settings($db);
    $steadfast = $integrationSettings['steadfast'] ?? [];
    if (!steadfast_is_enabled($steadfast)) {
        http_response_code(503);
        echo json_encode(["status" => "error", "message" => "STEADFAST_DISABLED"]);
        exit;
    }

    $orderRef = trim((string)($input['order_id'] ?? $input['orderId'] ?? $input['id'] ?? $input['order_no'] ?? $input['orderNo'] ?? ''));
    if ($orderRef === '') {
        http_response_code(400);
        echo json_encode(["status" => "error", "message" => "ORDER_ID_REQUIRED"]);
        exit;
    }
    $force = !empty($input['force']);

    $orderStmt = $db->prepare("SELECT id, order_no, customer_name, customer_email, phone, district, thana, address, total, status, payment_status, customer_comment FROM orders WHERE id = ? OR order_no = ? LIMIT 1");
    $orderStmt->execute([$orderRef, $orderRef]);
    $orderRow = $orderStmt->fetch();
    if (!$orderRow) {
        http_response_code(404);
        echo json_encode(["status" => "error", "message" => "ORDER_NOT_FOUND"]);
        exit;
    }

    $existingShipmentStmt = $db->prepare("SELECT id, order_id, provider, consignment_id, tracking_number, status, external_status, tracking_url, last_error, created_at, updated_at FROM shipments WHERE order_id = ? ORDER BY id DESC LIMIT 1");
    $existingShipmentStmt->execute([(string)$orderRow['id']]);
    $existingShipment = $existingShipmentStmt->fetch();
    if ($existingShipment && !$force) {
        $existingCid = trim((string)($existingShipment['consignment_id'] ?? $existingShipment['tracking_number'] ?? ''));
        if ($existingCid !== '') {
            echo json_encode([
                "status" => "success",
                "message" => "SHIPMENT_ALREADY_EXISTS",
                "data" => [
                    "order_id" => (string)$orderRow['id'],
                    "consignment_id" => $existingCid,
                    "tracking_url" => (string)($existingShipment['tracking_url'] ?? ''),
                    "shipment_status" => (string)($existingShipment['status'] ?? 'PENDING')
                ]
            ]);
            exit;
        }
    }

    $recipientAddress = trim((string)($orderRow['address'] ?? ''));
    $district = trim((string)($orderRow['district'] ?? ''));
    $thana = trim((string)($orderRow['thana'] ?? ''));
    $fullAddress = trim(implode(', ', array_filter([$recipientAddress, $thana, $district])));
    if ($fullAddress === '') {
        $fullAddress = trim((string)($input['recipient_address'] ?? 'Dhaka, Bangladesh'));
    }

    $bookingPayload = [
        'invoice' => trim((string)($orderRow['order_no'] ?? $orderRow['id'])),
        'recipient_name' => trim((string)($orderRow['customer_name'] ?? 'Customer')),
        'recipient_phone' => trim((string)($orderRow['phone'] ?? '')),
        'recipient_address' => $fullAddress,
        'cod_amount' => (float)($orderRow['total'] ?? 0),
        'note' => trim((string)($orderRow['customer_comment'] ?? ($input['note'] ?? 'SPLARO order delivery'))),
        'item_description' => trim((string)($input['item_description'] ?? 'SPLARO order')),
        'pickup_name' => trim((string)($input['pickup_name'] ?? ($steadfast['default_pickup_name'] ?? 'SPLARO'))),
        'pickup_phone' => trim((string)($input['pickup_phone'] ?? ($steadfast['default_pickup_phone'] ?? ''))),
        'pickup_address' => trim((string)($input['pickup_address'] ?? ($steadfast['default_pickup_address'] ?? '')))
    ];

    $baseUrl = rtrim(trim((string)($steadfast['api_base_url'] ?? 'https://portal.packzy.com/api/v1')), '/');
    $path = trim((string)($steadfast['create_order_path'] ?? '/create_order'));
    if ($path === '') {
        $path = '/create_order';
    }
    if ($path[0] !== '/') {
        $path = '/' . $path;
    }
    $endpoint = $baseUrl . $path;
    [$ok, $httpCode, $error, $responseBody] = integration_http_request(
        $endpoint,
        'POST',
        $bookingPayload,
        steadfast_build_headers($steadfast),
        (int)STEADFAST_HTTP_TIMEOUT_SECONDS
    );
    $decoded = integration_decode_json_or_query($responseBody);
    $consignmentId = steadfast_extract_consignment_id($decoded);
    $externalStatus = steadfast_extract_status($decoded);
    $trackingUrl = steadfast_extract_tracking_url($decoded);

    if (!$ok || $consignmentId === '') {
        integration_log_event(
            $db,
            'STEADFAST',
            'BOOKING',
            'ERROR',
            'ORDER',
            (string)$orderRow['id'],
            $httpCode > 0 ? $httpCode : null,
            $error !== '' ? $error : 'CONSIGNMENT_ID_MISSING',
            splaro_clip_text($responseBody, 300),
            ['order_no' => (string)($orderRow['order_no'] ?? '')]
        );
        if ($existingShipment) {
            try {
                $updateError = $db->prepare("UPDATE shipments SET last_error = ?, updated_at = NOW() WHERE id = ?");
                $updateError->execute([
                    $error !== '' ? $error : 'STEADFAST_BOOKING_FAILED',
                    (int)$existingShipment['id']
                ]);
            } catch (Throwable $e) {
                splaro_log_exception('steadfast.create.update_existing_error', $e, ['order_id' => (string)$orderRow['id']], 'WARNING');
            }
        }
        http_response_code(502);
        echo json_encode([
            "status" => "error",
            "message" => "STEADFAST_BOOKING_FAILED",
            "details" => $error !== '' ? $error : 'CONSIGNMENT_ID_MISSING'
        ]);
        exit;
    }

    $mappedShipmentStatus = steadfast_map_order_status($externalStatus, 'Processing');
    try {
        $db->beginTransaction();
        if ($existingShipment) {
            $updateShipment = $db->prepare("UPDATE shipments SET carrier = 'Steadfast', provider = 'STEADFAST', tracking_number = ?, consignment_id = ?, external_status = ?, tracking_url = ?, status = ?, booking_payload_json = ?, payload_json = ?, last_synced_at = NOW(), last_error = NULL, updated_at = NOW() WHERE id = ?");
            $updateShipment->execute([
                $consignmentId,
                $consignmentId,
                $externalStatus !== '' ? $externalStatus : null,
                $trackingUrl !== '' ? $trackingUrl : null,
                $mappedShipmentStatus,
                json_encode($bookingPayload),
                is_string($responseBody) ? $responseBody : json_encode($decoded),
                (int)$existingShipment['id']
            ]);
        } else {
            $insertShipment = $db->prepare("INSERT INTO shipments (order_id, carrier, provider, tracking_number, consignment_id, external_status, tracking_url, status, booking_payload_json, payload_json, last_synced_at, created_at, updated_at) VALUES (?, 'Steadfast', 'STEADFAST', ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NOW())");
            $insertShipment->execute([
                (string)$orderRow['id'],
                $consignmentId,
                $consignmentId,
                $externalStatus !== '' ? $externalStatus : null,
                $trackingUrl !== '' ? $trackingUrl : null,
                $mappedShipmentStatus,
                json_encode($bookingPayload),
                is_string($responseBody) ? $responseBody : json_encode($decoded)
            ]);
        }

        $orderUpdate = $db->prepare("UPDATE orders SET tracking_number = ?, updated_at = NOW() WHERE id = ?");
        $orderUpdate->execute([$consignmentId, (string)$orderRow['id']]);
        $db->commit();
    } catch (Throwable $e) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        splaro_log_exception('steadfast.create.persist', $e, ['order_id' => (string)$orderRow['id']]);
        integration_log_event(
            $db,
            'STEADFAST',
            'BOOKING',
            'ERROR',
            'ORDER',
            (string)$orderRow['id'],
            $httpCode > 0 ? $httpCode : null,
            $e->getMessage(),
            splaro_clip_text($responseBody, 300),
            ['consignment_id' => $consignmentId]
        );
        http_response_code(500);
        echo json_encode(["status" => "error", "message" => "SHIPMENT_SAVE_FAILED"]);
        exit;
    }

    integration_log_event(
        $db,
        'STEADFAST',
        'BOOKING',
        'SUCCESS',
        'ORDER',
        (string)$orderRow['id'],
        $httpCode > 0 ? $httpCode : null,
        '',
        splaro_clip_text($responseBody, 300),
        ['consignment_id' => $consignmentId]
    );

    echo json_encode([
        "status" => "success",
        "message" => "STEADFAST_BOOKED",
        "data" => [
            "order_id" => (string)$orderRow['id'],
            "order_no" => (string)($orderRow['order_no'] ?? ''),
            "consignment_id" => $consignmentId,
            "tracking_url" => $trackingUrl,
            "external_status" => $externalStatus,
            "shipment_status" => $mappedShipmentStatus
        ]
    ]);
    exit;
}

if (in_array($method, ['GET', 'POST'], true) && in_array($action, ['admin_shipments_steadfast_track', 'steadfast_track_shipment'], true)) {
    require_admin_access($requestAuthUser);
    if ($method === 'POST') {
        require_csrf_token();
    }
    $payload = [];
    if ($method === 'POST') {
        [$payload] = read_request_json_payload('steadfast.track.payload');
        if (!is_array($payload)) {
            $payload = [];
        }
    }
    $integrationSettings = load_integration_settings($db);
    $steadfast = $integrationSettings['steadfast'] ?? [];
    if (!steadfast_is_enabled($steadfast)) {
        http_response_code(503);
        echo json_encode(["status" => "error", "message" => "STEADFAST_DISABLED"]);
        exit;
    }

    $orderRef = trim((string)($payload['order_id'] ?? $payload['orderId'] ?? $_GET['order_id'] ?? $_GET['orderId'] ?? $_GET['id'] ?? ''));
    $consignmentRef = trim((string)($payload['consignment_id'] ?? $payload['consignmentId'] ?? $_GET['consignment_id'] ?? $_GET['consignmentId'] ?? ''));

    $shipment = null;
    if ($consignmentRef !== '') {
        $stmt = $db->prepare("SELECT id, order_id, consignment_id, tracking_number, status FROM shipments WHERE consignment_id = ? OR tracking_number = ? ORDER BY id DESC LIMIT 1");
        $stmt->execute([$consignmentRef, $consignmentRef]);
        $shipment = $stmt->fetch();
    }
    if (!$shipment && $orderRef !== '') {
        $stmt = $db->prepare("SELECT id, order_id, consignment_id, tracking_number, status FROM shipments WHERE order_id = ? ORDER BY id DESC LIMIT 1");
        $stmt->execute([$orderRef]);
        $shipment = $stmt->fetch();
    }
    if (!$shipment) {
        http_response_code(404);
        echo json_encode(["status" => "error", "message" => "SHIPMENT_NOT_FOUND"]);
        exit;
    }

    $cid = trim((string)($shipment['consignment_id'] ?? $shipment['tracking_number'] ?? ''));
    if ($cid === '') {
        http_response_code(400);
        echo json_encode(["status" => "error", "message" => "CONSIGNMENT_ID_REQUIRED"]);
        exit;
    }

    $baseUrl = rtrim(trim((string)($steadfast['api_base_url'] ?? 'https://portal.packzy.com/api/v1')), '/');
    $path = trim((string)($steadfast['track_order_path'] ?? '/status_by_cid'));
    if ($path === '') {
        $path = '/status_by_cid';
    }
    if ($path[0] !== '/') {
        $path = '/' . $path;
    }
    $endpoint = $baseUrl . $path;
    $query = http_build_query(['consignment_id' => $cid, 'cid' => $cid]);
    $trackUrl = $endpoint . (strpos($endpoint, '?') === false ? '?' : '&') . $query;
    [$ok, $httpCode, $error, $responseBody] = integration_http_request(
        $trackUrl,
        'GET',
        [],
        steadfast_build_headers($steadfast),
        (int)STEADFAST_HTTP_TIMEOUT_SECONDS
    );
    $decoded = integration_decode_json_or_query($responseBody);
    $externalStatus = steadfast_extract_status($decoded);
    $trackingUrl = steadfast_extract_tracking_url($decoded);
    $nextStatus = steadfast_map_order_status($externalStatus, (string)($shipment['status'] ?? 'Processing'));
    $timelinePayload = integration_extract_first_value($decoded, ['timeline', 'data.timeline', 'history', 'events']);
    if (!is_array($timelinePayload)) {
        $timelinePayload = [];
    }

    if (!$ok) {
        try {
            $updateFail = $db->prepare("UPDATE shipments SET last_error = ?, last_synced_at = NOW(), updated_at = NOW() WHERE id = ?");
            $updateFail->execute([$error !== '' ? $error : 'TRACKING_HTTP_FAILED', (int)$shipment['id']]);
        } catch (Throwable $e) {
            splaro_log_exception('steadfast.track.persist_error', $e, ['shipment_id' => (string)$shipment['id']], 'WARNING');
        }
        integration_log_event(
            $db,
            'STEADFAST',
            'TRACK',
            'ERROR',
            'SHIPMENT',
            (string)$shipment['id'],
            $httpCode > 0 ? $httpCode : null,
            $error !== '' ? $error : 'TRACKING_HTTP_FAILED',
            splaro_clip_text($responseBody, 300),
            ['consignment_id' => $cid]
        );
        http_response_code(502);
        echo json_encode(["status" => "error", "message" => "STEADFAST_TRACK_FAILED"]);
        exit;
    }

    $orderStmt = $db->prepare("SELECT id, status FROM orders WHERE id = ? LIMIT 1");
    $orderStmt->execute([(string)$shipment['order_id']]);
    $orderRow = $orderStmt->fetch();
    try {
        $db->beginTransaction();
        $updateShipment = $db->prepare("UPDATE shipments SET external_status = ?, tracking_url = ?, status = ?, timeline_json = ?, payload_json = ?, last_synced_at = NOW(), last_error = NULL, updated_at = NOW() WHERE id = ?");
        $updateShipment->execute([
            $externalStatus !== '' ? $externalStatus : null,
            $trackingUrl !== '' ? $trackingUrl : null,
            $nextStatus,
            json_encode($timelinePayload),
            is_string($responseBody) ? $responseBody : json_encode($decoded),
            (int)$shipment['id']
        ]);

        if ($orderRow) {
            $orderStatusBefore = admin_normalize_order_status((string)($orderRow['status'] ?? 'Pending'));
            $orderStatusAfter = $orderStatusBefore;
            if ($nextStatus === 'Delivered') {
                $orderStatusAfter = 'Delivered';
            } elseif ($nextStatus === 'Shipped' && in_array(strtoupper($orderStatusBefore), ['PENDING', 'PROCESSING'], true)) {
                $orderStatusAfter = 'Shipped';
            } elseif ($nextStatus === 'Cancelled' && in_array(strtoupper($orderStatusBefore), ['PENDING', 'PROCESSING', 'SHIPPED'], true)) {
                $orderStatusAfter = 'Cancelled';
            }
            $orderStatusAfterDb = admin_order_status_db_value($orderStatusAfter);
            $orderUpdate = $db->prepare("UPDATE orders SET tracking_number = ?, status = ?, updated_at = NOW() WHERE id = ?");
            $orderUpdate->execute([$cid, $orderStatusAfterDb, (string)$shipment['order_id']]);
            if ($orderStatusAfter !== $orderStatusBefore) {
                admin_write_order_status_history(
                    $db,
                    (string)$shipment['order_id'],
                    $orderStatusBefore,
                    $orderStatusAfter,
                    'Steadfast tracking sync update',
                    ['id' => 'steadfast_sync', 'role' => 'SYSTEM', 'email' => 'steadfast@system']
                );
            }
        }
        $db->commit();
    } catch (Throwable $e) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        splaro_log_exception('steadfast.track.persist', $e, ['shipment_id' => (string)$shipment['id']]);
        integration_log_event(
            $db,
            'STEADFAST',
            'TRACK',
            'ERROR',
            'SHIPMENT',
            (string)$shipment['id'],
            $httpCode > 0 ? $httpCode : null,
            $e->getMessage(),
            splaro_clip_text($responseBody, 300),
            ['consignment_id' => $cid]
        );
        http_response_code(500);
        echo json_encode(["status" => "error", "message" => "SHIPMENT_TRACK_PERSIST_FAILED"]);
        exit;
    }

    integration_log_event(
        $db,
        'STEADFAST',
        'TRACK',
        'SUCCESS',
        'SHIPMENT',
        (string)$shipment['id'],
        $httpCode > 0 ? $httpCode : null,
        '',
        splaro_clip_text($responseBody, 300),
        ['consignment_id' => $cid, 'external_status' => $externalStatus, 'mapped_status' => $nextStatus]
    );

    echo json_encode([
        "status" => "success",
        "message" => "STEADFAST_TRACK_SYNCED",
        "data" => [
            "shipment_id" => (int)$shipment['id'],
            "order_id" => (string)$shipment['order_id'],
            "consignment_id" => $cid,
            "external_status" => $externalStatus,
            "shipment_status" => $nextStatus,
            "tracking_url" => $trackingUrl
        ]
    ]);
    exit;
}

if ($method === 'POST' && in_array($action, ['admin_shipments_steadfast_sync', 'steadfast_sync_shipments'], true)) {
    require_admin_access($requestAuthUser);
    require_csrf_token();
    $roleBucket = admin_role_bucket(get_admin_role($requestAuthUser));
    if (!in_array($roleBucket, ['OWNER', 'STAFF'], true)) {
        http_response_code(403);
        echo json_encode(["status" => "error", "message" => "SHIPMENT_WRITE_ACCESS_REQUIRED"]);
        exit;
    }

    [$payload] = read_request_json_payload('steadfast.sync.payload');
    if (!is_array($payload)) {
        $payload = [];
    }
    $limit = (int)($payload['limit'] ?? $_GET['limit'] ?? 20);
    if ($limit < 1) $limit = 1;
    if ($limit > 100) $limit = 100;

    $integrationSettings = load_integration_settings($db);
    $steadfast = $integrationSettings['steadfast'] ?? [];
    if (!steadfast_is_enabled($steadfast)) {
        http_response_code(503);
        echo json_encode(["status" => "error", "message" => "STEADFAST_DISABLED"]);
        exit;
    }

    $rows = safe_query_all(
        $db,
        "SELECT id, order_id, consignment_id, tracking_number, status FROM shipments WHERE provider = 'STEADFAST' AND COALESCE(NULLIF(consignment_id, ''), NULLIF(tracking_number, '')) IS NOT NULL ORDER BY COALESCE(last_synced_at, created_at) ASC LIMIT {$limit}"
    );

    $results = [];
    $synced = 0;
    $failed = 0;
    foreach ($rows as $row) {
        $shipmentId = (int)($row['id'] ?? 0);
        $cid = trim((string)($row['consignment_id'] ?? $row['tracking_number'] ?? ''));
        if ($shipmentId < 1 || $cid === '') {
            continue;
        }
        $_GET['consignment_id'] = $cid;
        $_GET['order_id'] = (string)($row['order_id'] ?? '');

        $baseUrl = rtrim(trim((string)($steadfast['api_base_url'] ?? 'https://portal.packzy.com/api/v1')), '/');
        $path = trim((string)($steadfast['track_order_path'] ?? '/status_by_cid'));
        if ($path === '') $path = '/status_by_cid';
        if ($path[0] !== '/') $path = '/' . $path;
        $endpoint = $baseUrl . $path;
        $query = http_build_query(['consignment_id' => $cid, 'cid' => $cid]);
        $trackUrl = $endpoint . (strpos($endpoint, '?') === false ? '?' : '&') . $query;

        [$ok, $httpCode, $error, $responseBody] = integration_http_request(
            $trackUrl,
            'GET',
            [],
            steadfast_build_headers($steadfast),
            (int)STEADFAST_HTTP_TIMEOUT_SECONDS
        );
        $decoded = integration_decode_json_or_query($responseBody);
        $externalStatus = steadfast_extract_status($decoded);
        $trackingUrl = steadfast_extract_tracking_url($decoded);
        $mapped = steadfast_map_order_status($externalStatus, (string)($row['status'] ?? 'Processing'));
        $timelinePayload = integration_extract_first_value($decoded, ['timeline', 'data.timeline', 'history', 'events']);
        if (!is_array($timelinePayload)) {
            $timelinePayload = [];
        }

        if (!$ok) {
            $failed++;
            try {
                $db->prepare("UPDATE shipments SET last_error = ?, last_synced_at = NOW(), updated_at = NOW() WHERE id = ?")
                    ->execute([$error !== '' ? $error : 'TRACKING_HTTP_FAILED', $shipmentId]);
            } catch (Throwable $e) {
                splaro_log_exception('steadfast.sync.track_fail_update', $e, ['shipment_id' => (string)$shipmentId], 'WARNING');
            }
            $results[] = [
                'shipment_id' => $shipmentId,
                'consignment_id' => $cid,
                'status' => 'failed',
                'error' => $error !== '' ? $error : 'TRACKING_HTTP_FAILED',
                'http_code' => $httpCode
            ];
            continue;
        }

        try {
            $db->beginTransaction();
            $db->prepare("UPDATE shipments SET external_status = ?, tracking_url = ?, status = ?, timeline_json = ?, payload_json = ?, last_synced_at = NOW(), last_error = NULL, updated_at = NOW() WHERE id = ?")
                ->execute([
                    $externalStatus !== '' ? $externalStatus : null,
                    $trackingUrl !== '' ? $trackingUrl : null,
                    $mapped,
                    json_encode($timelinePayload),
                    is_string($responseBody) ? $responseBody : json_encode($decoded),
                    $shipmentId
                ]);
            $db->prepare("UPDATE orders SET tracking_number = ?, status = CASE WHEN UPPER(?) = 'DELIVERED' THEN 'DELIVERED' WHEN UPPER(?) = 'SHIPPED' AND UPPER(status) IN ('PENDING','PROCESSING') THEN 'SHIPPED' WHEN UPPER(?) IN ('CANCELLED','CANCELED') AND UPPER(status) IN ('PENDING','PROCESSING','SHIPPED') THEN 'CANCELLED' ELSE status END, updated_at = NOW() WHERE id = ?")
                ->execute([$cid, $mapped, $mapped, $mapped, (string)($row['order_id'] ?? '')]);
            $db->commit();
            $synced++;
            $results[] = [
                'shipment_id' => $shipmentId,
                'consignment_id' => $cid,
                'status' => 'synced',
                'external_status' => $externalStatus,
                'mapped_status' => $mapped,
                'http_code' => $httpCode
            ];
        } catch (Throwable $e) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            $failed++;
            splaro_log_exception('steadfast.sync.persist', $e, ['shipment_id' => (string)$shipmentId], 'WARNING');
            $results[] = [
                'shipment_id' => $shipmentId,
                'consignment_id' => $cid,
                'status' => 'failed',
                'error' => $e->getMessage(),
                'http_code' => $httpCode
            ];
        }
    }

    integration_log_event(
        $db,
        'STEADFAST',
        'SYNC',
        $failed > 0 ? 'WARNING' : 'SUCCESS',
        'SHIPMENT_BATCH',
        (string)count($rows),
        null,
        $failed > 0 ? 'Some tracking sync attempts failed' : '',
        '',
        ['synced' => $synced, 'failed' => $failed, 'limit' => $limit]
    );

    echo json_encode([
        "status" => "success",
        "message" => "STEADFAST_SYNC_COMPLETED",
        "data" => [
            "total" => count($rows),
            "synced" => $synced,
            "failed" => $failed,
            "results" => $results
        ]
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
        try {
            $orderId = 'SPL-' . strtoupper(substr(bin2hex(random_bytes(4)), 0, 8));
        } catch (Exception $e) {
            splaro_log_exception('order.id.random_bytes', $e, [], 'WARNING');
            $orderId = 'SPL-' . strtoupper(substr(sha1(uniqid('', true)), 0, 8));
        }
    }
    $orderNo = trim((string)($input['orderNo'] ?? ($input['order_no'] ?? '')));
    if ($orderNo === '') {
        $orderNo = generate_order_reference($db);
    }
    $input['id'] = $orderId;
    $input['order_no'] = $orderNo;
    splaro_integration_trace('order.handler.validated', [
        'order_id' => $orderId,
        'order_no' => $orderNo,
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
        $initialStatus = admin_normalize_order_status($input['status'] ?? 'Pending');
        $initialStatusDb = admin_order_status_db_value($initialStatus);
        $stmt = $db->prepare("INSERT INTO orders (id, order_no, user_id, customer_name, customer_email, phone, district, thana, address, items, total, status, customer_comment, shipping_fee, discount_amount, discount_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([
            $orderId,
            $orderNo,
            $resolvedUserId,
            $input['customerName'],
            $input['customerEmail'],
            $input['phone'],
            $input['district'] ?? '',
            $input['thana'] ?? '',
            $input['address'],
            $orderItemsJson,
            $input['total'],
            $initialStatusDb,
            $input['customerComment'] ?? null,
            isset($input['shippingFee']) ? (int)$input['shippingFee'] : null,
            isset($input['discountAmount']) ? (int)$input['discountAmount'] : 0,
            $input['discountCode'] ?? null
        ]);

        $parsedItems = invoice_parse_items($input['items'] ?? []);
        $productQuantities = [];
        if (!empty($parsedItems)) {
            $itemInsert = $db->prepare("INSERT INTO order_items (order_id, product_id, product_name, product_slug, brand, category, variant_size, variant_color, quantity, unit_price, line_total, product_url, image_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
            foreach ($parsedItems as $index => $item) {
                $rawItem = isset($input['items'][$index]) && is_array($input['items'][$index]) ? $input['items'][$index] : [];
                $rawProduct = isset($rawItem['product']) && is_array($rawItem['product']) ? $rawItem['product'] : [];
                $productId = trim((string)($rawProduct['id'] ?? ''));
                $quantity = max(1, (int)($item['quantity'] ?? 1));
                $itemInsert->execute([
                    $orderId,
                    $productId,
                    (string)($item['name'] ?? 'Product'),
                    (string)($rawProduct['productSlug'] ?? $rawProduct['slug'] ?? ''),
                    (string)($rawProduct['brand'] ?? ''),
                    (string)($rawProduct['category'] ?? ''),
                    (string)($item['size'] ?? ''),
                    (string)($item['color'] ?? ''),
                    $quantity,
                    (float)($item['unitPrice'] ?? 0),
                    (float)($item['lineTotal'] ?? 0),
                    (string)($item['productUrl'] ?? ''),
                    (string)($item['imageUrl'] ?? '')
                ]);
                if ($productId !== '') {
                    $productQuantities[$productId] = (int)($productQuantities[$productId] ?? 0) + $quantity;
                }
            }
        }

        if (!empty($productQuantities)) {
            $stockReadStmt = $db->prepare("SELECT stock FROM products WHERE id = ? LIMIT 1 FOR UPDATE");
            $stockWriteStmt = $db->prepare("UPDATE products SET stock = ?, updated_at = NOW() WHERE id = ?");
            foreach ($productQuantities as $productId => $qtyNeeded) {
                $stockReadStmt->execute([(string)$productId]);
                $stockRow = $stockReadStmt->fetch();
                if (!$stockRow) {
                    splaro_integration_trace('order.stock.product_missing', [
                        'order_id' => (string)$orderId,
                        'product_id' => (string)$productId
                    ], 'WARNING');
                    continue;
                }

                $stockBefore = (int)($stockRow['stock'] ?? 0);
                if ($stockBefore < (int)$qtyNeeded) {
                    throw new RuntimeException('INSUFFICIENT_STOCK_FOR_PRODUCT_' . $productId);
                }
                $stockAfter = $stockBefore - (int)$qtyNeeded;
                $stockWriteStmt->execute([$stockAfter, (string)$productId]);
                record_stock_movement(
                    $db,
                    (string)$productId,
                    null,
                    'ORDER_DECREMENT',
                    (int)$qtyNeeded * -1,
                    $stockBefore,
                    $stockAfter,
                    'Stock reserved on order create',
                    'ORDER',
                    (string)$orderId,
                    (string)($requestAuthUser['id'] ?? null)
                );
            }
        }

        admin_write_order_status_history(
            $db,
            $orderId,
            null,
            $initialStatus,
            'Order created via checkout',
            $requestAuthUser
        );
        $db->commit();
        splaro_integration_trace('order.db.insert.committed', ['order_id' => $orderId]);
    } catch (Exception $e) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        error_log("SPLARO_ORDER_CREATE_FAILURE: " . $e->getMessage());
        splaro_log_exception('order.db.insert', $e, ['order_id' => $orderId]);
        $message = 'ORDER_CREATE_FAILED';
        $statusCode = 500;
        $rawError = (string)$e->getMessage();
        if (strpos($rawError, 'INSUFFICIENT_STOCK_FOR_PRODUCT_') === 0) {
            $message = 'INSUFFICIENT_STOCK';
            $statusCode = 409;
        }
        http_response_code($statusCode);
        echo json_encode(["status" => "error", "message" => $message]);
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
        'status' => (string)($initialStatus ?? admin_normalize_order_status($input['status'] ?? 'Pending')),
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

    $pushOrderResult = ['notification_id' => 0, 'subscription_count' => 0, 'queued_jobs' => 0];
    try {
        $pushOrderResult = queue_order_created_notification(
            $db,
            (string)$orderId,
            (string)($resolvedUserId ?? ''),
            (int)($input['total'] ?? 0)
        );
        splaro_integration_trace('order.integration.push_queue_result', [
            'order_id' => (string)$orderId,
            'notification_id' => (int)($pushOrderResult['notification_id'] ?? 0),
            'subscriptions' => (int)($pushOrderResult['subscription_count'] ?? 0),
            'queued_jobs' => (int)($pushOrderResult['queued_jobs'] ?? 0)
        ]);
    } catch (Exception $e) {
        splaro_log_exception('order.integration.push_queue', $e, [
            'order_id' => (string)$orderId
        ], 'WARNING');
    }

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

    $invoiceDispatch = [
        "status" => "NOT_ATTEMPTED",
        "channel" => "",
        "serial" => null,
        "downloadUrl" => null,
        "error" => null
    ];
    $customerMail = false;
    $customerEmail = trim((string)($input['customerEmail'] ?? ''));

    $invoiceOrderSelectFields = build_select_fields($db, 'orders', [
        'id', 'user_id', 'customer_name', 'customer_email', 'phone', 'district', 'thana',
        'address', 'items', 'total', 'status', 'tracking_number', 'admin_notes',
        'customer_comment', 'shipping_fee', 'discount_amount', 'discount_code', 'created_at'
    ]);
    $settingsSelectFields = site_settings_select_fields($db);
    $settingsRow = $db->query("SELECT {$settingsSelectFields} FROM site_settings WHERE id = 1 LIMIT 1")->fetch();
    $settingsJson = safe_json_decode_assoc($settingsRow['settings_json'] ?? '{}', []);
    $invoiceSettingsRaw = $settingsJson['invoiceSettings'] ?? ($settingsJson['invoice_settings'] ?? []);
    $invoiceSettings = invoice_normalize_settings($invoiceSettingsRaw, $settingsRow ?: []);
    $invoiceType = strtoupper((string)($invoiceSettings['defaultType'] ?? 'INV'));

    if (!empty($invoiceSettings['invoiceEnabled'])) {
        try {
            $orderForInvoiceStmt = $db->prepare("SELECT {$invoiceOrderSelectFields} FROM orders WHERE id = ? LIMIT 1");
            $orderForInvoiceStmt->execute([$orderId]);
            $orderForInvoice = $orderForInvoiceStmt->fetch();
            if ($orderForInvoice) {
                $autoInvoice = invoice_create_document($db, $orderForInvoice, $invoiceSettings, $invoiceType, 'checkout_auto', true);
                $customerMail = strtoupper((string)($autoInvoice['status'] ?? '')) === 'SENT';
                $invoiceDispatch = [
                    "status" => (string)($autoInvoice['status'] ?? 'FAILED'),
                    "channel" => "INVOICE_DOCUMENT",
                    "serial" => (string)($autoInvoice['serial'] ?? ''),
                    "downloadUrl" => (string)($autoInvoice['pdfUrl'] ?? ($autoInvoice['htmlUrl'] ?? '')),
                    "error" => $autoInvoice['error'] ?? null
                ];
            } else {
                $invoiceDispatch = [
                    "status" => "FAILED",
                    "channel" => "INVOICE_DOCUMENT",
                    "serial" => null,
                    "downloadUrl" => null,
                    "error" => "ORDER_NOT_FOUND_FOR_INVOICE"
                ];
            }
        } catch (Throwable $invoiceException) {
            splaro_log_exception('order.invoice_document.send', $invoiceException, [
                'order_id' => (string)$orderId
            ], 'WARNING');
            $invoiceDispatch = [
                "status" => "FAILED",
                "channel" => "INVOICE_DOCUMENT",
                "serial" => null,
                "downloadUrl" => null,
                "error" => "INVOICE_DOCUMENT_SEND_FAILED"
            ];
        }
    }

    if (!$customerMail) {
        if ($customerEmail !== '' && filter_var($customerEmail, FILTER_VALIDATE_EMAIL)) {
            $customerMail = smtp_send_mail($db, $customerEmail, "INVOICE: Your Splaro Order #" . $input['id'], $invoice_body, true);
            if (!$customerMail) {
                usleep(300000);
                $customerMail = smtp_send_mail($db, $customerEmail, "INVOICE: Your Splaro Order #" . $input['id'], $invoice_body, true);
            }

            if ($customerMail) {
                $invoiceDispatch['status'] = 'SENT';
                $invoiceDispatch['channel'] = !empty($invoiceDispatch['channel']) ? ($invoiceDispatch['channel'] . '+HTML_RETRY') : 'HTML_EMAIL';
                $invoiceDispatch['error'] = null;
            } elseif ($invoiceDispatch['status'] === 'NOT_ATTEMPTED') {
                $invoiceDispatch['status'] = 'FAILED';
                $invoiceDispatch['channel'] = 'HTML_EMAIL';
                $invoiceDispatch['error'] = 'SMTP_SEND_FAILED';
            }
        } else {
            if ($invoiceDispatch['status'] === 'NOT_ATTEMPTED') {
                $invoiceDispatch['status'] = 'FAILED';
                $invoiceDispatch['channel'] = 'HTML_EMAIL';
            }
            $invoiceDispatch['error'] = 'INVALID_CUSTOMER_EMAIL';
        }
    }

    if (empty($invoiceDispatch['channel'])) {
        $invoiceDispatch['channel'] = $customerMail ? 'HTML_EMAIL' : 'NONE';
    }
    if ($invoiceDispatch['serial'] === '') {
        $invoiceDispatch['serial'] = null;
    }
    if ($invoiceDispatch['downloadUrl'] === '') {
        $invoiceDispatch['downloadUrl'] = null;
    }

    echo json_encode([
        "status" => "success",
        "order_id" => (string)$orderId,
        "order_no" => (string)$orderNo,
        "message" => $customerMail ? "INVOICE_DISPATCHED" : "ORDER_PLACED_EMAIL_PENDING",
        "email" => ["admin" => false, "customer" => $customerMail],
        "invoice" => $invoiceDispatch,
        "integrations" => [
            "sheets" => ["queued" => (bool)$orderSyncQueued],
            "telegram" => ["queued" => (bool)$telegramOrderQueued],
            "push" => [
                "notification_id" => (int)($pushOrderResult['notification_id'] ?? 0),
                "queued_jobs" => (int)($pushOrderResult['queued_jobs'] ?? 0)
            ]
        ]
    ]);
    exit;
}

// 2.1 LOGISTICS UPDATE PROTOCOL
if ($method === 'POST' && $action === 'update_order_status') {
    require_admin_access($requestAuthUser);
    require_csrf_token();
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
    $statusLabel = admin_normalize_order_status($input['status'] ?? '');
    $statusDb = admin_order_status_db_value($statusLabel);
    $statusNote = trim((string)($input['note'] ?? ''));
    if ($orderId === '' || $statusLabel === '') {
        echo json_encode(["status" => "error", "message" => "MISSING_PARAMETERS"]);
        exit;
    }

    try {
        $beforeStmt = $db->prepare("SELECT id, status FROM orders WHERE id = ? LIMIT 1");
        $beforeStmt->execute([$orderId]);
        $beforeRow = $beforeStmt->fetch();
        if (!$beforeRow) {
            echo json_encode(["status" => "error", "message" => "ORDER_NOT_FOUND"]);
            exit;
        }

        $db->beginTransaction();
        $stmt = $db->prepare("UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?");
        $stmt->execute([$statusDb, $orderId]);
        admin_write_order_status_history(
            $db,
            $orderId,
            admin_normalize_order_status((string)($beforeRow['status'] ?? 'Pending')),
            $statusLabel,
            $statusNote !== '' ? $statusNote : 'Status updated from admin panel',
            $requestAuthUser
        );
        $db->commit();

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

        $pushStatusResult = ['notification_id' => 0, 'subscription_count' => 0, 'queued_jobs' => 0];
        try {
            $pushStatusResult = queue_order_status_notification($db, (string)$orderId, (string)$statusLabel);
            splaro_integration_trace('order.status_update.push_queue_result', [
                'order_id' => (string)$orderId,
                'status' => (string)$statusLabel,
                'notification_id' => (int)($pushStatusResult['notification_id'] ?? 0),
                'queued_jobs' => (int)($pushStatusResult['queued_jobs'] ?? 0)
            ]);
        } catch (Exception $e) {
            splaro_log_exception('order.status_update.push_queue', $e, [
                'order_id' => (string)$orderId,
                'status' => (string)$statusLabel
            ], 'WARNING');
        }

        echo json_encode([
            "status" => "success",
            "message" => "STATUS_SYNCHRONIZED",
            "telegram" => ["queued" => (bool)$telegramStatusQueued],
            "push" => [
                "notification_id" => (int)($pushStatusResult['notification_id'] ?? 0),
                "queued_jobs" => (int)($pushStatusResult['queued_jobs'] ?? 0)
            ]
        ]);
        exit;
    } catch (Exception $e) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
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
    require_csrf_token();
    $input = json_decode(file_get_contents('php://input'), true);
    if (isset($input['id'])) {
        $orderId = (string)$input['id'];
        if (column_exists($db, 'orders', 'deleted_at')) {
            $stmt = $db->prepare("UPDATE orders SET deleted_at = NOW(), updated_at = NOW() WHERE id = ?");
            $stmt->execute([$orderId]);
        } else {
            $stmt = $db->prepare("DELETE FROM orders WHERE id = ?");
            $stmt->execute([$orderId]);
        }
        sync_to_sheets('DELETE_ORDER', $input);

        // Security Protocol: Log the erasure
        $ip = $_SERVER['REMOTE_ADDR'] ?? 'UNKNOWN';
        $db->prepare("INSERT INTO system_logs (event_type, event_description, ip_address) VALUES (?, ?, ?)")
           ->execute(['REGISTRY_ERASURE', "Order " . $orderId . " was removed from active registry.", $ip]);
        log_audit_event(
            $db,
            (string)($requestAuthUser['id'] ?? $requestAuthUser['email'] ?? 'admin_key'),
            'ORDER_DELETED',
            'ORDER',
            $orderId,
            null,
            ['softDelete' => column_exists($db, 'orders', 'deleted_at')],
            $ip
        );

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

        $existingStmt = $db->prepare("SELECT id, price, status, image, stock FROM products WHERE id = ? LIMIT 1");
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
            $incomingStock = isset($p['stock']) ? (int)$p['stock'] : 50;
            if ($incomingStock < 0) {
                $incomingStock = 0;
            }

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
                $incomingStock,
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
                if ((int)($existing['stock'] ?? 0) !== (int)$incomingStock) {
                    $deltaQty = (int)$incomingStock - (int)($existing['stock'] ?? 0);
                    record_stock_movement(
                        $db,
                        $productId,
                        null,
                        'ADJUSTMENT',
                        $deltaQty,
                        (int)($existing['stock'] ?? 0),
                        (int)$incomingStock,
                        'Product sync stock update',
                        'PRODUCT_SYNC',
                        $productId,
                        $actorId
                    );
                    audit_log_insert(
                        $db,
                        $actorId,
                        'STOCK_CHANGED',
                        'PRODUCT',
                        $productId,
                        ['stock' => (int)($existing['stock'] ?? 0)],
                        ['stock' => (int)$incomingStock, 'deltaQty' => $deltaQty],
                        $ipAddress
                    );
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
                if ($incomingStock !== 0) {
                    record_stock_movement(
                        $db,
                        $productId,
                        null,
                        'INITIAL',
                        (int)$incomingStock,
                        0,
                        (int)$incomingStock,
                        'Product sync initial stock',
                        'PRODUCT_SYNC',
                        $productId,
                        $actorId
                    );
                }
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
    if (!in_array($role, ['USER', 'STAFF', 'ADMIN', 'OWNER', 'SUPER_ADMIN', 'EDITOR', 'VIEWER'], true)) {
        $role = 'USER';
    }
    if (in_array($role, ['OWNER', 'STAFF', 'ADMIN', 'SUPER_ADMIN', 'EDITOR', 'VIEWER'], true)) {
        $adminKeyHeader = trim((string)get_header_value('X-Admin-Key'));
        if (ADMIN_KEY === '' || !hash_equals(ADMIN_KEY, $adminKeyHeader)) {
            $role = 'USER';
        }
    }

    $isAdminIdentity = is_admin_login_email($email, $db);
    $isOwnerIdentity = is_owner_identity_email($email, $db);
    if ($isAdminIdentity) {
        if ($isOwnerIdentity) {
            $role = 'OWNER';
        } elseif (!in_array($role, ['OWNER', 'SUPER_ADMIN', 'EDITOR', 'STAFF', 'VIEWER'], true)) {
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
    $usersHasEmailVerified = column_exists($db, 'users', 'email_verified');

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
        if ($isAdminIdentity || in_array($existingRole, ['OWNER', 'STAFF', 'ADMIN', 'SUPER_ADMIN', 'EDITOR', 'VIEWER'], true)) {
            if ($isOwnerIdentity || $existingRole === 'OWNER') {
                $persistRole = 'OWNER';
            } else {
                $persistRole = in_array($role, ['OWNER', 'SUPER_ADMIN', 'EDITOR', 'STAFF', 'VIEWER'], true) ? $role : $existingRole;
            }
            if (!in_array($persistRole, ['OWNER', 'STAFF', 'ADMIN', 'SUPER_ADMIN', 'EDITOR', 'VIEWER'], true)) {
                $persistRole = $isOwnerIdentity ? 'OWNER' : 'ADMIN';
            }
        } elseif (in_array($role, ['OWNER', 'STAFF', 'ADMIN', 'SUPER_ADMIN', 'EDITOR', 'VIEWER'], true)) {
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
        $emailVerifiedTarget = ($isOwnerIdentity || isset($input['google_sub'])) ? 1 : (int)($existing['email_verified'] ?? 0);

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
        if ($usersHasEmailVerified) {
            $updateParts[] = "email_verified = ?";
            $updateValues[] = $emailVerifiedTarget;
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
    $emailVerifiedTarget = ($isOwnerIdentity || isset($input['google_sub'])) ? 1 : 0;
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
    if ($usersHasEmailVerified) {
        $insertColumns[] = 'email_verified';
        $insertValues[] = $emailVerifiedTarget;
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
        'verified' => $emailVerifiedTarget === 1,
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

    // Admin alert is Telegram + Sheets only. Email notification to admin is intentionally disabled.
    $adminMail = false;

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

    $pushSignupResult = ['notification_id' => 0, 'subscription_count' => 0, 'queued_jobs' => 0];
    try {
        $pushSignupResult = queue_signup_notification($db, (string)$id, (string)$name);
        splaro_integration_trace('signup.integration.push_queue_result', [
            'user_id' => (string)$id,
            'notification_id' => (int)($pushSignupResult['notification_id'] ?? 0),
            'queued_jobs' => (int)($pushSignupResult['queued_jobs'] ?? 0)
        ]);
    } catch (Exception $e) {
        splaro_log_exception('signup.integration.push_queue', $e, [
            'user_id' => (string)$id
        ], 'WARNING');
    }

    $csrfToken = refresh_csrf_token();
    echo json_encode([
        "status" => "success",
        "user" => $userPayload,
        "token" => $token,
        "csrf_token" => $csrfToken,
        "email" => ["admin" => false, "welcome" => $welcomeMail],
        "integrations" => [
            "sheets" => ["queued" => (bool)$signupSyncQueued],
            "telegram" => ["queued" => (bool)$telegramSignupQueued],
            "push" => [
                "notification_id" => (int)($pushSignupResult['notification_id'] ?? 0),
                "queued_jobs" => (int)($pushSignupResult['queued_jobs'] ?? 0)
            ]
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

function normalize_recovery_phone_local($value) {
    $raw = trim((string)$value);
    if ($raw === '') {
        return '';
    }

    $digits = preg_replace('/\D+/', '', $raw);
    if (!is_string($digits) || $digits === '') {
        return '';
    }

    if (strpos($digits, '0088') === 0) {
        $digits = substr($digits, 2);
    }

    if (strlen($digits) === 13 && strpos($digits, '8801') === 0) {
        $digits = '0' . substr($digits, 3);
    }

    if (!preg_match('/^01[3-9]\d{8}$/', (string)$digits)) {
        return '';
    }

    return (string)$digits;
}

function find_user_for_recovery($db, $identifier) {
    $raw = trim((string)$identifier);
    $userSelectFields = users_sensitive_select_fields($db);

    if ($raw === '') {
        return ['user' => null, 'type' => '', 'normalized' => ''];
    }

    $emailCandidate = strtolower($raw);
    if (!filter_var($emailCandidate, FILTER_VALIDATE_EMAIL)) {
        return ['user' => null, 'type' => '', 'normalized' => $emailCandidate];
    }

    $stmt = $db->prepare("SELECT {$userSelectFields} FROM users WHERE LOWER(TRIM(email)) = ? LIMIT 1");
    $stmt->execute([$emailCandidate]);
    $user = $stmt->fetch();
    if ($user) {
        return ['user' => $user, 'type' => 'email', 'normalized' => $emailCandidate];
    }

    return ['user' => null, 'type' => 'email', 'normalized' => $emailCandidate];
}

function issue_email_verification_otp($db, $user, $context = 'LOGIN') {
    $userId = trim((string)($user['id'] ?? ''));
    $targetEmail = strtolower(trim((string)($user['email'] ?? '')));
    if ($userId === '' || !filter_var($targetEmail, FILTER_VALIDATE_EMAIL)) {
        return ['ok' => false, 'message' => 'INVALID_EMAIL'];
    }

    $otp = random_int(100000, 999999);
    $expiry = date('Y-m-d H:i:s', strtotime('+15 minutes'));
    $update = $db->prepare("UPDATE users SET email_verify_code = ?, email_verify_expiry = ? WHERE id = ?");
    $update->execute([$otp, $expiry, $userId]);

    $subject = "SPLARO Email Verification OTP";
    $message = "Your SPLARO email verification code is: " . $otp . "

This OTP will expire in 15 minutes.";
    $sent = smtp_send_mail($db, $targetEmail, $subject, nl2br($message), true);

    $ip = $_SERVER['REMOTE_ADDR'] ?? 'UNKNOWN';
    if ($sent) {
        log_system_event($db, 'EMAIL_VERIFICATION_OTP_ISSUED', "Email verification OTP issued for user {$userId} ({$context})", $userId, $ip);
        return ['ok' => true, 'message' => 'EMAIL_VERIFICATION_OTP_SENT', 'channel' => 'EMAIL'];
    }

    log_system_event($db, 'EMAIL_VERIFICATION_OTP_FAILED', "Failed to deliver email verification OTP for user {$userId} ({$context})", $userId, $ip);
    return ['ok' => false, 'message' => 'EMAIL_OTP_DELIVERY_FAILED'];
}

if ($method === 'POST' && $action === 'request_email_verification_otp') {
    if (is_rate_limited('request_email_verification_otp', 8, 60)) {
        echo json_encode(["status" => "error", "message" => "RATE_LIMIT_EXCEEDED"]);
        exit;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    $identifier = strtolower(trim((string)($input['identifier'] ?? ($input['email'] ?? ''))));
    if (!filter_var($identifier, FILTER_VALIDATE_EMAIL)) {
        echo json_encode(["status" => "error", "message" => "INVALID_EMAIL"]);
        exit;
    }

    $userSelectFields = users_sensitive_select_fields($db);
    $stmt = $db->prepare("SELECT {$userSelectFields} FROM users WHERE LOWER(TRIM(email)) = ? LIMIT 1");
    $stmt->execute([$identifier]);
    $user = $stmt->fetch();
    if (!$user) {
        echo json_encode(["status" => "error", "message" => "IDENTITY_NOT_FOUND"]);
        exit;
    }

    if ((int)($user['email_verified'] ?? 0) === 1) {
        echo json_encode(["status" => "success", "message" => "EMAIL_ALREADY_VERIFIED"]);
        exit;
    }

    $issue = issue_email_verification_otp($db, $user, 'MANUAL_REQUEST');
    if (!empty($issue['ok'])) {
        echo json_encode([
            "status" => "success",
            "message" => (string)($issue['message'] ?? 'EMAIL_VERIFICATION_OTP_SENT'),
            "channel" => (string)($issue['channel'] ?? 'EMAIL')
        ]);
    } else {
        echo json_encode(["status" => "error", "message" => (string)($issue['message'] ?? 'EMAIL_OTP_DELIVERY_FAILED')]);
    }
    exit;
}

if ($method === 'POST' && $action === 'verify_email_otp') {
    if (is_rate_limited('verify_email_otp', 10, 60)) {
        echo json_encode(["status" => "error", "message" => "RATE_LIMIT_EXCEEDED"]);
        exit;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    $identifier = strtolower(trim((string)($input['identifier'] ?? ($input['email'] ?? ''))));
    $otp = trim((string)($input['otp'] ?? ''));
    if (!filter_var($identifier, FILTER_VALIDATE_EMAIL) || !preg_match('/^\d{6}$/', $otp)) {
        echo json_encode(["status" => "error", "message" => "INVALID_VERIFICATION_REQUEST"]);
        exit;
    }

    $userSelectFields = users_sensitive_select_fields($db);
    $stmt = $db->prepare("SELECT {$userSelectFields} FROM users WHERE LOWER(TRIM(email)) = ? LIMIT 1");
    $stmt->execute([$identifier]);
    $user = $stmt->fetch();
    if (!$user) {
        echo json_encode(["status" => "error", "message" => "INVALID_CODE_OR_EXPIRED"]);
        exit;
    }

    if ((int)($user['email_verified'] ?? 0) === 1) {
        echo json_encode(["status" => "success", "message" => "EMAIL_ALREADY_VERIFIED"]);
        exit;
    }

    $verifyStmt = $db->prepare("SELECT {$userSelectFields} FROM users WHERE id = ? AND email_verify_code = ? AND email_verify_expiry > NOW() LIMIT 1");
    $verifyStmt->execute([(string)$user['id'], $otp]);
    $verifiedUser = $verifyStmt->fetch();
    if (!$verifiedUser) {
        echo json_encode(["status" => "error", "message" => "INVALID_CODE_OR_EXPIRED"]);
        exit;
    }

    $update = $db->prepare("UPDATE users SET email_verified = 1, email_verify_code = NULL, email_verify_expiry = NULL, updated_at = NOW() WHERE id = ?");
    $update->execute([(string)$verifiedUser['id']]);

    $reload = $db->prepare("SELECT {$userSelectFields} FROM users WHERE id = ? LIMIT 1");
    $reload->execute([(string)$verifiedUser['id']]);
    $reloadedUser = $reload->fetch() ?: $verifiedUser;

    log_system_event(
        $db,
        'EMAIL_VERIFIED',
        "Email verification completed for user " . (string)($reloadedUser['id'] ?? ''),
        (string)($reloadedUser['id'] ?? ''),
        $_SERVER['REMOTE_ADDR'] ?? 'UNKNOWN'
    );

    $safeUser = sanitize_user_payload($reloadedUser);
    $token = issue_auth_token($safeUser);
    $csrfToken = refresh_csrf_token();
    echo json_encode([
        "status" => "success",
        "message" => "EMAIL_VERIFIED",
        "user" => $safeUser,
        "token" => $token,
        "csrf_token" => $csrfToken
    ]);
    exit;
}

// 5.1 PASSWORD RECOVERY PROTOCOL (GENERATE OTP)
if ($method === 'POST' && $action === 'forgot_password') {
    if (is_rate_limited('forgot_password', 8, 60)) {
        echo json_encode(["status" => "error", "message" => "RATE_LIMIT_EXCEEDED"]);
        exit;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    $identifier = trim((string)($input['identifier'] ?? ($input['email'] ?? '')));
    $emailCandidate = strtolower($identifier);
    if (!filter_var($emailCandidate, FILTER_VALIDATE_EMAIL)) {
        echo json_encode(["status" => "error", "message" => "INVALID_EMAIL"]);
        exit;
    }

    $lookup = find_user_for_recovery($db, $emailCandidate);
    $user = is_array($lookup['user'] ?? null) ? $lookup['user'] : null;
    if ($user) {
        $otp = random_int(100000, 999999);
        $expiry = date('Y-m-d H:i:s', strtotime('+15 minutes'));

        $userId = (string)($user['id'] ?? '');
        $targetEmail = strtolower(trim((string)($user['email'] ?? '')));
        if (!filter_var($targetEmail, FILTER_VALIDATE_EMAIL)) {
            $targetEmail = '';
        }

        $stmt = $db->prepare("UPDATE users SET reset_code = ?, reset_expiry = ? WHERE id = ?");
        $stmt->execute([$otp, $expiry, $userId]);

        $subject = "IDENTITY RECOVERY: Verification Code";
        $message = "Your Splaro Identity Verification Code is: " . $otp . "

This code expires in 15 minutes. If you did not request this, please ignore.";
        $success = false;
        if ($targetEmail !== '') {
            $success = smtp_send_mail($db, $targetEmail, $subject, nl2br($message), true);
        }

        $maskedEmail = $targetEmail !== '' ? splaro_clip_text($targetEmail, 80) : 'N/A';
        $maskedPhone = splaro_clip_text((string)($user['phone'] ?? ''), 40);
        $telegramOtpMessage = "<b>🔐 Password Reset OTP</b>\n"
            . "<b>User ID:</b> " . telegram_escape_html($userId) . "\n"
            . "<b>Email:</b> " . telegram_escape_html($maskedEmail) . "\n"
            . "<b>Phone:</b> " . telegram_escape_html($maskedPhone) . "\n"
            . "<b>OTP:</b> " . telegram_escape_html((string)$otp) . "\n"
            . "<b>Expires:</b> " . telegram_escape_html($expiry);
        $telegramSent = send_telegram_message($telegramOtpMessage);

        $ip = $_SERVER['REMOTE_ADDR'] ?? 'UNKNOWN';
        if ($success && $telegramSent) {
            log_system_event($db, 'PASSWORD_RECOVERY_OTP_ISSUED', "Recovery OTP issued via EMAIL+TELEGRAM for user {$userId}", $userId, $ip);
            echo json_encode([
                "status" => "success",
                "message" => "RECOVERY_SIGNAL_DISPATCHED",
                "channel" => "EMAIL_AND_TELEGRAM"
            ]);
        } elseif ($success) {
            log_system_event($db, 'PASSWORD_RECOVERY_OTP_ISSUED', "Recovery OTP issued via EMAIL for user {$userId}", $userId, $ip);
            echo json_encode([
                "status" => "success",
                "message" => "RECOVERY_SIGNAL_DISPATCHED",
                "channel" => "EMAIL"
            ]);
        } elseif ($telegramSent) {
            log_system_event($db, 'PASSWORD_RECOVERY_OTP_ISSUED', "Recovery OTP issued via TELEGRAM for user {$userId}", $userId, $ip);
            echo json_encode([
                "status" => "success",
                "message" => "RECOVERY_CODE_SENT_TO_ADMIN_TELEGRAM",
                "channel" => "TELEGRAM"
            ]);
        } else {
            // Controlled fallback so user is never stuck when mail gateway is down.
            $allowOtpPreview = strtolower((string)env_or_default('ALLOW_OTP_PREVIEW', 'true')) === 'true';
            $db->prepare("INSERT INTO system_logs (event_type, event_description, ip_address) VALUES (?, ?, ?)")
               ->execute([
                   'RECOVERY_FALLBACK',
                   "OTP generated but delivery failed for user {$userId}.",
                   $ip
               ]);
            splaro_record_system_error('AUTH_RECOVERY', 'ERROR', 'Password recovery delivery failed on all channels.', [
                'user_id' => $userId,
                'identifier_type' => (string)($lookup['type'] ?? ''),
                'target_email_present' => $targetEmail !== '',
                'telegram_enabled' => (bool)TELEGRAM_ENABLED
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
    $identifier = trim((string)($input['identifier'] ?? ($input['email'] ?? '')));
    $otp = trim((string)($input['otp'] ?? ''));
    $new_password = (string)($input['password'] ?? '');
    $emailCandidate = strtolower($identifier);
    if (!filter_var($emailCandidate, FILTER_VALIDATE_EMAIL) || $otp === '' || strlen($new_password) < 6) {
        echo json_encode(["status" => "error", "message" => "INVALID_RESET_REQUEST"]);
        exit;
    }

    $lookup = find_user_for_recovery($db, $emailCandidate);
    $candidate = is_array($lookup['user'] ?? null) ? $lookup['user'] : null;
    if (!$candidate) {
        echo json_encode(["status" => "error", "message" => "INVALID_CODE_OR_EXPIRED"]);
        exit;
    }

    $userSelectFields = users_sensitive_select_fields($db);
    $stmt = $db->prepare("SELECT {$userSelectFields} FROM users WHERE id = ? AND reset_code = ? AND reset_expiry > NOW()");
    $stmt->execute([(string)$candidate['id'], $otp]);
    $user = $stmt->fetch();

    if ($user) {
        $newPasswordHash = password_hash($new_password, PASSWORD_DEFAULT);
        $stmt = $db->prepare("UPDATE users SET password = ?, reset_code = NULL, reset_expiry = NULL, last_password_change_at = NOW(), force_relogin = 1 WHERE id = ?");
        $stmt->execute([$newPasswordHash, (string)$user['id']]);

        log_system_event(
            $db,
            'PASSWORD_RECOVERY_RESET',
            "Password reset completed for user " . (string)($user['id'] ?? ''),
            (string)($user['id'] ?? ''),
            $_SERVER['REMOTE_ADDR'] ?? 'UNKNOWN'
        );
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
        $emailVerified = (int)($user['email_verified'] ?? 0) === 1;
        if (!$emailVerified && is_owner_identity_email((string)($user['email'] ?? ''), $db)) {
            try {
                $db->prepare("UPDATE users SET email_verified = 1, email_verify_code = NULL, email_verify_expiry = NULL WHERE id = ?")
                    ->execute([(string)$user['id']]);
                $emailVerified = true;
                $reloadOwner = $db->prepare("SELECT {$userSelectFields} FROM users WHERE id = ? LIMIT 1");
                $reloadOwner->execute([(string)$user['id']]);
                $ownerRow = $reloadOwner->fetch();
                if ($ownerRow) {
                    $user = $ownerRow;
                }
            } catch (Exception $e) {
                splaro_log_exception('login.owner_auto_verify', $e, [
                    'user_id' => (string)($user['id'] ?? '')
                ], 'WARNING');
            }
        }

        if (!$emailVerified) {
            $issue = issue_email_verification_otp($db, $user, 'LOGIN_BLOCK');
            $response = [
                "status" => "error",
                "message" => "EMAIL_VERIFICATION_REQUIRED",
                "channel" => "EMAIL"
            ];
            if (empty($issue['ok'])) {
                $response['delivery'] = 'FAILED';
                $response['delivery_message'] = (string)($issue['message'] ?? 'EMAIL_OTP_DELIVERY_FAILED');
            }
            echo json_encode($response);
            exit;
        }

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
        'logistics_config',
        'invoiceSettings',
        'invoice_settings',
        'slides',
        'googleClientId',
        'google_client_id',
        'integrationSettings',
        'integration_settings',
        'paymentGateways',
        'payment_gateways',
        'shippingProviders',
        'shipping_providers',
        'sslcommerz',
        'steadfast'
    ];
    $hasSensitivePayload = false;
    foreach ($sensitiveKeys as $sensitiveKey) {
        if (array_key_exists($sensitiveKey, $input)) {
            $hasSensitivePayload = true;
            break;
        }
    }
    $hasIntegrationPayload = array_key_exists('integrationSettings', $input)
        || array_key_exists('integration_settings', $input)
        || array_key_exists('paymentGateways', $input)
        || array_key_exists('payment_gateways', $input)
        || array_key_exists('shippingProviders', $input)
        || array_key_exists('shipping_providers', $input)
        || array_key_exists('sslcommerz', $input)
        || array_key_exists('steadfast', $input);

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
    if ($adminRole === 'STAFF' && $hasSensitivePayload && !$hasIntegrationPayload) {
        http_response_code(403);
        echo json_encode(["status" => "error", "message" => "ROLE_FORBIDDEN_STAFF_PROTOCOL"]);
        exit;
    }

    if ($hasCmsPayload && !can_edit_cms_role($adminRole)) {
        http_response_code(403);
        echo json_encode(["status" => "error", "message" => "CMS_ROLE_FORBIDDEN"]);
        exit;
    }

    if ($hasIntegrationPayload && !in_array($adminRole, ['OWNER', 'ADMIN', 'SUPER_ADMIN', 'STAFF'], true)) {
        http_response_code(403);
        echo json_encode(["status" => "error", "message" => "INTEGRATION_SETTINGS_ROLE_FORBIDDEN"]);
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
        $currentIntegrationSettings = normalize_integration_settings(
            $existingSettingsJson['integrationSettings']
                ?? $existingSettingsJson['integration_settings']
                ?? [
                    'sslcommerz' => $existingSettingsJson['sslcommerz'] ?? [],
                    'steadfast' => $existingSettingsJson['steadfast'] ?? []
                ],
            load_integration_settings($db, $existingSettingsRow)
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

        $currentLogisticsConfig = normalize_logistics_config(
            safe_json_decode_assoc($existingSettingsRow['logistics_config'] ?? '{}', [])
        );
        $incomingLogisticsConfig = null;
        if (array_key_exists('logisticsConfig', $input)) {
            $incomingLogisticsConfig = $input['logisticsConfig'];
        } elseif (array_key_exists('logistics_config', $input)) {
            $incomingLogisticsConfig = $input['logistics_config'];
        }
        $nextLogisticsConfig = normalize_logistics_config($incomingLogisticsConfig, $currentLogisticsConfig);

        $incomingIntegrationSettings = null;
        if (array_key_exists('integrationSettings', $input)) {
            $incomingIntegrationSettings = $input['integrationSettings'];
        } elseif (array_key_exists('integration_settings', $input)) {
            $incomingIntegrationSettings = $input['integration_settings'];
        } else {
            $gatewayInput = $input['paymentGateways'] ?? ($input['payment_gateways'] ?? []);
            $shippingInput = $input['shippingProviders'] ?? ($input['shipping_providers'] ?? []);
            $sslInput = $input['sslcommerz'] ?? (is_array($gatewayInput) ? ($gatewayInput['sslcommerz'] ?? null) : null);
            $steadfastInput = $input['steadfast'] ?? (is_array($shippingInput) ? ($shippingInput['steadfast'] ?? null) : null);
            if ($sslInput !== null || $steadfastInput !== null) {
                $incomingIntegrationSettings = [
                    'sslcommerz' => is_array($sslInput) ? $sslInput : [],
                    'steadfast' => is_array($steadfastInput) ? $steadfastInput : []
                ];
            }
        }
        $nextIntegrationSettings = $currentIntegrationSettings;
        if ($hasIntegrationPayload) {
            $nextIntegrationSettings = normalize_integration_settings(
                is_array($incomingIntegrationSettings) ? $incomingIntegrationSettings : [],
                $currentIntegrationSettings
            );
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
        $nextSettingsJson['integrationSettings'] = $nextIntegrationSettings;
        $nextSettingsJson['paymentGateways'] = ['sslcommerz' => $nextIntegrationSettings['sslcommerz'] ?? []];
        $nextSettingsJson['shippingProviders'] = ['steadfast' => $nextIntegrationSettings['steadfast'] ?? []];
        $nextSettingsJson['sslcommerz'] = $nextIntegrationSettings['sslcommerz'] ?? [];
        $nextSettingsJson['steadfast'] = $nextIntegrationSettings['steadfast'] ?? [];
        $incomingInvoiceSettings = $input['invoiceSettings'] ?? ($input['invoice_settings'] ?? null);
        if (is_array($incomingInvoiceSettings)) {
            $nextSettingsJson['invoiceSettings'] = invoice_normalize_settings(array_merge($currentInvoiceSettings, $incomingInvoiceSettings), $existingSettingsRow);
        } else {
            $nextSettingsJson['invoiceSettings'] = $currentInvoiceSettings;
        }
        if ($hasCmsPayload) {
            $invoiceThemeSynced = $nextSettingsJson['invoiceSettings'];
            $invoiceThemeSynced['theme'] = invoice_theme_from_cms_bundle(
                $nextCmsDraft,
                is_array($invoiceThemeSynced['theme'] ?? null) ? $invoiceThemeSynced['theme'] : invoice_default_settings()['theme']
            );
            $nextSettingsJson['invoiceSettings'] = invoice_normalize_settings($invoiceThemeSynced, $existingSettingsRow);
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
            json_encode($nextLogisticsConfig)
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
        if ($hasIntegrationPayload) {
            log_audit_event(
                $db,
                (string)($requestAuthUser['id'] ?? 'system'),
                'INTEGRATION_SETTINGS_UPDATED',
                'SITE_SETTINGS',
                'integration_settings',
                ['integrationSettings' => integration_mask_settings_for_output($currentIntegrationSettings)],
                ['integrationSettings' => integration_mask_settings_for_output($nextIntegrationSettings)],
                $ip
            );
        }

        echo json_encode([
            "status" => "success",
            "message" => "CONFIGURATION_ARCHIVED",
            "storage" => "mysql",
            "cms_active_version" => $nextCmsActiveVersion,
            "cms_revisions" => $nextCmsRevisions,
            "integration_settings" => integration_mask_settings_for_output($nextIntegrationSettings)
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
    require_csrf_token();
    $input = json_decode(file_get_contents('php://input'), true);
    if (isset($input['id'])) {
        $targetUserId = (string)$input['id'];
        $targetUserStmt = $db->prepare("SELECT id, email, role FROM users WHERE id = ? LIMIT 1");
        $targetUserStmt->execute([$targetUserId]);
        $targetUser = $targetUserStmt->fetch();
        if (!$targetUser) {
            echo json_encode(["status" => "error", "message" => "USER_NOT_FOUND"]);
            exit;
        }
        $targetRole = strtoupper((string)($targetUser['role'] ?? 'USER'));
        $targetEmail = strtolower(trim((string)($targetUser['email'] ?? '')));
        $isSelfDelete = is_array($requestAuthUser) && !empty($requestAuthUser['id']) && hash_equals((string)$requestAuthUser['id'], (string)$targetUserId);
        if ($isSelfDelete) {
            echo json_encode(["status" => "error", "message" => "SELF_DELETE_NOT_ALLOWED"]);
            exit;
        }
        if ($targetRole === 'OWNER' || is_owner_identity_email($targetEmail, $db)) {
            echo json_encode(["status" => "error", "message" => "OWNER_DELETE_NOT_ALLOWED"]);
            exit;
        }
        if (column_exists($db, 'users', 'deleted_at')) {
            $stmt = $db->prepare("UPDATE users SET deleted_at = NOW(), is_blocked = 1, updated_at = NOW() WHERE id = ?");
            $stmt->execute([$targetUserId]);
        } else {
            $stmt = $db->prepare("DELETE FROM users WHERE id = ?");
            $stmt->execute([$targetUserId]);
        }
        sync_to_sheets('DELETE_USER', $input);

        // Security Protocol: Log the identity termination
        $ip = $_SERVER['REMOTE_ADDR'] ?? 'UNKNOWN';
        $db->prepare("INSERT INTO system_logs (event_type, event_description, ip_address) VALUES (?, ?, ?)")
           ->execute(['IDENTITY_TERMINATION', "Identity record " . $targetUserId . " was removed from active registry.", $ip]);
        log_audit_event(
            $db,
            (string)($requestAuthUser['id'] ?? $requestAuthUser['email'] ?? 'admin_key'),
            'USER_DELETED',
            'USER',
            $targetUserId,
            null,
            ['softDelete' => column_exists($db, 'users', 'deleted_at')],
            $ip
        );

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
    $activePushSubscriptions = 0;
    try {
        $activePushSubscriptions = (int)$db->query("SELECT COUNT(*) FROM push_subscriptions WHERE is_active = 1")->fetchColumn();
    } catch (Exception $e) {
        splaro_log_exception('queue.status.push_active_count', $e, [], 'WARNING');
    }
    echo json_encode([
        "status" => "success",
        "queue" => [
            "telegram" => get_telegram_queue_summary($db),
            "push" => get_push_queue_summary($db),
            "sheets" => get_sync_queue_summary($db)
        ],
        "push" => [
            "enabled" => PUSH_ENABLED,
            "active_subscriptions" => (int)$activePushSubscriptions
        ]
    ]);
    exit;
}

if ($method === 'POST' && $action === 'recover_dead_queue') {
    require_admin_access($requestAuthUser);
    require_csrf_token();
    [$payload] = read_request_json_payload('queue.recover.payload');

    $mode = strtoupper(trim((string)($payload['mode'] ?? 'ALL')));
    if (!in_array($mode, ['ALL', 'TELEGRAM', 'PUSH', 'SHEETS'], true)) {
        $mode = 'ALL';
    }
    $limit = (int)($payload['limit'] ?? 200);
    if ($limit < 1) $limit = 1;
    if ($limit > 1000) $limit = 1000;
    $processAfter = !empty($payload['process_after']) || !empty($payload['drain']) || (($_GET['process_after'] ?? '') === '1');

    $beforeQueue = [
        'telegram' => get_telegram_queue_summary($db),
        'push' => get_push_queue_summary($db),
        'sheets' => get_sync_queue_summary($db)
    ];

    $recoverResult = recover_dead_queue_jobs($db, [
        'mode' => $mode,
        'limit' => $limit
    ]);

    $processResult = [
        'campaigns' => ['processed' => 0, 'queued_jobs' => 0],
        'telegram' => ['processed' => 0, 'success' => 0, 'failed' => 0, 'retried' => 0, 'dead' => 0],
        'push' => ['processed' => 0, 'success' => 0, 'failed' => 0, 'retried' => 0, 'dead' => 0],
        'sheets' => ['processed' => 0, 'success' => 0, 'failed' => 0, 'retried' => 0, 'dead' => 0],
    ];
    if ($processAfter) {
        $processResult['campaigns'] = process_due_campaigns($db, 3);
        $processResult['telegram'] = process_telegram_queue($db, 8);
        $processResult['push'] = process_push_queue($db, 12);
        $processResult['sheets'] = process_sync_queue($db, 8, true);
    }

    $afterQueue = [
        'telegram' => get_telegram_queue_summary($db),
        'push' => get_push_queue_summary($db),
        'sheets' => get_sync_queue_summary($db)
    ];

    $deadBefore = (int)($beforeQueue['telegram']['dead'] ?? 0)
        + (int)($beforeQueue['push']['dead'] ?? 0)
        + (int)($beforeQueue['sheets']['dead'] ?? 0);
    $deadAfter = (int)($afterQueue['telegram']['dead'] ?? 0)
        + (int)($afterQueue['push']['dead'] ?? 0)
        + (int)($afterQueue['sheets']['dead'] ?? 0);

    log_system_event(
        $db,
        'QUEUE_DEAD_RECOVERY',
        "Dead queue recovery mode={$mode}; scanned={$recoverResult['total_dead_scanned']}; recovered={$recoverResult['recovered']}; skipped={$recoverResult['skipped_permanent']}; dead_before={$deadBefore}; dead_after={$deadAfter}",
        (string)($requestAuthUser['id'] ?? $requestAuthUser['email'] ?? 'admin'),
        $_SERVER['REMOTE_ADDR'] ?? 'SERVER'
    );

    if ((int)($recoverResult['failed_updates'] ?? 0) > 0) {
        splaro_record_system_error('QUEUE', 'ERROR', 'Failed to move some dead jobs into retry queue.', [
            'failed_updates' => (int)$recoverResult['failed_updates'],
            'mode' => (string)$mode
        ]);
    }

    echo json_encode([
        "status" => "success",
        "result" => $recoverResult,
        "processed" => $processResult,
        "queue_before" => $beforeQueue,
        "queue_after" => $afterQueue
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
    $pushLimit = (int)($payload['push_limit'] ?? $limit);
    if ($pushLimit < 1) $pushLimit = 1;
    if ($pushLimit > 200) $pushLimit = 200;

    $campaignResult = process_due_campaigns($db, 5);
    $telegramResult = process_telegram_queue($db, $telegramLimit);
    $pushResult = process_push_queue($db, $pushLimit);
    $sheetsResult = process_sync_queue($db, $limit, $force);
    echo json_encode([
        "status" => "success",
        "result" => [
            "campaigns" => $campaignResult,
            "telegram" => $telegramResult,
            "push" => $pushResult,
            "sheets" => $sheetsResult
        ],
        "queue" => [
            "telegram" => get_telegram_queue_summary($db),
            "push" => get_push_queue_summary($db),
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
    if (is_array($requestAuthUser) && !in_array($adminRole, ['OWNER', 'ADMIN', 'SUPER_ADMIN'], true)) {
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
    if ($timeout > 30) $timeout = 30;

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
        $connectTimeout = max(1, min($timeout - 1, 8));
        if ($connectTimeout <= 0) {
            $connectTimeout = 1;
        }
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
        $stmt = $db->prepare("SELECT id, sync_type, payload_json, attempts, max_attempts FROM sync_queue WHERE sync_type NOT LIKE 'TELEGRAM_%' AND sync_type NOT LIKE 'PUSH_%' AND status IN ('PENDING', 'RETRY') AND next_attempt_at <= NOW() ORDER BY id ASC LIMIT ?");
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
        splaro_integration_trace('campaign.queue.shutdown.drain_start', ['limit' => 3]);
        $campaignResult = process_due_campaigns($db, 3);
        splaro_integration_trace('campaign.queue.shutdown.drain_done', $campaignResult);
        splaro_integration_trace('push.queue.shutdown.drain_start', ['limit' => 10]);
        $pushDrainResult = process_push_queue($db, 10);
        splaro_integration_trace('push.queue.shutdown.drain_done', $pushDrainResult);
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
