<?php
/**
 * Debug script - zkouší odeslat zákaznický email
 */

require_once __DIR__ . '/smtp-mailer.php';
require_once __DIR__ . '/email-templates/order-confirmation.php';

// Načti poslední objednávku
$ordersDir = __DIR__ . '/../orders';
$files = glob($ordersDir . '/*.json');
rsort($files);
$lastOrderFile = $files[0] ?? null;

if (!$lastOrderFile) {
    die("❌ Žádná objednávka nenalezena\n");
}

$order = json_decode(file_get_contents($lastOrderFile), true);
$orderId = $order['orderId'] ?? 'N/A';
$customerEmail = $order['customer']['email'] ?? null;

echo "=== DEBUG: Customer Email ===\n";
echo "Order ID: $orderId\n";
echo "Customer email: $customerEmail\n\n";

if (!$customerEmail) {
    die("❌ Chybí email zákazníka\n");
}

echo "Generuji HTML email...\n";
try {
    // Debug: vypsat proměnné
    echo "  zionTokens (old): " . ($order['zionTokens'] ?? 'NULL') . "\n";
    echo "  zion.tokens.totalTokens (new): " . ($order['zion']['tokens']['totalTokens'] ?? 'NULL') . "\n";
    echo "  items count: " . count($order['items']) . "\n";
    
    $customerHtmlEmail = getOrderConfirmationEmail($order);
    echo "✅ HTML vygenerován (" . strlen($customerHtmlEmail) . " bytů)\n\n";
    
    // Uložit HTML pro kontrolu
    file_put_contents(__DIR__ . '/../logs/last-email.html', $customerHtmlEmail);
    echo "  Uloženo do logs/last-email.html\n\n";
} catch (Throwable $e) {
    die("❌ Chyba při generování HTML: " . $e->getMessage() . "\n" . $e->getTraceAsString() . "\n");
}

echo "Odesílám email...\n";
$customerSubject = "Potvrzení objednávky #$orderId - ZION eShop";
$customerHtmlHeaders = "From: ZION eShop <shop@newearth.cz>\r\n";
$customerHtmlHeaders .= "Reply-To: shop@newearth.cz\r\n";
$customerHtmlHeaders .= "Return-Path: shop@newearth.cz\r\n";
$customerHtmlHeaders .= "MIME-Version: 1.0\r\n";
$customerHtmlHeaders .= "Content-Type: text/html; charset=UTF-8\r\n";

$result = sendmail($customerEmail, $customerSubject, $customerHtmlEmail, $customerHtmlHeaders);

if ($result) {
    echo "✅ SUCCESS: Email odeslán na $customerEmail\n";
    echo "Zkontroluj inbox a spam!\n";
} else {
    echo "❌ FAILURE: Email se nepodařilo odeslat\n";
}
