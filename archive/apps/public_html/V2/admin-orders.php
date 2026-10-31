<?php
/**
 * ZION eShop - Admin Dashboard API
 * Správa objednávek
 */

require_once __DIR__ . '/api/auth.php';

// Admin password from .env (loaded in auth.php)
$ADMIN_USER = 'admin';
$ADMIN_PASS = getenv('ADMIN_PASSWORD') ?: 'zion2026';

// Kontrola autentizace - podporuje HTTP Basic Auth i Session
$authenticated = false;

// 1. Zkontrolovat PHP session
if (isLoggedIn()) {
    $authenticated = true;
}

// 2. Zkontrolovat HTTP Basic Auth
if (!$authenticated && isset($_SERVER['PHP_AUTH_USER'])) {
    if ($_SERVER['PHP_AUTH_USER'] === $ADMIN_USER && $_SERVER['PHP_AUTH_PW'] === $ADMIN_PASS) {
        $_SESSION['admin_logged_in'] = true;
        $authenticated = true;
    }
}

// 3. Zkontrolovat Authorization header (pro fetch s credentials)
if (!$authenticated && isset($_SERVER['HTTP_AUTHORIZATION'])) {
    $auth = $_SERVER['HTTP_AUTHORIZATION'];
    if (strpos($auth, 'Basic ') === 0) {
        $decoded = base64_decode(substr($auth, 6));
        list($user, $pass) = explode(':', $decoded, 2);
        if ($user === $ADMIN_USER && $pass === $ADMIN_PASS) {
            $_SESSION['admin_logged_in'] = true;
            $authenticated = true;
        }
    }
}

