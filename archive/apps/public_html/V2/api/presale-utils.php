<?php
/**
 * Utility helpers for presale server-side validation
 */

if (!function_exists('presale_is_allowed')) {
    function presale_is_allowed(string $email): bool
    {
        $email = strtolower(trim($email));
        if (defined('PRESALE_ENABLED') && PRESALE_ENABLED === true) {
            return true;
        }
        $whitelist = defined('PRESALE_WHITELIST') ? (array)PRESALE_WHITELIST : [];
        foreach ($whitelist as $w) {
            if (strtolower(trim((string)$w)) === $email) return true;
        }
        return false;
    }
}

if (!function_exists('presale_expected_tokens')) {
    function presale_expected_tokens(float $priceEur): int
    {
        $price = 0.0;
        if (defined('PRESALE_TOKEN_PRICE')) {
            $price = (float)PRESALE_TOKEN_PRICE;
        } elseif (defined('TOKEN_PRICE_EUR')) {
            $price = (float)TOKEN_PRICE_EUR;
        }
        if ($price <= 0.0) return 0;
        return (int)floor($priceEur / $price);
    }
}

if (!function_exists('presale_max_bonus_rate')) {
    function presale_max_bonus_rate(float $priceEur): float
    {
        // Must match frontend tiers in V2/presale.js (server-side canonical cap)
        if ($priceEur >= 500.0) return 0.40;
        if ($priceEur >= 100.0) return 0.20;
        if ($priceEur >= 50.0) return 0.10;
        return 0.0;
    }
}

if (!function_exists('presale_max_tokens')) {
    function presale_max_tokens(float $priceEur): int
    {
        $base = presale_expected_tokens($priceEur);
        if ($base <= 0) return 0;
        $rate = presale_max_bonus_rate($priceEur);
        return (int)floor($base * (1.0 + $rate));
    }
}
