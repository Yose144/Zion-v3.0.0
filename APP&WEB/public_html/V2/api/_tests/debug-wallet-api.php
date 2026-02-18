<?php
/**
 * Debug test pro Wallet API
 */

require_once __DIR__ . '/wallet-generator.php';

header('Content-Type: application/json');

$result = [];

// 1. Check if API is available
$result['api_available'] = isWalletApiAvailable();

// 2. Try to generate wallet
if ($result['api_available']) {
    $wallet = generateZionWallet('test@example.com', 1000, 'DEBUG_TEST_001');
    $result['wallet_generated'] = $wallet !== false;
    $result['wallet_data'] = $wallet;
} else {
    $result['wallet_generated'] = false;
    $result['error'] = 'API not available';
}

// 3. Show configuration
$result['config'] = [
    'WALLET_API_URL' => WALLET_API_URL,
    'curl_available' => function_exists('curl_init')
];

echo json_encode($result, JSON_PRETTY_PRINT);
