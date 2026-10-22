<?php
/**
 * ZION Presale Debug Test API
 * Testování presale objednávek bez platební brány
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Error handling and dependency loading
$hasSMTP = false;

// Load wallet generator (Python backend wrapper)
if (!file_exists(__DIR__ . '/wallet-generator.php')) {
    echo json_encode(['success' => false, 'error' => 'wallet-generator.php not found']);
    exit;
}
require_once __DIR__ . '/wallet-generator.php';

// Load SMTP (required)
if (!file_exists(__DIR__ . '/smtp-mailer.php')) {
    echo json_encode(['success' => false, 'error' => 'smtp-mailer.php not found']);
    exit;
}
require_once __DIR__ . '/smtp-mailer.php';

// Load email template helper
if (!file_exists(__DIR__ . '/email-template-helper.php')) {
    echo json_encode(['success' => false, 'error' => 'email-template-helper.php not found']);
    exit;
}
require_once __DIR__ . '/email-template-helper.php';

// Constants (same as presale-order.php)
define('ADMIN_EMAIL', 'admin@newearth.cz');
define('SENDER_EMAIL', 'shop@newearth.cz');
define('DB_FILE', __DIR__ . '/../data/presale_orders.json');
define('ZION_RATE_CZK', 0.50); // 1 ZION = 0.50 CZK

// Get JSON input
$rawInput = file_get_contents('php://input');
$input = json_decode($rawInput, true);

if (json_last_error() !== JSON_ERROR_NONE) {
    echo json_encode(['success' => false, 'error' => 'Invalid JSON input: ' . json_last_error_msg()]);
    exit;
}

if (!$input) {
    echo json_encode(['success' => false, 'error' => 'Empty input received', 'raw' => $rawInput]);
    exit;
}

// Validate required fields
if (empty($input['email']) || empty($input['amount']) || empty($input['currency'])) {
    echo json_encode(['success' => false, 'error' => 'Missing required fields: email, amount, currency']);
    exit;
}

$customerEmail = filter_var($input['email'], FILTER_VALIDATE_EMAIL);
if (!$customerEmail) {
    echo json_encode(['success' => false, 'error' => 'Invalid email address']);
    exit;
}

$amount = floatval($input['amount']);
$currency = strtoupper($input['currency']);
$customerName = $input['name'] ?? 'Test User';
$testMode = $input['testMode'] ?? 'full';

// Calculate ZION amount
$zionAmount = 0;
if ($currency === 'CZK') {
    $zionAmount = $amount / ZION_RATE_CZK;
} else {
    // For other currencies, use approximate conversion (this is just test)
    $conversionRates = [
        'EUR' => 25.0,  // 1 EUR ≈ 25 CZK
        'USD' => 23.0   // 1 USD ≈ 23 CZK
    ];
    $czkAmount = $amount * ($conversionRates[$currency] ?? 1);
    $zionAmount = $czkAmount / ZION_RATE_CZK;
}

// Prepare order data first
$orderId = 'TEST_' . strtoupper(bin2hex(random_bytes(8)));
$timestamp = date('Y-m-d H:i:s');

// Generate ZION wallet via Python backend
$walletData = generateZionWalletSafe($customerEmail, (int)$zionAmount, $orderId);

if (!$walletData) {
    echo json_encode(['success' => false, 'error' => 'Wallet generation failed completely']);
    exit;
}

$orderData = [
    'orderId' => $orderId,
    'email' => $customerEmail,
    'name' => $customerName,
    'amount' => $amount,
    'currency' => $currency,
    'zionAmount' => $zionAmount,
    'zionAddress' => $walletData['address'],
    'zionPrivateKey' => $walletData['privateKey'],
    'zionWalletId' => $walletData['walletId'] ?? '',
    'qrCodeUrl' => $walletData['qrCodeUrl'] ?? null,
    'isFakeWallet' => $walletData['isFake'] ?? false,
    'timestamp' => $timestamp,
    'testMode' => $testMode,
    'status' => 'test'
];

$result = [
    'success' => true,
    'orderId' => $orderId,
    'zionAddress' => $walletData['address'],
    'zionAmount' => $zionAmount,
    'zionWalletId' => $walletData['walletId'] ?? '',
    'qrCodeUrl' => $walletData['qrCodeUrl'],
    'isFakeWallet' => $walletData['isFake'] ?? false,
    'timestamp' => $timestamp,
    'testMode' => $testMode,
    'emailsSent' => false,
    'savedToDb' => false
];

// Send emails (if not db_only mode)
if ($testMode !== 'db_only') {
    $emailsSuccess = sendPresaleTestEmails($orderData);
    $result['emailsSent'] = $emailsSuccess;
    $result['emailDetails'] = $emailsSuccess;
}

// Save to database (if not email_only mode)
if ($testMode !== 'email_only') {
    $dbSuccess = savePresaleOrder($orderData);
    $result['savedToDb'] = $dbSuccess;
}

echo json_encode($result);

/**
 * Send presale test emails with Rasta template
 */
