# 🗺️ ZION — MAINNET ROADMAP

**Tech → MainNet → Adoption**

---

## 📊 Current Status

| Metric | Value |
|--------|-------|
| **Native Stack Completion** | ~65-70% |
| **Status Date** | 2026-02-03 |
| **Target** | Stable MainNet + Public Economy + Exchanges |

---

## ✅ Co máme hotové (reálně k 2026-02-03)

- Native stack v2.9.5: core node (P2P + JSON-RPC + health/metrics) + pool (Stratum + API) + redis
- Docker-first směr: cílově 100% deployment přes Compose, systemd považovat za legacy
- Sjednocené kanonické porty (TestNet baseline): P2P `8334`, Core RPC `8444`, Stratum `3333`, Pool API `8080`
- Konfig kompatibilita: core má env override (porty/data/seeds); pool bere kanonické env + fallback na legacy env
- Připravený minimal node compose pro identické nody (core+pool+redis) bez web/api/nginx

## 🔴 PHASE 0 — SPEC FREEZE (Critical)

> **Without this, MainNet doesn't exist — just a "long testnet"**

### P0.1 — Specification Freeze

**What to freeze:**
- [ ] Genesis block
- [ ] Chain ID
- [ ] Emission schedule
- [ ] Block time
- [ ] Difficulty Adjustment Algorithm (DAA)
- [ ] Max reorg depth (hard cap)
- [ ] Fee model

**Outputs:**
- `mainnet-constitution.md`
- `genesis.json`
- `chain_params.rs` (no TODOs)

### P0.2 — Exit Criteria

**Minimum requirements:**
- [ ] Reorg tests (short + long)
- [ ] Double-spend simulation
- [ ] Node restart mid-block
- [ ] Network partition (2-3 scenarios)
- [ ] Clock skew tolerance

**Outputs:**
- `mainnet_exit_criteria.md`
- CI job: `mainnet_correctness_suite`

---

## 🟠 PHASE 1 — HARDENED TESTNET (T-6 to T-4 weeks)

> TestNet stops being a playground, becomes a dress rehearsal.

### 1.1 — TestNet = MainNet Config
- Same ports
- Same DAA
- Same emission
- Different chain-id only

### 1.2 — Docker Canon Enforcement
- Official: Docker is the ONLY supported path
- systemd = deprecated
- Warning log on non-docker run

**Outputs:**
- `docker-compose.mainnet.yml`
- `ops/runbook.md`

### 1.3 — Node Identity & Observability
- `/health` → process alive
- `/readiness` → synced + peers
- `/metrics` → mandatory

---

## 🟡 PHASE 2 — MAINNET RC (Release Candidate)

> **No new features. Only fixes.**

### 2.1 — Genesis Ceremony (Technical)
1. Generate genesis
2. Publish hash
3. Freeze binaries
4. Checksum release

> Not mysticism. Technical act of responsibility.

### 2.2 — Early Node Program (Quiet Launch)
- 5-15 independent operators
- Different continents
- No "marketing" nodes

**Monitor:**
- Peer churn
- Orphan rate
- Difficulty stability
- Pool ↔ solo interaction

### 2.3 — Mining Reality Check
- [ ] CPU-only
- [ ] Mixed CPU/GPU
- [ ] Pool vs solo
- [ ] Latency effects

> If something fails here → STOP, fix, repeat.

---

## 🟢 PHASE 3 — MAINNET LAUNCH (T=0)

> **MainNet ≠ big event. MainNet = boringly stable system.**

### What IS in T=0:
- ✅ Core chain
- ✅ Mining
- ✅ Pool
- ✅ Node
- ✅ Explorer (even minimal)

### What is NOT in T=0 (intentionally):
- ❌ DAO voting
- ❌ OASIS
- ❌ WARP
- ❌ AI

> Bitcoin didn't start with Lightning either.

---

## 🔵 PHASE 4 — POST-LAUNCH STABILIZATION (0-90 days)

### 4.1 — Governance v1 (SAFE MODE)
- DAO read-only → proposal → voting
- No "kill switches"
- No upgrades without supermajority

### 4.2 — Upgrade Mechanism
Not upgrade immediately, but mechanism for it:
- Versioning
- Deprecation
- Emergency freeze rules

---

## 🟣 PHASE 5 — EXPANSION HOOKS (After Stabilization)

Only then:
- OASIS Alpha (off-chain + hooks)
- WARP read-only bridge
- AI advisory (NOT control)

---

## 📈 EXCHANGE ROADMAP

### Phase A: DEX/Swap
- Atomic swaps
- Community liquidity
- Timeframe: T+1-4 weeks

### Phase B: CMC/CoinGecko
- Visibility
- Timeframe: T+2-4 weeks

### Phase C: Small CEX
- First exchange listing
- Timeframe: T+1-3 months

### Phase D: Larger CEX
- After track record
- Timeframe: T+6-12 months

---

## 🧠 Reality Summary

### Good News:
> Project is technically further than 90% of crypto projects at this stage.

### Risk:
> Biggest threat isn't code. It's:
> - ❌ Unfinalized spec
> - ❌ Missing exit criteria

### Path Forward:
> Once you freeze genesis + DAA + emission, you're in the final stretch.

---

## 📋 Key Milestones

| Milestone | Status | Target |
|-----------|--------|--------|
| Spec Freeze | 🔴 Pending | Before TestNet |
| Genesis Created | 🔴 Pending | T-2 weeks |
| Hardened TestNet | 🟡 In Progress | T-4 weeks |
| MainNet RC | 🔴 Pending | T-1 week |
| MainNet Launch | 🔴 Pending | TBD |
| First DEX | 🔴 Pending | T+4 weeks |
| CMC Listing | 🔴 Pending | T+4 weeks |
| First CEX | 🔴 Pending | T+3 months |

---

## ⚠️ What NOT To Do Now

- ❌ New features
- ❌ Marketing hype
- ❌ DAO expansion
- ❌ OASIS expansion

**Until:**
- ✅ Genesis is frozen
- ✅ Premine is locked
- ✅ Reorg/DAA is audit-ready

---

## 🎯 Next Steps

1. **Freeze spec** → mainnet-constitution.md
2. **Create genesis** → genesis.json
3. **Hardened TestNet** → 72-168h stability run
4. **Genesis ceremony** → scripted, reproducible
5. **Launch** → boring, stable

---

*Roadmap Version: 1.0*  
*Last Updated: 2026-02-03*
