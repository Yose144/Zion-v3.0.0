<?php
/**
 * ZION Token Distribution API
 * ============================
 * API wrapper pro mainnet launch token distribution.
 * 
 * Endpoints:
 * - GET ?action=stats - Vrátí statistiky pending distribucí
 * - POST ?action=distribute-presale - Spustí presale payout
 * - POST ?action=distribute-bonus - Spustí eShop bonus payout
 * - GET ?action=status - Vrátí stav probíhající distribuce
 * - GET ?action=balance&walletId=xxx - Vrátí zůstatek pro daný walletId
 * 
 * @author ZION Team
 * @version 2.9.0
 * @created 2. ledna 2026
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST');

require_once 'auth.php';

// Try Basic Auth fallback for API clients
function tryBasicAuthLoginDistribution(): bool {
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    $pass = null;

    if (!empty($_SERVER['PHP_AUTH_PW'])) {
        $pass = $_SERVER['PHP_AUTH_PW'];
    } elseif (is_string($authHeader) && stripos($authHeader, 'Basic ') === 0) {
        $decoded = base64_decode(substr($authHeader, 6));
        if (is_string($decoded) && strpos($decoded, ':') !== false) {
            [, $pass] = explode(':', $decoded, 2);
        }
    }

    if (!$pass) {
        return false;
    }

    $hash = getenv('ADMIN_PASSWORD_HASH');
    $plainPassword = getenv('ADMIN_PASSWORD');
    
    if ($hash && password_verify($pass, $hash)) {
        $_SESSION['admin_logged_in'] = true;
        $_SESSION['last_activity'] = time();
        return true;
    }
    if ($plainPassword && hash_equals($plainPassword, $pass)) {
        $_SESSION['admin_logged_in'] = true;
        $_SESSION['last_activity'] = time();
        return true;
    }

    return false;
}

if (!isLoggedIn() && !tryBasicAuthLoginDistribution()) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . '/wallet-lib.php';

// Security - pouze přihlášený admin
if (!isset($_SERVER['PHP_AUTH_USER']) || $_SERVER['PHP_AUTH_USER'] !== 'admin') {
    // Zkontrolovat session nebo jiné auth
    // Pro teď povolíme, v produkci nutno zabezpečit!
}

// Paths
define('ORDERS_DIR', __DIR__ . '/../orders');
define('PRESALE_ORDERS_DIR', __DIR__ . '/../presale-orders');
define('LEGACY_PRESALE_ORDERS_DIR', __DIR__ . '/../../presale-orders');
define('WALLETS_DIR', __DIR__ . '/../wallets');
define('LOGS_DIR', __DIR__ . '/../logs');
define('DISTRIBUTION_LOG', LOGS_DIR . '/token-distribution.log');
define('DISTRIBUTION_STATUS_FILE', LOGS_DIR . '/distribution-status.json');

function envOrDefault(string $key, ?string $default = null): ?string {
    $v = getenv($key);
    if ($v === false) {
        return $default;
    }
    $v = trim((string)$v);
    return $v === '' ? $default : $v;
}

// Network config (default TestNet; override via env)
define('CURRENT_NETWORK', envOrDefault('ZION_NETWORK', 'testnet')); // 'testnet' | 'mainnet'
define('BLOCKCHAIN_RPC_URL', envOrDefault('ZION_RPC_URL', 'http://77.42.31.72:18082/json_rpc'));

// Security gates for real on-chain distribution
define('ENABLE_REAL_DISTRIBUTION', envOrDefault('ENABLE_REAL_DISTRIBUTION', '0') === '1');
define('ZION_RPC_TOKEN', envOrDefault('ZION_RPC_TOKEN', null));
define('ZION_DISTRIBUTION_FROM_ADDRESS', envOrDefault('ZION_DISTRIBUTION_FROM_ADDRESS', null));

// Escrow addresses
define('PRESALE_ESCROW_ADDRESS', 'ZION_PRESALE_ESCROW_GENESIS_2025');
define('DAO_TREASURY_ADDRESS', 'ZION_DAO_TREASURY_GENESIS_2025');

// Create dirs if needed
if (!is_dir(LOGS_DIR)) mkdir(LOGS_DIR, 0755, true);
if (!is_dir(PRESALE_ORDERS_DIR)) mkdir(PRESALE_ORDERS_DIR, 0755, true);

function listPresaleOrderFiles(): array {
    $files = [];
    foreach ([PRESALE_ORDERS_DIR, LEGACY_PRESALE_ORDERS_DIR] as $dir) {
        if (!is_dir($dir)) {
            continue;
        }
        $files = array_merge($files, glob(rtrim($dir, '/') . '/*.json') ?: []);
    }
    return $files;
}

function isPresaleOrder(array $data): bool {
    $type = strtolower((string)($data['type'] ?? $data['orderType'] ?? ''));
    if ($type === 'presale') {
        return true;
    }
    if ($type === 'eshop') {
        return false;
    }

    $items = $data['items'] ?? null;
    if (!is_array($items)) {
        return false;
    }

    foreach ($items as $it) {
        if (!is_array($it)) {
            continue;
        }
        $cat = strtolower((string)($it['category'] ?? ''));
        $id = strtolower((string)($it['id'] ?? ''));
        if ($cat === 'presale' || strpos($id, 'presale-') === 0) {
            return true;
        }
    }

    return false;
}

/**
 * Log distribution event
 */
