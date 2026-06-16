<?php
/**
 * ZION eShop - Environment Configuration Loader
 * Načítá .env soubor a nastavuje konstanty
 */

if (!function_exists('loadEnv')) {
    function loadEnv($envFile = __DIR__ . '/.env') {
        if (!file_exists($envFile)) {
            return false;
        }

        $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        foreach ($lines as $line) {
            // Přeskočit komentáře
            if (strpos(trim($line), '#') === 0) {
                continue;
            }

            // Parsovat KEY=VALUE
            if (strpos($line, '=') !== false) {
                list($key, $value) = explode('=', $line, 2);
                $key = trim($key);
                $value = trim($value);

                // Ulož do env vždy (i když je prázdná)
                $_ENV[$key] = $value;

                // Konstantu definuj jen pokud má smysluplnou hodnotu.
                // Díky tomu může následný config.php doplnit chybějící klíče.
                if ($value !== '' && !defined($key)) {
                    define($key, $value);
                }
            }
        }
        return true;
    }
}

// Automaticky načíst .env
loadEnv();

// Výchozí hodnoty, pokud .env neexistuje
if (!defined('ADMIN_PASSWORD')) define('ADMIN_PASSWORD', 'ZION_eShop_Admin_2025');
if (!defined('ADMIN_EMAIL')) define('ADMIN_EMAIL', 'admin@newearth.cz');
if (!defined('SHOP_NAME')) define('SHOP_NAME', 'ZION Terra Nova');
if (!defined('SHOP_EMAIL')) define('SHOP_EMAIL', 'eshop@newearth.cz');
if (!defined('DEBUG')) define('DEBUG', false);

// Generovat admin token
$adminToken = 'admin_' . substr(md5(ADMIN_PASSWORD), 0, 16);
