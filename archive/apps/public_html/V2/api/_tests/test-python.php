<?php
// Test Python executable na serveru

echo "<h1>Python Test</h1>";

// Test 1: which python3
echo "<h2>which python3:</h2>";
exec('which python3 2>&1', $output1, $ret1);
echo "<pre>Return: $ret1\n";
print_r($output1);
echo "</pre>";

// Test 2: whereis python3
echo "<h2>whereis python3:</h2>";
exec('whereis python3 2>&1', $output2, $ret2);
echo "<pre>Return: $ret2\n";
print_r($output2);
echo "</pre>";

// Test 3: python3 --version
echo "<h2>python3 --version:</h2>";
exec('python3 --version 2>&1', $output3, $ret3);
echo "<pre>Return: $ret3\n";
print_r($output3);
echo "</pre>";

// Test 4: /usr/bin/python3 --version
echo "<h2>/usr/bin/python3 --version:</h2>";
exec('/usr/bin/python3 --version 2>&1', $output4, $ret4);
echo "<pre>Return: $ret4\n";
print_r($output4);
echo "</pre>";

// Test 5: PATH
echo "<h2>PATH:</h2>";
echo "<pre>" . getenv('PATH') . "</pre>";

// Test 6: Exist check
echo "<h2>File exists check:</h2>";
$paths = ['/usr/bin/python3', '/usr/local/bin/python3', '/bin/python3'];
foreach ($paths as $path) {
    $exists = file_exists($path) ? 'YES' : 'NO';
    $exec = is_executable($path) ? 'EXEC' : 'NOT EXEC';
    echo "<pre>$path: $exists, $exec</pre>";
}

// Test 7: phpinfo
echo "<h2>PHP Info (exec section):</h2>";
echo "<pre>";
echo "disable_functions: " . ini_get('disable_functions') . "\n";
echo "</pre>";
?>
