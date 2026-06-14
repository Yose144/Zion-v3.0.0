# ZION L2 Big Upgrade — Master Plan

> **Goal:** Make all L2 components production-ready: Bridge, DAO, Atomic Swap, Swap Aggregator.  
> **Target:** v3.0.1 — robust, UI-integrated, CLI-accessible, testnet-validated.  
> **Status:** In Progress  
> **Last Updated:** 2026-06-14

---

## 1. Bridge (Cross-Chain L1 ↔ EVM)

### Current State
- Smart contracts: `ZIONBridge.sol` + `wZION.sol` — solid, OpenZeppelin-based
- Rust relayer: watches L1 locks, submits EVM proofs, handles burns
- Validator: 3-of-5 or 5-of-5 multisig consensus tracker
- Config: `bridge-mainnet.toml` exists but has **testnet contract addresses mixed with mainnet chain_id**

### Critical Issues Found
1. **Address mismatch:** `0xF4BF8544...` (Sepolia) vs `0xa5a09b2C...` (unknown) in different files
2. **Network confusion:** `bridge-mainnet.toml` says `chain_id = 8453` (mainnet) but uses Sepolia contract addresses
3. **Placeholder validators:** 5x `0x000000000000000000000000000000000000000N` — need real addresses
4. **Missing UI integration:** Desktop agent has no bridge tab; website has bridge page but testnet-only
5. **Missing CLI:** `zion-cli` has no `bridge` subcommands

### Implementation Tasks
- [ ] Resolve mainnet vs testnet config (separate files, clear labels)
- [ ] Update validator addresses to real 5-of-5 set (or 3-of-5 if preferred)
- [ ] Add `zion-cli bridge` commands: `status`, `lock`, `burn`, `validators`
- [ ] Add desktop agent bridge IPC handlers + UI tab
- [ ] Add website bridge mainnet config + network switcher
- [ ] Add bridge metrics to dashboard
- [ ] Write integration tests for full lock→mint→burn→unlock flow

---

## 2. DAO (Governance Layer)

### Current State
- Rust crate with: proposals, voting, treasury, timelock, quorum, co-admin
- HTTP API (Axum): `/api/dao/health`, `/proposals`, `/votes`, `/treasury`
- Token-weighted voting: 1 ZION = 1 vote
- Treasury: 5-of-7 multisig

### Critical Issues Found
1. **No CLI commands:** `zion-cli` has stub `dao` commands but they're empty/no-ops
2. **Desktop agent:** No DAO tab at all
3. **Website:** Has `/dao` page but it's static/dummy data
4. **No L1 integration:** Voting via TX memo (`DAO:vote:42`) not wired to API
5. **Missing real proposals:** All test data

### Implementation Tasks
- [ ] Implement `zion-cli dao` commands: `proposals`, `vote`, `treasury`, `params`
- [ ] Wire L1 TX memo scanner to DAO API (real vote ingestion)
- [ ] Add desktop agent DAO tab (proposals list, vote button, treasury view)
- [ ] Make website `/dao` page dynamic (fetch from API)
- [ ] Add proposal creation flow (threshold check, memo format)
- [ ] Add DAO metrics to dashboard

---

## 3. Atomic Swap (HTLC Cross-Chain)

### Current State
- Rust daemon with HTLC types, memo parser, SQLite DB, L1 watcher
- Memo protocol: `SWAP:LOCK:<hash>:<timeout>:<chain>:<addr>`
- Has EVM watcher stub

### Critical Issues Found
1. **Placeholder executor:** No real L1 TX signing for release/refund
2. **No EVM integration:** `evm_watcher.rs` is mostly empty
3. **No UI anywhere:** Website, desktop, mobile — no swap interface
4. **No CLI:** Not exposed in `zion-cli`
5. **Test-only:** All flows use `tokio::time::sleep()` instead of real blockchain calls

### Implementation Tasks
- [ ] Implement real L1 executor (sign + submit release/refund TX)
- [ ] Implement EVM HTLC watcher (watch for `Locked`/`Claimed` events)
- [ ] Add `zion-cli swap` commands: `create`, `claim`, `refund`, `status`
- [ ] Add desktop agent swap tab (create swap, monitor status)
- [ ] Add website swap widget (minimal: create + track)
- [ ] Add swap metrics to dashboard

---

