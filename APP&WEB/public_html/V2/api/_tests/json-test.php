<?php
error_reporting(0);
ini_set('display_errors', '0');
header('Content-Type: application/json; charset=utf-8', true);
header('Access-Control-Allow-Origin: *');
ob_start('ob_gzhandler');

$result = array('status' => 'ok', 'message' => 'Test successful');
echo json_encode($result);

ob_end_flush();
exit;
