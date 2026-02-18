<?php
/**
 * ZION eShop - Stripe Checkout Session
 * Vytvoří platební session a vrátí URL pro přesměrování
 * 
 * Dokumentace: https://stripe.com/docs/checkout/quickstart
 */

// Načti .env (pokud existuje) + volitelný config.php (na serveru)
require_once __DIR__ . '/env-loader.php';

// config.php může být mimo git / nasazovaný separátně
if (file_exists(__DIR__ . '/config.php')) {
    require_once __DIR__ . '/config.php';
}

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// Ověření Stripe klíče
if (!defined('STRIPE_SECRET_KEY') || STRIPE_SECRET_KEY === 'sk_test_XXXXXXXXXXXXXXXXXXXXXXXX') {
    http_response_code(500);
    echo json_encode(['error' => 'Stripe není nakonfigurován. Nastavte STRIPE_SECRET_KEY v config.php']);
    exit;
}

// Přečíst JSON data
$json = file_get_contents('php://input');
$data = json_decode($json, true);

if (!$data || empty($data['orderId'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Chybí orderId']);
    exit;
}

$orderId = $data['orderId'];
$customerEmail = $data['customerEmail'] ?? null;
$isPresale = isset($data['presale']) && $data['presale'] === true;
$currency = strtolower((string)($data['currency'] ?? 'czk'));
$locale = strtolower((string)($data['locale'] ?? 'cs'));

if (!in_array($currency, ['czk', 'eur'], true)) {
    $currency = 'czk';
}

if (!in_array($locale, ['cs', 'en', 'auto'], true)) {
    $locale = 'cs';
}

// Sestavení line_items pro Stripe
$lineItems = [];

if ($isPresale) {
    $amountEur = $data['amountEur'] ?? $data['priceEur'] ?? null;
    $packageName = $data['packageName'] ?? 'ZION Presale';
    $tokens = isset($data['tokens']) ? (int)$data['tokens'] : null;

    if (!is_numeric($amountEur) || (float)$amountEur <= 0) {
        http_response_code(400);
        echo json_encode(['error' => 'Chybí nebo je neplatná amountEur']);
        exit;
    }

    $unitAmount = (int)round(((float)$amountEur) * 100);
    if ($unitAmount <= 0) {
        http_response_code(400);
        echo json_encode(['error' => 'Neplatná částka']);
        exit;
    }

    $description = $tokens ? (sprintf('%d ZION tokens', $tokens)) : null;
    $lineItems[] = [
        'price_data' => [
            'currency' => 'eur',
            'product_data' => [
                'name' => $packageName,
                'description' => $description,
            ],
            'unit_amount' => $unitAmount,
        ],
        'quantity' => 1,
    ];
} else {
    if (empty($data['items'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Chybí položky objednávky']);
        exit;
    }

    $items = $data['items'];
    $shippingPrice = $data['shippingPrice'] ?? 0;
    $shippingPrice = is_numeric($shippingPrice) ? (float)$shippingPrice : 0.0;

    foreach ($items as $item) {
        $price = $item['price'] ?? 0;
        $price = is_numeric($price) ? (float)$price : 0.0;

        $lineItems[] = [
            'price_data' => [
                'currency' => $currency,
                'product_data' => [
                    'name' => $item['name'],
                    'description' => $item['category'] ?? null,
                ],
                'unit_amount' => (int)round($price * 100), // Stripe používá cents/haléře
            ],
            'quantity' => (int)$item['quantity'],
        ];
    }

    // Přidat dopravu jako položku (pokud není zdarma)
    if ($shippingPrice > 0) {
        $lineItems[] = [
            'price_data' => [
                'currency' => $currency,
                'product_data' => [
                    'name' => 'Doprava',
                ],
                'unit_amount' => (int)round($shippingPrice * 100),
            ],
            'quantity' => 1,
        ];
    }
}

// Stripe API volání
$stripeData = [
    'payment_method_types' => ['card'],
    'line_items' => $lineItems,
    'mode' => 'payment',
    'success_url' => ($data['successUrl'] ?? null) ?: (SITE_URL . '/V2/order-success.html?order=' . $orderId . '&session_id={CHECKOUT_SESSION_ID}'),
    'cancel_url' => ($data['cancelUrl'] ?? null) ?: (SITE_URL . ($currency === 'eur' ? '/V2/cart-en.html?cancelled=1' : '/V2/cart.html?cancelled=1')),
    'metadata' => [
        'order_id' => $orderId,
    ],
    'locale' => $locale,
];

// Přidat presale flag do metadata pro webhook routing
if ($isPresale) {
    $stripeData['metadata']['presale'] = 'true';
    error_log("PRESALE: Order {$orderId} flagged as presale in Stripe metadata");
}

// Přidat e-mail zákazníka, pokud je k dispozici
if ($customerEmail) {
    $stripeData['customer_email'] = $customerEmail;
}

// Volání Stripe API
$ch = curl_init('https://api.stripe.com/v1/checkout/sessions');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => http_build_query($stripeData),
    CURLOPT_HTTPHEADER => [
        'Authorization: Bearer ' . STRIPE_SECRET_KEY,
        'Content-Type: application/x-www-form-urlencoded',
    ],
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

$result = json_decode($response, true);

if ($httpCode !== 200 || !isset($result['url'])) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Stripe API chyba',
        'details' => $result['error']['message'] ?? 'Neznámá chyba'
    ]);
    exit;
}

// Úspěšná odpověď
echo json_encode([
    'success' => true,
    'sessionId' => $result['id'],
    'url' => $result['url']
]);
