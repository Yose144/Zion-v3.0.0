<?php
/**
 * Simple Rate Limiter for Presale API
 * Prevents abuse by limiting requests per IP and email
 */

if (!defined('RATE_LIMIT_STORAGE_DIR')) {
    define('RATE_LIMIT_STORAGE_DIR', __DIR__ . '/../rate_limits');
}

if (!defined('RATE_LIMIT_MAX_REQUESTS_PER_HOUR')) {
    define('RATE_LIMIT_MAX_REQUESTS_PER_HOUR', 5); // 5 requests per hour per IP
}

if (!defined('RATE_LIMIT_MAX_REQUESTS_PER_EMAIL_PER_DAY')) {
    define('RATE_LIMIT_MAX_REQUESTS_PER_EMAIL_PER_DAY', 3); // 3 requests per day per email
}

if (!function_exists('rate_limit_check_ip')) {
    /**
     * Check if IP address is within rate limits
     * @param string $ip IP address
     * @return bool True if allowed, false if rate limited
     */
    function rate_limit_check_ip(string $ip): bool {
        $storageDir = RATE_LIMIT_STORAGE_DIR;
        if (!is_dir($storageDir) && !mkdir($storageDir, 0755, true)) {
            // If we can't create storage, allow request (fail open)
            return true;
        }

        $ipHash = md5($ip); // Hash IP for privacy
        $file = $storageDir . '/ip_' . $ipHash . '.json';

        $now = time();
        $hourAgo = $now - 3600;

        // Load existing data
        $data = [];
        if (file_exists($file)) {
            $content = @file_get_contents($file);
            if ($content) {
                $data = json_decode($content, true) ?: [];
            }
        }

        // Clean old entries (older than 1 hour)
        $data = array_filter($data, function($timestamp) use ($hourAgo) {
            return $timestamp > $hourAgo;
        });

        // Check limit
        if (count($data) >= RATE_LIMIT_MAX_REQUESTS_PER_HOUR) {
            return false;
        }

        // Add current request
        $data[] = $now;

        // Save updated data
        @file_put_contents($file, json_encode($data));

        return true;
    }
}

if (!function_exists('rate_limit_check_email')) {
    /**
     * Check if email address is within rate limits
     * @param string $email Email address
     * @return bool True if allowed, false if rate limited
     */
    function rate_limit_check_email(string $email): bool {
        $storageDir = RATE_LIMIT_STORAGE_DIR;
        if (!is_dir($storageDir) && !mkdir($storageDir, 0755, true)) {
            return true;
        }

        $emailHash = md5(strtolower($email)); // Hash email for privacy
        $file = $storageDir . '/email_' . $emailHash . '.json';

        $now = time();
        $dayAgo = $now - 86400; // 24 hours

        // Load existing data
        $data = [];
        if (file_exists($file)) {
            $content = @file_get_contents($file);
            if ($content) {
                $data = json_decode($content, true) ?: [];
            }
        }

        // Clean old entries (older than 24 hours)
        $data = array_filter($data, function($timestamp) use ($dayAgo) {
            return $timestamp > $dayAgo;
        });

        // Check limit
        if (count($data) >= RATE_LIMIT_MAX_REQUESTS_PER_EMAIL_PER_DAY) {
            return false;
        }

        // Add current request
        $data[] = $now;

        // Save updated data
        @file_put_contents($file, json_encode($data));

        return true;
    }
}

if (!function_exists('rate_limit_check')) {
    /**
     * Combined rate limit check for IP and email
     * @param string $ip IP address
     * @param string $email Email address
     * @return array ['allowed' => bool, 'reason' => string]
     */
    function rate_limit_check(string $ip, string $email): array {
        if (!rate_limit_check_ip($ip)) {
            return ['allowed' => false, 'reason' => 'Too many requests from this IP address'];
        }

        if (!rate_limit_check_email($email)) {
            return ['allowed' => false, 'reason' => 'Too many requests from this email address'];
        }

        return ['allowed' => true, 'reason' => ''];
    }
}