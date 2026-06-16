<?php
/**
 * ZION Wallet Library V3 - Real Blockchain Wallets
 * ==================================================
 * Integrace s Python API pro generování skutečných ZION peněženek
 * s 12-slovními seed phrases pro presale zákazníky.
 * 
 * Features:
 * - Real Ed25519 keypairs
 * - 12-word BIP39 mnemonic phrases
 * - Bech32 addresses (zion1...)
 * - Encrypted database storage
 * - MainNet airdrop ready
 * 
 * Author: ZION Team
 * Version: 3.0.0
 * Date: 18.12.2025
 */

// Configuration
if (!defined('WALLET_API_V3_URL')) {
    $walletApiEnv = getenv('WALLET_API_V3_URL');
    // FastAPI default runs on 5556 (see api/wallet_api_v3.py); allow override via env
    define('WALLET_API_V3_URL', $walletApiEnv ?: 'http://127.0.0.1:5556/api/wallet/generate');
}

if (!defined('WALLET_API_SECRET')) {
    define('WALLET_API_SECRET', 'zion_presale_secret_2025');
}

if (!defined('WALLET_API_TIMEOUT')) {
    define('WALLET_API_TIMEOUT', 30);
}

if (!defined('ZION_WALLET_STORAGE_DIR')) {
    define('ZION_WALLET_STORAGE_DIR', __DIR__ . '/../wallets');
}

require_once __DIR__ . '/url-helper.php';

// Logging
function zion_wallet_log($message) {
    $timestamp = date('Y-m-d H:i:s');
    $logFile = __DIR__ . '/../data/wallet_v3.log';
    @file_put_contents($logFile, "[$timestamp] $message\n", FILE_APPEND);
}

/**
 * Generate real ZION blockchain wallet with mnemonic
 * 
 * @param array $options Wallet generation options
 * @return array Wallet data including mnemonic
 * @throws RuntimeException If wallet generation fails
 */
function zion_generate_wallet_v3(array $options): array
{
    $label = trim((string)($options['label'] ?? ''));
    $tokens = (int)($options['tokens'] ?? 0);
    $orderId = trim((string)($options['orderId'] ?? ''));
    $customerEmail = trim((string)($options['customerEmail'] ?? ''));
    $customerName = trim((string)($options['customerName'] ?? ''));
    $network = $options['network'] ?? 'testnet';
    
    // Validation
    if ($tokens <= 0) {
        throw new InvalidArgumentException('Tokens must be positive integer');
    }
    
    if ($orderId === '') {
        throw new InvalidArgumentException('Order ID is required');
    }
    
    if ($customerEmail === '' || !filter_var($customerEmail, FILTER_VALIDATE_EMAIL)) {
        throw new InvalidArgumentException('Valid customer email is required');
    }
    
    // Check if Python API is available
    if (!is_wallet_api_v3_available()) {
        zion_wallet_log('ERROR: Python Wallet API V3 is not running on port 5557');
        throw new RuntimeException('Wallet API is not available. Please start: python3 api/wallet_api_v3.py');
    }
    
    // Prepare request
    $requestData = [
        'orderId' => $orderId,
        'email' => $customerEmail,
        'name' => $customerName ?: 'Presale Customer',
        'tokens' => $tokens,
        'network' => $network,
        'apiSecret' => WALLET_API_SECRET
    ];
    
    zion_wallet_log("Requesting wallet generation for order $orderId ($tokens tokens)");
    
    // Call Python API
    $ch = curl_init(WALLET_API_V3_URL);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($requestData),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => WALLET_API_TIMEOUT,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'Accept: application/json',
            'X-API-Secret: ' . WALLET_API_SECRET
        ]
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);
    
    // Error handling
    if ($curlError) {
        zion_wallet_log("ERROR: cURL error: $curlError");
        throw new RuntimeException("Wallet API connection failed: $curlError");
    }
    
    if ($httpCode !== 200) {
        zion_wallet_log("ERROR: HTTP $httpCode response: $response");
        throw new RuntimeException("Wallet API returned error (HTTP $httpCode)");
    }
    
    $data = json_decode($response, true);
    
    if (!$data || !isset($data['success']) || !$data['success']) {
        $error = $data['error'] ?? 'Unknown error';
        zion_wallet_log("ERROR: Wallet generation failed: $error");
        throw new RuntimeException("Wallet generation failed: $error");
    }
    
    // Extract wallet data
    $walletId = $data['walletId'];
    $address = $data['address'];
    $mnemonic = $data['mnemonic'];
    $publicKey = $data['publicKey'];
    $qrImage = $data['qrImage'] ?? null;
    $createdAt = $data['createdAt'];
    $expiresAt = $data['expiresAt'];
    
    zion_wallet_log("SUCCESS: Generated wallet $walletId for order $orderId");
    zion_wallet_log("Address: $address");
    zion_wallet_log("Mnemonic: " . substr($mnemonic, 0, 30) . "... (12 words)");
    
    // Build QR URL
    $qrUrl = $qrImage ? zion_wallet_public_url($qrImage) : null;
    
    // Return wallet data (compatible with old format + new mnemonic)
    return [
        'wallet' => [
            'id' => $walletId,
            'address' => $address,  // Real zion1... address
            'mnemonic' => $mnemonic,  // 12-word seed phrase
            'publicKey' => $publicKey,
            'label' => $label,
            'tokens' => $tokens,
            'orderId' => $orderId,
            'createdAt' => $createdAt,
            'expiresAt' => $expiresAt,
            'network' => $network,
            
            // Legacy compatibility (for old code expecting 'uri')
            'uri' => $address  // Use address as URI for now
        ],
        'qr' => [
            'imageFile' => $qrImage,
            'imageUrl' => $qrUrl,
            'serviceUrl' => $qrUrl,
            'dataUrl' => null  // Not provided by V3 API
        ],
        'storage' => [
            'json' => null,  // Stored in Python DB
            'image' => $qrImage
        ]
    ];
}

