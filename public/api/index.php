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
        'logs'     => $db->query("SELECT * FROM system_logs ORDER BY created_at DESC LIMIT 50")->fetchAll(),
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

    // SYNC TO GOOGLE SHEETS
    sync_to_sheets('ORDER', $input);

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
    <div style='background: #000; color: #fff; font-family: -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif; padding: 60px; max-width: 700px; margin: auto; border: 1px solid #1a1a1a; box-shadow: 0 50px 100px rgba(0,0,0,0.5);'>
        <div style='display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 60px; border-bottom: 1px solid #111; padding-bottom: 40px;'>
            <div>
                <h1 style='letter-spacing: 20px; margin: 0; font-weight: 900; background: linear-gradient(to right, #fff, #555); -webkit-background-clip: text; -webkit-text-fill-color: transparent;'>SPLARO</h1>
                <p style='font-size: 8px; color: #444; letter-spacing: 5px; margin-top: 10px; text-transform: uppercase;'>Luxury Institutional Archive &copy; SPL-2026</p>
            </div>
            <div style='text-align: right;'>
                <p style='margin: 0; font-size: 10px; color: #00cfd5; font-weight: 900; letter-spacing: 2px;'>AUTHENTIC ACQUISITION</p>
                <p style='margin: 5px 0 0; font-size: 11px; color: #555; font-family: monospace;'>PROTO-VERIFY: " . strtoupper(substr(md5($input['id']), 0, 12)) . "</p>
            </div>
        </div>
        
        <div style='display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 60px;'>
            <div style='border-left: 2px solid #00cfd5; padding-left: 20px;'>
                <p style='margin: 0; font-size: 10px; color: #333; text-transform: uppercase; font-weight: 900; letter-spacing: 1px;'>Shipment To</p>
                <h2 style='margin: 10px 0; font-size: 18px; font-weight: 700;'>{$input['customerName']}</h2>
                <p style='margin: 0; font-size: 13px; color: #777; line-height: 1.6;'>{$input['address']}<br>T: {$input['phone']}</p>
            </div>
            <div style='text-align: right;'>
                <p style='margin: 0; font-size: 10px; color: #333; text-transform: uppercase; font-weight: 900; letter-spacing: 1px;'>Invoice Reference</p>
                <h2 style='margin: 10px 0; font-size: 18px; font-weight: 700;'>#{$input['id']}</h2>
                <p style='margin: 0; font-size: 13px; color: #777;'>" . date('F d, Y') . "</p>
            </div>
        </div>

        <table style='width: 100%; border-collapse: collapse; margin-bottom: 60px;'>
            <thead>
                <tr style='background: #080808; font-size: 9px; text-transform: uppercase; letter-spacing: 2px;'>
                    <th style='padding: 20px; text-align: left; color: #444; border-bottom: 1px solid #111;'>Institutional Item</th>
                    <th style='padding: 20px; text-align: center; color: #444; border-bottom: 1px solid #111;'>Qty</th>
                    <th style='padding: 20px; text-align: right; color: #444; border-bottom: 1px solid #111;'>Valuation</th>
                </tr>
            </thead>
            <tbody>
                {$items_html}
            </tbody>
        </table>

        <div style='background: #050505; border: 1px solid #111; padding: 40px; border-radius: 20px;'>
            <div style='display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;'>
                <span style='font-size: 12px; color: #444; text-transform: uppercase; font-weight: 900;'>Subtotal Archive</span>
                <span style='font-size: 16px; font-weight: 600;'>৳" . number_format($input['total']) . "</span>
            </div>
            <div style='display: flex; justify-content: space-between; align-items: center; padding-top: 20px; border-top: 1px solid #111;'>
                <span style='font-size: 14px; color: #00cfd5; text-transform: uppercase; font-weight: 900; letter-spacing: 2px;'>Total Protocol Amount</span>
                <span style='font-size: 32px; font-weight: 900; color: #fff;'>৳" . number_format($input['total']) . "</span>
            </div>
        </div>

        <div style='margin-top: 60px; text-align: center;'>
            <div style='margin-bottom: 30px;'>
                <p style='font-family: \"Georgia\", serif; font-style: italic; font-size: 24px; color: #333; margin: 0;'>Splaro Signature</p>
                <div style='width: 150px; h-1px; background: #111; margin: 10px auto;'></div>
                <p style='font-size: 8px; color: #444; text-transform: uppercase; letter-spacing: 3px;'>Chief Archivist Authorization</p>
            </div>
            <p style='font-size: 10px; color: #222; text-transform: uppercase; letter-spacing: 1px; line-height: 1.8;'>
                This is a digitally authorized institutional invoice.<br>
                Security Hash: " . hash('sha256', $input['id']) . "<br>
                &copy; 2026 SPLARO LUXURY BOUTIQUE. ALL RIGHTS RESERVED.
            </p>
        </div>
    </div>";

    // TRIGGER EMAIL NOTIFICATION (ORDER)
    $to = SMTP_USER;
    $subject = "NEW ACQUISITION: " . $input['id'];
    $headers = "From: SPLARO HQ <" . SMTP_USER . ">\r\n";
    $headers .= "Reply-To: " . SMTP_USER . "\r\n";
    $headers .= "MIME-Version: 1.0\r\n";
    $headers .= "Content-Type: text/html; charset=UTF-8\r\n";
    
    // Send to Admin
    @mail($to, "ADMIN NOTIFY: NEW ORDER " . $input['id'], $invoice_body, $headers);
    // Send to Customer
    @mail($input['customerEmail'], "INVOICE: Your Splaro Order #" . $input['id'], $invoice_body, $headers);

    echo json_encode(["status" => "success", "message" => "INVOICE_DISPATCHED"]);
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

// 4. IDENTITY AUTHENTICATION (SIGNUP / SOCIAL SYNC)
if ($method === 'POST' && $action === 'signup') {
    $input = json_decode(file_get_contents('php://input'), true);
    
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
    $to = SMTP_USER;
    $subject = "NEW IDENTITY ARCHIVED: " . $input['name'];
    $message = "A new client has joined the Splaro Archive.\n\nName: " . $input['name'] . "\nEmail: " . $input['email'];
    $headers = "From: SPLARO HQ <" . SMTP_USER . ">\r\n";
    
    @mail($to, $subject, $message, $headers);

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

// 6. REGISTRY INITIALIZATION (GOOGLE SHEETS HEADERS)
if ($method === 'POST' && $action === 'initialize_sheets') {
    sync_to_sheets('INIT', ["message" => "INITIALIZING_RECORDS"]);
    echo json_encode(["status" => "success", "message" => "REGISTRY_INITIALIZED"]);
    exit;
}

/**
 * INSTITUTIONAL GOOGLE SHEETS SYNC PROTOCOL
 */
function sync_to_sheets($type, $data) {
    // Updated Final Webhook URL
    $webhook_url = "https://script.google.com/macros/s/AKfycbyiWVuxn3OLyaTCz8EwIaxdByxKJFHP2yjPwvuXARWckbY5xBBymeIOWOcy0STAQgvd1Q/exec"; 
    
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
