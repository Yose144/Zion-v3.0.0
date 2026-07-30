<?php
/**
 * Trivi API Configuration
 * ========================
 * Konfigurace pro propojení s účetním systémem Trivi
 * 
 * Dokumentace: https://developers.trivi.com/v2
 * 
 * Požadavky:
 * - APP ID a APP SECRET (získat od Trivi)
 * - Testovací i produkční credentials
 * - finAccount kategorie (seznam účetních kategorií)
 * 
 * @author ZION Team
 * @created 2026-01-06
 */

// Načtení .env souboru
require_once __DIR__ . '/env-loader.php';

class TriviConfig
{
    // API Endpoints
    public const API_BASE_URL_PRODUCTION = 'https://api.trivi.com/v2';
    public const API_BASE_URL_TEST = 'https://api-test.trivi.com/v2'; // Placeholder - ověřit s Trivi
    
    // API Authentication
    private static $appId = null;
    private static $appSecret = null;
    private static $isTestMode = true; // Default: testovací režim
    
    // finAccount Categories (získat od Trivi)
    private static $finAccountCategories = array(
        'eshop_sales' => null,      // ID kategorie pro prodej z e-shopu
        'shipping' => null,          // ID kategorie pro dopravné
        'payment_fee' => null,       // ID kategorie pro platební poplatky
        'zion_tokens' => null,       // ID kategorie pro ZION token bonusy
    );
    
    // Document Number Series (oddělené řady pro e-shop a presale)
    public const INVOICE_PREFIX_ESHOP = 'ZION-ESHOP';      // E-shop faktury: ZION-ESHOP-2026/0001
    public const INVOICE_PREFIX_PRESALE = 'ZION-PRESALE';  // Presale faktury: ZION-PRESALE-2026/0001
    public const ADVANCE_PREFIX = 'ZA';                     // Prefix záloh: ZA-2026/0001
    public const TAX_DOC_PREFIX = 'DDPZ';                   // Prefix daň. dokladů k zálohám: DDPZ-2026/0001
    public const CREDIT_NOTE_PREFIX = 'ZION-CN';            // Prefix dobropisů: ZION-CN-2026/0001
    
    /**
     * Inicializace konfigurace z environment variables
     */
    public static function init(): void
    {
        // Načti credentials z .env
        self::$appId = $_ENV['TRIVI_APP_ID'] ?? getenv('TRIVI_APP_ID') ?: null;
        self::$appSecret = $_ENV['TRIVI_APP_SECRET'] ?? getenv('TRIVI_APP_SECRET') ?: null;
        self::$isTestMode = ($_ENV['TRIVI_TEST_MODE'] ?? getenv('TRIVI_TEST_MODE') ?: 'true') === 'true';
        
        // Načti finAccount kategorie
        $finAccountJson = $_ENV['TRIVI_FIN_ACCOUNTS'] ?? getenv('TRIVI_FIN_ACCOUNTS') ?: '{}';
        $finAccounts = json_decode($finAccountJson, true);
        if (is_array($finAccounts)) {
            self::$finAccountCategories = array_merge(self::$finAccountCategories, $finAccounts);
        }
    }
    
    /**
     * Získej aktivní API URL (test/production)
     */
    public static function getApiUrl()
    {
        return self::$isTestMode ? self::API_BASE_URL_TEST : self::API_BASE_URL_PRODUCTION;
    }
    
    /**
     * Získej APP ID
     */
    public static function getAppId()
    {
        return self::$appId;
    }
    
    /**
     * Získej APP SECRET
     */
    public static function getAppSecret()
    {
        return self::$appSecret;
    }
    
    /**
     * Je testovací režim aktivní?
     */
    public static function isTestMode()
    {
        return self::$isTestMode;
    }
    
    /**
     * Získej finAccount kategorii podle klíče
     */
    public static function getFinAccount(string $key)
    {
        return self::$finAccountCategories[$key] ?? null;
    }
    
    /**
     * Validace konfigurace (kontrola povinných údajů)
     */
    public static function validate(): array
    {
        $errors = [];
        
        if (empty(self::$appId)) {
            $errors[] = 'TRIVI_APP_ID není nakonfigurován v .env';
        }
        
        if (empty(self::$appSecret)) {
            $errors[] = 'TRIVI_APP_SECRET není nakonfigurován v .env';
        }
        
        // Kontrola finAccount kategorií (varování, ne chyba)
        $missingCategories = [];
        foreach (self::$finAccountCategories as $key => $value) {
            if (empty($value)) {
                $missingCategories[] = $key;
            }
        }
        
        if (!empty($missingCategories)) {
            $errors[] = 'Chybějící finAccount kategorie: ' . implode(', ', $missingCategories);
        }
        
        return $errors;
    }
    
    /**
     * Generuj invoice number (souvislá číselná řada)
     * Formát: ZION-ESHOP-2026/0001 nebo ZION-PRESALE-2026/0001
     * 
     * @param int $sequenceNumber Pořadové číslo
     * @param bool $isPresale Je to presale objednávka?
     */
    public static function generateInvoiceNumber(int $sequenceNumber, bool $isPresale = false): string
    {
        $year = date('Y');
        $number = str_pad($sequenceNumber, 4, '0', STR_PAD_LEFT);
        $prefix = $isPresale ? self::INVOICE_PREFIX_PRESALE : self::INVOICE_PREFIX_ESHOP;
        return "{$prefix}-{$year}/{$number}";
    }
    
    /**
     * Generuj advance payment number (záloha)
     * Formát: ZA-2026/0001
     */
    public static function generateAdvanceNumber(int $sequenceNumber): string
    {
        $year = date('Y');
        $number = str_pad($sequenceNumber, 4, '0', STR_PAD_LEFT);
        return self::ADVANCE_PREFIX . "-{$year}/{$number}";
    }
    
    /**
     * Extrahuj variabilní symbol z order ID
     * Požadavek Trivi: VS musí být unikátní napříč všemi e-shopy
     * 
     * Formát order ID: ORD-{timestamp}-{random} nebo PRESALE-{timestamp}-{random}
     * Timestamp je 10-digit UNIX timestamp = IDEÁLNÍ variabilní symbol!
     * Příklad: ORD-1736122900-abc123 → VS: 1736122900
     * 
     * @param string $orderId Order ID (ORD-1736122900-abc123)
     * @return string Variabilní symbol (1736122900)
     */
    public static function extractVariableSymbol(string $orderId): string
    {
        // Extract 10-digit timestamp from order ID
        // Format: ORD-1736122900-abc123 or PRESALE-1736122900-xyz
        if (preg_match('/-(\d{10})-/', $orderId, $matches)) {
            return $matches[1]; // Return timestamp as VS
        }
        
        // Fallback: pokud formát neodpovídá, zkus najít jakékoliv 10-digit číslo
        if (preg_match('/(\d{10})/', $orderId, $matches)) {
            return $matches[1];
        }
        
        // Last resort: remove prefixes and use whole ID
        return str_replace(['ORD-', 'PRESALE-', 'ESHOP-'], '', $orderId);
    }
}

// Auto-inicializace při načtení souboru
TriviConfig::init();
