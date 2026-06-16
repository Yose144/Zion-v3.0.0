<?php
ob_start();

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

$response = array(
    'success' => true,
    'message' => 'OK',
    'test' => 'minimal',
    'timestamp' => date('Y-m-d H:i:s')
);

$json = json_encode($response, JSON_UNESCAPED_UNICODE);

// Zálohuj obsah bufferu
$buffered = ob_get_clean();

// Pokud něco bylo buffered, přidej to do debug
if (!empty($buffered)) {
    $response['_WARNING_'] = 'Content was buffered before JSON: ' . substr($buffered, 0, 100);
    $json = json_encode($response, JSON_UNESCAPED_UNICODE);
}

// Zkontroluj délku
$len = strlen($json);
$response['_length_'] = $len;
$response['_position_183_'] = substr($json, 180, 10);

// Finální JSON
echo json_encode($response, JSON_UNESCAPED_UNICODE);
exit;
