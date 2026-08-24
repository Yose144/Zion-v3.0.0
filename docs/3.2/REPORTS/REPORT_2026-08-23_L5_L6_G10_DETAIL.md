# G10 — L5 Free World / L6 Issobella Detailed Technical Analysis

> **Date:** 2026-08-23
> **Gate:** G10 — L5/L6 activation decision for 3.2.0
> **Scope:** Technical deep-dive into the `V31/L5/free-world` and `V31/L6/issobella` crates, their interaction with V31 L1 and L2 DAO, and the deployment work required to run them as passive fund trackers.
> **Status:** Implementation complete; L5/L6 fund trackers are active on Edge. L6 Issobella runs on port `8097` (ZIS already occupies `8096` on Edge).
> **Related documents:**
> - `docs/3.2/L5_L6_ACTIVATION_PLAN.md` (decision plan)
> - `docs/3.2/ROADMAP.md` (G10 / E9 status)

---

## 1. Executive Summary

The L5 Free World and L6 Issobella crates exist in `V31/L5` and `V31/L6`, they compile, and their SQLite database tests pass. They are **not, however, wired for V31 production**:

1. **L1 scanner will not detect any tithes** because it expects a V3-style `utxo_transactions` field, while V31 native `getBlockByHeight` returns the fee-split coinbase as a single UTXO transaction inside `transactions`.
2. **Defaults are wrong:** RPC port, fund addresses, and service bind address do not match the canonical V31 Edge configuration.
3. **DAO client is misaligned** with the V31 DAO endpoint, auth header, and request body shape.
4. **Disbursement is impossible today** because `zion-dao` `execute_proposal()` only returns a human-readable summary; it does not sign or broadcast an L1 payout transaction.
5. **Deployment artifacts are in place:** systemd units, Edge environment variables, nginx routes, dashboard service entries, and backup script entries have been prepared and deployed.

This confirms the decision in `L5_L6_ACTIVATION_PLAN.md`: for 3.2.0, L5/L6 should be enabled as **passive, read-only fund trackers** that expose `/api/v1/fund/balance` and `/metrics`. Governance disbursement and full DAO UI remain post-3.2 work.

---

## 2. Methodology

- Source review of `V31/L5/free-world`, `V31/L6/issobella`, `V31/L2/dao`, `V31/L1/core`, `V31/cli`, `APP&WEB/website-v2.9`, `ZION_OS/dashboard`, `V31/deploy/config`, `ZION_OS/infra/scripts`.
- Build and test verification with `cargo check` and `cargo test` for both L5/L6 crates.
- Static analysis of L1 coinbase construction in `V31/L1/core/src/node.rs` and `V31/L1/core/src/rpc.rs::get_native_block`.
- Comparison of DAO request/response types in `V31/L2/dao/src/api.rs` with the DAO client in `V31/L5/free-world/src/dao_client.rs`.

---

## 3. Canonical Addresses and Fee Split

### 3.1 Canonical V31 subsidy addresses

Source of truth: `V31/L1/core/src/v3_compat.rs`.

| Role | Address |
|------|---------|
| Humanitarian / L5 (5 %) | `zion1y3w4z0c755v4y7t3f0k6s54390x0h3k3y5hv8c8` |
| Issobella / L6 (5 %) | `zion1z4s3a54266f2x7j4x7c27297k49752t7k52l0f0` |
| Miner (89 %) | `zion1074344t7k686j6n8a0l6t0f4c8d828y083xh4m2` |
| Node reward pool (1 %) | `zion1l0h428f536s6u3x7h5f0d5c2z644j7t8u8va3x0` |

### 3.2 L1 fee split

`V31/L1/core/src/emission.rs`:

```rust
pub const BASE_REWARD: u64 = 5_400_067_000; // flowers
pub const HUMANITARIAN_PCT: u64 = 5;
pub const ISSOBELLA_PCT: u64 = 5;
pub const POOL_FEE_PCT: u64 = 1; // 1 % node-reward slot post-activation
```

At current reward, each block pays:

- miner ≈ 4 805.06 ZION (89 %)
- humanitarian ≈ 270.00 ZION (5 %)
- Issobella ≈ 270.00 ZION (5 %)
- node reward / burn ≈ 54.00 ZION (1 %)

### 3.3 V31 native coinbase shape

`V31/L1/core/src/node.rs:840-892` builds the coinbase as a single UTXO transaction with one output per recipient:

