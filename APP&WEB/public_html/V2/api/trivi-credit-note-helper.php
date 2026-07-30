<?php
/**
 * Trivi Credit Note & Advance Payment Helper
 * ===========================================
 * Pomocné funkce pro dobropisy (credit notes) a zálohy (advance payments)
 * 
 * @author ZION Team
 * @created 2026-01-06
 */

require_once __DIR__ . '/trivi-config.php';

class TriviCreditNoteHelper
{
    /**
     * Create credit note (dobropis) from original order
     * 
     * @param array $originalOrder Original order data
     * @param array $refundItems Items to refund (or null for full refund)
     * @param string $reason Reason for credit note
     * @param int $sequenceNumber Credit note sequence number
     * @return array Credit note data for Trivi
     */
    public static function createCreditNote(
        array $originalOrder,
        array $refundItems = null,
        string $reason = 'Reklamace/vrácení zboží',
        int $sequenceNumber = 1
    ) {
        $orderId = $originalOrder['orderId'] ?? '';
        $customer = $originalOrder['customer'] ?? [];
        
        // If no specific items, refund everything
        if ($refundItems === null) {
            $refundItems = $originalOrder['items'] ?? [];
        }
        
        // Calculate refund amount
        $refundAmount = 0;
        foreach ($refundItems as $item) {
            $refundAmount += floatval($item['price'] ?? 0) * intval($item['quantity'] ?? 1);
        }
        
        // Generate credit note number
        $year = date('Y');
        $number = str_pad($sequenceNumber, 4, '0', STR_PAD_LEFT);
        $creditNoteNumber = "ZION-CN-{$year}/{$number}"; // CN = Credit Note
        
        // Extract original invoice number (if available)
        $originalInvoiceNumber = $originalOrder['invoice_number'] ?? 
                                $originalOrder['trivi_invoice_number'] ?? 
                                'N/A';
        
        return [
            'credit_note_number' => $creditNoteNumber,
            'original_invoice_number' => $originalInvoiceNumber,
            'original_order_id' => $orderId,
            'issue_date' => date('Y-m-d'),
            'reason' => $reason,
            
            'customer' => [
                'name' => $customer['name'] ?? 'Unknown',
                'email' => $customer['email'] ?? '',
                'address' => [
                    'street' => $customer['address']['street'] ?? '',
                    'city' => $customer['address']['city'] ?? '',
                    'zip' => $customer['address']['zip'] ?? '',
                    'country' => $customer['address']['country'] ?? 'CZ'
                ]
            ],
            
            'items' => $refundItems,
            'refund_amount' => $refundAmount,
            'currency' => 'CZK',
            
            'metadata' => [
                'source' => 'ZION eShop',
                'type' => 'credit_note',
                'original_order_id' => $orderId
            ]
        ];
    }
    
    /**
     * Create advance payment invoice (záloha)
     * Pro presale nebo předobjednávky
     * 
     * @param array $order Order data
     * @param float $advanceAmount Amount of advance payment
     * @param int $sequenceNumber Advance sequence number
     * @return array Advance payment data for Trivi
     */
    public static function createAdvancePayment(
        array $order,
        float $advanceAmount,
        int $sequenceNumber = 1
    ) {
        $orderId = $order['orderId'] ?? '';
        $customer = $order['customer'] ?? [];
        
        // Generate advance number
        $advanceNumber = TriviConfig::generateAdvanceNumber($sequenceNumber);
        
        // Variable symbol (same as order)
        $variableSymbol = TriviConfig::extractVariableSymbol($orderId);
        
        return [
            'advance_number' => $advanceNumber,
            'variable_symbol' => $variableSymbol,
            'issue_date' => date('Y-m-d'),
            'payment_date' => date('Y-m-d'), // Adjust when actual payment received
            'due_date' => date('Y-m-d', strtotime('+14 days')),
            
            'customer' => [
                'name' => $customer['name'] ?? 'Unknown',
                'email' => $customer['email'] ?? '',
                'phone' => $customer['phone'] ?? '',
                'address' => [
                    'street' => $customer['address']['street'] ?? '',
                    'city' => $customer['address']['city'] ?? '',
                    'zip' => $customer['address']['zip'] ?? '',
                    'country' => $customer['address']['country'] ?? 'CZ'
                ]
            ],
            
            'advance_amount' => $advanceAmount,
            'currency' => 'CZK',
            
            'metadata' => [
                'source' => 'ZION Presale',
                'order_id' => $orderId,
                'type' => 'advance_payment'
            ]
        ];
    }
    
