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
    <div style='background: #050505; color: #fff; font-family: sans-serif; padding: 40px; max-width: 600px; margin: auto; border: 1px solid #111;'>
        <div style='text-align: center; margin-bottom: 40px;'>
            <h1 style='letter-spacing: 15px; margin: 0; font-weight: 900;'>SPLARO</h1>
            <p style='font-size: 10px; color: #555; letter-spacing: 3px; margin-top: 5px; text-transform: uppercase;'>Luxury Boutique Archive</p>
        </div>
        
        <div style='margin-bottom: 30px; border-left: 2px solid #00cfd5; padding-left: 15px;'>
            <p style='margin: 0; font-size: 12px; color: #00cfd5; text-transform: uppercase; font-weight: bold;'>Order Confirmed</p>
            <p style='margin: 5px 0 0; font-size: 18px; font-weight: bold;'>#{$input['id']}</p>
        </div>

        <table style='width: 100%; border-collapse: collapse; margin-bottom: 30px;'>
            <thead>
                <tr style='background: #111; font-size: 10px; text-transform: uppercase; letter-spacing: 1px;'>
                    <th style='padding: 12px; text-align: left; color: #555;'>Item</th>
                    <th style='padding: 12px; text-align: center; color: #555;'>Qty</th>
                    <th style='padding: 12px; text-align: right; color: #555;'>Price</th>
                </tr>
            </thead>
            <tbody>
                {$items_html}
            </tbody>
        </table>

        <div style='text-align: right; margin-bottom: 40px;'>
            <p style='margin: 0; font-size: 14px; color: #555;'>Total Amount</p>
            <p style='margin: 5px 0 0; font-size: 28px; font-weight: bold; color: #00cfd5;'>৳" . number_format($input['total']) . "</p>
        </div>

        <div style='background: #111; padding: 20px; border-radius: 5px; font-size: 13px;'>
            <p style='margin: 0 0 10px; color: #555; text-transform: uppercase; font-weight: bold; font-size: 10px;'>Shipping Address</p>
            <p style='margin: 0; color: #ccc; line-height: 1.6;'>
                <strong>{$input['customerName']}</strong><br>
                {$input['address']}<br>
                Phone: {$input['phone']}
            </p>
        </div>

        <div style='text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #111;'>
            <p style='font-size: 11px; color: #444;'>Thank you for choosing Splaro. Your acquisition is being prepared.</p>
            <p style='font-size: 10px; color: #333; margin-top: 10px;'>&copy; " . date('Y') . " SPLARO HQ. Authorized Access Only.</p>
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
        unset($user['password']); // Safety Protocol
        echo json_encode(["status" => "success", "user" => $user]);
    } else {
        echo json_encode(["status" => "error", "message" => "INVALID_CREDENTIALS"]);
    }
    exit;
}

/**
 * INSTITUTIONAL GOOGLE SHEETS SYNC PROTOCOL
 */
function sync_to_sheets($type, $data) {
    // This URL is provided by the user for Google Apps Script Webhook
    $webhook_url = "https://script.google.com/macros/s/AKfycbxNzFhipuQJVVyvUZAMlrZDFWdo1qpnCkJ1oTyEn9RCwL1vEbhn840W6iQfiDAm0Dmg/exec"; 
    
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
