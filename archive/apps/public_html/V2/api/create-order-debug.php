<?php
/**
 * Order Creation Wrapper with Error Handling
 * Wraps create-order.php to catch and report errors
 */

// Enable error reporting
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

try {
    // Capture output
    ob_start();
    
    // Include the actual create-order.php
    $result = include(__DIR__ . '/create-order.php');
    
    // Get any output
    $output = ob_get_clean();
    
    // If there was output, return it
    if ($output) {
        echo $output;
    } else {
        echo json_encode([
            'success' => true,
            'message' => 'Order processed',
            'result' => $result
        ]);
    }
    
} catch (Throwable $e) {
    ob_end_clean();
    
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage(),
        'file' => $e->getFile(),
        'line' => $e->getLine(),
        'trace' => $e->getTraceAsString()
    ], JSON_PRETTY_PRINT);
}
