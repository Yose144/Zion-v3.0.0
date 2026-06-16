<?php
/**
 * Simple Order Test - Debug endpoint
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

// Test 1: Check if create-order.php exists
$createOrderPath = __DIR__ . '/create-order.php';
$exists = file_exists($createOrderPath);

// Test 2: Try to read input
$rawInput = file_get_contents('php://input');
$jsonData = json_decode($rawInput, true);

// Test 3: Check dependencies
$dependencies = [
    'env-loader.php' => file_exists(__DIR__ . '/env-loader.php'),
    'wallet-lib-v3.php' => file_exists(__DIR__ . '/wallet-lib-v3.php'),
    'smtp-mailer.php' => file_exists(__DIR__ . '/smtp-mailer.php'),
    'send-rasta-email.php' => file_exists(__DIR__ . '/send-rasta-email.php')
];

// Test 4: Check orders directory
$ordersDir = __DIR__ . '/../orders';
$ordersDirExists = is_dir($ordersDir);
$ordersDirWritable = is_writable($ordersDir);

echo json_encode([
    'status' => 'debug_info',
    'timestamp' => date('Y-m-d H:i:s'),
    'create_order_exists' => $exists,
    'create_order_path' => $createOrderPath,
    'received_data' => [
        'method' => $_SERVER['REQUEST_METHOD'],
        'content_type' => $_SERVER['CONTENT_TYPE'] ?? 'none',
        'raw_input_length' => strlen($rawInput),
        'json_decoded' => $jsonData !== null,
        'json_error' => json_last_error_msg()
    ],
    'dependencies' => $dependencies,
    'orders_directory' => [
        'path' => $ordersDir,
        'exists' => $ordersDirExists,
        'writable' => $ordersDirWritable
    ],
    'php_version' => PHP_VERSION,
    'error_reporting' => error_reporting(),
    'last_error' => error_get_last()
], JSON_PRETTY_PRINT);
