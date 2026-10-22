<?php
/**
 * ZION MainNet Payout System
 * 
 * Automatické odeslání tokenů zákazníkům po spuštění MainNetu
 * 
 * Funkce:
 * - Načte všechny presale + eshop objednávky
 * - Konsoliduje do payout ledgeru
 * - Při spuštění MainNetu odešle tokeny na wallet adresy
 * - Loguje všechny transakce
 * 
 * @version 1.0
 * @date 2026-01-02
 */

// ============================================
// KONFIGURACE
// ============================================

define('MAINNET_LAUNCH_DATE', '2027-12-31');
define('MAINNET_RPC_URL', 'http://91.98.122.165:8545');  // ZION MainNet RPC
define('PAYOUT_WALLET_PRIVATE_KEY', '');  // Bude nastaveno před MainNetem
define('PAYOUT_LOG_FILE', __DIR__ . '/../logs/mainnet-payouts.log');
define('PAYOUT_LEDGER_FILE', __DIR__ . '/../data/payout-ledger.json');

// ============================================
// UTILITY FUNKCE
// ============================================

function logPayout($message, $level = 'INFO') {
    $timestamp = date('Y-m-d H:i:s');
    $logLine = "[$timestamp] [$level] $message\n";
    file_put_contents(PAYOUT_LOG_FILE, $logLine, FILE_APPEND | LOCK_EX);
    if (php_sapi_name() === 'cli') {
        echo $logLine;
    }
}

function loadJsonFiles($dir, $pattern = '*.json') {
    $files = glob($dir . '/' . $pattern);
    $data = [];
    foreach ($files as $file) {
        $content = json_decode(file_get_contents($file), true);
        if ($content) {
            $content['_sourceFile'] = basename($file);
            $data[] = $content;
        }
    }
    return $data;
}

