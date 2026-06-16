<?php
/**
 * ZION Email Template Helper V3
 * ==============================
 * Renderuje Rasta email šablony s dynamickými daty.
 * Podporuje mobile-kompatibilní QR kódy s mnemonikem.
 * 
 * Version: 3.0
 * Updated: 02.01.2026
 */

require_once __DIR__ . '/url-helper.php';
require_once __DIR__ . '/qr-generator.php';

/**
 * Vygeneruje URL pro wallet QR kód
 * Hledá různé formáty názvů souborů
 * 
 * @param string $walletId Wallet ID (zw_xxx)
 * @param string $orderId Order ID (fallback)
 * @return string|null URL nebo null pokud neexistuje
 */
function getWalletQRUrl($walletId, $orderId = '') {
    $walletsDir = dirname(__DIR__) . '/wallets/';
    $baseUrl = rtrim(zion_wallet_public_url(), '/') . '/';
    
    // Možné formáty názvů souborů
    $possibleFiles = [
        "{$walletId}.png",
        "{$walletId}_recovery.png",
        "{$walletId}_mobile_qr.png",
    ];
    
    // Přidej varianty z orderId
    if ($orderId) {
        $cleanOrderId = preg_replace('/[^a-zA-Z0-9_-]/', '', $orderId);
        $possibleFiles[] = "{$cleanOrderId}.png";
        $possibleFiles[] = "zw_{$cleanOrderId}.png";
    }
    
    foreach ($possibleFiles as $filename) {
        $filepath = $walletsDir . $filename;
        if (file_exists($filepath) && filesize($filepath) > 1000) {
            return $baseUrl . $filename;
        }
    }
    
    return null;
}

/**
 * Vygeneruje QR kód pro wallet pokud neexistuje
 * 
 * @param array $walletData Wallet data s mnemonic, address, tokens, atd.
 * @return string|null URL k vygenerovanému QR nebo null
 */
function generateWalletQRIfNeeded($walletData) {
    $walletId = $walletData['wallet_id'] ?? $walletData['walletId'] ?? '';
    if (!$walletId) {
        return null;
    }
    
    $walletsDir = dirname(__DIR__) . '/wallets/';
    $filename = "{$walletId}.png";
    $filepath = $walletsDir . $filename;
    
    // Pokud existuje a je validní, vrať URL
    if (file_exists($filepath) && filesize($filepath) > 1000) {
        return zion_wallet_public_url($filename);
    }
    
    // Generuj nový QR
    if (!is_dir($walletsDir)) {
        mkdir($walletsDir, 0755, true);
    }
    
    if (generate_wallet_qr_json($walletData, $filepath, 400)) {
        return zion_wallet_public_url($filename);
    }
    
    return null;
}

/**
 * Legacy funkce - zachována pro zpětnou kompatibilitu
 */
function getMobileQRUrl($orderId) {
    return getWalletQRUrl('', $orderId);
}

/**
 * Načte a vyplní Rasta email šablonu pro presale
 * 
 * @param array $data Asociativní pole s daty
 * @return string HTML email
 */
