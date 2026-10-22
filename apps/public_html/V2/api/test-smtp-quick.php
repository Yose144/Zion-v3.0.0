<?php
/**
 * Quick Email Test
 * Test SMTP functionality directly
 */

require_once __DIR__ . '/smtp-mailer.php';

// Test configuration
$testEmail = $_GET['to'] ?? 'admin@newearth.cz';
$testSubject = 'ZION eShop - SMTP Test ' . date('Y-m-d H:i:s');
$testBody = '
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
</head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; text-align: center;">
        <h1>✅ SMTP Test Úspěšný!</h1>
        <p style="font-size: 18px;">Email server funguje správně</p>
    </div>
    
    <div style="padding: 30px; background: #f5f5f5; margin-top: 20px; border-radius: 10px;">
        <h2>Detaily testu:</h2>
        <ul style="list-style: none; padding: 0;">
            <li>⏰ Čas: ' . date('d.m.Y H:i:s') . '</li>
            <li>📧 Server: ' . (defined('SMTP_HOST') ? SMTP_HOST : 'mail.webglobe.cz') . '</li>
            <li>🔌 Port: ' . (defined('SMTP_PORT') ? SMTP_PORT : '587') . '</li>
            <li>👤 Uživatel: ' . (defined('SMTP_USER') ? SMTP_USER : 'admin@newearth.cz') . '</li>
        </ul>
    </div>
    
    <div style="text-align: center; margin-top: 30px; color: #666;">
        <p>ZION Terra Nova eShop</p>
        <p><a href="https://newearth.cz">newearth.cz</a></p>
    </div>
</body>
</html>
';

// Send test email
$result = sendEmailViaSMTP($testEmail, $testSubject, $testBody, [
    'fromName' => 'ZION Test System',
    'isHTML' => true
]);

// Return result
header('Content-Type: application/json');
echo json_encode([
    'success' => $result,
    'to' => $testEmail,
    'subject' => $testSubject,
    'timestamp' => date('Y-m-d H:i:s'),
    'smtp' => [
        'host' => defined('SMTP_HOST') ? SMTP_HOST : 'mail.webglobe.cz',
        'port' => defined('SMTP_PORT') ? SMTP_PORT : 587,
        'user' => defined('SMTP_USER') ? SMTP_USER : 'admin@newearth.cz',
        'secure' => defined('SMTP_SECURE') ? SMTP_SECURE : 'tls'
    ],
    'message' => $result ? 'Email odeslán úspěšně!' : 'Odeslání emailu selhalo'
]);
