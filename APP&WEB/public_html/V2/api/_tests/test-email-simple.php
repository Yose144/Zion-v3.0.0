<?php
header('Content-Type: text/plain; charset=utf-8');

$host = 'mail.webglobe.cz';
$port = 587;
$user = 'shop@newearth.cz';
// P1-31: Load SMTP password from env, never hardcode
$pass = getenv('SMTP_PASSWORD') ?: '';

$debug = array();
$success = false;
$message = '';

$fp = @fsockopen($host, $port, $errno, $errstr, 5);
if ($fp) {
    $debug[] = 'SMTP: Connected OK';
    $greeting = fgets($fp, 1024);
    $debug[] = 'Server: ' . trim($greeting);
    fclose($fp);
    $success = true;
    $message = 'SMTP test successful';
} else {
    $debug[] = "SMTP: Connection failed ($errstr)";
    $message = 'Cannot connect to SMTP server';
}

$result = array(
    'success' => $success,
    'message' => $message,
    'debug' => $debug
);

echo json_encode($result);
exit;