function renderPresaleEmailRasta($data) {
    $templatePath = __DIR__ . '/../email-templates/presale-confirmation-rasta.html';
    
    if (!file_exists($templatePath)) {
        throw new Exception('Email template not found: ' . $templatePath);
    }
    
    $template = file_get_contents($templatePath);
    
    // Základní placeholders
    $replacements = [
        '{{ORDER_ID}}' => $data['orderId'] ?? 'N/A',
        '{{AMOUNT}}' => number_format($data['amount'] ?? 0, 2, ',', ' '),
        '{{CURRENCY}}' => $data['currency'] ?? 'CZK',
        '{{ZION_AMOUNT}}' => number_format($data['zionAmount'] ?? 0, 2, '.', ' '),
        '{{ZION_ADDRESS}}' => $data['zionAddress'] ?? 'N/A',
        '{{ZION_MNEMONIC}}' => $data['zionMnemonic'] ?? 'N/A',
        '{{TIMESTAMP}}' => $data['timestamp'] ?? date('d.m.Y H:i:s'),
        '{{CUSTOMER_NAME}}' => $data['name'] ?? 'Vážený zákazníku'
    ];
    
    // QR Code - zkusíme najít existující nebo vygenerovat nový
    $walletId = $data['walletId'] ?? $data['wallet_id'] ?? '';
    $qrUrl = getWalletQRUrl($walletId, $data['orderId'] ?? '');
    
    // Pokud QR neexistuje a máme mnemonic, vygeneruj ho
    if (!$qrUrl && !empty($data['zionMnemonic']) && $data['zionMnemonic'] !== 'N/A') {
        $walletNetwork = $data['network'] ?? $data['zionNetwork'] ?? 'mainnet';
        $walletData = [
            'wallet_id' => $walletId ?: ('zw_' . substr(md5($data['orderId'] ?? uniqid()), 0, 12)),
            'address' => $data['zionAddress'] ?? '',
            'mnemonic' => $data['zionMnemonic'] ?? '',
            'tokens' => (int)($data['zionAmount'] ?? 0),
            'order_id' => $data['orderId'] ?? '',
            'network' => $walletNetwork
        ];
        $qrUrl = generateWalletQRIfNeeded($walletData);
    }
    
    // Fallback na předané qrCodeUrl
    if (!$qrUrl && !empty($data['qrCodeUrl'])) {
        $qrUrl = $data['qrCodeUrl'];
    }
    
    if ($qrUrl) {
        $qrSection = '
        <div style="text-align: center; margin: 24px 0; padding: 20px; background: #0a0a0a; border-radius: 16px; border: 2px solid rgba(255,215,0,0.3);">
            <p style="color: #FFD700; font-size: 16px; font-weight: bold; margin: 0 0 15px 0;">
                📱 QR Kód pro Import do Mobilní Peněženky
            </p>
            <img src="' . htmlspecialchars($qrUrl) . '" 
                 alt="ZION Wallet QR Code" 
                 style="width: 280px; max-width: 100%; height: auto; border-radius: 12px; border: 3px solid #FFD700; background: #fff;" />
            <p style="color: #00ff7f; font-size: 13px; margin: 15px 0 5px 0;">
                ✅ Naskenujte v ZION Mobile Wallet aplikaci
            </p>
            <p style="color: #888; font-size: 11px; margin: 0;">
                QR kód obsahuje váš 12-slovní seed phrase pro obnovení peněženky
            </p>
        </div>';
    } else {
        $qrSection = '';
    }
    
    $replacements['{{QR_CODE_SECTION}}'] = $qrSection;
    
    // Nahraď všechny placeholders
    foreach ($replacements as $placeholder => $value) {
        $template = str_replace($placeholder, $value, $template);
    }
    
    return $template;
}

/**
 * Načte a vyplní Rasta email šablonu pro eshop
 * 
 * @param array $data Asociativní pole s daty
 * @return string HTML email
 */
