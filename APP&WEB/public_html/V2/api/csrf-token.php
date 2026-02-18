<?php
/**
 * ZION Presale API - Get CSRF Token
 * Returns a CSRF token for client-side protection
 *
 * GET /api/presale/csrf-token.php
 * Response: { "success": true, "csrf_token": "...", "csrf_expires": "..." }
 */

define('PRESALE_API', true);
require_once __DIR__ . '/config.php';

handleCors();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    sendJson(['success' => false, 'error' => 'Method not allowed'], 405);
}

// Return CSRF token
sendJson([
    'success' => true,
    'data' => getCsrfTokenForClient()
]);
?>