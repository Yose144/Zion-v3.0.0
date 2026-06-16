<?php
/**
 * Discord Webhook Helper
 * Sends notifications to Discord channels
 */

if (!function_exists('discord_send_notification')) {
    /**
     * Send notification to Discord webhook
     * 
     * @param string $webhookUrl Discord webhook URL
     * @param array $data Message data
     * @return bool Success status
     */
    function discord_send_notification(string $webhookUrl, array $data): bool {
        if (empty($webhookUrl)) {
            error_log('Discord webhook URL not configured');
            return false;
        }

        $payload = json_encode($data);
        
        $ch = curl_init($webhookUrl);
        curl_setopt_array($ch, [
            CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $payload,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 10
        ]);
        
        $result = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        if ($httpCode >= 200 && $httpCode < 300) {
            return true;
        } else {
            error_log("Discord webhook failed: HTTP $httpCode - $result");
            return false;
        }
    }
}

if (!function_exists('discord_notify_presale_order')) {
    /**
     * Send presale order notification to Discord
     * 
     * @param array $order Order data
     * @return bool Success status
     */
    function discord_notify_presale_order(array $order): bool {
        $webhookUrl = defined('DISCORD_PRESALE_WEBHOOK') ? DISCORD_PRESALE_WEBHOOK : '';
        
        if (empty($webhookUrl)) {
            return false; // Webhook not configured, skip silently
        }

        $tokens = $order['package']['totalTokens'] ?? 0;
        $baseTokens = $order['package']['baseTokens'] ?? 0;
        $bonusTokens = $order['package']['bonusTokens'] ?? 0;
        $priceEur = $order['package']['priceEur'] ?? 0;
        $packageName = $order['package']['name'] ?? 'Unknown';
        $email = $order['customer']['email'] ?? 'N/A';
        $orderId = $order['orderId'] ?? 'N/A';
        $walletAddress = $order['zion']['wallet']['address'] ?? 'N/A';
        $network = $order['zion']['network'] ?? 'testnet';

        // Calculate bonus percentage
        $bonusPercent = $baseTokens > 0 ? round(($bonusTokens / $baseTokens) * 100) : 0;

        // Discord embed message
        $embed = [
            'title' => '🎉 Nová Presale Objednávka!',
            'description' => "**{$packageName}** byl právě zakoupen!",
            'color' => 3447003, // Blue color
            'fields' => [
                [
                    'name' => '📧 Email',
                    'value' => $email,
                    'inline' => true
                ],
                [
                    'name' => '💰 Cena',
                    'value' => "€{$priceEur}",
                    'inline' => true
                ],
                [
                    'name' => '🪙 Tokeny',
                    'value' => number_format($tokens, 0, ',', ' ') . " ZION",
                    'inline' => true
                ],
                [
                    'name' => '📦 Base Tokens',
                    'value' => number_format($baseTokens, 0, ',', ' '),
                    'inline' => true
                ],
                [
                    'name' => '🎁 Bonus',
                    'value' => "+{$bonusPercent}% (" . number_format($bonusTokens, 0, ',', ' ') . ")",
                    'inline' => true
                ],
                [
                    'name' => '🌐 Network',
                    'value' => ucfirst($network),
                    'inline' => true
                ],
                [
                    'name' => '🔑 Wallet',
                    'value' => "```{$walletAddress}```",
                    'inline' => false
                ],
                [
                    'name' => '📋 Order ID',
                    'value' => "`{$orderId}`",
                    'inline' => false
                ]
            ],
            'footer' => [
                'text' => 'ZION TerraNova Presale'
            ],
            'timestamp' => date(DATE_ATOM)
        ];

        $data = [
            'username' => 'ZION Presale Bot',
            'avatar_url' => 'https://newearth.cz/V2/img/zion-logo.png',
            'embeds' => [$embed]
        ];

        return discord_send_notification($webhookUrl, $data);
    }
}

if (!function_exists('discord_notify_payment_success')) {
    /**
     * Send payment success notification to Discord
     * 
     * @param string $orderId Order ID
     * @param string $paymentId Payment ID (e.g., Stripe payment intent)
     * @param float $amount Amount paid
     * @return bool Success status
     */
    function discord_notify_payment_success(string $orderId, string $paymentId, float $amount): bool {
        $webhookUrl = defined('DISCORD_PRESALE_WEBHOOK') ? DISCORD_PRESALE_WEBHOOK : '';
        
        if (empty($webhookUrl)) {
            return false;
        }

        $embed = [
            'title' => '✅ Platba Úspěšná!',
            'description' => "Platba byla úspěšně zpracována",
            'color' => 3066993, // Green color
            'fields' => [
                [
                    'name' => '📋 Order ID',
                    'value' => "`{$orderId}`",
                    'inline' => true
                ],
                [
                    'name' => '💳 Payment ID',
                    'value' => "`{$paymentId}`",
                    'inline' => true
                ],
                [
                    'name' => '💰 Částka',
                    'value' => "€{$amount}",
                    'inline' => true
                ]
            ],
            'footer' => [
                'text' => 'ZION Payment System'
            ],
            'timestamp' => date(DATE_ATOM)
        ];

        $data = [
            'username' => 'ZION Payment Bot',
            'embeds' => [$embed]
        ];

        return discord_send_notification($webhookUrl, $data);
    }
}

if (!function_exists('discord_notify_error')) {
    /**
     * Send error notification to Discord
     * 
     * @param string $title Error title
     * @param string $message Error message
     * @param array $context Additional context
     * @return bool Success status
     */
    function discord_notify_error(string $title, string $message, array $context = []): bool {
        $webhookUrl = defined('DISCORD_ERROR_WEBHOOK') ? DISCORD_ERROR_WEBHOOK : '';
        
        if (empty($webhookUrl)) {
            return false;
        }

        $fields = [];
        foreach ($context as $key => $value) {
            $fields[] = [
                'name' => $key,
                'value' => is_string($value) ? $value : json_encode($value),
                'inline' => true
            ];
        }

        $embed = [
            'title' => '🚨 ' . $title,
            'description' => $message,
            'color' => 15158332, // Red color
            'fields' => $fields,
            'footer' => [
                'text' => 'ZION Error Monitor'
            ],
            'timestamp' => date(DATE_ATOM)
        ];

        $data = [
            'username' => 'ZION Error Bot',
            'embeds' => [$embed]
        ];

        return discord_send_notification($webhookUrl, $data);
    }
}
