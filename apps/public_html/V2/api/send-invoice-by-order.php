<?php
/**
 * ZION eShop - Admin: Vygenerovat a odeslat fakturu podle objednávky
 * 
 * API: /V2/api/send-invoice-by-order.php?orderId=XXXX
 * - Načte uloženou objednávku z `public_html/V2/orders/<orderId>.json`
 * - Vygeneruje PDF fakturu přes bridge
 * - Odešle Rasta email zákazníkovi s přiloženou fakturou
 * - Vrátí JSON se stavem
 */

require_once __DIR__ . '/generate-invoice.php';
require_once __DIR__ . '/send-rasta-email.php';
require_once 'auth.php';

if (!isLoggedIn()) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST');
header('Access-Control-Allow-Headers: Content-Type');

$orderId = $_GET['orderId'] ?? $_POST['orderId'] ?? null;
if (!$orderId) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing orderId']);
    exit;
}

$ordersDir = __DIR__ . '/../orders';
$orderFile = $ordersDir . '/' . basename($orderId) . '.json';
if (!file_exists($orderFile)) {
    // fallback na presale objednávky
    $ordersDir = __DIR__ . '/../presale-orders';
    $orderFile = $ordersDir . '/' . basename($orderId) . '.json';
}

if (!file_exists($orderFile)) {
    http_response_code(404);
    echo json_encode(['success' => false, 'error' => 'Order file not found', 'path' => $orderFile]);
    exit;
}

$order = json_decode(file_get_contents($orderFile), true);
if (!$order) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Failed to parse order JSON']);
    exit;
}

// Generate invoice PDF
$invoiceResult = generateInvoice($order);
if (!$invoiceResult['success']) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Invoice generation failed',
        'details' => $invoiceResult
    ]);
    exit;
}

$invoicePath = $invoiceResult['path'] ?? $invoiceResult['output_path'] ?? null;
if (!$invoicePath) {
    // Fallback: reconstruct path
    $invoicePath = __DIR__ . '/../invoices/invoice_' . $orderId . '.pdf';
}

// Odeslat fakturu ZÁKAZNÍKOVI (admin akce), podle požadavku UI
$customerEmail = $order['customer']['email'] ?? null;
if (!$customerEmail || !filter_var($customerEmail, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Customer email missing or invalid in order']);
    exit;
}

$sendResult = sendRastaOrderEmail($order, $customerEmail, null, $invoicePath);

echo json_encode([
    'success' => $sendResult['success'] ?? false,
    'orderId' => $orderId,
    'customerEmail' => $customerEmail,
    'invoicePath' => $invoicePath,
    'message' => $sendResult['message'] ?? null,
    'output' => $sendResult['output'] ?? null,
    'error' => $sendResult['error'] ?? null,
    'exitCode' => $sendResult['exitCode'] ?? null
]);

?>
