<?php
/**
 * ZION Admin Dashboard V2
 * - Eshop + Presale objednávky
 * - Token statistiky
 * - Wallet ledger
 * - MainNet payout tracking
 */

header('Content-Type: text/html; charset=utf-8');

// Auth
require_once 'auth.php';
requireLogin();

// Load orders
function loadOrders($dir, $type) {
    $orders = [];
    if (is_dir($dir)) {
        foreach (glob($dir . '/*.json') as $file) {
            $data = json_decode(file_get_contents($file), true);
            if ($data) {
                $data['_type'] = $type;
                $data['_file'] = basename($file);
                $orders[] = $data;
            }
        }
    }
    return $orders;
}

$eshopOrders = loadOrders(__DIR__ . '/../orders', 'eshop');
$presaleOrders = loadOrders(__DIR__ . '/../presale-orders', 'presale');
$allOrders = array_merge($eshopOrders, $presaleOrders);

// Sort by date (newest first)
usort($allOrders, function($a, $b) {
    $dateA = $a['createdAt'] ?? $a['timestamp'] ?? '1970-01-01';
    $dateB = $b['createdAt'] ?? $b['timestamp'] ?? '1970-01-01';
    return strtotime($dateB) - strtotime($dateA);
});

// Stats
$totalEshopTokens = 0;
$totalPresaleTokens = 0;
$totalEshopRevenue = 0;
$totalPresaleRevenue = 0;

foreach ($eshopOrders as $o) {
    $totalEshopTokens += (int)($o['zion']['tokens']['totalTokens'] ?? 0);
    $totalEshopRevenue += (float)($o['total'] ?? 0);
}

foreach ($presaleOrders as $o) {
    $totalPresaleTokens += (int)($o['package']['totalTokens'] ?? 0);
    $totalPresaleRevenue += (float)($o['package']['priceEur'] ?? 0) * 25; // EUR to CZK approx
}

