<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$result = array('success' => false, 'message' => '', 'debug' => array());

try {
    $host = 'mail.webglobe.cz';
    $port = 587;
    
    $fp = @fsockopen($host, $port, $errno, $errstr, 5);
    if ($fp) {
        $result['debug'][] = 'SMTP connected to ' . $host . ':' . $port;
        $greeting = fgets($fp, 1024);
        $result['debug'][] = 'Server: ' . trim($greeting);
        fclose($fp);
        $result['success'] = true;
        $result['message'] = 'SMTP connection successful';
    } else {
        $result['debug'][] = 'Connection failed: ' . $errstr;
        $result['message'] = 'Cannot connect to SMTP';
    }
} catch (Exception $e) {
    $result['message'] = $e->getMessage();
    $result['debug'][] = 'Exception: ' . $e->getMessage();
}

echo json_encode($result);
exit;
