# ZION Security Hardening Tasks

**Version:** 2.9.0  
**Priority:** High  
**Target:** Production deployment  
**Date:** 3. prosince 2025

---

## 🔒 Security Tasks Overview

### Critical (Must complete before production)
- [ ] Change default admin credentials
- [ ] Add CSRF token protection
- [ ] Verify Stripe webhook signature
- [ ] Enable HTTPS enforcement
- [ ] Secure encryption key storage

### High Priority (Complete within first week)
- [ ] Implement rate limiting
- [ ] Add SQL injection audit
- [ ] XSS sanitization review
- [ ] Security headers configuration
- [ ] Error handling hardening

### Medium Priority (Complete within first month)
- [ ] Penetration testing
- [ ] Code security audit
- [ ] Dependency vulnerability scan
- [ ] Access logging enhancement
- [ ] Incident response plan

---

## 1. Change Default Admin Credentials

**Current Issue:**
- Default login: `admin` / `zion2025` in `api/presale/admin/index.php`
- Hardcoded credentials visible in source code

**Solution:**

### Step 1: Generate Strong Password
```bash
# Generate random password
python3 -c "import secrets; print(secrets.token_urlsafe(16))"
# Example output: kJ8_mN3pQ2zR5tY9vW4xA6bC
```

### Step 2: Hash Password
```php
<?php
// hash_password.php
$password = 'YOUR_NEW_STRONG_PASSWORD';
$hash = password_hash($password, PASSWORD_BCRYPT);
echo "Hashed: $hash\n";
?>
```

Run: `php hash_password.php`

### Step 3: Update Admin File

**File:** `api/presale/admin/index.php`

**Replace:**
```php
// Current (lines ~20-30)
if ($_SERVER['PHP_AUTH_USER'] === 'admin' && $_SERVER['PHP_AUTH_PW'] === 'zion2025') {
    // Authenticated
}
```

**With:**
```php
// Store hashed password in config or .env
$admin_username = getenv('ADMIN_USERNAME') ?: 'admin';
$admin_password_hash = getenv('ADMIN_PASSWORD_HASH') ?: '$2y$10$...'; // From hash_password.php

if ($_SERVER['PHP_AUTH_USER'] === $admin_username && 
    password_verify($_SERVER['PHP_AUTH_PW'], $admin_password_hash)) {
    // Authenticated
}
```

### Step 4: Add to .env

**File:** `api/presale/.env`
```bash
# Admin credentials (never commit to git!)
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=$2y$10$kJ8_mN3pQ2zR5tY9vW4xA6bC...
```

**Status:** ⏳ Pending  
**Assigned:** Backend team  
**ETA:** 30 minutes

---

## 2. Add CSRF Token Protection

**Current Issue:**
- Forms lack CSRF protection
- Vulnerable to cross-site request forgery attacks

**Solution:**

### Step 1: Create CSRF Helper

**File:** `api/presale/csrf.php` (new)
```php
<?php
define('PRESALE_API', true);

/**
 * Generate CSRF token
 */
function generate_csrf_token() {
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    
    if (!isset($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    
    return $_SESSION['csrf_token'];
}

/**
 * Verify CSRF token
 */
function verify_csrf_token($token) {
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    
    if (!isset($_SESSION['csrf_token'])) {
        return false;
    }
    
    return hash_equals($_SESSION['csrf_token'], $token);
}

/**
 * CSRF token HTML input
 */
function csrf_field() {
    $token = generate_csrf_token();
    return '<input type="hidden" name="csrf_token" value="' . htmlspecialchars($token) . '">';
}
?>
```

### Step 2: Add to Forms

**File:** `public_html/V2/presale.html` (example)
```html
<form id="presale-form">
    <!-- Add CSRF token -->
    <?php include '../api/presale/csrf.php'; echo csrf_field(); ?>
    
    <input type="email" name="email" required>
    <input type="number" name="amount" required>
    <button type="submit">Submit</button>
</form>
```

### Step 3: Verify in Backend

**File:** `api/presale/create-order.php`
```php
<?php
define('PRESALE_API', true);
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/csrf.php';

// Verify CSRF token
$csrf_token = $_POST['csrf_token'] ?? '';
if (!verify_csrf_token($csrf_token)) {
    sendJson(['success' => false, 'error' => 'Invalid CSRF token'], 403);
}

// Continue with order creation...
?>
```

