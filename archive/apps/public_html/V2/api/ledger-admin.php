<?php
/**
 * ZION Token Ledger Admin API
 * 
 * Endpoint pro správu token ledgeru v admin panelu
 * KRITICKÉ: Tento ledger obsahuje záznamy pro MainNet distribuci
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Cesta k ledger souboru
$ledgerFile = __DIR__ . '/../wallets/ledger.json';

// Pomocná funkce pro načtení ledgeru
function loadLedger($file) {
    if (!file_exists($file)) {
        return [];
    }
    
    $content = file_get_contents($file);
    $data = json_decode($content, true);
    
    return is_array($data) ? $data : [];
}

// Pomocná funkce pro uložení ledgeru
function saveLedger($file, $data) {
    $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    
    // Záloha před uložením
    if (file_exists($file)) {
        $backupFile = $file . '.backup-' . date('Y-m-d-His');
        copy($file, $backupFile);
    }
    
    return file_put_contents($file, $json) !== false;
}

// Generování unikátního ID
function generateId() {
    return 'LED-' . strtoupper(bin2hex(random_bytes(4))) . '-' . time();
}

// Získání akce
$action = $_GET['action'] ?? 'list';

try {
    switch ($action) {
        
        // ============================================
        // LIST - Vrátí všechny záznamy
        // ============================================
        case 'list':
            $ledger = loadLedger($ledgerFile);
            
            // Seřadit od nejnovějšího
            usort($ledger, function($a, $b) {
                $dateA = strtotime($a['createdAt'] ?? '2000-01-01');
                $dateB = strtotime($b['createdAt'] ?? '2000-01-01');
                return $dateB - $dateA;
            });
            
            echo json_encode([
                'success' => true,
                'data' => $ledger,
                'count' => count($ledger),
                'totalTokens' => array_sum(array_column($ledger, 'tokens'))
            ]);
            break;
            
        // ============================================
        // GET - Vrátí jeden záznam
        // ============================================
        case 'get':
            $id = $_GET['id'] ?? null;
            
            if (!$id) {
                throw new Exception('Chybí ID záznamu');
            }
            
            $ledger = loadLedger($ledgerFile);
            $entry = null;
            
            foreach ($ledger as $item) {
                if ($item['id'] === $id) {
                    $entry = $item;
                    break;
                }
            }
            
            if (!$entry) {
                throw new Exception('Záznam nenalezen');
            }
            
            echo json_encode([
                'success' => true,
                'data' => $entry
            ]);
            break;
            
        // ============================================
        // ADD - Přidá nový záznam
        // ============================================
        case 'add':
            if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
                throw new Exception('Vyžadována metoda POST');
            }
            
            $input = json_decode(file_get_contents('php://input'), true);
            
            if (!$input) {
                throw new Exception('Neplatná vstupní data');
            }
            
            // Validace povinných polí
            if (empty($input['wallet'])) {
                throw new Exception('Wallet adresa je povinná');
            }
            
            if (empty($input['tokens']) || !is_numeric($input['tokens'])) {
                throw new Exception('Počet tokenů musí být číslo');
            }
            
            $ledger = loadLedger($ledgerFile);
            
            // Vytvoření nového záznamu
            $newEntry = [
                'id' => generateId(),
                'orderId' => $input['orderId'] ?? null,
                'walletId' => 'ADMIN-' . strtoupper(substr(md5($input['wallet']), 0, 8)),
                'wallet' => trim($input['wallet']),
                'walletUri' => trim($input['wallet']),
                'tokens' => (int)$input['tokens'],
                'status' => 'pending',
                'source' => $input['source'] ?? 'manual',
                'note' => $input['note'] ?? null,
                'network' => 'mainnet',
                'txHash' => null,
                'createdAt' => date('Y-m-d H:i:s'),
                'updatedAt' => date('Y-m-d H:i:s')
            ];
            
            // Přidání do ledgeru
            $ledger[] = $newEntry;
            
            if (!saveLedger($ledgerFile, $ledger)) {
                throw new Exception('Nepodařilo se uložit ledger');
            }
            
            echo json_encode([
                'success' => true,
                'message' => 'Záznam úspěšně přidán',
                'data' => $newEntry
            ]);
            break;
            
        // ============================================
        // UPDATE - Aktualizuje záznam
        // ============================================
        case 'update':
            if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
                throw new Exception('Vyžadována metoda POST');
            }
            
            $id = $_GET['id'] ?? null;
            if (!$id) {
                throw new Exception('Chybí ID záznamu');
            }
            
            $input = json_decode(file_get_contents('php://input'), true);
            
            if (!$input) {
                throw new Exception('Neplatná vstupní data');
            }
            
            $ledger = loadLedger($ledgerFile);
            $found = false;
            
            foreach ($ledger as &$entry) {
                if ($entry['id'] === $id) {
                    // Aktualizace povolených polí
                    $allowedFields = ['status', 'txHash', 'tokens', 'note'];
                    
                    foreach ($allowedFields as $field) {
                        if (isset($input[$field])) {
                            $entry[$field] = $input[$field];
                        }
                    }
                    
                    $entry['updatedAt'] = date('Y-m-d H:i:s');
                    $found = true;
                    break;
                }
            }
            
            if (!$found) {
                throw new Exception('Záznam nenalezen');
            }
            
            if (!saveLedger($ledgerFile, $ledger)) {
                throw new Exception('Nepodařilo se uložit změny');
            }
            
            echo json_encode([
                'success' => true,
                'message' => 'Záznam aktualizován'
            ]);
            break;
            
        // ============================================
        // DELETE - Smaže záznam
        // ============================================
        case 'delete':
            if ($_SERVER['REQUEST_METHOD'] !== 'DELETE') {
                throw new Exception('Vyžadována metoda DELETE');
            }
            
            $id = $_GET['id'] ?? null;
            if (!$id) {
                throw new Exception('Chybí ID záznamu');
            }
            
            $ledger = loadLedger($ledgerFile);
            $originalCount = count($ledger);
            
            $ledger = array_values(array_filter($ledger, function($entry) use ($id) {
                return $entry['id'] !== $id;
            }));
            
            if (count($ledger) === $originalCount) {
                throw new Exception('Záznam nenalezen');
            }
            
            if (!saveLedger($ledgerFile, $ledger)) {
                throw new Exception('Nepodařilo se smazat záznam');
            }
            
            echo json_encode([
                'success' => true,
                'message' => 'Záznam smazán'
            ]);
            break;
            
        // ============================================
        // STATS - Statistiky ledgeru
        // ============================================
        case 'stats':
            $ledger = loadLedger($ledgerFile);
            
            $stats = [
                'totalEntries' => count($ledger),
                'totalTokens' => array_sum(array_column($ledger, 'tokens')),
                'byStatus' => [
                    'pending' => 0,
                    'confirmed' => 0,
                    'distributed' => 0,
                    'cancelled' => 0
                ],
                'bySource' => []
            ];
            
            foreach ($ledger as $entry) {
                $status = $entry['status'] ?? 'pending';
                if (isset($stats['byStatus'][$status])) {
                    $stats['byStatus'][$status]++;
                }
                
                $source = $entry['source'] ?? 'unknown';
                if (!isset($stats['bySource'][$source])) {
                    $stats['bySource'][$source] = 0;
                }
                $stats['bySource'][$source]++;
            }
            
            echo json_encode([
                'success' => true,
                'stats' => $stats
            ]);
            break;
            
        // ============================================
        // EXPORT - Export ledgeru
        // ============================================
        case 'export':
            $format = $_GET['format'] ?? 'json';
            $ledger = loadLedger($ledgerFile);
            
            if ($format === 'csv') {
                header('Content-Type: text/csv');
                header('Content-Disposition: attachment; filename="zion-ledger-' . date('Y-m-d') . '.csv"');
                
                $output = fopen('php://output', 'w');
                
                // Header
                fputcsv($output, ['ID', 'Order ID', 'Wallet ID', 'Wallet Address', 'Tokens', 'Status', 'Source', 'Created', 'TX Hash']);
                
                // Data
                foreach ($ledger as $entry) {
                    fputcsv($output, [
                        $entry['id'] ?? '',
                        $entry['orderId'] ?? '',
                        $entry['walletId'] ?? '',
                        $entry['wallet'] ?? '',
                        $entry['tokens'] ?? 0,
                        $entry['status'] ?? '',
                        $entry['source'] ?? '',
                        $entry['createdAt'] ?? '',
                        $entry['txHash'] ?? ''
                    ]);
                }
                
                fclose($output);
                exit;
            } else {
                header('Content-Disposition: attachment; filename="zion-ledger-' . date('Y-m-d') . '.json"');
                echo json_encode($ledger, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
            }
            break;
            
        default:
            throw new Exception('Neznámá akce: ' . $action);
    }
    
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
