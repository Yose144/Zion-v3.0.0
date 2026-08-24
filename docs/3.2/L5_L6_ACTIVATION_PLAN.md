# ZION L5 Free World / L6 Issobella — Activation Plan for 3.2.0

> **Scope:** Define the run mode, governance, canonical fund addresses, current V31 implementation state, and a concrete implementation plan for Layer 5 (Free World — humanitarian fund) and Layer 6 (Issobella — science/space fund).  
> **Status:** Implementation staged — code, tests, systemd units, nginx and dashboard integration prepared; Edge service start pending.  
> **Target version:** 3.2.0 "One Love" Mainnet Stable.  
> **Decision:** Enable L5/L6 **as long-term, read-only fund trackers with a DAO proposal bridge**, treat them as a **vision project**, and **do not block 3.2.0** on full disbursement / DAO UI.  
> **Canonical source of truth:** This document is the decision record for gate **G10** in [`ROADMAP.md`](./ROADMAP.md).

---

## 1. Executive Summary

L5 Free World and L6 Issobella are the humanitarian and science/space layers of the ZION stack. They are funded by a protocol-level 5 % + 5 % block-reward tithe, hard-coded in L1 emission and paid to two canonical on-chain addresses. The purpose of the layers is:

- **L5 Free World** — transparent accumulation and governance of the humanitarian tithe for grants, community projects, education, free-energy research, and physical L5 communities (Genesis Garden, Dharma Temple, Te Pīko Ora).
- **L6 Issobella** — transparent accumulation and governance of the science/space tithe for orbital research, satellite mesh, SETI, and long-horizon space missions.

For 3.2.0 the layers will be **activated in a limited, safe mode**: the daemons will run, scan L1 coinbase, and expose fund balance and proposal APIs, but **no automatic disbursement** will take place. Funds keep accumulating on-chain; any spend must go through the DAO governance path (proposals, voting, timelock, and a guardian multi-sig) and currently **requires the missing DAO UI/UX**. Therefore L5/L6 are **enabled as a public, auditable, read-only foundation** and are explicitly **not a 3.2.0 launch blocker**.

---

## 2. Vision and Purpose

### 2.1 Layer 5 — Free World (Humanitarian)

Source: `archive/V3/L5/docs/README.md` and `archive/V3/L5/docs/ARCHITECTURE/l5-system-design.md`.

- **Core idea:** "Freedom is not given — it is built, block by block."
- **L5 Trinity of physical communities:**
  - **Genesis Garden** (Earth / Root) — base camp, agriculture, entry point.
  - **Dharma Temple** (Fire / Trunk) — sanctuary, meditation, transformation.
  - **Te Pīko Ora** (Water / Crown) — fruition, abundance, marine permaculture.
- **Shared protocols:** Guardian Node, Seed Library, Medical Table, LoRa/Meshtastic mesh, Sociocratic DAO, Consciousness Admission, Resonance Protocol.
- **Revenue model:**
  - Network block reward: 89 % miner, 5 % humanitarian, 5 % Issobella, 1 % pool-fee/node-reward slot.
  - Local Guardian Node: 90 % operator, 10 % community treasury.
  - Community treasury: 40 % ops, 25 % infrastructure, 20 % reserve, 10 % humanitarian tithe, 5 % education.

### 2.2 Layer 6 — Issobella (Science / Space)

Source: `archive/V3/L6/issobella/docs/README.md`, `STANICE_ISSOBELLA.md`, `FINANCOVANI.md`, `CASOVA_OSA.md`.

- **Core idea:** "The star is not the destination — it is the beginning."
- **Long-term target:** LEO orbital station (400–550 km), launch program starting **2040+**.
- **Near-term deliverables:** CubeSat prototype, ZION Space Node (radiation-hardened FPGA), satellite mesh/ISL, climate/SETI observation data.
- **Funding sources:** 5 % block reward, DAO grants, tail emission (2126+), L4 OASIS NFT sales, partnerships.
- **Governance:** 2-of-3 Issobella Steward multisig + scientific advisory board + DAO vote; emergency veto for projects harming children.
- **Allocation vision:** 60 % of the humanitarian/space fund directed to education, health, food security, technology (per `FINANCOVANI.md`).

