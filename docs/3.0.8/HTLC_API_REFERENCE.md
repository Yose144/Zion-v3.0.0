# ZION WARP — Native L1 HTLC API Reference

**Version:** 3.1.0-beta
**Date:** 2026-08-23
**Base URL:** `http://<warpd-host>:<dex-port>/v1/multichain/swaps/htlc`

The WARP daemon (`warpd`) exposes a unified DEX API on `listen_port + 1` (e.g. 9336 when WARP API is on 9335). All HTLC endpoints live under `/v1/multichain/swaps/htlc/`.

## Endpoints

### 1. Lock — `POST /lock`

Lock funds on the source chain into an HTLC script.

**Request body:**

```json
{
  "from": "zion",
  "to": "zion",
  "amount": 100000000,
  "hash_hex": "<64-char SHA-256 hex of the 32-byte preimage>",
  "timelock": 4077782400,
  "source_address": "zion1...",
  "target_address": "zion1...",
  "source_pubkey_hex": "<64-char Ed25519 public key hex — refund path>",
  "target_pubkey_hex": "<64-char Ed25519 public key hex — claim path>"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `from` | string | yes | Source chain name (`zion`, `btc`, `eth`, `base`) |
| `to` | string | yes | Target chain name |
| `amount` | u128 | yes | Amount in smallest unit (flowers for ZION; 1 ZION = 1_000_000 flowers) |
| `hash_hex` | string | yes | SHA-256 hash of the 32-byte preimage (64 hex chars) |
| `timelock` | u64 | yes | UNIX timestamp (seconds) after which refund is possible; must be > now |
| `source_address` | string? | no | Source address; defaults to relayer/escrow address |
| `target_address` | string? | no | Target/claimant address; defaults to relayer address |
| `source_pubkey_hex` | string? | no* | 32-byte Ed25519 public key for refund path. **Required for `from=zion`.** |
| `target_pubkey_hex` | string? | no* | 32-byte Ed25519 public key for claim path. **Required for `to=zion`.** |

**Response (200):**

```json
{
  "hash": "<hash_hex>",
  "status": "executing",
  "transfer_id": "htlc-lock-<hash_hex>"
}
```

**Error response (400):**

```json
{
  "message": "<error description>"
}
```

**Notes:**
- Minimum lock amount for ZION L1 is ~100 ZION (100_000_000 flowers). The HTLC fee is 1 ZION (1_000_000 flowers); claim/refund requires `lock_amount > fee`.
- The lock transaction is submitted to the L1 mempool immediately. Mine a block to confirm it on-chain.

---

### 2. Claim — `POST /claim`

Release locked funds by revealing the preimage.

**Request body:**

```json
{
  "hash_hex": "<64-char hashlock hex>",
  "secret_hex": "<64-char 32-byte preimage hex>",
  "to": "zion",
  "target_address": "zion1..."
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `hash_hex` | string | yes | HTLC hashlock (SHA-256 of preimage) |
| `secret_hex` | string | yes | The 32-byte preimage (64 hex chars). `SHA-256(secret) == hash_hex` must hold. |
| `to` | string | yes | Target chain name |
| `target_address` | string? | no | Recipient address. If omitted, uses `record.counterparty_addr`. For ZION L1, must match the address derived from `target_pubkey_hex` committed at lock time. |

**Response (200):**

```json
{
  "hash": "<hash_hex>",
  "status": "completed",
  "recipient": "zion1..."
}
```

**Error response (400):**

```json
{
  "message": "<error description>"
}
```

**Guards enforced:**
1. `SHA-256(secret) == hashlock` — preimage verification
2. HTLC not already settled (claimed/refunded)
3. Timelock not expired (claim must happen before timeout)
4. For ZION L1 targets: `recipient` address must match `derive_address(target_pubkey_hex)` from the lock record

---

### 3. Refund — `POST /refund`

Return locked funds to the locker after timelock expiry.

**Request body:**

```json
{
  "hash_hex": "<64-char hashlock hex>",
  "from": "zion",
  "source_address": "zion1..."
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `hash_hex` | string | yes | HTLC hashlock |
| `from` | string | yes | Source chain name (where funds were locked) |
| `source_address` | string? | no | Locker/refund address. If omitted, uses `record.locker_address`. |

**Response (200):**

```json
{
  "hash": "<hash_hex>",
  "status": "refunded"
}
```

**Error response (400):**

```json
{
  "message": "<error description>"
}
```

**Guards enforced:**
1. HTLC not already settled
2. `now >= timelock` — timelock must have expired
3. Refund TX sent to `derive_address(refund_pubkey_hex)` from the lock record

---

### 4. Get HTLC Status — `GET /:hash_hex`

Query an HTLC record by its hashlock.

**Path parameter:** `hash_hex` — 64-char hex hashlock

**Response (200):**

```json
{
  "record": {
    "hash_hex": "...",
    "locker_address": "zion-l1:zion1...",
    "amount": 100000000,
    "lock_tx_id": "...",
    "lock_block_height": 0,
    "expires_at": 4077782400,
    "counterparty_chain": "ZionL1",
    "counterparty_addr": "zion-l1:zion1...",
    "refund_pubkey": [193, 5, 185, ...],
    "claimant_pubkey": [193, 5, 185, ...],
    "state": "pending",
    "release_tx_id": null,
    "release_recipient": null,
    "preimage_hex": null,
    "created_at": "2026-08-23T...",
    "updated_at": "2026-08-23T..."
  }
}
```

**State values:** `pending`, `claimed`, `refunded`, `error:<msg>`

**Response (404):** HTLC not found.

---

### 5. List Pending HTLCs — `GET /pending`

List all HTLCs in `pending` state (waiting for claim or refund).

**Response (200):**

```json
{
  "htlcs": [ <HtlcRecord>, ... ]
}
```

---

### 6. Get Escrow Address — `GET /escrow`

Get the relayer/escrow ZION L1 address and memo format.

**Response (200):**

```json
{
  "status": "ok",
  "escrow_address": "zion1...",
  "memo_format": "SWAP:LOCK:<hash_hex>:<timeout_min>:<chain>:<addr>:<escrow>\n"
}
```

---

## Native L1 HTLC Script Format

The on-chain HTLC output script (105 bytes):

```
[0x01] [32B hashlock] [8B timeout (LE u64)] [32B claimant pubkey] [32B refund pubkey]
```

- **Claim input script** (128 bytes): `[32B preimage] [64B Ed25519 signature] [32B claimant pubkey]`
  - Validates: `SHA-256(preimage) == hashlock`, `block_timestamp < timeout`, signature valid, output goes to `derive_address(claimant_pubkey)`.
- **Refund input script** (96 bytes): `[64B Ed25519 signature] [32B refund pubkey]`
  - Validates: `block_timestamp >= timeout`, signature valid, output goes to `derive_address(refund_pubkey)`.

## E2E Test Procedure

```bash
# 1. Start zion-node and warpd
zion-node --db-path /tmp/zion-e2e.db --rpc 127.0.0.1:9555 --v3-no-genesis
warpd --config warp-e2e.toml --listen 127.0.0.1:9335

# 2. Mine a block to fund the relayer
ZION_NODE_RPC=127.0.0.1:9555 ZION_MINER_ADDR=zion1... quick_mine

# 3. Generate preimage/hashlock
PREIMAGE=$(openssl rand -hex 32)
HASHLOCK=$(printf "$PREIMAGE" | xxd -r -p | sha256sum | cut -d' ' -f1)

# 4. Lock
curl -X POST http://127.0.0.1:9336/v1/multichain/swaps/htlc/lock \
  -H "Content-Type: application/json" \
  -d "{\"from\":\"zion\",\"to\":\"zion\",\"amount\":100000000,\"hash_hex\":\"$HASHLOCK\",\"timelock\":4077782400,\"source_pubkey_hex\":\"...\",\"target_pubkey_hex\":\"...\"}"

# 5. Mine to confirm lock
quick_mine

# 6. Claim
curl -X POST http://127.0.0.1:9336/v1/multichain/swaps/htlc/claim \
  -H "Content-Type: application/json" \
  -d "{\"hash_hex\":\"$HASHLOCK\",\"secret_hex\":\"$PREIMAGE\",\"to\":\"zion\",\"target_address\":\"zion1...\"}"

# 7. Mine to confirm claim
quick_mine

# 8. Verify
curl http://127.0.0.1:9336/v1/multichain/swaps/htlc/$HASHLOCK
# → state: "claimed"
```