function sendPresaleTestEmails($orderData) {
    $emailResults = ['admin' => false, 'customer' => false];
    
    // Admin email (plain text with all details)
    $adminSubject = "[TEST] Nová presale objednávka #{$orderData['orderId']}";
    $adminBody = "=== TESTOVACÍ OBJEDNÁVKA ===\n\n";
    $adminBody .= "Order ID: {$orderData['orderId']}\n";
    $adminBody .= "Zákazník: {$orderData['name']} ({$orderData['email']})\n";
    $adminBody .= "Částka: {$orderData['amount']} {$orderData['currency']}\n";
    $adminBody .= "ZION Amount: {$orderData['zionAmount']} ZION\n";
    $adminBody .= "ZION Adresa: {$orderData['zionAddress']}\n";
    $adminBody .= "Wallet ID: {$orderData['zionWalletId']}\n";
    $adminBody .= "Timestamp: {$orderData['timestamp']}\n";
    $adminBody .= "Test Mode: {$orderData['testMode']}\n";
    $adminBody .= "Fake Wallet: " . ($orderData['isFakeWallet'] ? 'Yes' : 'No') . "\n\n";
    $adminBody .= "=== WALLET DATA ===\n";
    $adminBody .= "Private Key: {$orderData['zionPrivateKey']}\n";
    if (!empty($orderData['qrCodeUrl'])) {
        $adminBody .= "QR Code: {$orderData['qrCodeUrl']}\n";
    }
    
    $emailResults['admin'] = sendEmailViaSMTP(
        ADMIN_EMAIL,
        $adminSubject,
        $adminBody,
        [
            'from' => SENDER_EMAIL,
            'fromName' => 'ZION Presale Test',
            'replyTo' => $orderData['email'],
            'isHTML' => false
        ]
    );
    
    // Customer email (Rasta HTML template)
    $emailResults['customer'] = sendPresaleConfirmationRasta(
        $orderData['email'],
        $orderData,
        [
            'subject' => "[TEST] 🌿 ZION Presale - Potvrzení #{$orderData['orderId']}"
        ]
    );
    
    return $emailResults;
}

/**
 * Save presale order to JSON database
 */
function savePresaleOrder($orderData) {
    try {
        $dataDir = dirname(DB_FILE);
        if (!file_exists($dataDir)) {
            mkdir($dataDir, 0755, true);
        }
        
        $orders = [];
        if (file_exists(DB_FILE)) {
            $json = file_get_contents(DB_FILE);
            $orders = json_decode($json, true) ?: [];
        }
        
        $orders[] = $orderData;
        
        $result = file_put_contents(DB_FILE, json_encode($orders, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        
        return $result !== false;
    } catch (Exception $e) {
        error_log("Failed to save presale order: " . $e->getMessage());
        return false;
    }
}
