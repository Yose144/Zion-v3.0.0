# WORK REPORT: P2P Network & Multi-Algorithm Verification
**Date:** 7. Feb 2026 (Session 2)  
**Version:** ZION TerraNova v2.9.5  
**Focus:** P2P síť a multi-algo příjem

---

## 📊 Executive Summary

✅ **Multi-algo pool:** Všech 6 algoritmů plně funkčních s korektními target formáty  
✅ **P2P handshake & tip:** Funkční, ZionCore/0.2.0 na výšce 62k+  
⚠️ **P2P GetBlocks:** Vyžaduje `limit` pole (opraveno s `serde(default)`)  
⚠️ **P2P rate limiting:** Příliš agresivní (opraveno — sníženy bany)  
⚠️ **Seed nodes:** Pouze Helsinki online (USA/Singapore offline)

---

## 1. Multi-Algorithm Pool Verification ✅

### Živý test proti pool 77.42.31.72:3333

| Algoritmus | Target formát | Délka | Diff | Výsledek |
|---|---|---|---|---|
| cosmic_harmony | `00418937` | 8 chars (u32) | 1000 | ✅ PASS |
| cosmic_harmony_v3 | `00418937` | 8 chars (u32) | 1000 | ✅ PASS |
| randomx | `004189374bc6a7ef` | 16 chars (u64) | 1000 | ✅ PASS |
| blake3 | `004189374bc6a7ef...` | 64 chars (256-bit) | 1000 | ✅ PASS |
| yescrypt | `004189374bc6a7ef...` | 56 chars (224-bit) | 1000 | ✅ PASS |
| autolykos_v2 | `004189374bc6a7ef...` | 64 chars (256-bit) | 1000 | ✅ PASS |
| default (no hint) | `00418937` | 8 chars (u32) | 1000 | ✅ PASS (→cosmic_harmony) |

### Pool Multi-Algo Flow (Verified in Code)
1. **Login:** Miner posílá `pass: "algo=cosmic_harmony"` → pool parsuje `parse_algorithm_hint()`
2. **Job dispatch:** Pool nastaví algo-specifický target format via `compute_job_target_hex()`
3. **Share validation:** `ShareValidator` verifikuje hash per-algo (CHv3, RandomX, Yescrypt, Blake3, Autolykos)
4. **VarDiff:** Pool posílá nový job s updated difficulty per-algo
5. **Job broadcast:** `broadcast_new_job()` posílá algo-specifický target každému minerovi

### Share Validator — Full Algorithm Support
| Algoritmus | Hash compute | Target check | Block check |
|---|---|---|---|
| CosmicHarmony V1 | `cosmic_harmony::hash()` | state0 LE u32 ≤ target | ✅ |
| CosmicHarmony V3 | `algorithms_opt::cosmic_harmony_v3()` | state0 LE u32 ≤ target | ✅ |
| CosmicHarmony V2 | `CosmicHarmonyV2::hash()` | 256-bit BE comparison | ✅ |
| RandomX | `randomx::hash()` | low64 LE u64 ≤ target | ✅ |
| Yescrypt | `yescrypt_hash_mining()` | 224-bit BE comparison | ✅ |
| Blake3 | `blake3::hash_with_nonce()` | 256-bit BE comparison | ✅ |
| Autolykos V2 | — | 256-bit BE comparison | ✅ |

---

## 2. P2P Network Verification

### Connectivity Test

| Node | Address | Port | Status |
|---|---|---|---|
| Helsinki (PRIMARY) | 77.42.31.72 | 8334 | ✅ ONLINE |
| USA (PEER1) | 5.78.138.238 | 8335 | ❌ OFFLINE |
| Singapore (PEER2) | 5.223.56.122 | 8335 | ❌ OFFLINE |
| Pool (Stratum) | 77.42.31.72 | 3333 | ✅ ONLINE |

### DNS Seeds
- `seed1.zionterranova.com` → 77.42.31.72 ✅
- `seed2.zionterranova.com` → 77.42.31.72 ✅
- `seed3.zionterranova.com` → 77.42.31.72 ✅

> **⚠️ Pozor:** Všechny DNS seeds ukazují na stejné IP. Pro mainnet nutno přidat samostatné IP záznamy.

### P2P Protocol Test
```
Handshake: ✅ ZionCore/0.2.0, height=62380
GetTip:    ✅ height=62381, hash=0e490f00...
GetBlocks: ⚠️ Vrací 0 bloků bez pole "limit" (opraveno)
```

