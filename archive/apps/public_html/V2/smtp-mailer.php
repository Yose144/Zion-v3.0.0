<?php
/**
 * ZION eShop - SMTP Mail Helper
 * Uses PHPMailer to send emails via SMTP (fallback for broken mail())
 */

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\SMTP;
use PHPMailer\PHPMailer\Exception;

require_once __DIR__ . '/PHPMailer/PHPMailer.php';
require_once __DIR__ . '/PHPMailer/SMTP.php';
require_once __DIR__ . '/PHPMailer/Exception.php';

/**
 * Send email via SMTP using PHPMailer
 * 
 * @param string $to Recipient email
 * @param string $subject Email subject
 * @param string $body Email body (HTML or plain text)
 * @param array $options Additional options (from, replyTo, isHTML, etc.)
 * @return bool True on success, false on failure
 */
function sendEmailViaSMTP(string $to, string $subject, string $body, array $options = []): bool
{
    try {
        $mail = new PHPMailer(true);
        
        // SMTP Configuration
        // Webglobe SMTP server
        $mail->isSMTP();
        $mail->Host = 'mail.webglobe.cz';
        $mail->Port = 587;  // nebo 465 pro SSL
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;  // pro 587, použij ENCRYPTION_SMTPS pro 465
        $mail->SMTPAuth = true;
        
        // SMTP credentials (prefer env/const; fallback to legacy defaults)
        $smtpUser = getenv('SMTP_USER');
        if (!$smtpUser && defined('SMTP_USER')) $smtpUser = SMTP_USER;
        if (!$smtpUser && defined('SHOP_EMAIL')) $smtpUser = SHOP_EMAIL;
        if (!$smtpUser) $smtpUser = 'shop@newearth.cz';

        $smtpPass = getenv('SMTP_PASSWORD');
        if (!$smtpPass && defined('SMTP_PASS')) $smtpPass = SMTP_PASS;
        if (!$smtpPass && defined('SMTP_PASSWORD')) $smtpPass = SMTP_PASSWORD;
        // Legacy fallback (keeps existing deployments working)
        if (!$smtpPass) $smtpPass = getenv('SHOP_SMTP_PASSWORD') ?: '';

        $mail->Username = $smtpUser;
        $mail->Password = $smtpPass;
        
        // Debug mode - odkomentuj pro ladění (vypni v produkci!)
        // $mail->SMTPDebug = SMTP::DEBUG_SERVER;
        
        // UTF-8 encoding
        $mail->CharSet = PHPMailer::CHARSET_UTF8;
        $mail->Encoding = 'base64';
        
        // From / Reply-To
        $fromEmail = $options['from'] ?? 'shop@newearth.cz';
        $fromName = $options['fromName'] ?? 'ZION eShop';
        $replyTo = $options['replyTo'] ?? $fromEmail;
        
        $mail->setFrom($fromEmail, $fromName);
        $mail->addReplyTo($replyTo);
        
        // Recipient
        $mail->addAddress($to);
        
        // Subject & Body
        $mail->Subject = $subject;
        
        if ($options['isHTML'] ?? true) {
            $mail->isHTML(true);
            $mail->Body = $body;
            // Plain text alternative (pro non-HTML klienty)
            $mail->AltBody = strip_tags($body);
        } else {
            $mail->isHTML(false);
            $mail->Body = $body;
        }
        
        // Attachments
        if (isset($options['attachments']) && is_array($options['attachments'])) {
            foreach ($options['attachments'] as $attachment) {
                if (is_array($attachment)) {
                    $mail->addAttachment(
                        $attachment['path'],
                        $attachment['name'] ?? basename($attachment['path'])
                    );
                } else {
                    $mail->addAttachment($attachment);
                }
            }
        }
        
        // Debug (disable in production)
        // $mail->SMTPDebug = SMTP::DEBUG_SERVER;
        
        // Send
        $result = $mail->send();
        
        if (!$result) {
            error_log('PHPMailer send failed: ' . $mail->ErrorInfo);
        }
        
        return $result;
        
    } catch (Exception $e) {
        error_log('PHPMailer exception: ' . $e->getMessage());
        return false;
    } catch (Throwable $t) {
        error_log('PHPMailer error: ' . $t->getMessage());
        return false;
    }
}

/**
 * Backward-compatible wrapper that mimics mail() function
 * 
 * @param string $to
 * @param string $subject
 * @param string $message
 * @param string|array $additionalHeaders (can be string or array)
 * @return bool
 */
function sendmail(string $to, string $subject, string $message, $additionalHeaders = ''): bool
{
    // Parse headers
    $options = [
        'isHTML' => false,
        'from' => 'shop@newearth.cz',
        'fromName' => 'ZION eShop',
        'replyTo' => 'shop@newearth.cz'
    ];
    
    if (is_string($additionalHeaders)) {
        $headers = explode("\r\n", $additionalHeaders);
    } else {
        $headers = (array)$additionalHeaders;
    }
    
    foreach ($headers as $header) {
        if (empty($header)) continue;
        
        if (stripos($header, 'Content-Type:') !== false && stripos($header, 'text/html') !== false) {
            $options['isHTML'] = true;
        }
        
        if (stripos($header, 'From:') === 0) {
            // Parse "From: Name <email@example.com>"
            if (preg_match('/From:\s*(.+?)\s*<(.+?)>/i', $header, $matches)) {
                $options['fromName'] = trim($matches[1]);
                $options['from'] = trim($matches[2]);
            } elseif (preg_match('/From:\s*(.+)/i', $header, $matches)) {
                $options['from'] = trim($matches[1]);
            }
        }
        
        if (stripos($header, 'Reply-To:') === 0) {
            if (preg_match('/Reply-To:\s*(.+)/i', $header, $matches)) {
                $options['replyTo'] = trim($matches[1]);
            }
        }
    }
    
    return sendEmailViaSMTP($to, $subject, $message, $options);
}
