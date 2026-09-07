# ⚙️ Konsenzus v2.9.6 — Cosmic Harmony v3 (CHv3)

> *Jediný PoW algoritmus ZION mainnetu. 5-fázová pipeline s memory-hard scratchpadem.*

---

## 1. Přehled

ZION v2.9.6 používá **Cosmic Harmony v3 (CHv3)** jako jediný Proof-of-Work algoritmus.
Historické varianty CH v1 a v2 byly odstraněny z kompilace a archivovány.

| Parametr | Hodnota |
|----------|---------|
| **Algoritmus** | Cosmic Harmony v3 (CHv3) |
| **Crate** | `zion-cosmic-harmony-v3` v3.0.0 |
| **Hash výstup** | 32 bajtů (256 bitů) |
| **Nonce** | u64 (64 bitů) |
| **Block time** | 60 sekund |
| **Difficulty adjustment** | LWMA (okno 60 bloků) |
| **Fork height (CHv3)** | 0 (aktivní od genesis) |
| **Fork height (memory-hard)** | 50 000 |
| **ASIC resistance score** | 90/100 |

---

## 2. 5-fázová pipeline

```
Input: blob (≥80 B) + nonce (u64) + block_height (u64)
       │
       ▼
┌─────────────────────────────────────────────────┐
│  Phase 1: Keccak-256                            │
│  header_bytes ‖ nonce.to_le_bytes()             │
│  → 32 B hash                                   │
└─────────────┬───────────────────────────────────┘
              ▼
┌─────────────────────────────────────────────────┐
│  Phase 2: SHA3-512                              │
│  keccak_output → 64 B hash                     │
└─────────────┬───────────────────────────────────┘
              ▼
┌─────────────────────────────────────────────────┐
│  Phase 3: Golden Matrix Transform               │
│  64 B → 4×4 state matrix                       │
│  φ-weighted rotace, XOR diffusion               │
│  Fixed-point aritmetika (φ^n × 2^32)            │
│  → 64 B output                                 │
└─────────────┬───────────────────────────────────┘
              ▼
┌─────────────────────────────────────────────────┐
│  Phase 4: Memory-Hard Scratchpad (≥ height 50k) │
│  256 KiB scratchpad, 64 B bloky                 │
│  4 sekvenční průchody + 512 random reads         │
│  SHA3-512 chain init → AES-like mixing           │
│  → 64 B output                                 │
└─────────────┬───────────────────────────────────┘
              ▼
┌─────────────────────────────────────────────────┐
│  Phase 5: Cosmic Fusion                         │
│  7 rundů fúze                                   │
│  Golden ratio weighted XOR + rotace              │
│  Finální Keccak-256 → 32 B hash                 │
└─────────────────────────────────────────────────┘
```

### 2.1 Phase 1 — Keccak-256

Standardní Keccak-256 nad `header[0..80] ‖ nonce.to_le_bytes()`. Výstup 32 B.

### 2.2 Phase 2 — SHA3-512

SHA3-512 nad Keccak výstupem → 64 B. Rozšíří entropii pro Golden Matrix.

### 2.3 Phase 3 — Golden Matrix Transform

64 B vstup se interpretuje jako 4×4 matice 32-bit stavů. Na matici se aplikují:
- **φ-weighted rotace**: každý element rotován o `(φ^i × 2^32) mod 32` bitů
- **XOR diffusion**: řádkové a sloupcové promíchání
- **Pre-computed lookup tabulky** pro deterministický cross-platform výstup (fixed-point)

Konstanty:
```rust
pub const PHI: f64 = 1.618033988749895;    // Zlatý řez
pub const PHI_POWERS: [f64; 16] = [ ... ]; // φ^0 až φ^15
```

### 2.4 Phase 4 — Memory-Hard Scratchpad

Aktivní od výšky **50 000** (`CHV3_MEMORY_HARD_FORK_HEIGHT`).

| Parametr | Hodnota |
|----------|---------|
| Scratchpad size | 256 KiB |
| Block size | 64 B |
| Sequential passes | 4 |
| Random reads | 512 |
| Init chain | SHA3-512 |

**Cíl**: Zvýšit paměťovou náročnost → odolnost proti ASIC. Bez 256 KiB cache nelze hash efektivně počítat.

### 2.5 Phase 5 — Cosmic Fusion

7 rundů iterativního mixování:
1. Golden ratio weighted XOR nad 4-byte bloky
2. Bit rotace závislá na φ-powers
3. Finální Keccak-256 komprese → 32 B výstup

---

## 3. Fork logika

