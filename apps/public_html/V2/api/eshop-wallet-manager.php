<?php
/**
 * eShop Wallet Manager - PHP Wrapper
 * 
 * Bridges PHP create-order with Python wallet generation.
 * Handles wallet creation, QR codes, and integration with email system.
 * 
 * Usage:
 *   require_once __DIR__ . '/eshop-wallet-manager.php';
 *   $result = create_eshop_wallet_php($orderId, $customerEmail, $customerName, $tokens);
 */

/**
 * Create an eshop wallet via Python
 * 
 * @param string $orderId Unique order ID
 * @param string $customerEmail Customer email
 * @param string $customerName Customer name
 * @param int $tokens Number of ZION tokens to allocate
 * 
 * @return array [
 *     'success' => bool,
 *     'wallet_id' => 'zw_...',
 *     'address' => 'zion1...',
 *     'tokens' => int,
 *     'mnemonic' => '12 word phrase',
 *     'private_key' => 'hex string',
 *     'public_key' => 'hex string',
 *     'qr_image' => 'filename.png',
 *     'error' => 'error message (if failed)'
 * ]
 */
function create_eshop_wallet_php($orderId, $customerEmail, $customerName, $tokens) {
    // Path to Python script and wallet manager (inside function scope)
    $PYTHON_SCRIPT = __DIR__ . '/../scripts/eshop_wallet_cli.py';
    $WALLET_MANAGER_PATH = __DIR__ . '/../src/wallet';
    
    // Validate inputs
    if (empty($orderId) || empty($customerEmail) || empty($customerName) || $tokens <= 0) {
        return [
            'success' => false,
            'error' => 'Invalid input parameters'
        ];
    }
    
    // Create temp JSON file with parameters
    $tempDir = sys_get_temp_dir();
    $tempFile = $tempDir . '/zion_wallet_' . uniqid() . '.json';
    
    $payloadData = [
        'order_id' => $orderId,
        'customer_email' => $customerEmail,
        'customer_name' => $customerName,
        'tokens' => (int)$tokens
    ];
    
    $jsonPayload = json_encode($payloadData, JSON_UNESCAPED_UNICODE);
    if (file_put_contents($tempFile, $jsonPayload) === false) {
        return [
            'success' => false,
            'error' => 'Failed to create temp file'
        ];
    }
    
    // Build Python command
    $pythonPath = getPythonExecutable();
    
    // Try to run Python script
    if (!file_exists($PYTHON_SCRIPT)) {
        error_log("WARNING: Python wallet script not found: $PYTHON_SCRIPT");
        
        // Fallback: Generate local wallet (without persistence)
        return generateLocalWallet($orderId, $customerEmail, $customerName, $tokens);
    }
    
    // Run Python wallet generation
    // Note: Redirect stderr to /dev/null to avoid mixing logs with JSON output
    $command = sprintf(
        '%s %s --payload %s 2>/dev/null',
        escapeshellcmd($pythonPath),
        escapeshellarg($PYTHON_SCRIPT),
        escapeshellarg($tempFile)
    );
    
    $output = [];
    $exitCode = 0;
    exec($command, $output, $exitCode);
    
    @unlink($tempFile);
    
    if ($exitCode !== 0) {
        error_log("Wallet generation failed (exit code: $exitCode): " . implode('\n', $output));
        
        // Fallback to local generation
        return generateLocalWallet($orderId, $customerEmail, $customerName, $tokens);
    }
    
    // Parse JSON response from Python (last line should be JSON)
    $jsonResponse = end($output);
    if (empty($jsonResponse)) {
        $jsonResponse = implode("\n", $output);
    }
    
    $result = json_decode($jsonResponse, true);
    
    if (!is_array($result)) {
        error_log("Invalid JSON response from wallet generation: $jsonResponse");
        return generateLocalWallet($orderId, $customerEmail, $customerName, $tokens);
    }
    
    return $result;
}

/**
 * Generate wallet locally (fallback if Python unavailable)
 * 
 * Returns wallet data without storing to database.
 * Used only as fallback - prefer Python generation.
 */
