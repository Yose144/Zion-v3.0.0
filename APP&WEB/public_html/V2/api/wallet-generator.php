<?php
/**
 * ZION Wallet Generator - Python Backend Wrapper
 * ==============================================
 * Volá Python API pro generování skutečných ZION walletů s QR kódy.
 * 
 * Python backend musí běžet na: http://localhost:5555
 * Spuštění: python3 api/wallet_api.py
 */

// Configuration
define('WALLET_API_URL', 'http://127.0.0.1:5557/api/wallet/generate');
define('WALLET_CGI_PATH', __DIR__ . '/generate-wallet.cgi');
define('WALLET_API_SECRET', 'zion_presale_secret_2025');
define('WALLET_API_TIMEOUT', 30);
define('WALLET_LOG_PATH', '/tmp/zion_wallet_generator.log');

/**
 * Lightweight logger for wallet generation attempts
 */
function logWalletGen($message) {
    $timestamp = date('Y-m-d H:i:s');
    @file_put_contents(WALLET_LOG_PATH, "[$timestamp] $message\n", FILE_APPEND);
}

/**
 * Generate ZION wallet via Python CGI (direct call)
 * 
 * @param string $email Customer email
 * @param int $tokens Number of ZION tokens
 * @param string $orderId Order ID
 * @return array|false Wallet data or false on error
 */
function generateZionWalletCGI($email, $tokens, $orderId) {
    // Nastavíme environment proměnné pro CGI
    $queryString = http_build_query([
        'email' => $email,
        'tokens' => $tokens,
        'orderId' => $orderId
    ]);
    
    putenv("QUERY_STRING=$queryString");
    putenv("REQUEST_METHOD=GET");
    
    $disabled = array_map('trim', explode(',', ini_get('disable_functions')));
    if (!function_exists('passthru') || in_array('passthru', $disabled, true)) {
        logWalletGen('CGI call skipped, passthru disabled in PHP.');
        return false;
    }

    // Spustíme Python script přímo a zachytíme output
    ob_start();
    $pythonPath = '/usr/bin/python3';
    $cgiPath = __DIR__ . '/generate-wallet.cgi';
    
    // Přímé zavolání pythonu s argumenty
    passthru("$pythonPath $cgiPath 2>&1", $returnCode);
    $output = ob_get_clean();
    
    if ($returnCode !== 0) {
        logWalletGen("ZION Wallet CGI failed with code $returnCode: $output");
        return false;
    }
    
    if (!$output) {
        logWalletGen('ZION Wallet CGI returned empty output');
        return false;
    }
    
    // Parse JSON from output (skip HTTP headers and INFO lines)
    $lines = explode("\n", $output);
    $jsonData = '';
    
    foreach ($lines as $line) {
        $trimmed = trim($line);
        // Skip empty lines, INFO lines, and HTTP headers
        if (empty($trimmed) || 
            strpos($trimmed, 'INFO:') === 0 || 
            strpos($trimmed, 'Content-Type:') === 0) {
            continue;
        }
        // First non-empty, non-header line should be JSON
        if ($trimmed[0] === '{') {
            $jsonData = $trimmed;
            break;
        }
    }
    
    if (empty($jsonData)) {
        logWalletGen("ZION Wallet CGI - no JSON found in output: $output");
        return false;
    }
    
    $data = json_decode($jsonData, true);
    
    if (!$data || !isset($data['success']) || !$data['success']) {
        $error = $data['error'] ?? 'Unknown CGI error';
        logWalletGen("ZION Wallet CGI failed: $error. Output: $output");
        return false;
    }
    
    return [
        'walletId' => $data['walletId'] ?? '',
        'address' => $data['address'] ?? '',
        'privateKey' => $data['privateKey'] ?? '',
        'privateKeyEncrypted' => $data['privateKeyEncrypted'] ?? '',
        'qrCodeUrl' => $data['qrCodeUrl'] ?? null,
        'qrCodePath' => $data['qrCodePath'] ?? null,
        'tokens' => $data['tokens'] ?? 0
    ];
}