```rust
let mut outputs = vec![
    TransactionOutput { address: miner,            amount: Amount::new(miner_amount as u128) },
    TransactionOutput { address: self.config.human_address.clone(),  amount: Amount::new(human_amount as u128) },
    TransactionOutput { address: self.config.issobella_address.clone(), amount: Amount::new(issobella_amount as u128) },
];
if node_reward_active {
    outputs.push(TransactionOutput { address: self.config.node_reward_address.clone(), amount: Amount::new(node_reward_amount as u128) });
}
let coinbase = Transaction { version: 1, inputs: vec![], outputs, memo: ... };
```

This first transaction is inserted at index 0 of the block's `transactions` vector.

`V31/L1/core/src/rpc.rs:629-708` (`get_native_block`) maps these UTXO transactions to JSON:

```json
{
  "height": 1234,
  "transactions": [
    {
      "tx_id": "...",
      "inputs": [],
      "outputs": [
        { "amount": 480506... , "address": "zion1074..." },
        { "amount": 27000...  , "address": "zion1y3w4..." },
        { "amount": 27000...  , "address": "zion1z4s3..." }
      ]
    },
    ...
  ],
  "humanitarian_zion": 270.00335,
  "issobella_zion": 270.00335,
  "transaction_model": "v31-native"
}
```

**Key finding:** there is no `utxo_transactions` field in the V31 native response.

---

## 4. Build and Test State

```bash
cd V31
cargo check -p zion-free-world -p zion-issobella
```

Result: **OK** (11 s).

```bash
cargo test -p zion-free-world -p zion-issobella
```

Result: **OK**. Each crate has 0 unit tests in `src/lib.rs` / `src/main.rs` and 3 integration DB tests in `tests/db.rs`:

- `zion-free-world`: `test_fund_balance`, `test_grant_lifecycle`, `test_project_lifecycle`
- `zion-issobella`: `test_fund_balance`, `test_mission_lifecycle`, `test_proposal_lifecycle`

**There are no tests for the L1 scanner or the DAO client.**

---

## 5. Configuration Audit

### 5.1 `V31/L5/free-world/src/config.rs`

```rust
l1_rpc_url: "http://127.0.0.1:9443/jsonrpc".to_string(),
humanitarian_fund_address: "zion1humanitarian0000000000000000000000".to_string(),
bind: "0.0.0.0".to_string(),
```

### 5.2 `V31/L6/issobella/src/config.rs`

```rust
l1_rpc_url: "http://127.0.0.1:9443/jsonrpc".to_string(),
issobella_fund_address: "zion1issobella000000000000000000000000".to_string(),
bind: "0.0.0.0".to_string(),
```

### 5.3 Environment overrides already supported

`FREE_WORLD_PORT`, `FREE_WORLD_BIND`, `FREE_WORLD_DB`, `FREE_WORLD_L1_RPC`, `FREE_WORLD_API_KEY`, `FREE_WORLD_HIRAN_URL`, `FREE_WORLD_HIRAN_ENABLED` (and the `ISSOBELLA_*` equivalents).

### 5.4 Missing environment overrides

- Fund address: `FREE_WORLD_HUMANITARIAN_ADDRESS`, `ISSOBELLA_FUND_ADDRESS`
- DAO API URL (not part of the config struct)
- DAO proposer identity / balance / snapshot block
- Bind default should arguably be `127.0.0.1` for a passive local service.

### 5.5 Why the RPC default is wrong

The V31 `AGENTS.md` port matrix and `V31/deploy/systemd/zion-v31-dao.service` agree:

- V31 node RPC: `127.0.0.1:9445`
- Public TCP stream proxy: `rpc.zionterranova.com:8443` → `127.0.0.1:9445`
- `9443` is a historical / pre-V31 port.

The L5/L6 scanner strips the `http://` prefix and connects raw TCP, so the URL format is tolerated, but the port must be `9445`.

---

## 6. L1 Scanner Deep Dive

### 6.1 Current scanner logic

`V31/L5/free-world/src/l1_scanner.rs:73-121` and the identical `V31/L6/issobella/src/l1_scanner.rs`:

```rust
async fn scan_new_blocks(&self) -> FreeWorldResult<u64> {
    let tip_height = self.get_chain_height().await?;
    let cursor = db.get_fund_balance()?.last_block_height;
    let safe_height = tip_height.saturating_sub(self.config.finality_blocks);

    for height in (cursor + 1)..=safe_height {
        let block = self.get_block(height).await?;

        if let Some(coinbase) = block.utxo_transactions.first() {
            for output in &coinbase.outputs {
                if output.address == self.config.fund_address {
                    // accumulate
                }
            }
        }
    }
}
```

