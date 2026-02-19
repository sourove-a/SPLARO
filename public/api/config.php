<?php
/**
 * SPLARO INSTITUTIONAL CONFIGURATION MANIFEST
 * Target Environment: Hostinger Shared/Business
 */

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json");

// 1. DATABASE COORDINATES
define('DB_HOST', 'localhost'); // Hostinger usually uses 'localhost'
define('DB_NAME', 'u134578371_SPLARO'); 
define('DB_USER', 'u134578371_splaro');    
define('DB_PASS', 'Sourove017@#%&*-+()'); 

// 2. SMTP COMMAND CENTER
define('SMTP_HOST', 'smtp.hostinger.com');
define('SMTP_PORT', 465);
define('SMTP_USER', 'admin@splaro.co');
define('SMTP_PASS', 'Sourove017@'); 

/**
 * Establish Security Handshake with MySQL Database
 */
function get_db_connection() {
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
        echo json_encode(["status" => "error", "message" => "DATABASE_CONNECTION_FAILED: " . $e->getMessage()]);
        exit;
    }
}
