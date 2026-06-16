<?php
/**
 * Trivi API Test Script
 * ======================
 * Testovací script pro ověření Trivi API integrace
 * 
 * Usage:
 *   php test-trivi-api.php
 * 
 * @author ZION Team
 * @created 2026-01-06
 */

require_once __DIR__ . '/trivi-config.php';
require_once __DIR__ . '/trivi-api-connector.php';
require_once __DIR__ . '/trivi-order-mapper.php';
require_once __DIR__ . '/trivi-integration-service.php';

echo "==============================================\n";
echo "Trivi API Integration Test\n";
echo "==============================================\n\n";

// 1. Validate configuration
echo "1. Validating Trivi configuration...\n";
$configErrors = TriviConfig::validate();

if (!empty($configErrors)) {
    echo "❌ Configuration ERRORS:\n";
    foreach ($configErrors as $error) {
        echo "   - {$error}\n";
    }
    echo "\n⚠️  Fix configuration errors in .env file before continuing!\n\n";
} else {
    echo "✅ Configuration valid\n\n";
}

// Display configuration
echo "Configuration:\n";
echo "  API URL: " . TriviConfig::getApiUrl() . "\n";
echo "  Test Mode: " . (TriviConfig::isTestMode() ? 'YES' : 'NO') . "\n";
echo "  APP ID: " . (TriviConfig::getAppId() ? substr(TriviConfig::getAppId(), 0, 8) . '...' : 'NOT SET') . "\n";
echo "  APP SECRET: " . (TriviConfig::getAppSecret() ? '***' . substr(TriviConfig::getAppSecret(), -4) : 'NOT SET') . "\n";
echo "\n";

// 2. Test API authentication
echo "2. Testing API authentication...\n";
$api = new TriviApiConnector();
$authResult = $api->authenticate();

if ($authResult) {
    echo "✅ Authentication successful\n\n";
} else {
    echo "❌ Authentication FAILED\n";
    echo "   Check logs/trivi-api.log for details\n\n";
    exit(1);
}

// 3. Test order mapping
echo "3. Testing order-to-invoice mapping...\n";

// Mock order data
$mockOrder = [
    'orderId' => 'ORD-1736122900-test',
    'customer' => [
        'name' => 'Test Customer',
        'email' => 'test@example.com',
        'phone' => '+420123456789',
        'address' => [
            'street' => 'Test Street 123',
            'city' => 'Prague',
            'zip' => '12000',
            'country' => 'CZ' // REQUIRED!
        ]
    ],
    'items' => [
        [
            'name' => 'Test Product',
            'price' => 100,
            'quantity' => 2
        ]
    ],
    'shipping' => [
        'method' => 'zasilkovna',
        'price' => 69
    ],
    'payment' => [
        'method' => 'bank'
    ],
    'total' => 269
];

try {
    $invoiceData = TriviOrderMapper::orderToInvoice($mockOrder, 1);
    
    echo "✅ Order mapping successful\n";
    echo "   Invoice Number: " . $invoiceData['invoice_number'] . "\n";
    echo "   Variable Symbol: " . $invoiceData['variable_symbol'] . "\n";
    echo "   Total: " . $invoiceData['totals']['total_with_vat'] . " CZK\n";
    echo "   Customer Country: " . $invoiceData['customer']['address']['country'] . "\n";
    echo "\n";
    
    // Display full invoice data (for debugging)
    echo "Generated Invoice Data (JSON):\n";
    echo json_encode($invoiceData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "\n\n";
    
} catch (Exception $e) {
    echo "❌ Order mapping FAILED: " . $e->getMessage() . "\n\n";
    exit(1);
}

// 4. Test integration service (DRY RUN - no actual API call)
echo "4. Testing integration service (dry run)...\n";

$service = new TriviIntegrationService();
echo "✅ Integration service initialized\n";
echo "   Database: " . __DIR__ . '/../data/trivi_sync.db' . "\n";
echo "   Logs: " . __DIR__ . '/../logs/trivi-integration.log' . "\n";
echo "\n";

// 5. Test actual API call (OPTIONAL - only if user confirms)
echo "==============================================\n";
echo "5. OPTIONAL: Send test invoice to Trivi API?\n";
echo "   ⚠️  This will create a REAL document in Trivi!\n";
echo "   Continue? (yes/no): ";

$handle = fopen("php://stdin", "r");
$confirmation = trim(fgets($handle));
fclose($handle);

if (strtolower($confirmation) === 'yes') {
    echo "\n📤 Sending test invoice to Trivi...\n";
    
    $result = $api->sendInvoice($invoiceData);
    
    if ($result['success']) {
        echo "✅ Test invoice sent successfully!\n";
        echo "   Trivi Document ID: " . $result['trivi_id'] . "\n";
        echo "\n";
    } else {
        echo "❌ Test invoice FAILED\n";
        echo "   Error: " . $result['error'] . "\n";
        echo "   Check logs/trivi-api.log for details\n\n";
    }
} else {
    echo "\n⏭️  Skipped API test (no real document created)\n\n";
}

// Summary
echo "==============================================\n";
echo "Test Summary\n";
echo "==============================================\n";
echo "Configuration: " . (empty($configErrors) ? '✅ OK' : '❌ ERRORS') . "\n";
echo "Authentication: " . ($authResult ? '✅ OK' : '❌ FAILED') . "\n";
echo "Order Mapping: ✅ OK\n";
echo "Integration Service: ✅ OK\n";
echo "\n";

if (empty($configErrors) && $authResult) {
    echo "🎉 All tests PASSED! Trivi integration is ready.\n";
    echo "\n";
    echo "Next steps:\n";
    echo "1. Get finAccount categories from Trivi (TRIVI_FIN_ACCOUNTS in .env)\n";
    echo "2. Test with real order in create-order.php\n";
    echo "3. Monitor logs/trivi-integration.log\n";
    echo "4. Check Trivi portal for created documents\n";
} else {
    echo "❌ Some tests FAILED. Fix errors before using in production.\n";
}

echo "\n";