function logDistribution(string $message, string $level = 'INFO'): void {
    $timestamp = date('Y-m-d H:i:s');
    $line = "[$timestamp] [$level] $message\n";
    file_put_contents(DISTRIBUTION_LOG, $line, FILE_APPEND | LOCK_EX);
}

/**
 * Get action from request
 */
$action = $_GET['action'] ?? '';

switch ($action) {
    case 'stats':
        handleStats();
        break;
    case 'distribute-presale':
        handleDistributePresale();
        break;
    case 'distribute-bonus':
        handleDistributeBonus();
        break;
    case 'status':
        handleStatus();
        break;
    case 'balance':
        handleBalance();
        break;
    default:
        echo json_encode(['error' => 'Unknown action', 'actions' => ['stats', 'distribute-presale', 'distribute-bonus', 'status', 'balance']]);
}

/**
 * GET /api/token-distribution.php?action=stats
 * Vrátí statistiky pending distribucí
 */
function handleStats(): void {
    $presaleStats = getPresaleStats();
    $bonusStats = getBonusStats();
    
    echo json_encode([
        'success' => true,
        'network' => CURRENT_NETWORK,
        'presale' => $presaleStats,
        'bonus' => $bonusStats,
        'timestamp' => date(DATE_ATOM)
    ]);
}

/**
 * Spočítá presale statistiky z orders
 */
function getPresaleStats(): array {
    return getLedgerStatsForSources(['presale']);
}

/**
 * Spočítá eShop bonus statistiky
 */
function getBonusStats(): array {
    // Legacy: některé staré záznamy mohou mít source=order
    return getLedgerStatsForSources(['eshop', 'order']);
}

function getLedgerStatsForSources(array $sources): array {
    $stats = [
        'pendingCount' => 0,
        'pendingTokens' => 0,
        'distributedCount' => 0,
        'distributedTokens' => 0,
        'failedCount' => 0,
        'failedTokens' => 0
    ];

    $ledger = zion_wallet_load_ledger();
    foreach ($ledger as $entry) {
        if (!is_array($entry)) {
            continue;
        }

        $src = (string)($entry['source'] ?? '');
        if (!in_array($src, $sources, true)) {
            continue;
        }

        $network = (string)($entry['network'] ?? '');
        if ($network !== '' && strtolower($network) !== strtolower(CURRENT_NETWORK)) {
            continue;
        }

        $tokens = (int)($entry['tokens'] ?? 0);
        if ($tokens <= 0) {
            continue;
        }

        $status = (string)($entry['status'] ?? 'pending');

        // Na TESTNETu chceme umožnit test i bez "queued" (většina záznamů bude "pending").
        // Na MAINNETu držíme bezpečný režim: pending se do distribuce nepočítá.
        $treatPendingAsEligible = strtolower(CURRENT_NETWORK) !== 'mainnet';

        if ($status === 'queued' || ($treatPendingAsEligible && $status === 'pending')) {
            $stats['pendingCount']++;
            $stats['pendingTokens'] += $tokens;
        } elseif ($status === 'sent') {
            $stats['distributedCount']++;
            $stats['distributedTokens'] += $tokens;
        } elseif ($status === 'failed') {
            $stats['failedCount']++;
            $stats['failedTokens'] += $tokens;
        }
    }

    return $stats;
}

