# 🔒 Bezpečnostní audit v2.9.6

> *Audit stav a plán před mainnet spuštěním.*

> **Historical note (2026-03-12):** This audit captures the original v2.9.6 multi-node testnet period. Server/IP references below are archival and do not represent the current live Zion2 single-host deployment.

---

## 1. Stav auditu

| Oblast | Auditor | Status | Výsledek |
|--------|---------|--------|----------|
| Konsenzus (CHv3 pipeline) | Interní (self-audit) | ✅ Provedeno | 7 nálezů opraveno |
| PoW validace (node + pool) | Interní | ✅ Provedeno | CHv3 unifikován |
| Kryptografie (Ed25519, Blake2b) | Interní | ✅ Provedeno | OK (standardní crates) |
| P2P protokol | Interní | 🔄 Probíhá | Základní review |
| RPC API | Interní | ⏳ Plánováno | — |
| Server hardening | Interní | ✅ Provedeno | Helsinki + Germany |
| 3rd party audit | TBD | ⏳ Plánováno Q2/Q3 2026 | — |

---

## 2. Provedené opravy (AUDIT.md)

### P0 — Kritické (opraveno)

| ID | Nález | Status |
|----|-------|--------|
| P0-01 | Genesis block hash ne-deterministický | ✅ Opraveno — fixní genesis timestamp |
| P0-02 | Nonce u32 overflow pro GPU mining | ✅ Opraveno — u64 nonce |
| P0-03 | CH v1/v2/v3 divergence (3 různé hashe) | ✅ Opraveno — CHv3 unifikace |
| P0-04 | Pool share validator v1 ≠ v3 hash | ✅ Opraveno — single CosmicHarmony |
| P0-05 | Fork height z env variable (nesafe) | ✅ Opraveno — hardcoded |

### P1 — Vysoké (opraveno)

| ID | Nález | Status |
|----|-------|--------|
| P1-04 | Genesis timestamp 0 místo config | ✅ Opraveno |
| P1-18 | Share cache memory leak | ✅ Opraveno — periodic pruning (60s) |

### P2 — Střední (opraveno / v řešení)

| ID | Nález | Status |
|----|-------|--------|
| P2-06 | GPU ≠ CPU fusion parity (7 vs 4 rundů) | ✅ Opraveno — 7 rundů oboje |
| P2-xx | Algorithm rotation DISABLED (TODO v block.rs) | ℹ️ By design — DAO vote |

---

## 3. CHv3 specifický audit

### 3.1 Determinismus

Ověřeno přes 47 unit testů v `zion-cosmic-harmony-v3` crate:
- Cross-platform determinismus (fixed-point φ aritmetika)
- Nonce sensitivity (změna nonce → jiný hash)
- Height sensitivity (memory-hard fork gate)
- Scratchpad memory-hard validace

### 3.2 ASIC resistance

| Metrika | Hodnota |
|---------|---------|
| ASIC resistance score | 90/100 |
| Memory requirement | 256 KiB (scratchpad) |
| Sequential passes | 4 (nelze paralelizovat) |
| Random reads | 512 (cache-unfriendly) |
| Známý ASIC | ❌ Neexistuje |

### 3.3 Útočné vektory

| Útok | Riziko | Mitigace |
|------|--------|----------|
| 51% attack | Střední | LWMA rychlá DA, monitoring |
| Selfish mining | Nízké | 60s block time, peer monitoring |
| Time warp | Nízké | Timestamp drift limit (2h mainnet) |
| Hash collision | Zanedbatelné | Keccak-256 + SHA3-512 pre-image |
| Scratchpad bypass | Nízké | Fork-gated, nelze obejít |

---

## 4. Server audit

### Helsinki (77.42.31.72)

| Check | Status |
|-------|--------|
| SSH hardening | ✅ Key-only, root disabled |
| Firewall (ufw) | ✅ Only P2P + RPC + HTTP |
| Docker isolation | ✅ User namespace |
| TLS certificates | ✅ Let's Encrypt |
| Log rotation | ✅ logrotate configured |
| Monitoring | 🔄 Basic uptime checks |

### Germany (46.225.126.243)

| Check | Status |
|-------|--------|
| SSH hardening | ✅ Key-only |
| Firewall | ✅ P2P port only |
| Peer connectivity | ✅ Verified |

---

## 5. Plán 3rd party auditu

### Timeline

| Fáze | Období | Popis |
|------|--------|-------|
| Self-audit | ✅ Q1 2026 | Interní review konsenzus + krypto |
| Bug bounty | Q2 2026 | Community bug bounty program |
| 3rd party | Q3 2026 | Profesionální audit (TBD firma) |
| Mainnet | Q4 2026 | Audit report publikován |

### Scope 3rd party auditu

1. **Konsenzus vrstva** — CHv3 hash, difficulty adjustment, block validation
2. **Kryptografie** — klíče, podpisy, merkle tree
3. **P2P protokol** — peer discovery, block propagation, DoS resistance
4. **RPC API** — input validation, auth, rate limiting
5. **Smart contract readiness** — pokud implementováno (L2+)

### Budget

Odhadovaný rozpočet: 20 000 – 50 000 USD
Financování: z premine vyhrazené pro vývoj (viz tokenomics.md)

---

## 6. Bug bounty program (plánováno)

| Severity | Odměna |
|----------|--------|
| Kritická (konsenzus break, loss of funds) | 5 000 – 20 000 ZION |
| Vysoká (DoS, privacy leak) | 1 000 – 5 000 ZION |
| Střední (UX bug, minor vuln) | 100 – 1 000 ZION |
| Nízká (doc error, typo) | 10 – 100 ZION |

Pravidla:
- Responsible disclosure (90 dní)
- Pokrytí: core, pool, miner, P2P
- Výjimky: 3rd party dependencies, social engineering
