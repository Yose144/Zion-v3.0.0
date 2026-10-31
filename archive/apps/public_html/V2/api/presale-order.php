<?php
/**
 * ZION Token Presale - Order Handler
 * Creates presale orders, generates ZION wallets with QR codes, and sends confirmation emails
 */

// Allow including config.php (has direct access guard)
if (!defined('PRESALE_API')) {
    define('PRESALE_API', true);
}

// Avoid leaking warnings/notices into JSON output
error_reporting(0);
ini_set('display_errors', '0');

require_once __DIR__ . '/wallet-lib-v3.php';  // V3: Real blockchain wallets with mnemonic
require_once __DIR__ . '/smtp-mailer.php';
require_once __DIR__ . '/email-template-helper.php';
require_once __DIR__ . '/rate-limiter.php';
require_once __DIR__ . '/discord-webhook.php'; // Discord notifications

// Check if config exists, use default values if not
if (file_exists(__DIR__ . '/config.php')) {
    require_once __DIR__ . '/config.php';
}

// Ensure defaults when config.php doesn't define them
if (!defined('SITE_URL')) define('SITE_URL', 'https://newearth.cz');
if (!defined('ADMIN_EMAIL')) define('ADMIN_EMAIL', 'admin@newearth.cz');
if (!defined('SENDER_EMAIL')) {
    if (defined('SHOP_EMAIL') && SHOP_EMAIL) {
        define('SENDER_EMAIL', SHOP_EMAIL);
    } else {
        define('SENDER_EMAIL', 'presale@newearth.cz');
    }
}
if (!defined('ZION_DEFAULT_NETWORK')) define('ZION_DEFAULT_NETWORK', 'testnet');
if (!defined('DEBUG_MODE')) define('DEBUG_MODE', false);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respondError('Method not allowed', 405);
}

$json = file_get_contents('php://input');
$data = json_decode($json, true);

if (!is_array($data)) {
    respondError('Invalid JSON payload', 400);
}

// === Validate required fields ===
$required = ['email', 'tokens', 'priceEur', 'packageName'];
foreach ($required as $field) {
    if (empty($data[$field])) {
        respondError("Missing required field: $field", 422);
    }
}

// Validate email
if (!filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
    respondError('Invalid email address', 422);
}

// === RATE LIMITING CHECK ===
$clientIp = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['HTTP_X_REAL_IP'] ?? $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$rateLimitResult = rate_limit_check($clientIp, $data['email']);
if (!$rateLimitResult['allowed']) {
    respondError($rateLimitResult['reason'], 429);
}

// Validate tokens
$tokens = (int)$data['tokens'];
if ($tokens < 1000) {
    respondError('Minimum tokens is 1,000', 422);
}

// Include presale helper utilities (validation helpers)
require_once __DIR__ . '/presale-utils.php';

// === PRESALE ENABLE / WHITELIST CHECK ===
// Use centralized helper to decide if email is allowed
if (!presale_is_allowed($data['email'])) {
    respondError('Presale is currently paused', 403);
}

// === SERVER-SIDE PRICE / TOKENS VALIDATION ===
if (is_numeric($data['priceEur'])) {
    $priceEur = (float)$data['priceEur'];
    $expectedBaseTokens = presale_expected_tokens($priceEur);
    $maxAllowedTokens = presale_max_tokens($priceEur);

    if ($expectedBaseTokens <= 0 || $maxAllowedTokens <= 0) {
        respondError('Invalid price/token calculation', 422);
    }

    // Optional cross-check if client sends baseTokens
    if (isset($data['baseTokens']) && is_numeric($data['baseTokens'])) {
        $clientBaseTokens = (int)$data['baseTokens'];
        if ($clientBaseTokens !== $expectedBaseTokens) {
            respondError('Base tokens mismatch (server validation failed)', 422);
        }
    }

    // Allow bonus, but cap it server-side
    if ($tokens < $expectedBaseTokens || $tokens > $maxAllowedTokens) {
        respondError('Price and tokens mismatch (bonus cap exceeded)', 422);
    }
}