### Step 4: JavaScript Integration

**File:** `public_html/V2/presale.js`
```javascript
// Get CSRF token from meta tag or cookie
function getCsrfToken() {
    return document.querySelector('meta[name="csrf-token"]')?.content || '';
}

// Include in fetch requests
fetch('/api/presale/create-order.php', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': getCsrfToken()
    },
    body: JSON.stringify({ /* data */ })
});
```

**Status:** ⏳ Pending  
**Assigned:** Backend team  
**ETA:** 2 hours

---

## 3. Rate Limiting Enhancement

**Current Status:**
- Basic rate limiting exists in `config.php`
- Only IP-based, file-based storage

**Improvements Needed:**

### Step 1: Redis-Based Rate Limiting (Optional)

**File:** `api/presale/rate_limiter.php` (new)
```php
<?php
class RateLimiter {
    private $redis;
    
    public function __construct() {
        if (class_exists('Redis')) {
            $this->redis = new Redis();
            $this->redis->connect('127.0.0.1', 6379);
        }
    }
    
    public function checkLimit($identifier, $maxRequests = 50, $window = 3600) {
        if (!$this->redis) {
            // Fallback to file-based
            return checkRateLimit($identifier);
        }
        
        $key = "rate_limit:$identifier";
        $current = $this->redis->incr($key);
        
        if ($current === 1) {
            $this->redis->expire($key, $window);
        }
        
        return $current <= $maxRequests;
    }
}
?>
```

### Step 2: Stricter Limits for Sensitive Endpoints

**File:** `api/presale/create-order.php`
```php
// Stricter rate limit for order creation
$ip = getClientIp();
$email = $_POST['email'] ?? '';

// 10 orders per hour per IP
if (!checkRateLimit("order:$ip", 10, 3600)) {
    sendJson(['error' => 'Too many orders. Try again later.'], 429);
}

// 5 orders per hour per email
if (!checkRateLimit("order:$email", 5, 3600)) {
    sendJson(['error' => 'Too many orders from this email.'], 429);
}
```

### Step 3: Add Rate Limit Headers

```php
function sendRateLimitHeaders($current, $max, $window) {
    header("X-RateLimit-Limit: $max");
    header("X-RateLimit-Remaining: " . max(0, $max - $current));
    header("X-RateLimit-Reset: " . (time() + $window));
}
```

**Status:** ⏳ Pending  
**Assigned:** Backend team  
**ETA:** 3 hours

---

## 4. SQL Injection Audit

**Current Status:**
- Using PDO prepared statements ✅
- No raw SQL queries found ✅

**Verification Checklist:**

### Audit Commands
```bash
# Search for unsafe SQL patterns
cd api/presale
grep -r "mysqli_query" *.php
grep -r '\$_GET\[' *.php | grep -i "select\|insert\|update\|delete"
grep -r '\$_POST\[' *.php | grep -i "select\|insert\|update\|delete"

# Expected: No results (all using PDO)
```

### Manual Review Files
- [x] `create-order.php` - Uses PDO prepared statements ✅
- [x] `wallet-lookup.php` - Uses PDO ✅
- [x] `presale-stats.php` - Uses PDO ✅
- [x] `stripe-webhook.php` - Uses PDO ✅
- [x] `admin/index.php` - Uses PDO ✅

### Additional Protection

**File:** `api/presale/config.php`
```php
// Add to PDO options
$options = [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES => false, // True prepared statements
    PDO::MYSQL_ATTR_MULTI_STATEMENTS => false // Prevent stacked queries
];
```

**Status:** ✅ Completed (verified)  
**Notes:** All queries use PDO prepared statements

---

## 5. XSS Sanitization

**Current Status:**
- Basic `htmlspecialchars()` used
- Need comprehensive sanitization

**Solution:**

### Step 1: Create Sanitizer Helper

