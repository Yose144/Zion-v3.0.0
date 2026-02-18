<?php
/**
 * Trivi Order Mapper
 * ===================
 * Převádí e-shop objednávky do formátu Trivi API
 * 
 * Podle požadavků Trivi:
 * - Souvislé číselné řady pro faktury/zálohy/DDZ
 * - Unikátní variabilní symboly
 * - Povinné pole "country" (země odběratele)
 * - Výpočet ceny "shora" (včetně DPH → bez DPH)
 * - Kurzy ČNB T-1 pro cizí měny
 * - Jedna platba = jeden doklad = jeden VS
 * 
 * @author ZION Team
 * @created 2026-01-06
 */

require_once __DIR__ . '/trivi-config.php';

class TriviOrderMapper
{
    private const VAT_RATE_CZ = 0.21; // 21% DPH
    private const VAT_RATE_EU = 0.0;  // 0% pro MOSS/OSS
    private const VAT_RATE_EXPORT = 0.0; // 0% pro export mimo EU
    
    /**
     * Convert e-shop order to Trivi invoice format
     * 
     * @param array $order Order data from create-order.php
     * @param int $sequenceNumber Invoice sequence number (pro souvislou řadu)
     * @param bool $isPresale Je to presale objednávka? (pro oddělenou řadu faktur)
     * @return array Trivi invoice data
     */
    public static function orderToInvoice(array $order, int $sequenceNumber, bool $isPresale = false): array
    {
        $orderId = $order['orderId'] ?? '';
        $customer = $order['customer'] ?? [];
        $items = $order['items'] ?? [];
        $shipping = $order['shipping'] ?? [];
        $payment = $order['payment'] ?? [];
        $total = floatval($order['total'] ?? 0);
        
        // Extract customer address with REQUIRED "country"
        $address = self::extractCustomerAddress($customer, $shipping);
        if (empty($address['country'])) {
            throw new Exception('Country (země odběratele) is REQUIRED by Trivi API');
        }
        
        // Generate invoice number (souvislá řada - oddělené pro e-shop a presale)
        $invoiceNumber = TriviConfig::generateInvoiceNumber($sequenceNumber, $isPresale);
        
        // Extract variabilní symbol (MUSÍ odpovídat platbě!)
        $variableSymbol = TriviConfig::extractVariableSymbol($orderId);
        
        // Determine VAT rate based on country
        $vatRate = self::getVatRate($address['country']);
        
        // Convert items to Trivi format
        $triviItems = self::convertItemsToTrivi($items, $vatRate);
        
        // Add shipping as separate item if > 0
        $shippingPrice = floatval($shipping['price'] ?? 0);
        if ($shippingPrice > 0) {
            $triviItems[] = [
                'name' => 'Doprava - ' . ($shipping['method'] ?? 'Neznámá'),
                'quantity' => 1,
                'unit_price_with_vat' => $shippingPrice,
                'unit_price_without_vat' => self::calculatePriceWithoutVat($shippingPrice, $vatRate),
                'vat_rate' => $vatRate,
                'vat_amount' => self::calculateVatAmount($shippingPrice, $vatRate),
                'total_with_vat' => $shippingPrice,
                'fin_account' => TriviConfig::getFinAccount('shipping')
            ];
        }
        
        // Calculate totals
        $totals = self::calculateTotals($triviItems);
        
        // Build Trivi invoice payload
        return [
            'invoice_number' => $invoiceNumber,
            'variable_symbol' => $variableSymbol,
            'issue_date' => date('Y-m-d'), // Datum vystavení
            'due_date' => date('Y-m-d', strtotime('+14 days')), // Splatnost 14 dní
            'date_of_taxable_supply' => date('Y-m-d'), // DUZP (datum uskutečnění zdanitelného plnění)
            
            // Customer data (MUSÍ obsahovat "country"!)
            'customer' => [
                'name' => $address['name'] ?? 'Neznámý zákazník',
                'email' => $customer['email'] ?? '',
                'phone' => $customer['phone'] ?? '',
                'address' => [
                    'street' => $address['street'] ?? '',
                    'city' => $address['city'] ?? '',
                    'zip' => $address['zip'] ?? '',
                    'country' => $address['country'] // POVINNÉ!
                ],
                'company' => $address['company'] ?? null, // Volitelné (pro firmy)
                'ico' => $address['ico'] ?? null, // IČO (pokud je firma)
                'dic' => $address['dic'] ?? null  // DIČ (pokud je plátce DPH)
            ],
            
            // Items
            'items' => $triviItems,
            
            // Totals (výpočet "shora": cena s DPH → cena bez DPH)
            'totals' => [
                'subtotal_without_vat' => $totals['subtotal_without_vat'],
                'vat_amount' => $totals['vat_amount'],
                'total_with_vat' => $totals['total_with_vat']
            ],
            
            // Payment method
            'payment' => [
                'method' => self::mapPaymentMethod($payment['method'] ?? 'bank'),
                'bank_account' => $_ENV['BANK_ACCOUNT'] ?? null // Bank účet pro příkaz k úhradě
            ],
            
            // Currency (default CZK, TODO: support EUR from presale)
            'currency' => 'CZK',
            'exchange_rate' => self::getExchangeRate('CZK'), // ČNB kurz T-1
            
            // Metadata (pro identifikaci zdroje)
            'metadata' => [
                'source' => 'ZION eShop',
                'order_id' => $orderId,
                'payment_status' => $payment['status'] ?? 'pending'
            ]
        ];
    }
    
