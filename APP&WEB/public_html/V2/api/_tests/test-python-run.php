<?php
// Test spuštění Python skriptu

echo "<h1>Python Script Test</h1>";

$pythonPath = '/usr/bin/python3';
$scriptPath = __DIR__ . '/../scripts/send_eshop_order_email.py';

echo "<h2>Files Check:</h2>";
echo "<pre>";
echo "Python: $pythonPath - " . (file_exists($pythonPath) ? 'EXISTS' : 'NOT EXISTS') . "\n";
echo "Script: $scriptPath - " . (file_exists($scriptPath) ? 'EXISTS' : 'NOT EXISTS') . "\n";
echo "</pre>";

// Test 1: Python verze
echo "<h2>Test 1: Python Version (direct call)</h2>";
$cmd1 = "$pythonPath --version 2>&1";
$output1 = [];
$ret1 = 0;
exec($cmd1, $output1, $ret1);
echo "<pre>Command: $cmd1\n";
echo "Return: $ret1\n";
echo "Output:\n";
print_r($output1);
echo "</pre>";

// Test 2: Python import test
echo "<h2>Test 2: Import Test</h2>";
$testCode = "import sys; print('Python:', sys.version); import json; print('JSON: OK'); import smtplib; print('SMTP: OK')";
$cmd2 = "$pythonPath -c " . escapeshellarg($testCode) . " 2>&1";
$output2 = [];
$ret2 = 0;
exec($cmd2, $output2, $ret2);
echo "<pre>Command: $cmd2\n";
echo "Return: $ret2\n";
echo "Output:\n";
print_r($output2);
echo "</pre>";

// Test 3: Check script syntax
echo "<h2>Test 3: Script Syntax Check</h2>";
$cmd3 = "$pythonPath -m py_compile " . escapeshellarg($scriptPath) . " 2>&1";
$output3 = [];
$ret3 = 0;
exec($cmd3, $output3, $ret3);
echo "<pre>Command: $cmd3\n";
echo "Return: $ret3\n";
echo "Output:\n";
print_r($output3);
echo "</pre>";

// Test 4: Try to run script with --help
echo "<h2>Test 4: Script --help</h2>";
$cmd4 = "$pythonPath " . escapeshellarg($scriptPath) . " --help 2>&1";
$output4 = [];
$ret4 = 0;
exec($cmd4, $output4, $ret4);
echo "<pre>Command: $cmd4\n";
echo "Return: $ret4\n";
echo "Output:\n";
print_r($output4);
echo "</pre>";

// Test 5: Check imports in script
echo "<h2>Test 5: Check Script Can Import Modules</h2>";
$testImport = "import sys; sys.path.insert(0, '" . __DIR__ . "/../src'); from wallet.eshop_email_manager import EshopEmailManager; print('Import OK')";
$cmd5 = "$pythonPath -c " . escapeshellarg($testImport) . " 2>&1";
$output5 = [];
$ret5 = 0;
exec($cmd5, $output5, $ret5);
echo "<pre>Command: $cmd5\n";
echo "Return: $ret5\n";
echo "Output:\n";
print_r($output5);
echo "</pre>";
?>