function eligibleLedgerStatusesForDistribution(): array {
    // MainNet: jen queued (bezpečné)
    if (strtolower(CURRENT_NETWORK) === 'mainnet') {
        return ['queued'];
    }
    // TestNet: queued + pending (pro rychlý test)
    return ['queued', 'pending'];
}

function zion_is_valid_address_format(string $address): bool {
    $address = trim($address);
    if ($address === '') {
        return false;
    }
    if (strpos($address, 'zion1') !== 0) {
        return false;
    }
    $len = strlen($address);
    if ($len < 42 || $len > 90) {
        return false;
    }
    $tail = substr($address, 5);
    if ($tail === false || $tail === '') {
        return false;
    }
    if (!preg_match('/^[023456789acdefghjklmnpqrstuvwxyz]+$/', $tail)) {
        return false;
    }
    return true;
}

function zion_rpc_call(string $method, $params): array {
    $url = BLOCKCHAIN_RPC_URL;
    if (!$url) {
        return ['success' => false, 'error' => 'ZION_RPC_URL is not configured'];
    }

    $payload = json_encode([
        'jsonrpc' => '2.0',
        'id' => (int)time(),
        'method' => $method,
        'params' => $params
    ]);
    if ($payload === false) {
        return ['success' => false, 'error' => 'Failed to encode JSON-RPC payload'];
    }

    $headers = ['Content-Type: application/json'];
    if (ZION_RPC_TOKEN) {
        // NOTE: server expects raw token string (no Bearer prefix)
        $headers[] = 'X-ZION-AUTH: ' . ZION_RPC_TOKEN;
    }

    $raw = false;
    $http = 0;

    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
        curl_setopt($ch, CURLOPT_TIMEOUT, 20);

        $raw = curl_exec($ch);
        $errno = curl_errno($ch);
        $err = curl_error($ch);
        $http = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($raw === false) {
            return ['success' => false, 'error' => 'RPC request failed: ' . ($errno ? "$errno: $err" : $err)];
        }
    } else {
        $context = stream_context_create([
            'http' => [
                'method' => 'POST',
                'header' => implode("\r\n", $headers),
                'content' => $payload,
                'timeout' => 20,
            ],
        ]);
        $raw = @file_get_contents($url, false, $context);
        if (is_array($http_response_header ?? null)) {
            foreach ($http_response_header as $line) {
                if (preg_match('/^HTTP\/[0-9.]+\s+(\d+)/', $line, $m)) {
                    $http = (int)$m[1];
                    break;
                }
            }
        }
        if ($raw === false) {
            return ['success' => false, 'error' => 'RPC request failed (no curl available)'];
        }
    }

    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        return ['success' => false, 'error' => 'RPC returned non-JSON response', 'http' => $http, 'raw' => substr((string)$raw, 0, 200)];
    }

    if (isset($decoded['error']) && $decoded['error']) {
        // error can be string/dict/null depending on implementation
        $msg = is_array($decoded['error']) ? ($decoded['error']['message'] ?? json_encode($decoded['error'])) : (string)$decoded['error'];
        return ['success' => false, 'error' => $msg !== '' ? $msg : 'RPC error', 'http' => $http, 'response' => $decoded];
    }

    return ['success' => true, 'result' => $decoded['result'] ?? null, 'http' => $http, 'response' => $decoded];
}