### 2.3 Cross-Layer Governance Model

Source: `archive/V3/L5/docs/GOVERNANCE/multi-layer-dao-governance.md`.

- **Co-Admin federation:** no single address controls any layer.
- **L2 DAO** treasury/treasury guardians (5-of-7 default) ratify spending.
- **L5/L6** each have layer-specific councils/stewards with multi-sig.
- **Proposal lifecycle:** Draft → Review → Vote (token/consent) → Timelock (48 h min, 7 d L4/L5, 30 d L6) → Execute.
- **Cross-layer veto:** an affected layer can veto a cross-layer proposal; override requires supermajority/mediation.

### 2.4 Consciousness / Resonance Protocols

Source: `archive/V3/L5/docs/GOVERNANCE/consciousness-admission-framework.md`, `archive/V3/L5/docs/GOVERNANCE/sefirot-vow.md`, `archive/V3/L5/docs/PROTOCOLS/resonance-protocol.md`.

- **Consciousness Verification** (4 gates: written mirror, living circle, probationary stay, consent of the circle) for L5 community entry.
- **Bodhisattva Vow** for Guardians.
- **Resonance Protocol:** sound/frequency attunement, Fibonacci Time Capsules, Youth–Elder Bridge, Light Language Registry.
- **Status:** ceremonial/vision components. Technical hooks (NFT seals, hashes) are post-3.2.

---

## 3. Canonical Fund Addresses and Fee Split

### 3.1 Canonical V31 Subsidy Addresses

These addresses are hard-coded in `V31/L1/core/src/v3_compat.rs` and confirmed by the genesis reset playbook, dashboard, and website constants:

| Role | Address | Source |
|------|---------|--------|
| Miner (89 %) | `zion1074344t7k686j6n8a0l6t0f4c8d828y083xh4m2` | `V31/L1/core/src/v3_compat.rs` |
| **Humanitarian / L5 (5 %)** | `zion1y3w4z0c755v4y7t3f0k6s54390x0h3k3y5hv8c8` | `V31/L1/core/src/v3_compat.rs`, `docs/PREMINE_ADDRESSES_PUBLIC.txt` |
| **Issobella / L6 (5 %)** | `zion1z4s3a54266f2x7j4x7c27297k49752t7k52l0f0` | `V31/L1/core/src/v3_compat.rs`, `docs/PREMINE_ADDRESSES_PUBLIC.txt` |
| Pool fee / node reward (1 %) | `zion1l0h428f536s6u3x7h5f0d5c2z644j7t8u8va3x0` | `V31/L1/core/src/v3_compat.rs` |

> Note: `archive/V3/L6/issobella/docs/README.md` and the public Next.js pages `APP&WEB/website-v2.9/src/app/l5-free-world/page.tsx` / `l6-issobella/page.tsx` currently contain **stale V3 placeholder addresses** and must be updated to the V31 canonical addresses above.

### 3.2 Fee Split

Source: `V31/L1/core/src/emission.rs`, `V31/L1/core/src/v3_template.rs`.

```text
Block subsidy (currently ~5 400.067 ZION)
├── 89 % → miner
├── 5 %  → humanitarian fund address (L5)
├── 5 %  → Issobella fund address (L6)
└── 1 %  → pool-fee slot
           - pre node-reward activation: burned
           - post node-reward activation: minted to node reward pool
```

The L1 coinbase is built as up to 4 separate transactions in this order:

0. `coinbase` → miner
1. `coinbase_humanitarian` → L5 fund
2. `coinbase_issobella` → L6 fund
3. `coinbase_node_reward` → node reward pool (only after activation height)

This is visible in `V31/L1/core/src/v3_template.rs` and returned by `getBlockByHeight` as `transactions[].outputs`.

