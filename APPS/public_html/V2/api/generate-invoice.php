<?php
/**
 * ZION eShop - Invoice Generator (Rasta PDF via Python)
 * =====================================================
 * Generuje krásné Rasta-themed PDF faktury pomocí Python/ReportLab.
 * Používá python-bridge.php pro spuštění na hostingu.
 */

require_once __DIR__ . '/python-bridge.php';

function generateInvoice(array $order): array
{
    if (empty($order['orderId']) || empty($order['customer'])) {
        return ['success' => false, 'error' => 'Missing required order fields'];
    }

    $debugLog = __DIR__ . '/../logs/invoice-generation-debug.log';
    $orderId = $order['orderId'];
    $customer = $order['customer'];

    $baseDir = '/home/html/newearth.cz/public_html/V2';
    $invoicesDir = $baseDir . '/invoices';
    $outputPath = $invoicesDir . '/invoice_' . $orderId . '.pdf';

    if (!is_dir($invoicesDir)) {
        mkdir($invoicesDir, 0755, true);
    }

    $year = date('Y');
    $invoiceNumber = $year . '/' . sprintf('%03d', rand(1, 999));

    $items = [];
    foreach ($order['items'] ?? [] as $item) {
        $items[] = [
            'name' => $item['name'] ?? 'Produkt',
            'quantity' => (int)($item['quantity'] ?? 1),
            'unit_price' => (float)($item['price'] ?? 0),
            'vat_rate' => 0.21
        ];
    }

    if (!empty($order['shipping']['price']) && $order['shipping']['price'] > 0) {
        $items[] = [
            'name' => 'Doprava: ' . ($order['shipping']['carrier'] ?? 'Doprava'),
            'quantity' => 1,
            'unit_price' => (float)$order['shipping']['price'],
            'vat_rate' => 0.21
        ];
    }

    $address = $customer['address'] ?? [];
    $customerAddress = implode(', ', array_filter([
        $address['street'] ?? '',
        $address['city'] ?? '',
        $address['zip'] ?? ''
    ]));

    if (empty($customerAddress) && !empty($order['shipping']['pickupPoint'])) {
        $pp = $order['shipping']['pickupPoint'];
        $customerAddress = 'Výdejní místo: ' . ($pp['name'] ?? '') . ', ' . ($pp['city'] ?? '');
    }

    $itemsJson = json_encode($items, JSON_UNESCAPED_UNICODE);
    $cmd = [
        'scripts/generate_invoice.py',
        '--invoice-number', $invoiceNumber,
        '--order-id', $orderId,
        '--customer-name', (string)($customer['name'] ?? 'Zákazník'),
        '--customer-email', (string)($customer['email'] ?? 'unknown@example.com'),
        '--customer-address', (string)($customerAddress ?: 'Neuvedeno'),
        '--items', (string)$itemsJson,
        '--output-path', $outputPath,
    ];

    $logData = date('Y-m-d H:i:s') . " - Order: {$orderId} (Python Rasta PDF)\n";
    $logData .= "Command: python3 " . json_encode($cmd, JSON_UNESCAPED_UNICODE) . "\n";
    @file_put_contents($debugLog, $logData, FILE_APPEND);

    $result = executePythonCommand($cmd, 20);

    $logData = "Result: " . json_encode($result) . "\n";
    $logData .= str_repeat('-', 80) . "\n";
    @file_put_contents($debugLog, $logData, FILE_APPEND);

    clearstatcache();
    if (file_exists($outputPath) && filesize($outputPath) > 1000) {
        return [
            'success' => true,
            'output_path' => $outputPath,
            'path' => $outputPath,
            'invoice_number' => $result['invoice_number'] ?? $invoiceNumber,
            'total_formatted' => $result['total_formatted'] ?? null,
            'method' => 'python_rasta'
        ];
    }

    if (!empty($result['success'])) {
        return [
            'success' => true,
            'output_path' => $result['output_path'] ?? $outputPath,
            'path' => $result['output_path'] ?? $outputPath,
            'invoice_number' => $result['invoice_number'] ?? $invoiceNumber,
            'total_formatted' => $result['total_formatted'] ?? null
        ];
    }

    return [
        'success' => false,
        'error' => $result['error'] ?? 'Python invoice generation failed',
        'debug' => $result
    ];
}

/**
 * Get invoice URL for email attachment or download
 *
 * @param string $invoicePath Full filesystem path to invoice
 * @return string Public URL to invoice
 */
function getInvoiceUrl(string $invoicePath): string
{
    // Convert filesystem path to URL
    $relativePath = str_replace(
        ['/home/html/newearth.cz/public_html', __DIR__ . '/..'],
        '',
        $invoicePath
    );
    return 'https://newearth.cz' . $relativePath;
}