function submitBlockchainTransfer(string $toAddress, int $tokens, string $type, string $orderId): array {
    if (!ENABLE_REAL_DISTRIBUTION) {
        return ['success' => false, 'error' => 'Real distribution is disabled (set ENABLE_REAL_DISTRIBUTION=1)'];
    }
    if (!ZION_DISTRIBUTION_FROM_ADDRESS) {
        return ['success' => false, 'error' => 'Missing ZION_DISTRIBUTION_FROM_ADDRESS'];
    }
    $from = (string)ZION_DISTRIBUTION_FROM_ADDRESS;
    $to = trim($toAddress);

    if (!zion_is_valid_address_format($from)) {
        return ['success' => false, 'error' => 'Invalid FROM address format (must be zion1...)'];
    }
    if (!zion_is_valid_address_format($to)) {
        return ['success' => false, 'error' => 'Invalid TO address format (must be zion1...)'];
    }
    if ($tokens <= 0) {
        return ['success' => false, 'error' => 'Amount must be positive'];
    }

    $purpose = $type . ':' . $orderId;
    $rpc = zion_rpc_call('sendtransaction', [
        'from' => $from,
        'to' => $to,
        'amount' => (string)$tokens,
        'purpose' => $purpose
    ]);

    if (!$rpc['success']) {
        return ['success' => false, 'error' => $rpc['error'] ?? 'RPC error'];
    }

    $res = $rpc['result'];
    if (!is_array($res)) {
        return ['success' => false, 'error' => 'RPC returned invalid result'];
    }
    if (isset($res['error']) && $res['error']) {
        return ['success' => false, 'error' => (string)$res['error']];
    }
    $txId = (string)($res['tx_id'] ?? '');
    if ($txId === '') {
        return ['success' => false, 'error' => 'RPC did not return tx_id'];
    }

    return [
        'success' => true,
        'txHash' => $txId,
        'status' => (string)($res['status'] ?? 'pending')
    ];
}

function tryResolveWalletAddressFromOrder(string $orderId): ?string {
    $orderId = trim($orderId);
    if ($orderId === '') {
        return null;
    }

    $candidateDirs = [ORDERS_DIR, PRESALE_ORDERS_DIR, LEGACY_PRESALE_ORDERS_DIR];
    foreach ($candidateDirs as $dir) {
        $file = rtrim($dir, '/') . '/' . basename($orderId) . '.json';
        if (!file_exists($file)) {
            continue;
        }
        $raw = file_get_contents($file);
        $order = json_decode($raw, true);
        if (!is_array($order)) {
            continue;
        }

        $addr = $order['walletAddress'] ?? null;
        if (!$addr) {
            $addr = $order['zion']['wallet']['address'] ?? null;
        }
        if (!$addr) {
            $addr = $order['zion']['walletAddress'] ?? null;
        }
        if (is_string($addr) && trim($addr) !== '') {
            return trim($addr);
        }
    }

    return null;
}

/**
 * POST /api/token-distribution.php?action=distribute-presale
 * Spustí presale token distribution
 */
