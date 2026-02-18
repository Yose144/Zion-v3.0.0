<?php
/**
 * ZION eShop - API pro faktury
 * Endpoint: /api/invoice.php
 * Podporuje HTML i PDF faktury
 */

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/generate-invoice.php';
require_once 'auth.php';

// Basic Auth pro admin akce
function requireAdminAuth(): bool {
    if (isLoggedIn()) {
        return true;
    }
    
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized']);
    return false;
}

/**
 * Najde fakturu pro orderId (HTML nebo PDF)
 */
function findInvoiceFile(string $orderId): ?array {
    $invoicesDir = __DIR__ . '/../invoices';
    
    // Priorita: HTML > PDF
    $candidates = [
        $invoicesDir . '/invoice_' . $orderId . '.html' => 'text/html',
        $invoicesDir . '/invoice_' . $orderId . '.pdf' => 'application/pdf',
    ];
    
    // Zkusit také formát FV2026-ORDID
    $shortId = substr(preg_replace('/[^A-Z0-9]/i', '', $orderId), 0, 10);
    $candidates[$invoicesDir . '/FV' . date('Y') . '-' . $shortId . '.html'] = 'text/html';
    
    foreach ($candidates as $path => $mime) {
        if (file_exists($path)) {
            return [
                'path' => $path,
                'mime' => $mime,
                'extension' => pathinfo($path, PATHINFO_EXTENSION)
            ];
        }
    }
    
    return null;
}

$action = $_GET['action'] ?? 'get';
$orderId = $_GET['orderId'] ?? null;