$totalTokens = $totalEshopTokens + $totalPresaleTokens;
?>
<!DOCTYPE html>
<html lang="cs">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🌿 ZION Admin Dashboard V2</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; background: #0a0a0a; color: #e0e0e0; }
        .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
        
        .header { 
            background: linear-gradient(135deg, #228B22 0%, #FFD700 50%, #DC143C 100%);
            padding: 30px; border-radius: 16px; margin-bottom: 30px; text-align: center;
        }
        .header h1 { color: #000; font-size: 2.5rem; text-shadow: 2px 2px 4px rgba(255,255,255,0.3); }
        .header p { color: #222; font-size: 1.1rem; margin-top: 10px; }
        
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .stat-card { background: #1a1a1a; border: 1px solid #333; border-radius: 12px; padding: 25px; text-align: center; }
        .stat-card.presale { border-color: #FFD700; }
        .stat-card.eshop { border-color: #00ff7f; }
        .stat-card.total { border-color: #DC143C; background: linear-gradient(135deg, rgba(34,139,34,0.2), rgba(255,215,0,0.1)); }
        .stat-number { font-size: 2.2rem; font-weight: bold; margin-bottom: 8px; }
        .stat-number.gold { color: #FFD700; }
        .stat-number.green { color: #00ff7f; }
        .stat-number.red { color: #DC143C; }
        .stat-label { color: #888; font-size: 0.9rem; }
        
        .tabs { display: flex; gap: 10px; margin-bottom: 20px; }
        .tab { padding: 12px 24px; background: #222; border: none; color: #888; border-radius: 8px; cursor: pointer; font-size: 1rem; transition: all 0.3s; }
        .tab:hover { background: #333; color: #fff; }
        .tab.active { background: #FFD700; color: #000; font-weight: bold; }
        
        table { width: 100%; border-collapse: collapse; background: #1a1a1a; border-radius: 12px; overflow: hidden; }
        th { background: #222; color: #FFD700; padding: 15px; text-align: left; font-weight: 600; }
        td { padding: 12px 15px; border-bottom: 1px solid #333; }
        tr:hover { background: #252525; }
        
        .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: bold; }
        .badge-presale { background: #FFD700; color: #000; }
        .badge-eshop { background: #00ff7f; color: #000; }
        .badge-pending { background: #ff9800; color: #000; }
        .badge-paid { background: #4caf50; color: #fff; }
        .badge-sent { background: #2196f3; color: #fff; }
        
        .wallet-addr { font-family: monospace; font-size: 0.85rem; color: #00ff7f; }
        .mnemonic { font-family: monospace; font-size: 0.75rem; color: #888; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        
        .btn { padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; font-size: 0.9rem; transition: all 0.2s; }
        .btn-primary { background: #FFD700; color: #000; }
        .btn-primary:hover { background: #ffc000; }
        .btn-success { background: #00ff7f; color: #000; }
        .btn-danger { background: #DC143C; color: #fff; }
        
        .login-form { max-width: 400px; margin: 100px auto; background: #1a1a1a; padding: 40px; border-radius: 16px; border: 2px solid #FFD700; }
        .login-form h2 { color: #FFD700; margin-bottom: 20px; text-align: center; }
        .login-form input { width: 100%; padding: 12px; margin-bottom: 15px; border: 1px solid #333; border-radius: 8px; background: #222; color: #fff; }
        .login-form button { width: 100%; }
        
        .mainnet-banner { background: linear-gradient(90deg, #228B22, #FFD700); padding: 20px; border-radius: 12px; margin-bottom: 30px; text-align: center; }
        .mainnet-banner h3 { color: #000; margin-bottom: 10px; }
        .mainnet-banner p { color: #222; }
    </style>
</head>
<body>
<div class="container">
    <div class="header">
        <h1>🌿 ZION Admin Dashboard</h1>
        <p>eShop + Presale Management | MainNet Payout Tracking</p>
    </div>
    
    <div class="mainnet-banner">
        <h3>🚀 MainNet Launch: 31. prosince 2027</h3>
        <p>Po spuštění MainNetu budou tokeny automaticky odeslány na adresy zákazníků</p>
    </div>
    
    <div class="stats-grid">
        <div class="stat-card presale">
            <div class="stat-number gold"><?= number_format($totalPresaleTokens) ?></div>
            <div class="stat-label">Presale Tokeny</div>
        </div>
        <div class="stat-card eshop">
            <div class="stat-number green"><?= number_format($totalEshopTokens) ?></div>
            <div class="stat-label">eShop Tokeny</div>
        </div>
        <div class="stat-card total">
            <div class="stat-number red"><?= number_format($totalTokens) ?></div>
            <div class="stat-label">CELKEM K ODESLÁNÍ</div>
        </div>
        <div class="stat-card">
            <div class="stat-number gold"><?= count($presaleOrders) ?></div>
            <div class="stat-label">Presale Objednávek</div>
        </div>
        <div class="stat-card">
            <div class="stat-number green"><?= count($eshopOrders) ?></div>
            <div class="stat-label">eShop Objednávek</div>
        </div>
        <div class="stat-card">
            <div class="stat-number"><?= number_format($totalPresaleRevenue + $totalEshopRevenue) ?> Kč</div>
            <div class="stat-label">Celková Tržba</div>
        </div>
    </div>
    
    <div class="tabs">
        <button class="tab active" onclick="showTab('all')">Všechny (<?= count($allOrders) ?>)</button>
        <button class="tab" onclick="showTab('presale')">Presale (<?= count($presaleOrders) ?>)</button>
        <button class="tab" onclick="showTab('eshop')">eShop (<?= count($eshopOrders) ?>)</button>
    </div>
    
    <table id="orders-table">
        <thead>
            <tr>
                <th>Typ</th>
                <th>Order ID</th>
                <th>Datum</th>
                <th>Zákazník</th>
                <th>Tokeny</th>
                <th>Wallet</th>
                <th>Status</th>
                <th>Akce</th>
            </tr>
        </thead>
        <tbody>
        <?php foreach ($allOrders as $order): 
            $type = $order['_type'];
            $orderId = $order['orderId'] ?? 'N/A';
            $date = $order['createdAt'] ?? $order['timestamp'] ?? 'N/A';
            $email = $order['customer']['email'] ?? 'N/A';
            $name = $order['customer']['name'] ?? '';
            
            if ($type === 'presale') {
                $tokens = $order['package']['totalTokens'] ?? 0;
                $wallet = $order['zion']['wallet']['address'] ?? 'N/A';
                $mnemonic = $order['zion']['wallet']['mnemonic'] ?? '';
            } else {
                $tokens = $order['zion']['tokens']['totalTokens'] ?? 0;
                $wallet = $order['zion']['wallet']['id'] ?? 'N/A';
                $mnemonic = $order['zion']['wallet']['mnemonic'] ?? '';
            }
            
            $paymentStatus = $order['payment']['status'] ?? 'pending';
            $tokensSent = $order['tokensSent'] ?? false;
        ?>
        <tr data-type="<?= $type ?>">
            <td><span class="badge badge-<?= $type ?>"><?= strtoupper($type) ?></span></td>
            <td><strong><?= htmlspecialchars($orderId) ?></strong></td>
            <td><?= date('d.m.Y H:i', strtotime($date)) ?></td>
            <td>
                <?= htmlspecialchars($name ?: $email) ?><br>
                <small style="color:#888"><?= htmlspecialchars($email) ?></small>
            </td>
            <td><strong style="color:#FFD700"><?= number_format($tokens) ?> ZION</strong></td>
            <td>
                <div class="wallet-addr" title="<?= htmlspecialchars($wallet) ?>"><?= substr($wallet, 0, 20) ?>...</div>
                <?php if ($mnemonic): ?>
                <div class="mnemonic" title="<?= htmlspecialchars($mnemonic) ?>">🔑 <?= substr($mnemonic, 0, 30) ?>...</div>
                <?php endif; ?>
            </td>
            <td>
                <span class="badge badge-<?= $paymentStatus ?>"><?= strtoupper($paymentStatus) ?></span>
                <?php if ($tokensSent): ?>
                <span class="badge badge-sent">SENT</span>
                <?php endif; ?>
            </td>
            <td>
                <button class="btn btn-primary" onclick="viewOrder('<?= $orderId ?>')">Detail</button>
            </td>
        </tr>
        <?php endforeach; ?>
        </tbody>
    </table>
    
    <script>
    function showTab(type) {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        event.target.classList.add('active');
        
        document.querySelectorAll('#orders-table tbody tr').forEach(row => {
            if (type === 'all' || row.dataset.type === type) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    }
    
    function viewOrder(orderId) {
        alert('Detail objednávky: ' + orderId + '\n\nTato funkce bude implementována.');
    }
    </script>
</div>
</body>
</html>
