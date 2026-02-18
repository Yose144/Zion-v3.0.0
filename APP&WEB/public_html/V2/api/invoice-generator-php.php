<?php
/**
 * ZION eShop - PHP Invoice Generator
 * ====================================
 * Generuje HTML faktury bez Python závislostí.
 * Fallback pro servery bez reportlab.
 * 
 * Author: ZION Team
 * Created: 2026-01-28
 */

class PHPInvoiceGenerator
{
    private $seller = [
        'name' => 'Omnity.One s.r.o.',
        'ico' => '09120050',
        'dic' => 'CZ09120050',
        'address' => 'Horní Čermná',
        'city' => '561 56',
        'country' => 'Česká republika',
        'bank_account' => '2901809148 / 2010',
        'iban' => 'CZ63 2010 0000 0029 0180 9148',
        'swift' => 'FIOBCZPPXXX',
        'email' => 'admin@newearth.cz',
        'web' => 'https://zionterranova.com'
    ];

    private $invoicesDir;

    public function __construct()
    {
        $this->invoicesDir = __DIR__ . '/../invoices';
        if (!is_dir($this->invoicesDir)) {
            mkdir($this->invoicesDir, 0755, true);
        }
    }

    /**
     * Generuje fakturu z objednávky
     */
    public function generateFromOrder(array $order): array
    {
        $invoiceNumber = $this->generateInvoiceNumber($order);
        $issueDate = date('d.m.Y');
        $dueDate = date('d.m.Y', strtotime('+14 days'));

        // Připravit položky
        $items = [];
        $subtotal = 0;
        $vatTotal = 0;

        if (!empty($order['items'])) {
            foreach ($order['items'] as $item) {
                $qty = intval($item['quantity'] ?? 1);
                $price = floatval($item['price'] ?? 0);
                $vatRate = 0.21;
                $itemTotal = $qty * $price;
                $itemVat = $itemTotal * $vatRate;

                $items[] = [
                    'name' => $item['name'] ?? $item['title'] ?? 'Položka',
                    'quantity' => $qty,
                    'unit_price' => $price,
                    'vat_rate' => $vatRate * 100,
                    'total' => $itemTotal,
                    'vat' => $itemVat
                ];

                $subtotal += $itemTotal;
                $vatTotal += $itemVat;
            }
        }

        // Doprava
        if (!empty($order['shipping']['price']) && $order['shipping']['price'] > 0) {
            $shippingPrice = floatval($order['shipping']['price']);
            $shippingVat = $shippingPrice * 0.21;
            
            $items[] = [
                'name' => 'Doprava: ' . ($order['shipping']['method'] ?? 'Zásilkovna'),
                'quantity' => 1,
                'unit_price' => $shippingPrice,
                'vat_rate' => 21,
                'total' => $shippingPrice,
                'vat' => $shippingVat
            ];

            $subtotal += $shippingPrice;
            $vatTotal += $shippingVat;
        }

        $total = $subtotal + $vatTotal;

        // Zákazník
        $customer = $order['customer'] ?? [];
        $customerAddress = $this->formatCustomerAddress($customer, $order);

        // Variabilní symbol
        $vs = preg_replace('/[^0-9]/', '', $order['orderId'] ?? '');
        if (strlen($vs) > 10) {
            $vs = substr($vs, 0, 10);
        }
        if (empty($vs)) {
            $vs = date('ymd') . rand(1000, 9999);
        }

        // Data faktury
        $invoiceData = [
            'number' => $invoiceNumber,
            'order_id' => $order['orderId'] ?? '',
            'issue_date' => $issueDate,
            'due_date' => $dueDate,
            'customer' => [
                'name' => $customer['name'] ?? 'Neuvedeno',
                'email' => $customer['email'] ?? '',
                'address' => $customerAddress,
                'ico' => $customer['ico'] ?? null,
                'dic' => $customer['dic'] ?? null
            ],
            'items' => $items,
            'subtotal' => $subtotal,
            'vat_total' => $vatTotal,
            'total' => $total,
            'currency' => 'Kč',
            'variable_symbol' => $vs,
            'payment_method' => $this->formatPaymentMethod($order['payment'] ?? [])
        ];

        // Generovat HTML
        $html = $this->renderHtml($invoiceData);

        // Uložit soubory
        $htmlPath = $this->invoicesDir . '/invoice_' . $order['orderId'] . '.html';
        $jsonPath = $this->invoicesDir . '/invoice_' . $order['orderId'] . '.json';

        file_put_contents($htmlPath, $html);
        file_put_contents($jsonPath, json_encode($invoiceData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

        return [
            'success' => true,
            'invoice_number' => $invoiceNumber,
            'output_path' => $htmlPath,
            'html_path' => $htmlPath,
            'json_path' => $jsonPath,
            'total' => $total,
            'total_formatted' => number_format($total, 2, ',', ' ') . ' Kč'
        ];
    }

    private function generateInvoiceNumber(array $order): string
    {
        $year = date('Y');
        $orderId = $order['orderId'] ?? date('mdHis');
        return 'FV' . $year . '-' . strtoupper(substr(preg_replace('/[^A-Z0-9]/i', '', $orderId), 0, 10));
    }

    private function formatCustomerAddress($customer, $order): string
    {
        $parts = [];

        // Zásilkovna pickup point
        if (!empty($order['shipping']['pickupPoint'])) {
            $pp = $order['shipping']['pickupPoint'];
            return implode("\n", array_filter([
                $pp['name'] ?? '',
                ($pp['street'] ?? '') . ', ' . ($pp['city'] ?? ''),
                $pp['zip'] ?? ''
            ]));
        }

        // Běžná adresa
        $addr = $customer['address'] ?? $customer;
        if (is_array($addr)) {
            if (!empty($addr['street'])) $parts[] = $addr['street'];
            if (!empty($addr['city'])) $parts[] = $addr['city'];
            if (!empty($addr['zip'])) $parts[] = $addr['zip'];
            if (!empty($addr['country'])) $parts[] = $addr['country'];
        }

        return implode("\n", $parts);
    }

    private function formatPaymentMethod($payment): string
    {
        $method = is_array($payment) ? ($payment['method'] ?? 'bank_transfer') : (string)$payment;
        $method = strtolower($method);

        $map = [
            'bank_transfer' => 'Bankovní převod',
            'bank' => 'Bankovní převod',
            'prevod' => 'Bankovní převod',
            'card' => 'Platební karta',
            'karta' => 'Platební karta',
            'cash' => 'Hotově',
            'hotovost' => 'Hotově',
            'crypto' => 'Kryptoměny'
        ];

        return $map[$method] ?? 'Bankovní převod';
    }

    private function renderHtml(array $data): string
    {
        $itemsHtml = '';
        foreach ($data['items'] as $idx => $item) {
            $itemsHtml .= '<tr>
                <td style="padding: 12px; border-bottom: 1px solid #333;">' . ($idx + 1) . '</td>
                <td style="padding: 12px; border-bottom: 1px solid #333;">' . htmlspecialchars($item['name']) . '</td>
                <td style="padding: 12px; border-bottom: 1px solid #333; text-align: center;">' . $item['quantity'] . '</td>
                <td style="padding: 12px; border-bottom: 1px solid #333; text-align: right;">' . number_format($item['unit_price'], 2, ',', ' ') . ' Kč</td>
                <td style="padding: 12px; border-bottom: 1px solid #333; text-align: center;">' . intval($item['vat_rate']) . '%</td>
                <td style="padding: 12px; border-bottom: 1px solid #333; text-align: right;">' . number_format($item['total'] + $item['vat'], 2, ',', ' ') . ' Kč</td>
            </tr>';
        }

        $customerIcoDic = '';
        if (!empty($data['customer']['ico'])) {
            $customerIcoDic .= '<br>IČO: ' . htmlspecialchars($data['customer']['ico']);
        }
        if (!empty($data['customer']['dic'])) {
            $customerIcoDic .= '<br>DIČ: ' . htmlspecialchars($data['customer']['dic']);
        }

        $logoUrl = '../img/logo144.png';

        return '<!DOCTYPE html>
<html lang="cs">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Faktura ' . htmlspecialchars($data['number']) . '</title>
    <style>
        @import url("https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&display=swap");
        
        * { box-sizing: border-box; margin: 0; padding: 0; }
        
        body {
            font-family: "Montserrat", Arial, sans-serif;
            background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
            color: #e0e0e0;
            min-height: 100vh;
            padding: 40px;
        }
        
        .invoice-container {
            max-width: 900px;
            margin: 0 auto;
            background: #1f1f1f;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 20px 60px rgba(0,0,0,0.5);
        }
        
        .rasta-header {
            background: linear-gradient(90deg, #1c7b1c 0%, #FFD700 50%, #c01026 100%);
            height: 8px;
        }
        
        .header {
            padding: 30px 40px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid #333;
        }
        
        .logo img { height: 80px; border-radius: 50%; }
        
        .invoice-title {
            text-align: right;
        }
        
        .invoice-title h1 {
            font-size: 2.5rem;
            color: #FFD700;
            margin: 0;
        }
        
        .invoice-number {
            font-size: 1.1rem;
            color: #aaa;
            margin-top: 5px;
        }
        
        .parties {
            display: flex;
            justify-content: space-between;
            padding: 30px 40px;
            border-bottom: 1px solid #333;
        }
        
        .party {
            width: 45%;
        }
        
        .party h3 {
            color: #1c7b1c;
            font-size: 0.9rem;
            text-transform: uppercase;
            margin-bottom: 15px;
            letter-spacing: 1px;
        }
        
        .party p {
            line-height: 1.8;
            color: #ccc;
        }
        
        .party strong {
            color: #fff;
            font-size: 1.1rem;
        }
        
        .dates {
            display: flex;
            justify-content: space-around;
            padding: 20px 40px;
            background: #252525;
        }
        
        .date-item {
            text-align: center;
        }
        
        .date-item label {
            display: block;
            font-size: 0.8rem;
            color: #888;
            text-transform: uppercase;
            margin-bottom: 5px;
        }
        
        .date-item span {
            font-size: 1.1rem;
            color: #FFD700;
        }
        
        .items {
            padding: 30px 40px;
        }
        
        .items table {
            width: 100%;
            border-collapse: collapse;
        }
        
        .items th {
            background: #1c7b1c;
            color: #fff;
            padding: 15px 12px;
            text-align: left;
            font-size: 0.85rem;
            text-transform: uppercase;
        }
        
        .items th:nth-child(3),
        .items th:nth-child(5) { text-align: center; }
        
        .items th:nth-child(4),
        .items th:nth-child(6) { text-align: right; }
        
        .totals {
            padding: 20px 40px 30px;
            display: flex;
            justify-content: flex-end;
        }
        
        .totals-table {
            width: 300px;
        }
        
        .totals-table tr td {
            padding: 10px 0;
            border-bottom: 1px solid #333;
        }
        
        .totals-table tr td:last-child {
            text-align: right;
            color: #FFD700;
        }
        
        .totals-table tr.total {
            font-size: 1.3rem;
            font-weight: bold;
        }
        
        .totals-table tr.total td {
            border-top: 2px solid #1c7b1c;
            border-bottom: none;
            padding-top: 15px;
        }
        
        .payment {
            padding: 30px 40px;
            background: #252525;
        }
        
        .payment h3 {
            color: #1c7b1c;
            font-size: 0.9rem;
            text-transform: uppercase;
            margin-bottom: 20px;
        }
        
        .payment-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 20px;
        }
        
        .payment-item label {
            display: block;
            font-size: 0.8rem;
            color: #888;
            margin-bottom: 5px;
        }
        
        .payment-item span {
            color: #fff;
            font-size: 1rem;
        }
        
        .payment-item.highlight span {
            color: #FFD700;
            font-weight: bold;
        }
        
        .footer {
            padding: 20px 40px;
            text-align: center;
            border-top: 1px solid #333;
            color: #666;
            font-size: 0.85rem;
        }
        
        .rasta-footer {
            background: linear-gradient(90deg, #1c7b1c 0%, #FFD700 50%, #c01026 100%);
            height: 4px;
        }
        
        @media print {
            body { padding: 0; background: #fff; }
            .invoice-container { box-shadow: none; }
        }
    </style>
</head>
<body>
    <div class="invoice-container">
        <div class="rasta-header"></div>
        
        <div class="header">
            <div class="logo">
                <img src="' . $logoUrl . '" alt="ZION Logo">
            </div>
            <div class="invoice-title">
                <h1>FAKTURA</h1>
                <div class="invoice-number">' . htmlspecialchars($data['number']) . '</div>
            </div>
        </div>
        
        <div class="parties">
            <div class="party">
                <h3>Dodavatel</h3>
                <p>
                    <strong>' . htmlspecialchars($this->seller['name']) . '</strong><br>
                    ' . htmlspecialchars($this->seller['address']) . '<br>
                    ' . htmlspecialchars($this->seller['city']) . '<br>
                    ' . htmlspecialchars($this->seller['country']) . '<br><br>
                    IČO: ' . htmlspecialchars($this->seller['ico']) . '<br>
                    DIČ: ' . htmlspecialchars($this->seller['dic']) . '
                </p>
            </div>
            <div class="party">
                <h3>Odběratel</h3>
                <p>
                    <strong>' . htmlspecialchars($data['customer']['name']) . '</strong><br>
                    ' . nl2br(htmlspecialchars($data['customer']['address'])) . '
                    ' . $customerIcoDic . '
                </p>
            </div>
        </div>
        
        <div class="dates">
            <div class="date-item">
                <label>Datum vystavení</label>
                <span>' . htmlspecialchars($data['issue_date']) . '</span>
            </div>
            <div class="date-item">
                <label>Datum splatnosti</label>
                <span>' . htmlspecialchars($data['due_date']) . '</span>
            </div>
            <div class="date-item">
                <label>Variabilní symbol</label>
                <span>' . htmlspecialchars($data['variable_symbol']) . '</span>
            </div>
        </div>
        
        <div class="items">
            <table>
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Položka</th>
                        <th>Množství</th>
                        <th>Cena/ks</th>
                        <th>DPH</th>
                        <th>Celkem</th>
                    </tr>
                </thead>
                <tbody>
                    ' . $itemsHtml . '
                </tbody>
            </table>
        </div>
        
        <div class="totals">
            <table class="totals-table">
                <tr>
                    <td>Základ DPH</td>
                    <td>' . number_format($data['subtotal'], 2, ',', ' ') . ' Kč</td>
                </tr>
                <tr>
                    <td>DPH 21%</td>
                    <td>' . number_format($data['vat_total'], 2, ',', ' ') . ' Kč</td>
                </tr>
                <tr class="total">
                    <td>Celkem k úhradě</td>
                    <td>' . number_format($data['total'], 2, ',', ' ') . ' Kč</td>
                </tr>
            </table>
        </div>
        
        <div class="payment">
            <h3>Platební údaje</h3>
            <div class="payment-grid">
                <div class="payment-item">
                    <label>Způsob platby</label>
                    <span>' . htmlspecialchars($data['payment_method']) . '</span>
                </div>
                <div class="payment-item">
                    <label>Číslo účtu</label>
                    <span>' . htmlspecialchars($this->seller['bank_account']) . '</span>
                </div>
                <div class="payment-item highlight">
                    <label>Variabilní symbol</label>
                    <span>' . htmlspecialchars($data['variable_symbol']) . '</span>
                </div>
                <div class="payment-item">
                    <label>IBAN</label>
                    <span>' . htmlspecialchars($this->seller['iban']) . '</span>
                </div>
                <div class="payment-item">
                    <label>SWIFT</label>
                    <span>' . htmlspecialchars($this->seller['swift']) . '</span>
                </div>
                <div class="payment-item highlight">
                    <label>Částka k úhradě</label>
                    <span>' . number_format($data['total'], 2, ',', ' ') . ' Kč</span>
                </div>
            </div>
        </div>
        
        <div class="footer">
            <p>Děkujeme za Váš nákup! • ' . htmlspecialchars($this->seller['web']) . ' • ' . htmlspecialchars($this->seller['email']) . '</p>
            <p style="margin-top: 10px; color: #FFD700;">🦁 One Love, One Heart, One ZION 🦁</p>
        </div>
        
        <div class="rasta-footer"></div>
    </div>
</body>
</html>';
    }
}

/**
 * Standalone function for easy integration
 */
function generateInvoicePHP(array $order): array
{
    $generator = new PHPInvoiceGenerator();
    return $generator->generateFromOrder($order);
}
