# ZION API Endpoints

## `wallet-qr.php`
Generates a unique Zion wallet reference and a QR code for token bonuses or payouts.

### Request
`POST /V2/api/wallet-qr.php`

```json
{
  "label": "Camp 2025 drop",
  "amountTokens": 25,
  "orderId": "ORD-2025-0001",
  "expiresInHours": 168
}
```

### Response
```json
{
  "success": true,
  "wallet": {
    "id": "zw_ab12cd34ef56",
    "label": "Camp 2025 drop",
    "tokens": 25,
    "orderId": "ORD-2025-0001",
    "createdAt": "2025-01-05T10:20:30+00:00",
    "expiresAt": "2025-01-12T10:20:30+00:00",
    "uri": "zion://wallet/zw_ab12cd34ef56?tokens=25&label=Camp+2025+drop&orderId=ORD-2025-0001"
  },
  "qr": {
    "serviceUrl": "https://quickchart.io/qr?...",
    "imageFile": "zw_ab12cd34ef56.png",
    "dataUrl": "data:image/png;base64,..."
  },
  "storage": {
    "json": "zw_ab12cd34ef56.json",
    "image": "zw_ab12cd34ef56.png"
  }
}
```

QR bitmaps and JSON records are stored in `V2/wallets/`. Each record contains the wallet URI, timestamps, and the QR file name. Images are retrieved via the QuickChart API; if the remote service is unavailable, the API still returns the Zion URI so a QR can be generated client-side.

### Quick test (local PHP server)
```bash
curl -X POST http://localhost/V2/api/wallet-qr.php \
  -H 'Content-Type: application/json' \
  -d '{"label":"Test Wallet","amountTokens":10,"orderId":"TEST-1"}'
```

The command returns the JSON structure above and caches the generated QR assets in `V2/wallets/`.

## `create-order.php`
When a checkout request arrives, the script now:

1. Persists the JSON payload under `V2/orders/` as before.
2. Calculates the Zion token bonus from each line item (`tokens` field or `price/100`).
3. Calls the wallet helper to mint a bonus wallet + QR if the token total is greater than zero.
4. Embeds the wallet URI and QR links inside both the admin and customer confirmation emails and includes the payload in the API response under the `zion` key.

If the QR generation fails (for example, missing PHP extensions or QR service downtime) the order still completes—an error is logged and the email omits the token section.

Every successful order also appends a ledger entry stored in `V2/wallets/ledger.json`. Entries include:

- `id`, `orderId`, `walletId`, `walletUri`, `qrImage`
- `tokens` (total ZION bonus) and `details` (per line breakdown)
- `network` (defaults to `Mainnet`) and `status` (`pending`, `queued`, `sent`, `failed`)
- History array that records every change so the native wallet can audit payouts.

## `wallet-ledger.php`
Provides a thin API for reading and updating the ledger so the native wallet (or any admin utility) can pick up outstanding payouts after the Mainnet phase.

### List entries
`GET /V2/api/wallet-ledger.php?status=pending&network=Mainnet`

```json
{
  "success": true,
  "count": 2,
  "entries": [
    {
      "id": "ledger_a1b2c3d4",
      "orderId": "ZTNABC123",
      "walletId": "zw_ff11ee22",
      "tokens": 42,
      "status": "pending",
      "network": "Mainnet",
      "walletUri": "zion://wallet/zw_ff11ee22?tokens=42&label=ZION+order+ZTNABC123",
      "qrImage": "zw_ff11ee22.png",
      "history": [
        { "status": "pending", "timestamp": "2025-01-05T12:00:00+00:00", "note": "Created from order #ZTNABC123" }
      ]
    }
  ],
  "stats": {
    "totalTokens": 42,
    "byStatus": {
      "pending": 42
    }
  },
  "statusOptions": ["pending", "queued", "sent", "failed"]
}
```

You can also fetch a single entry via `GET /V2/api/wallet-ledger.php?id=ledger_a1b2c3d4`.

### Update status / attach transaction hash
`POST /V2/api/wallet-ledger.php`

```json
{
  "id": "ledger_a1b2c3d4",
  "status": "sent",
  "txHash": "0xabc123...",
  "network": "mainnet",
  "note": "Batch payout #{2025-03}"
}
```

Response:

```json
{
  "success": true,
  "entry": {
    "id": "ledger_a1b2c3d4",
    "status": "sent",
    "txHash": "0xabc123...",
    "updatedAt": "2025-03-10T08:15:00+00:00",
    "history": [
      {"status": "pending", "timestamp": "2025-01-05T12:00:00+00:00", "note": "Created from order #ZTNABC123"},
      {"status": "sent", "timestamp": "2025-03-10T08:15:00+00:00", "note": "Batch payout #{2025-03}"}
    ]
  }
}
```

### Native wallet automation flow
1. Mainnet phase: keep using the storefront; each order produces a ledger entry with `network=Mainnet` so you can verify UX without touching on-chain balances.
2. When moving to production, have the native wallet poll `wallet-ledger.php?status=pending&network=Mainnet` (or `mainnet`) to download all outstanding payouts.
3. For every entry:
   - Decode the `walletUri` or `qrImage` to display the destination in the wallet UI.
   - Execute the on-chain transfer when ready.
   - Call the POST endpoint with `status=sent` and optionally `txHash`/`note` so the ledger tracks what happened.
4. If something fails on-chain, update with `status=failed` and a note; the storefront will keep the entry visible until you mark it as sent.

Because the ledger lives in `V2/wallets/ledger.json`, you can also back it up or replicate it to another database once the infrastructure grows beyond flat files.
