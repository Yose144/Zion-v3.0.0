# ZION v2.9.7 — CHv4.2 Dokumentace Index

## Hiranyagarbha — Zlatý Střed Cesty k Nirváně

| Soubor | Obsah |
|--------|-------|
| [ROADMAP_2.9.7.md](ROADMAP_2.9.7.md) | Unified roadmap 2.9.7 (fáze 0–5, milestones, závislosti) |
| [CHV4_1_HIRANYAGARBHA_PART1.md](CHV4_1_HIRANYAGARBHA_PART1.md) | Merkabah, 22 Pólů Vědomí, Zlatý Střed |
| [CHV4_1_HIRANYAGARBHA_PART2.md](CHV4_1_HIRANYAGARBHA_PART2.md) | 24 Tattev, Hrubá/Jemná hmota, Brahma-jyoti |
| [CHV4_2_UPGRADE_SPEC.md](CHV4_2_UPGRADE_SPEC.md) | Kompletní CHv4.2 specifikace + implementace |

---

## CHv4.1 „Golden Middle" — Produkční Stav

| Parametr | Hodnota | Status |
|----------|---------|--------|
| SCRATCHPAD_SIZE | 64 KiB | ✅ |
| BLOCK_COUNT | 1024 | ✅ |
| PASSES | 2 | ✅ |
| RANDOM_READS | 64 | ✅ |
| Rust testy | 64/64 PASS | ✅ |
| Pool E2E | 11/11 PASS | ✅ |
| Rust/C parity | shoda | ✅ |
| Reference hash | `655348e35abb6732cf0229a3b5fa0827ee5424f36d92e515827030b843cdc4b0` | ✅ |
| Deploy (Helsinki/USA/Asia) | 2026-03-05 commit `b7496ad` | ✅ |

---

## CHv4.2 „Merkabah Dual-Spin" — Implementace Dokončena

> **Status: ✅ PLNĚ IMPLEMENTOVÁNO** — 5. března 2026, commit `b7496ad`

| Oblast | Stav | Detail |
|--------|------|--------|
| Specifikace | ✅ | [CHV4_2_UPGRADE_SPEC.md](CHV4_2_UPGRADE_SPEC.md) |
| `hic.rs` | ✅ | `HIC[22]`, `BACKWARD_PASSES=2`, `KABALA_READS=22`, `KEY_ROUNDS=22` |
| `scratchpad.rs` | ✅ | `memory_hard_transform_v4_2()`, `merkabah_backward_passes()`, `kabala_phase()`, `brahma_jyoti_finalize()` |
| `algorithms_opt.rs` | ✅ | `cosmic_harmony_v4_2()`, `CHV4_2_FORK_HEIGHT=u64::MAX` |
| OpenCL kernel | ✅ | `CL_BACKWARD_PASSES=2`, `CL_KABALA_READS=22`, `HIC[22]` |
| CUDA kernel | ✅ | `CUDA_BACKWARD_PASSES=2`, `CUDA_KABALA_READS=22`, `HIC[22]` |
| Metal shader | ✅ | `METAL_BACKWARD_PASSES=2`, `HIC[22]` |
| C native lib | ✅ | `cosmic_harmony_v4_2_hash()`, parity potvrzen |
| Python OpenCL miner | ✅ | CHv4.2 defines |
| Rust testy | ✅ | **72/72 PASS** (8 nových CHv4.2 testů) |
| Pool E2E testy | ✅ | 11/11 PASS |
| Rust/C parity | ✅ | oba produkují `4fa66192c0e9b154...` |
| Testnet config | ✅ | `chv4_2_fork_height = 10000` |
| Deploy Helsinki/USA/Asia | ✅ | 2026-03-05 nohup build + restart |
| Fork aktivace mainnet | ⏳ | `CHV4_2_FORK_HEIGHT = u64::MAX` → čeká community vote |

### Reference Vektory (potvrzené: Rust == C native)

```
Input: header = "ZION block header v2.9.6" + 56×0x00, nonce = 12345

CHv4.1 (Golden Middle):
  655348e35abb6732cf0229a3b5fa0827ee5424f36d92e515827030b843cdc4b0  ✅

CHv4.2 (Merkabah Dual-Spin):
  4fa66192c0e9b154e3d33c94c1533850ae871f2affa8ccc74952ee9ca074f32f  ✅
```

### Klíčové implementační soubory (commit `b7496ad`, 13 souborů, 743 insertions)

```
L1/cosmic-harmony/src/hic.rs                                    🆕 nový
L1/cosmic-harmony/src/scratchpad.rs                             ✏️  upraveno
L1/cosmic-harmony/src/algorithms_opt.rs                         ✏️  upraveno
L1/miner/src/miner/gpu/kernels/cosmic_harmony_v3.cl             ✏️  upraveno
L1/miner/src/miner/gpu/kernels/cosmic_harmony_v3.cu             ✏️  upraveno
L1/native-libs/all/cosmic_harmony_v4_native.c                   ✏️  upraveno
L1/native-libs/all/cosmic_harmony_v4_metal.metal                ✏️  upraveno
APP&WEB/desktop-agent/resources/cosmic_harmony_v4_metal.metal   ✏️  upraveno
APP&WEB/desktop-agent/resources/mining/cosmic_harmony_v3_gpu.py ✏️  upraveno
config/testnet.toml  (chv4_2_fork_height = 10000)               ✏️  upraveno
config/mainnet.toml  (# chv4_2_fork_height = TBD)               ✏️  komentář
```

---

## Filosofická Dokumentace

| Soubor | Téma |
|--------|------|
| [CHV4_1_HIRANYAGARBHA_PART1.md](CHV4_1_HIRANYAGARBHA_PART1.md) | Merkabah (Ka/Ra dualita), 22 pólů vědomí, Zlatý střed v cache hierarchii |
| [CHV4_1_HIRANYAGARBHA_PART2.md](CHV4_1_HIRANYAGARBHA_PART2.md) | 24 Tattev (tabulka), Bhagavad Gíta 7.4-5 + 13.1-3, Pancha Kosha, Brahma-jyoti |

---

*Poslední aktualizace: 5. března 2026 — CHv4.2 implementace dokončena, nasazeno na Helsinki / USA / Asia.*
