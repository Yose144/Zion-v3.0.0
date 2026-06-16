<?php
/**
 * ZION eShop - Admin Dashboard API
 * Správa objednávek
 */

require_once 'auth.php';

function guessWalletPublicUrlFromImageFile(?string $filename): ?string {
    if (!$filename) {
        return null;
    }

    $base = '';
    if (!empty($_SERVER['HTTP_HOST'])) {
        $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
        $base = $scheme . '://' . $_SERVER['HTTP_HOST'];
    }

    $path = '/V2/wallets/' . ltrim($filename, '/');
    return $base ? ($base . $path) : $path;
}

function normalizeCurrency(?string $currency): string {
    $cur = strtoupper(trim((string)$currency));
    if ($cur === 'EUR' || $cur === '€') {
        return '€';
    }
    if ($cur === 'CZK' || $cur === 'KČ' || $cur === 'KC') {
        return 'Kč';
    }
    return $currency ? trim((string)$currency) : 'Kč';
}

function detectOrderType(array $order, ?string $orderId = null): string {
    $explicit = strtolower((string)($order['type'] ?? $order['_type'] ?? $order['orderType'] ?? ''));
    // Legacy: "presale" is now treated as "software"
    if ($explicit === 'presale' || $explicit === 'software') {
        return 'software';
    }
    if ($explicit === 'eshop') {
        return 'eshop';
    }

    if ($orderId && stripos($orderId, 'PRESALE-') === 0) {
        return 'software';
    }

    $items = $order['items'] ?? null;
    if (is_array($items)) {
        foreach ($items as $it) {
            if (!is_array($it)) {
                continue;
            }
            $cat = strtolower((string)($it['category'] ?? ''));
            $id = strtolower((string)($it['id'] ?? ''));
            if ($cat === 'presale' || $cat === 'software' || strpos($id, 'presale-') === 0) {
                return 'software';
            }
        }
    }

    return 'eshop';
}

function extractPresalePackageName(array $order): ?string {
    $items = $order['items'] ?? null;
    if (!is_array($items)) {
        return null;
    }
    foreach ($items as $it) {
        if (!is_array($it)) {
            continue;
        }
        $cat = strtolower((string)($it['category'] ?? ''));
        $id = strtolower((string)($it['id'] ?? ''));
        if ($cat === 'presale' || $cat === 'software' || strpos($id, 'presale-') === 0) {
            $name = trim((string)($it['name'] ?? ''));
            return $name !== '' ? $name : null;
        }
    }
    return null;
}

function tryBasicAuthLogin(): bool {
    // Allow admin.html to authenticate via Basic Auth and upgrade to a session.
    // Username is optional; password must verify against ADMIN_PASSWORD_HASH.
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    $user = null;
    $pass = null;

    if (!empty($_SERVER['PHP_AUTH_PW'])) {
        $user = $_SERVER['PHP_AUTH_USER'] ?? null;
        $pass = $_SERVER['PHP_AUTH_PW'];
    } elseif (is_string($authHeader) && stripos($authHeader, 'Basic ') === 0) {
        $decoded = base64_decode(substr($authHeader, 6));
        if (is_string($decoded) && strpos($decoded, ':') !== false) {
            [$user, $pass] = explode(':', $decoded, 2);
        }
    }

    if (!$pass) {
        return false;
    }

    // Try hash first (secure), then fallback to plaintext comparison (legacy)
    $hash = getenv('ADMIN_PASSWORD_HASH');
    $plainPassword = getenv('ADMIN_PASSWORD');
    
    $valid = false;
    
    // Option 1: bcrypt hash verification (preferred)
    if ($hash && password_verify($pass, $hash)) {
        $valid = true;
    }
    // Option 2: Plaintext comparison (legacy fallback)
    elseif ($plainPassword && hash_equals($plainPassword, $pass)) {
        $valid = true;
    }

    if (!$valid) {
        return false;
    }

    $_SESSION['admin_logged_in'] = true;
    $_SESSION['last_activity'] = time();
    $_SESSION['admin_user'] = $user ?: 'admin';
    return true;
}