---

## 4. Current V31 Implementation Inventory

The L5/L6 code was copied from `archive/V3/` to `V31/L5/free-world` and `V31/L6/issobella` as-is. It compiles and has unit tests, but is **not wired for V31 production**.

### 4.1 Crates

| Crate | Path | Binary | State |
|-------|------|--------|-------|
| `zion-free-world` | `V31/L5/free-world` | `zion-free-world` | Builds and unit tests pass; deployment artifacts staged |
| `zion-issobella` | `V31/L6/issobella` | `zion-issobella` | Builds and unit tests pass; deployment artifacts staged |

Both are listed in `V31/Cargo.toml` workspace members.

### 4.2 Configuration

Source: `V31/L5/free-world/src/config.rs`, `V31/L6/issobella/src/config.rs`.

| Field | L5 Default | L6 Default |
|-------|-----------|-----------|
| `name` | `zion-free-world` | `zion-issobella` |
| `bind` | `0.0.0.0` | `0.0.0.0` |
| `port` | `8095` | `8096` |
| `db_path` | `./free_world.db` | `./issobella.db` |
| `l1_rpc_url` | `http://127.0.0.1:9443/jsonrpc` | `http://127.0.0.1:9443/jsonrpc` |
| `scan_interval_secs` | `60` | `60` |
| `fund_address` (placeholder) | `zion1humanitarian0000000000000000000000` | `zion1issobella000000000000000000000000` |
| `min_*_amount_zion` | 1 000 | 10 000 |
| `max_*_amount_zion` | 10 000 000 | 100 000 000 |
| `hiran_endpoint` | `http://localhost:8002` | `http://localhost:8002` |
| `hiran_enabled` | `false` | `false` |

Environment overrides already supported: `*_PORT`, `*_BIND`, `*_DB`, `*_L1_RPC`, `*_API_KEY`, `*_HIRAN_URL`, `*_HIRAN_ENABLED`.  
**Missing env overrides:** `FREE_WORLD_HUMANITARIAN_ADDRESS`, `ISSOBELLA_FUND_ADDRESS`, `*_MIN_*`, `*_MAX_*`.

### 4.3 API Endpoints

Source: `V31/L5/free-world/src/api.rs`, `V31/L6/issobella/src/api.rs`.

**L5 Free World** — `http://0.0.0.0:8095`
- `GET  /health`
- `GET  /metrics`
- `GET  /api/v1/grants`
- `POST /api/v1/grants`
- `POST /api/v1/grants/:id/approve`
- `POST /api/v1/grants/:id/submit-to-dao`
- `GET  /api/v1/projects`
- `POST /api/v1/projects`
- `GET  /api/v1/fund/balance`
- `POST /ai/analyze-grant`
- `POST /ai/suggest-projects`

**L6 Issobella** — `http://0.0.0.0:8096`
- `GET  /health`
- `GET  /metrics`
- `GET  /api/v1/missions`
- `POST /api/v1/missions`
- `POST /api/v1/missions/:id/launch`
- `POST /api/v1/missions/:id/submit-to-dao`
- `GET  /api/v1/proposals`
- `POST /api/v1/proposals`
- `GET  /api/v1/fund/balance`
- `POST /api/v1/ai/evaluate-mission`
- `POST /api/v1/ai/analyze-proposal`
- `GET  /api/v1/ai/hiran-health`

API-key auth is loaded from env but **not enforced** on the router (the `api_key` field is stored in `AppState` but not checked).

### 4.4 Database Schema

- **L5:** `grants`, `projects`, `communities`, `fund_balance`.
- **L6:** `missions`, `observations`, `research_proposals`, `fund_balance`.

Both use `rusqlite`. Tests exist in `V31/L5/free-world/tests/db.rs` and `V31/L6/issobella/tests/db.rs`.

### 4.5 L1 Scanner

Source: `V31/L5/free-world/src/l1_scanner.rs`, `V31/L6/issobella/src/l1_scanner.rs`.