/**
 * Check if Python Wallet API V3 is running
 * 
 * @return bool True if API is available
 */
function is_wallet_api_v3_available(): bool
{
    // Build health URL from the configured API endpoint to avoid port drift
    $parsed = parse_url(WALLET_API_V3_URL);
    $base = ($parsed['scheme'] ?? 'http') . '://' . ($parsed['host'] ?? '127.0.0.1');
    if (!empty($parsed['port'])) {
        $base .= ':' . $parsed['port'];
    }
    $healthUrl = $base . '/health';

    $ch = curl_init($healthUrl);
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
 * Get wallet statistics from Python API
 * 
 * @return array|null Stats or null on failure
 */
function zion_wallet_get_stats(): ?array
{
    $ch = curl_init('http://127.0.0.1:5557/api/stats');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 5,
        CURLOPT_HTTPHEADER => [
            'X-API-Secret: ' . WALLET_API_SECRET
        ]
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode === 200) {
        $data = json_decode($response, true);
        if ($data && $data['success']) {
            return $data['stats'];
        }
    }
    
    return null;
}

/**
 * Export wallet for customer email (includes mnemonic)
 * 
 * @param string $orderId Order ID
 * @return array|null Wallet export data or null on failure
 */
function zion_wallet_export_for_email(string $orderId): ?array
{
    $url = "http://127.0.0.1:5557/api/wallet/export/$orderId";
    
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 5,
        CURLOPT_HTTPHEADER => [
            'X-API-Secret: ' . WALLET_API_SECRET
        ]
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode === 200) {
        $data = json_decode($response, true);
        if ($data && $data['success']) {
            return [
                'address' => $data['address'],
                'mnemonic' => $data['mnemonic'],
                'tokens' => $data['tokens'],
                'qrImage' => $data['qrImage'],
                'qrUrl' => $data['qrUrl']
            ];
        }
    }
    
    return null;
}

// ============================================
// WALLET POOL FALLBACK
// ============================================

// Load wallet pool library for fallback
require_once __DIR__ . '/wallet-pool.php';

