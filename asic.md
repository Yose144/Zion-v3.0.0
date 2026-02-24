# CHv3 ASIC Resistance — Technická dokumentace

> Stav: **Mainnet-ready** | Commit: `8a2b295` | Datum: 2026-02-24

---

## Přehled

Cosmic Harmony v3 (CHv3) je proof-of-work algoritmus ZION sítě navržený tak, aby byl
odolný vůči specializovanému hardware (ASIC, FPGA). Hard fork pro aktivaci paměťové
vrstvy je nastaven na blok **100 000**.

---

## Pipeline

```
Vstup (blob + nonce)
    │
    ▼
[1] Keccak-256           (32 B výstup)
    │
    ▼
[2] SHA3-512             (64 B výstup)
    │
    ▼
[3] Golden Matrix        (8×8 matice s fixedpoint φ, 64 B výstup)
    │
    ▼
[4] Memory-Hard Scratchpad  ← aktivní od bloku 100 000
    │   2 MiB scratchpad, 8 průchodů, 1024 pseudo-random čtení
    │
    ▼
[5] Cosmic Fusion        (data-dependent XOR maska, 32 B výstup)
    │
    ▼
Hash (32 B)
```

Pod forkovací výškou (blok < 100 000) se pipeline zkracuje — fáze [4] se přeskakuje
(legacy testnet chování).

---

## Implementované ASIC hardening opatření

### 1. Memory-Hard Scratchpad (fáze 4)

| Parametr | Stará hodnota | Nová hodnota | Důvod |
|---|---|---|---|
| `SCRATCHPAD_SIZE` | 256 KiB | **2 MiB** | Přesahuje SRAM kapacitu reálných ASIC čipů a L2 cache FPGA; nutnost DRAM eliminuje výhodu paralelismu |
| `PASSES` | 4 | **8** | 8 průchodů × 2 MiB = 16 MiB sekvenčního R/W per hash |
| `RANDOM_READS` | 512 | **1024** | 1024 data-dependent náhodných čtení — zvyšuje latency bound |

Soubor: [`L1/cosmic-harmony/src/scratchpad.rs`](L1/cosmic-harmony/src/scratchpad.rs)

### 2. Dynamická XOR maska v Cosmic Fusion (fáze 5)

Původní implementace používala statickou konstantu `COSMIC_XOR_MASK` — ASIC ji mohl
hardwirovat a celou fázi eliminovat. Nahrazena dynamickou derivací v každém kole:

```
maska = Keccak256(state[32..64] || round || 0xAB)
```

- `state[32..64]` se vyvíjí v každém kole (závisí na datech pipeline)
- Doménový separátor `0xAB` odděluje derivaci masky od intermediate hashe
- ASIC nemůže přepočítat výsledek bez provedení celé Keccak256

Soubor: [`L1/cosmic-harmony/src/algorithms_opt.rs`](L1/cosmic-harmony/src/algorithms_opt.rs)

### 3. Fork výška

```rust
pub const CHV3_MEMORY_HARD_FORK_HEIGHT: u64 = 100_000;
```

Před touto výškou běží legacy pipeline (bez scratchpadu) — kompatibilita s testnetem.
Od bloku 100 000 je memory-hard fáze povinná pro všechny uzly.

### 4. Uzamčení env override v produkčním buildu

V `--release` buildu jsou env proměnné `ZION_CHV3_MEMORY_HARD_DISABLE` a
`ZION_CHV3_MEMORY_HARD_FORCE` **deaktivovány** na úrovni kompilátoru:

```rust
fn runtime_memory_hard_override() -> Option<bool> {
    #[cfg(debug_assertions)]
    {
        // env overrides dostupné POUZE v debug/testovacím buildu
    }
    None  // vždy None v release buildu
}
```

Konsenzus v produkci je řízen výhradně `CHV3_MEMORY_HARD_FORK_HEIGHT`.

---

## Integrace v L1

### L1/core — validace bloků

Soubor: [`L1/core/src/blockchain/block.rs`](L1/core/src/blockchain/block.rs)

```rust
let h = zion_cosmic_harmony_v3::algorithms_opt::cosmic_harmony_v3_with_height(
    &blob, nonce, block_height
);
```

Core předává výšku bloku — fork se aktivuje automaticky při dosažení bloku 100 000.

### L1/core — těžba

Soubor: [`L1/core/src/miner/mod.rs`](L1/core/src/miner/mod.rs)

Miner volá `cosmic_harmony::hash(prefix_bytes, nonce, template.height)` přes aliases
vrstvu `L1/core/src/algorithms/mod.rs`, která deleguje na CHv3 crate.

### L1/pool — validace shares

Soubor: [`L1/pool/src/shares/validator.rs`](L1/pool/src/shares/validator.rs)

```rust
algorithms_opt::cosmic_harmony_v3_with_height(&full_blob, nonce as u64, height);
```

Pool validátor přijímá `height` z mining template a plně respektuje fork výšku.
Všechny aliasy (`cosmic_harmony`, `chv3`, `ch3`, `cosmic-harmony-v3`, …) mapují
na stejnou CHv3 implementaci.

---

## Výkon a hardwarové nároky

| Komponenta | Nároky | Poznámka |
|---|---|---|
| RAM per hash | ~2 MiB | Scratchpad alokovaný na stacku/heapu per thread |
| Sekvenční přístup | 16 MiB R/W | 8 průchodů × 2 MiB |
| Keccak256 volání | 2 × 4 = 8 per Fusion | Per hash, 4 kola × 2 Keccak |
| Celkové Keccak256 | ~10+ | Scratchpad init + Fusion + Random reads |

Pro validátory a full nody je doporučeno min. 4 MiB volné RAM na vlákno těžební
pipeline (2 MiB scratchpad + overhead).

---

## Srovnání s ostatními algoritmy

| Algoritmus | Paměť | Důvod ASIC odolnosti |
|---|---|---|
| **CHv3** | 2 MiB | Data-dependent scratchpad + dynamická XOR maska |
| RandomX (Monero) | 2 MB | Náhodný přístup do paměti |
| Ethash (ETH pre-merge) | 1–4 GB | DAG v paměti |
| SHA256 (Bitcoin) | < 1 KB | **Žádná** — ASIC dominuje |

---

## Testování

```bash
# Spuštění testů CHv3
cargo test -p zion-cosmic-harmony-v3

# Relevantní testy:
# test_memory_hard_deterministic    — 2× stejný vstup → stejný výstup
# test_memory_hard_changes_output   — 1 bit rozdíl → jiný výstup
# test_full_pipeline                — deterministická celá pipeline
# test_full_pipeline_matches_opt    — legacy vs full path konzistence
# test_gpu_vs_cpu_full_pipeline     — GPU simulace == CPU implementace
```

---

## Commit history

| Commit | Změna |
|---|---|
| `8a2b295` | CHv3 ASIC hardening: fork@100k, 2MiB scratchpad, dynamic XOR mask |
| `625c3ca` | L3-WARP SQLite persistence + XP bridge |

---

## Odpovědnost

Tento dokument popisuje technické vlastnosti proof-of-work algoritmu.
Aktivace na mainnetu probíhá deterministicky na základě výšky bloku — bez
manuálního zásahu operátorů uzlů.
