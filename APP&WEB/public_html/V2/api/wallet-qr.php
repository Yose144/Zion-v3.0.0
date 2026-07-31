<?php
/**
 * ZION Presale API - Wallet QR Generation
 * Generates secure QR wallet with encrypted private key
 * 
 * POST /api/presale/wallet-qr.php
 * Body: { "label": "...", "tokens": 10000, "orderId": "...", "expiresInHours": 720 }
 * Response: { "success": true, "wallet": {...}, "qr": {...} }
 */

define('PRESALE_API', true);
require_once __DIR__ . '/config.php';

handleCors();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJson(['success' => false, 'error' => 'Method not allowed'], 405);
}

// Rate limiting
$clientIp = getClientIp();
if (!checkRateLimit($clientIp)) {
    sendJson(['success' => false, 'error' => 'Rate limit exceeded. Try again later.'], 429);
}

// CSRF protection
$csrfToken = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? $input['csrf_token'] ?? null;
if (!validateCsrfToken($csrfToken)) {
    sendJson(['success' => false, 'error' => 'Invalid CSRF token'], 403);
}

// Parse input
$input = json_decode(file_get_contents('php://input'), true);
if (!$input) {
    sendJson(['success' => false, 'error' => 'Invalid JSON'], 400);
}

// Validation
$label = $input['label'] ?? 'ZION Presale Wallet';
$tokens = intval($input['tokens'] ?? 0);
$orderId = $input['orderId'] ?? null;
$expiresInHours = intval($input['expiresInHours'] ?? WALLET_EXPIRY_HOURS);

if ($tokens < 1) {
    sendJson(['success' => false, 'error' => 'Token amount must be positive'], 400);
}

if ($expiresInHours < 1 || $expiresInHours > 8760) { // Max 1 year
    sendJson(['success' => false, 'error' => 'Invalid expiry duration'], 400);
}

try {
    $pdo = getDbConnection();
    
    // Generate wallet keypair
    $walletId = 'ZION_' . strtoupper(generateSecureToken(12));
    
    // SIMPLIFIED KEY GENERATION (Replace with proper ZION blockchain key derivation in production)
    $privateKey = generateSecureToken(64); // 256-bit private key
    $publicAddress = 'Z' . strtoupper(hash('ripemd160', hash('sha256', $privateKey, true))); // Simplified address
    
    // Encrypt private key
    $encryptedPrivateKey = encryptData($privateKey);
    
    // QR code payload (DOES NOT INCLUDE PRIVATE KEY - only reference)
    $qrPayload = json_encode([
        'network' => 'ZION-PRESALE',
        'wallet_id' => $walletId,
        'address' => $publicAddress,
        'tokens' => $tokens,
        'label' => $label,
        'created' => time()
    ]);
    
    // Generate QR code using external service (or local library like endroid/qr-code)
    $qrServiceUrl = 'https://api.qrserver.com/v1/create-qr-code/?' . http_build_query([
        'size' => '300x300',
        'data' => $qrPayload,
        'format' => 'png',
        'margin' => 10
    ]);
    
    // Optionally save QR image locally
    $qrImagePath = null;
    if (defined('QR_STORAGE_PATH') && is_writable(QR_STORAGE_PATH)) {
        $qrImageFilename = $walletId . '.png';
        $qrImagePath = QR_STORAGE_PATH . $qrImageFilename;
        
        $qrImageData = @file_get_contents($qrServiceUrl);
        if ($qrImageData) {
            file_put_contents($qrImagePath, $qrImageData);
            $qrImagePath = '/storage/qr_codes/' . $qrImageFilename; // Relative web path
        } else {
            $qrImagePath = null; // Fallback to service URL
        }
    }
    
    // Calculate expiration
    $expiresAt = date('Y-m-d H:i:s', strtotime("+{$expiresInHours} hours"));
    
    // Insert wallet into database
    $stmt = $pdo->prepare("
        INSERT INTO presale_wallets (
            wallet_id,
            order_id,
            public_address,
            private_key_encrypted,
            encryption_method,
            qr_code_data,
            qr_image_path,
            allocated_tokens,
            status,
            expires_at
        ) VALUES (
            :wallet_id,
            :order_id,
            :public_address,
            :private_key_encrypted,
            :encryption_method,
            :qr_code_data,
            :qr_image_path,
            :allocated_tokens,
            'generated',
            :expires_at
        )
    ");
    
    $stmt->execute([
        ':wallet_id' => $walletId,
        ':order_id' => $orderId, // NULL if no order yet
        ':public_address' => $publicAddress,
        ':private_key_encrypted' => $encryptedPrivateKey,
        ':encryption_method' => ENCRYPTION_METHOD,
        ':qr_code_data' => $qrPayload,
        ':qr_image_path' => $qrImagePath,
        ':allocated_tokens' => $tokens,
        ':expires_at' => $expiresAt
    ]);
    
    $walletDbId = $pdo->lastInsertId();
    
    // Log activity
    logActivity('wallet_created', [
        'wallet_id' => $walletId,
        'tokens' => $tokens,
        'order_id' => $orderId
    ]);
    
    // Response
    sendJson([
        'success' => true,
        'wallet' => [
            'id' => $walletId,
            'db_id' => $walletDbId,
            'address' => $publicAddress,
            'tokens' => $tokens,
            'status' => 'generated',
            'expiresAt' => $expiresAt,
            'createdAt' => date('Y-m-d H:i:s')
        ],
        'qr' => [
            'serviceUrl' => $qrServiceUrl,
            'imagePath' => $qrImagePath,
            'dataUrl' => null, // Could generate base64 data URL if needed
            'payload' => $qrPayload
        ],
        'warning' => 'Keep this QR code secure. It will be required to claim tokens on MainNet launch (Dec 31 2026).'
    ]);
    
} catch (PDOException $e) {
    error_log('Wallet creation DB error: ' . $e->getMessage());
    sendJson(['success' => false, 'error' => 'Database error'], 500);
} catch (Exception $e) {
    error_log('Wallet creation error: ' . $e->getMessage());
    sendJson(['success' => false, 'error' => 'Wallet generation failed'], 500);
}
