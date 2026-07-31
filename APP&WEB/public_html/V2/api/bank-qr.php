<?php
/**
 * ZION Bank Payment QR Generator
 * Generates QR codes for Czech bank transfers (SPD format)
 * 
 * POST /api/bank-qr.php
 * {
 *   "amount": 1234.50,
 *   "currency": "CZK",
 *   "message": "Objednávka #12345",
 *   "variableSymbol": "12345"
 * }
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
    respondError('Method not allowed', 405);
}

// Bank account details (Omnity.One s.r.o.)
define('BANK_ACCOUNT', '2901809148');
define('BANK_CODE', '2010');
define('BANK_IBAN', 'CZ6320100000002901809148');
define('BANK_BIC', 'FIOBCZPPXXX');
define('BANK_NAME', 'Fio banka, a.s.');
define('COMPANY_NAME', 'Omnity.One s.r.o.');

$input = json_decode(file_get_contents('php://input'), true);

if (!is_array($input)) {
    respondError('Invalid JSON', 400);
}

// Validate required fields
$amount = floatval($input['amount'] ?? 0);
$currency = strtoupper($input['currency'] ?? 'CZK');
$message = trim($input['message'] ?? '');
$variableSymbol = trim($input['variableSymbol'] ?? '');
$constantSymbol = trim($input['constantSymbol'] ?? '');
$specificSymbol = trim($input['specificSymbol'] ?? '');

if ($amount <= 0) {
    respondError('Amount must be positive', 400);
}

if ($currency !== 'CZK' && $currency !== 'EUR') {
    respondError('Currency must be CZK or EUR', 400);
}

// Generate Short Payment Descriptor (SPD) format
// Format: SPD*1.0*ACC:CZ6320100000002901809148*AM:1234.50*CC:CZK*MSG:Payment*X-VS:12345
$spdParts = [
    'SPD*1.0',
    'ACC:' . BANK_IBAN,
    'AM:' . number_format($amount, 2, '.', ''),
    'CC:' . $currency
];

if ($message !== '') {
    // Remove special characters from message
    $safeMessage = preg_replace('/[^a-zA-Z0-9\s\-\.]/u', '', $message);
    $safeMessage = substr($safeMessage, 0, 60); // Max 60 chars
    $spdParts[] = 'MSG:' . $safeMessage;
}

if ($variableSymbol !== '') {
    $spdParts[] = 'X-VS:' . preg_replace('/[^0-9]/', '', $variableSymbol);
}

if ($constantSymbol !== '') {
    $spdParts[] = 'X-KS:' . preg_replace('/[^0-9]/', '', $constantSymbol);
}

if ($specificSymbol !== '') {
    $spdParts[] = 'X-SS:' . preg_replace('/[^0-9]/', '', $specificSymbol);
}

$spdString = implode('*', $spdParts);

// Generate QR code using QuickChart.io
$qrSize = intval($input['qrSize'] ?? 300);
$qrSize = max(200, min(800, $qrSize)); // Limit 200-800px

$qrUrl = 'https://quickchart.io/qr?' . http_build_query([
    'text' => $spdString,
    'size' => $qrSize,
    'margin' => 2,
    'format' => 'png'
]);

// Optional: Download and save QR image
$saveQr = boolval($input['saveImage'] ?? false);
$qrImagePath = null;
$qrDataUrl = null;

if ($saveQr) {
    $storageDir = __DIR__ . '/../orders/qr-codes';
    if (!is_dir($storageDir)) {
        mkdir($storageDir, 0755, true);
    }
    
    $qrImageData = @file_get_contents($qrUrl);
    if ($qrImageData !== false) {
        $filename = 'bank_qr_' . time() . '_' . bin2hex(random_bytes(4)) . '.png';
        $qrImagePath = $storageDir . '/' . $filename;
        file_put_contents($qrImagePath, $qrImageData);
        $qrDataUrl = 'data:image/png;base64,' . base64_encode($qrImageData);
    }
}

// Response
echo json_encode([
    'success' => true,
    'qr' => [
        'url' => $qrUrl,
        'dataUrl' => $qrDataUrl,
        'imagePath' => $qrImagePath ? basename($qrImagePath) : null,
        'format' => 'SPD',
        'spdString' => $spdString
    ],
    'payment' => [
        'amount' => $amount,
        'currency' => $currency,
        'iban' => BANK_IBAN,
        'accountNumber' => BANK_ACCOUNT . '/' . BANK_CODE,
        'bic' => BANK_BIC,
        'bankName' => BANK_NAME,
        'beneficiary' => COMPANY_NAME,
        'variableSymbol' => $variableSymbol,
        'constantSymbol' => $constantSymbol,
        'specificSymbol' => $specificSymbol,
        'message' => $message
    ]
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

function respondError(string $message, int $code = 400): void
{
    http_response_code($code);
    echo json_encode([
        'success' => false,
        'error' => $message
    ], JSON_UNESCAPED_UNICODE);
    exit;
}