    /**
     * Create tax document for advance payment (DDPZ - Daňový doklad k přijaté záloze)
     * Pouze pro plátce DPH pokud záloha není vyúčtována do konce měsíce
     * 
     * @param array $advancePayment Advance payment data
     * @param int $sequenceNumber DDPZ sequence number
     * @return array Tax document data for Trivi
     */
    public static function createTaxDocumentForAdvance(
        array $advancePayment,
        int $sequenceNumber = 1
    ) {
        $year = date('Y');
        $number = str_pad($sequenceNumber, 4, '0', STR_PAD_LEFT);
        $ddpzNumber = TriviConfig::TAX_DOC_PREFIX . "-{$year}/{$number}";
        
        return [
            'tax_doc_number' => $ddpzNumber,
            'advance_number' => $advancePayment['advance_number'] ?? '',
            'issue_date' => date('Y-m-d'),
            'date_of_taxable_supply' => date('Y-m-d'), // DUZP
            
            'customer' => $advancePayment['customer'] ?? [],
            
            'advance_amount' => $advancePayment['advance_amount'] ?? 0,
            'vat_rate' => 0.21, // 21% DPH
            'vat_amount' => self::calculateVatFromAdvance($advancePayment['advance_amount'] ?? 0),
            
            'currency' => 'CZK',
            
            'metadata' => [
                'source' => 'ZION Presale',
                'type' => 'tax_document_advance',
                'advance_number' => $advancePayment['advance_number'] ?? ''
            ]
        ];
    }
    
    /**
     * Calculate VAT amount from advance payment (výpočet "shora")
     */
    private static function calculateVatFromAdvance(float $advanceAmount, float $vatRate = 0.21)
    {
        if ($vatRate === 0.0) {
            return 0.0;
        }
        
        $amountWithoutVat = $advanceAmount / (1 + $vatRate);
        return round($advanceAmount - $amountWithoutVat, 2);
    }
}

/**
 * Helper class for handling refunds/complaints in order system
 */
class RefundHelper
{
    /**
     * Process refund request (simple version - just data preparation)
     * 
     * @param string $orderId Order ID to refund
     * @param array $refundItems Items to refund (or null for full)
     * @param string $reason Refund reason
     * @return array Refund data
     */
    public static function processRefund(
        string $orderId,
        array $refundItems = null,
        string $reason = 'Reklamace'
    ) {
        // Load order
        $orderFile = __DIR__ . '/../orders/' . $orderId . '.json';
        if (!file_exists($orderFile)) {
            return ['success' => false, 'error' => 'Order not found'];
        }
        
        $order = json_decode(file_get_contents($orderFile), true);
        
        // Create refund record
        $refundId = 'REFUND-' . time() . '-' . substr($orderId, -6);
        
        $refundData = [
            'refund_id' => $refundId,
            'order_id' => $orderId,
            'reason' => $reason,
            'items' => $refundItems ?? $order['items'] ?? [],
            'status' => 'pending', // pending, approved, rejected, completed
            'created_at' => date('Y-m-d H:i:s'),
            'customer_email' => $order['customer']['email'] ?? ''
        ];
        
        // Save refund request
        $refundsDir = __DIR__ . '/../refunds';
        if (!is_dir($refundsDir)) {
            mkdir($refundsDir, 0755, true);
        }
        
        $refundFile = $refundsDir . '/' . $refundId . '.json';
        file_put_contents($refundFile, json_encode($refundData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        
        return [
            'success' => true,
            'refund_id' => $refundId,
            'status' => 'pending',
            'message' => 'Refund request created, awaiting approval'
        ];
    }
    
    /**
     * Approve refund and create credit note
     */
    public static function approveRefund(string $refundId)
    {
        $refundFile = __DIR__ . '/../refunds/' . $refundId . '.json';
        if (!file_exists($refundFile)) {
            return ['success' => false, 'error' => 'Refund not found'];
        }
        
        $refund = json_decode(file_get_contents($refundFile), true);
        $refund['status'] = 'approved';
        $refund['approved_at'] = date('Y-m-d H:i:s');
        
        file_put_contents($refundFile, json_encode($refund, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        
        // TODO: Send email notification to customer
        // TODO: Create credit note in Trivi (if needed)
        
        return [
            'success' => true,
            'refund_id' => $refundId,
            'status' => 'approved',
            'message' => 'Refund approved'
        ];
    }
}
