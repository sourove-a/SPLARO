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
    <div style='background: #000; color: #fff; font-family: \"Inter\", sans-serif; padding: 100px 80px; max-width: 850px; margin: auto; border: 1px solid #111; box-shadow: 0 80px 150px rgba(0,0,0,0.95); border-radius: 60px; position: relative;'>
        <!-- HEADER -->
        <div style='display: flex; justify-content: space-between; align-items: center; margin-bottom: 120px; border-bottom: 1px solid #1a1a1a; padding-bottom: 60px;'>
            <div>
                <h1 style='letter-spacing: 25px; margin: 0; font-weight: 950; font-size: 52px; background: linear-gradient(180deg, #fff 0%, #444 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;'>SPLARO</h1>
                <p style='font-size: 10px; color: #555; letter-spacing: 12px; margin-top: 25px; text-transform: uppercase; font-weight: 950;'>Institutional Luxury Heritage</p>
            </div>
            <div style='text-align: right;'>
                <div style='background: linear-gradient(90deg, #00cfd5, #008fa0); color: #000; padding: 15px 30px; border-radius: 20px; font-size: 11px; font-weight: 950; letter-spacing: 5px; display: inline-block; margin-bottom: 25px; box-shadow: 0 15px 40px rgba(0,207,213,0.3);'>VERIFIED ACQUISITION</div>
                <p style='margin: 0; font-size: 12px; color: #333; font-family: monospace; letter-spacing: 3px;'>PROTOCOL: ENABLED</p>
            </div>
        </div>
        
        <!-- CLIENT & REGION -->
        <div style='display: grid; grid-template-columns: 1.3fr 0.7fr; gap: 100px; margin-bottom: 120px;'>
            <div style='background: rgba(255,255,255,0.01); padding: 50px; border-radius: 40px; border: 1px solid #111;'>
                <p style='margin: 0; font-size: 10px; color: #00cfd5; text-transform: uppercase; font-weight: 950; letter-spacing: 6px; margin-bottom: 35px;'>Collector Identity</p>
                <h2 style='margin: 0 0 20px; font-size: 32px; font-weight: 950; color: #fff; letter-spacing: -1px;'>{$input['customerName']}</h2>
                
                <div style='margin-bottom: 35px;'>
                    <p style='margin: 0 0 10px; font-size: 9px; color: #444; text-transform: uppercase; font-weight: 950; letter-spacing: 3px;'>Deployment Sector</p>
                    <p style='margin: 0; font-size: 18px; color: #eee; font-weight: 500; line-height: 1.8;'>
                        {$input['address']}<br>
                        <span style='color: #00cfd5; font-weight: 950; font-size: 15px; letter-spacing: 1px;'>{$input['thana']} • {$input['district']}</span>
                    </p>
                </div>
                <div>
                    <p style='margin: 0 0 10px; font-size: 9px; color: #444; text-transform: uppercase; font-weight: 950; letter-spacing: 3px;'>Signal Coordinate</p>
                    <p style='margin: 0; font-size: 18px; color: #eee; font-weight: 500;'>{$input['phone']}</p>
                </div>
            </div>
            <div style='text-align: right; padding-top: 40px;'>
                <p style='margin: 0; font-size: 10px; color: #222; text-transform: uppercase; font-weight: 950; letter-spacing: 6px;'>Archive ID</p>
                <h2 style='margin: 25px 0; font-size: 38px; font-weight: 950; color: #fff; letter-spacing: 4px;'>#{$input['id']}</h2>
                <p style='margin: 10px 0; font-size: 16px; color: #444; font-weight: 800;'>" . date('F d, Y') . "</p>
            </div>
        </div>

        <!-- ASSETS -->
        <table style='width: 100%; border-collapse: separate; border-spacing: 0 20px; margin-bottom: 120px;'>
            <thead>
                <tr style='font-size: 11px; text-transform: uppercase; letter-spacing: 5px;'>
                    <th style='padding: 20px; text-align: left; color: #222; font-weight: 950; border-bottom: 1px solid #111;'>Institutional Asset</th>
                    <th style='padding: 20px; text-align: center; color: #222; font-weight: 950; border-bottom: 1px solid #111;'>Qty</th>
                    <th style='padding: 20px; text-align: right; color: #222; font-weight: 950; border-bottom: 1px solid #111;'>Valuation</th>
                </tr>
            </thead>
            <tbody>
                {$items_html}
            </tbody>
        </table>

        <!-- TOTALS -->
        <div style='background: #050505; border: 1px solid #111; padding: 60px; border-radius: 45px; box-shadow: inset 0 0 100px rgba(0,207,213,0.02);'>
            <div style='display: flex; justify-content: space-between; align-items: center; margin-bottom: 35px;'>
                <span style='font-size: 14px; color: #333; text-transform: uppercase; font-weight: 950; letter-spacing: 4px;'>Registry Subtotal</span>
                <span style='font-size: 22px; font-weight: 600; color: #555;'>৳" . number_format($input['total']) . "</span>
            </div>
            <div style='display: flex; justify-content: space-between; align-items: center; margin-bottom: 35px;'>
                <span style='font-size: 14px; color: #333; text-transform: uppercase; font-weight: 950; letter-spacing: 4px;'>Logistics Manifest</span>
                <span style='font-size: 22px; font-weight: 600; color: #555;'>৳" . number_format($input['shippingFee'] ?? 0) . "</span>
            </div>
            <div style='height: 1px; background: #111; margin: 40px 0;'></div>
            <div style='display: flex; justify-content: space-between; align-items: center;'>
                <span style='font-size: 18px; color: #00cfd5; text-transform: uppercase; font-weight: 950; letter-spacing: 8px;'>Total Valuation</span>
                <span style='font-size: 56px; font-weight: 950; color: #fff; letter-spacing: -3px; text-shadow: 0 0 40px rgba(0,207,213,0.1);'>৳" . number_format($input['total']) . "</span>
            </div>
        </div>

        <!-- AUTHENTICITY -->
        <div style='margin-top: 150px; text-align: center;'>
            <div style='margin-bottom: 60px;'>
                <p style='font-family: \"Georgia\", serif; font-style: italic; font-size: 42px; color: #eee; margin: 0;'>Chief Archivist</p>
                <div style='width: 300px; height: 1px; background: linear-gradient(to right, transparent, #00cfd5, transparent); margin: 25px auto;'></div>
                <p style='font-size: 11px; color: #333; text-transform: uppercase; letter-spacing: 10px; font-weight: 950;'>Authorization Node #2026</p>
            </div>
            <p style='font-size: 11px; color: #222; text-transform: uppercase; letter-spacing: 4px; line-height: 2.5; font-weight: 950;'>
                Authenticated institutional manifest. Unauthorized duplication is prohibited.<br>
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