function handleDistributePresale(): void {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        echo json_encode(['error' => 'POST required']);
        return;
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    if (!($input['confirm'] ?? false)) {
        echo json_encode(['error' => 'Confirmation required']);
        return;
    }

    // Preflight: do not mutate ledger if real distribution is not ready
    if (!ENABLE_REAL_DISTRIBUTION) {
        echo json_encode(['success' => false, 'error' => 'Real distribution is disabled (set ENABLE_REAL_DISTRIBUTION=1)']);
        return;
    }
    if (!ZION_DISTRIBUTION_FROM_ADDRESS || !zion_is_valid_address_format((string)ZION_DISTRIBUTION_FROM_ADDRESS)) {
        echo json_encode(['success' => false, 'error' => 'Invalid or missing ZION_DISTRIBUTION_FROM_ADDRESS (must be zion1...)']);
        return;
    }
    $balanceCheck = zion_rpc_call('getbalance', ['address' => (string)ZION_DISTRIBUTION_FROM_ADDRESS]);
    if (!$balanceCheck['success']) {
        echo json_encode(['success' => false, 'error' => 'RPC preflight failed: ' . ($balanceCheck['error'] ?? 'unknown')]);
        return;
    }
    
    logDistribution("=== PRESALE DISTRIBUTION STARTED ===");
    logDistribution("Network: " . CURRENT_NETWORK);
    logDistribution("Operator: " . ($_SERVER['PHP_AUTH_USER'] ?? 'unknown'));
    
    // Update status
    updateDistributionStatus('presale', 'running', 0, 0);
    
    $results = [
        'count' => 0,
        'tokens' => 0,
        'successful' => 0,
        'failed' => 0,
        'transactions' => []
    ];
    
    try {
        $ledger = zion_wallet_load_ledger();
        $eligibleStatuses = eligibleLedgerStatusesForDistribution();
        foreach ($ledger as $entry) {
            if (!is_array($entry)) {
                continue;
            }

            if (($entry['source'] ?? null) !== 'presale') {
                continue;
            }

            $st = (string)($entry['status'] ?? 'pending');
            if (!in_array($st, $eligibleStatuses, true)) {
                continue;
            }

            $network = (string)($entry['network'] ?? '');
            if ($network !== '' && strtolower($network) !== strtolower(CURRENT_NETWORK)) {
                continue;
            }

            $ledgerId = (string)($entry['id'] ?? '');
            $orderId = (string)($entry['orderId'] ?? $ledgerId);
            $tokens = (int)($entry['tokens'] ?? 0);
            $walletAddress = $entry['walletAddress'] ?? null;

            if (!$ledgerId || $tokens <= 0) {
                continue;
            }

            if (!$walletAddress) {
                $resolved = tryResolveWalletAddressFromOrder($orderId);
                if (is_string($resolved) && trim($resolved) !== '') {
                    $walletAddress = trim($resolved);
                    zion_wallet_update_ledger_entry($ledgerId, [
                        'walletAddress' => $walletAddress,
                        'note' => 'walletAddress resolved for distribution'
                    ]);
                }
            }

            if (!$walletAddress) {
                logDistribution("SKIP $orderId ($ledgerId): missing walletAddress", 'WARN');
                continue;
            }

            $results['count']++;
            $results['tokens'] += $tokens;

            $txResult = submitBlockchainTransfer((string)$walletAddress, $tokens, 'presale', $orderId);

            if ($txResult['success']) {
                $results['successful']++;

                zion_wallet_update_ledger_entry($ledgerId, [
                    'status' => 'sent',
                    'txHash' => $txResult['txHash'],
                    'network' => CURRENT_NETWORK,
                    'note' => 'Presale distribution submitted'
                ]);

                logDistribution("OK $orderId ($ledgerId): $tokens ZION -> $walletAddress (tx: {$txResult['txHash']})");

                $results['transactions'][] = [
                    'orderId' => $orderId,
                    'tokens' => $tokens,
                    'address' => $walletAddress,
                    'txHash' => $txResult['txHash'],
                    'status' => 'success'
                ];
            } else {
                $results['failed']++;

                zion_wallet_update_ledger_entry($ledgerId, [
                    'status' => 'failed',
                    'network' => CURRENT_NETWORK,
                    'note' => 'Presale distribution failed: ' . ($txResult['error'] ?? 'unknown error')
                ]);

                logDistribution("FAIL $orderId ($ledgerId): {$txResult['error']}", 'ERROR');

                $results['transactions'][] = [
                    'orderId' => $orderId,
                    'tokens' => $tokens,
                    'address' => $walletAddress,
                    'error' => $txResult['error'],
                    'status' => 'failed'
                ];
            }
        }
        
        updateDistributionStatus('presale', 'completed', $results['successful'], $results['failed']);
        logDistribution("=== PRESALE DISTRIBUTION COMPLETED ===");
        logDistribution("Total: {$results['count']}, Success: {$results['successful']}, Failed: {$results['failed']}");
        
        echo json_encode([
            'success' => true,
            'distributed' => $results,
            'network' => CURRENT_NETWORK
        ]);
        
    } catch (Throwable $e) {
        updateDistributionStatus('presale', 'error', $results['successful'], $results['failed']);
        logDistribution("ERROR: " . $e->getMessage(), 'ERROR');
        
        echo json_encode([
            'success' => false,
            'error' => $e->getMessage(),
            'partial' => $results
        ]);
    }
}

/**
 * POST /api/token-distribution.php?action=distribute-bonus
 * Spustí eShop bonus distribution
 */
