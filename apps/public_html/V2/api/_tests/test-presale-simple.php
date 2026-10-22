<?php
/**
 * ZION Presale Simple Debug - bez wallet generování
 */

error_reporting(E_ALL);
ini_set('display_errors', 1);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Constants
define('ADMIN_EMAIL', 'admin@newearth.cz');
define('SENDER_EMAIL', 'shop@newearth.cz');
define('ZION_RATE_CZK', 0.50);

try {
    // Get JSON input
    $rawInput = file_get_contents('php://input');
    $input = json_decode($rawInput, true);
    
    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new Exception('Invalid JSON: ' . json_last_error_msg());
    }
    
    if (!$input) {
        throw new Exception('Empty input');
    }
    
    // Validate
    if (empty($input['email'])) {
        throw new Exception('Email is required');
    }
    
    if (empty($input['amount'])) {
        throw new Exception('Amount is required');
    }
    
    $customerEmail = filter_var($input['email'], FILTER_VALIDATE_EMAIL);
    if (!$customerEmail) {
        throw new Exception('Invalid email address');
    }
    
    $amount = floatval($input['amount']);
    $currency = strtoupper($input['currency'] ?? 'CZK');
    $customerName = $input['name'] ?? 'Test User';
    $testMode = $input['testMode'] ?? 'full';
    
    // Calculate ZION
    $zionAmount = 0;
    if ($currency === 'CZK') {
        $zionAmount = $amount / ZION_RATE_CZK;
    } else {
        $conversionRates = ['EUR' => 25.0, 'USD' => 23.0];
        $czkAmount = $amount * ($conversionRates[$currency] ?? 1);
        $zionAmount = $czkAmount / ZION_RATE_CZK;
    }
    $zionAmount = round($zionAmount, 2);
    
    // Generate fake wallet for testing
    $fakeAddress = 'ZION_TEST_' . strtoupper(bin2hex(random_bytes(16)));
    $fakePrivKey = bin2hex(random_bytes(32));
    $fakeMnemonic = 'test word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12';
    
    $orderId = 'TEST_' . strtoupper(bin2hex(random_bytes(8)));
    $timestamp = date('Y-m-d H:i:s');
    
    // Try to send emails only if smtp-mailer exists
    $emailsSent = false;
    if (file_exists(__DIR__ . '/smtp-mailer.php')) {
        require_once __DIR__ . '/smtp-mailer.php';
        
        // Admin email
        $adminSubject = "[TEST] Presale #{$orderId}";
        $adminBody = "TEST ORDER\n\n";
        $adminBody .= "Order ID: {$orderId}\n";
        $adminBody .= "Email: {$customerEmail}\n";
        $adminBody .= "Amount: {$amount} {$currency}\n";
        $adminBody .= "ZION: {$zionAmount}\n";
        $adminBody .= "Address: {$fakeAddress}\n";
        
        $adminSent = sendEmailViaSMTP(
            ADMIN_EMAIL,
            $adminSubject,
            $adminBody,
            [
                'from' => SENDER_EMAIL,
                'fromName' => 'ZION Test',
                'isHTML' => false
            ]
        );
        
        // Customer email
        $customerSubject = "[TEST] ZION Presale Confirmation";
        $customerBody = "Hello {$customerName},\n\n";
        $customerBody .= "TEST ORDER CONFIRMATION\n\n";
        $customerBody .= "Order ID: {$orderId}\n";
        $customerBody .= "Amount: {$amount} {$currency}\n";
        $customerBody .= "ZION: {$zionAmount}\n";
        $customerBody .= "Address: {$fakeAddress}\n\n";
        $customerBody .= "This is a TEST - no real payment was made.\n";
        
        $customerSent = sendEmailViaSMTP(
            $customerEmail,
            $customerSubject,
            $customerBody,
            [
                'from' => SENDER_EMAIL,
                'fromName' => 'ZION Test',
                'isHTML' => false
            ]
        );
        
        $emailsSent = ['admin' => $adminSent, 'customer' => $customerSent];
    }
    
    // Success response
    echo json_encode([
        'success' => true,
        'orderId' => $orderId,
        'zionAddress' => $fakeAddress,
        'zionAmount' => $zionAmount,
        'timestamp' => $timestamp,
        'testMode' => $testMode,
        'emailsSent' => $emailsSent,
        'note' => 'Simple test without real wallet generation'
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage(),
        'file' => $e->getFile(),
        'line' => $e->getLine()
    ]);
}
