<?php
require_once __DIR__ . '/wallet-lib-v3.php';

echo "Testing ZION Wallet V3 Integration\n";
echo "===================================\n\n";

// Check if API is available
echo "1. Checking API availability...\n";
if (is_wallet_api_v3_available()) {
    echo "   ✅ API is running\n\n";
} else {
    echo "   ❌ API is NOT available!\n\n";
    exit(1);
}

// Generate test wallet
echo "2. Generating test wallet...\n";
try {
    $result = zion_generate_wallet_v3([
        'label' => 'PHP Test Wallet',
        'tokens' => 25000,
        'orderId' => 'PRESALE-PHP-TEST-' . time(),
        'customerEmail' => 'phptest@zionterranova.com',
        'customerName' => 'PHP Test User',
        'network' => 'testnet'
    ]);
    
    echo "   ✅ Wallet generated!\n";
    echo "   Address: " . $result['wallet']['address'] . "\n";
    echo "   Mnemonic: " . substr($result['wallet']['mnemonic'], 0, 40) . "...\n";
    echo "   Tokens: " . number_format($result['wallet']['tokens']) . " ZION\n\n";
    
    echo "✅ ALL TESTS PASSED!\n";
} catch (Exception $e) {
    echo "   ❌ Error: " . $e->getMessage() . "\n";
    exit(1);
}
