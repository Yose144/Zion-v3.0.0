<?php
/**
 * ZION Wallet helper library
 */

require_once __DIR__ . '/url-helper.php';

if (!defined('ZION_WALLET_STORAGE_DIR')) {
    define('ZION_WALLET_STORAGE_DIR', __DIR__ . '/../wallets');
}

if (!defined('ZION_WALLET_LEDGER_FILE')) {
    define('ZION_WALLET_LEDGER_FILE', ZION_WALLET_STORAGE_DIR . '/ledger.json');
}

if (!function_exists('zion_wallet_statuses')) {
    function zion_wallet_statuses(): array
    {
        return ['pending', 'queued', 'sent', 'failed'];
    }
}

if (!function_exists('zion_generate_wallet')) {
    function zion_generate_wallet(array $options): array
    {
        $label = trim((string)($options['label'] ?? ''));
        $tokens = (int)($options['tokens'] ?? $options['amountTokens'] ?? 0);
        $orderId = trim((string)($options['orderId'] ?? ''));
        $expiresInHours = (int)($options['expiresInHours'] ?? 720);
        $storageDir = $options['storageDir'] ?? ZION_WALLET_STORAGE_DIR;
        $qrSize = (int)($options['qrSize'] ?? 320);
        $qrMargin = (int)($options['qrMargin'] ?? 1);
        $qrService = $options['qrService'] ?? null; // external service disabled; use local generation

        if ($label === '' || mb_strlen($label) < 3) {
            throw new InvalidArgumentException('Wallet label must contain at least 3 characters');
        }

        if ($tokens <= 0) {
            throw new InvalidArgumentException('Wallet tokens must be a positive integer');
        }

        if ($expiresInHours <= 0) {
            $expiresInHours = 720;
        }

        if (!is_dir($storageDir) && !mkdir($storageDir, 0755, true)) {
            throw new RuntimeException('Unable to create wallets storage directory');
        }

        try {
            $walletId = $options['walletId'] ?? ('zw_' . bin2hex(random_bytes(6)));
        } catch (Throwable $e) {
            throw new RuntimeException('Unable to generate wallet identifier');
        }

        $createdAt = date(DATE_ATOM);
        $expiresAt = date(DATE_ATOM, time() + ($expiresInHours * 3600));
        $walletUri = zion_build_wallet_uri($walletId, $tokens, $label, $orderId);

        // Generate QR locally (PHP-only, no external dependencies)
        $qrServiceUrl = null;
        $qrImageFile = $storageDir . '/' . $walletId . '.png';
        $qrDataUrl = null;

        // Use PHP QR generator instead of Python exec
        require_once __DIR__ . '/qr-generator.php';
        $qrGenerated = generate_qr_code_file($walletUri, $qrImageFile, max(120, $qrSize), max(0, $qrMargin));

        if (!$qrGenerated || !file_exists($qrImageFile) || filesize($qrImageFile) === 0) {
            // Fallback: mark QR as missing; caller can regenerate later
            $qrImageFile = null;
            $qrDataUrl = null;
        } else {
            $qrDataUrl = 'data:image/png;base64,' . base64_encode(file_get_contents($qrImageFile));
            $qrServiceUrl = zion_wallet_public_url(basename($qrImageFile));
        }

        $record = [
            'id' => $walletId,
            'label' => $label,
            'tokens' => $tokens,
            'orderId' => $orderId ?: null,
            'createdAt' => $createdAt,
            'expiresAt' => $expiresAt,
            'uri' => $walletUri,
            'qrServiceUrl' => $qrServiceUrl,
            'qrImage' => $qrImageFile ? basename($qrImageFile) : null
        ];

        $recordFile = $storageDir . '/' . $walletId . '.json';
        file_put_contents($recordFile, json_encode($record, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

        return [
            'wallet' => [
                'id' => $walletId,
                'label' => $label,
                'tokens' => $tokens,
                'orderId' => $orderId ?: null,
                'createdAt' => $createdAt,
                'expiresAt' => $expiresAt,
                'uri' => $walletUri
            ],
            'qr' => [
                'serviceUrl' => $qrServiceUrl,
                'imageFile' => $qrImageFile ? basename($qrImageFile) : null,
                'dataUrl' => $qrDataUrl
            ],
            'storage' => [
                'json' => basename($recordFile),
                'image' => $qrImageFile ? basename($qrImageFile) : null
            ]
        ];
    }
}

if (!function_exists('zion_build_wallet_uri')) {
    function zion_build_wallet_uri(string $walletId, int $tokens, string $label, string $orderId = ''): string
    {
        $params = [
            'tokens' => $tokens,
            'label' => $label
        ];

        if ($orderId !== '') {
            $params['orderId'] = $orderId;
        }

        $query = http_build_query($params);
        return sprintf('zion://wallet/%s?%s', $walletId, $query);
    }
}

if (!function_exists('zion_wallet_load_ledger')) {
    function zion_wallet_load_ledger(): array
    {
        if (!file_exists(ZION_WALLET_LEDGER_FILE)) {
            return [];
        }

        $json = file_get_contents(ZION_WALLET_LEDGER_FILE);
        $data = json_decode($json, true);
        return is_array($data) ? $data : [];
    }
}

if (!function_exists('zion_wallet_save_ledger')) {
    function zion_wallet_save_ledger(array $entries): void
    {
        if (!is_dir(ZION_WALLET_STORAGE_DIR)) {
            mkdir(ZION_WALLET_STORAGE_DIR, 0755, true);
        }

        file_put_contents(
            ZION_WALLET_LEDGER_FILE,
            json_encode(array_values($entries), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE),
            LOCK_EX
        );
    }
}

if (!function_exists('zion_wallet_append_ledger_entry')) {
    function zion_wallet_append_ledger_entry(array $data): array
    {
        $ledger = zion_wallet_load_ledger();

        try {
            $ledgerId = $data['id'] ?? ('ledger_' . bin2hex(random_bytes(4)));
        } catch (Throwable $e) {
            $ledgerId = 'ledger_' . uniqid();
        }

        $status = $data['status'] ?? 'pending';
        if (!in_array($status, zion_wallet_statuses(), true)) {
            $status = 'pending';
        }

        $now = date(DATE_ATOM);
        $entry = [
            'id' => $ledgerId,
            'orderId' => $data['orderId'] ?? null,
            'walletId' => $data['walletId'] ?? null,
            'tokens' => (int)($data['tokens'] ?? 0),
            'status' => $status,
            'network' => $data['network'] ?? 'testnet',
            'source' => $data['source'] ?? 'order',
            'createdAt' => $now,
            'updatedAt' => $now,
            'walletAddress' => $data['walletAddress'] ?? null,
            'walletMnemonic' => $data['walletMnemonic'] ?? null,
            'walletUri' => $data['walletUri'] ?? null,
            'qrImage' => $data['qrImage'] ?? null,
            'note' => $data['note'] ?? null,
            'txHash' => $data['txHash'] ?? null,
            'details' => $data['details'] ?? null,
            'history' => []
        ];

        $entry['history'][] = [
            'status' => $entry['status'],
            'timestamp' => $now,
            'note' => $data['historyNote'] ?? 'Created automatically'
        ];

        $ledger[] = $entry;
        zion_wallet_save_ledger($ledger);

        return $entry;
    }
}

if (!function_exists('zion_wallet_update_ledger_entry')) {
    function zion_wallet_update_ledger_entry(string $ledgerId, array $updates): ?array
    {
        $ledger = zion_wallet_load_ledger();
        $updated = null;

        foreach ($ledger as $index => $entry) {
            if ($entry['id'] !== $ledgerId) {
                continue;
            }

            $changed = false;
            $noteForHistory = $updates['note'] ?? null;

            if (isset($updates['status']) && in_array($updates['status'], zion_wallet_statuses(), true)) {
                if ($entry['status'] !== $updates['status']) {
                    $entry['status'] = $updates['status'];
                    $changed = true;
                }
            }

            foreach (['note', 'txHash', 'network', 'walletAddress', 'walletMnemonic'] as $field) {
                if (array_key_exists($field, $updates)) {
                    $entry[$field] = $updates[$field];
                    $changed = true;
                    if ($field === 'txHash' && !$noteForHistory) {
                        $noteForHistory = 'txHash updated';
                    }
                    if (($field === 'walletAddress' || $field === 'walletMnemonic') && !$noteForHistory) {
                        $noteForHistory = $field . ' updated';
                    }
                }
            }

            if ($changed) {
                $entry['updatedAt'] = date(DATE_ATOM);
                $entry['history'][] = [
                    'status' => $entry['status'],
                    'timestamp' => $entry['updatedAt'],
                    'note' => $noteForHistory
                ];
                $ledger[$index] = $entry;
                zion_wallet_save_ledger($ledger);
            }

            $updated = $entry;
            break;
        }

        return $updated;
    }
}

if (!function_exists('zion_wallet_find_ledger_entry')) {
    function zion_wallet_find_ledger_entry(string $ledgerId): ?array
    {
        foreach (zion_wallet_load_ledger() as $entry) {
            if ($entry['id'] === $ledgerId) {
                return $entry;
            }
        }

        return null;
    }
}
