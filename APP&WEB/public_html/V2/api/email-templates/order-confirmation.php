<?php
/**
 * ZION eShop - Email Template for Order Confirmation
 * Generates beautiful HTML email with order details
 */

function getOrderConfirmationEmail($orderData) {
    $orderId = $orderData['orderId'] ?? 'N/A';
    $customerName = $orderData['customer']['name'] ?? 'Zákazníku';
    $customerEmail = $orderData['customer']['email'] ?? '';
    $createdAt = $orderData['createdAt'] ?? date('Y-m-d H:i:s');

    $currency = strtoupper((string)($orderData['currency'] ?? 'CZK'));
    if (!in_array($currency, ['CZK', 'EUR'], true)) {
        $currency = 'CZK';
    }
    $freeText = $currency === 'EUR' ? 'Free' : 'Zdarma';

    $money = function($amount) use ($currency): string {
        $value = is_numeric($amount) ? (float)$amount : 0.0;
        $isIntLike = abs($value - round($value)) < 0.00001;
        if ($currency === 'EUR') {
            $decimals = $isIntLike ? 0 : 2;
            $formatted = number_format($value, $decimals, '.', ',');
            return '€' . $formatted;
        }
        $formatted = number_format($value, 0, '', ' ');
        return $formatted . ' Kč';
    };
    
    // Formátování data
    $dateFormatted = date('d.m.Y H:i', strtotime($createdAt));
    
    // Položky
    $itemsHtml = '';
    // Prioritně čteme z $orderData['zion']['tokens']['totalTokens'], pak fallback na vypočet z items
    $totalTokens = 0;
    if (isset($orderData['zion']['tokens']['totalTokens'])) {
        $totalTokens = (int)$orderData['zion']['tokens']['totalTokens'];
    } elseif (isset($orderData['zionTokens']) && $orderData['zionTokens'] > 0) {
        $totalTokens = (int)$orderData['zionTokens'];
    }
    
    foreach ($orderData['items'] as $item) {
        $itemTotal = ($item['price'] ?? 0) * ($item['quantity'] ?? 1);
        $itemTokens = ($item['tokens'] ?? 0) * ($item['quantity'] ?? 1);
        // Pokud jsme tokens ještě nenačetli z backend dat, spočítáme je
        if ($totalTokens == 0) {
            $totalTokens += $itemTokens;
        }
        
        $itemsHtml .= sprintf(
            '<tr style="border-bottom: 1px solid #333;">
                <td style="padding: 12px; color: #ccc;">%s</td>
                <td style="padding: 12px; text-align: center; color: #fff;">%d x</td>
                <td style="padding: 12px; text-align: right; color: #fff;">%s</td>
                <td style="padding: 12px; text-align: right; color: #ffc107;">%d ZION</td>
            </tr>',
            $item['name'] ?? 'Produkt',
            $item['quantity'] ?? 1,
            $money($itemTotal),
            $itemTokens
        );
    }
    
    // Doprava
    $shippingMethod = $orderData['shipping']['method'] ?? 'N/A';
    $shippingNames = [
        'zasilkovna' => 'Zásilkovna - Výdejní místo',
        'zasilkovna-home' => 'Zásilkovna - Na adresu',
        'virtualni-nakup' => 'Virtuální nákup',
        'osobni' => 'Osobní odběr'
    ];
    $shippingName = $shippingNames[$shippingMethod] ?? $shippingMethod;
    $shippingPrice = $orderData['shipping']['price'] ?? 0;
    
    // Platba (frontend posílá string, některé integrace posílají objekt)
    $paymentMethod = $orderData['payment']['method'] ?? ($orderData['payment'] ?? 'N/A');
    if (is_array($paymentMethod) || is_object($paymentMethod)) {
        $paymentMethod = 'N/A';
    }
    // Normalizace aliasů
    if ($paymentMethod === 'bank_transfer') {
        $paymentMethod = 'transfer';
    }
    $paymentNames = [
        'card' => 'Kartou (Stripe)',
        'transfer' => 'Bankovní převod',
        'cash' => 'Dobírka / Hotově'
    ];
    $paymentName = $paymentNames[$paymentMethod] ?? $paymentMethod;
    
    // Výběr místa Zásilkovny
    $pickupInfo = '';
    if ($shippingMethod === 'zasilkovna' && isset($orderData['shipping']['pickupPoint'])) {
        $pp = $orderData['shipping']['pickupPoint'];
        $get = function($obj, string $key): string {
            if (is_array($obj)) {
                return (string)($obj[$key] ?? '');
            }
            if (is_object($obj)) {
                return (string)($obj->$key ?? '');
            }
            return '';
        };
        $name = $get($pp, 'name');
        $street = $get($pp, 'street');
        $city = $get($pp, 'city');
        $zip = $get($pp, 'zip');
        $pickupInfo = '<tr><td colspan="2" style="padding: 8px 0; color: #666;"><i class="fa-solid fa-location-dot"></i> <strong>Místo vyzvednutí:</strong> ' 
            . htmlspecialchars($name) . ', ' 
            . htmlspecialchars($street) . ' ' 
            . htmlspecialchars($city) . ', ' 
            . htmlspecialchars($zip) 
            . '</td></tr>';
    }
    
    // Celkem
    $productsTotal = array_sum(array_map(function($item) {
        return ($item['price'] ?? 0) * ($item['quantity'] ?? 1);
    }, $orderData['items']));
    $total = $productsTotal + $shippingPrice;

    $shippingPriceDisplay = ((float)$shippingPrice > 0)
        ? $money($shippingPrice)
        : $freeText;
    $totalDisplay = $money($total);
    
    // ZION Token bonus
    $zionBonusHtml = '';
    if ($totalTokens > 0) {
        // Prioritně použijeme wallet data z backend, jinak vygenerujeme fallback
        if (isset($orderData['zion']['wallet']['id'])) {
            $walletId = $orderData['zion']['wallet']['id'];
        } elseif (isset($orderData['zionWalletId'])) {
            $walletId = $orderData['zionWalletId'];
        } else {
            $walletId = 'zw_' . substr(md5($orderId), 0, 16);
        }
        
        $walletNetwork = $orderData['zion']['wallet']['network'] ?? ($orderData['network'] ?? 'mainnet');

        // Construct JSON for QR (compat: snake_case + camelCase)
        $walletData = [
            'type' => 'ZION_PRESALE_WALLET',
            'version' => '3.0',
            'wallet_id' => $walletId,
            'walletId' => $walletId,
            'address' => $orderData['zion']['wallet']['address'] ?? '',
            'mnemonic' => $orderData['zion']['wallet']['mnemonic'] ?? '',
            'tokens' => $totalTokens,
            'order_id' => $orderId,
            'orderId' => $orderId,
            'network' => $walletNetwork,
            'createdAt' => $orderData['zion']['wallet']['createdAt'] ?? ($orderData['createdAt'] ?? date(DATE_ATOM)),
            'created_at' => $orderData['zion']['wallet']['createdAt'] ?? ($orderData['createdAt'] ?? date(DATE_ATOM))
        ];
        
        $jsonStr = json_encode($walletData);
        
        // Prioritně použij QR z backend
        if (isset($orderData['zion']['qr']['serviceUrl'])) {
            $qrUrl = $orderData['zion']['qr']['serviceUrl'];
        } else {
            $qrUrl = 'https://quickchart.io/qr?size=320&margin=1&text=' . urlencode($jsonStr);
        }
        
        $zionBonusHtml = sprintf(
            '<div style="background: linear-gradient(135deg, rgba(255,193,7,0.1), rgba(0,128,0,0.1)); border: 2px solid #ffc107; border-radius: 12px; padding: 20px; margin: 20px 0; text-align: center;">
                <h3 style="color: #ffc107; margin: 0 0 15px 0;"><i class="fa-solid fa-coins"></i> ZION TOKEN BONUS</h3>
                <p style="color: #888; margin: 0 0 10px 0;">Za tuto objednávku získáváte:</p>
                <div style="font-size: 2.5rem; font-weight: bold; color: #34d399; margin: 0 0 20px 0;">%d ZION</div>
                <img src="%s" alt="ZION Wallet QR" style="width: 200px; height: 200px; border: 2px solid #ffc107; border-radius: 8px; background: white; padding: 8px;">
                <p style="color: #666; font-size: 0.9rem; margin: 15px 0 0 0;">QR kód pro přijetí ZION tokenů</p>
                <p style="color: #999; font-size: 0.85rem; margin: 8px 0 0 0;"><code>' . htmlspecialchars($walletId) . '</code></p>
            </div>',
            $totalTokens,
            $qrUrl
        );
    }
    
    // Hlavní HTML email
    $html = sprintf(
        '<!DOCTYPE html>
<html lang="cs">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Potvrzení objednávky - ZION eShop</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            background: #0a0a0a;
            color: #ccc;
            margin: 0;
            padding: 20px;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background: #1a1a1a;
            border: 2px solid #ffc107;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 10px 40px rgba(255, 193, 7, 0.2);
        }
        .header {
            background: linear-gradient(135deg, #ff4444, #ffc107, #44aa44);
            padding: 30px 20px;
            text-align: center;
            color: #000;
        }
        .header h1 {
            margin: 0;
            font-size: 2rem;
            font-weight: bold;
        }
        .header p {
            margin: 10px 0 0 0;
            font-size: 0.9rem;
            opacity: 0.8;
        }
        .content {
            padding: 30px 20px;
        }
        .section {
            margin-bottom: 25px;
        }
        .section h3 {
            color: #ffc107;
            margin: 0 0 15px 0;
            padding-bottom: 10px;
            border-bottom: 1px solid #333;
            font-size: 1.1rem;
        }
        .info-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #222;
        }
        .info-row .label {
            color: #888;
        }
        .info-row .value {
            color: #fff;
            font-weight: bold;
        }
        table {
            width: 100%%;
            border-collapse: collapse;
            margin: 15px 0;
        }
        table th {
            background: #222;
            color: #ffc107;
            padding: 12px;
            text-align: left;
            border-bottom: 2px solid #333;
        }
        .total-row {
            background: rgba(0, 128, 0, 0.1);
            font-weight: bold;
            font-size: 1.2rem;
            color: #34d399;
        }
        .footer {
            background: #0a0a0a;
            padding: 20px;
            text-align: center;
            color: #666;
            font-size: 0.85rem;
            border-top: 1px solid #333;
        }
        .footer a {
            color: #ffc107;
            text-decoration: none;
        }
        .highlight {
            background: rgba(255, 193, 7, 0.1);
            border-left: 3px solid #ffc107;
            padding: 12px;
            margin: 15px 0;
            border-radius: 4px;
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <div class="header">
            <h1>✅ Objednávka přijata!</h1>
            <p>Číslo: %s | %s</p>
        </div>

        <!-- Content -->
        <div class="content">
            <p>Ahoj <strong>%s</strong>,</p>
            <p>Děkujeme za vaši objednávku! Vaše objednávka byla úspěšně přijata a nyní se zpracovává.</p>

            <!-- Sekcí: Objednávka -->
            <div class="section">
                <h3><i class="fa-solid fa-box"></i> Detaily objednávky</h3>
                <table>
                    <thead>
                        <tr>
                            <th>Produkt</th>
                            <th style="text-align: center;">Ks</th>
                            <th style="text-align: right;">Cena</th>
                            <th style="text-align: right;">ZION</th>
                        </tr>
                    </thead>
                    <tbody>
                        %s
                        %s
                        <tr style="border-top: 2px solid #333;">
                            <td colspan="2" style="padding: 12px; color: #888;">Doprava: %s</td>
                            <td style="padding: 12px; text-align: right; color: #fff;">%s</td>
                            <td style="padding: 12px;"></td>
                        </tr>
                        <tr class="total-row">
                            <td colspan="2" style="padding: 12px;">CELKEM:</td>
                            <td style="padding: 12px; text-align: right;">%s</td>
                            <td style="padding: 12px; text-align: right;">%d ZION</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- Sekce: Zákazník -->
            <div class="section">
                <h3><i class="fa-solid fa-user"></i> Vaše údaje</h3>
                <div class="info-row">
                    <span class="label">Jméno:</span>
                    <span class="value">%s</span>
                </div>
                <div class="info-row">
                    <span class="label">Email:</span>
                    <span class="value">%s</span>
                </div>
                <div class="info-row">
                    <span class="label">Telefon:</span>
                    <span class="value">%s</span>
                </div>
            </div>

            <!-- Sekce: Doprava & Platba -->
            <div class="section">
                <h3><i class="fa-solid fa-truck"></i> Doprava & Platba</h3>
                <div class="info-row">
                    <span class="label">Doprava:</span>
                    <span class="value">%s</span>
                </div>
                <div class="info-row">
                    <span class="label">Platba:</span>
                    <span class="value">%s</span>
                </div>
                <div class="info-row">
                    <span class="label">Var. symbol:</span>
                    <span class="value">%s</span>
                </div>
            </div>

            <!-- ZION Token Bonus -->
            %s

            <!-- Highlight box -->
            <div class="highlight">
                <strong>📌 Co se děje dál?</strong><br>
                1. Potvrzení e-mail jste právě obdrželi<br>
                2. Naši tým zpracuje vaši objednávku<br>
                3. Budete informováni o odesílce<br>
                4. Čekejte na doručení na Vaši adresu
            </div>

            <p style="color: #666; margin-top: 30px;">
                <strong>Máte dotaz?</strong> Kontaktujte nás na <a href="mailto:eshop@newearth.cz" style="color: #ffc107;">eshop@newearth.cz</a>
            </p>
        </div>

        <!-- Footer -->
        <div class="footer">
            <p style="margin: 0 0 10px 0;">ZION TerraNova ® | <strong>Omnity.One s.r.o.</strong></p>
            <p style="margin: 0;">© 2025 Všechna práva vyhrazena. | <a href="https://newearth.cz/V2/terms.html">Obchodní podmínky</a></p>
        </div>
    </div>
</body>
</html>',
        $orderId,
        $dateFormatted,
        $customerName,
        $itemsHtml,
        $pickupInfo,
        $shippingName,
        $shippingPriceDisplay,
        $totalDisplay,
        $totalTokens,
        $customerName,
        $customerEmail,
        $orderData['customer']['phone'] ?? 'N/A',
        $shippingName,
        $paymentName,
        $orderId,
        $zionBonusHtml
    );
    
    return $html;
}

// Případně vrátit JSON response s email template
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'preview') {
    header('Content-Type: text/html; charset=utf-8');
    
    // Demo order data
    $demoOrder = [
        'orderId' => 'ZTNMIR4AW5HGF9J',
        'createdAt' => '2025-12-04T07:31:45.605Z',
        'customer' => [
            'name' => 'josed',
            'email' => 'yosef.hubalek@gmail.com',
            'phone' => '+420773669477'
        ],
        'items' => [
            [
                'id' => 'seed-002',
                'name' => 'JAGANATH KRISHNA',
                'price' => 390,
                'tokens' => 390,
                'quantity' => 1
            ]
        ],
        'shipping' => [
            'method' => 'zasilkovna',
            'price' => 69,
            'pickupPoint' => (object)[
                'name' => 'Chotusice',
                'street' => 'Chotusice 61',
                'city' => 'Chotusice',
                'zip' => ''
            ]
        ],
        'payment' => 'transfer',
        'zionWalletId' => 'zw_65aa109eb19b'
    ];
    
    echo getOrderConfirmationEmail($demoOrder);
    exit;
}
