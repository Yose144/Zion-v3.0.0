<?php
/**
 * ZION eShop - Rasta Admin Dashboard
 * Přehledná správa objednávek
 */

require_once __DIR__ . '/env-loader.php';
require_once 'auth.php';
requireLogin();

header('Content-Type: text/html; charset=utf-8');

// Pokud chce logout
if (isset($_GET['logout'])) {
    logout();
    header('Location: admin-login.php');
    exit;
}

?><!DOCTYPE html>
<html lang="cs">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Dashboard - <?php echo SHOP_NAME; ?></title>
    <link rel="stylesheet" href="../style.css">
    <link rel="stylesheet" href="../rasta.css">
    <script src="https://kit.fontawesome.com/16464afad1.js" crossorigin="anonymous"></script>
    <style>
        .admin-container {
            min-height: 100vh;
            background: linear-gradient(135deg, #0a0a0a 0%, #1a1a0a 100%);
            padding: 20px;
        }
        .admin-header {
            background: linear-gradient(135deg, var(--rasta-red), var(--rasta-gold), var(--rasta-green));
            color: #000;
            padding: 40px 20px;
            border-radius: 15px;
            margin-bottom: 30px;
            text-align: center;
            box-shadow: 0 10px 40px rgba(255, 193, 7, 0.3);
        }
        .admin-header h1 {
            font-size: 2.5rem;
            margin: 0 0 10px 0;
            font-weight: bold;
        }
        .admin-header p {
            font-size: 1.1rem;
            margin: 0;
            opacity: 0.9;
        }
        .logout-btn {
            position: absolute;
            top: 20px;
            right: 20px;
            background: var(--rasta-red);
            color: white;
            padding: 10px 20px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            text-decoration: none;
            font-weight: bold;
            transition: all 0.3s;
        }
        .logout-btn:hover {
            background: #cc0000;
            transform: translateY(-2px);
        }
        .login-container {
            max-width: 500px;
            margin: 100px auto;
        }
        .login-form {
            background: rgba(0, 0, 0, 0.5);
            border: 2px solid var(--rasta-gold);
            padding: 40px;
            border-radius: 15px;
            backdrop-filter: blur(10px);
            box-shadow: 0 10px 40px rgba(255, 193, 7, 0.2);
        }
        .login-form h2 {
            color: var(--rasta-gold);
            margin-bottom: 30px;
            text-align: center;
            font-size: 2rem;
        }
        .login-form input {
            width: 100%;
            padding: 15px;
            margin-bottom: 20px;
            background: rgba(0, 0, 0, 0.7);
            border: 2px solid #333;
            color: #fff;
            border-radius: 8px;
            font-size: 1rem;
            transition: all 0.3s;
        }
        .login-form input:focus {
            border-color: var(--rasta-gold);
            box-shadow: 0 0 20px rgba(255, 193, 7, 0.3);
            outline: none;
        }
        .login-form button {
            width: 100%;
            padding: 15px;
            background: linear-gradient(135deg, var(--rasta-gold), #ff8c00);
            color: #000;
            border: none;
            border-radius: 8px;
            font-weight: bold;
            font-size: 1.1rem;
            cursor: pointer;
            transition: all 0.3s;
            margin-top: 10px;
        }
        .login-form button:hover {
            transform: translateY(-3px);
            box-shadow: 0 10px 30px rgba(255, 193, 7, 0.4);
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .stat-card {
            background: rgba(0, 0, 0, 0.4);
            border: 2px solid var(--rasta-gold);
            padding: 25px;
            border-radius: 12px;
            text-align: center;
            transition: all 0.3s;
        }
        .stat-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 10px 30px rgba(255, 193, 7, 0.3);
        }
        .stat-card .icon {
            font-size: 2.5rem;
            margin-bottom: 10px;
        }
        .stat-card .number {
            font-size: 2rem;
            font-weight: bold;
            color: var(--rasta-gold);
            margin-bottom: 5px;
        }
        .stat-card .label {
            color: #888;
            font-size: 0.9rem;
        }
        .orders-section {
            background: rgba(0, 0, 0, 0.4);
            border: 2px solid var(--rasta-gold);
            border-radius: 12px;
            padding: 30px;
            overflow-x: auto;
        }
        .orders-section h2 {
            color: var(--rasta-gold);
            margin-top: 0;
            margin-bottom: 25px;
            font-size: 1.8rem;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .orders-table {
            width: 100%;
            border-collapse: collapse;
        }
        .orders-table th {
            background: rgba(255, 193, 7, 0.1);
            color: var(--rasta-gold);
            padding: 15px;
            text-align: left;
            border-bottom: 2px solid var(--rasta-gold);
            font-weight: bold;
        }
        .orders-table td {
            padding: 15px;
            border-bottom: 1px solid #333;
            color: #ccc;
        }
        .orders-table tr:hover {
            background: rgba(255, 193, 7, 0.05);
        }
        .order-id {
            color: var(--rasta-gold);
            font-weight: bold;
            cursor: pointer;
            text-decoration: underline;
            transition: all 0.3s;
        }
        .order-id:hover {
            color: #ff8c00;
        }
        .status-badge {
            display: inline-block;
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 0.85rem;
            font-weight: bold;
        }
        .status-pending {
            background: rgba(255, 193, 7, 0.2);
            color: var(--rasta-gold);
        }
        .status-completed {
            background: rgba(76, 175, 80, 0.2);
            color: #34d399;
        }
        .no-orders {
            text-align: center;
            padding: 40px;
            color: #888;
        }
        .no-orders i {
            font-size: 3rem;
            margin-bottom: 15px;
            opacity: 0.5;
        }
        .hint-box {
            background: rgba(76, 175, 80, 0.1);
            border-left: 3px solid var(--rasta-green);
            padding: 20px;
            border-radius: 8px;
            color: #ccc;
            margin-top: 20px;
            font-size: 0.95rem;
        }
        .hint-box code {
            background: rgba(0, 0, 0, 0.5);
            padding: 3px 8px;
            border-radius: 4px;
            color: #34d399;
            font-family: monospace;
        }
    </style>
</head>
<body style="background: linear-gradient(135deg, #0a0a0a 0%, #1a1a0a 100%); min-height: 100vh;">
    <div class="admin-container">
        <!-- ADMIN DASHBOARD -->
            <a href="?logout=1" class="logout-btn">
                <i class="fa-solid fa-sign-out"></i> Odhlášení
            </a>

            <div class="admin-header">
                <h1><i class="fa-solid fa-chart-line"></i> Admin Dashboard</h1>
                <p><?php echo SHOP_NAME; ?> - Správa objednávek a statistiky</p>
            </div>

            <?php
            // Načtení objednávek
            $ordersDir = __DIR__ . '/../orders';
            $orders = [];
            $stats = [
                'total' => 0,
                'revenue' => 0,
                'tokens' => 0,
                'average' => 0
            ];

            if (is_dir($ordersDir)) {
                $files = glob($ordersDir . '/*.json');
                foreach ($files as $file) {
                    $data = json_decode(file_get_contents($file), true);
                    if ($data && isset($data['orderId'])) {
                        $orders[] = $data;
                        $stats['revenue'] += $data['total'] ?? 0;
                        $stats['tokens'] += $data['zionTokens'] ?? 0;
                    }
                }
            }

            $stats['total'] = count($orders);
            $stats['average'] = $stats['total'] > 0 ? round($stats['revenue'] / $stats['total']) : 0;

            // Seřadit podle času
            usort($orders, function($a, $b) {
                return strtotime($b['createdAt'] ?? 0) - strtotime($a['createdAt'] ?? 0);
            });
            ?>

            <!-- STATISTICS -->
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="icon"><i class="fa-solid fa-boxes-stacked"></i></div>
                    <div class="number"><?php echo $stats['total']; ?></div>
                    <div class="label">Celkem Objednávek</div>
                </div>
                <div class="stat-card">
                    <div class="icon"><i class="fa-solid fa-money-bill"></i></div>
                    <div class="number"><?php echo number_format($stats['revenue'], 0, ',', ' '); ?> Kč</div>
                    <div class="label">Celkový Příjem</div>
                </div>
                <div class="stat-card">
                    <div class="icon"><i class="fa-solid fa-coins"></i></div>
                    <div class="number"><?php echo number_format($stats['tokens'], 0, ',', ' '); ?></div>
                    <div class="label">ZION Tokeny (Vydáno)</div>
                </div>
                <div class="stat-card">
                    <div class="icon"><i class="fa-solid fa-chart-pie"></i></div>
                    <div class="number"><?php echo number_format($stats['average'], 0, ',', ' '); ?> Kč</div>
                    <div class="label">Průměr / Objednávka</div>
                </div>
            </div>

            <!-- ORDERS TABLE -->
            <div class="orders-section">
                <h2>
                    <i class="fa-solid fa-list"></i> Nedávné Objednávky
                </h2>

                <?php if (count($orders) > 0): ?>
                    <table class="orders-table">
                        <thead>
                            <tr>
                                <th><i class="fa-solid fa-hashtag"></i> ID</th>
                                <th><i class="fa-solid fa-user"></i> Zákazník</th>
                                <th><i class="fa-solid fa-calendar"></i> Datum</th>
                                <th><i class="fa-solid fa-money-bill"></i> Částka</th>
                                <th><i class="fa-solid fa-coins"></i> ZION</th>
                                <th><i class="fa-solid fa-truck"></i> Doprava</th>
                                <th><i class="fa-solid fa-credit-card"></i> Platba</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php foreach (array_slice($orders, 0, 20) as $order): ?>
                                <tr>
                                    <td>
                                        <span class="order-id" onclick="showOrderDetail(<?php echo htmlspecialchars(json_encode($order)); ?>)">
                                            <?php echo substr($order['orderId'], 0, 8); ?>...
                                        </span>
                                    </td>
                                    <td><?php echo htmlspecialchars($order['customer']['name'] ?? 'N/A'); ?></td>
                                    <td><?php echo date('d.m.Y H:i', strtotime($order['createdAt'] ?? 'now')); ?></td>
                                    <td style="color: var(--rasta-gold);">
                                        <strong><?php echo number_format($order['total'] ?? 0, 0, ',', ' '); ?> Kč</strong>
                                    </td>
                                    <td style="color: #34d399;">
                                        <?php 
                                        $tokens = $order['zionTokens'] ?? ($order['zion']['tokens']['totalTokens'] ?? 0);
                                        echo $tokens > 0 ? '<strong>' . number_format($tokens, 0) . '</strong>' : '-';
                                        ?>
                                    </td>
                                    <td><?php echo htmlspecialchars($order['shipping']['method'] ?? 'N/A'); ?></td>
                                    <td>
                                        <span class="status-badge status-<?php echo ($order['payment'] === 'transfer') ? 'pending' : 'completed'; ?>">
                                            <?php 
                                            $payments = [
                                                'card' => '💳 Karta',
                                                'transfer' => '🏦 Převod',
                                                'cash' => '💰 Dobírka'
                                            ];
                                            echo $payments[$order['payment']] ?? $order['payment'];
                                            ?>
                                        </span>
                                    </td>
                                </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                    <?php if (count($orders) > 20): ?>
                        <p style="text-align: center; color: #666; margin-top: 20px;">
                            ... a <?php echo count($orders) - 20; ?> dalších objednávek
                        </p>
                    <?php endif; ?>
                <?php else: ?>
                    <div class="no-orders">
                        <i class="fa-solid fa-inbox"></i>
                        <p>Zatím nejsou žádné objednávky</p>
                    </div>
                <?php endif; ?>
            </div>
    </div>

    <!-- Modal pro detail objednávky -->
    <div id="detailModal" style="display: none; position: fixed; z-index: 1000; left: 0; top: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9);">
        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 90%; max-width: 600px; max-height: 80vh; overflow-y: auto; background: rgba(0,0,0,0.8); border: 2px solid var(--rasta-gold); padding: 30px; border-radius: 12px;">
            <span onclick="document.getElementById('detailModal').style.display='none'" style="float: right; font-size: 2rem; cursor: pointer; color: var(--rasta-gold);">&times;</span>
            <h2 style="color: var(--rasta-gold); margin-top: 0;">📦 Detail Objednávky</h2>
            <div id="detailContent" style="color: #ccc;"></div>
        </div>
    </div>

    <script>
        function showOrderDetail(order) {
            const content = `
                <p><strong>ID:</strong> ${order.orderId}</p>
                <p><strong>Datum:</strong> ${new Date(order.createdAt).toLocaleString('cs-CZ')}</p>
                <p><strong>Zákazník:</strong> ${order.customer.name} (${order.customer.email})</p>
                <p><strong>Telefon:</strong> ${order.customer.phone}</p>
                <p><strong>Doprava:</strong> ${order.shipping.method}</p>
                <p><strong>Platba:</strong> ${order.payment}</p>
                <p><strong>Celkem:</strong> ${order.total} Kč</p>
                ${order.zionTokens ? `<p><strong>ZION Tokeny:</strong> ${order.zionTokens}</p>` : ''}
                <hr style="border: 1px solid #333; margin: 20px 0;">
                <pre style="background: #0a0a0a; padding: 15px; border-radius: 8px; overflow-x: auto;">${JSON.stringify(order, null, 2)}</pre>
            `;
            document.getElementById('detailContent').innerHTML = content;
            document.getElementById('detailModal').style.display = 'flex';
        }

        document.getElementById('detailModal').addEventListener('click', function(e) {
            if (e.target === this) this.style.display = 'none';
        });
    </script>
</body>
</html>
