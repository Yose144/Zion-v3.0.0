<?php
/**
 * Email Mock System - logs emails instead of sending when SMTP unavailable
 */

function mockSendEmail(string $to, string $subject, string $body, array $options = []): bool {
    $logDir = __DIR__ . '/../logs';
    if (!is_dir($logDir)) {
        mkdir($logDir, 0755, true);
    }
    
    $logFile = $logDir . '/email-mock.log';
    $entry = [
        'timestamp' => date('Y-m-d H:i:s'),
        'to' => $to,
        'subject' => $subject,
        'from' => $options['from'] ?? 'noreply@newearth.cz',
        'body_length' => strlen($body),
        'body_preview' => substr(strip_tags($body), 0, 200),
        'mock' => true
    ];
    
    file_put_contents($logFile, json_encode($entry, JSON_UNESCAPED_UNICODE) . PHP_EOL, FILE_APPEND | LOCK_EX);
    
    // Save full HTML
    $htmlFile = $logDir . '/last-email-' . md5($to . microtime(true)) . '.html';
    file_put_contents($htmlFile, $body);
    
    error_log("MOCK EMAIL: to=$to subject=$subject");
    
    return true;
}

// Wrapper function (doesn't conflict with existing sendEmailViaSMTP)
function sendEmailMock(string $to, string $subject, string $body, array $options = []): bool {
    return mockSendEmail($to, $subject, $body, $options);
}