- Connects via raw TCP JSON-RPC to the configured `l1_rpc_url`.
- Calls `getChainInfo` for tip and `getBlockByHeight` with `{"height": N}`.
- Expects a top-level field `utxo_transactions` and only inspects the **first** transaction.

**Problem:** V31 native blocks returned by `getBlockByHeight` use the field name `transactions` (not `utxo_transactions`) and the fee-split coinbase is split into up to 4 transactions, so a single `first()` check will miss the humanitarian and issobella outputs.

### 4.6 DAO Client

Source: `V31/L5/free-world/src/dao_client.rs`, `V31/L6/issobella/src/dao_client.rs`.

- Default URL: `http://127.0.0.1:8080` (the **pool** port, not the DAO port).
- Sends `POST /api/v1/proposals`.
- Uses header `x-api-key`.
- Payload: `{ title, description, amount_zion, recipient_address, proposal_type: "treasury" }`.

**Problem:** The V31 DAO runs on `127.0.0.1:8456` (and is proxied via nginx `/api/dao`). The actual endpoint is `POST /api/dao/proposals`, the header is `X-DAO-Key`, and the request body must match `V31/L2/dao/src/api.rs::CreateProposalRequest` (`proposer`, `proposer_balance`, `snapshot_block`, and a `proposal_type` `{ "kind": "Treasury", "data": { ... } }` enum shape).

### 4.7 Hiran AI Bridge

Source: `V31/L5/free-world/src/hiran_bridge.rs`, `V31/L6/issobella/src/hiran_bridge.rs`.

- Optional integration to `http://localhost:8002/v1/chat/completions`.
- Defaults to **disabled**.
- **No `hiran` service is currently deployed on Edge.** Should remain disabled for 3.2.0.

### 4.8 Metrics

Both crates expose Prometheus-style text on `/metrics` using simple atomic counters. Metrics include blocks scanned, pending grants/missions, fund totals, etc. These can be scraped by the existing Edge Prometheus/Grafana stack.

### 4.9 CLI

Source: `V31/cli/src/commands/free_world.rs`, `V31/cli/src/commands/issobella.rs`, `V31/cli/src/main.rs`.

- CLI subcommands `zion free-world` and `zion issobella` exist as **stubs**.
- They print a warning that the layer is "not yet available in V31".

### 4.10 Deployment Artifacts

- ✅ **Systemd service files** `V31/deploy/systemd/zion-v31-free-world.service` and `V31/deploy/systemd/zion-v31-issobella.service` created; run as `zion` user, bind `127.0.0.1:8095` and `:8096`.
- ✅ **Edge environment variables** for L5/L6 added to `V31/deploy/config/edge-environment.sh` (`FREE_WORLD_*`, `ISSOBELLA_*`, DAO API/key vars).
- ✅ **Nginx routes** `/api/free-world/` and `/api/issobella/` added to `V31/deploy/nginx/zion-nginx.conf` (operator-only).
- ✅ Dashboard `ZION_OS/dashboard/app.py` has `free-world` and `issobella` service registry entries (ports 8095/8096); public `MissionControlDashboard` also updated. Edge service start is pending.

---

## 5. Gaps, Blockers and Risk Items