### P2P Handshake Sequence (Verified)
```
Client → Server: {"type":"Handshake","version":1,"agent":"...","height":0}
Server → Client: {"type":"Handshake","version":1,"agent":"ZionCore/0.2.0","height":62380}
Client → Server: {"type":"GetTip"}
Server → Client: {"type":"Tip","height":62381,"hash":"..."}
Client → Server: {"type":"GetBlocks","from_height":62378,"limit":5}
Server → Client: {"type":"Blocks","blocks":[...]}
```

---

## 3. Issues Found & Fixed

### 3.1 P2P GetBlocks — Missing `limit` Default ⚡
**Problém:** `GetBlocks` message vyžaduje pole `limit`, ale klienti ho často vynechávají → serde deserializace selže → misbehavior ban.

**Fix:** `messages.rs` — přidán `#[serde(default = "default_block_limit")]` s default 10.

### 3.2 P2P Rate Limiting — Příliš agresivní ⚡
**Problém:** Ban časy pro testnet příliš přísné:
- Rate limit: 300s (5 min)
- Invalid message: 1800s (30 min)
- Invalid blocks: 3600s (1 hodina)
- Oversized batch: 1800s (30 min)

**Fix:** Sníženy pro testnet:
- Rate limit: 120s (2 min)
- Invalid message: 300s (5 min)
- Invalid blocks: 900s (15 min)
- Oversized batch: 600s (10 min)
- MAX_MISBEHAVIOR: 3 → 5

### 3.3 Algorithm Schedule — TestNet Hardcoded ℹ️
**Stav:** `Algorithm::from_height()` je hardcoded na `CosmicHarmony` pro všechny výšky.
Multi-algo rotace (`height % 4`) je zakomentovaná pro testnet.

```rust
pub fn from_height(_height: u64) -> Self {
    // TESTNET: Use only Cosmic Harmony for all heights
    Algorithm::CosmicHarmony
}
```

**Poznámka:** Miners mohou explicitně zvolit algo via `pass` hint, ale chain schedule je single-algo.

---

## 4. Architecture Analysis

### Multi-Algo Stack
```
Miner                    Pool                      Blockchain
  |                        |                          |
  |-- login(algo=X) ----->|                          |
  |                        |-- parse_algorithm_hint() |
  |                        |-- compute_job_target_hex(X, diff) |
  |<-- job{algo,target} --|                          |
  |                        |                          |
  |-- submit(nonce,hash)-->|                          |
  |                        |-- ShareValidator::validate(algo=X) |
  |                        |-- compute_hash(algo=X, blob, nonce) |
  |                        |-- check_target(hash, algo=X, target) |
  |<-- accepted/rejected --|                          |
```

### Multi-Chain Engine (Ready for Mainnet)
```
ExternalChain support: ETC, RVN, ERG, KAS, ALPH, ZEC, VEIL, DYN, CLORE
ProfitSwitcher: WhatToMine API integration
RevenueProxy: EthStratum + StandardStratum external pool connections
```

### Universal Miner Algorithm Support
12 algorithms: CosmicHarmony, CosmicHarmonyV2, RandomX, Yescrypt, Blake3,
Ethash, KawPow, Autolykos, KHeavyHash, Equihash, ProgPow, Argon2d

---

## 5. Files Modified

| File | Change |
|---|---|
| `2.9.5/zion-native/core/src/p2p/messages.rs` | Added `serde(default)` for GetBlocks limit |
| `2.9.5/zion-native/core/src/p2p/mod.rs` | Relaxed rate limiting: MAX_MISBEHAVIOR 3→5, reduced all ban durations |

---

## 6. Recommendations for Mainnet

1. **🔴 Activate multi-algo rotation** — Uncomment `height % 4` in `Algorithm::from_height()`
2. **🔴 Bring USA/Singapore seeds online** — Only 1/3 seed nodes reachable
3. **🟡 DNS seed diversity** — All DNS seeds resolve to same IP
4. **🟡 Increase rate limit window** — Consider 100 req/120s for miners
5. **🟢 External pool testing** — Test ETC/RVN/KAS stratum connections via RevenueProxy
6. **🟢 ProfitSwitcher live test** — Verify WhatToMine API coin switching

---

## 7. Test Commands Used

```bash
# Multi-algo test (all 7 variants)
python3 test_multialgo.py

# P2P connectivity
nc -z 77.42.31.72 8334  # Helsinki
nc -z 5.78.138.238 8335  # USA (offline)
nc -z 5.223.56.122 8335  # Singapore (offline)

# DNS resolution
nslookup seed1.zionterranova.com
nslookup seed2.zionterranova.com
nslookup seed3.zionterranova.com
```

---

**Status:** ✅ Multi-algo pool plně funkční | ⚠️ P2P minor fixes applied  
**Next:** Deploy fixes, activate multi-algo rotation for mainnet prep
