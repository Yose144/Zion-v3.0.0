<?php
/**
 * Trivi Admin API Endpoint
 * =========================
 * API pro manuální správu Trivi synchronizace z admin panelu
 * 
 * Actions:
 * - sync_order: Odeslat konkrétní objednávku do Trivi
 * - resync_failed: Přeposlat všechny failed objednávky
 * - check_status: Zkontrolovat sync status objednávky
 * 
 * @author ZION Team
 * @created 2026-01-06
 */

// Security
session_start();
if (empty($_SESSION['admin_logged_in'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

header('Content-Type: application/json');

require_once __DIR__ . '/trivi-integration-service.php';

$action = $_GET['action'] ?? $_POST['action'] ?? '';

switch ($action) {
    case 'sync_order':
        syncOrder();
        break;
    
    case 'resync_failed':
        resyncFailed();
        break;
    
    case 'check_status':
        checkStatus();
        break;
    
    case 'get_stats':
        getStats();
        break;
    
    default:
        http_response_code(400);
        echo json_encode(['error' => 'Invalid action. Use: sync_order, resync_failed, check_status, get_stats']);
}

/**
 * Sync specific order to Trivi
 */
function syncOrder() {
    $orderId = $_POST['order_id'] ?? '';
    
    if (empty($orderId)) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing order_id']);
        return;
    }
    
    // Load order from file
    $orderFile = __DIR__ . '/../orders/' . $orderId . '.json';
    if (!file_exists($orderFile)) {
        http_response_code(404);
        echo json_encode(['error' => 'Order not found']);
        return;
    }
    
    $order = json_decode(file_get_contents($orderFile), true);
    
    // Detect if advance payment (presale)
    $isAdvancePayment = stripos($orderId, 'PRESALE') !== false || 
                       ($order['type'] ?? '') === 'presale' ||
                       ($order['payment']['method'] ?? '') === 'advance';
    
    // Sync to Trivi
    $service = new TriviIntegrationService();
    $result = $service->processOrder($order, $isAdvancePayment);
    
    if ($result['success']) {
        echo json_encode([
            'success' => true,
            'message' => 'Objednávka úspěšně odeslána do Trivi',
            'trivi_id' => $result['trivi_id'] ?? null,
            'order_id' => $orderId
        ]);
    } else {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'error' => $result['error'] ?? 'Unknown error',
            'order_id' => $orderId
        ]);
    }
}

/**
 * Resync all failed orders
 */
function resyncFailed() {
    $service = new TriviIntegrationService();
    $result = $service->resyncFailedOrders();
    
    echo json_encode([
        'success' => true,
        'message' => "Resynchronizace dokončena: {$result['success']}/{$result['total']} úspěšných",
        'stats' => [
            'total' => $result['total'],
            'success' => $result['success'],
            'failed' => $result['failed']
        ],
        'details' => $result['details'] ?? []
    ]);
}

/**
 * Check sync status of specific order
 */
function checkStatus() {
    $orderId = $_GET['order_id'] ?? '';
    
    if (empty($orderId)) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing order_id']);
        return;
    }
    
    // Check database
    $dbFile = __DIR__ . '/../data/trivi_sync.db';
    if (!file_exists($dbFile)) {
        echo json_encode([
            'synced' => false,
            'status' => 'not_synced',
            'message' => 'Databáze synchronizace neexistuje'
        ]);
        return;
    }
    
    try {
        $db = new PDO('sqlite:' . $dbFile);
        $stmt = $db->prepare("SELECT * FROM trivi_sync WHERE order_id = ? ORDER BY created_at DESC LIMIT 1");
        $stmt->execute([$orderId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($row) {
            echo json_encode([
                'synced' => true,
                'status' => $row['status'],
                'trivi_id' => $row['trivi_id'],
                'document_number' => $row['document_number'],
                'created_at' => $row['created_at'],
                'error_message' => $row['error_message'],
                'can_retry' => $row['status'] === 'failed'
            ]);
        } else {
            echo json_encode([
                'synced' => false,
                'status' => 'not_synced',
                'message' => 'Objednávka nebyla synchronizována do Trivi'
            ]);
        }
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
    }
}

/**
 * Get Trivi sync statistics
 */
function getStats() {
    $dbFile = __DIR__ . '/../data/trivi_sync.db';
    if (!file_exists($dbFile)) {
        echo json_encode([
            'total' => 0,
            'success' => 0,
            'failed' => 0,
            'pending' => 0
        ]);
        return;
    }
    
    try {
        $db = new PDO('sqlite:' . $dbFile);
        
        $stats = [
            'total' => $db->query("SELECT COUNT(*) FROM trivi_sync")->fetchColumn(),
            'success' => $db->query("SELECT COUNT(*) FROM trivi_sync WHERE status = 'success'")->fetchColumn(),
            'failed' => $db->query("SELECT COUNT(*) FROM trivi_sync WHERE status = 'failed'")->fetchColumn(),
            'pending' => $db->query("SELECT COUNT(*) FROM trivi_sync WHERE status = 'pending'")->fetchColumn()
        ];
        
        // Get recent failed orders
        $stmt = $db->query("SELECT order_id, error_message, created_at FROM trivi_sync WHERE status = 'failed' ORDER BY created_at DESC LIMIT 10");
        $stats['recent_failed'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo json_encode($stats);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
    }
}
