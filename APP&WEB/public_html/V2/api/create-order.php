<?php
/**
 * Create Order API Endpoint
 * Handles order submission from checkout, creates wallet, sends emails
 */

// Define security constant for config.php
define('PRESALE_API', true);

// Načti .env (pokud existuje)
require_once __DIR__ . '/env-loader.php';

// Include dependencies (config.php optional)
if (file_exists(__DIR__ . '/config.php')) {
    require_once __DIR__ . '/config.php';
}

// CORS headers
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

// Wallet library V3 (real blockchain wallets with pool fallback)
require_once __DIR__ . '/url-helper.php';
require_once __DIR__ . '/wallet-lib-v3.php';
require_once __DIR__ . '/invoice-generator.php';
require_once __DIR__ . '/email-templates/order-confirmation.php';
require_once __DIR__ . '/smtp-mailer.php';

// Wrapper funkce pro kompatibilitu
if (!function_exists('sendmail')) {
    function sendmail($to, $subject, $body, $headers = '') {
        $isHtml = false;

        if (is_string($headers) && stripos($headers, 'Content-Type: text/html') !== false) {
            $isHtml = true;
        }

        if (!$isHtml && is_string($body)) {
            // Heuristics: if the body looks like HTML, send as HTML.
            if (preg_match('/<\s*!DOCTYPE\s+html/i', $body) || preg_match('/<\s*html\b/i', $body)) {
                $isHtml = true;
            }
        }

        return sendEmailViaSMTP($to, $subject, $body, ['isHTML' => $isHtml]);
    }
}
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

// === ZION TOKEN BONUS & REAL WALLET (v3 with pool fallback) ===
$tokenSummary = calculateTokenSummary($order['items']);
$zionWalletPayload = null;
$network = $order['network'] ?? 'mainnet';

// Detect presale items (when presale is purchased via cart/checkout)
$isPresaleOrder = false;
foreach (($order['items'] ?? []) as $it) {
    $cat = strtolower((string)($it['category'] ?? ''));
    $id = strtolower((string)($it['id'] ?? ''));
    if ($cat === 'presale' || strpos($id, 'presale-') === 0) {
        $isPresaleOrder = true;
        break;
    }
}

// Persist order type for admin/distribution tooling.
$order['type'] = $isPresaleOrder ? 'presale' : 'eshop';

$ledgerEntry = null;

if ($tokenSummary['totalTokens'] > 0) {
    // Generate REAL wallet using V3 system (API or pool fallback)
    $customerEmail = $order['customer']['email'] ?? '';
    $customerName = $order['customer']['name'] ?? '';
    
    if ($customerEmail) {
        try {
            // Use same wallet generation as presale (wallet-lib-v3.php)
            $walletResult = zion_generate_wallet([
                'orderId' => $order['orderId'],
                'tokens' => $tokenSummary['totalTokens'],
                'customerEmail' => $customerEmail,
                'customerName' => $customerName ?: 'eShop Customer',
                'network' => $network,
                'label' => ($isPresaleOrder ? 'Presale Order ' : 'eShop Order ') . $order['orderId']
            ]);
            
            $zionWalletPayload = [
                'success' => true,
                'wallet_id' => $walletResult['wallet']['id'] ?? null,
                'address' => $walletResult['wallet']['address'] ?? null,
                'mnemonic' => $walletResult['wallet']['mnemonic'] ?? null,
                'public_key' => $walletResult['wallet']['publicKey'] ?? null,
                'private_key' => null, // Private key not exposed for security
                'qr_image' => $walletResult['qr']['imageFile'] ?? null,
                'uri' => $walletResult['wallet']['uri'] ?? null
            ];
            
            error_log("✅ Real wallet created: {$zionWalletPayload['wallet_id']} for order {$order['orderId']}");
            
            // Record in ledger
            $ledgerEntry = zion_wallet_append_ledger_entry([
                'orderId' => $order['orderId'],
                'walletId' => $zionWalletPayload['wallet_id'],
                'walletUri' => $zionWalletPayload['uri'],
                'walletAddress' => $zionWalletPayload['address'] ?? null,
                'source' => $isPresaleOrder ? 'presale' : 'eshop',
                'tokens' => $tokenSummary['totalTokens'],
                'status' => 'pending',
                'network' => $network,
                'historyNote' => $isPresaleOrder ? 'Created from Presale order (cart)' : 'Created from eShop order'
            ]);
            
        } catch (Exception $e) {
            error_log("⚠️ Wallet creation failed: " . $e->getMessage());
            $zionWalletPayload = null;
        }
    }
}

// Store in order
if ($zionWalletPayload && !empty($zionWalletPayload['success'])) {
    $order['zion'] = [
        'tokens' => $tokenSummary,
        'wallet' => [
            'id' => $zionWalletPayload['wallet_id'] ?? null,
            'address' => $zionWalletPayload['address'] ?? null,
            'mnemonic' => $zionWalletPayload['mnemonic'] ?? null,
            'publicKey' => $zionWalletPayload['public_key'] ?? null,
            'uri' => $zionWalletPayload['uri'] ?? null,
            'network' => $network
        ],
        'ledger' => $ledgerEntry ? [
            'id' => $ledgerEntry['id'] ?? null,
            'status' => $ledgerEntry['status'] ?? null,
            'source' => $ledgerEntry['source'] ?? null,
            'network' => $ledgerEntry['network'] ?? null
        ] : null,
        'qr' => [
            'imageFile' => $zionWalletPayload['qr_image'] ?? null,
            'serviceUrl' => !empty($zionWalletPayload['qr_image'])
                ? zion_wallet_public_url($zionWalletPayload['qr_image'])
                : null
        ]
    ];
} else {
    $order['zion'] = [
        'tokens' => $tokenSummary,
        'wallet' => null,
        'ledger' => null,
        'qr' => null,
        'warning' => 'Wallet generation failed - will retry on MainNet'
    ];
}