function uniqueByOrderId(array $orders): array {
    $seen = [];
    $out = [];
    foreach ($orders as $o) {
        $id = $o['orderId'] ?? null;
        if (!$id) {
            continue;
        }
        if (isset($seen[$id])) {
            continue;
        }
        $seen[$id] = true;
        $out[] = $o;
    }
    return $out;
}

function findFirstExistingOrderFile(string $orderId, array $dirs): ?string {
    $safe = basename($orderId);
    foreach ($dirs as $dir) {
        $file = rtrim($dir, '/') . '/' . $safe . '.json';
        if (file_exists($file)) {
            return $file;
        }
    }
    return null;
}

// Kontrola autentizace (session nebo Basic Auth fallback)
if (!isLoggedIn()) {
    tryBasicAuthLogin();
}

if (!isLoggedIn()) {
    header('HTTP/1.1 401 Unauthorized');
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

header('Content-Type: application/json');

// Support both current layout (/V2/orders) and legacy layout (outside /V2).
$ordersDirs = [
    __DIR__ . '/../orders',      // public_html/V2/orders
    __DIR__ . '/../../orders',   // public_html/orders (legacy)
];
$presaleDirs = [
    __DIR__ . '/../presale-orders',     // public_html/V2/presale-orders
    __DIR__ . '/../../presale-orders',  // public_html/presale-orders (legacy)
];
$invoicesDirs = [
    __DIR__ . '/../invoices',    // public_html/V2/invoices
    __DIR__ . '/../../invoices', // public_html/invoices (legacy)
];
$presaleInvoicesDirs = [
    __DIR__ . '/../presale-invoices',       // public_html/V2/presale-invoices
    __DIR__ . '/../../presale-invoices',    // public_html/presale-invoices (legacy)
];
$action = $_GET['action'] ?? 'list';

switch ($action) {
    case 'list':
        // Seznam objednávek - čistě oddělené složky
        $orders = [];
        
        // 1. eShop objednávky z /orders/ (current + legacy)
        foreach ($ordersDirs as $ordersDir) {
            if (!is_dir($ordersDir)) {
                continue;
            }
            $files = glob($ordersDir . '/*.json');
            foreach ($files as $file) {
                $order = json_decode(file_get_contents($file), true);
                if (!$order) continue;
                $orderId = $order['orderId'] ?? basename($file, '.json');

                $detectedType = detectOrderType($order, $orderId);
                $currency = normalizeCurrency($order['currency'] ?? ($order['payment']['currency'] ?? null));
                $itemCount = 0;
                if (!empty($order['items']) && is_array($order['items'])) {
                    $itemCount = count($order['items']);
                }
                $packageName = $detectedType === 'software' ? (extractPresalePackageName($order) ?? 'Software (cart)') : null;

                $invoicePath = null;
                foreach ($invoicesDirs as $invDir) {
                    $candidate = rtrim($invDir, '/') . '/invoice_' . $orderId . '.pdf';
                    if (file_exists($candidate)) {
                        $invoicePath = $candidate;
                        break;
                    }
                }
                $hasInvoice = $invoicePath ? true : false;

                $qrUrl = $order['zion']['qr']['serviceUrl'] ?? null;
                if (!$qrUrl && !empty($order['zion']['qr']['imageFile'])) {
                    $qrUrl = guessWalletPublicUrlFromImageFile((string)$order['zion']['qr']['imageFile']);
                }
                
                $orders[] = [
                    'orderId' => $orderId,
                    'customer' => $order['customer']['name'] ?? $order['name'] ?? 'N/A',
                    'email' => $order['customer']['email'] ?? $order['email'] ?? '',
                    'phone' => $order['customer']['phone'] ?? $order['phone'] ?? '',
                    'total' => $order['total'] ?? 0,
                    'currency' => $currency,
                    'payment' => $order['payment']['method'] ?? $order['payment'] ?? '',
                    'status' => $order['status'] ?? 'new',
                    'createdAt' => $order['createdAt'] ?? '',
                    'zionTokens' => $order['zion']['tokens']['totalTokens'] ?? 0,
                    'qrUrl' => $qrUrl,
                    'hasInvoice' => $hasInvoice,
                    'invoiceUrl' => $hasInvoice ? './api/download-invoice.php?orderId=' . $orderId : null,
                    'type' => $detectedType,
                    'itemCount' => $itemCount,
                    'packageName' => $packageName
                ];
            }
        }

        // 2. Presale objednávky z /presale-orders/ (current + legacy)
        foreach ($presaleDirs as $presaleDir) {
            if (!is_dir($presaleDir)) {
                continue;
            }
            $files = glob($presaleDir . '/*.json');
            foreach ($files as $file) {
                $order = json_decode(file_get_contents($file), true);
                if (!$order) continue;
                $orderId = $order['orderId'] ?? basename($file, '.json');
                
                // Presale faktury v presale-invoices nebo invoices
                $invoicePath = null;
                foreach ($presaleInvoicesDirs as $invDir) {
                    $candidate = rtrim($invDir, '/') . '/invoice_' . $orderId . '.pdf';
                    if (file_exists($candidate)) {
                        $invoicePath = $candidate;
                        break;
                    }
                }
                if (!$invoicePath) {
                    foreach ($invoicesDirs as $invDir) {
                        $candidate = rtrim($invDir, '/') . '/invoice_' . $orderId . '.pdf';
                        if (file_exists($candidate)) {
                            $invoicePath = $candidate;
                            break;
                        }
                    }
                }
                $hasInvoice = $invoicePath ? true : false;

                $qrUrl = $order['zion']['qr']['serviceUrl'] ?? null;
                if (!$qrUrl && !empty($order['zion']['qr']['imageFile'])) {
                    $qrUrl = guessWalletPublicUrlFromImageFile((string)$order['zion']['qr']['imageFile']);
                }
                
                $orders[] = [
                    'orderId' => $orderId,
                    'customer' => $order['name'] ?? $order['customer']['name'] ?? 'N/A',
                    'email' => $order['email'] ?? $order['customer']['email'] ?? '',
                    'phone' => $order['phone'] ?? $order['customer']['phone'] ?? '',
                    'total' => $order['package']['priceEur'] ?? $order['total'] ?? 0,
                    'currency' => '€',
                    'payment' => $order['payment']['method'] ?? $order['payment'] ?? 'bank_transfer',
                    'status' => $order['status'] ?? 'pending_payment',
                    'createdAt' => $order['createdAt'] ?? '',
                    'zionTokens' => $order['package']['totalTokens'] ?? $order['totalTokens'] ?? 0,
                    'qrUrl' => $qrUrl,
                    'hasInvoice' => $hasInvoice,
                    'invoiceUrl' => $hasInvoice ? './api/invoice.php?action=view&orderId=' . $orderId : null,
                    'type' => 'software'
                ];
            }
        }

        $orders = uniqueByOrderId($orders);

        // Seřadit od nejnovějších
        usort($orders, function($a, $b) {
            return strtotime($b['createdAt'] ?? '1970-01-01') - strtotime($a['createdAt'] ?? '1970-01-01');
        });
        echo json_encode(['orders' => $orders, 'total' => count($orders)]);
        break;
        
    case 'detail':
        // Detail objednávky - hledá ve správné složce podle typu
        $orderId = $_GET['id'] ?? '';
        $file = findFirstExistingOrderFile($orderId, array_merge($presaleDirs, $ordersDirs));
        $orderType = 'eshop';
        
        if (file_exists($file)) {
            $order = json_decode(file_get_contents($file), true);
            $orderType = detectOrderType($order, $orderId);
            $order['_type'] = $orderType;
            $order['_file'] = basename($file);
            
            // Přidat invoice info
            $invoicePath = null;
            $primaryDirs = $orderType === 'software' ? $presaleInvoicesDirs : $invoicesDirs;
            foreach ($primaryDirs as $invDir) {
                $candidate = rtrim($invDir, '/') . '/invoice_' . $orderId . '.pdf';
                if (file_exists($candidate)) {
                    $invoicePath = $candidate;
                    break;
                }
            }
            if (!$invoicePath) {
                foreach ($invoicesDirs as $invDir) {
                    $candidate = rtrim($invDir, '/') . '/invoice_' . $orderId . '.pdf';
                    if (file_exists($candidate)) {
                        $invoicePath = $candidate;
                        break;
                    }
                }
            }
            $order['_hasInvoice'] = $invoicePath ? true : false;
            $order['_invoiceUrl'] = $order['_hasInvoice'] ? './api/invoice.php?action=view&orderId=' . $orderId : null;
            
            // Přidat distribution status
            $order['_distributionStatus'] = $order['distribution']['status'] ?? 'pending';
            
            echo json_encode(['order' => $order, 'type' => $orderType]);
        } else {
            http_response_code(404);
            echo json_encode(['error' => 'Order not found', 'orderId' => $orderId, 'type' => $orderType]);
        }
        break;
        
    case 'update-status':
        // Aktualizovat stav objednávky - hledá ve správné složce
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
            exit;
        }
        
        $input = json_decode(file_get_contents('php://input'), true);
        $orderId = $input['orderId'] ?? '';
        $newStatus = $input['status'] ?? '';
        
        // Najít objednávku v libovolné podporované složce (current + legacy)
        $file = findFirstExistingOrderFile($orderId, array_merge($presaleDirs, $ordersDirs));
        
        if (file_exists($file)) {
            $order = json_decode(file_get_contents($file), true);
            $order['status'] = $newStatus;
            $order['updatedAt'] = date('c');
            $order['statusHistory'][] = [
                'status' => $newStatus,
                'date' => date('c'),
                'by' => 'admin'
            ];
            file_put_contents($file, json_encode($order, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
            echo json_encode(['success' => true, 'order' => $order]);
        } else {
            http_response_code(404);
            echo json_encode(['error' => 'Order not found', 'file' => $file]);
        }
        break;
        
    case 'stats':
        // Statistiky - oddělené pro eShop a Presale
        $stats = [
            'eshop' => [
                'count' => 0,
                'revenue' => 0,
                'tokens' => 0,
                'byStatus' => []
            ],
            'presale' => [
                'count' => 0,
                'revenue' => 0,
                'tokens' => 0,
                'byStatus' => []
            ],
            'total' => [
                'orders' => 0,
                'revenue' => 0,
                'tokens' => 0
            ]
        ];
        
        // eShop stats
        if (is_dir($ordersDir)) {
            $files = glob($ordersDir . '/*.json');
            foreach ($files as $file) {
                $order = json_decode(file_get_contents($file), true);
                if ($order) {
                    $stats['eshop']['count']++;
                    $stats['eshop']['revenue'] += $order['total'] ?? 0;
                    $stats['eshop']['tokens'] += $order['zion']['tokens']['totalTokens'] ?? 0;
                    
                    $status = $order['status'] ?? 'new';
                    $stats['eshop']['byStatus'][$status] = ($stats['eshop']['byStatus'][$status] ?? 0) + 1;
                }
            }
        }
        
        // Presale stats
        if (is_dir($presaleDir)) {
            $files = glob($presaleDir . '/*.json');
            foreach ($files as $file) {
                $order = json_decode(file_get_contents($file), true);
                if ($order) {
                    $stats['presale']['count']++;
                    $stats['presale']['revenue'] += $order['package']['priceEur'] ?? $order['total'] ?? 0;
                    $stats['presale']['tokens'] += $order['package']['totalTokens'] ?? $order['totalTokens'] ?? 0;
                    
                    $status = $order['status'] ?? 'pending';
                    $stats['presale']['byStatus'][$status] = ($stats['presale']['byStatus'][$status] ?? 0) + 1;
                }
            }
        }
        
        // Totals
        $stats['total']['orders'] = $stats['eshop']['count'] + $stats['presale']['count'];
        $stats['total']['revenue'] = $stats['eshop']['revenue']; // Kč only for totals
        $stats['total']['tokens'] = $stats['eshop']['tokens'] + $stats['presale']['tokens'];
        
        echo json_encode(['stats' => $stats]);
        break;
        
    default:
        http_response_code(400);
        echo json_encode(['error' => 'Invalid action']);
}
