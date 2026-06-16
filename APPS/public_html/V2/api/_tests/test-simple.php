<?php
header('Content-Type: text/plain');
echo "TEST FILE EXISTS\n";
echo "PHP VERSION: " . phpversion() . "\n";
echo "FILE SIZE: " . filesize(__FILE__) . " bytes\n";
echo "FILE PATH: " . __FILE__ . "\n";
?>