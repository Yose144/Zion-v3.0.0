<?php
/**
 * ZION eShop - Download Invoice by Order ID
 * API: /V2/api/download-invoice.php?orderId=XXXX
 */

require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/generate-invoice.php';

function tryBasicAuthLogin(): bool {
    // Allow opening PDF endpoint directly (new tab) with Basic Auth prompt
    // and upgrade that to an admin session.
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    $user = null;
    $pass = null;

    if (!empty($_SERVER['PHP_AUTH_PW'])) {
        $user = $_SERVER['PHP_AUTH_USER'] ?? null;
        $pass = $_SERVER['PHP_AUTH_PW'];
    } elseif (is_string($authHeader) && stripos($authHeader, 'Basic ') === 0) {
        $decoded = base64_decode(substr($authHeader, 6));
        if (is_string($decoded) && strpos($decoded, ':') !== false) {
            [$user, $pass] = explode(':', $decoded, 2);
        }
    }

    if (!$pass) {
        return false;
    }

    $hash = getenv('ADMIN_PASSWORD_HASH');
    $plainPassword = getenv('ADMIN_PASSWORD');
    $valid = false;

    if ($hash && password_verify($pass, $hash)) {
        $valid = true;
    } elseif ($plainPassword && hash_equals($plainPassword, $pass)) {
        $valid = true;
    }

    if (!$valid) {
        return false;
    }

    $_SESSION['admin_logged_in'] = true;
    $_SESSION['last_activity'] = time();
    $_SESSION['admin_user'] = $user ?: 'admin';
    return true;
}

if (!isLoggedIn()) {
    tryBasicAuthLogin();
}

if (!isLoggedIn()) {
    header('HTTP/1.1 401 Unauthorized');
    header('WWW-Authenticate: Basic realm="ZION Admin"');
    echo 'Unauthorized';
    exit;
}

$orderId = $_GET['orderId'] ?? null;
if (!$orderId) {
    http_response_code(400);
    echo 'Missing orderId';
    exit;
}

$safeOrderId = basename((string)$orderId);
$invoicePath = __DIR__ . '/../invoices/invoice_' . $safeOrderId . '.pdf';

$force = ($_GET['force'] ?? null) === '1';

// If invoice doesn't exist (or forced), generate it from stored order.
if ($force || !file_exists($invoicePath) || filesize($invoicePath) < 1000) {
    $ordersDir = __DIR__ . '/../orders';
    $orderFile = $ordersDir . '/' . $safeOrderId . '.json';
    if (!file_exists($orderFile)) {
        // fallback na presale objednávky
        $ordersDir = __DIR__ . '/../presale-orders';
        $orderFile = $ordersDir . '/' . $safeOrderId . '.json';
    }

    if (!file_exists($orderFile)) {
        http_response_code(404);
        echo 'Order file not found';
        exit;
    }

    $order = json_decode((string)file_get_contents($orderFile), true);
    if (!$order) {
        http_response_code(500);
        echo 'Failed to parse order JSON';
        exit;
    }

    $invoiceResult = generateInvoice($order);
    if (empty($invoiceResult['success'])) {
        http_response_code(500);
        echo 'Invoice generation failed';
        exit;
    }

    $candidate = $invoiceResult['path'] ?? $invoiceResult['output_path'] ?? null;
    if (is_string($candidate) && $candidate !== '' && file_exists($candidate)) {
        $invoicePath = $candidate;
    }
}

if (!file_exists($invoicePath)) {
    http_response_code(404);
    echo 'Invoice not found';
    exit;
}

header('Content-Type: application/pdf');
header('Content-Disposition: attachment; filename="invoice_' . $safeOrderId . '.pdf"');
header('Content-Length: ' . filesize($invoicePath));
readfile($invoicePath);
exit;
?>