    /**
     * Convert e-shop order to Trivi advance payment (záloha)
     * Pro presale objednávky se zálohovou platbou
     */
    public static function orderToAdvancePayment(array $order, int $sequenceNumber): array
    {
        $orderId = $order['orderId'] ?? '';
        $customer = $order['customer'] ?? [];
        $total = floatval($order['total'] ?? 0);
        
        $address = self::extractCustomerAddress($customer, []);
        if (empty($address['country'])) {
            throw new Exception('Country is REQUIRED for advance payment');
        }
        
        $advanceNumber = TriviConfig::generateAdvanceNumber($sequenceNumber);
        $variableSymbol = TriviConfig::extractVariableSymbol($orderId);
        
        return [
            'advance_number' => $advanceNumber,
            'variable_symbol' => $variableSymbol,
            'issue_date' => date('Y-m-d'),
            'payment_date' => date('Y-m-d'), // Datum platby (adjust při skutečné platbě)
            
            'customer' => [
                'name' => $address['name'] ?? 'Neznámý zákazník',
                'email' => $customer['email'] ?? '',
                'address' => [
                    'street' => $address['street'] ?? '',
                    'city' => $address['city'] ?? '',
                    'zip' => $address['zip'] ?? '',
                    'country' => $address['country']
                ]
            ],
            
            'amount' => $total,
            'currency' => 'CZK',
            
            'metadata' => [
                'source' => 'ZION Presale',
                'order_id' => $orderId
            ]
        ];
    }
    
    /**
     * Extract customer address with REQUIRED country field
     */
    private static function extractCustomerAddress(array $customer, array $shipping): array
    {
        // Try customer.address first
        $address = $customer['address'] ?? [];
        
        // If shipping to pickup point (Zásilkovna), use pickup address
        if (!empty($shipping['pickupPoint'])) {
            $pp = $shipping['pickupPoint'];
            return [
                'name' => $customer['name'] ?? '',
                'street' => $pp['street'] ?? '',
                'city' => $pp['city'] ?? '',
                'zip' => $pp['zip'] ?? '',
                'country' => $pp['country'] ?? 'CZ' // Default: CZ pro Zásilkovnu
            ];
        }
        
        // Standard address
        return [
            'name' => $customer['name'] ?? '',
            'street' => $address['street'] ?? $customer['street'] ?? '',
            'city' => $address['city'] ?? $customer['city'] ?? '',
            'zip' => $address['zip'] ?? $customer['zip'] ?? '',
            'country' => $address['country'] ?? $customer['country'] ?? 'CZ', // DEFAULT: CZ
            'company' => $address['company'] ?? $customer['company'] ?? null,
            'ico' => $address['ico'] ?? $customer['ico'] ?? null,
            'dic' => $address['dic'] ?? $customer['dic'] ?? null
        ];
    }
    