if (!$authenticated) {
    header('WWW-Authenticate: Basic realm="ZION Admin"');
    header('HTTP/1.0 401 Unauthorized');
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

header('Content-Type: application/json');

$ordersDir = __DIR__ . '/orders';
$presaleDir = __DIR__ . '/presale-orders';
$action = $_GET['action'] ?? 'list';

switch ($action) {
    case 'list':
        // Seznam objednávek
        $orders = [];
        $invoicesDir = __DIR__ . '/invoices';
        
        // Všechny objednávky z /orders/ složky
        if (is_dir($ordersDir)) {
            $files = glob($ordersDir . '/*.json');
            foreach ($files as $file) {
                $order = json_decode(file_get_contents($file), true);
                if (!$order) continue;
                $orderId = $order['orderId'] ?? basename($file, '.json');
                
                // Check for invoice (HTML or PDF)
                $invoiceNumber = $order['invoice']['html']['number'] ?? null;
                $hasInvoice = false;
                if ($invoiceNumber) {
                    $hasInvoice = file_exists($invoicesDir . '/' . $invoiceNumber . '.html') ||
                                  file_exists($invoicesDir . '/invoice_' . $orderId . '.html') ||
                                  file_exists($invoicesDir . '/invoice_' . $orderId . '.pdf');
                } else {
                    $hasInvoice = file_exists($invoicesDir . '/invoice_' . $orderId . '.html') ||
                                  file_exists($invoicesDir . '/invoice_' . $orderId . '.pdf');
                }
                
                // Rozpoznat typ podle prefixu orderId
                $isPresale = strpos($orderId, 'PRESALE-') === 0;
                
                if ($isPresale) {
                    // PRESALE objednávka
                    $orders[] = [
                        'orderId' => $orderId,
                        'customer' => $order['name'] ?? $order['customer']['name'] ?? 'N/A',
                        'email' => $order['email'] ?? $order['customer']['email'] ?? '',
                        'phone' => $order['phone'] ?? $order['customer']['phone'] ?? '',
                        'total' => $order['total'] ?? $order['packagePrice'] ?? 0,
                        'currency' => 'Kč',
                        'payment' => $order['payment']['method'] ?? $order['payment'] ?? 'bank_transfer',
                        'status' => $order['status'] ?? 'pending_payment',
                        'createdAt' => $order['createdAt'] ?? '',
                        'zionTokens' => $order['totalTokens'] ?? $order['package']['totalTokens'] ?? 0,
                        'hasInvoice' => $hasInvoice,
                        'invoiceUrl' => $hasInvoice ? './api/invoice.php?action=view&orderId=' . $orderId : null,
                        'type' => 'presale'
                    ];
                } else {
                    // eShop objednávka
                    $orders[] = [
                        'orderId' => $orderId,
                        'customer' => $order['customer']['name'] ?? $order['name'] ?? 'N/A',
                        'email' => $order['customer']['email'] ?? $order['email'] ?? '',
                        'phone' => $order['customer']['phone'] ?? $order['phone'] ?? '',
                        'total' => $order['total'] ?? 0,
                        'currency' => 'Kč',
                        'payment' => $order['payment']['method'] ?? $order['payment'] ?? '',
                        'status' => $order['status'] ?? 'new',
                        'createdAt' => $order['createdAt'] ?? '',
                        'zionTokens' => $order['zion']['tokens']['totalTokens'] ?? 0,
                        'hasInvoice' => $hasInvoice,
                        'invoiceUrl' => $hasInvoice ? './api/invoice.php?action=view&orderId=' . $orderId : null,
                        'type' => 'eshop'
                    ];
                }
            }
        }

        // Presale objednávky ze staré složky /presale-orders/ (zpětná kompatibilita)
        if (is_dir($presaleDir)) {
            $files = glob($presaleDir . '/*.json');
            foreach ($files as $file) {
                $order = json_decode(file_get_contents($file), true);
                if (!$order) continue;
                $orderId = $order['orderId'] ?? basename($file, '.json');
                
                // Přeskočit pokud už existuje v seznamu
                $exists = false;
                foreach ($orders as $o) {
                    if ($o['orderId'] === $orderId) {
                        $exists = true;
                        break;
                    }
                }
                if ($exists) continue;
                
                $invoicePath = $invoicesDir . '/invoice_' . $orderId . '.pdf';
                $hasInvoice = file_exists($invoicePath);
                $orders[] = [
                    'orderId' => $orderId,
                    'customer' => $order['name'] ?? $order['customer']['name'] ?? 'N/A',
                    'email' => $order['email'] ?? $order['customer']['email'] ?? '',
                    'phone' => $order['phone'] ?? $order['customer']['phone'] ?? '',
                    'total' => $order['total'] ?? $order['package']['priceEur'] ?? 0,
                    'currency' => $order['package']['priceEur'] ? '€' : 'Kč',
                    'payment' => $order['payment']['method'] ?? 'transfer',
                    'status' => $order['status'] ?? 'pending_payment',
                    'createdAt' => $order['createdAt'] ?? '',
                    'zionTokens' => $order['totalTokens'] ?? $order['package']['totalTokens'] ?? 0,
                    'hasInvoice' => $hasInvoice,
                    'invoiceUrl' => $hasInvoice ? './api/invoice.php?action=view&orderId=' . $orderId : null,
                    'type' => 'presale'
                ];
            }
        }

        // Seřadit od nejnovějších (kombinovaně)
        usort($orders, function($a, $b) {
            return strtotime($b['createdAt'] ?? '1970-01-01') - strtotime($a['createdAt'] ?? '1970-01-01');
        });
        echo json_encode(['orders' => $orders, 'total' => count($orders)]);
        break;
        
    case 'detail':
        // Detail objednávky - hledá v orders i presale-orders
        $orderId = $_GET['id'] ?? '';
        $file = null;
        $orderType = 'eshop';
        
        // Hledat v eShop orders
        $eshopFile = $ordersDir . '/' . basename($orderId) . '.json';
        if (file_exists($eshopFile)) {
            $file = $eshopFile;
            $orderType = 'eshop';
        }
        
        // Hledat v presale orders
        if (!$file && is_dir($presaleDir)) {
            $presaleFile = $presaleDir . '/' . basename($orderId) . '.json';
            if (file_exists($presaleFile)) {
                $file = $presaleFile;
                $orderType = 'presale';
            }
        }
        
        // Hledat v orders/presale podsložce
        if (!$file) {
            $presaleSubFile = $ordersDir . '/presale/' . basename($orderId) . '.json';
            if (file_exists($presaleSubFile)) {
                $file = $presaleSubFile;
                $orderType = 'presale';
            }
        }
        
        if ($file && file_exists($file)) {
            $order = json_decode(file_get_contents($file), true);
            $order['_type'] = $orderType;
            $order['_file'] = basename($file);
            
            // Přidat invoice info (check HTML or PDF)
            $invoicesDir = __DIR__ . '/invoices';
            $invoiceNumber = $order['invoice']['html']['number'] ?? null;
            $hasInvoice = false;
            if ($invoiceNumber) {
                $hasInvoice = file_exists($invoicesDir . '/' . $invoiceNumber . '.html') ||
                              file_exists($invoicesDir . '/invoice_' . $orderId . '.html') ||
                              file_exists($invoicesDir . '/invoice_' . $orderId . '.pdf');
            } else {
                $hasInvoice = file_exists($invoicesDir . '/invoice_' . $orderId . '.html') ||
                              file_exists($invoicesDir . '/invoice_' . $orderId . '.pdf');
            }
            $order['_hasInvoice'] = $hasInvoice;
            $order['_invoiceUrl'] = $hasInvoice ? './api/invoice.php?action=view&orderId=' . $orderId : null;
            
            // Přidat distribution status
            $order['_distributionStatus'] = $order['distribution']['status'] ?? 'pending';
            
            echo json_encode(['order' => $order, 'type' => $orderType]);
        } else {
            http_response_code(404);
            echo json_encode(['error' => 'Order not found', 'searchedPaths' => [
                $ordersDir . '/' . basename($orderId) . '.json',
                $presaleDir . '/' . basename($orderId) . '.json',
                $ordersDir . '/presale/' . basename($orderId) . '.json'
            ]]);
        }
        break;
        
    case 'update-status':
        // Aktualizovat stav objednávky
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
            exit;
        }
        
        $input = json_decode(file_get_contents('php://input'), true);
        $orderId = $input['orderId'] ?? '';
        $newStatus = $input['status'] ?? '';
        
        $file = $ordersDir . '/' . basename($orderId) . '.json';
        
        if (file_exists($file)) {
            $order = json_decode(file_get_contents($file), true);
            $order['status'] = $newStatus;
            $order['statusHistory'][] = [
                'status' => $newStatus,
                'date' => date('c'),
                'by' => 'admin'
            ];
            file_put_contents($file, json_encode($order, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
            echo json_encode(['success' => true, 'order' => $order]);
        } else {
            http_response_code(404);
            echo json_encode(['error' => 'Order not found']);
        }
        break;
        
    case 'stats':
        // Statistiky
        $stats = [
            'totalOrders' => 0,
            'totalRevenue' => 0,
            'totalTokens' => 0,
            'byStatus' => [],
            'byPayment' => []
        ];
        
        if (is_dir($ordersDir)) {
            $files = glob($ordersDir . '/*.json');
            foreach ($files as $file) {
                $order = json_decode(file_get_contents($file), true);
                if ($order) {
                    $stats['totalOrders']++;
                    $stats['totalRevenue'] += $order['total'] ?? 0;
                    $stats['totalTokens'] += $order['zion']['tokens']['totalTokens'] ?? 0;
                    
                    $status = $order['status'] ?? 'new';
                    $stats['byStatus'][$status] = ($stats['byStatus'][$status] ?? 0) + 1;
                    
                    $payment = $order['payment'] ?? 'unknown';
                    $stats['byPayment'][$payment] = ($stats['byPayment'][$payment] ?? 0) + 1;
                }
            }
        }
        echo json_encode(['stats' => $stats]);
        break;
        
    default:
        http_response_code(400);
        echo json_encode(['error' => 'Invalid action']);
}
