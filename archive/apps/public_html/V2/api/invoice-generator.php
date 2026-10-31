<?php
/**
 * ZION eShop - Generátor faktur
 * Vytváří HTML/PDF faktury pro objednávky
 */

class InvoiceGenerator
{
    // Údaje prodávajícího (z About stránky)
    private $seller = [
        'name' => 'Omnity.One s.r.o.',
        'ico' => '09120050',
        'dic' => 'CZ09120050',
        'address' => 'Horní Čermná, 56156',
        'court' => 'Krajský soud v Hradci Králové',
        'court_id' => '00215716',
        'bank_account' => '2901809148 / 2010',
        'iban' => 'CZ63 2010 0000 0029 0180 9148',
        'swift' => 'FIOBCZPPXXX',
        'bank_name' => 'Fio banka, a.s.',
        'country' => 'Česká republika',
        'email' => 'admin@newearth.cz',
        'web' => 'www.newearth.cz'
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
     * Vygeneruje fakturu pro objednávku
     */
    public function generateInvoice(array $order): array
    {
        $invoiceNumber = $this->generateInvoiceNumber($order);
        $invoiceDate = date('d.m.Y');
        $dueDate = date('d.m.Y', strtotime('+14 days'));
        
        // Sestavit data faktury
        $invoiceData = [
            'number' => $invoiceNumber,
            'date' => $invoiceDate,
            'dueDate' => $dueDate,
            'order' => $order,
            'seller' => $this->seller,
            'buyer' => $this->formatBuyer($order),
            'items' => $this->formatItems($order),
            'totals' => $this->calculateTotals($order)
        ];
        
        // Vygenerovat HTML
        $html = $this->renderInvoiceHtml($invoiceData);
        
        // Uložit HTML soubor
        $htmlFile = $this->invoicesDir . '/' . $invoiceNumber . '.html';
        file_put_contents($htmlFile, $html);
        
        // Uložit data faktury jako JSON
        $jsonFile = $this->invoicesDir . '/' . $invoiceNumber . '.json';
        file_put_contents($jsonFile, json_encode($invoiceData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        
        return [
            'number' => $invoiceNumber,
            'htmlFile' => $htmlFile,
            'jsonFile' => $jsonFile,
            'html' => $html,
            'data' => $invoiceData
        ];
    }

    /**
     * Generuje číslo faktury
     */
    private function generateInvoiceNumber(array $order): string
    {
        $year = date('Y');
        $orderId = $order['orderId'] ?? 'X';
        
        // Formát: FV2025-XXXXXX
        return 'FV' . $year . '-' . strtoupper(substr($orderId, 0, 10));
    }

    /**
     * Formátuje údaje kupujícího
     */
    private function formatBuyer(array $order): array
    {
        $customer = $order['customer'] ?? [];
        $address = $customer['address'] ?? null;
        $shipping = $order['shipping'] ?? [];
        
        $buyer = [
            'name' => $customer['name'] ?? 'Neuvedeno',
            'email' => $customer['email'] ?? '',
            'phone' => $customer['phone'] ?? '',
            'address' => ''
        ];
        
        // Adresa z doručení nebo z výdejního místa
        if ($address) {
            $buyer['address'] = implode(', ', array_filter([
                $address['street'] ?? '',
                $address['city'] ?? '',
                $address['zip'] ?? ''
            ]));
        } elseif (!empty($shipping['pickupPoint'])) {
            $pp = $shipping['pickupPoint'];
            $buyer['address'] = 'Výdejní místo: ' . ($pp['name'] ?? '') . ', ' . ($pp['city'] ?? '');
        }
        
        return $buyer;
    }

    /**
     * Formátuje položky faktury
     */
    private function formatItems(array $order): array
    {
        $items = [];
        
        foreach ($order['items'] ?? [] as $item) {
            $quantity = (int)($item['quantity'] ?? 1);
            $unitPrice = (float)($item['price'] ?? 0);
            $totalPrice = $quantity * $unitPrice;
            
            // Ceny v e-shopu jsou VČETNĚ DPH (konečné ceny)
            // Rozložíme na základ + DPH
            $vatRate = 21;
            $priceWithoutVat = round($totalPrice / 1.21, 2);
            $vatAmount = round($totalPrice - $priceWithoutVat, 2);
            
            $items[] = [
                'name' => $item['name'] ?? 'Produkt',
                'quantity' => $quantity,
                'unit' => 'ks',
                'unitPrice' => $unitPrice,  // cena s DPH za kus
                'unitPriceWithoutVat' => round($unitPrice / 1.21, 2),
                'vatRate' => $vatRate,
                'vatAmount' => $vatAmount,
                'totalPrice' => $totalPrice,  // celkem s DPH
                'priceWithoutVat' => $priceWithoutVat
            ];
        }
        
        // Přidat dopravu jako položku
        $shippingPrice = (float)($order['shipping']['price'] ?? 0);
        if ($shippingPrice > 0) {
            $shippingWithoutVat = round($shippingPrice / 1.21, 2);
            $items[] = [
                'name' => 'Doprava - ' . ($order['shipping']['method'] ?? 'Standard'),
                'quantity' => 1,
                'unit' => 'ks',
                'unitPrice' => $shippingPrice,
                'unitPriceWithoutVat' => $shippingWithoutVat,
                'vatRate' => 21,
                'vatAmount' => round($shippingPrice - $shippingWithoutVat, 2),
                'totalPrice' => $shippingPrice,
                'priceWithoutVat' => $shippingWithoutVat
            ];
        }
        
        return $items;
    }

    /**
     * Vypočítá součty
     */
    private function calculateTotals(array $order): array
    {
        $items = $this->formatItems($order);
        
        $totalWithVat = 0;
        $totalWithoutVat = 0;
        $totalVat = 0;
        
        foreach ($items as $item) {
            $totalWithVat += $item['totalPrice'];
            $totalWithoutVat += $item['priceWithoutVat'];
            $totalVat += $item['vatAmount'];
        }

        $currency = strtoupper((string)($order['currency'] ?? 'CZK'));
        if (!in_array($currency, ['CZK', 'EUR'], true)) {
            $currency = 'CZK';
        }
        
        return [
            'withoutVat' => round($totalWithoutVat, 2),
            'vat' => round($totalVat, 2),
            'withVat' => round($totalWithVat, 2),
            'currency' => $currency
        ];
    }

    /**
     * Renderuje HTML faktury
     */
    private function renderInvoiceHtml(array $data): string
    {
        $seller = $data['seller'];
        $buyer = $data['buyer'];
        $items = $data['items'];
        $totals = $data['totals'];
        $order = $data['order'];

        $currencyLabel = ($totals['currency'] ?? 'CZK') === 'EUR' ? 'EUR' : 'Kč';
        
        $itemsHtml = '';
        $i = 1;
        foreach ($items as $item) {
            $itemsHtml .= "
            <tr>
                <td>{$i}</td>
                <td>{$item['name']}</td>
                <td class='center'>{$item['quantity']} {$item['unit']}</td>
                <td class='right'>" . number_format($item['unitPriceWithoutVat'], 2, ',', ' ') . "</td>
                <td class='center'>{$item['vatRate']}%</td>
                <td class='right'>" . number_format($item['vatAmount'], 2, ',', ' ') . "</td>
                <td class='right'><strong>" . number_format($item['totalPrice'], 2, ',', ' ') . "</strong></td>
            </tr>";
            $i++;
        }
        
        $paymentMethod = match($order['payment'] ?? '') {
            'card' => 'Platba kartou',
            'transfer' => 'Bankovní převod',
            'cash' => 'Hotově / Dobírka',
            default => 'Neuvedeno'
        };

        return <<<HTML
<!DOCTYPE html>
<html lang="cs">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Faktura {$data['number']}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            font-size: 12px;
            line-height: 1.5;
            color: #333;
            background: #fff;
        }
        
        .invoice {
            max-width: 800px;
            margin: 0 auto;
            padding: 40px;
        }
        
        /* Header */
        .invoice-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 40px;
            padding-bottom: 20px;
            border-bottom: 3px solid #2c5530;
        }
        
        .company-logo {
            font-size: 28px;
            font-weight: bold;
            color: #2c5530;
        }
        
        .company-logo span {
            color: #c9a227;
        }
        
        .invoice-title {
            text-align: right;
        }
        
        .invoice-title h1 {
            font-size: 32px;
            color: #2c5530;
            margin-bottom: 5px;
        }
        
        .invoice-number {
            font-size: 16px;
            color: #666;
        }
        
        /* Parties */
        .parties {
            display: flex;
            gap: 40px;
            margin-bottom: 30px;
        }
        
        .party {
            flex: 1;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 8px;
        }
        
        .party h3 {
            color: #2c5530;
            font-size: 14px;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 2px solid #c9a227;
        }
        
        .party p {
            margin: 5px 0;
        }
        
        .party strong {
            color: #2c5530;
        }
        
        /* Invoice Info */
        .invoice-info {
            display: flex;
            gap: 20px;
            margin-bottom: 30px;
            background: linear-gradient(135deg, #2c5530, #1a3a1e);
            padding: 20px;
            border-radius: 8px;
            color: #fff;
        }
        
        .info-item {
            flex: 1;
            text-align: center;
        }
        
        .info-item label {
            display: block;
            font-size: 10px;
            text-transform: uppercase;
            opacity: 0.8;
            margin-bottom: 5px;
        }
        
        .info-item span {
            font-size: 16px;
            font-weight: bold;
        }
        
        /* Items Table */
        .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
        }
        
        .items-table th {
            background: #2c5530;
            color: #fff;
            padding: 12px 10px;
            text-align: left;
            font-size: 11px;
            text-transform: uppercase;
        }
        
        .items-table th:first-child {
            border-radius: 8px 0 0 0;
        }
        
        .items-table th:last-child {
            border-radius: 0 8px 0 0;
        }
        
        .items-table td {
            padding: 12px 10px;
            border-bottom: 1px solid #eee;
        }
        
        .items-table tr:last-child td {
            border-bottom: none;
        }
        
        .items-table .center {
            text-align: center;
        }
        
        .items-table .right {
            text-align: right;
        }
        
        /* Totals */
        .totals {
            display: flex;
            justify-content: flex-end;
            margin-bottom: 30px;
        }
        
        .totals-box {
            width: 300px;
            background: #f8f9fa;
            border-radius: 8px;
            overflow: hidden;
        }
        
        .totals-row {
            display: flex;
            justify-content: space-between;
            padding: 12px 20px;
            border-bottom: 1px solid #eee;
        }
        
        .totals-row:last-child {
            border-bottom: none;
            background: linear-gradient(135deg, #c9a227, #a88b1f);
            color: #000;
            font-size: 18px;
            font-weight: bold;
        }
        
        /* Payment */
        .payment-info {
            background: #fff3cd;
            border: 1px solid #c9a227;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 30px;
        }
        
        .payment-info h3 {
            color: #856404;
            margin-bottom: 15px;
        }
        
        .payment-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
        }
        
        .payment-grid p {
            margin: 5px 0;
        }
        
        /* QR Code placeholder */
        .qr-section {
            text-align: center;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 8px;
            margin-bottom: 30px;
        }
        
        .qr-section img {
            max-width: 150px;
        }
        
        /* Footer */
        .invoice-footer {
            text-align: center;
            padding-top: 20px;
            border-top: 1px solid #eee;
            color: #888;
            font-size: 11px;
        }
        
        .invoice-footer a {
            color: #2c5530;
        }
        
        /* Print styles */
        @media print {
            body {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }
            
            .invoice {
                padding: 20px;
            }
        }
    </style>
</head>
<body>
    <div class="invoice">
        <!-- Header -->
        <div class="invoice-header">
            <div class="company-logo">
                ZION<span> ® TerraNova</span>
            </div>
            <div class="invoice-title">
                <h1>FAKTURA</h1>
                <div class="invoice-number">{$data['number']}</div>
            </div>
        </div>
        
        <!-- Parties -->
        <div class="parties">
            <div class="party">
                <h3>Dodavatel</h3>
                <p><strong>{$seller['name']}</strong></p>
                <p>{$seller['address']}</p>
                <p>{$seller['country']}</p>
                <p>IČO: {$seller['ico']}</p>
                <p>DIČ: {$seller['dic']}</p>
                <p>Zapsáno: {$seller['court']}</p>
            </div>
            <div class="party">
                <h3>Odběratel</h3>
                <p><strong>{$buyer['name']}</strong></p>
                <p>{$buyer['address']}</p>
                <p>Email: {$buyer['email']}</p>
                <p>Tel: {$buyer['phone']}</p>
            </div>
        </div>
        
        <!-- Invoice Info -->
        <div class="invoice-info">
            <div class="info-item">
                <label>Datum vystavení</label>
                <span>{$data['date']}</span>
            </div>
            <div class="info-item">
                <label>Datum splatnosti</label>
                <span>{$data['dueDate']}</span>
            </div>
            <div class="info-item">
                <label>Způsob platby</label>
                <span>{$paymentMethod}</span>
            </div>
            <div class="info-item">
                <label>Variabilní symbol</label>
                <span>{$order['orderId']}</span>
            </div>
        </div>
        
        <!-- Items -->
        <table class="items-table">
            <thead>
                <tr>
                    <th style="width:30px;">#</th>
                    <th>Položka</th>
                    <th class="center" style="width:80px;">Množství</th>
                    <th class="right" style="width:100px;">Cena/ks</th>
                    <th class="center" style="width:60px;">DPH</th>
                    <th class="right" style="width:80px;">DPH {$currencyLabel}</th>
                    <th class="right" style="width:100px;">Celkem</th>
                </tr>
            </thead>
            <tbody>
                {$itemsHtml}
            </tbody>
        </table>
        
        <!-- Totals -->
        <div class="totals">
            <div class="totals-box">
                <div class="totals-row">
                    <span>Základ DPH:</span>
                    <span>{$this->formatPrice($totals['withoutVat'])} {$currencyLabel}</span>
                </div>
                <div class="totals-row">
                    <span>DPH 21%:</span>
                    <span>{$this->formatPrice($totals['vat'])} {$currencyLabel}</span>
                </div>
                <div class="totals-row">
                    <span>Celkem k úhradě:</span>
                    <span>{$this->formatPrice($totals['withVat'])} {$currencyLabel}</span>
                </div>
            </div>
        </div>
        
        <!-- Payment Info -->
        <div class="payment-info">
            <h3>💳 Platební údaje</h3>
            <div class="payment-grid">
                <p><strong>Číslo účtu:</strong> {$seller['bank_account']}</p>
                <p><strong>IBAN:</strong> {$seller['iban']}</p>
                <p><strong>SWIFT:</strong> {$seller['swift']}</p>
                <p><strong>Banka:</strong> {$seller['bank_name']}</p>
                <p><strong>Variabilní symbol:</strong> {$order['orderId']}</p>
                <p><strong>Částka:</strong> {$this->formatPrice($totals['withVat'])} {$currencyLabel}</p>
            </div>
        </div>
        
        <!-- Footer -->
        <div class="invoice-footer">
            <p>Děkujeme za Vaši objednávku!</p>
            <p>{$seller['name']} | {$seller['email']} | <a href="https://{$seller['web']}">{$seller['web']}</a></p>
            <p style="margin-top:10px;">Faktura byla vystavena elektronicky a je platná bez podpisu.</p>
        </div>
    </div>
</body>
</html>
HTML;
    }

    /**
     * Formátuje cenu
     */
    private function formatPrice(float $price): string
    {
        return number_format($price, 2, ',', ' ');
    }

    /**
     * Vrátí cestu ke složce s fakturami
     */
    public function getInvoicesDir(): string
    {
        return $this->invoicesDir;
    }
}