| # | Gap / Blocker | Severity | Evidence |
|---|---------------|----------|----------|
| 1 | **Wrong L1 RPC port/URL** — default `9443`/`8443` instead of V31 `9445`. | Critical for function | `V31/L5/free-world/src/config.rs:28`, `V31/L6/issobella/src/config.rs:28` |
| 2 | **Wrong block field name** — scanner expects `utxo_transactions`; V31 returns `transactions`. | Critical for function | `V31/L5/free-world/src/l1_scanner.rs:98`, `V31/L1/core/src/rpc.rs:679` |
| 3 | **Scanner only checks first tx** — misses separate `coinbase_humanitarian` / `coinbase_issobella` txs. | Critical for function | `V31/L5/free-world/src/l1_scanner.rs:98`, `V31/L1/core/src/v3_template.rs:139-155` |
| 4 | **Placeholder fund addresses in config** — not linked to canonical V31 addresses. | Critical for function | `V31/L5/free-world/src/config.rs:31`, `V31/L6/issobella/src/config.rs:31` |
| 5 | **Env overrides for fund addresses / bind / port / RPC / DAO** are now supported in both crates. | Medium | `V31/L5/free-world/src/config.rs`, `V31/L6/issobella/src/config.rs` |
| 6 | **DAO client** now uses `ZION_DAO_API_ADDR`, `X-DAO-Key` header and `/v1/proposals` path. | Critical for governance integration | `V31/L5/free-world/src/dao_client.rs`, `V31/L6/issobella/src/dao_client.rs` |
| 7 | **No DAO UI** for creating/voting/executing L5/L6 proposals. | Blocker on disbursement | `V31/L2/dao` has HTTP API but no front-end; dashboard `J4` not started in `ROADMAP.md` |
| 8 | **DAO execution is summary-only** — it does not build or broadcast a payout transaction. | Critical for disbursement | `V31/L2/dao/src/runtime.rs:294-364` |
| 9 | **Systemd / env / nginx / backup config prepared** for L5/L6; Edge start pending. | Production deployment staged | `V31/deploy/systemd/`, `V31/deploy/config/edge-environment.sh`, `V31/deploy/nginx/zion-nginx.conf` |
| 10 | **CLI subcommands** `zion free-world` and `zion issobella` are wired for `start/status/stop` (systemd passthrough). | Medium | `V31/cli/src/commands/free_world.rs`, `issobella.rs` |
| 11 | **Public website pages** `l5-free-world` and `l6-issobella` updated to canonical V31 fund addresses. | Medium | `APP&WEB/website-v2.9/src/app/l5-free-world/page.tsx`, `l6-issobella/page.tsx` |
| 12 | **No Hiran service** — AI bridge endpoints would fail if enabled. | Low | `hiran` not in Edge service list |
| 13 | **Resonance / consciousness / L5 physical community features** are vision-only and not implemented. | Out of 3.2.0 scope | `archive/V3/L5/docs/PROTOCOLS/resonance-protocol.md` |

---

## 6. Decision for 3.2.0 (G10)

### 6.1 Run Mode

**Enable L5/L6 as "passive fund trackers + DAO proposal bridge" for 3.2.0**, with the following constraints:

1. **Read-only accumulation.** The daemons scan L1 coinbase, update local fund balance, and expose `/api/v1/fund/balance` and `/metrics`.
2. **No automatic disbursement.** No L1 transaction is signed or sent by L5/L6 services. Spend is governance-gated and currently requires the missing DAO UI/execution flow.
3. **Proposal bridge only.** `submit-to-dao` endpoints may forward a grant/mission to the DAO as a draft proposal, but the proposal still requires a full DAO vote, timelock, and guardian multi-sig.
4. **No Hiran, no physical community, no space hardware integration.** Those remain post-3.2 vision work.
5. **Not a 3.2.0 blocker.** If the minimal deployment cannot be completed in time, the layer can remain disabled and this document serves as the explicit deferral record.

### 6.2 Why This Is Safe

- L1 already sends 5 % + 5 % to canonical addresses on every block regardless of whether L5/L6 services are running.
- No L1 write capability is required for passive tracking.
- Funds cannot be moved without the DAO multi-sig and timelock, so a buggy L5/L6 service cannot drain the treasury.
- The public and dashboard can display fund balances and statuses even if governance disbursement is not yet active.

### 6.3 Canonical Addresses Are in Genesis

The humanitarian and Issobella addresses are:
- part of the L1 emission/fee split (hard-coded in `v3_compat.rs`);
- configured as coinbase recipients in `zion node start` (`--human`, `--issobella` defaults in `V31/cli/src/main.rs`);
- reflected in `docs/PREMINE_ADDRESSES_PUBLIC.txt`, `ZION_OS/dashboard/app.py`, and `HARD_RESET_PLAYBOOK.md`.

