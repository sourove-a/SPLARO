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
    $settings = $db->query("SELECT * FROM site_settings LIMIT 1")->fetch();
    if ($settings) {
        $settings['smtp_settings'] = json_decode($settings['smtp_settings'], true);
        $settings['logistics_config'] = json_decode($settings['logistics_config'], true);
    }

    $data = [
        'products' => $db->query("SELECT * FROM products")->fetchAll(),
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
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input) {
        echo json_encode(["status" => "error", "message" => "INVALID_PAYLOAD"]);
        exit;
    }

    $stmt = $db->prepare("INSERT INTO orders (id, user_id, customer_name, customer_email, phone, district, thana, address, items, total, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
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
        $input['status']
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
    <div style='background: #000; color: #fff; font-family: \"Inter\", sans-serif; padding: 60px; max-width: 800px; margin: auto; border: 1px solid #111; box-shadow: 0 50px 100px rgba(0,0,0,0.8); border-radius: 40px;'>
        <!-- HEADER MANIFEST -->
        <div style='display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 80px; border-bottom: 2px solid #00cfd5; padding-bottom: 40px;'>
            <div>
                <h1 style='letter-spacing: 25px; margin: 0; font-weight: 950; font-size: 42px; background: linear-gradient(135deg, #fff 0%, #333 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;'>SPLARO</h1>
                <p style='font-size: 9px; color: #444; letter-spacing: 8px; margin-top: 15px; text-transform: uppercase; font-weight: 900;'>Luxury Institutional Archive &copy; SPL-2026</p>
            </div>
            <div style='text-align: right;'>
                <div style='background: #00cfd5; color: #000; padding: 8px 15px; border-radius: 8px; font-size: 10px; font-weight: 950; letter-spacing: 3px; display: inline-block; margin-bottom: 15px;'>ACQUISITION VERIFIED</div>
                <p style='margin: 0; font-size: 12px; color: #555; font-family: monospace; letter-spacing: 1px;'>HASH: " . strtoupper(substr(md5($input['id']), 0, 16)) . "</p>
            </div>
        </div>
        
        <!-- REGIONAL COORDINATES -->
        <div style='display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 60px; margin-bottom: 80px;'>
            <div style='background: rgba(255,255,255,0.02); padding: 40px; border-radius: 30px; border: 1px solid #111;'>
                <p style='margin: 0; font-size: 10px; color: #00cfd5; text-transform: uppercase; font-weight: 950; letter-spacing: 4px; mb: 20px;'>Recipient Identity</p>
                <h2 style='margin: 20px 0 10px; font-size: 24px; font-weight: 900; letter-spacing: -0.5px;'>{$input['customerName']}</h2>
                <div style='height: 1px; width: 40px; background: #222; margin-bottom: 20px;'></div>
                <p style='margin: 0; font-size: 14px; color: #888; line-height: 1.8; font-weight: 500;'>
                    <strong style='color: #eee;'>Location:</strong> {$input['address']}<br>
                    <strong style='color: #eee;'>Sector:</strong> {$input['thana']}, {$input['district']}<br>
                    <strong style='color: #eee;'>Coordinate:</strong> {$input['phone']}
                </p>
            </div>
            <div style='text-align: right; padding-top: 20px;'>
                <p style='margin: 0; font-size: 10px; color: #333; text-transform: uppercase; font-weight: 950; letter-spacing: 4px;'>Registry ID</p>
                <h2 style='margin: 15px 0; font-size: 28px; font-weight: 900; color: #fff;'>#{$input['id']}</h2>
                <p style='margin: 5px 0; font-size: 14px; color: #555; font-weight: 600;'>" . date('F d, Y | H:i') . "</p>
                <div style='margin-top: 30px; display: inline-block; padding: 10px 20px; border: 1px solid #222; border-radius: 12px; font-size: 10px; color: #444; font-weight: 900; letter-spacing: 2px;'>STATUS: DEPLOYED</div>
            </div>
        </div>

        <!-- ASSET MANIFEST -->
        <table style='width: 100%; border-collapse: separate; border-spacing: 0 10px; margin-bottom: 80px;'>
            <thead>
                <tr style='font-size: 10px; text-transform: uppercase; letter-spacing: 3px;'>
                    <th style='padding: 20px; text-align: left; color: #333; font-weight: 950;'>Institutional Asset</th>
                    <th style='padding: 20px; text-align: center; color: #333; font-weight: 950;'>Count</th>
                    <th style='padding: 20px; text-align: right; color: #333; font-weight: 950;'>Valuation</th>
                </tr>
            </thead>
            <tbody>
                {$items_html}
            </tbody>
        </table>

        <!-- VALUATION PROTOCOL -->
        <div style='background: linear-gradient(135deg, #080808 0%, #000 100%); border: 2px solid #111; padding: 50px; border-radius: 35px; box-shadow: inset 0 0 50px rgba(0,207,213,0.02);'>
            <div style='display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px;'>
                <span style='font-size: 12px; color: #444; text-transform: uppercase; font-weight: 950; letter-spacing: 2px;'>Subtotal Manifest</span>
                <span style='font-size: 18px; font-weight: 600; color: #888;'>৳" . number_format($input['total']) . "</span>
            </div>
            <div style='display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px;'>
                <span style='font-size: 12px; color: #444; text-transform: uppercase; font-weight: 950; letter-spacing: 2px;'>Logistics Fee</span>
                <span style='font-size: 18px; font-weight: 600; color: #888;'>৳" . number_format($input['shippingFee'] ?? 0) . "</span>
            </div>
            <div style='height: 1px; background: #111; margin: 30px 0;'></div>
            <div style='display: flex; justify-content: space-between; align-items: center;'>
                <span style='font-size: 16px; color: #00cfd5; text-transform: uppercase; font-weight: 950; letter-spacing: 5px;'>Net Protocol Amount</span>
                <span style='font-size: 42px; font-weight: 950; color: #fff; letter-spacing: -1px;'>৳" . number_format($input['total']) . "</span>
            </div>
        </div>

        <!-- AUTHENTICITY SIGNATURE -->
        <div style='margin-top: 100px; text-align: center;'>
            <div style='margin-bottom: 40px;'>
                 <div style='font-family: \"Brush Script MT\", cursive; font-size: 48px; color: rgba(255,255,255,0.05); margin-bottom: -30px;'>Splaro Elite</div>
                <p style='font-family: \"Georgia\", serif; font-style: italic; font-size: 32px; color: #eee; margin: 0; position: relative;'>Archivist Signature</p>
                <div style='width: 180px; height: 1px; background: linear-gradient(to right, transparent, #00cfd5, transparent); margin: 15px auto;'></div>
                <p style='font-size: 9px; color: #444; text-transform: uppercase; letter-spacing: 5px; font-weight: 900;'>Chief Logistics Authorization</p>
            </div>
            <p style='font-size: 11px; color: #222; text-transform: uppercase; letter-spacing: 2px; line-height: 2; font-weight: 800;'>
                This is a digitally encrypted institutional manifest.<br>
                Unauthorized duplication is prohibited by protocol.<br>
                &copy; " . date('Y') . " SPLARO LUXURY BOUTIQUE. ALL RIGHTS RESERVED.
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

// 5.2 GLOBAL CONFIGURATION SYNC
if ($method === 'POST' && $action === 'update_settings') {
    $input = json_decode(file_get_contents('php://input'), true);
    
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
        logistics_config = ?
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
        json_encode($input['logisticsConfig'] ?? [])
    ]);

    // Security Protocol: Log the system update
    $ip = $_SERVER['REMOTE_ADDR'];
    $db->prepare("INSERT INTO system_logs (event_type, event_description, ip_address) VALUES (?, ?, ?)")
       ->execute(['SYSTEM_OVERRIDE', "Institutional configuration manifest was modified by the Chief Archivist.", $ip]);

    echo json_encode(["status" => "success", "message" => "CONFIGURATION_ARCHIVED"]);
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
