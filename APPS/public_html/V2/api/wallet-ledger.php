<?php
/**
 * ZION Wallet Ledger API
 * GET  /wallet-ledger.php            -> list entries (optional ?status=pending&network=mainnet)
 * POST /wallet-ledger.php            -> update entry status/network/txHash/note
 */

require_once __DIR__ . '/wallet-lib.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

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

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    handleGetLedger();
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    handlePostLedger();
    exit;
}

http_response_code(405);
echo json_encode(['success' => false, 'error' => 'Method not allowed']);
exit;

function handleGetLedger(): void
{
    $id = isset($_GET['id']) ? trim((string)$_GET['id']) : null;
    $statusFilter = isset($_GET['status']) ? array_filter(array_map('trim', explode(',', $_GET['status']))) : [];
    $networkFilter = isset($_GET['network']) ? trim((string)$_GET['network']) : null;

    $ledger = zion_wallet_load_ledger();

    if ($id) {
        $entry = zion_wallet_find_ledger_entry($id);
        if (!$entry) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Ledger entry not found']);
            return;
        }

        echo json_encode([
            'success' => true,
            'entry' => $entry
        ], JSON_UNESCAPED_UNICODE);
        return;
    }

    $filtered = array_filter($ledger, function ($entry) use ($statusFilter, $networkFilter) {
        if ($statusFilter && !in_array($entry['status'], $statusFilter, true)) {
            return false;
        }
        if ($networkFilter && strtolower($entry['network']) !== strtolower($networkFilter)) {
            return false;
        }
        return true;
    });

    $stats = buildLedgerStats($filtered);

    echo json_encode([
        'success' => true,
        'count' => count($filtered),
        'entries' => array_values($filtered),
        'stats' => $stats,
        'statusOptions' => zion_wallet_statuses()
    ], JSON_UNESCAPED_UNICODE);
}

function handlePostLedger(): void
{
    // === API AUTH: X-API-Key ===
    $apiKeyHeader = $_SERVER['HTTP_X_API_KEY'] ?? '';
    $requiredKey = defined('WALLET_LEDGER_API_KEY') ? WALLET_LEDGER_API_KEY : '';
    if (!empty($requiredKey)) {
        if (!is_string($apiKeyHeader) || !hash_equals($requiredKey, $apiKeyHeader)) {
            http_response_code(401);
            error_log('Unauthorized wallet-ledger POST attempt from ' . ($_SERVER['REMOTE_ADDR'] ?? 'unknown'));
            echo json_encode(['success' => false, 'error' => 'Unauthorized']);
            return;
        }
    } else {
        // In dev mode (no key configured) log a warning and allow POST - recommend configuring key in production
        error_log('Warning: WALLET_LEDGER_API_KEY not configured; POST requests are allowed (dev mode)');
    }
    $raw = file_get_contents('php://input');
    $payload = json_decode($raw, true);

    if (!is_array($payload)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid JSON payload']);
        return;
    }

    $ledgerId = trim((string)($payload['id'] ?? ''));
    if ($ledgerId === '') {
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'Missing ledger id']);
        return;
    }

    $updates = [];
    if (isset($payload['status'])) {
        $status = trim((string)$payload['status']);
        if (!in_array($status, zion_wallet_statuses(), true)) {
            http_response_code(422);
            echo json_encode(['success' => false, 'error' => 'Invalid status value']);
            return;
        }
        $updates['status'] = $status;
    }

    foreach (['note', 'txHash', 'network'] as $field) {
        if (array_key_exists($field, $payload)) {
            $updates[$field] = trim((string)$payload[$field]);
        }
    }

    if (!$updates) {
        http_response_code(422);
        echo json_encode(['success' => false, 'error' => 'No update fields supplied']);
        return;
    }

    $entry = zion_wallet_update_ledger_entry($ledgerId, $updates);
    if (!$entry) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Ledger entry not found']);
        return;
    }

    echo json_encode([
        'success' => true,
        'entry' => $entry
    ], JSON_UNESCAPED_UNICODE);
}

function buildLedgerStats(array $entries): array
{
    $stats = [
        'totalTokens' => 0,
        'byStatus' => []
    ];

    foreach ($entries as $entry) {
        $tokens = (int)($entry['tokens'] ?? 0);
        $status = $entry['status'] ?? 'unknown';
        $stats['totalTokens'] += $tokens;
        if (!isset($stats['byStatus'][$status])) {
            $stats['byStatus'][$status] = 0;
        }
        $stats['byStatus'][$status] += $tokens;
    }

    return $stats;
}