This satisfies the requirement that canonical addresses are anchored in genesis and the node software.

---

## 7. Implementation Plan

### 7.1 Phase 0 — Immediate (Pre-3.2.0, no code changes)

- [x] Create and commit this plan (`docs/3.2/L5_L6_ACTIVATION_PLAN.md`).
- [ ] Update `docs/3.2/ROADMAP.md` G10 and E9 to record the decision.
- [ ] Update `StatusV3.md` and `V31/STATUS.md` with L5/L6 run-mode decision.

### 7.2 Phase 1 — Minimal V31 Fix (Optional for 3.2.0, can be post-3.2)

Goal: make `zion-free-world` and `zion-issobella` compile, run, and correctly track fund balances on Edge.

#### 7.2.1 Code fixes in `V31/L5/free-world` and `V31/L6/issobella`

1. **Config defaults**
   - `l1_rpc_url` → `http://127.0.0.1:9445/jsonrpc` (V31 node RPC).
   - `humanitarian_fund_address` → `zion1y3w4z0c755v4y7t3f0k6s54390x0h3k3y5hv8c8`.
   - `issobella_fund_address` → `zion1z4s3a54266f2x7j4x7c27297k49752t7k52l0f0`.
   - Add env overrides: `FREE_WORLD_HUMANITARIAN_ADDRESS`, `ISSOBELLA_FUND_ADDRESS`.
   - Optionally add `*_MIN_*` / `*_MAX_*` env overrides.

2. **L1 scanner fix**
   - Change `get_block` response parsing from `utxo_transactions` to `transactions`.
   - Iterate all `transactions` and inspect all `outputs`, matching `output.address == fund_address`.
   - Ensure the first coinbase transaction is not the only one checked.

3. **DAO client fix**
   - Default `ZION_DAO_API_ADDR` → `http://127.0.0.1:8456`.
   - Endpoint → `POST /api/dao/proposals`.
   - Header → `X-DAO-Key`.
   - Build `CreateProposalRequest` matching `V31/L2/dao/src/api.rs`:
     - `title`, `description`, `proposer`, `proposer_balance`, `snapshot_block`.
     - `proposal_type` as externally tagged enum (`{ "kind": "Treasury" | "Grant" | "Humanitarian", "data": { ... } }`).
   - Add env override `ZION_DAO_API_ADDR` to config.

4. **API key middleware (optional, post-3.2)**
   - The `api_key` is loaded but not enforced. For 3.2.0 passive mode, leaving it open on `127.0.0.1` is acceptable if bound to localhost-only by systemd. Enforce `Authorization: Bearer` or `X-API-Key` later.

#### 7.2.2 Edge deployment artifacts

1. **Systemd units**
   - `V31/deploy/systemd/zion-v31-free-world.service`
   - `V31/deploy/systemd/zion-v31-issobella.service`
   - User `zion`, group `zion`, `Restart=always`, `EnvironmentFile=/etc/zion/edge-environment.sh`.

2. **Environment variables in `/etc/zion/edge-environment.sh`**
   - `FREE_WORLD_L1_RPC=http://127.0.0.1:9445/jsonrpc`
   - `FREE_WORLD_DB=/opt/zion/data/v31/free-world.db`
   - `FREE_WORLD_HUMANITARIAN_ADDRESS=zion1y3w4z0c755v4y7t3f0k6s54390x0h3k3y5hv8c8`
   - `FREE_WORLD_PORT=8095`
   - `FREE_WORLD_BIND=127.0.0.1`
   - `ISSOBELLA_L1_RPC=http://127.0.0.1:9445/jsonrpc`
   - `ISSOBELLA_DB=/opt/zion/data/v31/issobella.db`
   - `ISSOBELLA_FUND_ADDRESS=zion1z4s3a54266f2x7j4x7c27297k49752t7k52l0f0`
   - `ISSOBELLA_PORT=8096`
   - `ISSOBELLA_BIND=127.0.0.1`
   - `ZION_DAO_API_ADDR=http://127.0.0.1:8456`

