<?php
/**
 * Trivi API Connector
 * ====================
 * REST API klient pro komunikaci s účetním systémem Trivi
 * 
 * Dokumentace: https://developers.trivi.com/v2/api
 * 
 * Features:
 * - OAuth2 autentizace pomocí APP ID/SECRET
 * - Automatic retry s exponenciálním backoff
 * - Error logging do file + databáze
 * - Rate limiting protection
 * 
 * @author ZION Team
 * @created 2026-01-06
 */

require_once __DIR__ . '/trivi-config.php';

class TriviApiConnector
{
    private string $apiUrl;
    private ?string $accessToken = null;
    private int $tokenExpiry = 0;
    private string $logFile;
    
    // Retry settings
    private const MAX_RETRIES = 3;
    private const RETRY_DELAY_MS = [1000, 3000, 10000]; // 1s, 3s, 10s
    
    public function __construct()
    {
        $this->apiUrl = TriviConfig::getApiUrl();
        $this->logFile = __DIR__ . '/../logs/trivi-api.log';
        
        // Ensure log directory exists
        $logDir = dirname($this->logFile);
        if (!is_dir($logDir)) {
            mkdir($logDir, 0755, true);
        }
    }
    
    /**
     * Authenticate and get access token
     * 
     * @return bool Success status
     */
    public function authenticate(): bool
    {
        try {
            $appId = TriviConfig::getAppId();
            $appSecret = TriviConfig::getAppSecret();
            
            if (empty($appId) || empty($appSecret)) {
                $this->log('ERROR', 'Missing APP ID or APP SECRET');
                return false;
            }
            
            // Check if token is still valid
            if ($this->accessToken && time() < $this->tokenExpiry) {
                return true;
            }
            
            $this->log('INFO', 'Authenticating with Trivi API');
            
            // OAuth2 token request (adjust endpoint based on actual Trivi docs)
            $response = $this->request('POST', '/auth/token', [
                'grant_type' => 'client_credentials',
                'client_id' => $appId,
                'client_secret' => $appSecret
            ], false); // false = no auth header
            
            if (isset($response['access_token'])) {
                $this->accessToken = $response['access_token'];
                $this->tokenExpiry = time() + ($response['expires_in'] ?? 3600) - 60; // -60s buffer
                
                $this->log('INFO', 'Authentication successful', [
                    'expires_in' => $response['expires_in'] ?? 'unknown'
                ]);
                
                return true;
            }
            
            $this->log('ERROR', 'Authentication failed', $response);
            return false;
            
        } catch (Exception $e) {
            $this->log('ERROR', 'Authentication exception: ' . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Send invoice to Trivi
     * 
     * @param array $invoiceData Invoice data in Trivi format
     * @return array Response with success status and Trivi document ID
     */
    public function sendInvoice(array $invoiceData): array
    {
        try {
            if (!$this->authenticate()) {
                return ['success' => false, 'error' => 'Authentication failed'];
            }
            
            $this->log('INFO', 'Sending invoice to Trivi', [
                'invoice_number' => $invoiceData['invoice_number'] ?? 'unknown',
                'total' => $invoiceData['total'] ?? 0
            ]);
            
            $response = $this->requestWithRetry('POST', '/invoices', $invoiceData);
            
            if (isset($response['id'])) {
                $this->log('INFO', 'Invoice sent successfully', [
                    'trivi_id' => $response['id'],
                    'invoice_number' => $invoiceData['invoice_number'] ?? 'unknown'
                ]);
                
                return [
                    'success' => true,
                    'trivi_id' => $response['id'],
                    'response' => $response
                ];
            }
            
            $this->log('ERROR', 'Invoice send failed', $response);
            return [
                'success' => false,
                'error' => $response['message'] ?? 'Unknown error',
                'response' => $response
            ];
            
        } catch (Exception $e) {
            $this->log('ERROR', 'Invoice send exception: ' . $e->getMessage());
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }
    
    /**
     * Send advance payment (záloha) to Trivi
     * 
     * @param array $advanceData Advance payment data
     * @return array Response
     */
    public function sendAdvancePayment(array $advanceData): array
    {
        try {
            if (!$this->authenticate()) {
                return ['success' => false, 'error' => 'Authentication failed'];
            }
            
            $this->log('INFO', 'Sending advance payment to Trivi', [
                'advance_number' => $advanceData['advance_number'] ?? 'unknown'
            ]);
            
            $response = $this->requestWithRetry('POST', '/advances', $advanceData);
            
            if (isset($response['id'])) {
                return [
                    'success' => true,
                    'trivi_id' => $response['id'],
                    'response' => $response
                ];
            }
            
            return [
                'success' => false,
                'error' => $response['message'] ?? 'Unknown error',
                'response' => $response
            ];
            
        } catch (Exception $e) {
            $this->log('ERROR', 'Advance payment exception: ' . $e->getMessage());
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }
    
    /**
     * Send tax document for advance payment (Daňový doklad k přijaté záloze - DDPZ)
     * 
     * @param array $taxDocData Tax document data
     * @return array Response
     */
    public function sendTaxDocument(array $taxDocData): array
    {
        try {
            if (!$this->authenticate()) {
                return ['success' => false, 'error' => 'Authentication failed'];
            }
            
            $this->log('INFO', 'Sending tax document to Trivi', [
                'doc_number' => $taxDocData['doc_number'] ?? 'unknown'
            ]);
            
            $response = $this->requestWithRetry('POST', '/tax-documents', $taxDocData);
            
            if (isset($response['id'])) {
                return [
                    'success' => true,
                    'trivi_id' => $response['id'],
                    'response' => $response
                ];
            }
            
            return [
                'success' => false,
                'error' => $response['message'] ?? 'Unknown error',
                'response' => $response
            ];
            
        } catch (Exception $e) {
            $this->log('ERROR', 'Tax document exception: ' . $e->getMessage());
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }
    
    /**
     * Make HTTP request with retry logic
     * 
     * @param string $method HTTP method
     * @param string $endpoint API endpoint
     * @param array $data Request data
     * @return array Response data
     */
    private function requestWithRetry(string $method, string $endpoint, array $data): array
    {
        $lastError = null;
        
        for ($attempt = 0; $attempt < self::MAX_RETRIES; $attempt++) {
            try {
                $response = $this->request($method, $endpoint, $data);
                
                // Success - return immediately
                if (!isset($response['error'])) {
                    return $response;
                }
                
                // Retryable error?
                if ($this->isRetryableError($response)) {
                    $lastError = $response;
                    $delay = self::RETRY_DELAY_MS[$attempt] ?? 10000;
                    
                    $this->log('WARN', "Request failed (attempt {$attempt}), retrying in {$delay}ms", [
                        'endpoint' => $endpoint,
                        'error' => $response['error'] ?? 'unknown'
                    ]);
                    
                    usleep($delay * 1000); // Convert ms to microseconds
                    continue;
                }
                
                // Non-retryable error - return immediately
                return $response;
                
            } catch (Exception $e) {
                $lastError = ['error' => $e->getMessage()];
                
                if ($attempt < self::MAX_RETRIES - 1) {
                    $delay = self::RETRY_DELAY_MS[$attempt] ?? 10000;
                    $this->log('WARN', "Request exception (attempt {$attempt}), retrying in {$delay}ms", [
                        'endpoint' => $endpoint,
                        'error' => $e->getMessage()
                    ]);
                    usleep($delay * 1000);
                }
            }
        }
        
        // All retries failed
        $this->log('ERROR', 'All retry attempts failed', [
            'endpoint' => $endpoint,
            'last_error' => $lastError
        ]);
        
        return $lastError ?? ['error' => 'All retries failed'];
    }
    
    /**
     * Make HTTP request to Trivi API
     * 
     * @param string $method HTTP method (GET, POST, PUT, DELETE)
     * @param string $endpoint API endpoint (e.g. /invoices)
     * @param array $data Request data
     * @param bool $useAuth Include Authorization header
     * @return array Response data
     */
    private function request(string $method, string $endpoint, array $data = [], bool $useAuth = true): array
    {
        $url = $this->apiUrl . $endpoint;
        
        $headers = [
            'Content-Type: application/json',
            'Accept: application/json'
        ];
        
        if ($useAuth && $this->accessToken) {
            $headers[] = 'Authorization: Bearer ' . $this->accessToken;
        }
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);
        
        if ($method === 'POST') {
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        } elseif ($method === 'PUT') {
            curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PUT');
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        } elseif ($method === 'DELETE') {
            curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'DELETE');
        }
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);
        
        if ($error) {
            return ['error' => 'cURL error: ' . $error, 'http_code' => $httpCode];
        }
        
        $decoded = json_decode($response, true);
        
        if ($httpCode >= 400) {
            return [
                'error' => $decoded['message'] ?? 'HTTP error',
                'http_code' => $httpCode,
                'response' => $decoded
            ];
        }
        
        return $decoded ?? ['error' => 'Invalid JSON response'];
    }
    
    /**
     * Check if error is retryable (5xx, timeouts, network errors)
     */
    private function isRetryableError(array $response): bool
    {
        $httpCode = $response['http_code'] ?? 0;
        
        // Retry 5xx errors (server errors)
        if ($httpCode >= 500 && $httpCode < 600) {
            return true;
        }
        
        // Retry 429 (rate limit)
        if ($httpCode === 429) {
            return true;
        }
        
        // Retry network errors
        $errorMsg = strtolower($response['error'] ?? '');
        if (strpos($errorMsg, 'timeout') !== false || strpos($errorMsg, 'network') !== false) {
            return true;
        }
        
        return false;
    }
    
    /**
     * Log message to file
     * 
     * @param string $level Log level (INFO, WARN, ERROR)
     * @param string $message Log message
     * @param array $context Additional context
     */
    private function log(string $level, string $message, array $context = []): void
    {
        $timestamp = date('Y-m-d H:i:s');
        $contextJson = !empty($context) ? ' ' . json_encode($context, JSON_UNESCAPED_UNICODE) : '';
        
        $logLine = "[{$timestamp}] [{$level}] {$message}{$contextJson}\n";
        
        file_put_contents($this->logFile, $logLine, FILE_APPEND | LOCK_EX);
        
        // Also log errors to PHP error log
        if ($level === 'ERROR') {
            error_log("Trivi API Error: {$message}{$contextJson}");
        }
    }
}
