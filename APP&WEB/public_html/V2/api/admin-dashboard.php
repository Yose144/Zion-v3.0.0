<?php
/**
 * ZION eShop - Admin Dashboard
 * Výpis všech objednávek ze /orders adresáře
 */

header('Content-Type: text/html; charset=utf-8');

// Bezpečnostní ověření (jednoduché)
require_once 'auth.php';
requireLogin();

?><!DOCTYPE html>
<html lang="cs">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Dashboard - ZION eShop Objednávky</title>
    <link rel="stylesheet" href="https://kit.fontawesome.com/16464afad1.js" crossorigin="anonymous"></link>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: Arial, sans-serif;
            background: #0a0a0a;
            color: #ccc;
            padding: 20px;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        .header {
            background: linear-gradient(135deg, #ff4444, #ffc107, #44aa44);
            color: #000;
            padding: 30px;
            border-radius: 8px;
            margin-bottom: 30px;
            text-align: center;
        }
        .header h1 {
            font-size: 2.5rem;
            margin-bottom: 10px;
        }
        .header p {
            font-size: 1.1rem;
            opacity: 0.9;
        }
        .login-form {
            background: #1a1a1a;
            border: 2px solid #ffc107;
            padding: 30px;
            border-radius: 8px;
            max-width: 400px;
            margin: 0 auto;
            margin-top: 50px;
        }
        .login-form h2 {
            color: #ffc107;
            margin-bottom: 20px;
            text-align: center;
        }
        .login-form input {
            width: 100%;
            padding: 12px;
            margin-bottom: 15px;
            background: #222;
            border: 1px solid #333;
            color: #fff;
            border-radius: 4px;
            font-size: 1rem;
        }
        .login-form button {
            width: 100%;
            padding: 12px;
            background: linear-gradient(135deg, #ffc107, #ff8c00);
            color: #000;
            border: none;
            border-radius: 4px;
            font-weight: bold;
            font-size: 1rem;
            cursor: pointer;
            transition: transform 0.2s;
        }
        .login-form button:hover {
            transform: scale(1.02);
        }
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .stat-card {
            background: #1a1a1a;
            border: 1px solid #333;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
        }
        .stat-card .number {
            font-size: 2.5rem;
            color: #ffc107;
            font-weight: bold;
            margin-bottom: 10px;
        }
        .stat-card .label {
            color: #888;
            font-size: 0.9rem;
        }
        .orders-table {
            width: 100%;
            border-collapse: collapse;
            background: #1a1a1a;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
        }
        .orders-table th {
            background: #222;
            color: #ffc107;
            padding: 15px;
            text-align: left;
            border-bottom: 2px solid #333;
        }
        .orders-table td {
            padding: 12px 15px;
            border-bottom: 1px solid #222;
        }
        .orders-table tr:hover {
            background: #111;
        }
        .order-id {
            color: #ffc107;
            font-weight: bold;
            cursor: pointer;
            text-decoration: underline;
        }
        .order-id:hover {
            color: #ff8c00;
        }
        .status {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 0.85rem;
            font-weight: bold;
        }
        .status.completed {
            background: #34d399;
            color: #000;
        }
        .status.pending {
            background: #ffc107;
            color: #000;
        }
        .status.failed {
            background: #ff4444;
            color: #fff;
        }
        .modal {
            display: none;
            position: fixed;
            z-index: 1000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
        }
        .modal.active {
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .modal-content {
            background: #1a1a1a;
            padding: 30px;
            border-radius: 8px;
            max-width: 800px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
            border: 2px solid #ffc107;
        }
        .modal-content h2 {
            color: #ffc107;
            margin-bottom: 20px;
        }
        .modal-content pre {
            background: #0a0a0a;
            padding: 15px;
            border-radius: 4px;
            overflow-x: auto;
            color: #34d399;
            font-size: 0.85rem;
        }
        .close-modal {
            float: right;
            font-size: 2rem;
            cursor: pointer;
            color: #ffc107;
        }
        .close-modal:hover {
            color: #ff8c00;
        }
        .alert {
            padding: 15px;
            margin-bottom: 20px;
            border-radius: 4px;
            background: #ff4444;
            color: #fff;
            border: 1px solid #cc0000;
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <div class="header">
            <h1>🛒 ZION eShop - Admin Dashboard</h1>
            <p>Správa a přehled objednávek</p>
        </div>

        <!-- Admin Dashboard -->
            
            <?php
            // Načtení všech objednávek
            $ordersDir = __DIR__ . '/../orders';
            $orders = [];
            $totalRevenue = 0;
            $zionTokensTotal = 0;

            if (is_dir($ordersDir)) {
                $files = glob($ordersDir . '/*.json');
                foreach ($files as $file) {
                    $data = json_decode(file_get_contents($file), true);
                    if ($data) {
                        $orders[] = $data;
                        $totalRevenue += $data['total'] ?? 0;
                        $zionTokensTotal += $data['zionTokens'] ?? ($data['zion']['tokens']['totalTokens'] ?? 0);
                    }
                }
            }

            usort($orders, function($a, $b) {
                return strtotime($b['createdAt'] ?? 0) - strtotime($a['createdAt'] ?? 0);
            });
            ?>

            <!-- Stats -->
            <div class="stats">
                <div class="stat-card">
                    <div class="number"><?php echo count($orders); ?></div>
                    <div class="label">Celkem objednávek</div>
                </div>
                <div class="stat-card">
                    <div class="number"><?php echo number_format($totalRevenue, 0, ',', ' '); ?> Kč</div>
                    <div class="label">Celkový příjem</div>
                </div>
                <div class="stat-card">
                    <div class="number"><?php echo number_format($zionTokensTotal, 0, ',', ' '); ?></div>
                    <div class="label">ZION Tokeny (vydáno)</div>
                </div>
                <div class="stat-card">
                    <div class="number"><?php echo round($totalRevenue / max(1, count($orders)), 0); ?> Kč</div>
                    <div class="label">Průměr na objednávku</div>
                </div>
            </div>

            <!-- Orders Table -->
            <h2 style="color: #ffc107; margin-bottom: 20px;">📋 Objednávky</h2>
            <?php if (count($orders) > 0): ?>
                <table class="orders-table">
                    <thead>
                        <tr>
                            <th>ID Objednávky</th>
                            <th>Zákazník</th>
                            <th>Datum</th>
                            <th>Částka</th>
                            <th>ZION Tokeny</th>
                            <th>Doprava</th>
                            <th>Platba</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($orders as $order): ?>
                            <tr>
                                <td class="order-id" onclick="showOrderDetail('<?php echo htmlspecialchars(json_encode($order)); ?>')">
                                    <?php echo htmlspecialchars($order['orderId']); ?>
                                </td>
                                <td><?php echo htmlspecialchars($order['customer']['name'] ?? 'N/A'); ?></td>
                                <td><?php echo date('d.m.Y H:i', strtotime($order['createdAt'] ?? 'now')); ?></td>
                                <td><?php echo number_format($order['total'] ?? 0, 0, ',', ' '); ?> Kč</td>
                                <td>
                                    <?php 
                                    $tokens = $order['zionTokens'] ?? ($order['zion']['tokens']['totalTokens'] ?? 0);
                                    echo $tokens > 0 ? '<span style="color: #34d399;">📊 ' . number_format($tokens, 0) . '</span>' : '-';
                                    ?>
                                </td>
                                <td><?php echo htmlspecialchars($order['shipping']['method'] ?? 'N/A'); ?></td>
                                <td><?php echo htmlspecialchars($order['payment'] ?? 'N/A'); ?></td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            <?php else: ?>
                <div class="alert">
                    <i class="fa-solid fa-info-circle"></i> Zatím nejsou žádné objednávky.
                </div>
            <?php endif; ?>
    </div>

    <!-- Modal pro detail objednávky -->
    <div class="modal" id="orderModal">
        <div class="modal-content">
            <span class="close-modal" onclick="closeOrderDetail()">&times;</span>
            <h2>📦 Detail Objednávky</h2>
            <pre id="orderJson"></pre>
        </div>
    </div>

    <script>
        function showOrderDetail(orderJson) {
            try {
                const order = JSON.parse(decodeURIComponent(orderJson));
                document.getElementById('orderJson').textContent = JSON.stringify(order, null, 2);
                document.getElementById('orderModal').classList.add('active');
            } catch (e) {
                alert('Chyba při načítání detailů objednávky');
            }
        }

        function closeOrderDetail() {
            document.getElementById('orderModal').classList.remove('active');
        }

        // Zavření modalu kliknutím mimo
        document.getElementById('orderModal').addEventListener('click', function(e) {
            if (e.target === this) {
                closeOrderDetail();
            }
        });
    </script>
</body>
</html>