**File:** `api/presale/sanitizer.php` (new)
```php
<?php
/**
 * Comprehensive XSS sanitization
 */
class Sanitizer {
    
    /**
     * Sanitize string for HTML output
     */
    public static function html($input) {
        return htmlspecialchars($input, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    }
    
    /**
     * Sanitize for JSON output
     */
    public static function json($input) {
        return json_encode($input, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT);
    }
    
    /**
     * Sanitize email
     */
    public static function email($input) {
        return filter_var($input, FILTER_SANITIZE_EMAIL);
    }
    
    /**
     * Sanitize URL
     */
    public static function url($input) {
        return filter_var($input, FILTER_SANITIZE_URL);
    }
    
    /**
     * Remove all HTML tags
     */
    public static function stripTags($input) {
        return strip_tags($input);
    }
}
?>
```

### Step 2: Apply to All User Inputs

**Example:** `api/presale/wallet-lookup.php`
```php
require_once __DIR__ . '/sanitizer.php';

$searchTerm = Sanitizer::stripTags($_GET['search'] ?? '');
$searchTerm = Sanitizer::html($searchTerm);

// Use in query...
```

### Step 3: Content Security Policy

**File:** `.htaccess` or PHP headers
```php
// Add CSP header
header("Content-Security-Policy: default-src 'self'; script-src 'self' https://js.stripe.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://api.stripe.com;");
```

**Status:** ⏳ Pending  
**Assigned:** Backend team  
**ETA:** 2 hours

---

## 6. Security Headers Configuration

**File:** `public_html/V2/.htaccess` (or PHP)

```apache
# Security headers
<IfModule mod_headers.c>
    # Prevent clickjacking
    Header always set X-Frame-Options "SAMEORIGIN"
    
    # XSS protection
    Header always set X-XSS-Protection "1; mode=block"
    
    # Prevent MIME sniffing
    Header always set X-Content-Type-Options "nosniff"
    
    # Referrer policy
    Header always set Referrer-Policy "strict-origin-when-cross-origin"
    
    # HTTPS enforcement
    Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains"
    
    # Permissions policy
    Header always set Permissions-Policy "geolocation=(), microphone=(), camera=()"
</IfModule>
```

**Or in PHP:**
```php
// api/presale/config.php
function setSecurityHeaders() {
    header('X-Frame-Options: SAMEORIGIN');
    header('X-XSS-Protection: 1; mode=block');
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: strict-origin-when-cross-origin');
    
    if (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') {
        header('Strict-Transport-Security: max-age=31536000; includeSubDomains');
    }
}

// Call in every endpoint
setSecurityHeaders();
```

**Status:** ⏳ Pending  
**ETA:** 30 minutes

---

## 7. File Upload Security (Future)

**If implementing file uploads later:**

### Validation Rules
```php
function validateUpload($file) {
    // Check file size (max 5MB)
    if ($file['size'] > 5 * 1024 * 1024) {
        return ['error' => 'File too large'];
    }
    
    // Allowed MIME types
    $allowed = ['image/jpeg', 'image/png', 'image/gif'];
    if (!in_array($file['type'], $allowed)) {
        return ['error' => 'Invalid file type'];
    }
    
    // Verify with finfo
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mimeType = finfo_file($finfo, $file['tmp_name']);
    finfo_close($finfo);
    
    if (!in_array($mimeType, $allowed)) {
        return ['error' => 'File content does not match extension'];
    }
    
    // Rename to random filename
    $ext = pathinfo($file['name'], PATHINFO_EXTENSION);
    $newName = bin2hex(random_bytes(16)) . '.' . $ext;
    
    return ['success' => true, 'filename' => $newName];
}
```

**Status:** ⏳ Future (not currently needed)

---

## 8. Error Handling Hardening

**Current Issue:**
- Detailed errors may leak sensitive info

**Solution:**

### Step 1: Production Error Handler

**File:** `api/presale/config.php`
```php
// Production error handler
set_error_handler(function($errno, $errstr, $errfile, $errline) {
    // Log to file
    error_log("[$errno] $errstr in $errfile:$errline");
    
    // Don't expose details to user
    if (ini_get('display_errors')) {
        return false; // Show error in dev
    }
    
    // Generic error in production
    sendJson(['success' => false, 'error' => 'Internal server error'], 500);
});

// Catch fatal errors
register_shutdown_function(function() {
    $error = error_get_last();
    if ($error && in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR])) {
        error_log("FATAL: {$error['message']} in {$error['file']}:{$error['line']}");
        if (!ini_get('display_errors')) {
            sendJson(['success' => false, 'error' => 'Server error'], 500);
        }
    }
});
```

