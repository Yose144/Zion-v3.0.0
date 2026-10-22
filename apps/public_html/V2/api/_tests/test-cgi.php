<?php
require_once 'wallet-generator.php';

echo "Testing CGI wallet generation...\n\n";

$wallet = generateZionWalletCGI('test@test.com', 1000, 'PHP_CGI_TEST');

if ($wallet) {
    echo "SUCCESS!\n";
    print_r($wallet);
} else {
    echo "FAILED - using fake wallet fallback\n";
    $wallet = generateFakeWallet('test@test.com', 1000, 'PHP_CGI_TEST');
    print_r($wallet);
}