switch ($action) {
    
    // Zobrazit fakturu (HTML nebo PDF)
    case 'view':
        if (!$orderId) {
            http_response_code(400);
            header('Content-Type: application/json');
            echo json_encode(['error' => 'Chybí orderId']);
            exit;
        }
        
        $invoice = findInvoiceFile($orderId);
        
        // Pokud faktura neexistuje, zkusit vygenerovat
        if (!$invoice) {
            // Pokus 1: eShop objednávky
            $ordersDir = __DIR__ . '/../orders';
            $orderFile = $ordersDir . '/' . $orderId . '.json';
            // Pokus 2: Presale objednávky
            if (!file_exists($orderFile)) {
                $ordersDir = __DIR__ . '/../presale-orders';
                $orderFile = $ordersDir . '/' . $orderId . '.json';
            }
            if (!file_exists($orderFile)) {
                http_response_code(404);
                header('Content-Type: application/json');
                echo json_encode(['error' => 'Objednávka nenalezena']);
                exit;
            }
            
            $order = json_decode(file_get_contents($orderFile), true);
            $result = generateInvoice($order);
            
            if (!$result['success']) {
                http_response_code(500);
                header('Content-Type: application/json');
                echo json_encode(['error' => 'Nepodařilo se vygenerovat fakturu', 'details' => $result]);
                exit;
            }
            
            // Zkusit znovu najít
            $invoice = findInvoiceFile($orderId);
            if (!$invoice && !empty($result['output_path']) && file_exists($result['output_path'])) {
                $ext = pathinfo($result['output_path'], PATHINFO_EXTENSION);
                $invoice = [
                    'path' => $result['output_path'],
                    'mime' => $ext === 'html' ? 'text/html' : 'application/pdf',
                    'extension' => $ext
                ];
            }
        }
        
        if (!$invoice || !file_exists($invoice['path'])) {
            http_response_code(404);
            header('Content-Type: application/json');
            echo json_encode(['error' => 'Faktura nebyla nalezena']);
            exit;
        }
        
        // Zobrazit fakturu
        header('Content-Type: ' . $invoice['mime']);
        $disposition = $invoice['extension'] === 'pdf' ? 'inline' : 'inline';
        header('Content-Disposition: ' . $disposition . '; filename="faktura_' . $orderId . '.' . $invoice['extension'] . '"');
        header('Content-Length: ' . filesize($invoice['path']));
        readfile($invoice['path']);
        exit;
        
    // Stáhnout fakturu
    case 'download':
        if (!$orderId) {
            http_response_code(400);
            header('Content-Type: application/json');
            echo json_encode(['error' => 'Chybí orderId']);
            exit;
        }
        
        $invoice = findInvoiceFile($orderId);
        
        if (!$invoice || !file_exists($invoice['path'])) {
            http_response_code(404);
            header('Content-Type: application/json');
            echo json_encode(['error' => 'Faktura nenalezena']);
            exit;
        }
        
        header('Content-Type: ' . $invoice['mime']);
        header('Content-Disposition: attachment; filename="faktura_' . $orderId . '.' . $invoice['extension'] . '"');
        header('Content-Length: ' . filesize($invoice['path']));
        readfile($invoice['path']);
        exit;
        
    // Seznam všech faktur (admin)
    case 'list':
        if (!requireAdminAuth()) exit;
        header('Content-Type: application/json');
        
        $invoicesDir = __DIR__ . '/../invoices';
        $invoices = [];
        
        if (is_dir($invoicesDir)) {
            // HTML faktury
            foreach (glob($invoicesDir . '/invoice_*.html') as $file) {
                $filename = basename($file);
                preg_match('/invoice_(.*?)\.html/', $filename, $matches);
                $orderId = $matches[1] ?? null;
                
                if ($orderId) {
                    $invoices[$orderId] = [
                        'orderId' => $orderId,
                        'filename' => $filename,
                        'type' => 'html',
                        'size' => filesize($file),
                        'created' => date('Y-m-d H:i:s', filemtime($file)),
                        'url' => './api/invoice.php?action=view&orderId=' . $orderId
                    ];
                }
            }
            
            // PDF faktury
            foreach (glob($invoicesDir . '/invoice_*.pdf') as $file) {
                $filename = basename($file);
                preg_match('/invoice_(.*?)\.pdf/', $filename, $matches);
                $orderId = $matches[1] ?? null;
                
                if ($orderId && !isset($invoices[$orderId])) {
                    $invoices[$orderId] = [
                        'orderId' => $orderId,
                        'filename' => $filename,
                        'type' => 'pdf',
                        'size' => filesize($file),
                        'created' => date('Y-m-d H:i:s', filemtime($file)),
                        'url' => './api/invoice.php?action=view&orderId=' . $orderId
                    ];
                }
            }
            
            // FV formát HTML
            foreach (glob($invoicesDir . '/FV*.html') as $file) {
                $filename = basename($file);
                $invoices[] = [
                    'orderId' => pathinfo($filename, PATHINFO_FILENAME),
                    'filename' => $filename,
                    'type' => 'html',
                    'size' => filesize($file),
                    'created' => date('Y-m-d H:i:s', filemtime($file)),
                    'url' => './invoices/' . $filename
                ];
            }
        }
        
        $invoicesList = array_values($invoices);
        
        // Seřadit od nejnovější
        usort($invoicesList, function($a, $b) {
            return strcmp($b['created'], $a['created']);
        });
        
        echo json_encode([
            'success' => true,
            'count' => count($invoicesList),
            'invoices' => $invoicesList
        ]);
        break;
        
    // Regenerovat fakturu (admin)
    case 'regenerate':
        header('Content-Type: application/json');
        
        if (!$orderId) {
            http_response_code(400);
            echo json_encode(['error' => 'Chybí orderId']);
            exit;
        }
        
        try {
            // eShop → presale fallback
            $ordersDir = __DIR__ . '/../orders';
            $orderFile = $ordersDir . '/' . $orderId . '.json';
            if (!file_exists($orderFile)) {
                $ordersDir = __DIR__ . '/../presale-orders';
                $orderFile = $ordersDir . '/' . $orderId . '.json';
            }
            
            if (!file_exists($orderFile)) {
                http_response_code(404);
                echo json_encode(['error' => 'Objednávka nenalezena', 'path' => $orderFile]);
                exit;
            }
            
            // Smazat staré faktury
            $invoicesDir = __DIR__ . '/../invoices';
            foreach (['pdf', 'html'] as $ext) {
                $oldFile = $invoicesDir . '/invoice_' . $orderId . '.' . $ext;
                if (file_exists($oldFile)) {
                    @unlink($oldFile);
                }
            }
            
            // Vygenerovat novou
            $order = json_decode(file_get_contents($orderFile), true);
            if (!$order) {
                throw new Exception('Invalid order JSON');
            }
            
            $result = generateInvoice($order);
            
            if ($result['success']) {
                echo json_encode([
                    'success' => true,
                    'message' => 'Faktura byla regenerována',
                    'invoice' => [
                        'path' => $result['output_path'],
                        'url' => getInvoiceUrl($result['output_path']),
                        'number' => $result['invoice_number'] ?? null
                    ]
                ]);
            } else {
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'error' => 'Nepodařilo se vygenerovat fakturu',
                    'details' => $result
                ]);
            }
        } catch (Throwable $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
        }
        break;
        
    default:
        http_response_code(400);
        echo json_encode(['error' => 'Neznámá akce: ' . $action]);
}
