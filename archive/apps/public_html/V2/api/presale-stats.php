<?php
/**
 * ZION Presale - Admin Stats API
 * Returns aggregated statistics for admin dashboard
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');

require_once 'auth.php';
if (!isLoggedIn()) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// Load ledger
$ledgerPath = __DIR__ . '/../wallets/ledger.json';
$ledgerData = file_exists($ledgerPath) ? json_decode(file_get_contents($ledgerPath), true) : ['entries' => []];
$entries = $ledgerData['entries'] ?? [];

// Load orders
$ordersDir = __DIR__ . '/../presale-orders';
$orderFiles = glob($ordersDir . '/*.json');
$orders = [];

foreach ($orderFiles as $file) {
    $order = json_decode(file_get_contents($file), true);
    if ($order) {
        $orders[] = $order;
    }
}

// Calculate stats
$stats = [
    'overview' => [
        'totalOrders' => count($orders),
        'totalTokens' => 0,
        'totalRevenue' => 0,
        'avgOrderValue' => 0,
        'conversionRate' => 0,
        'lastUpdated' => date(DATE_ATOM)
    ],
    'byStatus' => [
        'pending' => 0,
        'completed' => 0,
        'failed' => 0
    ],
    'byPackage' => [],
    'byNetwork' => [
        'testnet' => 0,
        'mainnet' => 0
    ],
    'recentOrders' => [],
    'topCustomers' => [],
    'timeline' => [
        'today' => ['orders' => 0, 'tokens' => 0, 'revenue' => 0],
        'week' => ['orders' => 0, 'tokens' => 0, 'revenue' => 0],
        'month' => ['orders' => 0, 'tokens' => 0, 'revenue' => 0],
        'all' => ['orders' => 0, 'tokens' => 0, 'revenue' => 0]
    ]
];

$now = time();
$dayAgo = $now - 86400;
$weekAgo = $now - (86400 * 7);
$monthAgo = $now - (86400 * 30);

$customerOrders = [];

foreach ($orders as $order) {
    $tokens = $order['package']['totalTokens'] ?? 0;
    $revenue = $order['package']['priceEur'] ?? 0;
    $status = $order['status'] ?? 'pending';
    $packageName = $order['package']['name'] ?? 'Unknown';
    $network = $order['zion']['network'] ?? 'testnet';
    $email = $order['customer']['email'] ?? '';
    $createdAt = strtotime($order['createdAt'] ?? 'now');

    // Overview
    $stats['overview']['totalTokens'] += $tokens;
    $stats['overview']['totalRevenue'] += $revenue;

    // By status
    if (isset($stats['byStatus'][$status])) {
        $stats['byStatus'][$status]++;
    }

    // By package
    if (!isset($stats['byPackage'][$packageName])) {
        $stats['byPackage'][$packageName] = [
            'count' => 0,
            'tokens' => 0,
            'revenue' => 0
        ];
    }
    $stats['byPackage'][$packageName]['count']++;
    $stats['byPackage'][$packageName]['tokens'] += $tokens;
    $stats['byPackage'][$packageName]['revenue'] += $revenue;

    // By network
    if (isset($stats['byNetwork'][$network])) {
        $stats['byNetwork'][$network] += $tokens;
    }

    // Timeline
    $stats['timeline']['all']['orders']++;
    $stats['timeline']['all']['tokens'] += $tokens;
    $stats['timeline']['all']['revenue'] += $revenue;

    if ($createdAt >= $dayAgo) {
        $stats['timeline']['today']['orders']++;
        $stats['timeline']['today']['tokens'] += $tokens;
        $stats['timeline']['today']['revenue'] += $revenue;
    }

    if ($createdAt >= $weekAgo) {
        $stats['timeline']['week']['orders']++;
        $stats['timeline']['week']['tokens'] += $tokens;
        $stats['timeline']['week']['revenue'] += $revenue;
    }

    if ($createdAt >= $monthAgo) {
        $stats['timeline']['month']['orders']++;
        $stats['timeline']['month']['tokens'] += $tokens;
        $stats['timeline']['month']['revenue'] += $revenue;
    }

    // Recent orders (last 10)
    if (count($stats['recentOrders']) < 10) {
        $stats['recentOrders'][] = [
            'orderId' => $order['orderId'] ?? 'N/A',
            'email' => $email,
            'package' => $packageName,
            'tokens' => $tokens,
            'revenue' => $revenue,
            'status' => $status,
            'createdAt' => $order['createdAt'] ?? null
        ];
    }

    // Top customers
    if (!isset($customerOrders[$email])) {
        $customerOrders[$email] = [
            'email' => $email,
            'orders' => 0,
            'tokens' => 0,
            'revenue' => 0
        ];
    }
    $customerOrders[$email]['orders']++;
    $customerOrders[$email]['tokens'] += $tokens;
    $customerOrders[$email]['revenue'] += $revenue;
}

// Sort recent orders by date (newest first)
usort($stats['recentOrders'], function($a, $b) {
    return strtotime($b['createdAt'] ?? 'now') - strtotime($a['createdAt'] ?? 'now');
});

// Sort top customers by revenue
uasort($customerOrders, function($a, $b) {
    return $b['revenue'] - $a['revenue'];
});
$stats['topCustomers'] = array_slice($customerOrders, 0, 10);

// Calculate averages
if ($stats['overview']['totalOrders'] > 0) {
    $stats['overview']['avgOrderValue'] = $stats['overview']['totalRevenue'] / $stats['overview']['totalOrders'];
}

// Sort packages by revenue
uasort($stats['byPackage'], function($a, $b) {
    return $b['revenue'] - $a['revenue'];
});

// Response
echo json_encode([
    'success' => true,
    'stats' => $stats
], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
