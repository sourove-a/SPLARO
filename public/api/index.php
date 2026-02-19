<?php
/**
 * SPLARO INSTITUTIONAL DATA GATEWAY
 * Institutional API endpoint for Hostinger Deployment
 */

require_once 'config.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

$db = get_db_connection();

// Handle Preflight Options
if ($method === 'OPTIONS') {
    exit;
}

// 1. DATA RETRIEVAL PROTOCOL
if ($method === 'GET' && $action === 'sync') {
    $data = [
        'products' => $db->query("SELECT * FROM products")->fetchAll(),
        'orders'   => $db->query("SELECT * FROM orders ORDER BY created_at DESC")->fetchAll(),
        'users'    => $db->query("SELECT * FROM users")->fetchAll(),
        'settings' => $db->query("SELECT * FROM site_settings LIMIT 1")->fetch(),
    ];
    echo json_encode(["status" => "success", "data" => $data]);
    exit;
}

// 2. ORDER DEPLOYMENT PROTOCOL
if ($method === 'POST' && $action === 'create_order') {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input) {
        echo json_encode(["status" => "error", "message" => "INVALID_PAYLOAD"]);
        exit;
    }

    $stmt = $db->prepare("INSERT INTO orders (id, customer_name, customer_email, phone, address, items, total, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt->execute([
        $input['id'],
        $input['customerName'],
        $input['customerEmail'],
        $input['phone'],
        $input['address'],
        json_encode($input['items']),
        $input['total'],
        $input['status'],
        $input['createdAt']
    ]);

    // TRIGGER EMAIL NOTIFICATION
    $to = SMTP_USER;
    $subject = "NEW ACQUISITION ALERT: " . $input['id'];
    $message = "Institutional Order Received.\n\nCollector: " . $input['customerName'] . "\nValue: ৳" . $input['total'] . "\nID: " . $input['id'];
    $headers = "From: " . SMTP_USER;
    
    mail($to, $subject, $message, $headers);

    echo json_encode(["status" => "success", "message" => "ORDER_PERSISTED_IN_SQL"]);
    exit;
}

// 3. PRODUCT SYCHRONIZATION
if ($method === 'POST' && $action === 'sync_products') {
    $products = json_decode(file_get_contents('php://input'), true);
    
    $db->prepare("DELETE FROM products")->execute(); // Flush for fresh sync
    
    foreach ($products as $p) {
        $stmt = $db->prepare("INSERT INTO products (id, name, brand, price, image, category, type) VALUES (?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([$p['id'], $p['name'], $p['brand'], $p['price'], $p['image'], $p['category'], $p['type']]);
    }

    echo json_encode(["status" => "success", "message" => "PRODUCT_MANIFEST_UPDATED"]);
    exit;
}

// 4. IDENTITY AUTHENTICATION (SIGNUP)
if ($method === 'POST' && $action === 'signup') {
    $input = json_decode(file_get_contents('php://input'), true);
    
    $check = $db->prepare("SELECT id FROM users WHERE email = ?");
    $check->execute([$input['email']]);
    if ($check->fetch()) {
        echo json_encode(["status" => "error", "message" => "IDENTITY_ALREADY_ARCHIVED"]);
        exit;
    }

    $stmt = $db->prepare("INSERT INTO users (id, name, email, phone, password, role) VALUES (?, ?, ?, ?, ?, ?)");
    $stmt->execute([
        $input['id'],
        $input['name'],
        $input['email'],
        $input['phone'],
        $input['password'],
        $input['role']
    ]);

    echo json_encode(["status" => "success", "user" => $input]);
    exit;
}

// 5. IDENTITY VALIDATION (LOGIN)
if ($method === 'POST' && $action === 'login') {
    $input = json_decode(file_get_contents('php://input'), true);
    $stmt = $db->prepare("SELECT * FROM users WHERE email = ? AND password = ?");
    $stmt->execute([$input['identifier'], $input['password']]);
    $user = $stmt->fetch();

    if ($user) {
        unset($user['password']); // Safety Protocol
        echo json_encode(["status" => "success", "user" => $user]);
    } else {
        echo json_encode(["status" => "error", "message" => "INVALID_CREDENTIALS"]);
    }
    exit;
}

http_response_code(404);
echo json_encode(["status" => "error", "message" => "ACTION_NOT_RECOGNIZED"]);