`get_block` deserializes `RpcResponse<BlockInfo>`:

```rust
#[derive(Debug, Deserialize)]
struct BlockInfo {
    #[serde(default)]
    utxo_transactions: Vec<UtxoTransaction>,
}
```

### 6.2 Why it fails

1. The V31 native `getBlockByHeight` response has `transactions`, not `utxo_transactions`.
2. `#[serde(default)]` on `utxo_transactions` means the missing field becomes an empty `Vec`, so the scanner silently does nothing.
3. The loop only looks at the first transaction. Even if the field name were correct, the coinbase is now a **single** transaction with **all** outputs, so `first()` is the coinbase and it would actually work for the right field — but only if that field existed.

### 6.3 Required fix

Change `BlockInfo` to use `transactions` (with a backward-compatible fallback to `utxo_transactions`):

```rust
#[derive(Debug, Deserialize)]
struct BlockInfo {
    #[serde(default)]
    transactions: Vec<UtxoTransaction>,
    #[serde(default)]
    utxo_transactions: Vec<UtxoTransaction>,
}
```

Then iterate all transactions and all outputs:

```rust
let txs = if !block.transactions.is_empty() {
    &block.transactions
} else {
    &block.utxo_transactions
};
for tx in txs {
    for output in &tx.outputs {
        if output.address == self.config.fund_address {
            // accumulate
        }
    }
}
```

Because the per-block amount fits in `u64` (≈ 270 million flowers), the existing `amount: u64` in `TxOutput` will deserialize correctly from the JSON number returned by `get_native_block`.

### 6.4 Raw TCP / HTTP transport

`V31/L5/free-world/src/l1_scanner.rs:138-153` strips `http://` and writes a JSON-RPC line over raw TCP:

```rust
let addr = normalize_rpc_addr(&self.config.rpc_url);
let mut stream = TcpStream::connect(&addr).await?;
stream.write_all(request.as_bytes()).await?;
stream.write_all(b"\n").await?;
```

The V31 L1 RPC server (`V31/L1/core/src/rpc.rs:59-73`) auto-detects HTTP vs raw TCP, so both work once the correct port is configured. No transport change is required.

---

## 7. DAO Client / Proposal Bridge Deep Dive

### 7.1 Current L5/L6 DAO client

`V31/L5/free-world/src/dao_client.rs` / `V31/L6/issobella/src/dao_client.rs`:

```rust
impl Default for DaoClientConfig {
    fn default() -> Self {
        Self {
            dao_api_url: std::env::var("ZION_DAO_API_ADDR")
                .unwrap_or_else(|_| "http://127.0.0.1:8080".to_string()),
            api_key: std::env::var("ZION_DAO_API_KEY").unwrap_or_default(),
        }
    }
}

pub async fn submit_grant_proposal(&self, req: &DaoProposalRequest) -> anyhow::Result<DaoProposalResponse> {
    let url = format!("{}/api/v1/proposals", self.config.dao_api_url);
    self.http.post(&url).header("x-api-key", &self.config.api_key).json(req).send().await?;
    ...
}

pub struct DaoProposalRequest {
    pub title: String,
    pub description: String,
    pub amount_zion: u64,
    pub recipient_address: String,
    pub proposal_type: String,
}
```

### 7.2 V31 DAO actual API

`V31/L2/dao/src/api.rs:79-144`:

```rust
#[derive(Deserialize)]
pub struct CreateProposalRequest {
    pub title: String,
    pub description: String,
    pub proposal_type: ProposalTypeDto,
    pub proposer: String,
    pub proposer_balance: u64,
    pub snapshot_block: u64,
}

#[derive(Deserialize)]
#[serde(tag = "kind", content = "data")]
pub enum ProposalTypeDto {
    Treasury { recipient: String, amount: u64, purpose: String },
    Grant { ... },
    Humanitarian { ... },
    ...
}
```

Auth in `V31/L2/dao/src/api.rs:462-474` accepts `x-api-key`, `X-Api-Key`, or `X-DAO-Key`. The base URL is `http://127.0.0.1:8456` and the route is `POST /api/dao/proposals`.

### 7.3 Mismatch

