# Changelog — ZION TerraNova

---

## [v2.9.7] — March 2026 · Pre-MainNet Gate

**No consensus changes.** Protocol parameters, emission schedule, and cryptographic primitives are identical to v2.9.6.

### What changed

- **TestNet stability**: Three seed nodes (Helsinki, USA, Asia) running continuously. No forks, no consensus splits.
- **Test suite**: 780+ tests across all Rust crates — 0 failures. CI passing.
- **Pool**: PPLNS reward distribution confirmed correct at scale. Telemetry refresh every 30 seconds.
- **Documentation**: Public docs restructured and versioned. v2.9.7 CURRENT, v2.9.6 PREVIOUS, v2.9.5 ARCHIVE. Internal operational data removed from public-facing docs.
- **Website**: All public-facing pages unified into a consistent layout. Explorer, Dashboard, Mining, Bridge, DAO, Warp, Docs, Download, Admin.
- **Dual mining**: ZION (Cosmic Harmony v3) + VRSC (VerusHash) confirmed working in parallel.

### Bridge status

- wZION ERC-20 contract: deployed and tested on Base Sepolia (testnet)
- Lock/Mint Guardian relay: operational, 3-of-3 multi-sig
- 60-block finality confirmation working
- Mainnet deployment: pending security audit

---

## [v2.9.6] — February 2026 · "On the Star"

Hard fork introducing the **6-Layer "On the Star"** architecture.

### Key changes

- **Decade Decay emission**: block reward decays −20% every 10 years, tail emission 725 ZION/block — extends mining horizon from ~45 to 100+ years
- **6-Layer architecture** defined: L1 (ZION TerraNova) through L6 (ZION Issobella orbital station)
- **Humanitarian tithe**: 5% of every block reward to Humanitarian Fund, 5% to Issobella Foundation — encoded in protocol
- **52,590 lines of Rust** across 5 crates: core, miner, pool, bridge, native-libs
- **780+ tests** introduced across all crates
- **wZION Bridge**: initial L2 architecture with Base EVM (Sepolia testnet)
- **Mining pool**: Stratum v2 PPLNS, 89/5/5/1% split, LMDB persistence
- Website redesign with cosmic observatory background system

---

## [v2.9.5] — 2025 · "Native Awakening"

See [docs/v2.9.5](../v2.9.5/) for full changelog.

Key highlights: Cosmic Harmony v3 PoW algorithm, UTXO + Ed25519, LWMA DAA, LMDB storage, genesis premine fully disclosed, fair launch (no presale).

---
