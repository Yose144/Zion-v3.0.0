# 🔒 Security audit v2.9.6

> *Audit status and plan before mainnet.*

> **Historical note (2026-03-12):** Written during the original multi-node testnet era; server IPs below are archival, not the current Zion2 single-host layout.

---

## 1. Audit status

| Area | Auditor | Status | Result |
|------|---------|--------|--------|
| Consensus (CHv3) | Internal | ✅ Done | 7 findings fixed |
| PoW validation | Internal | ✅ Done | CHv3 unified |
| Crypto (Ed25519, Blake2b) | Internal | ✅ OK | Standard crates |
| P2P | Internal | 🔄 In progress | Baseline review |
| RPC API | Internal | ⏳ Planned | — |
| Server hardening | Internal | ✅ Done | Helsinki + Germany era |
| Third party | TBD | ⏳ Q2/Q3 2026 | — |

---

## 2. Fixed findings (summary)

**P0**: deterministic genesis, u64 nonce, CHv3 single path, pool/node hash parity, hardcoded fork heights.  
**P1/P2**: genesis timestamp, share-cache pruning, GPU/CPU fusion round parity, algorithm rotation gated on DAO.

---

## 3. CHv3-specific review

47+ unit tests for cross-platform determinism, nonce/height sensitivity, scratchpad behaviour.  
ASIC score ~90/100; 256 KiB scratchpad; attack vectors table (51%, selfish mining, time warp, scratchpad bypass) with mitigations.

---

## 4. Server audit (archival)

Helsinki and Germany hosts: SSH key-only, UFW, Docker usernamespaces, TLS, log rotation.

---

## 5. Third-party plan

Self-audit → bug bounty → professional audit → publish before mainnet window. Scope: consensus, crypto, P2P, RPC, future L2 contracts. Budget indication 20k–50k USD from development allocation.

---

## 6. Bug bounty (planned)

Critical to low tiers with ZION bounties; 90-day responsible disclosure; scope core/pool/miner/P2P.