function saveLedger($ledger) {
    $dir = dirname(PAYOUT_LEDGER_FILE);
    if (!is_dir($dir)) mkdir($dir, 0755, true);
    file_put_contents(PAYOUT_LEDGER_FILE, json_encode($ledger, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

function loadLedger() {
    if (file_exists(PAYOUT_LEDGER_FILE)) {
        return json_decode(file_get_contents(PAYOUT_LEDGER_FILE), true) ?: [];
    }
    return [];
}

// ============================================
// PAYOUT ENTRY STRUKTURA
// ============================================

function createPayoutEntry($order, $type) {
    if ($type === 'presale') {
        return [
            'id' => $order['orderId'],
            'type' => 'presale',
            'customerEmail' => $order['customer']['email'] ?? '',
            'customerName' => $order['customer']['name'] ?? '',
            'walletAddress' => $order['zion']['wallet']['address'] ?? '',
            'walletMnemonic' => $order['zion']['wallet']['mnemonic'] ?? '',
            'tokens' => (int)($order['package']['totalTokens'] ?? 0),
            'priceEur' => (float)($order['package']['priceEur'] ?? 0),
            'paymentStatus' => $order['payment']['status'] ?? 'pending',
            'createdAt' => $order['createdAt'] ?? '',
            'payoutStatus' => 'pending',  // pending | sent | failed
            'payoutTxHash' => null,
            'payoutDate' => null,
            'payoutError' => null
        ];
    } else {
        return [
            'id' => $order['orderId'],
            'type' => 'eshop',
            'customerEmail' => $order['customer']['email'] ?? '',
            'customerName' => $order['customer']['name'] ?? '',
            'walletAddress' => $order['zion']['wallet']['address'] ?? $order['zion']['wallet']['id'] ?? '',
            'walletMnemonic' => $order['zion']['wallet']['mnemonic'] ?? '',
            'tokens' => (int)($order['zion']['tokens']['totalTokens'] ?? 0),
            'totalCzk' => (float)($order['total'] ?? 0),
            'paymentStatus' => $order['payment']['status'] ?? 'pending',
            'createdAt' => $order['createdAt'] ?? '',
            'payoutStatus' => 'pending',
            'payoutTxHash' => null,
            'payoutDate' => null,
            'payoutError' => null
        ];
    }
}

// ============================================
// KONSOLIDACE LEDGERU
// ============================================

function consolidateLedger($baseDir) {
    logPayout("Starting ledger consolidation...");
    
    $presaleOrders = loadJsonFiles($baseDir . '/presale-orders');
    $eshopOrders = loadJsonFiles($baseDir . '/orders');
    
    logPayout("Found " . count($presaleOrders) . " presale orders");
    logPayout("Found " . count($eshopOrders) . " eshop orders");
    
    $ledger = loadLedger();
    $existingIds = array_column($ledger, 'id');
    
    $newEntries = 0;
    
    // Process presale orders
    foreach ($presaleOrders as $order) {
        $orderId = $order['orderId'] ?? null;
        if ($orderId && !in_array($orderId, $existingIds)) {
            $ledger[] = createPayoutEntry($order, 'presale');
            $newEntries++;
        }
    }
    
    // Process eshop orders
    foreach ($eshopOrders as $order) {
        $orderId = $order['orderId'] ?? null;
        if ($orderId && !in_array($orderId, $existingIds)) {
            $ledger[] = createPayoutEntry($order, 'eshop');
            $newEntries++;
        }
    }
    
    saveLedger($ledger);
    logPayout("Consolidated $newEntries new entries. Total: " . count($ledger));
    
    return $ledger;
}

// ============================================
// PAYOUT STATISTIKY
// ============================================

function getPayoutStats($ledger) {
    $stats = [
        'total' => count($ledger),
        'totalTokens' => 0,
        'presale' => ['count' => 0, 'tokens' => 0, 'revenue' => 0],
        'eshop' => ['count' => 0, 'tokens' => 0, 'revenue' => 0],
        'byStatus' => [
            'pending' => 0,
            'sent' => 0,
            'failed' => 0
        ]
    ];
    
    foreach ($ledger as $entry) {
        $tokens = (int)($entry['tokens'] ?? 0);
        $stats['totalTokens'] += $tokens;
        $stats['byStatus'][$entry['payoutStatus'] ?? 'pending']++;
        
        if ($entry['type'] === 'presale') {
            $stats['presale']['count']++;
            $stats['presale']['tokens'] += $tokens;
            $stats['presale']['revenue'] += (float)($entry['priceEur'] ?? 0) * 25;
        } else {
            $stats['eshop']['count']++;
            $stats['eshop']['tokens'] += $tokens;
            $stats['eshop']['revenue'] += (float)($entry['totalCzk'] ?? 0);
        }
    }
    
    return $stats;
}

// ============================================
// MAINNET RPC VOLÁNÍ
// ============================================

function callRpc($method, $params = []) {
    $payload = json_encode([
        'jsonrpc' => '2.0',
        'method' => $method,
        'params' => $params,
        'id' => time()
    ]);
    
    $ch = curl_init(MAINNET_RPC_URL);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $payload,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 30
    ]);
    
    $response = curl_exec($ch);
    $error = curl_error($ch);
    curl_close($ch);
    
    if ($error) {
        throw new Exception("RPC Error: $error");
    }
    
    $result = json_decode($response, true);
    if (isset($result['error'])) {
        throw new Exception("RPC Error: " . json_encode($result['error']));
    }
    
    return $result['result'] ?? null;
}

function sendTokens($toAddress, $amount) {
    // ZION blockchain sendtoaddress
    return callRpc('sendtoaddress', [$toAddress, $amount]);
}

function getBlockHeight() {
    return callRpc('getblockcount');
}

// ============================================
// PAYOUT EXECUTION
// ============================================

function executePayouts($dryRun = true) {
    $ledger = loadLedger();
    
    if (empty($ledger)) {
        logPayout("No entries in ledger. Run consolidation first.", 'WARN');
        return;
    }
    
    // Check MainNet status
    $today = date('Y-m-d');
    $mainnetLaunch = MAINNET_LAUNCH_DATE;
    
    if ($today < $mainnetLaunch) {
        logPayout("MainNet not launched yet. Launch date: $mainnetLaunch", 'WARN');
        if (!$dryRun) {
            logPayout("Cannot execute real payouts before MainNet launch!", 'ERROR');
            return;
        }
    }
    
    $mode = $dryRun ? 'DRY RUN' : 'LIVE';
    logPayout("=== Starting Payout Execution [$mode] ===");
    
    $pending = array_filter($ledger, function($e) { return ($e['payoutStatus'] ?? 'pending') === 'pending'; });
    logPayout("Pending payouts: " . count($pending));
    
    $success = 0;
    $failed = 0;
    
    foreach ($ledger as &$entry) {
        if (($entry['payoutStatus'] ?? 'pending') !== 'pending') {
            continue;
        }
        
        $address = $entry['walletAddress'] ?? '';
        $tokens = $entry['tokens'] ?? 0;
        $orderId = $entry['id'] ?? 'UNKNOWN';
        
        if (empty($address) || $tokens <= 0) {
            logPayout("Skipping $orderId - invalid address or tokens", 'WARN');
            continue;
        }
        
        logPayout("Processing $orderId: $tokens ZION -> $address");
        
        if ($dryRun) {
            logPayout("  [DRY RUN] Would send $tokens ZION to $address");
            $success++;
        } else {
            try {
                $txHash = sendTokens($address, $tokens);
                $entry['payoutStatus'] = 'sent';
                $entry['payoutTxHash'] = $txHash;
                $entry['payoutDate'] = date('c');
                logPayout("  SUCCESS: TX $txHash");
                $success++;
            } catch (Exception $e) {
                $entry['payoutStatus'] = 'failed';
                $entry['payoutError'] = $e->getMessage();
                logPayout("  FAILED: " . $e->getMessage(), 'ERROR');
                $failed++;
            }
        }
    }
    
    if (!$dryRun) {
        saveLedger($ledger);
    }
    
    logPayout("=== Payout Complete: $success success, $failed failed ===");
}

// ============================================
// CLI INTERFACE
// ============================================

if (php_sapi_name() === 'cli') {
    $baseDir = realpath(__DIR__ . '/..');
    
    $command = $argv[1] ?? 'help';
    
    switch ($command) {
        case 'consolidate':
            $ledger = consolidateLedger($baseDir);
            $stats = getPayoutStats($ledger);
            echo "\n=== Payout Ledger Stats ===\n";
            echo "Total Entries: {$stats['total']}\n";
            echo "Total Tokens: " . number_format($stats['totalTokens']) . " ZION\n";
            echo "Presale: {$stats['presale']['count']} orders, " . number_format($stats['presale']['tokens']) . " ZION\n";
            echo "eShop: {$stats['eshop']['count']} orders, " . number_format($stats['eshop']['tokens']) . " ZION\n";
            echo "Pending: {$stats['byStatus']['pending']}, Sent: {$stats['byStatus']['sent']}, Failed: {$stats['byStatus']['failed']}\n";
            break;
            
        case 'stats':
            $ledger = loadLedger();
            $stats = getPayoutStats($ledger);
            echo json_encode($stats, JSON_PRETTY_PRINT) . "\n";
            break;
            
        case 'dry-run':
            executePayouts(true);
            break;
            
        case 'execute':
            echo "⚠️  WARNING: This will send REAL tokens!\n";
            echo "Type 'YES' to confirm: ";
            $confirm = trim(fgets(STDIN));
            if ($confirm === 'YES') {
                executePayouts(false);
            } else {
                echo "Aborted.\n";
            }
            break;
            
        case 'export':
            $ledger = loadLedger();
            echo json_encode($ledger, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "\n";
            break;
            
        default:
            echo "ZION MainNet Payout System\n";
            echo "==========================\n\n";
            echo "Commands:\n";
            echo "  consolidate  - Scan orders and update payout ledger\n";
            echo "  stats        - Show payout statistics\n";
            echo "  dry-run      - Simulate payouts (no real transactions)\n";
            echo "  execute      - Execute real payouts (MainNet only!)\n";
            echo "  export       - Export full ledger as JSON\n";
            echo "\nUsage: php mainnet-payout-system.php <command>\n";
    }
    exit(0);
}

// ============================================
// WEB API (pro admin dashboard)
// ============================================

header('Content-Type: application/json');
require_once 'auth.php';

if (!isLoggedIn()) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

$action = $_GET['action'] ?? 'stats';
$baseDir = realpath(__DIR__ . '/..');

switch ($action) {
    case 'consolidate':
        $ledger = consolidateLedger($baseDir);
        $stats = getPayoutStats($ledger);
        echo json_encode(['success' => true, 'stats' => $stats]);
        break;
        
    case 'stats':
        $ledger = loadLedger();
        if (empty($ledger)) {
            $ledger = consolidateLedger($baseDir);
        }
        $stats = getPayoutStats($ledger);
        echo json_encode(['success' => true, 'stats' => $stats]);
        break;
        
    case 'ledger':
        $ledger = loadLedger();
        echo json_encode(['success' => true, 'ledger' => $ledger]);
        break;
        
    case 'dry-run':
        ob_start();
        executePayouts(true);
        $log = ob_get_clean();
        echo json_encode(['success' => true, 'log' => $log]);
        break;
        
    default:
        echo json_encode(['error' => 'Unknown action', 'available' => ['stats', 'consolidate', 'ledger', 'dry-run']]);
}