/**
 * Wrapper for backward compatibility
 * Priority: V3 API > Wallet Pool > Error
 */
if (!function_exists('zion_generate_wallet')) {
    function zion_generate_wallet(array $options): array
    {
        // Try V3 API first (fastest, real-time)
        if (is_wallet_api_v3_available()) {
            try {
                zion_wallet_log("Using V3 API for wallet generation");
                return zion_generate_wallet_v3($options);
            } catch (Exception $e) {
                zion_wallet_log("V3 generation failed: " . $e->getMessage());
                // Fall through to pool
            }
        }
        
        // Fallback to pre-generated wallet pool
        if (is_wallet_pool_available()) {
            try {
                zion_wallet_log("V3 API unavailable, using wallet pool");
                return wallet_pool_assign(
                    $options['orderId'] ?? '',
                    $options['customerEmail'] ?? '',
                    $options['customerName'] ?? '',
                    (int)($options['tokens'] ?? 0),
                    $options['network'] ?? 'testnet'
                );
            } catch (Exception $e) {
                zion_wallet_log("Pool assignment failed: " . $e->getMessage());
                throw new RuntimeException("Wallet pool exhausted: " . $e->getMessage());
            }
        }
        
        // No wallets available
        throw new RuntimeException('No wallet source available. Either start Python API or generate pool: python3 api/generate_wallet_pool.py');
    }
}

// Ledger functions (unchanged from original wallet-lib.php)
if (!function_exists('zion_wallet_load_ledger')) {
    function zion_wallet_load_ledger(): array
    {
        $ledgerFile = ZION_WALLET_STORAGE_DIR . '/ledger.json';
        if (!file_exists($ledgerFile)) {
            return [];
        }
        
        $json = file_get_contents($ledgerFile);
        $data = json_decode($json, true);
        return is_array($data) ? $data : [];
    }
}

if (!function_exists('zion_wallet_save_ledger')) {
    function zion_wallet_save_ledger(array $entries): void
    {
        $ledgerFile = ZION_WALLET_STORAGE_DIR . '/ledger.json';
        if (!is_dir(ZION_WALLET_STORAGE_DIR)) {
            mkdir(ZION_WALLET_STORAGE_DIR, 0755, true);
        }
        
        file_put_contents(
            $ledgerFile,
            json_encode(array_values($entries), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE),
            LOCK_EX
        );
    }
}

if (!function_exists('zion_wallet_append_ledger_entry')) {
    function zion_wallet_append_ledger_entry(array $data): array
    {
        $ledger = zion_wallet_load_ledger();
        
        try {
            $ledgerId = $data['id'] ?? ('ledger_' . bin2hex(random_bytes(4)));
        } catch (Throwable $e) {
            $ledgerId = 'ledger_' . uniqid();
        }
        
        $status = $data['status'] ?? 'pending';
        $now = date(DATE_ATOM);
        
        $entry = [
            'id' => $ledgerId,
            'orderId' => $data['orderId'] ?? null,
            'walletId' => $data['walletId'] ?? null,
            'tokens' => (int)($data['tokens'] ?? 0),
            'status' => $status,
            'network' => $data['network'] ?? 'testnet',
            'source' => $data['source'] ?? 'presale',
            'createdAt' => $now,
            'updatedAt' => $now,
            'walletAddress' => $data['walletAddress'] ?? null,  // V3: Real address
            'walletMnemonic' => $data['walletMnemonic'] ?? null,  // V3: Mnemonic (encrypted in production!)
            'qrImage' => $data['qrImage'] ?? null,
            'note' => $data['note'] ?? null,
            'txHash' => $data['txHash'] ?? null,
            'history' => []
        ];
        
        $entry['history'][] = [
            'status' => $entry['status'],
            'timestamp' => $now,
            'note' => $data['historyNote'] ?? 'Created via Wallet API V3'
        ];
        
        $ledger[] = $entry;
        zion_wallet_save_ledger($ledger);
        
        return $entry;
    }
}
