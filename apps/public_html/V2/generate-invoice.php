<?php
/**
 * ZION eShop - Invoice Generator PHP Wrapper
 * ============================================
 * Generuje PDF fakturu z objednávky pomocí Python backendu.
 *
 * Usage:
 *     $result = generateInvoice($order);
 *     if ($result['success']) {
 *         $invoicePath = $result['output_path'];
 *     }
 *
 * Author: ZION Team
 * Created: 2025-12-09
 */

/**
 * Generate PDF invoice from order data
 *
 * @param array $order Order data from create-order.php
 * @return array Result with success, output_path, and error fields
 */
require_once __DIR__ . '/php-python-bridge.php';

function generateInvoice(array $order): array
{
    // Basic validation
    if (empty($order['orderId']) || empty($order['customer'])) {
        return ['success' => false, 'error' => 'Missing required order fields'];
    }

    // Paths - na serveru je struktura: public_html/V2/scripts/, public_html/V2/invoices/
    $pythonScript = __DIR__ . '/../scripts/generate_invoice.py';
    $invoicesDir = __DIR__ . '/../invoices';
    
    // Create invoices directory if not exists
    if (!is_dir($invoicesDir)) {
        mkdir($invoicesDir, 0755, true);
    }
    
    // Generate invoice number from order ID and date
    $invoiceNumber = date('Y') . '/' . str_replace('ORD-', '', $order['orderId']);
    $outputPath = $invoicesDir . '/invoice_' . $order['orderId'] . '.pdf';
    
    // Prepare customer data
    $customer = $order['customer'];
    $customerName = $customer['name'] ?? '';
    $customerEmail = $customer['email'] ?? '';
    
    // Build customer address
    $addressParts = [];
    $custAddr = $customer['address'] ?? null;
    if (is_array($custAddr)) {
        if (!empty($custAddr['street'])) $addressParts[] = $custAddr['street'];
        if (!empty($custAddr['city'])) $addressParts[] = $custAddr['city'];
        if (!empty($custAddr['zip'])) $addressParts[] = $custAddr['zip'];
        if (!empty($custAddr['country'])) $addressParts[] = $custAddr['country'];
    } else {
        if (!empty($customer['street'])) $addressParts[] = $customer['street'];
        if (!empty($customer['city'])) $addressParts[] = $customer['city'];
        if (!empty($customer['zip'])) $addressParts[] = $customer['zip'];
        if (!empty($customer['country'])) $addressParts[] = $customer['country'];
    }
    
    // If shipping to Zásilkovna pickup point, use that address
    if (!empty($order['shipping']['pickupPoint'])) {
        $pp = $order['shipping']['pickupPoint'];
        $addressParts = [
            $pp['name'] ?? '',
            ($pp['street'] ?? '') . ', ' . ($pp['city'] ?? ''),
            $pp['zip'] ?? ''
        ];
    }
    
    $customerAddress = implode("\n", array_filter($addressParts));
    
    // Prepare items JSON
    $items = [];
    if (!empty($order['items']) && is_array($order['items'])) {
        foreach ($order['items'] as $item) {
            $items[] = [
                'name' => $item['name'] ?? $item['title'] ?? 'Unknown Item',
                'quantity' => intval($item['quantity'] ?? 1),
                'unit_price' => floatval($item['price'] ?? 0),
                'vat_rate' => 0.21
            ];
        }
    } elseif (($order['type'] ?? '') === 'presale' && !empty($order['package']['priceEur'])) {
        // Presale fallback: vytvořit jednu položku dle balíčku, bez DPH (0%) v EUR
        $pkgName = 'ZION Presale - ' . ($order['package']['name'] ?? 'Balíček');
        $items[] = [
            'name' => $pkgName,
            'quantity' => 1,
            'unit_price' => floatval($order['package']['priceEur']),
            'vat_rate' => 0.0
        ];
    } else {
        return ['success' => false, 'error' => 'No items provided'];
    }
    
    // Add shipping as item if applicable
    if (!empty($order['shipping']['price']) && $order['shipping']['price'] > 0) {
        $shippingName = 'Doprava: ' . ($order['shipping']['method'] ?? 'Zásilkovna');
        $items[] = [
            'name' => $shippingName,
            'quantity' => 1,
            'unit_price' => floatval($order['shipping']['price']),
            'vat_rate' => 0.21
        ];
    }
    
    $itemsJson = json_encode($items, JSON_UNESCAPED_UNICODE);
    
    // Dates
    $issueDate = date('Y-m-d');
    $dueDate = date('Y-m-d', strtotime('+14 days'));

    // Currency: presale v EUR, eShop v CZK (Kč)
    $isPresale = (($order['type'] ?? '') === 'presale');
    $currency = $isPresale ? 'EUR' : 'CZK';
    // Exchange rate for dual display (optional)
    $exchangeRate = 25.0; // default fallback
    if (defined('EXCHANGE_RATE_EUR_CZK')) {
        $exchangeRate = floatval(EXCHANGE_RATE_EUR_CZK);
    }
    
    // Payment method (avoid match for compatibility)
    $payment = $order['payment'] ?? [];
    $pmRaw = is_array($payment) ? ($payment['method'] ?? 'bank_transfer') : (string)$payment;
    $pm = strtolower($pmRaw);
    if (in_array($pm, ['bank_transfer', 'bank', 'prevod'])) {
        $paymentMethod = 'Bankovní převod';
    } elseif (in_array($pm, ['card', 'karta'])) {
        $paymentMethod = 'Platební karta';
    } elseif (in_array($pm, ['cash', 'hotovost'])) {
        $paymentMethod = 'Hotově';
    } elseif (in_array($pm, ['crypto', 'bitcoin'])) {
        $paymentMethod = 'Kryptoměny';
    } else {
        $paymentMethod = 'Bankovní převod';
    }
    
    // Variable symbol = extract numeric timestamp from orderId
    // PRESALE-1767340840-81b95d → 1767340840
    // ORD-1767340840 → 1767340840
    if (preg_match('/(\d{10})/', $order['orderId'], $vsMatch)) {
        $variableSymbol = $vsMatch[1];
    } else {
        $variableSymbol = preg_replace('/[^0-9]/', '', $order['orderId']);
    }
    
    // Build CLI args for bridge (no shell)
    $cliArgs = [
        '--invoice-number' => $invoiceNumber,
        '--order-id' => $order['orderId'],
        '--issue-date' => $issueDate,
        '--due-date' => $dueDate,
        '--customer-name' => $customerName,
        '--customer-email' => $customerEmail,
        '--customer-address' => $customerAddress,
        '--items' => $itemsJson,
        '--payment-method' => $paymentMethod,
        '--variable-symbol' => $variableSymbol,
        '--output-path' => $outputPath,
        '--currency' => $currency,
        '--exchange-rate' => strval($exchangeRate),
        '--dual-currency' => $isPresale ? '1' : '0'
    ];

    // Explicitní logo path (bypass autodetekce v Pythonu)
    // Primárně použij cestu relativní k tomuto souboru: ../img/logo144.png
    $logoPath = realpath(__DIR__ . '/../img/logo144.png');
    if ($logoPath === false || !file_exists($logoPath)) {
        // Možné absolutní cesty na hostingu (fallbacky)
        $fallbacks = [
            '/home/html/newearth.cz/public_html/V2/img/logo144.png',
            '/home/html/newearth.cz/public_html/images/logo144.png',
        ];
        foreach ($fallbacks as $fb) {
            if (file_exists($fb)) {
                $logoPath = $fb;
                break;
            }
        }
    }
    if ($logoPath && file_exists($logoPath)) {
        $cliArgs['--logo-path'] = $logoPath;
    }
    
    // Add IČO/DIČ if present
    if (!empty($customer['ico'])) {
        $cliArgs['--customer-ico'] = $customer['ico'];
    }
    if (!empty($customer['dic'])) {
        $cliArgs['--customer-dic'] = $customer['dic'];
    }

    // Execute Python script via bridge (bypass shell)
    $pythonPath = '/usr/bin/python3';
    $result = runPythonScriptWithCLI($pythonPath, $pythonScript, $cliArgs);
    
    // Debug log
    $debugLog = __DIR__ . '/../logs/invoice-generation-debug.log';
    $debugData = date('Y-m-d H:i:s') . " - Order: {$order['orderId']}\n";
    $debugData .= "Exit Code: " . ($result['exit_code'] ?? 'NULL') . "\n";
    $debugData .= "STDOUT: " . ($result['stdout'] ?? 'NULL') . "\n";
    $debugData .= "STDERR: " . ($result['stderr'] ?? 'NULL') . "\n";
    if (!empty($cliArgs['--logo-path'])) {
        $debugData .= "LOGO: " . $cliArgs['--logo-path'] . "\n";
    } else {
        $debugData .= "LOGO: (auto)\n";
    }
    $debugData .= str_repeat('-', 80) . "\n";
    file_put_contents($debugLog, $debugData, FILE_APPEND);
    
    if (($result['exit_code'] ?? 1) === 0) {
        // Try to parse JSON output from stdout
        $outputStr = trim($result['stdout'] ?? '');
        $parsed = json_decode($outputStr, true);
        
        if ($parsed && isset($parsed['success']) && $parsed['success']) {
            return [
                'success' => true,
                'output_path' => $parsed['output_path'],
                'invoice_number' => $parsed['invoice_number'],
                'total' => $parsed['total'] ?? 0,
                'total_formatted' => $parsed['total_formatted'] ?? '',
                'path' => $parsed['output_path'] // Alias pro kompatibilitu
            ];
        }
    }
    
    // Error occurred
    $errorOutput = trim(($result['stdout'] ?? '') . "\n" . ($result['stderr'] ?? ''));
    error_log("Invoice generation failed for order {$order['orderId']}: {$errorOutput}");
    
    return [
        'success' => false,
        'error' => 'Failed to generate invoice',
        'output' => $errorOutput,
        'exit_code' => $result['exit_code'] ?? -1,
        'args' => $cliArgs
    ];
}

/**
 * Get invoice URL for email attachment or download
 *
 * @param string $invoicePath Full filesystem path to invoice PDF
 * @return string Public URL to invoice
 */
function getInvoiceUrl(string $invoicePath): string
{
    // Convert filesystem path to URL
    // /path/to/public_html/V2/invoices/invoice_XXX.pdf -> /V2/invoices/invoice_XXX.pdf
    $relativePath = str_replace(
        dirname(__DIR__, 1),
        '',
        $invoicePath
    );
    
    return 'https://newearth.cz' . $relativePath;
}
