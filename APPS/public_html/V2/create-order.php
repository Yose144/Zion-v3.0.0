<?php
/**
 * ZION eShop - Vytvoření objednávky
 * Přijímá JSON data a odesílá email + ukládá do souboru
 * Generuje fakturu a přikládá ji k emailu
 */

// config.php může být na serveru (často mimo git); načti jen pokud existuje
if (file_exists(__DIR__ . '/api/config.php')) {
    require_once __DIR__ . '/api/config.php';
}

require_once __DIR__ . '/api/wallet-lib.php';
require_once __DIR__ . '/api/invoice-generator.php';
require_once __DIR__ . '/email-templates/order-confirmation.php';
require_once __DIR__ . '/smtp-mailer.php';
require_once __DIR__ . '/send-rasta-email.php';
require_once __DIR__ . '/generate-invoice.php';

function logMailEvent(string $channel, string $recipient, bool $result, array $extra = []): void
{
    try {
        $logDir = __DIR__ . '/../logs';
        if (!is_dir($logDir)) {
            mkdir($logDir, 0755, true);
        }

        $logFile = $logDir . '/order-mail.log';
        $timestamp = date('Y-m-d H:i:s');
        $payload = [
            'channel' => $channel,
            'recipient' => $recipient,
            'result' => $result ? 'success' : 'failure',
            'orderId' => $extra['orderId'] ?? null,
            'headers' => $extra['headers'] ?? null,
            'error' => $result ? null : ($extra['error'] ?? error_get_last())
        ];

        $line = sprintf('[%s] %s %s %s %s%s%s',
            $timestamp,
            strtoupper($channel),
            $payload['result'],
            $payload['orderId'] ?? '-',
            $recipient,
            $payload['error'] ? ' | error=' . json_encode($payload['error'], JSON_UNESCAPED_UNICODE) : '',
            PHP_EOL
        );

        file_put_contents($logFile, $line, FILE_APPEND | LOCK_EX);
    } catch (Throwable $logError) {
        error_log('Mail log failed: ' . $logError->getMessage());
    }
}

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

// Pouze POST metoda
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// Přečíst JSON data
$json = file_get_contents('php://input');
$order = json_decode($json, true);

if (!$order) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON data']);
    exit;
}

// Validace povinných polí
$required = ['orderId', 'items', 'customer', 'shipping', 'payment', 'total'];
foreach ($required as $field) {
    if (empty($order[$field])) {
        http_response_code(400);
        echo json_encode(['error' => "Missing required field: $field"]);
        exit;
    }
}

// === ULOŽENÍ OBJEDNÁVKY DO SOUBORU ===
$ordersDir = __DIR__ . '/../orders';
if (!is_dir($ordersDir)) {
    mkdir($ordersDir, 0755, true);
}

$orderFile = $ordersDir . '/' . $order['orderId'] . '.json';

// === ZION TOKEN BONUS & WALLET ===
$tokenSummary = calculateTokenSummary($order['items']);
$zionWalletPayload = null;
$ledgerEntry = null;
$network = $order['network'] ?? 'testnet';

if ($tokenSummary['totalTokens'] > 0) {
    try {
        $zionWalletPayload = zion_generate_wallet([
            'label' => 'ZION order ' . $order['orderId'],
            'tokens' => $tokenSummary['totalTokens'],
            'orderId' => $order['orderId']
        ]);
    } catch (Throwable $walletError) {
        error_log('ZION wallet generation failed: ' . $walletError->getMessage());
    }
}

if ($zionWalletPayload) {
    $order['zion'] = [
        'tokens' => $tokenSummary,
        'wallet' => $zionWalletPayload['wallet'],
        'qr' => $zionWalletPayload['qr'],
        'storage' => $zionWalletPayload['storage'],
        'network' => $network
    ];
} else {
    $order['zion'] = [
        'tokens' => $tokenSummary,
        'wallet' => null,
        'qr' => null,
        'storage' => null,
        'network' => $network
    ];
}

if ($tokenSummary['totalTokens'] > 0) {
    try {
        $ledgerEntry = zion_wallet_append_ledger_entry([
            'orderId' => $order['orderId'],
            'walletId' => $zionWalletPayload['wallet']['id'] ?? null,
            'walletUri' => $zionWalletPayload['wallet']['uri'] ?? null,
            'qrImage' => $zionWalletPayload['qr']['imageFile'] ?? null,
            'tokens' => $tokenSummary['totalTokens'],
            'details' => $tokenSummary,
            'network' => $network,
            'status' => $zionWalletPayload ? 'pending' : 'failed',
            'historyNote' => 'Created from order #' . $order['orderId']
        ]);

        $order['zion']['ledger'] = $ledgerEntry;
    } catch (Throwable $ledgerError) {
        error_log('Ledger append failed: ' . $ledgerError->getMessage());
    }
}

