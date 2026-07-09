# 🚀 ZION v2.9.6 Changelog — Pre-Mainnet Fork

> *Archive note: this changelog reflects the pre-mainnet framing at the time. Today’s public launch state follows the newer launch gate line and remains NO-GO.*

---

## Version 2.9.6 (Pre-Mainnet) — February 2026

### ⚙️ Consensus

- **CHv3 unification** — Cosmic Harmony v3 is the only PoW algorithm; v1/v2 archived
- **Memory-hard scratchpad** (Phase 4) — 256 KiB, 4 passes, 512 random reads; fork height 50,000
- **ASIC resistance score** 75 → 90  
- **Nonce** u32 → u64  
- **Decade Decay** Model A — −20% every 10 years; tail ~724.785 ZION/block from 2126  
- **Block reward split** — 89% miner / 5% humanitarian / 5% L5/L6 Issobella / 1% pool  
- **L6 station name** — **ZION Issobella**

### ⛏️ Mining

- Parallel dual-mining ZION 3T + VRSC 1T (PerMiner groups, `g=` hints)
- VerusHash 2.2 native ARM64, GPU CHv3 (Metal/OpenCL)

### 🌐 Pool

- Single `CosmicHarmony` = CHv3 in validator; PerMiner scheduler

### 🏗️ Infrastructure

- Historical snapshot: Helsinki + Germany multi-node; current live model (2026-03-12): Zion2 `seed.zionterranova.com` + internal seeds

### 📦 Codebase & tests

- Rust workspace; archived legacy algorithms under `archive/legacy-algorithms/`

### 📄 Documentation

- `docs/v2.9.6/*` — consensus, tokenomics, layer architecture, P2P, launch plan, migration, audit, changelog

---

## Version 2.9.5 (Native Awakening) — January 2026

See [v2.9.5](../v2.9.5/). Highlights: CHv3 crate, pool Stratum, P2P seeds, genesis with Tree of Life ASCII art.

---

## Planned for v2.9.7+ (mainnet track)

Algorithm rotation votes, audit, listings, mobile wallet, public explorer, English documentation pass.
