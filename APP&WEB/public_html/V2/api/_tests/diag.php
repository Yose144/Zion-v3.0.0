<?php
header('Content-Type: text/plain');
$host = 'mail.webglobe.cz';
$port = 587;
$fp = @fsockopen($host, $port, $errno, $errstr, 5);
echo "DIAGNOSTICS:\n";
echo "PHP Version: " . phpversion() . "\n";
echo "SMTP Test:\n";
if ($fp) {
    echo "  Connected: YES\n";
    $greeting = fgets($fp, 1024);
    echo "  Greeting: " . trim($greeting) . "\n";
    fclose($fp);
} else {
    echo "  Connected: NO\n";
    echo "  Error: $errstr ($errno)\n";
}
echo "\nNow trying JSON:\n";
echo '{"test":1}';
exit;
