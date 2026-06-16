<?php
/**
 * ZION eShop - Accounting API: List Invoices
 * API: /V2/api/accounting-invoices.php
 * Returns JSON list of invoices with metadata for accounting.
 */

require_once 'auth.php';
if (!isLoggedIn()) {
    header('HTTP/1.1 401 Unauthorized');
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

$dir = __DIR__ . '/../invoices';
if (!is_dir($dir)) {
    echo json_encode(['success' => false, 'error' => 'Invoices directory not found']);
    exit;
}

$files = glob($dir . '/invoice_*.pdf');
$baseUrl = 'https://www.newearth.cz/V2/invoices';
$items = [];

foreach ($files as $path) {
    $filename = basename($path);
    $orderId = preg_replace('/^invoice_(.+)\.pdf$/', '$1', $filename);
    $items[] = [
        'orderId' => $orderId,
        'filename' => $filename,
        'filesize' => filesize($path),
        'modified' => date('c', filemtime($path)),
        'url' => $baseUrl . '/' . $filename,
        'downloadApi' => 'https://www.newearth.cz/V2/api/download-invoice.php?orderId=' . urlencode($orderId)
    ];
}

echo json_encode(['success' => true, 'count' => count($items), 'invoices' => $items], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
?>