    /**
     * Convert e-shop items to Trivi format with "shora" price calculation
     */
    private static function convertItemsToTrivi(array $items, float $vatRate): array
    {
        $triviItems = [];
        
        foreach ($items as $item) {
            $name = $item['name'] ?? $item['title'] ?? 'Neznámá položka';
            $quantity = intval($item['quantity'] ?? 1);
            $priceWithVat = floatval($item['price'] ?? 0);
            
            // Calculate WITHOUT VAT from WITH VAT ("shora" výpočet)
            $priceWithoutVat = self::calculatePriceWithoutVat($priceWithVat, $vatRate);
            $vatAmount = self::calculateVatAmount($priceWithVat, $vatRate);
            $totalWithVat = $priceWithVat * $quantity;
            
            $triviItems[] = [
                'name' => $name,
                'quantity' => $quantity,
                'unit_price_with_vat' => $priceWithVat,
                'unit_price_without_vat' => $priceWithoutVat,
                'vat_rate' => $vatRate,
                'vat_amount' => $vatAmount * $quantity,
                'total_with_vat' => $totalWithVat,
                'fin_account' => TriviConfig::getFinAccount('eshop_sales')
            ];
        }
        
        return $triviItems;
    }
    
    /**
     * Calculate price WITHOUT VAT from price WITH VAT ("shora")
     * Formula: price_without_vat = price_with_vat / (1 + vat_rate)
     */
    private static function calculatePriceWithoutVat(float $priceWithVat, float $vatRate): float
    {
        if ($vatRate === 0.0) {
            return $priceWithVat;
        }
        
        return round($priceWithVat / (1 + $vatRate), 2);
    }
    
    /**
     * Calculate VAT amount from price WITH VAT
     * Formula: vat = price_with_vat - (price_with_vat / (1 + vat_rate))
     */
    private static function calculateVatAmount(float $priceWithVat, float $vatRate): float
    {
        if ($vatRate === 0.0) {
            return 0.0;
        }
        
        $priceWithoutVat = self::calculatePriceWithoutVat($priceWithVat, $vatRate);
        return round($priceWithVat - $priceWithoutVat, 2);
    }
    
    /**
     * Calculate totals from items
     */
    private static function calculateTotals(array $items): array
    {
        $subtotalWithoutVat = 0;
        $vatAmount = 0;
        $totalWithVat = 0;
        
        foreach ($items as $item) {
            $subtotalWithoutVat += $item['unit_price_without_vat'] * $item['quantity'];
            $vatAmount += $item['vat_amount'];
            $totalWithVat += $item['total_with_vat'];
        }
        
        return [
            'subtotal_without_vat' => round($subtotalWithoutVat, 2),
            'vat_amount' => round($vatAmount, 2),
            'total_with_vat' => round($totalWithVat, 2)
        ];
    }
    
    /**
     * Get VAT rate based on country
     * CZ = 21%, EU = 0% (MOSS/OSS), non-EU = 0% (export)
     */
    private static function getVatRate(string $country): float
    {
        $country = strtoupper(trim($country));
        
        // Czech Republic
        if ($country === 'CZ' || $country === 'CZE') {
            return self::VAT_RATE_CZ;
        }
        
        // EU countries (MOSS/OSS handling - TODO: implement reverse charge)
        $euCountries = ['SK', 'PL', 'DE', 'AT', 'HU', 'FR', 'IT', 'ES', 'PT', 'NL', 'BE', 'LU', 
                        'DK', 'SE', 'FI', 'EE', 'LV', 'LT', 'IE', 'MT', 'CY', 'GR', 'BG', 'RO', 'HR', 'SI'];
        
        if (in_array($country, $euCountries)) {
            return self::VAT_RATE_EU;
        }
        
        // Non-EU export
        return self::VAT_RATE_EXPORT;
    }
    
    /**
     * Map e-shop payment method to Trivi format
     */
    private static function mapPaymentMethod(string $method): string
    {
        $mapping = [
            'bank' => 'bank_transfer',
            'card' => 'card',
            'stripe' => 'card',
            'cash' => 'cash',
            'paypal' => 'paypal'
        ];
        
        return $mapping[$method] ?? 'bank_transfer';
    }
    
    /**
     * Get ČNB exchange rate for currency (T-1 = previous day)
     * Podle požadavků Trivi: pro aktuální den platí kurz dne předchozího
     */
    private static function getExchangeRate(string $currency): float
    {
        // CZK = 1.0 (base currency)
        if ($currency === 'CZK') {
            return 1.0;
        }
        
        // TODO: Implement ČNB API integration for other currencies
        // https://www.cnb.cz/cs/financni-trhy/devizovy-trh/kurzy-devizoveho-trhu/kurzy-devizoveho-trhu/denni_kurz.txt
        
        // Fallback: return 1.0 (will need manual adjustment)
        return 1.0;
    }
}
