<?php
/**
 * ZION eShop - SMTP Mail Helper
 * Uses PHPMailer to send emails via SMTP
 */

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\SMTP;
use PHPMailer\PHPMailer\Exception;

require_once __DIR__ . '/PHPMailer/PHPMailer.php';
require_once __DIR__ . '/PHPMailer/SMTP.php';
require_once __DIR__ . '/PHPMailer/Exception.php';

// Load config if not loaded
if (!defined('SMTP_HOST')) {
    require_once __DIR__ . '/env-loader.php';
    if (file_exists(__DIR__ . '/config.php')) {
        require_once __DIR__ . '/config.php';
    }
}

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
        $mail->isSMTP();
        $mail->Host = defined('SMTP_HOST') ? SMTP_HOST : 'mail.webglobe.cz';
        
        // Dynamic port and encryption
        $smtpPort = defined('SMTP_PORT') ? SMTP_PORT : 587;
        $mail->Port = $smtpPort;
        
        // Auto-select encryption based on port
        if ($smtpPort == 465) {
            $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS; // SSL for port 465
        } else {
            $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS; // TLS for port 587
        }
        
        $mail->SMTPAuth = true;
        
        // SMTP credentials - use constants
        $smtpUser = defined('SMTP_USER') ? SMTP_USER : 'shop@newearth.cz';
        $smtpPass = defined('SMTP_PASS') ? SMTP_PASS : '';
        
        $mail->Username = $smtpUser;
        $mail->Password = $smtpPass;
        
        // Debug mode - uncomment for debugging
        // $mail->SMTPDebug = SMTP::DEBUG_SERVER;
        
        // UTF-8 encoding
        $mail->CharSet = PHPMailer::CHARSET_UTF8;
        $mail->Encoding = 'base64';
        
        // From / Reply-To
        $fromEmail = $options['from'] ?? $smtpUser;
        $fromName = $options['fromName'] ?? 'ZION Terra Nova';
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
        
        // Send
        $mail->send();
        
        // Log success
        $logFile = __DIR__ . '/../data/email_sent.log';
        $logEntry = date('Y-m-d H:i:s') . " | TO: $to | SUBJECT: $subject | SUCCESS\n";
        @file_put_contents($logFile, $logEntry, FILE_APPEND);
        
        return true;
        
    } catch (Exception $e) {
        // Log error
        $logFile = __DIR__ . '/../data/email_errors.log';
        $error = $e instanceof \PHPMailer\PHPMailer\Exception ? $mail->ErrorInfo : $e->getMessage();
        $logEntry = date('Y-m-d H:i:s') . " | TO: $to | SUBJECT: $subject | ERROR: $error\n";
        @file_put_contents($logFile, $logEntry, FILE_APPEND);
        
        error_log("PHPMailer exception: $error");
        
        return false;
    }
}
