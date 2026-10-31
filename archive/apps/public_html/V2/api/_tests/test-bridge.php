<?php
require_once __DIR__ . '/php-python-bridge.php';

echo "<h1>PHP-Python Bridge Test</h1>";

// Test 1: Python version
echo "<h2>Test 1: Python Version</h2>";
$result1 = runPythonScript('/usr/bin/python3', '-c', ['import sys; print(sys.version)']);
echo "<pre>";
echo "Success: " . ($result1['success'] ? 'YES' : 'NO') . "\n";
echo "Exit Code: " . $result1['exit_code'] . "\n";
echo "Output: " . $result1['stdout'] . "\n";
echo "Error: " . $result1['stderr'] . "\n";
echo "</pre>";

// Test 2: Import test
echo "<h2>Test 2: Import Test</h2>";
$result2 = runPythonScript('/usr/bin/python3', '-c', ['import json, smtplib; print("Imports OK")']);
echo "<pre>";
echo "Success: " . ($result2['success'] ? 'YES' : 'NO') . "\n";
echo "Exit Code: " . $result2['exit_code'] . "\n";
echo "Output: " . $result2['stdout'] . "\n";
echo "Error: " . $result2['stderr'] . "\n";
echo "</pre>";

// Test 3: Email script help
echo "<h2>Test 3: Email Script --help</h2>";
$scriptPath = __DIR__ . '/../scripts/send_eshop_order_email.py';
$result3 = runPythonScriptWithCLI('/usr/bin/python3', $scriptPath, ['--help' => true]);
echo "<pre>";
echo "Success: " . ($result3['success'] ? 'YES' : 'NO') . "\n";
echo "Exit Code: " . $result3['exit_code'] . "\n";
echo "Output: " . $result3['stdout'] . "\n";
echo "Error: " . $result3['stderr'] . "\n";
echo "</pre>";

// Test 4: Check if proc_open available
echo "<h2>Test 4: PHP Configuration</h2>";
echo "<pre>";
echo "proc_open available: " . (function_exists('proc_open') ? 'YES' : 'NO') . "\n";
echo "bypass_shell support: " . (version_compare(PHP_VERSION, '7.4.0') >= 0 ? 'YES' : 'NO') . "\n";
echo "PHP Version: " . PHP_VERSION . "\n";
echo "</pre>";
?>