file_put_contents($orderFile, json_encode($order, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

// === FAKTURA (HTML + PDF best-effort) ===
$invoiceMeta = [
    'generatedAt' => date('c'),
    'html' => null,
    'pdf' => null,
];

try {
    $invoiceGenerator = new InvoiceGenerator();
    $invoiceHtmlResult = $invoiceGenerator->generateInvoice($order);
    $invoiceMeta['html'] = [
        'number' => $invoiceHtmlResult['number'] ?? null,
        'htmlFile' => $invoiceHtmlResult['htmlFile'] ?? null,
        'jsonFile' => $invoiceHtmlResult['jsonFile'] ?? null,
    ];
} catch (Throwable $invoiceHtmlError) {
    error_log('Invoice HTML generation failed: ' . $invoiceHtmlError->getMessage());
}

$pdfOnCreateRaw = defined('INVOICE_PDF_ON_CREATE') ? INVOICE_PDF_ON_CREATE : (getenv('INVOICE_PDF_ON_CREATE') ?: '0');
$pdfOnCreate = in_array(strtolower((string)$pdfOnCreateRaw), ['1', 'true', 'yes', 'on'], true);

if ($pdfOnCreate) {
    try {
        $invoicePdfResult = generateInvoice($order);
        if (!empty($invoicePdfResult['success'])) {
            $invoicePath = $invoicePdfResult['path'] ?? $invoicePdfResult['output_path'] ?? null;
            $invoiceMeta['pdf'] = [
                'path' => $invoicePath,
                'url' => $invoicePath ? getInvoiceUrl($invoicePath) : null,
                'invoice_number' => $invoicePdfResult['invoice_number'] ?? null,
                'total_formatted' => $invoicePdfResult['total_formatted'] ?? null,
            ];
        } else {
            $invoiceMeta['pdf'] = [
                'error' => $invoicePdfResult['error'] ?? 'Failed to generate invoice PDF',
            ];
        }
    } catch (Throwable $invoicePdfError) {
        error_log('Invoice PDF generation failed: ' . $invoicePdfError->getMessage());
        $invoiceMeta['pdf'] = [
            'error' => $invoicePdfError->getMessage(),
        ];
    }
} else {
    $invoiceMeta['pdf'] = [
        'skipped' => true,
        'reason' => 'INVOICE_PDF_ON_CREATE disabled (generate via admin endpoint)'
    ];
}

$order['invoice'] = $invoiceMeta;
// zapiš znovu – aby v JSON byla reference na fakturu
file_put_contents($orderFile, json_encode($order, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

// === SESTAVENÍ EMAILU ===
$customerEmail = $order['customer']['email'];
$customerName = $order['customer']['name'];
$customerPhone = $order['customer']['phone'];

// Email pro admina
$adminEmail = (defined('ADMIN_EMAIL') ? ADMIN_EMAIL : (getenv('ADMIN_EMAIL') ?: 'admin@newearth.cz'));
$shopEmail = (defined('SHOP_EMAIL') ? SHOP_EMAIL : (getenv('SHOP_EMAIL') ?: 'shop@newearth.cz'));

// Položky objednávky
$itemsList = '';
foreach ($order['items'] as $item) {
    $itemsList .= "- {$item['name']} (x{$item['quantity']}) - " . ($item['price'] * $item['quantity']) . " Kč\n";
}

// Doprava
$shippingMethod = $order['shipping']['method'];
$shippingPrice = $order['shipping']['price'];
$shippingInfo = "Doprava: $shippingMethod ($shippingPrice Kč)\n";

if ($order['shipping']['pickupPoint']) {
    $pp = $order['shipping']['pickupPoint'];
    $shippingInfo .= "Výdejní místo: {$pp['name']}, {$pp['street']}, {$pp['city']}\n";
}

if ($order['customer']['address']) {
    $addr = $order['customer']['address'];
    $shippingInfo .= "Doručovací adresa: {$addr['street']}, {$addr['city']}, {$addr['zip']}\n";
}

// Platba
$paymentMethod = $order['payment'];
if ($paymentMethod === 'card') {
    $paymentInfo = 'Platba kartou (Stripe)';
} elseif ($paymentMethod === 'transfer') {
    $paymentInfo = 'Bankovní převod';
} elseif ($paymentMethod === 'cash') {
    $paymentInfo = 'Dobírka / Hotově';
} else {
    $paymentInfo = $paymentMethod;
}

$walletSection = formatWalletEmailSection($tokenSummary, $zionWalletPayload, 'cs');

$invoiceHtmlNumber = $order['invoice']['html']['number'] ?? null;
$invoiceHtmlFile = $order['invoice']['html']['htmlFile'] ?? null;
$invoicePdfUrl = $order['invoice']['pdf']['url'] ?? null;
$invoicePdfPath = $order['invoice']['pdf']['path'] ?? null;

$invoiceAdminInfo = "Faktura:\n";
$invoiceAdminInfo .= "- HTML: " . ($invoiceHtmlNumber ? ($invoiceHtmlNumber . ($invoiceHtmlFile ? " (" . $invoiceHtmlFile . ")" : '')) : 'n/a') . "\n";
$invoiceAdminInfo .= "- PDF: " . ($invoicePdfUrl ?: ($invoicePdfPath ?: 'n/a')) . "\n";

// === EMAIL PRO ADMINA ===
$orderDate = isset($order['createdAt']) ? $order['createdAt'] : date('c');
$orderNote = isset($order['note']) ? $order['note'] : '';
$adminSubject = "🛒 Nová objednávka #{$order['orderId']}";
$adminBody = <<<EMAIL
========================================
NOVÁ OBJEDNÁVKA - ZION eShop
========================================

Číslo objednávky: {$order['orderId']}
Datum: {$orderDate}

----------------------------------------
ZÁKAZNÍK
----------------------------------------
Jméno: $customerName
Email: $customerEmail
Telefon: $customerPhone

----------------------------------------
POLOŽKY
----------------------------------------
$itemsList

----------------------------------------
DOPRAVA
----------------------------------------
$shippingInfo

----------------------------------------
PLATBA
----------------------------------------
Způsob: $paymentInfo
Variabilní symbol: {$order['orderId']}

$walletSection

----------------------------------------
CELKEM: {$order['total']} Kč
----------------------------------------

Poznámka: {$orderNote}

{$invoiceAdminInfo}

========================================
EMAIL;

// === EMAIL PRO ZÁKAZNÍKA ===
$customerSubject = "Potvrzení objednávky #{$order['orderId']} - ZION eShop";
$customerBody = <<<EMAIL
Dobrý den, $customerName!

Děkujeme za Vaši objednávku v ZION eShop.

========================================
OBJEDNÁVKA #{$order['orderId']}
========================================

$itemsList

Doprava: $shippingMethod - $shippingPrice Kč
----------------------------------------
CELKEM: {$order['total']} Kč

----------------------------------------
PLATBA
----------------------------------------
Způsob platby: $paymentInfo

$walletSection

EMAIL;

if ($paymentMethod === 'transfer') {
    $customerBody .= <<<EMAIL

Platební údaje:
Příjemce: Omnity.One s.r.o.
Banka: Fio banka, a.s.
Číslo účtu: 2901809148 / 2010
IBAN: CZ63 2010 0000 0029 0180 9148
SWIFT: FIOBCZPPXXX
Variabilní symbol: {$order['orderId']}
Částka: {$order['total']} Kč

Po připsání platby Vám zboží obratem odešleme.

EMAIL;
}

$customerBody .= <<<EMAIL

----------------------------------------

O průběhu objednávky Vás budeme informovat emailem.

S pozdravem,
Tým ZION Terra Nova

www.newearth.cz
----------------------------------------
EMAIL;

// === ODESLÁNÍ EMAILŮ ===
$headers = "From: {$shopEmail}\r\n";
$headers .= "Reply-To: {$shopEmail}\r\n";
$headers .= "Return-Path: {$shopEmail}\r\n";
$headers .= "Content-Type: text/plain; charset=UTF-8\r\n";

// Email adminovi
$adminSent = sendmail($adminEmail, $adminSubject, $adminBody, $headers);
logMailEvent('admin', $adminEmail, $adminSent, [
    'orderId' => $order['orderId'],
    'headers' => $headers
]);

// === EMAIL ZÁKAZNÍKOVI - POUZE POTVRZENÍ (BEZ FAKTURY) ===
// Pokud je povoleno INVOICE_PDF_ON_CREATE a PDF existuje, přiloží se rovnou.
$invoiceAttachmentPath = null;
if (!empty($order['invoice']['pdf']['path']) && is_string($order['invoice']['pdf']['path'])) {
    $candidate = $order['invoice']['pdf']['path'];
    if (file_exists($candidate)) {
        $invoiceAttachmentPath = $candidate;
    }
}

$rastaEmailResult = sendRastaOrderEmail($order, $customerEmail, null, $invoiceAttachmentPath);
$customerSent = $rastaEmailResult['success'];

// Log Rasta email (potvrzení objednávky BEZ faktury)
logMailEvent('customer_rasta', $customerEmail, $customerSent, [
    'orderId' => $order['orderId'],
    'output' => $rastaEmailResult['output'] ?? '',
    'method' => 'python_rasta',
    'invoice_attached' => $invoiceAttachmentPath ? 'yes' : 'no'
]);

// Fallback na starou HTML šablonu, pokud Rasta email selže
if (!$customerSent) {
    error_log("Rasta email failed for order {$order['orderId']}, falling back to old template");
    
    $customerHtmlEmail = getOrderConfirmationEmail($order);
    $customerHtmlHeaders = "From: ZION eShop <{$shopEmail}>\r\n";
    $customerHtmlHeaders .= "Reply-To: {$shopEmail}\r\n";
    $customerHtmlHeaders .= "Return-Path: {$shopEmail}\r\n";
    $customerHtmlHeaders .= "MIME-Version: 1.0\r\n";
    $customerHtmlHeaders .= "Content-Type: text/html; charset=UTF-8\r\n";

    $customerSent = sendmail($customerEmail, $customerSubject, $customerHtmlEmail, $customerHtmlHeaders);
    logMailEvent('customer_fallback', $customerEmail, $customerSent, [
        'orderId' => $order['orderId'],
        'headers' => $customerHtmlHeaders
    ]);
}

// === ODPOVĚĎ ===
echo json_encode([
    'success' => true,
    'orderId' => $order['orderId'],
    'message' => 'Objednávka byla úspěšně vytvořena',
    'emailSent' => [
        'admin' => $adminSent,
        'customer' => $customerSent
    ],
    'zion' => $order['zion']
]);

// === Pomocné funkce ===
function calculateTokenSummary(array $items): array
{
    $total = 0;
    $details = [];

    foreach ($items as $item) {
        $quantity = max(1, (int)($item['quantity'] ?? 1));
        $unitTokens = isset($item['tokens'])
            ? max(0, (int)$item['tokens'])
            : estimateTokensFromPrice($item);

        $lineTokens = $unitTokens * $quantity;
        $total += $lineTokens;

        $details[] = [
            'id' => $item['id'] ?? null,
            'name' => $item['name'] ?? '',
            'quantity' => $quantity,
            'perUnit' => $unitTokens,
            'total' => $lineTokens
        ];
    }

    return [
        'totalTokens' => $total,
        'items' => $details
    ];
}

function estimateTokensFromPrice(array $item): int
{
    $price = (int)($item['price'] ?? 0);
    if ($price <= 0) {
        return 0;
    }
    return max(1, (int)round($price / 100));
}

function formatWalletEmailSection(array $tokenSummary, ?array $walletPayload, string $locale = 'cs'): string
{
    if (($tokenSummary['totalTokens'] ?? 0) <= 0) {
        return '';
    }

    $title = $locale === 'en' ? 'ZION TOKEN BONUS' : 'ZION TOKEN BONUS';
    $lines = [
        '----------------------------------------',
        $title,
        '----------------------------------------',
        sprintf('Celkem: %d ZION', $tokenSummary['totalTokens'])
    ];

    if ($walletPayload) {
        $wallet = $walletPayload['wallet'];
        $qr = $walletPayload['qr'];
        $publicUrl = zion_guess_wallet_public_url($qr['imageFile'] ?? null);

        $lines[] = 'Wallet ID: ' . ($wallet['id'] ?? '');
        $lines[] = 'Wallet URI: ' . ($wallet['uri'] ?? '');
        if (!empty($qr['serviceUrl'])) {
            $lines[] = 'QR online: ' . $qr['serviceUrl'];
        }
        if ($publicUrl) {
            $lines[] = 'QR soubor: ' . $publicUrl;
        }
    }

    return "\n" . implode("\n", $lines) . "\n";
}

function zion_guess_wallet_public_url(?string $filename): ?string
{
    if (!$filename) {
        return null;
    }

    $base = '';
    if (!empty($_SERVER['HTTP_HOST'])) {
        $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
        $base = $scheme . '://' . $_SERVER['HTTP_HOST'];
    }

    $path = '/V2/wallets/' . ltrim($filename, '/');
    return $base ? $base . $path : $path;
}