function handleDistributeBonus(): void {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        echo json_encode(['error' => 'POST required']);
        return;
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    if (!($input['confirm'] ?? false)) {
        echo json_encode(['error' => 'Confirmation required']);
        return;
    }

    // Preflight: do not mutate ledger if real distribution is not ready
    if (!ENABLE_REAL_DISTRIBUTION) {
        echo json_encode(['success' => false, 'error' => 'Real distribution is disabled (set ENABLE_REAL_DISTRIBUTION=1)']);
        return;
    }
    if (!ZION_DISTRIBUTION_FROM_ADDRESS || !zion_is_valid_address_format((string)ZION_DISTRIBUTION_FROM_ADDRESS)) {
        echo json_encode(['success' => false, 'error' => 'Invalid or missing ZION_DISTRIBUTION_FROM_ADDRESS (must be zion1...)']);
        return;
    }
    $balanceCheck = zion_rpc_call('getbalance', ['address' => (string)ZION_DISTRIBUTION_FROM_ADDRESS]);
    if (!$balanceCheck['success']) {
        echo json_encode(['success' => false, 'error' => 'RPC preflight failed: ' . ($balanceCheck['error'] ?? 'unknown')]);
        return;
    }
    
    logDistribution("=== BONUS DISTRIBUTION STARTED ===");
    logDistribution("Network: " . CURRENT_NETWORK);
    
    updateDistributionStatus('bonus', 'running', 0, 0);
    
    $results = [
        'count' => 0,
        'tokens' => 0,
        'successful' => 0,
        'failed' => 0,
        'transactions' => []
    ];
    
    try {
        $ledger = zion_wallet_load_ledger();
        $eligibleStatuses = eligibleLedgerStatusesForDistribution();
        foreach ($ledger as $entry) {
            if (!is_array($entry)) {
                continue;
            }

            $src = (string)($entry['source'] ?? '');
            if (!in_array($src, ['eshop', 'order'], true)) {
                continue;
            }

            $st = (string)($entry['status'] ?? 'pending');
            if (!in_array($st, $eligibleStatuses, true)) {
                continue;
            }

            $network = (string)($entry['network'] ?? '');
            if ($network !== '' && strtolower($network) !== strtolower(CURRENT_NETWORK)) {
                continue;
            }

            $ledgerId = (string)($entry['id'] ?? '');
            $orderId = (string)($entry['orderId'] ?? $ledgerId);
            $tokens = (int)($entry['tokens'] ?? 0);
            $walletAddress = $entry['walletAddress'] ?? null;

            if (!$ledgerId || $tokens <= 0) {
                continue;
            }

            if (!$walletAddress) {
                $resolved = tryResolveWalletAddressFromOrder($orderId);
                if (is_string($resolved) && trim($resolved) !== '') {
                    $walletAddress = trim($resolved);
                    zion_wallet_update_ledger_entry($ledgerId, [
                        'walletAddress' => $walletAddress,
                        'note' => 'walletAddress resolved for distribution'
                    ]);
                }
            }

            if (!$walletAddress) {
                logDistribution("SKIP $orderId ($ledgerId): missing walletAddress", 'WARN');
                continue;
            }

            $results['count']++;
            $results['tokens'] += $tokens;

            $txResult = submitBlockchainTransfer((string)$walletAddress, $tokens, 'bonus', $orderId);

            if ($txResult['success']) {
                $results['successful']++;

                zion_wallet_update_ledger_entry($ledgerId, [
                    'status' => 'sent',
                    'txHash' => $txResult['txHash'],
                    'network' => CURRENT_NETWORK,
                    'note' => 'Bonus distribution submitted'
                ]);

                logDistribution("OK $orderId ($ledgerId): $tokens ZION -> $walletAddress");

                $results['transactions'][] = [
                    'orderId' => $orderId,
                    'tokens' => $tokens,
                    'address' => $walletAddress,
                    'txHash' => $txResult['txHash'],
                    'status' => 'success'
                ];
            } else {
                $results['failed']++;

                zion_wallet_update_ledger_entry($ledgerId, [
                    'status' => 'failed',
                    'network' => CURRENT_NETWORK,
                    'note' => 'Bonus distribution failed: ' . ($txResult['error'] ?? 'unknown error')
                ]);

                logDistribution("FAIL $orderId ($ledgerId): {$txResult['error']}", 'ERROR');
            }
        }
        
        updateDistributionStatus('bonus', 'completed', $results['successful'], $results['failed']);
        logDistribution("=== BONUS DISTRIBUTION COMPLETED ===");
        
        echo json_encode([
            'success' => true,
            'distributed' => $results,
            'network' => CURRENT_NETWORK
        ]);
        
    } catch (Throwable $e) {
        updateDistributionStatus('bonus', 'error', $results['successful'], $results['failed']);
        
        echo json_encode([
            'success' => false,
            'error' => $e->getMessage()
        ]);
    }
}



