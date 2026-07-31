<?php
/**
 * ZION QR Code Generator v3.0
 * ==================================
 * Generates REAL scannable QR codes using QuickChart.io API
 * Compatible with ZION Mobile App QR Scanner
 * 
 * Author: ZION Team
 * Version: 3.0.0
 * Date: 02.01.2026
 */

if (!defined('QUICKCHART_API_URL')) {
    define('QUICKCHART_API_URL', 'https://quickchart.io/qr');
}

if (!function_exists('generate_qr_code_png')) {
    /**
     * Generate QR code PNG data URL from text using QuickChart.io API
     * 
     * @param string $text Text to encode (JSON or URI)
     * @param int $size Image size in pixels
     * @param int $margin Border margin (not used, kept for compatibility)
     * @return string|null Base64 data URL or null on failure
     */
    function generate_qr_code_png(string $text, int $size = 400, int $margin = 1): ?string {
        try {
            // Build QuickChart.io QR URL
            $params = http_build_query([
                'text' => $text,
                'size' => $size,
                'margin' => 2,
                'format' => 'png',
                'ecLevel' => 'H',  // High error correction for better scanning
                'dark' => '000000', // Black (standard QR)
                'light' => 'ffffff' // White background (standard QR)
            ]);
            
            $url = QUICKCHART_API_URL . '?' . $params;
            
            // Fetch QR image from API
            $context = stream_context_create([
                'http' => [
                    'timeout' => 10,
                    'user_agent' => 'ZION-Presale/3.0'
                ]
            ]);
            
            $pngData = @file_get_contents($url, false, $context);
            
            if ($pngData && strlen($pngData) > 1000) {
                return 'data:image/png;base64,' . base64_encode($pngData);
            }
            
            error_log("QR API returned invalid data (size: " . strlen($pngData ?? '') . ")");
            return null;

        } catch (Throwable $e) {
            error_log('QR generation failed: ' . $e->getMessage());
        }

        return null;
    }
}

if (!function_exists('generate_qr_code_file')) {
    /**
     * Generate QR code and save to file
     * 
     * @param string $text Text to encode
     * @param string $filename Output filename
     * @param int $size Image size in pixels
     * @param int $margin Border margin (compatibility)
     * @return bool Success
     */
    function generate_qr_code_file(string $text, string $filename, int $size = 400, int $margin = 1): bool {
        try {
            $dataUrl = generate_qr_code_png($text, $size, $margin);
            if (!$dataUrl) {
                return false;
            }

            // Extract PNG data from data URL
            $pngData = base64_decode(str_replace('data:image/png;base64,', '', $dataUrl));
            if (!$pngData || strlen($pngData) < 1000) {
                error_log("QR file: Invalid PNG data");
                return false;
            }

            $result = file_put_contents($filename, $pngData);
            if ($result !== false) {
                error_log("✅ QR saved: $filename (" . strlen($pngData) . " bytes)");
                return true;
            }
            
            return false;

        } catch (Throwable $e) {
            error_log('QR file generation failed: ' . $e->getMessage());
        }

        return false;
    }
}

if (!function_exists('generate_wallet_qr_json')) {
    /**
     * Generate QR code with ZION wallet JSON data (for mobile app import)
     * 
     * This creates the JSON format expected by mobile-app/src/utils/zionUri.js
     * 
     * @param array $wallet Wallet data with keys: address, mnemonic, tokens, order_id, network
     * @param string $filename Output filename
     * @param int $size Image size
     * @return bool Success
     */
    function generate_wallet_qr_json(array $wallet, string $filename, int $size = 400): bool {
        $walletId = $wallet['wallet_id'] ?? $wallet['walletId'] ?? $wallet['id'] ?? '';
        $orderId = $wallet['order_id'] ?? $wallet['orderId'] ?? $wallet['order'] ?? '';
        $network = $wallet['network'] ?? 'mainnet';
        $createdAt = $wallet['created_at'] ?? $wallet['createdAt'] ?? date(DATE_ATOM);

        // Build JSON in a backward/forward compatible format.
        // Some clients expect snake_case keys, others camelCase.
        $qrData = json_encode([
            'type' => 'ZION_PRESALE_WALLET',
            'version' => '3.0',

            // Identity
            'wallet_id' => $walletId,
            'walletId' => $walletId,

            // Wallet payload
            'address' => $wallet['address'] ?? '',
            'mnemonic' => $wallet['mnemonic'] ?? '',
            'tokens' => (int)($wallet['tokens'] ?? 0),

            // Order linkage
            'order_id' => $orderId,
            'orderId' => $orderId,

            // Network metadata
            'network' => $network,
            'created_at' => $createdAt,
            'createdAt' => $createdAt
        ], JSON_UNESCAPED_UNICODE);
        
        return generate_qr_code_file($qrData, $filename, $size);
    }
}