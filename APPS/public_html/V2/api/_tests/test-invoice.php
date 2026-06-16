<?php
require_once __DIR__ . '/generate-invoice.php';

header('Content-Type: text/plain; charset=UTF-8');
$order = json_decode(file_get_contents(__DIR__ . '/test-order.json'), true);
$res = generateInvoice($order);
var_export($res);
?>