### Step 2: Stripe Error Handling

**File:** `api/presale/stripe-webhook.php`
```php
try {
    // Stripe verification
    $event = \Stripe\Webhook::constructEvent($payload, $sig_header, STRIPE_WEBHOOK_SECRET);
} catch (\Stripe\Exception\SignatureVerificationException $e) {
    // Log but don't expose details
    error_log('Stripe signature verification failed: ' . $e->getMessage());
    http_response_code(400);
    exit;
} catch (\Exception $e) {
    // Generic error
    error_log('Stripe webhook error: ' . $e->getMessage());
    http_response_code(500);
    exit;
}
```

**Status:** ⏳ Pending  
**ETA:** 1 hour

---

## 9. Dependency Vulnerability Scan

### PHP Dependencies

```bash
# Check Composer dependencies
composer audit

# Update to latest versions
composer update --with-all-dependencies

# Check specific packages
composer show stripe/stripe-php
composer show phpmailer/phpmailer
```

### Python Dependencies

```bash
# Check for vulnerabilities
pip install safety
safety check --file requirements.txt

# Update packages
pip list --outdated
pip install --upgrade stripe qrcode pillow
```

**Status:** ⏳ Pending  
**Schedule:** Monthly  
**ETA:** 1 hour

---

## 10. Access Logging Enhancement

### Apache/Nginx Logs

**File:** `.htaccess`
```apache
# Custom log format
SetEnvIf Request_URI "^/api/presale/" presale_api

CustomLog ${APACHE_LOG_DIR}/presale_access.log combined env=presale_api
```

### Application Logging

**File:** `api/presale/config.php`
```php
function logActivity($action, $data = [], $level = 'INFO') {
    $logEntry = [
        'timestamp' => date('Y-m-d H:i:s'),
        'level' => $level,
        'action' => $action,
        'ip' => getClientIp(),
        'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? '',
        'request_uri' => $_SERVER['REQUEST_URI'] ?? '',
        'data' => $data
    ];
    
    $logFile = LOG_PATH . 'activity_' . date('Y-m-d') . '.log';
    file_put_contents($logFile, json_encode($logEntry) . PHP_EOL, FILE_APPEND);
    
    // Also log to syslog for critical events
    if ($level === 'ERROR' || $level === 'CRITICAL') {
        syslog(LOG_ERR, $action . ': ' . json_encode($data));
    }
}
```

**Status:** ⏳ Pending  
**ETA:** 1 hour

---

## Priority Implementation Order

### Week 1 (Before Production Launch)
1. Change admin credentials (30 min) - **CRITICAL**
2. Add CSRF protection (2 hours) - **CRITICAL**
3. Security headers (30 min) - **CRITICAL**
4. Error handling hardening (1 hour) - **HIGH**

### Week 2 (First Week in Production)
5. Rate limiting enhancement (3 hours) - **HIGH**
6. XSS sanitization review (2 hours) - **HIGH**
7. Access logging (1 hour) - **MEDIUM**

### Month 1 (Ongoing)
8. Dependency vulnerability scan (1 hour/month) - **MEDIUM**
9. Penetration testing (external) - **MEDIUM**
10. Security audit (code review) - **LOW**

---

## Testing Checklist

After implementing each security measure:

- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed
- [ ] No broken functionality
- [ ] Performance impact acceptable
- [ ] Documented in code
- [ ] Team notified

---

## Incident Response Plan

### If Security Breach Detected:

1. **Immediate Actions:**
   - [ ] Take affected systems offline
   - [ ] Notify team lead
   - [ ] Begin forensic analysis

2. **Investigation:**
   - [ ] Review access logs
   - [ ] Identify attack vector
   - [ ] Assess data exposure

3. **Remediation:**
   - [ ] Patch vulnerability
   - [ ] Reset compromised credentials
   - [ ] Restore from clean backup if needed

4. **Post-Incident:**
   - [ ] Update security measures
   - [ ] Document lessons learned
   - [ ] Notify affected users (if required)

---

**Last Updated:** 3. prosince 2025  
**Next Review:** 10. prosince 2025  
**Owner:** Backend Security Team
