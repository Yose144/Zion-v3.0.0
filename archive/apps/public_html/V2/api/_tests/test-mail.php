<?php
/**
 * ZION eShop - Test Email Endpoint
 * Returns JSON response for debug panel
 * POST /api/test-mail.php
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

require_once __DIR__ . '/smtp-mailer.php';

$input = json_decode(file_get_contents('php://input'), true);

if (!$input || !isset($input['to'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing required field: to']);
    exit;
}

$to = $input['to'] ?? 'admin@newearth.cz';
$subject = $input['subject'] ?? 'ZION eShop - Test Email';
$body = $input['body'] ?? 'Test message from ZION eShop';

try {
    // HTML verze emailu
    $htmlBody = <<<HTML
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Test Email</title>
</head>
<body style="font-family: Arial, sans-serif; background: #0a0a0a; color: #ccc; padding: 20px;">
    <div style="max-width: 600px; margin: 0 auto; background: #1a1a1a; padding: 30px; border-radius: 10px; border: 2px solid #ffc107;">
        <h1 style="color: #ffc107; margin: 0 0 20px 0;">✅ Test Email - ZION eShop</h1>
        <p style="margin: 10px 0;">$body</p>
        <hr style="border: 1px solid #333; margin: 20px 0;">
        <p style="color: #888; font-size: 0.9rem; margin: 10px 0;">
            <strong>Timestamp:</strong> {$_SERVER['REQUEST_TIME_FLOAT']}<br>
            <strong>From:</strong> shop@newearth.cz<br>
            <strong>To:</strong> $to<br>
            <strong>Subject:</strong> $subject
        </p>
    </div>
</body>
</html>
HTML;
    
    // Odešli email
    $result = sendEmailViaSMTP($to, $subject, $htmlBody);
    
    echo json_encode([
        'success' => true,
        'message' => 'Email sent successfully',
        'details' => [
            'to' => $to,
            'subject' => $subject,
            'timestamp' => date('Y-m-d H:i:s'),
            'method' => 'PHPMailer SMTP'
        ]
    ], JSON_UNESCAPED_UNICODE);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage(),
        'code' => $e->getCode()
    ], JSON_UNESCAPED_UNICODE);
}

if ($result) {
    echo "✅ SUCCESS: mail() returned true\n";
    echo "Check inbox (and spam folder) for: $to\n";
    exit(0);
} else {
    echo "❌ FAILURE: mail() returned false\n";
    $error = error_get_last();
    if ($error) {
        echo "Error: " . print_r($error, true) . "\n";
    }
    exit(1);
}