| Field | L5/L6 client sends | DAO expects |
|-------|-------------------|-------------|
| URL | `http://127.0.0.1:8080` (pool) | `http://127.0.0.1:8456` |
| Path | `/api/v1/proposals` | `/api/dao/proposals` |
| `proposal_type` | flat string `"treasury"` | tagged enum `{ "kind": "Treasury", "data": { ... } }` |
| `proposer` | missing | required |
| `proposer_balance` | missing | required |
| `snapshot_block` | missing | required |

### 7.4 Why disbursement still cannot happen

`V31/L2/dao/src/runtime.rs:294-379` (`execute_proposal`) marks the proposal `Executed` and returns a formatted string, but it never creates or broadcasts an L1 transaction. `V31/L2/dao/src/treasury.rs:164-186` reduces the treasury balance and returns the operation, but it also does not sign or broadcast.

Therefore, even with a fixed DAO client, **spending L5/L6 funds requires additional L1 wallet/execution wiring** that is out of 3.2.0 scope.

---

## 8. API and Security

### 8.1 Routes

Both services expose read/write routes under `/api/v1/*` and `/ai/*`. For 3.2.0 passive mode, the read routes (`/health`, `/metrics`, `/api/v1/fund/balance`) and the write routes that create grants/missions are acceptable if bound to `127.0.0.1`.

### 8.2 API key handling

`AppState` holds an `api_key`, but the Axum router does not enforce it. The services are currently open. For 3.2.0 passive mode, this is acceptable **only if** the HTTP listener is bound to `127.0.0.1` and exposed through an authenticated nginx reverse proxy. Adding middleware is a post-3.2 hardening item.

### 8.3 Default bind

Both `config.rs` files default to `0.0.0.0`. The V31 `AGENTS.md` security model says new services should be `localhost-only` by default unless explicitly public. The recommendation is to change the default bind to `127.0.0.1` and let Edge deployment override with `FREE_WORLD_BIND` / `ISSOBELLA_BIND` if needed.

---

## 9. Deployment Gaps

| Artifact | Current state | Required for 3.2.0 passive mode |
|----------|---------------|--------------------------------|
| `V31/deploy/systemd/zion-v31-free-world.service` | Deployed | Runs as `zion:zion`, `EnvironmentFile=/etc/zion/edge-environment.sh`, `Restart=always` |
| `V31/deploy/systemd/zion-v31-issobella.service` | Deployed | Same as above |
| `/etc/zion/edge-environment.sh` L5/L6 entries | Present | `FREE_WORLD_*` / `ISSOBELLA_*` / `ZION_DAO_API_ADDR` |
| nginx `location /api/free-world` / `/api/issobella` | Present | Proxy to `127.0.0.1:8095` / `8097` with allowlist/Basic Auth |
| `ZION_OS/infra/scripts/backup-edge.sh` | Mentions DBs in header | Ensure `free_world.db` and `issobella.db` are actually copied |
| `ZION_OS/dashboard/app.py` registry | Active | Services registered with `/health` endpoints and purpose updated |
| `V31/STATUS.md` / `StatusV3.md` | Updated | Record L5/L6 active on Edge |

---

## 10. Public Website and CLI

### 10.1 Website pages

`APP&WEB/website-v2.9/src/app/l5-free-world/page.tsx` and `l6-issobella/page.tsx` contain stale V3/placeholder addresses that do not match the canonical V31 addresses. Since these pages are not being made public before 3.2.0, this is not a launch blocker, but the addresses should be aligned to avoid drift.

### 10.2 CLI stubs

`V31/cli/src/commands/free_world.rs` and `V31/cli/src/commands/issobella.rs` print:

```rust
ui::print_warn("Free World layer is not yet available in V31.");
```

These should be updated to reflect the new passive-tracker status and point to the local HTTP API or `zion-free-world` / `zion-issobella` binaries.

---

## 11. Risk Matrix

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Scanner misses all tithes (zero reported balance) | Certain if deployed as-is | High (no visibility) | Fix `BlockInfo` to use `transactions` and iterate all outputs |
| Service bound to `0.0.0.0` without auth | Certain as-is | Medium | Default bind to `127.0.0.1`; nginx allowlist on Edge |
| DAO client silently fails | Certain if `submit-to-dao` is called | Low (no funds at risk) | Keep DAO bridge optional; log errors; do not auto-submit |
| Public website shows stale addresses | Current state | Low (pages not live) | Update addresses to V31 canonical |
| Disbursement attempted through DAO | Not possible as-is | N/A | `execute_proposal` is summary-only; no L1 write capability |