/**
 * Update distribution status file
 */
function updateDistributionStatus(string $type, string $status, int $success, int $failed): void {
    $statusData = [];
    if (file_exists(DISTRIBUTION_STATUS_FILE)) {
        $statusData = json_decode(file_get_contents(DISTRIBUTION_STATUS_FILE), true) ?? [];
    }
    
    $statusData[$type] = [
        'status' => $status,
        'successful' => $success,
        'failed' => $failed,
        'updatedAt' => date(DATE_ATOM)
    ];
    
    file_put_contents(DISTRIBUTION_STATUS_FILE, json_encode($statusData, JSON_PRETTY_PRINT));
}

/**
 * GET /api/token-distribution.php?action=status
 * Vrátí stav probíhající distribuce
 */
function handleStatus(): void {
    if (file_exists(DISTRIBUTION_STATUS_FILE)) {
        $status = json_decode(file_get_contents(DISTRIBUTION_STATUS_FILE), true);
        echo json_encode(['success' => true, 'status' => $status]);
    } else {
        echo json_encode(['success' => true, 'status' => ['presale' => null, 'bonus' => null]]);
    }
}

/**
 * GET /api/token-distribution.php?action=balance&walletId=xxx
 * Vrátí zůstatek ZION pro daný walletId nebo adresu
 */
function handleBalance(): void {
    $walletId = $_GET['walletId'] ?? $_GET['address'] ?? null;
    
    if (!$walletId) {
        echo json_encode(['success' => false, 'error' => 'Missing walletId or address parameter']);
        return;
    }
    
    // Pokud je to walletId (zw_xxx), najdi adresu v ledgeru
    $address = $walletId;
    $ledgerEntry = null;
    
    if (strpos($walletId, 'zw_') === 0) {
        $ledgerPath = __DIR__ . '/../wallets/ledger.json';
        if (file_exists($ledgerPath)) {
            $ledger = json_decode(file_get_contents($ledgerPath), true) ?: [];
            foreach ($ledger as $entry) {
                if (($entry['walletId'] ?? null) === $walletId) {
                    $address = $entry['walletAddress'] ?? null;
                    $ledgerEntry = $entry;
                    break;
                }
            }
        }
        
        if (!$address || strpos($address, 'zion1') !== 0) {
            echo json_encode([
                'success' => false, 
                'error' => 'WalletId not found or no address assigned', 
                'walletId' => $walletId
            ]);
            return;
        }
    }
    
    // Validuj formát adresy
    if (!zion_is_valid_address_format($address)) {
        echo json_encode(['success' => false, 'error' => 'Invalid address format', 'address' => $address]);
        return;
    }
    
    // Zavolej blockchain RPC
    $result = zion_rpc_call('getbalance', ['address' => $address]);
    
    if (!$result['success']) {
        echo json_encode(['success' => false, 'error' => $result['error'] ?? 'RPC call failed']);
        return;
    }
    
    $balance = $result['result']['balance'] ?? 0;
    
    $response = [
        'success' => true,
        'walletId' => $walletId,
        'address' => $address,
        'balance' => $balance,
        'network' => CURRENT_NETWORK,
        'timestamp' => date(DATE_ATOM)
    ];
    
    // Přidej ledger info pokud existuje
    if ($ledgerEntry) {
        $response['ledger'] = [
            'orderId' => $ledgerEntry['orderId'] ?? null,
            'tokens' => $ledgerEntry['tokens'] ?? 0,
            'status' => $ledgerEntry['status'] ?? 'unknown',
            'source' => $ledgerEntry['source'] ?? null,
            'txHash' => $ledgerEntry['txHash'] ?? null
        ];
    }
    
    echo json_encode($response);
}