3. **Nginx**
   - Add `/api/free-world` → `127.0.0.1:8095`.
   - Add `/api/issobella` → `127.0.0.1:8096`.
   - Apply Basic Auth or operator IP allowlist (consistent with dashboard).

4. **Backup script**
   - Add `/opt/zion/data/v31/free-world.db` and `/opt/zion/data/v31/issobella.db` to `ZION_OS/infra/scripts/backup-edge.sh`.

5. **Dashboard**
   - Update service registry in `ZION_OS/dashboard/app.py` to mark `free-world` and `issobella` as deployable.
   - Add health endpoints `/health` to dashboard polling.

#### 7.2.3 Build and test

```bash
cargo build --release -p zion-free-world
cargo build --release -p zion-issobella
cargo test -p zion-free-world
cargo test -p zion-issobella
```

Run locally against a local node and verify:
- `GET /api/v1/fund/balance` returns non-zero accumulated amount after a few blocks.
- Prometheus metrics at `/metrics` increment `*_blocks_scanned` and `*_total_accumulated_zion`.
- Creating a grant/mission and calling `submit-to-dao` returns a DAO proposal ID (requires DAO API key).

### 7.3 Phase 2 — Full Governance / UI (Post-3.2)

- Implement DAO UI for L5/L6 proposal creation, voting, tally, execute (roadmap items J4 / J7).
- Wire DAO `execute_proposal` to build, sign, and broadcast a real L1 payout transaction using the DAO treasury or L5/L6 fund keys.
- Implement 3-of-5 (or configured `multisig_threshold`) guardian multi-sig flow.
- Implement CLI `zion free-world start|status` and `zion issobella start|status`.
- Update public website pages to canonical addresses and live fund balance.
- Add Hiran AI integration when `hiran` service is deployed.
- Port L5 docs from `archive/V3/L5/docs` to `V31/L5/docs` or `docs/3.2/`.
- Implement Resonance Protocol / Consciousness Registry hooks as future cultural/technical layers.

---

## 8. Acceptance Criteria for 3.2.0 Run Mode

| # | Criterion | How to Verify |
|---|-----------|---------------|
| A1 | L1 coinbase pays 5 % to canonical humanitarian address and 5 % to canonical Issobella address on every block. | `getBlockByHeight` shows outputs `zion1y3w4z...` and `zion1z4s3a...`. |
| A2 | `zion-free-world` and `zion-issobella` compile and pass unit tests. | `cargo test -p zion-free-world`, `cargo test -p zion-issobella`. |
| A3 | When deployed, daemons start without crashing and health endpoint returns 200. | `curl -s http://127.0.0.1:8095/health` and `...:8096/health`. |
| A4 | Fund balance API and Prometheus metrics reflect L1 accumulation. | Compare `/api/v1/fund/balance` and `/metrics` with on-chain balance. |
| A5 | No automatic L1 spend or disbursement is performed by the service. | Code audit: no `submitUtxoTransaction` / `build_and_sign` calls in L5/L6. |
| A6 | DAO proposal bridge (optional for 3.2.0) submits a proposal with correct payload. | Manual `POST .../submit-to-dao` and verify `proposal_id` returned by DAO. |
| A7 | Systemd, env, nginx, and backup are configured or explicitly documented as post-3.2. | Check `V31/deploy/systemd/` and `ZION_OS/infra/scripts/backup-edge.sh`. |
| A8 | Website canonical addresses are updated OR documented as post-3.2. | `APP&WEB/website-v2.9/src/app/l5-free-world/page.tsx` and `l6-issobella/page.tsx`. |

---

