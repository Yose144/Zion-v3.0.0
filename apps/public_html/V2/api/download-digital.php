<?php
/**
 * ZION eShop - Digital Download (Book PDF + Bonus ZIP)
 *
 * Endpoints:
 *   /V2/api/download-digital.php?orderId=...&session_id=...&type=book|bonus
 *   /V2/api/download-digital.php?orderId=...&token=...&type=book|bonus|en
 *
 * Security model:
 * - Method 1: Stripe session_id (from order-success page after payment)
 * - Method 2: Order-specific download token (for email links)
 * - Both require the order file to exist and contain a book item
 */

header('Cache-Control: no-store, no-cache, must-revalidate');

$orderId = $_GET['orderId'] ?? null;
$sessionId = $_GET['session_id'] ?? null;
$downloadToken = $_GET['token'] ?? null;
$type = $_GET['type'] ?? 'book';

if (!$orderId || (!$sessionId && !$downloadToken)) {
    http_response_code(400);
    echo 'Missing orderId or authentication (session_id or token)';
    exit;
}

$orderId = strtoupper(preg_replace('/[^A-Z0-9_-]/i', '', (string)$orderId));
$sessionId = $sessionId ? preg_replace('/[^a-zA-Z0-9_\-]/', '', (string)$sessionId) : null;
$downloadToken = $downloadToken ? preg_replace('/[^a-f0-9]/', '', (string)$downloadToken) : null;
$type = strtolower(trim((string)$type));

if (strlen($orderId) < 6) {
    http_response_code(400);
    echo 'Invalid orderId';
    exit;
}

$orderFile = __DIR__ . '/../orders/' . $orderId . '.json';
if (!file_exists($orderFile)) {
    http_response_code(404);
    echo 'Order not found';
    exit;
}

$order = json_decode((string)file_get_contents($orderFile), true);
if (!$order) {
    http_response_code(500);
    echo 'Order file is corrupted';
    exit;
}

// === AUTH METHOD 1: Stripe session_id (from order-success page) ===
if ($sessionId) {
    $paid = ($order['paymentStatus'] ?? '') === 'paid' || ($order['payment_status'] ?? '') === 'paid';
    $storedSession = (string)($order['stripeSessionId'] ?? '');

    if (!$paid) {
        http_response_code(403);
        echo 'Payment not confirmed yet';
        exit;
    }

    if ($storedSession === '' || !hash_equals($storedSession, $sessionId)) {
        http_response_code(403);
        echo 'Session mismatch';
        exit;
    }
    // Auth OK via Stripe session
}
// === AUTH METHOD 2: Download token (from email links) ===
elseif ($downloadToken) {
    // Token = sha256(orderId + secret salt)
    $tokenSecret = getenv('DOWNLOAD_TOKEN_SECRET') ?: 'ZION_DOWNLOAD_2025_newearth';
    $expectedToken = hash('sha256', $orderId . $tokenSecret);

    if (!hash_equals($expectedToken, $downloadToken)) {
        http_response_code(403);
        echo 'Invalid download token';
        exit;
    }
    // Auth OK via token - no need to check payment status
    // (email is sent after order creation, token is order-specific)
}
else {
    http_response_code(400);
    echo 'Missing authentication';
    exit;
}

$items = $order['items'] ?? [];
$hasBook = false;
if (is_array($items)) {
    foreach ($items as $it) {
        if (!is_array($it)) continue;
        $id = strtolower((string)($it['id'] ?? ''));
        $cat = strtolower((string)($it['category'] ?? ''));
        if ($cat === 'books' || strpos($id, 'book-') === 0) {
            $hasBook = true;
            break;
        }
    }
}

if (!$hasBook) {
    http_response_code(404);
    echo 'No digital book in this order';
    exit;
}

$booksDir = __DIR__ . '/../books';

if ($type === 'bonus') {
    // Multi-lang ZIP bundle (all languages)
    $path = $booksDir . '/QuantumRevolution.zip';
    $downloadName = 'QuantumRevolution_MultiLang.zip';
    $contentType = 'application/zip';
    if (!file_exists($path)) {
        $path = $booksDir . '/bonus-materials.zip';
        $downloadName = 'bonus-materials.zip';
    }
} elseif ($type === 'en') {
    // English PDF version
    $path = $booksDir . '/QuantumRevolution_EN.pdf';
    $downloadName = 'QuantumRevolution_EN.pdf';
    $contentType = 'application/pdf';
} else {
    // Default: CZ PDF version
    $path = $booksDir . '/QuantumRevolutionCZ.pdf';
    $downloadName = 'QuantumRevolution_CZ.pdf';
    $contentType = 'application/pdf';
    if (!file_exists($path)) {
        $path = $booksDir . '/quantova-revoluce.pdf';
        $downloadName = 'quantova-revoluce.pdf';
    }
}

if (!file_exists($path) || filesize($path) < 10_000) {
    http_response_code(500);
    error_log("Digital download: file not found or too small: $path");
    echo 'Digital file is not ready on server yet';
    exit;
}

header('Content-Type: ' . $contentType);
header('Content-Disposition: attachment; filename="' . $downloadName . '"');
header('Content-Length: ' . filesize($path));
readfile($path);
exit;
