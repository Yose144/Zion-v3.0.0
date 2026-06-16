<?php
/**
 * Trivi Integration Main Service
 * ================================
 * Orchestrates the complete Trivi integration workflow:
 * - Send orders to Trivi
 * - Error handling & retry logic
 * - Database logging (trivi_sync table)
 * - Manual resync capabilities
 * 
 * @author ZION Team
 * @created 2026-01-06
 */

require_once __DIR__ . '/trivi-config.php';
require_once __DIR__ . '/trivi-api-connector.php';
require_once __DIR__ . '/trivi-order-mapper.php';

class TriviIntegrationService
{
    private TriviApiConnector $api;
    private string $logFile;
    private ?PDO $db = null;
    
    public function __construct()
    {
        $this->api = new TriviApiConnector();
        $this->logFile = __DIR__ . '/../logs/trivi-integration.log';
        
        // Initialize database for sync tracking
        $this->initDatabase();
    }
    
    /**
     * Process order and send to Trivi
     * 
     * @param array $order Order data from create-order.php
     * @param bool $isAdvancePayment Is this an advance payment (presale)?
     * @return array Result with success, trivi_id, and error
     */
    public function processOrder(array $order, bool $isAdvancePayment = false): array
    {
        $orderId = $order['orderId'] ?? 'unknown';
        
        try {
            // Validate Trivi configuration
            $configErrors = TriviConfig::validate();
            if (!empty($configErrors)) {
                $this->log('ERROR', 'Trivi configuration invalid', [
                    'order_id' => $orderId,
                    'errors' => $configErrors
                ]);
                
                return [
                    'success' => false,
                    'error' => 'Trivi configuration error: ' . implode(', ', $configErrors),
                    'skipped' => true // Don't fail the order, just skip Trivi sync
                ];
            }
            
            // Check if already synced (prevent duplicates)
            if ($this->isSynced($orderId)) {
                $this->log('INFO', 'Order already synced to Trivi, skipping', [
                    'order_id' => $orderId
                ]);
                
                return [
                    'success' => true,
                    'already_synced' => true
                ];
            }
            
            // Detect presale order (pro oddělenou řadu faktur)
            $isPresaleOrder = $isAdvancePayment || 
                             stripos($orderId, 'PRESALE') !== false || 
                             ($order['type'] ?? '') === 'presale';
            
            // Get next sequence number for invoice/advance (oddělené řady pro e-shop/presale)
            $docType = $isAdvancePayment ? 'advance' : ($isPresaleOrder ? 'invoice_presale' : 'invoice_eshop');
            $sequenceNumber = $this->getNextSequenceNumber($docType);
            
            // Map order to Trivi format
            if ($isAdvancePayment) {
                $triviData = TriviOrderMapper::orderToAdvancePayment($order, $sequenceNumber);
                $this->log('INFO', 'Sending advance payment to Trivi', [
                    'order_id' => $orderId,
                    'advance_number' => $triviData['advance_number']
                ]);
                
                $result = $this->api->sendAdvancePayment($triviData);
            } else {
                $triviData = TriviOrderMapper::orderToInvoice($order, $sequenceNumber, $isPresaleOrder);
                $this->log('INFO', 'Sending invoice to Trivi', [
                    'order_id' => $orderId,
                    'invoice_number' => $triviData['invoice_number'],
                    'is_presale' => $isPresaleOrder
                ]);
                
                $result = $this->api->sendInvoice($triviData);
            }
            
            // Log sync result to database
            $this->logSync([
                'order_id' => $orderId,
                'trivi_id' => $result['trivi_id'] ?? null,
                'document_type' => $isAdvancePayment ? 'advance' : 'invoice',
                'document_number' => $triviData['invoice_number'] ?? $triviData['advance_number'] ?? null,
                'status' => $result['success'] ? 'success' : 'failed',
                'error_message' => $result['error'] ?? null,
                'request_data' => json_encode($triviData),
                'response_data' => json_encode($result['response'] ?? [])
            ]);
            
            if ($result['success']) {
                $this->log('INFO', 'Order synced to Trivi successfully', [
                    'order_id' => $orderId,
                    'trivi_id' => $result['trivi_id']
                ]);
            } else {
                $this->log('ERROR', 'Failed to sync order to Trivi', [
                    'order_id' => $orderId,
                    'error' => $result['error']
                ]);
            }
            
            return $result;
            
        } catch (Exception $e) {
            $error = 'Trivi integration exception: ' . $e->getMessage();
            
            $this->log('ERROR', $error, [
                'order_id' => $orderId,
                'trace' => $e->getTraceAsString()
            ]);
            
            // Log failed attempt
            $this->logSync([
                'order_id' => $orderId,
                'document_type' => $isAdvancePayment ? 'advance' : 'invoice',
                'status' => 'failed',
                'error_message' => $error
            ]);
            
            return [
                'success' => false,
                'error' => $error,
                'skipped' => false
            ];
        }
    }
    