// === Generate Order ID ===
$orderId = 'PRESALE-' . time() . '-' . substr(md5(uniqid()), 0, 6);

// === Generate ZION Wallet (Real Blockchain Wallet with Mnemonic) ===
// Uses V3 API if available, falls back to pre-generated wallet pool
$walletData = null;
$qrData = null;

try {
    // Use wrapper function with fallback support (V3 API → Pool → Error)
    $walletResult = zion_generate_wallet([
        'label' => 'ZION Presale: ' . $data['packageName'],
        'tokens' => $tokens,
        'orderId' => $orderId,
        'customerEmail' => $data['email'],
        'customerName' => $data['name'] ?? '',
        'network' => 'testnet',  // TestNet until MainNet launch
        'expiresInHours' => 8760 // 1 year
    ]);
    
    $walletData = $walletResult['wallet'];
    $qrData = $walletResult['qr'];
    
    // Log wallet creation
    $source = $walletResult['source'] ?? 'v3';
    error_log("✅ Generated wallet for $orderId via $source: {$walletData['address']}");
} catch (Throwable $e) {
    error_log('❌ Presale wallet generation failed: ' . $e->getMessage());
    respondError('Wallet generation failed. Please contact support.', 500);
}

// === Create Order Record ===
$order = [
    'orderId' => $orderId,
    'type' => 'presale',
    'status' => 'pending',
    'customer' => [
        'email' => $data['email'],
        'name' => $data['name'] ?? ''
    ],
    'package' => [
        'name' => $data['packageName'],
        'priceEur' => (float)$data['priceEur'],
        'baseTokens' => (int)($data['baseTokens'] ?? $tokens),
        'bonusTokens' => $tokens - (int)($data['baseTokens'] ?? $tokens),
        'totalTokens' => $tokens
    ],
    'payment' => [
        'method' => $data['paymentMethod'] ?? 'pending',
        'status' => 'pending',
        'variableSymbol' => $data['variableSymbol'] ?? generateVariableSymbol()
    ],
    'zion' => [
        'wallet' => $walletData,
        'qr' => $qrData ? [
            'serviceUrl' => $qrData['serviceUrl'],
            'imageFile' => $qrData['imageFile']
        ] : null,
        'network' => $data['network'] ?? ZION_DEFAULT_NETWORK
    ],
    'createdAt' => date(DATE_ATOM),
    'updatedAt' => date(DATE_ATOM)
];

// === Save Order ===
$ordersDir = __DIR__ . '/../presale-orders';
if (!is_dir($ordersDir)) {
    mkdir($ordersDir, 0755, true);
}