---

## 12. Implementation Checklist (Recommended for 3.2.0)

### 12.1 Code fixes — L5 and L6

- [ ] `config.rs`:
  - `l1_rpc_url` → `http://127.0.0.1:9445/jsonrpc`
  - `fund_address` → canonical V31 address
  - `bind` → `127.0.0.1`
  - Add env override for fund address (`FREE_WORLD_HUMANITARIAN_ADDRESS` / `ISSOBELLA_FUND_ADDRESS`)
  - Add `dao_api_url` and `dao_api_key` to config (env `ZION_DAO_API_ADDR` / `ZION_DAO_API_KEY`)
- [ ] `l1_scanner.rs`:
  - Change `BlockInfo` to use `transactions` (with fallback to `utxo_transactions`)
  - Iterate all transactions and all outputs to find the fund address
  - Add unit tests
- [ ] `dao_client.rs`:
  - Default URL → `http://127.0.0.1:8456`
  - Path → `/api/dao/proposals`
  - Build payload matching `CreateProposalRequest` / `ProposalTypeDto`
  - Add env overrides for `proposer`, `proposer_balance`, `snapshot_block`
- [ ] `main.rs`:
  - Update docstrings / startup log to show correct RPC URL and default fund address
- [ ] `api.rs` (optional, post-3.2):
  - Add API-key middleware for write routes

### 12.2 Shared / deployment

- [ ] `V31/deploy/systemd/zion-v31-free-world.service`
- [ ] `V31/deploy/systemd/zion-v31-issobella.service`
- [ ] `V31/deploy/config/edge-environment.sh` — add L5/L6 env vars
- [ ] `ZION_OS/infra/scripts/backup-edge.sh` — add DB files
- [ ] `ZION_OS/dashboard/app.py` — mark services deployable
- [ ] `V31/cli/src/commands/free_world.rs` and `issobella.rs` — update messages
- [ ] `APP&WEB/website-v2.9/src/app/l5-free-world/page.tsx` and `l6-issobella/page.tsx` — update addresses
- [ ] `V31/STATUS.md` / `StatusV3.md` — record L5/L6 passive tracker status

### 12.3 Verification

```bash
cd V31
cargo check -p zion-free-world -p zion-issobella
cargo test -p zion-free-world -p zion-issobella
```

Then on Edge, run a short smoke test against `127.0.0.1:8095/health` and `127.0.0.1:8097/health` and verify `/api/v1/fund/balance` increases after the scanner catches up.

---

## 13. Go / No-Go for 3.2.0

**Go** for L5/L6 as passive fund trackers, provided the L1 scanner and configuration fixes are applied.

**No-go** for full DAO disbursement / public L5/L6 UI / physical community features until after 3.2.0.

---

## 14. Appendix A — Build Output

```text
$ cargo check -p zion-free-world -p zion-issobella
Finished `dev` profile [unoptimized + debuginfo] target(s) in 11.03s

$ cargo test -p zion-free-world -p zion-issobella
Finished `test` profile [unoptimized + debuginfo] target(s) in 19.06s
     Running tests/db.rs (zion-free-world)
running 3 tests
test test_fund_balance ... ok
test test_grant_lifecycle ... ok
test test_project_lifecycle ... ok

     Running tests/db.rs (zion-issobella)
running 3 tests
test test_fund_balance ... ok
test test_mission_lifecycle ... ok
test test_proposal_lifecycle ... ok
```

---

## 15. Appendix B — Key File References

- `V31/L1/core/src/v3_compat.rs:546-549` — canonical subsidy addresses
- `V31/L1/core/src/emission.rs:79-85` — fee split
- `V31/L1/core/src/node.rs:840-892` — V31 coinbase construction
- `V31/L1/core/src/rpc.rs:629-708` — `get_native_block` response shape
- `V31/L5/free-world/src/config.rs` / `V31/L6/issobella/src/config.rs` — service config
- `V31/L5/free-world/src/l1_scanner.rs:73-220` — L1 scanner
- `V31/L5/free-world/src/dao_client.rs` / `V31/L6/issobella/src/dao_client.rs` — DAO client
- `V31/L2/dao/src/api.rs:79-144` — DAO proposal request types
- `V31/L2/dao/src/runtime.rs:294-379` — DAO execute (summary-only)
- `V31/deploy/systemd/zion-v31-dao.service` — template for new L5/L6 systemd units