    /**
     * Resync failed orders (manual retry)
     * 
     * @param string|null $orderId Specific order ID or null for all failed
     * @return array Result summary
     */
    public function resyncFailedOrders(?string $orderId = null): array
    {
        try {
            $query = "SELECT * FROM trivi_sync WHERE status = 'failed'";
            if ($orderId) {
                $query .= " AND order_id = :order_id";
            }
            $query .= " ORDER BY created_at ASC";
            
            $stmt = $this->db->prepare($query);
            if ($orderId) {
                $stmt->bindParam(':order_id', $orderId);
            }
            $stmt->execute();
            
            $failedOrders = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            $results = [
                'total' => count($failedOrders),
                'success' => 0,
                'failed' => 0,
                'details' => []
            ];
            
            foreach ($failedOrders as $row) {
                // Load original order data
                $orderFile = __DIR__ . '/../orders/' . $row['order_id'] . '.json';
                if (!file_exists($orderFile)) {
                    $this->log('WARN', 'Order file not found for resync', [
                        'order_id' => $row['order_id']
                    ]);
                    $results['failed']++;
                    continue;
                }
                
                $order = json_decode(file_get_contents($orderFile), true);
                $isAdvance = $row['document_type'] === 'advance';
                
                $result = $this->processOrder($order, $isAdvance);
                
                if ($result['success']) {
                    $results['success']++;
                } else {
                    $results['failed']++;
                }
                
                $results['details'][] = [
                    'order_id' => $row['order_id'],
                    'success' => $result['success'],
                    'error' => $result['error'] ?? null
                ];
            }
            
            return $results;
            
        } catch (Exception $e) {
            $this->log('ERROR', 'Resync failed: ' . $e->getMessage());
            return [
                'total' => 0,
                'success' => 0,
                'failed' => 0,
                'error' => $e->getMessage()
            ];
        }
    }
    
    /**
     * Check if order is already synced to Trivi
     */
    private function isSynced(string $orderId): bool
    {
        if (!$this->db) return false;
        
        $stmt = $this->db->prepare("SELECT COUNT(*) FROM trivi_sync WHERE order_id = ? AND status = 'success'");
        $stmt->execute([$orderId]);
        
        return $stmt->fetchColumn() > 0;
    }
    
    /**
     * Get next sequence number for invoice/advance series
     * Ensures souvislá číselná řada (continuous number series)
     */
    private function getNextSequenceNumber(string $type): int
    {
        if (!$this->db) return 1;
        
        $year = date('Y');
        
        // Get last sequence number for current year and type
        $stmt = $this->db->prepare("
            SELECT MAX(sequence_number) 
            FROM trivi_sync 
            WHERE document_type = ? 
            AND YEAR(created_at) = ?
        ");
        $stmt->execute([$type, $year]);
        
        $lastNumber = $stmt->fetchColumn();
        
        return ($lastNumber ? intval($lastNumber) : 0) + 1;
    }
    
    /**
     * Log sync attempt to database
     */
    private function logSync(array $data): void
    {
        if (!$this->db) return;
        
        try {
            $stmt = $this->db->prepare("
                INSERT INTO trivi_sync (
                    order_id, trivi_id, document_type, document_number, sequence_number,
                    status, error_message, request_data, response_data, created_at
                ) VALUES (
                    :order_id, :trivi_id, :document_type, :document_number, :sequence_number,
                    :status, :error_message, :request_data, :response_data, NOW()
                )
            ");
            
            $stmt->execute([
                'order_id' => $data['order_id'] ?? null,
                'trivi_id' => $data['trivi_id'] ?? null,
                'document_type' => $data['document_type'] ?? null,
                'document_number' => $data['document_number'] ?? null,
                'sequence_number' => $data['sequence_number'] ?? null,
                'status' => $data['status'] ?? 'pending',
                'error_message' => $data['error_message'] ?? null,
                'request_data' => $data['request_data'] ?? null,
                'response_data' => $data['response_data'] ?? null
            ]);
            
        } catch (PDOException $e) {
            error_log('Failed to log Trivi sync to database: ' . $e->getMessage());
        }
    }
    
    /**
     * Initialize SQLite database for sync tracking
     */
    private function initDatabase(): void
    {
        try {
            $dbFile = __DIR__ . '/../data/trivi_sync.db';
            $dbDir = dirname($dbFile);
            
            if (!is_dir($dbDir)) {
                mkdir($dbDir, 0755, true);
            }
            
            $this->db = new PDO('sqlite:' . $dbFile);
            $this->db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            
            // Create table if not exists
            $this->db->exec("
                CREATE TABLE IF NOT EXISTS trivi_sync (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    order_id TEXT NOT NULL,
                    trivi_id TEXT,
                    document_type TEXT NOT NULL,
                    document_number TEXT,
                    sequence_number INTEGER,
                    status TEXT NOT NULL DEFAULT 'pending',
                    error_message TEXT,
                    request_data TEXT,
                    response_data TEXT,
                    created_at DATETIME NOT NULL,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(order_id)
                )
            ");
            
            $this->db->exec("CREATE INDEX IF NOT EXISTS idx_order_id ON trivi_sync(order_id)");
            $this->db->exec("CREATE INDEX IF NOT EXISTS idx_status ON trivi_sync(status)");
            $this->db->exec("CREATE INDEX IF NOT EXISTS idx_created_at ON trivi_sync(created_at)");
            
        } catch (PDOException $e) {
            error_log('Failed to initialize Trivi sync database: ' . $e->getMessage());
            $this->db = null; // Fallback: continue without database logging
        }
    }
    
    /**
     * Log message to file
     */
    private function log(string $level, string $message, array $context = []): void
    {
        $timestamp = date('Y-m-d H:i:s');
        $contextJson = !empty($context) ? ' ' . json_encode($context, JSON_UNESCAPED_UNICODE) : '';
        
        $logLine = "[{$timestamp}] [{$level}] {$message}{$contextJson}\n";
        
        $logDir = dirname($this->logFile);
        if (!is_dir($logDir)) {
            mkdir($logDir, 0755, true);
        }
        
        file_put_contents($this->logFile, $logLine, FILE_APPEND | LOCK_EX);
        
        if ($level === 'ERROR') {
            error_log("Trivi Integration: {$message}{$contextJson}");
        }
    }
}