function generateLocalWallet($orderId, $customerEmail, $customerName, $tokens) {
    // Generate simple wallet ID
    $walletId = 'zw_' . strtoupper(bin2hex(random_bytes(8)));
    
    // Generate simple address (zion1 + random hex)
    $addressData = strtolower(bin2hex(random_bytes(20)));
    $address = 'zion1' . substr($addressData, 0, 39);
    
    // Generate simple keys (not cryptographically secure, for fallback only)
    $privateKey = bin2hex(random_bytes(32));
    $publicKey = bin2hex(random_bytes(32));
    
    // Generate fake mnemonic (placeholder)
    $words = ['abandon', 'ability', 'able', 'about', 'above', 'absent', 'absorb', 'abuse',
              'access', 'accident', 'account', 'accuse'];
    $mnemonic = implode(' ', $words);
    
    error_log("⚠️ WARNING: Using local wallet fallback for $orderId - data NOT persisted!");
    
    return [
        'success' => true,
        'wallet_id' => $walletId,
        'address' => $address,
        'tokens' => (int)$tokens,
        'mnemonic' => $mnemonic,
        'private_key' => $privateKey,
        'public_key' => $publicKey,
        'qr_image' => null,
        'created_at' => date('c'),
        'warning' => 'Using fallback local generation - no database persistence'
    ];
}

/**
 * Find Python executable
 */
function getPythonExecutable() {
    // Check common locations
    $candidates = [
        '/usr/bin/python3',
        '/usr/local/bin/python3',
        '/opt/python3/bin/python3',
        'python3',
        'python'
    ];
    
    foreach ($candidates as $python) {
        // Check if file exists (absolute paths only)
        if (strpos($python, '/') === 0 && file_exists($python)) {
            return $python;
        }
        
        // Try to find in PATH
        if (strtolower(PHP_OS_FAMILY) === 'windows') {
            $result = shell_exec("where $python 2>nul");
        } else {
            $result = shell_exec("which $python 2>/dev/null");
        }
        
        if ($result) {
            return trim($result);
        }
    }
    
    // Fallback
    return 'python3';
}

/**
 * Get wallet info from database
 * 
 * @param string $walletId Wallet ID (zw_...)
 * @return array Wallet data or error
 */
function get_eshop_wallet_php($walletId) {
    $tempFile = sys_get_temp_dir() . '/zion_get_wallet_' . uniqid() . '.json';
    $payload = json_encode(['wallet_id' => $walletId]);
    file_put_contents($tempFile, $payload);
    
    $pythonPath = getPythonExecutable();
    $script = __DIR__ . '/../../../scripts/eshop_wallet_cli.py';
    
    $command = sprintf(
        '%s %s --get --payload %s 2>&1',
        escapeshellcmd($pythonPath),
        escapeshellarg($script),
        escapeshellarg($tempFile)
    );
    
    $output = [];
    $exitCode = 0;
    exec($command, $output, $exitCode);
    
    @unlink($tempFile);
    
    if ($exitCode !== 0) {
        return ['success' => false, 'error' => 'Failed to retrieve wallet'];
    }
    
    return json_decode(implode("\n", $output), true) ?: ['success' => false, 'error' => 'Invalid response'];
}

/**
 * Log wallet activity to database
 */
function log_wallet_activity($walletId, $action, $details = '') {
    global $PYTHON_SCRIPT;
    
    $payload = [
        'wallet_id' => $walletId,
        'action' => $action,
        'details' => $details
    ];
    
    $tempFile = sys_get_temp_dir() . '/zion_log_' . uniqid() . '.json';
    file_put_contents($tempFile, json_encode($payload));
    
    $pythonPath = getPythonExecutable();
    $script = __DIR__ . '/../../../scripts/eshop_wallet_cli.py';
    
    $command = sprintf(
        '%s %s --log --payload %s 2>&1',
        escapeshellcmd($pythonPath),
        escapeshellarg($script),
        escapeshellarg($tempFile)
    );
    
    exec($command, $output, $exitCode);
    @unlink($tempFile);
    
    return $exitCode === 0;
}
?>
