<?php
header("Content-Type: application/json");

$tests = [];

// Test 1: curl extension
$tests["curl_loaded"] = extension_loaded("curl");

// Test 2: Try 127.0.0.1
$ch = curl_init("http://127.0.0.1:5557/health");
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 5,
    CURLOPT_CONNECTTIMEOUT => 2
]);
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$error = curl_error($ch);
curl_close($ch);
$tests["127.0.0.1:5557"] = [
    "http_code" => $httpCode,
    "error" => $error,
    "response" => $response ? substr($response, 0, 100) : null
];

// Test 3: Try localhost
$ch = curl_init("http://localhost:5557/health");
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 5,
    CURLOPT_CONNECTTIMEOUT => 2
]);
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$error = curl_error($ch);
curl_close($ch);
$tests["localhost:5557"] = [
    "http_code" => $httpCode,
    "error" => $error,
    "response" => $response ? substr($response, 0, 100) : null
];

// Test 4: open_basedir
$tests["open_basedir"] = ini_get("open_basedir");

// Test 5: allow_url_fopen
$tests["allow_url_fopen"] = ini_get("allow_url_fopen");

// Test 6: disabled functions related to curl
$disabled = explode(",", ini_get("disable_functions"));
$tests["disabled_functions_count"] = count($disabled);

echo json_encode(["success" => true, "tests" => $tests], JSON_PRETTY_PRINT);