```rust
// core/src/blockchain/block.rs
pub const CH_V3_FORK_HEIGHT: u64 = 0;  // CHv3 od genesis

// cosmic-harmony/src/algorithms_opt.rs
pub const CHV3_MEMORY_HARD_FORK_HEIGHT: u64 = 50_000;
```

| Výška bloku | Chování |
|-------------|---------|
| 0 – 49 999 | CHv3 **bez** memory-hard scratchpadu (Phase 4 přeskočena) |
| ≥ 50 000 | CHv3 **s** memory-hard scratchpadem (plný 5-fázový pipeline) |

**Runtime overrides** (jen pro testování, NE mainnet):
- `ZION_CHV3_MEMORY_HARD_DISABLE=1` — vynutí přeskočení Phase 4
- `ZION_CHV3_MEMORY_HARD_FORCE=1` — vynutí Phase 4 i pod fork výškou

---

## 4. Difficulty Adjustment — LWMA

ZION používá **Linearly Weighted Moving Average** (LWMA), identický s Monero/Grin/LOKI.

```rust
// core/src/blockchain/consensus.rs
pub const TARGET_BLOCK_TIME: u64 = 60;  // 60 sekund
pub const LWMA_WINDOW: u64 = 60;        // 60 bloků
```

| Parametr | Hodnota |
|----------|---------|
| Target block time | 60 s |
| Window size | 60 bloků (1 hodina) |
| Timestamp clamp | `[−N×T, +6×T]` |
| Min difficulty | 1 |

**Vzorec:**

$$D_{next} = \frac{\sum_{i=1}^{N} i \cdot D_i \cdot T_{target}}{\sum_{i=1}^{N} i \cdot \Delta t_i}$$

kde $N$ = LWMA\_WINDOW, $D_i$ = difficulty bloku $i$, $\Delta t_i$ = solve time.

---

## 5. Block header & template blob

### 5.1 Template blob layout (165 B)

```
Offset  Velikost  Pole
──────  ────────  ────
0       4 B       version (u32 LE)
4       8 B       height (u64 LE)
12      64 B      prev_hash (ASCII hex, zero-padded)
76      64 B      merkle_root (ASCII hex, zero-padded)
140     8 B       timestamp (u64 LE)
148     8 B       difficulty (u64 LE)
156     1 B       algorithm (u8: 0=CH, 1=Blake3, 2=RandomX, 3=Yescrypt)
157     8 B       nonce placeholder (u64 LE, miner fills)
```

### 5.2 Hash vstup

CHv3 hasher přijímá **prvních 80 B** template blobu + nonce jako separátní u64 parametr:

```rust
let h = cosmic_harmony_v3_with_height(&blob, nonce, height);
// h.data = [u8; 32]
```

### 5.3 PoW target validace

Prvních 4 bajty hashe → u32 (little-endian):

```
state0 = u32::from_le_bytes(hash[0..4])
meets_target = (state0 <= target_u32)
difficulty = u32::MAX / state0
```

---

## 6. Reward schedule

| Parametr | Hodnota |
|----------|---------|
| Total supply | 144 000 000 000 ZION |
| Premine (genesis) | 16 780 000 000 ZION (11.65%) |
| Mining emission | 127 220 000 000 ZION |
| Block reward | 5 400.067 ZION |
| Emise trvání | 45 let |
| Bloků ročně | 525 600 |
| Total mining blocks | 23 652 000 |
| Atomic units | 1 ZION = 1 000 000 units |

Emise je **konstantní** (flat) — žádný halving. Po výšce 23 652 000 je reward 0.

---

## 7. Timestamp validace

| Síť | Max drift |
|-----|-----------|
| Testnet | 86 400 s (24 h) |
| Mainnet | 7 200 s (2 h) |

Blok je odmítnut pokud `block.timestamp > prev.timestamp + MAX_DRIFT`.

---

## 8. CHv3 unifikace (v2.9.6)

Od verze v2.9.6:

- **Jediný PoW**: `CosmicHarmony` = CHv3 (v core, pool i miner)
- **Odstraněno**: CH v1 (12 rundů, u32 nonce, XOR bridge), CH v2 (4MB scratchpad)
- **Archivováno**: `archive/legacy-algorithms/`
- **Kanonická funkce**: `cosmic_harmony_v3_with_height(blob, nonce, height)`

Validační řetězec:
```
Miner → cosmic_harmony_v3_with_height() → hash[32]
Pool  → cosmic_harmony_v3_with_height() → hash[32]  (share validace)
Node  → cosmic_harmony_v3_with_height() → hash[32]  (block validace)
```

Všechny tři komponenty volají identickou funkci — žádná divergence.