/**
 * Generate ZION wallet via Python backend
 * 
 * @param string $email Customer email
 * @param int $tokens Number of ZION tokens
 * @param string $orderId Order ID
 * @return array|false Wallet data or false on error
 */
function generateZionWallet($email, $tokens, $orderId) {
    $requestData = [
        'email' => $email,
        'tokens' => (int)$tokens,
        'orderId' => $orderId,
        'apiSecret' => WALLET_API_SECRET
    ];
    
    $ch = curl_init(WALLET_API_URL);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($requestData),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => WALLET_API_TIMEOUT,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'Accept: application/json'
        ]
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);
    
    if ($curlError) {
        logWalletGen("ZION Wallet API curl error: $curlError");
        return false;
    }
    
    if ($httpCode !== 200) {
        logWalletGen("ZION Wallet API returned HTTP $httpCode: $response");
        return false;
    }
    
    $data = json_decode($response, true);
    
    if (!$data || !isset($data['success']) || !$data['success']) {
        $error = $data['error'] ?? 'Unknown error';
        logWalletGen("ZION Wallet API failed: $error; payload: $response");
        return false;
    }
    
    return [
        'walletId' => $data['walletId'] ?? '',
        'address' => $data['address'] ?? '',
        'privateKey' => $data['privateKey'] ?? '',
        'privateKeyEncrypted' => $data['privateKeyEncrypted'] ?? '',
        'qrCodeUrl' => $data['qrCodeUrl'] ?? null,
        'qrCodePath' => $data['qrCodePath'] ?? null,
        'tokens' => $data['tokens'] ?? 0
    ];
}

/**
 * Check if Python wallet API is running
 * 
 * @return bool True if API is available
 */
function isWalletApiAvailable() {
    $ch = curl_init('http://127.0.0.1:5557/health');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 2,
        CURLOPT_CONNECTTIMEOUT => 2
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode === 200) {
        $data = json_decode($response, true);
        return isset($data['status']) && $data['status'] === 'healthy';
    }
    
    return false;
}

/**
 * Generate fake wallet for testing (fallback when Python API unavailable)
 * 
 * @param string $email Customer email
 * @param int $tokens Number of tokens
 * @param string $orderId Order ID
 * @return array Fake wallet data
 */
function generateFakeWallet($email, $tokens, $orderId) {
    $fakeAddress = 'ZION_TEST_' . strtoupper(bin2hex(random_bytes(16)));
    $fakePrivateKey = bin2hex(random_bytes(32));
    
    return [
        'walletId' => 'fake_' . $orderId,
        'address' => $fakeAddress,
        'privateKey' => $fakePrivateKey,
        'privateKeyEncrypted' => base64_encode($fakePrivateKey),
        'qrCodeUrl' => null,
        'qrCodePath' => null,
        'tokens' => $tokens,
        'isFake' => true
    ];
}

/**
 * Generate wallet with automatic fallback
 * 
 * @param string $email Customer email
 * @param int $tokens Number of tokens
 * @param string $orderId Order ID
 * @return array Wallet data
 */
function generateZionWalletSafe($email, $tokens, $orderId) {
    // Try HTTP API first (no PHP exec limitations)
    $wallet = generateZionWallet($email, $tokens, $orderId);
    if ($wallet) {
        logWalletGen("Wallet generated via API for order $orderId");
        return $wallet;
    }

    // Try CGI second (direct Python call)
    $wallet = generateZionWalletCGI($email, $tokens, $orderId);
    if ($wallet) {
        logWalletGen("Wallet generated via CGI for order $orderId");
        return $wallet;
    }
    
    // Fallback to fake wallet
    logWalletGen("All wallet generation methods failed, using fake wallet for order: $orderId");
    return generateFakeWallet($email, $tokens, $orderId);
}
