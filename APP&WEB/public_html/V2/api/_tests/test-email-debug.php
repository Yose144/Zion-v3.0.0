<?php
/**
 * ZION eShop - Email Debug API
 * Test endpoint pro odeslání testovacích emailů
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Only POST allowed
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

require_once __DIR__ . '/smtp-mailer.php';

// Get JSON input
$input = json_decode(file_get_contents('php://input'), true);

if (!$input) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid JSON']);
    exit;
}

$to = $input['to'] ?? '';
$subject = $input['subject'] ?? 'ZION eShop - Test Email';
$message = $input['message'] ?? 'Test message';
$method = $input['method'] ?? 'smtp';

// Validate email
if (!filter_var($to, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid email address']);
    exit;
}

// Prepare HTML email
$htmlBody = <<<HTML
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>$subject</title>
</head>
<body style="font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px;">
    <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #667eea; margin: 0;">ZION Terra Nova</h1>
            <p style="color: #999; font-size: 14px;">eShop Email System Test</p>
        </div>
        
        <div style="background: #f9f9f9; border-left: 4px solid #667eea; padding: 20px; margin-bottom: 20px;">
            <pre style="white-space: pre-wrap; margin: 0; font-family: 'Courier New', monospace; color: #333;">$message</pre>
        </div>
        
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        
        <table style="width: 100%; font-size: 12px; color: #666;">
            <tr>
                <td><strong>Timestamp:</strong></td>
                <td>{$_SERVER['REQUEST_TIME_FLOAT']}</td>
            </tr>
            <tr>
                <td><strong>Method:</strong></td>
                <td>$method</td>
            </tr>
            <tr>
                <td><strong>From:</strong></td>
                <td>shop@newearth.cz</td>
            </tr>
            <tr>
                <td><strong>To:</strong></td>
                <td>$to</td>
            </tr>
            <tr>
                <td><strong>Server:</strong></td>
                <td>{$_SERVER['SERVER_NAME']}</td>
            </tr>
        </table>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #999; font-size: 12px;">
            <p>ZION Terra Nova | <a href="https://newearth.cz" style="color: #667eea;">newearth.cz</a></p>
            <p>Omnity.One s.r.o. | CZ63 2010 0000 0029 0180 9148</p>
        </div>
    </div>
</body>
</html>
HTML;

try {
    $result = false;
    $details = [];
    
    if ($method === 'smtp') {
        // Use PHPMailer SMTP
        $result = sendEmailViaSMTP($to, $subject, $htmlBody, [
            'from' => 'shop@newearth.cz',
            'fromName' => 'ZION eShop',
            'replyTo' => 'shop@newearth.cz',
            'isHTML' => true
        ]);
        $details['method'] = 'PHPMailer SMTP';
        $details['host'] = 'mail.webglobe.cz';
        $details['port'] = 587;
    } else {
        // Use PHP mail() function
        $headers = "From: ZION eShop <shop@newearth.cz>\r\n";
        $headers .= "Reply-To: shop@newearth.cz\r\n";
        $headers .= "MIME-Version: 1.0\r\n";
        $headers .= "Content-Type: text/html; charset=UTF-8\r\n";
        
        $result = mail($to, $subject, $htmlBody, $headers);
        $details['method'] = 'PHP mail()';
    }
    
    if ($result) {
        echo json_encode([
            'success' => true,
            'message' => 'Email sent successfully',
            'details' => $details
        ]);
    } else {
        throw new Exception('Mail function returned false');
    }
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage(),
        'details' => [
            'method' => $method,
            'to' => $to,
            'subject' => $subject
        ]
    ]);
}