## 4. Swap Aggregator (DeFi Routing)

### Current State
- Rust crate with: quote API, orchestrator, SQLite DB
- Default config points to real Base Mainnet Uni V3 addresses
- Orchestrator has `process_swap()` with 3 steps: lock → bridge → swap

### Critical Issues Found
1. **Completely placeholder:** Every step is `tokio::time::sleep(2s)` + fake TX hash
2. **No EVM RPC calls:** Doesn't actually call Uni V3 Quoter or Router
3. **No bridge integration:** Doesn't call bridge API for lock/mint
4. **No UI:** Website swap widget exists but is disconnected from aggregator
5. **No CLI:** Not exposed

### Implementation Tasks
- [ ] Implement real Uni V3 QuoterV2 calls (get price quotes)
- [ ] Implement real bridge API integration (lock + wait for mint)
- [ ] Implement real Uni V3 Router swap execution
- [ ] Add `zion-cli swap` aggregate command: `quote`, `execute`
- [ ] Wire website SwapWidget to aggregator API
- [ ] Add desktop agent DeFi tab integration

---

## 5. Cross-Cutting Concerns

### CLI Integration (zion-cli)
All L2 components must have CLI commands:
```
zion bridge status
zion bridge lock <amount> <recipient>
zion bridge burn <amount> <recipient>
zion bridge validators

zion dao proposals
zion dao vote <id> <yes|no>
ion dao treasury

zion swap create <amount> <target_chain> <recipient>
zion swap claim <hash> <preimage>
zion swap status <id>

zion swap-aggregate quote <from> <to> <amount>
zion swap-aggregate execute <quote_id>
```

### Desktop Agent Integration
Each L2 component gets a tab or section:
- **Bridge:** Lock ZION → mint wZION, Burn wZION → unlock ZION
- **DAO:** Active proposals, vote with wallet, treasury stats
- **Swap:** Create HTLC swap, track status
- **DeFi:** Swap aggregator quote + execute

### Website Integration
- `/bridge` — mainnet-ready with network switcher
- `/dao` — dynamic proposal list, voting interface
- `/swap` — atomic swap create + track
- `/defi` — swap aggregator + staking

### Dashboard Integration
- Bridge status panel (locks, burns, validator signatures)
- DAO panel (active proposals, vote counts)
- Swap panel (pending swaps, HTLC status)
- DeFi panel (aggregator quotes, volume)

---

## 6. Testing Strategy

### Unit Tests
- [ ] Bridge validator consensus (all threshold combinations)
- [ ] DAO vote counting + quorum calculation
- [ ] Atomic swap HTLC validation (hash, timeout, refund)
- [ ] Swap aggregator quote math

### Integration Tests
- [ ] Bridge: L1 lock → EVM mint (mock both chains)
- [ ] DAO: Create proposal → vote → execute timelock
- [ ] Swap: Create HTLC → claim with preimage → verify balance
- [ ] Aggregator: Quote → execute → verify output

### E2E Tests
- [ ] Full user journey: mine ZION → bridge to Base → swap on Uni V3
- [ ] Reverse: Buy wZION on DEX → bridge to L1 → spend

---

## 7. Deployment Checklist

### Pre-Deploy
- [ ] All contract addresses finalized (mainnet)
- [ ] All 5 validator keys provisioned
- [ ] Bridge config: mainnet + testnet separate, no confusion
- [ ] DAO API key secured
- [ ] Atomic swap escrow address funded

### Deploy
- [ ] Bridge relayer Docker image
- [ ] DAO API server
- [ ] Atomic swap daemon
- [ ] Swap aggregator API

### Post-Deploy
- [ ] Smoke test: L1 lock → mint → burn → unlock
- [ ] DAO: Create test proposal, vote, verify
- [ ] Monitor: all 4 Prometheus endpoints healthy

---

## 8. Progress Tracker

| Component | Backend | CLI | Desktop | Web | Dashboard | Tests |
|-----------|---------|-----|---------|-----|-----------|-------|
| Bridge | ✅ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |
| DAO | ✅ API | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |
| Atomic Swap | 🟡 Stubs | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |
| Swap Aggregator | 🟡 Stubs | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |

**Legend:** ✅ Done 🟡 Partial ⏳ Not Started

---

*Generated with Devin. This is a living document — update as work progresses.*
