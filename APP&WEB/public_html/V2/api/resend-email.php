<?php
/**
 * Resend order confirmation email (without invoice)
 */
require_once __DIR__ . '/send-rasta-email.php';

header('Content-Type: application/json');

$orderId = $_GET['orderId'] ?? null;
if (!$orderId) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing orderId']);
    exit;
}

$ordersDir = __DIR__ . '/../orders';
$orderFile = $ordersDir . '/' . basename($orderId) . '.json';
if (!file_exists($orderFile)) {
    $ordersDir = __DIR__ . '/../presale-orders';
    $orderFile = $ordersDir . '/' . basename($orderId) . '.json';
}

if (!file_exists($orderFile)) {
    http_response_code(404);
    echo json_encode(['success' => false, 'error' => 'Order not found']);
    exit;
}

$order = json_decode(file_get_contents($orderFile), true);
$customerEmail = $order['customer']['email'] ?? null;

if (!$customerEmail) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'No customer email in order']);
    exit;
}

// Send WITHOUT invoice
$result = sendRastaOrderEmail($order, $customerEmail, null, null);

echo json_encode([
    'success' => $result['success'] ?? false,
    'orderId' => $orderId,
    'email' => $customerEmail,
    'message' => $result['message'] ?? null,
    'output' => $result['output'] ?? null
]);
