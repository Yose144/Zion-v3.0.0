<?php
/**
 * URL helper utilities shared across eShop + API stack
 */

require_once __DIR__ . '/env-loader.php';

if (!function_exists('zion_get_site_url')) {
    function zion_get_site_url(): string
    {
        $candidates = [
            defined('SITE_URL') ? SITE_URL : null,
            defined('SHOP_BASE_URL') ? SHOP_BASE_URL : null,
            getenv('SITE_URL') ?: null,
            getenv('SHOP_BASE_URL') ?: null,
            $_ENV['SITE_URL'] ?? null,
            $_ENV['SHOP_BASE_URL'] ?? null,
        ];

        foreach ($candidates as $candidate) {
            if (!empty($candidate)) {
                return rtrim($candidate, '/');
            }
        }

        $isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
            || (isset($_SERVER['SERVER_PORT']) && $_SERVER['SERVER_PORT'] === '443');
        $scheme = $isHttps ? 'https://' : 'http://';
        $host = $_SERVER['HTTP_HOST'] ?? 'newearth.cz';

        return $scheme . $host;
    }
}

if (!function_exists('zion_wallet_public_url')) {
    function zion_wallet_public_url(?string $filename = null): string
    {
        $base = zion_get_site_url() . '/V2/wallets';
        if ($filename) {
            return $base . '/' . ltrim($filename, '/');
        }

        return $base;
    }
}
