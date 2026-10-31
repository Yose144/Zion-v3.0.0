<?php
/**
 * ZION eShop - Order Detail Endpoint
 * Vrací JSON data o objednávce podle ID.
 */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');

$orderId = $_GET['order'] ?? $_POST['order'] ?? null;

if (!$orderId) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing order parameter']);
    exit;
}

$orderId = strtoupper(preg_replace('/[^A-Z0-9_-]/i', '', $orderId));

if (strlen($orderId) < 6) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid order identifier']);
    exit;
}

$ordersDir = __DIR__ . '/../orders';
$orderFile = $ordersDir . '/' . $orderId . '.json';

if (!file_exists($orderFile)) {
    http_response_code(404);
    echo json_encode(['success' => false, 'error' => 'Order not found']);
    exit;
}

$orderData = json_decode(file_get_contents($orderFile), true);

if (!$orderData) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Order file is corrupted']);
    exit;
}

$shipping = $orderData['shipping'] ?? [];
$customer = $orderData['customer'] ?? [];
$zion = $orderData['zion'] ?? [];
$tokenSummary = $orderData['zionTokens'] ?? ($zion['tokens']['totalTokens'] ?? 0);

$response = [
    'success' => true,
    'orderId' => $orderData['orderId'] ?? $orderId,
    'status' => $orderData['status'] ?? 'created',
    'payment' => $orderData['payment'] ?? null,
    'shipping' => [
        'method' => $shipping['method'] ?? null,
        'price' => $shipping['price'] ?? null,
        'pickupPoint' => $shipping['pickupPoint'] ?? null,
        'address' => $customer['address'] ?? null
    ],
    'total' => $orderData['total'] ?? null,
    'items' => $orderData['items'] ?? [],
    'zionTokens' => $tokenSummary,
    'createdAt' => $orderData['createdAt'] ?? null,
    'customer' => [
        'name' => $customer['name'] ?? null,
        'email' => $customer['email'] ?? null,
        'phone' => $customer['phone'] ?? null
    ]
];

echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