file_put_contents($orderFile, json_encode($order, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

// === DOWNLOAD TOKEN pro digitální produkty (knihy) ===
$hasDigitalContent = false;
foreach (($order['items'] ?? []) as $it) {
    $cat = strtolower((string)($it['category'] ?? ''));
    $id = strtolower((string)($it['id'] ?? ''));
    if ($cat === 'books' || strpos($id, 'book-') === 0) {
        $hasDigitalContent = true;
        break;
    }
}

if ($hasDigitalContent) {
    $tokenSecret = getenv('DOWNLOAD_TOKEN_SECRET') ?: 'ZION_DOWNLOAD_2025_newearth';
    $order['downloadToken'] = hash('sha256', $order['orderId'] . $tokenSecret);
    // Re-save with download token
    file_put_contents($orderFile, json_encode($order, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

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

$orderCurrency = strtoupper((string)($order['currency'] ?? 'CZK'));
if (!in_array($orderCurrency, ['CZK', 'EUR'], true)) {
    $orderCurrency = 'CZK';
}

$money = function($amount) use ($orderCurrency): string {
    $value = is_numeric($amount) ? (float)$amount : 0.0;
    $isIntLike = abs($value - round($value)) < 0.00001;
    if ($orderCurrency === 'EUR') {
        $decimals = $isIntLike ? 0 : 2;
        return '€' . number_format($value, $decimals, '.', ',');
    }
    return number_format($value, 0, '', ' ') . ' Kč';
};

// Email pro admina
$adminEmail = (defined('ADMIN_EMAIL') ? ADMIN_EMAIL : (getenv('ADMIN_EMAIL') ?: 'admin@newearth.cz'));
$shopEmail = (defined('SHOP_EMAIL') ? SHOP_EMAIL : (getenv('SHOP_EMAIL') ?: 'shop@newearth.cz'));

// Položky objednávky
$itemsList = '';
foreach ($order['items'] as $item) {
    $lineTotal = ($item['price'] ?? 0) * ($item['quantity'] ?? 1);
    $itemsList .= "- {$item['name']} (x{$item['quantity']}) - " . $money($lineTotal) . "\n";
}

// Doprava
$shippingMethod = $order['shipping']['method'];
$shippingPrice = $order['shipping']['price'];
$shippingPriceFormatted = $money($shippingPrice);
$orderTotalFormatted = $money($order['total'] ?? 0);
$shippingInfo = "Doprava: $shippingMethod ($shippingPriceFormatted)\n";

$pickupPoint = $order['shipping']['pickupPoint'] ?? null;
if (!empty($pickupPoint) && is_array($pickupPoint)) {
    $pp = $pickupPoint;
    $ppName = $pp['name'] ?? '';
    $ppStreet = $pp['street'] ?? '';
    $ppCity = $pp['city'] ?? '';
    $shippingInfo .= "Výdejní místo: $ppName" . ($ppStreet ? ", $ppStreet" : "") . ($ppCity ? ", $ppCity" : "") . "\n";
}

$customerAddress = $order['customer']['address'] ?? null;
if (!empty($customerAddress) && is_array($customerAddress)) {
    $addr = $customerAddress;
    $addrStreet = $addr['street'] ?? '';
    $addrCity = $addr['city'] ?? '';
    $addrZip = $addr['zip'] ?? '';
    $shippingInfo .= "Doručovací adresa: $addrStreet, $addrCity, $addrZip\n";
}

// Platba
$paymentMethodData = $order['payment'] ?? 'transfer';
$paymentMethod = is_array($paymentMethodData) ? ($paymentMethodData['method'] ?? 'transfer') : (string)$paymentMethodData;

if ($paymentMethod === 'card' || $paymentMethod === 'stripe') {
    $paymentInfo = 'Platba kartou (Stripe)';
} elseif ($paymentMethod === 'transfer' || $paymentMethod === 'bank_transfer') {
    $paymentInfo = 'Bankovní převod';
} elseif ($paymentMethod === 'cash' || $paymentMethod === 'cod') {
    $paymentInfo = 'Dobírka / Hotově';
} else {
    $paymentInfo = $paymentMethod;
}

// Pass structured $order['zion'] (with 'wallet' and 'qr' keys), not raw $zionWalletPayload
$walletSection = formatWalletEmailSection($tokenSummary, $order['zion'] ?? null, 'cs');

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
CELKEM: {$orderTotalFormatted}
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

Doprava: $shippingMethod - $shippingPriceFormatted
----------------------------------------
CELKEM: {$orderTotalFormatted}

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
Částka: {$orderTotalFormatted}

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
    // ZION Token Bonus: 1:1 ratio (1 Kč = 1 ZION token)
    $price = (int)($item['price'] ?? 0);
    if ($price <= 0) {
        return 0;
    }
    return $price;  // 1:1 ratio
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
        $wallet = $walletPayload['wallet'] ?? null;
        $qr = $walletPayload['qr'] ?? null;
        
        if ($wallet) {
            $publicUrl = zion_guess_wallet_public_url($qr['imageFile'] ?? null);

            $lines[] = 'Wallet ID: ' . ($wallet['id'] ?? '');
            $lines[] = 'Wallet Address: ' . ($wallet['address'] ?? '');
            if (!empty($qr['serviceUrl'])) {
                $lines[] = 'QR online: ' . $qr['serviceUrl'];
            }
            if ($publicUrl) {
                $lines[] = 'QR soubor: ' . $publicUrl;
            }
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
