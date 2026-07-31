<?php
$order = json_decode(file_get_contents(__DIR__ . '/../orders/ZTNMIRIGAI9HATF.json'), true);

echo "=== Token Debug ===\n";
echo "zionTokens: " . ($order['zionTokens'] ?? 'NULL') . "\n";
echo "zion.tokens.totalTokens: " . ($order['zion']['tokens']['totalTokens'] ?? 'NULL') . "\n";
echo "items[0].tokens: " . ($order['items'][0]['tokens'] ?? 'NULL') . "\n";
echo "items count: " . count($order['items']) . "\n";
print_r($order['zion']);