## 9. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Deploying L5/L6 with wrong fund addresses causes them to track a wrong/empty balance. | High | Fix defaults to canonical addresses and read from env; add integration test. |
| Scanner fails silently and shows zero balance. | Medium | Fix `utxo_transactions` → `transactions` and iterate all txs; add metrics alert if `blocks_scanned` grows but `total_accumulated` stays 0. |
| DAO client submits malformed proposals. | Low for 3.2.0 (no spend) | Disable `submit-to-dao` on public routes until DAO client is fixed and tested. |
| API key not enforced, service bound to 0.0.0.0. | Medium | Bind to `127.0.0.1` in systemd/nginx; enforce API key in Phase 2. |
| Public website shows stale addresses. | Reputational | Update the two Next.js pages or add a "Coming Soon / vision" notice for 3.2.0. |
| L5/L6 perceived as non-functional because no disbursement. | Communications | Use this document and public docs to set expectations: 3.2.0 is "accumulation + governance foundation"; full spend is post-3.2. |

---

## 10. Open Questions

1. **DAO UI timeline:** Will a minimal DAO voting/execution UI be built for 3.2.0, or is it firmly post-3.2? If a minimal UI is built, `submit-to-dao` becomes useful immediately.
2. **Multi-sig threshold:** DAO default is 5-of-7; `STANICE_ISSOBELLA.md` references a 3-of-5 humanitarian wallet. What is the operational target for the 3.2.0 run mode?
3. **Fund split between L5 and L6:** Currently 5 % each. Should a 60/40 or 50/50 split inside the combined 10 % be configurable? (The 5/5 protocol split is hard-coded in L1; internal allocation is governance.)
4. **Hiran service:** Is there a concrete `hiran` deployment plan, or should the AI bridge be removed/deprecated for 3.2.0?
5. **Resonance / physical community registry:** Which parts are required for 3.2.0 public narrative, and which are purely post-3.2?
6. **Node reward activation height:** Does the 1 % slot being minted to `zion1l0h428...` affect how L5/L6 scanners interpret the coinbase? It adds a 4th coinbase transaction; the scanner must handle it.

---

## 11. Related Documents and References

- `docs/3.2/ROADMAP.md` — G10, E9, Phase J.
- `V31/PLAN_TO_3.2.md` — L5/L6 migration notes.
- `StatusV3.md` / `V31/STATUS.md` — live Edge service topology.
- `docs/PREMINE_ADDRESSES_PUBLIC.txt` — canonical V31 addresses.
- `V31/L1/core/src/v3_compat.rs` — canonical address constants.
- `V31/L1/core/src/emission.rs` and `v3_template.rs` — fee split and coinbase construction.
- `V31/L5/free-world/src/` and `V31/L6/issobella/src/` — current crate implementations.
- `V31/L2/dao/src/api.rs` and `runtime.rs` — DAO proposal API and execution model.
- `archive/V3/L5/docs/` and `archive/V3/L6/issobella/docs/` — historical vision and governance docs.
- `APP&WEB/website-v2.9/src/app/l5-free-world/page.tsx` and `l6-issobella/page.tsx` — public web pages.
- `HARD_RESET_PLAYBOOK.md` — address rotation checklist.

---

## 12. Decision Record

**G10 — L5/L6 activation decision for 3.2.0**

- **Decision:** Activate L5 Free World and L6 Issobella **in passive, read-only fund-tracking mode** for 3.2.0.
- **Canonical fund addresses:** anchored in genesis and L1 code.
- **Governance:** DAO-controlled, multi-sig gated; no automatic spend in 3.2.0.
- **Scope for 3.2.0:** accumulation, metrics, health, optional DAO proposal bridge.
- **Out of 3.2.0 scope:** disbursement, DAO UI, Hiran AI, physical community registry, Resonance Protocol, space hardware.
- **Blocker status:** L5/L6 are **not a 3.2.0 launch blocker**. If the minimal deployment cannot be completed in time, the explicit post-3.2 deferral is documented here.

---

*Generated for the ZION 3.2.0 "One Love" Mainnet Stable roadmap. This plan is the decision record for gate G10 and the implementation backlog for L5/L6.*