<?php
session_start();

if (!function_exists('loadEnv')) {
    function loadEnv($path = null) {
        $path = $path ?: (__DIR__ . '/.env');
        if (!file_exists($path)) {
            return;
        }
        $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        foreach ($lines as $line) {
            if (strpos(trim($line), '#') === 0) {
                continue;
            }
            list($name, $value) = explode('=', $line, 2);
            $name = trim($name);
            $value = trim($value);
            if (!array_key_exists($name, $_SERVER) && !array_key_exists($name, $_ENV)) {
                putenv(sprintf('%s=%s', $name, $value));
                $_ENV[$name] = $value;
                $_SERVER[$name] = $value;
            }
        }
    }
}

loadEnv(__DIR__ . '/.env');

function login($password) {
    // Try hash first (secure), then fallback to plaintext comparison (legacy)
    $hash = getenv('ADMIN_PASSWORD_HASH');
    $plainPassword = getenv('ADMIN_PASSWORD');
    
    $valid = false;
    
    // Option 1: bcrypt hash verification (preferred)
    if ($hash && password_verify($password, $hash)) {
        $valid = true;
    }
    // Option 2: Plaintext comparison (legacy fallback - less secure but works)
    elseif ($plainPassword && hash_equals($plainPassword, $password)) {
        $valid = true;
    }
    
    if ($valid) {
        $_SESSION['admin_logged_in'] = true;
        $_SESSION['last_activity'] = time();
        return true;
    }
    return false;
}

function logout() {
    unset($_SESSION['admin_logged_in']);
    session_destroy();
}

function isLoggedIn() {
    if (isset($_SESSION['admin_logged_in']) && $_SESSION['admin_logged_in'] === true) {
        // Session timeout (e.g., 30 minutes)
        if (isset($_SESSION['last_activity']) && (time() - $_SESSION['last_activity'] > 1800)) {
            logout();
            return false;
        }
        $_SESSION['last_activity'] = time();
        return true;
    }
    return false;
}

function requireLogin() {
    if (!isLoggedIn()) {
        header('Location: admin-login.php');
        exit;
    }
}

function generateCsrfToken() {
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function verifyCsrfToken($token) {
    if (empty($_SESSION['csrf_token']) || empty($token)) {
        return false;
    }
    return hash_equals($_SESSION['csrf_token'], $token);
}
?>
