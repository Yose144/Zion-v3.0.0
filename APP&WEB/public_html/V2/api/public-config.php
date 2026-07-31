<?php
/**
 * ZION eShop - Veřejná konfigurace
 * Vrací pouze veřejně dostupné hodnoty (nikdy secret keys!)
 */

// Načti .env (pokud existuje) + volitelný config.php (na serveru)
require_once __DIR__ . '/env-loader.php';

// config.php může být mimo git / nasazovaný separátně
if (file_exists(__DIR__ . '/config.php')) {
    require_once __DIR__ . '/config.php';
}

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

// Pouze GET metoda
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// Veřejná konfigurace - POUZE veřejné klíče!
$publicConfig = [
    // Zásilkovna
    'zasilkovna' => [
        'apiKey' => defined('ZASILKOVNA_API_KEY') ? ZASILKOVNA_API_KEY : null,
        'country' => 'cz',
        'language' => 'cs',
        'locale' => defined('ZASILKOVNA_API_LOCALE') ? ZASILKOVNA_API_LOCALE : 'cs_CZ'
    ],
    
    // Stripe (pouze publishable key!)
    'stripe' => [
        'publishableKey' => defined('STRIPE_PUBLISHABLE_KEY') ? STRIPE_PUBLISHABLE_KEY : null
    ],
    
    // ZION
    'zion' => [
        'network' => defined('ZION_DEFAULT_NETWORK') ? ZION_DEFAULT_NETWORK : 'testnet'
    ],
    
    // Obecné
    'site' => [
        'url' => defined('SITE_URL') ? SITE_URL : 'https://newearth.cz',
        'currency' => 'CZK',
        'locale' => 'cs'
    ]
];

echo json_encode($publicConfig);
