# VerusHash (VRSC) CPU Mining Report — Apple M1 + Edge Pool Server

> **Datum:** 2026-07-15
> **Aktualizace:** 2026-07-28
> **Autor:** Devin (ZION Ops)
> **Status:** Native VerusHash v2.2 ✅ | PBaaS v7+ header normalization ✅ | Pool server rebuild & LuckPool acceptance ✅ | Target comparison: little-endian (see §3.5 update)

---

## 1. Shrnutí

Tento report dokumentuje kompletní práci na integraci VerusHash v2.2 CPU miningu pro VRSC (Verus Coin) v rámci ZION trinity mineru. Práce probíhala na Apple M1 (macOS aarch64) a Edge pool serveru (`62.171.141.136`).

### Klíčové výsledky

| Milestone | Status | Detail |
|-----------|--------|--------|
| Native VerusHash v2.2 C++ (Haraka+CLHash) | ✅ DONE | `native-verushash` feature, `zion-native-ffi` crate |
| `--verus-bench` benchmark | ✅ DONE | 1.69 MH/s (4 thr), 2.59 MH/s (8 thr) na M1 |
| PBaaS v7+ header normalization | ✅ DONE | `clear_verushash_pbaas()`, MMR root restoration |
| ZcashStratum 5-param submit | ✅ DONE | `[worker, job_id, ntime, nonce2, solution_with_varint]` |
| `meets_target` fix (BE comparison) | ✅ DONE | VRSC používá BE, ne LE — viz §3 |
| Pool server source sync | ✅ DONE | Source syncnuto na server |
| Pool server rebuild | ❌ BLOCKED | Server kód je příliš daleko behind, 17 compile chyb |
| LuckPool share acceptance | ❌ FAIL | `[23,"low difficulty share"]` — hash mismatch |

---

## 2. Native VerusHash v2.2 — Implementace

### 2.1 Architektura

VerusHash v2.2 je implementován jako nativní C++ knihovna přes `zion-native-ffi` crate:

```
V3/L1/native-ffi/
├── src/
│   └── lib.rs                  # FFI bindings (extern "C")
├── csrc/
│   ├── verus_clhash.h          # CLHash (carry-less multiply)
│   ├── verus_clhash_portable.h # Portable fallback
│   ├── haraka.h                # Haraka-512 permutation
│   ├── haraka_portable.h       # Portable Haraka
│   ├── ffi_wrapper_v3.cpp      # C++ wrapper (verushash_verify, hash_raw)
│   └── compat.h                # SSE2NEON pro Apple Silicon
```

### 2.2 Feature Flag

```toml
# AuXpow/Cargo.toml
[features]
native-verushash = ["zion-native-ffi/native-verushash"]
```

```rust
// AuXpow/src/external_hashers.rs
pub fn hash_verushash_header(header: &[u8]) -> [u8; 32] {
    #[cfg(feature = "native-verushash")]
    { return zion_native_ffi::verushash::hash_raw(header); }
    // ... fallback
}
```

### 2.3 Apple M1 Optimization

- **SSE2NEON:** `compat.h` překládá SSE2 intrinsics na ARM NEON intrinsics
- **OpenMP:** Paralelizace hash computation přes `#pragma omp parallel for`
- **Lookup tables:** VerusHash inicializuje 256-entry lookup tabulky při startu (`init_verushash()`)

### 2.4 Benchmark výsledky (Apple M1, 8-core)

| Threads | Throughput | Poznámka |
|---------|-----------|----------|
| 1 | ~320 KH/s | Single-thread baseline |
| 4 | 1.69 MH/s | Default `ZION_THREADS=4` |
| 8 | 2.59 MH/s | Všechny M1 jádra |

**Předchozí Blake3 fallback:** ~60 H/s → **28000x zrychlení** s native VerusHash.

---

## 3. Target Comparison Bug Fix

### 3.1 Popis chyby

Původní kód používal `meets_target_little_endian()` pro VRSC, která **reversovala oba** hash i target byty:

```rust
// BUG: reverses BOTH hash AND target
pub fn meets_target_little_endian(hash: &[u8; 32], target: &[u8; 32]) -> bool {
    hash.iter().rev().cmp(target.iter().rev()).is_le()  // ❌ ŠPATNÉ
}
```

To je nesprávné protože:
- **Hash** je little-endian (Bitcoin uint256 konvence) — revers na BE je OK
- **Target** je big-endian (z `difficulty_to_target` nebo stratum poolu) — revers je CHYBA

### 3.2 Správné chování

> **Korekce 2026-07-28:** Původní text této sekce tvrdil, že se hash porovnává jako big-endian.  Live testy proti LuckPool ukázaly, že VerusHash v2.2 vrací hash v **little-endian** (Bitcoin `uint256`) pořadí a upstream validátor porovnává `reverse(hash)` proti big-endian targetu.

VerusHash v2.2 reference implementace tedy musí reversovat hash (LE → BE) a porovnat s targetem ponechaným v BE:

```cpp
// C reference: reverse LE hash and compare against BE target
for (int i = 31; i >= 0; i--) {
    if (hash[i] < target[31 - i]) return true;
    if (hash[i] > target[31 - i]) return false;
}
return true;
```

### 3.3 Fix

```rust
// AuXpow/src/external_hashers.rs — meets_target_little_endian
// Hash is LE (Bitcoin uint256), target is BE. Reverse ONLY the hash.
pub fn meets_target_little_endian(hash: &[u8; 32], target: &[u8; 32]) -> bool {
    hash.iter().rev().cmp(target.iter()).is_le()  // ✅ hash reversed, target BE
}

// AuXpow/src/share_forwarder.rs — VRSC uses meets_target_little_endian
} else if self.client.profile().coin == ExternalCoin::DCR {
    meets_target_little_endian(hash, target)  // DCR: LE hash
} else if self.client.profile().coin == ExternalCoin::VRSC {
    meets_target_little_endian(hash, target)  // VRSC: LE hash
} else {
    meets_target(hash, target)  // others: BE hash
}

// AuXpow/src/miner_harness.rs — scan_verushash
if meets_target_little_endian(&hash, target) {  // VRSC: LE hash
    // share found!
}
```

### 3.4 Soubory změněné

| Soubor | Změna |
|--------|-------|
| `AuXpow/src/external_hashers.rs` | `meets_target_little_endian` doc + fix (reverse only hash) |
| `AuXpow/src/share_forwarder.rs` | VRSC → `meets_target_little_endian` (else branch), DCR stays LE |
| `AuXpow/src/miner_harness.rs` | `scan_verushash` → `meets_target_little_endian` |
| `AuXpow/src/lib.rs` | Export `hash_verushash_header` + `init_verushash` |
|| `V3/L1/native-ffi/csrc/verushash/real/ffi_wrapper_v3.cpp` | `verushash_scan_nonces` → `meets_target_le` (LE hash vs BE target) |
| `V3/L1/miner/src/main.rs` | `--verus-bench` benchmark, native-verushash init |

---

### 3.5 Korekce 2026-07-28 — target comparison je little-endian

Původní verze tohoto reportu (§3.2–3.3) tvrdila, že VerusHash v2.2 hash a target se porovnávají jako big-endian (přímé `meets_target`).  To vedlo k **opravě do špatného stavu**: po nasazení na Edge pool vracel LuckPool opět `[23,"low difficulty share"]`.

Live test lokálního `zion-miner` proti `62.171.141.136:8444` potvrdil, že správné chování je:

- VerusHash v2.2 vrací 32-byte hash v **little-endian** pořadí (Bitcoin `uint256` konvence, byte 0 = LSB).
- Target z `difficulty_to_target` / stratum je **big-endian** (byte 0 = MSB).
- `node-stratum-pool-verus` / LuckPool tedy porovnávají **reverse(hash) ≤ target** (hash převrácený do BE, target ponechán BE).

Správná implementace proto zůstává u `meets_target_little_endian`:

```rust
pub fn meets_target_little_endian(hash: &[u8; 32], target: &[u8; 32]) -> bool {
    hash.iter().rev().cmp(target.iter()).is_le()  // hash reversed, target BE
}
```

A všechny VRSC cesty používají tento helper:

| Soubor | Funkce | Porovnání |
|--------|--------|-----------|
| `V3/L1/native-ffi/csrc/verushash/real/ffi_wrapper_v3.cpp` | `verushash_scan_nonces` | `meets_target_le(hash, target)` — LE hash vs BE target |
| `AuXpow/src/miner_harness.rs` | `scan_verushash_full` / `scan_verushash_best` | `meets_target_little_endian(&hash, target)` |
| `AuXpow/src/share_forwarder.rs` | `try_forward` pro `ExternalCoin::VRSC` | `meets_target_little_endian(&effective_hash, target)` |

**Live výsledek po korekci (2026-07-28):**

```
external_share_accepted coin=VRSC status=accepted
session_status ... accepted=14 rejected=0 accept_pct=100.00
```

Pool server na Edge nyní správně forwarduje VRSC share a LuckPool je přijímá.

---

## 4. VRSC Share Submission Flow

### 4.1 ZcashStratum protokol

VRSC používá 5-parametr `mining.submit`:

```json
["mining.submit", "worker", "job_id", "ntime", "nonce2", "solution_with_varint"]
```

### 4.2 PBaaS v7+ Solution Format

Solution je 1344 bytů (PBaaS v7+). Posledních 15 bytů obsahuje `nonceSpace`:

```
solution[143 + 1329 + en1_len .. 143 + 1329 + en1_len + 4]  = miner_nonce (LE)
solution[143 + 1329 .. 143 + 1329 + en1_len]                 = extranonce1
```

### 4.3 Header Normalization

Před hashováním se header normalizuje přes `clear_verushash_pbaas()`:
- Bytes 4..100 → zeroed (non-canonical header fields)
- Bytes 104..140 → zeroed (nonce field — NOT modified, only nonceSpace)
- Solution bytes 8..72 → zeroed (MMR roots — restored from original job solution)

### 4.4 Share Forwarding Architecture

```
Miner (M1)                    Pool Server (Edge)              LuckPool
   │                              │                              │
   ├── ExternalSubmit ──────────→ │                              │
   │   (hash_hex, nonce,          │                              │
   │    external_job_id)          │                              │
   │                              ├── meets_target() check ──→ BelowTarget ❌
   │                              │   (lokální, elapsed_ms=0)    │
   │                              ├── auxpow_client.submit ─────→ │
   │                              │   (ZcashStratum 5-param)     │
   │                              │                              ├── [23,"low difficulty share"] ❌
   │                              ←── ExternalResult ────────────│
   │   (accepted=false,           │                              │
   │    status=below_target)      │                              │
   │                              │                              │
```

---

## 5. Aktuální problémy

### 5.1 Pool Server — BelowTarget (lokální reject)

Pool server rejectuje VRSC shares jako `BelowTarget` s `elapsed_ms=0` (lokální check, ne LuckPool):

```
external_share_received miner=zion163... coin=VRSC job_id=4ee1111 nonce=1475215185
auxpow_bridge: share_forwarded job_id=4ee1111 nonce=1475215185 result=BelowTarget elapsed_ms=0
external_share_result miner=zion163... coin=VRSC accepted=false status=below_target
```

**Root cause:** Pool server binary (built 2026-07-15 05:32) používá starý kód. Source na serveru je syncnut (fix aplikován), ale **rebuild selhal** — server kód je příliš daleko behind oproti lokálnímu (17 compile chyb: chybějící `RevenueSource::BeamHashExternal`, `ShareResult::NoShare`, atd.).

**Fix:** Potřebný full source sync serveru + rebuild. Alternativně: cherry-pick jen `share_forwarder.rs` + `external_hashers.rs` do staršího server kódu.

### 5.2 LuckPool — "low difficulty share"

Některé shares projdou lokálním checkem (když pool binary má správný kód) ale LuckPool je odmítne:

```
auxpow: VRSC submit — job=4ee1103 ntime=e189576a nonce2_len=56 sol_len=2694
auxpow: VRSC submit error raw: [23,"low difficulty share"]
```

**Root cause:** LuckPool spočítá **jiný hash** než náš miner. To znamená že header, který hashujeme, se liší od headeru, který LuckPool rekonstruuje. Možné příčiny:
1. **MMR root restoration** — obnovujeme MMR roots z original job solution, ale možná nesprávně
2. **PBaaS header normalization** — `clear_verushash_pbaas()` možně maže byty, které LuckPool očekává
3. **nonce2/solution encoding** — varint prefix nebo solution format může být špatný
4. **extranonce1 embedding** — nonceSpace pozice může být offsetována

**Status:** Vyžaduje hlubší analýzu VerusHash PBaaS v7+ specifikace a LuckPool očekávání.

---

## 6. Commity

Všechny VerusHash fixy jsou commitnuty a pushnuty na `origin/main`:

| Commit | Popis |
|--------|-------|
| `ea4e33bf4` | feat(auxpow): integrate real VerusHash v2.2 C++ via zion-native-ffi |
| `40c6c50b3` | pool: rate-limit NoSolution storms, throttle AuxPow scheduler, enable native-verushash |
| `59b97d50f` | fix(auxpow): VRSC PBaaS v7+ — nonce field NOT modified, only nonceSpace |
| `2a1316ce3` | feat(auxpow): triple parallel mining LIVE — ZION GPU + EPIC GPU + VRSC CPU |
| `1a1dcac55` | feat(auxpow): VerusHash PBaaS v7+ header normalization + Pearl disabled status |
| `51f5969a7` | auxpow: raw set_target target + logging improvements (meets_target fix) |
| `b7144d6d8` | fix(edge-deploy): fix deploy script and ReadWritePaths for live deployment |

**Celkem 44 VRSC/VerusHash-related commitů** v git historii.

---

## 7. Další kroky

### 7.1 VRSC — Otevřené úkoly

1. **Pool server rebuild** — sync celého V3/ stromu na server + opravit 17 compile chyb (chybějící enum varianty, API changes)
2. **LuckPool hash mismatch** — debug header rekonstrukce:
   - Porovnat náš header s LuckPool očekávaným (Wireshark / Verus daemon)
   - Validovat MMR root restoration
   - Validovat PBaaS v7+ solution encoding
3. **CPU vardiff** — pool-side variable difficulty pro CPU stream (nezávislé na network target)

### 7.2 RandomX / XMR — ✅ Hotovo

RandomX integrace je dokončena — viz [`RandomXReport.md`](./RandomXReport.md):
- **`tevador/RandomX` C++ library** (ne `randomx-rs`) — nativní kompilace přes `zion-native-ffi`
- **Per-thread VM** (lock-free, 175 H/s na M1 s 4 threads)
- **Seed_hash epoch plumbing** — `ExternalStreamJob.seed_hash_hex` → FFI `init_with_seed()`
- **`--randomx-bench`** benchmark
- **Build:** miner + pool + auxpow — vše kompiluje s `native-randomx` feature
- **Pool E2E:** TODO (connect to MoneroOcean/2miners, verify share submission)

---

## 8. Reference

- [VerusHash v2.2 spec](https://github.com/VerusCoin/VerusCoin/blob/master/src/crypto/verus_hash.h)
- [LuckPool VRSC stratum](https://luckpool.net/verus)
- [ZcashStratum protokol](https://github.com/VerusCoin/VerusCoin/blob/master/src/rpc/mining.cpp)
- C reference: `V3/L1/native-ffi/csrc/ffi_wrapper_v3.cpp` (`verushash_verify`)
- Lokální fix: `AuXpow/src/share_forwarder.rs:40-48`, `AuXpow/src/external_hashers.rs:380-394`
- Setup guide: `SetupTripleAlgo.md` § VerusHash CPU Analysis
- Status: `StatusV3.md` § Supported External Coins (VRSC řádek)