function renderEshopEmailRasta($data) {
    $templatePath = __DIR__ . '/../email-templates/eshop-order-confirmation-rasta.html';
    
    if (!file_exists($templatePath)) {
        throw new Exception('Eshop email template not found: ' . $templatePath);
    }
    
    $template = file_get_contents($templatePath);
    
    // Základní placeholders
    $replacements = [
        '{{ORDER_ID}}' => $data['orderId'] ?? 'N/A',
        '{{AMOUNT}}' => number_format($data['amount'] ?? 0, 2, ',', ' '),
        '{{CURRENCY}}' => $data['currency'] ?? 'CZK',
        '{{ZION_AMOUNT}}' => number_format($data['zionAmount'] ?? 0, 2, '.', ' '),
        '{{ZION_ADDRESS}}' => $data['zionAddress'] ?? 'N/A',
        '{{ZION_MNEMONIC}}' => $data['zionMnemonic'] ?? 'N/A',
        '{{TIMESTAMP}}' => $data['timestamp'] ?? date('d.m.Y H:i:s'),
        '{{CUSTOMER_NAME}}' => $data['name'] ?? 'Vážený zákazníku',
        '{{PRODUCTS}}' => $data['products'] ?? '',
        '{{SHIPPING}}' => $data['shipping'] ?? 'Bude upřesněno'
    ];
    
    // QR Code - zkusíme najít existující nebo vygenerovat nový
    $walletId = $data['walletId'] ?? $data['wallet_id'] ?? '';
    $qrUrl = getWalletQRUrl($walletId, $data['orderId'] ?? '');
    
    // Pokud QR neexistuje a máme mnemonic, vygeneruj ho
    if (!$qrUrl && !empty($data['zionMnemonic']) && $data['zionMnemonic'] !== 'N/A') {
        $walletNetwork = $data['network'] ?? $data['zionNetwork'] ?? 'mainnet';
        $walletData = [
            'wallet_id' => $walletId ?: ('zw_' . substr(md5($data['orderId'] ?? uniqid()), 0, 12)),
            'address' => $data['zionAddress'] ?? '',
            'mnemonic' => $data['zionMnemonic'] ?? '',
            'tokens' => (int)($data['zionAmount'] ?? 0),
            'order_id' => $data['orderId'] ?? '',
            'network' => $walletNetwork
        ];
        $qrUrl = generateWalletQRIfNeeded($walletData);
    }
    
    // Fallback na předané qrCodeUrl
    if (!$qrUrl && !empty($data['qrCodeUrl'])) {
        $qrUrl = $data['qrCodeUrl'];
    }
    
    if ($qrUrl) {
        $qrSection = '
        <div style="text-align: center; margin: 24px 0; padding: 20px; background: #0a0a0a; border-radius: 16px; border: 2px solid rgba(255,215,0,0.3);">
            <p style="color: #FFD700; font-size: 16px; font-weight: bold; margin: 0 0 15px 0;">
                📱 QR Kód pro Import do Mobilní Peněženky
            </p>
            <img src="' . htmlspecialchars($qrUrl) . '" 
                 alt="ZION Wallet QR Code" 
                 style="width: 280px; max-width: 100%; height: auto; border-radius: 12px; border: 3px solid #FFD700; background: #fff;" />
            <p style="color: #00ff7f; font-size: 13px; margin: 15px 0 5px 0;">
                ✅ Naskenujte v ZION Mobile Wallet aplikaci
            </p>
            <p style="color: #888; font-size: 11px; margin: 0;">
                QR kód obsahuje váš 12-slovní seed phrase pro obnovení peněženky
            </p>
        </div>';
    } else {
        $qrSection = '';
    }
    
    $replacements['{{QR_CODE_SECTION}}'] = $qrSection;
    
    // Nahraď všechny placeholders
    foreach ($replacements as $placeholder => $value) {
        $template = str_replace($placeholder, $value, $template);
    }
    
    return $template;
}

/**
 * Odešle presale potvrzovací email s Rasta šablonou
 * 
 * @param string $to Email příjemce
 * @param array $data Data pro šablonu
 * @param array $options SMTP options
 * @return bool Success
 */
function sendPresaleConfirmationRasta($to, $data, $options = []) {
    require_once __DIR__ . '/smtp-mailer.php';
    
    $htmlBody = renderPresaleEmailRasta($data);
    
    $subject = $options['subject'] ?? "🌿 ZION Presale - Potvrzení objednávky #{$data['orderId']}";
    
    $smtpOptions = array_merge([
        'from' => 'admin@newearth.cz',
        'fromName' => 'ZION Terra Nova Presale',
        'replyTo' => 'admin@newearth.cz',
        'isHTML' => true
    ], $options);
    
    return sendEmailViaSMTP($to, $subject, $htmlBody, $smtpOptions);
}

/**
 * Odešle eshop potvrzovací email s Rasta šablonou
 * 
 * @param string $to Email příjemce
 * @param array $data Data pro šablonu
 * @param array $options SMTP options
 * @return bool Success
 */
function sendEshopConfirmationRasta($to, $data, $options = []) {
    require_once __DIR__ . '/smtp-mailer.php';
    
    $htmlBody = renderEshopEmailRasta($data);
    
    $subject = $options['subject'] ?? "🌿 ZION eShop - Potvrzení objednávky #{$data['orderId']}";
    
    $smtpOptions = array_merge([
        'from' => 'shop@newearth.cz',
        'fromName' => 'ZION Terra Nova eShop',
        'replyTo' => 'shop@newearth.cz',
        'isHTML' => true
    ], $options);
    
    return sendEmailViaSMTP($to, $subject, $htmlBody, $smtpOptions);
}