$orderFile = $ordersDir . '/' . $orderId . '.json';
file_put_contents($orderFile, json_encode($order, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

// === Add to Ledger ===
if ($walletData) {
    try {
        zion_wallet_append_ledger_entry([
            'orderId' => $orderId,
            'walletId' => $walletData['id'],
            'walletUri' => $walletData['uri'],
            'qrImage' => $qrData['imageFile'] ?? null,
            'tokens' => $tokens,
            'source' => 'presale',
            'network' => $order['zion']['network'],
            'status' => 'pending',
            'historyNote' => 'Presale order created: ' . $data['packageName']
        ]);
    } catch (Throwable $e) {
        error_log('Presale ledger append failed: ' . $e->getMessage());
    }
}

// === Send Confirmation Emails ===
$emailsSent = sendPresaleEmails($order);

// === Send Discord Notification ===
if (function_exists('discord_notify_presale_order')) {
    discord_notify_presale_order($order);
}

// === Response ===
echo json_encode([
    'success' => true,
    'orderId' => $orderId,
    'message' => 'Presale order created successfully',
    // Vracíme plný záznam objednávky, aby frontend měl jednotný tvar
    'order' => $order,
    'emailsSent' => $emailsSent
], JSON_UNESCAPED_UNICODE);
exit;

// === Helper Functions ===

function respondError(string $message, int $status = 400): void
{
    http_response_code($status);
    echo json_encode([
        'success' => false,
        'error' => $message
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

function generateVariableSymbol(): string
{
    $timestamp = substr((string)time(), -8);
    $random = str_pad((string)mt_rand(0, 99), 2, '0', STR_PAD_LEFT);
    return $timestamp . $random;
}

function sendPresaleEmails(array $order): array
{
    $result = ['admin' => false, 'customer' => false];
    
    $customerEmail = $order['customer']['email'];
    $customerName = $order['customer']['name'] ?: 'Investor';
    
    // === Admin Email (plain text) ===
    $adminQrUrl = null;
    if (!empty($order['zion']['qr']['serviceUrl'])) {
        $adminQrUrl = (string)$order['zion']['qr']['serviceUrl'];
    } elseif (!empty($order['zion']['qr']['imageFile'])) {
        $adminQrUrl = rtrim(SITE_URL, '/') . '/V2/wallets/' . ltrim((string)$order['zion']['qr']['imageFile'], '/');
    }

    $adminQrLine = 'QR: ' . ($adminQrUrl ?: 'N/A');

    $adminSubject = "�️ Nová ZION Software objednávka #{$order['orderId']}";
    $adminBody = <<<EMAIL
========================================
NOVÁ SOFTWARE OBJEDNÁVKA
========================================

Order ID: {$order['orderId']}
Datum: {$order['createdAt']}

----------------------------------------
ZÁKAZNÍK
----------------------------------------
Email: $customerEmail
Jméno: $customerName

----------------------------------------
BALÍČEK
----------------------------------------
Název: {$order['package']['name']}
Cena: €{$order['package']['priceEur']}
Base tokeny: {$order['package']['baseTokens']} ZION
Bonus tokeny: {$order['package']['bonusTokens']} ZION
CELKEM: {$order['package']['totalTokens']} ZION

----------------------------------------
PLATBA
----------------------------------------
VS: {$order['payment']['variableSymbol']}
Status: {$order['payment']['status']}

----------------------------------------
ZION WALLET
----------------------------------------
Wallet ID: {$order['zion']['wallet']['id']}
Network: {$order['zion']['network']}
URI: {$order['zion']['wallet']['uri']}
$adminQrLine

========================================
EMAIL;

    $adminHeaders = "From: " . SENDER_EMAIL . "\r\n";
    $adminHeaders .= "Reply-To: $customerEmail\r\n";
    $adminHeaders .= "Content-Type: text/plain; charset=UTF-8\r\n";
    
    // Send via SMTP
    $result['admin'] = sendEmailViaSMTP(ADMIN_EMAIL, $adminSubject, $adminBody, [
        'from' => SENDER_EMAIL,
        'fromName' => 'ZION Software',
        'replyTo' => $customerEmail,
        'isHTML' => false
    ]);
    
    // === Customer Email (Rasta themed HTML) ===
    // Prepare data for presale Rasta template (V3 with mnemonic)
    $presaleData = [
        'orderId' => $order['orderId'],
        'name' => $customerName,
        'amount' => $order['package']['priceEur'],
        'currency' => 'EUR',
        'zionAmount' => $order['package']['totalTokens'],
        'zionAddress' => $order['zion']['wallet']['address'], // V3: Real blockchain address (zion1...)
        'zionMnemonic' => $order['zion']['wallet']['mnemonic'] ?? null, // V3: 12-word seed phrase
        'timestamp' => $order['createdAt'],
        'qrCodeUrl' => (isset($order['zion']['qr']['imageFile']) && $order['zion']['qr']['imageFile'])
            ? (rtrim(SITE_URL, '/') . '/V2/wallets/' . $order['zion']['qr']['imageFile'])
            : null
    ];
    
    // Send presale Rasta email
    $result['customer'] = sendPresaleConfirmationRasta($customerEmail, $presaleData);
    
    return $result;
}
