# SHARE ACCEPTED — EkamDeeksha na Mac M1 Metal GPU

**Datum:** 2026-08-08
**Status:** ✅ FUNGUJE — shares accepted, blocks found, chain roste
**Chain height:** 227+ (Difficulty ~5790)

---

## Shrnutí

Mac M1 Metal GPU nyní těží EkamDeeksha v3.2 s **accepted shares** a **found blocks**.
Do té doby pool rejectoval všechny GPU shares — Metal kernel měl staré v2 konstanty
a špatný byte order v target porovnání.

---

## Co bylo rozbité

### 1. Metal kernel na starých v2 konstantách

`deeksha_lite.metal` měl:
- `SCRATCHPAD_SIZE = 131072` (128 KiB) — CPU má **524288** (512 KiB)
- `BLOCK_COUNT = 4096` — CPU má **16384**
- `PASSES = 1` — CPU má **2**
- `RANDOM_READS = 32` — CPU má **128**

GPU hash se lišil od CPU → pool rejectoval všechny GPU shares.

### 2. Špatný byte order v target porovnání

Metal kernel porovnával `hash_u[0]` (little-endian uint) s `target_u32` (big-endian).
CPU porovnává lexicograficky (big-endian). Výsledek: GPU našla jiné nonces než CPU.

### 3. Pool TLS handler neodesílal bloky

`block_found: false` bylo hardcoded v TLS V3 handleru → žádné bloky se neodeslaly na node.

### 4. Pool parse_target_hex vyžadoval 64 chars

Node vrací 40-char target_hex → parse vrátil `None` → fallback na `[0xFF; 32]`.

### 5. Miner těžil jen 1 share za job

Loop čekal na nový job po každém share → ~5s pauza → ~2h na blok.

---

## Co bylo opraveno

### Metal kernel (`deeksha_lite.metal`)
```c
#define SCRATCHPAD_SIZE  524288   /* 512 KiB = 16384 * 32 */
#define BLOCK_COUNT      16384
#define PASSES           2
#define RANDOM_READS     128
```

Target porovnání opraveno na big-endian:
```c
uint state0_be = ((uint)hash[0] << 24) | ((uint)hash[1] << 16) |
                 ((uint)hash[2] <<  8) |  (uint)hash[3];
if (state0_be <= target_u32) { ... }
```

### Metal backend (`metal_deeksha_lite.rs`)
- Scratchpad alokace: `131_072` → `524_288` bytes/thread
- Memory budget: `budget_bytes / 524_288`

### Pool TLS handler (`stratum.rs`)
- Portována block detection + submission logika z plain TCP handleru
- `parse_target_hex` padding: short hex → 64 chars s leading zeros

### Miner loop (`runtime.rs`)
- Kontinuální mining shares s aktuálním jobem
- Non-blocking `try_next_job()` místo blokujícího čekání

### Pool vardiff
- `start_difficulty`: 1 → 500

---

## Verifikace

### Hash test (bit-identical)
```
$ metal_hash_test
Nonce: 0
GPU hash: 4a83ea34ca2fe97be5c0739579698e7039a981efd034b44334041774166d2cca
CPU hash: 4a83ea34ca2fe97be5c0739579698e7039a981efd034b44334041774166d2cca
=== PASS: Metal GPU hash matches CPU hash ===
```

### Shares accepted (Mac M1 Metal GPU)
```
V3 Trinity: ZION share accepted job=524 nonce=656 height=224
V3 Trinity: ZION share accepted job=525 nonce=202 height=224
V3 Trinity: ZION share accepted job=526 nonce=264 height=224
V3 Trinity: ZION share accepted job=527 nonce=433 height=224
V3 Trinity: ZION share accepted job=528 nonce=43  height=224
V3 Trinity: ZION share accepted job=529 nonce=563 height=224
```

### Block found (Mac M1 Metal GPU)
```
notify_block_found miner=zion16825y2v5f3q507e5c2e0j8n666z43558l3zt604
  height=224 worker=zion16825y2v5f3q507e5c2e0j8n666z43558l3zt604.mac-m1-metal
submitBlock response: {"id":1,"jsonrpc":"2.0","result":{"accepted":true}}
```

### Chain growth
```
Height: 227  Difficulty: 5790  Accepted: 228
```

---

## Soubory změněny

| Soubor | Změna |
|--------|-------|
| `V31/L1/miner/src/gpu/kernels/metal/deeksha_lite.metal` | v2 → v3.2 konstanty, big-endian target |
| `V31/L1/miner/src/gpu/metal_deeksha_lite.rs` | 131072 → 524288 scratchpad |
| `V31/L1/miner/src/bin/gpu_bench.rs` | ZION_GPU_BACKEND env var |
| `V31/L1/miner/src/bin/metal_hash_test.rs` | Nový test (GPU↔CPU hash compare) |
| `V31/L1/miner/src/runtime.rs` | Kontinuální mining loop |
| `V31/L1/pool/src/stratum.rs` | TLS block_found + target_hex padding |
| `V31/L1/miner/build.rs` | OpenMP disable by default |

---

## Výkon

| Backend | Hashrate | Poznámka |
|---------|----------|----------|
| CPU (8 threadů) | ~16 KH/s | Referenční |
| Metal GPU (M1) | ~2.8 KH/s | 512 KiB scratchpad/thread |

Metal GPU je pomalejší kvůli 512 KiB scratchpadu na thread. Pro vyšší výkon
by se dalo optimalizovat scratchpad reuse mezi nonces, ale funkčně je to správně.

---

## Commity

- `7fcce5135` — V31: fix TLS block_found detection + continuous ZION mining loop + OpenMP disable
- `3cf1aff2b` — Metal kernel v3.2 + big-endian target + metal_hash_test (v dashboard commit)

---

## Topologie

```
Mac M1 Metal GPU
  └─ zion-miner --gpu metal --v3-trinity
       └─ Pool 62.171.141.136:8444 (TLS V3)
            └─ Node 127.0.0.1:9445 (RPC)
                 └─ Chain height 227+
```

---

**Závěr:** EkamDeeksha v3.2 na Mac M1 Metal GPU je bit-identical s CPU.
Shares accepted, blocks found, chain roste. ✅
