# ZION Desktop Agent — CHv4 Comprehensive Upgrade Plan

> **Verze:** 2.9.6 → 2.9.7 desktop agent upgrade  
> **Datum:** 2026-03-04  
> **Cíl:** Plná CHv4 podpora v desktop agentu — Rust GPU Metal M1, Python native, dylib bundling

---

## Stav před upgradem (analýza)

### Co JE hotové (v codebase)

| Komponenta | Soubor | Stav |
|---|---|---|
| Metal shader CHv4 | `L1/cosmic-harmony/src/gpu/metal_shader.metal` (697 ř.) | ✅ Plná CHv4 s NPU+scratchpad |
| Metal miner Rust | `L1/cosmic-harmony/src/gpu/metal_miner.rs` (641 ř.) | ✅ NPU váhy + scratchpad buffer |
| Rust `cosmic_harmony_v4()` | `algorithms_opt.rs` | ✅ CHv4 pipeline |
| Rust `find_nonce_parallel()` | `algorithms_opt.rs` | ✅ rayon parallel mining |
| Rust thread-local scratchpad | `scratchpad.rs` | ✅ 512 KiB per thread |
| NPU parity fix | `algorithms_npu.rs` l.232 | ✅ `(b as i8) as i32` |
| `libcosmic_harmony.dylib` | `L1/libcosmic_harmony.dylib` (67 KB, arm64) | ✅ Existuje |
| `cosmic_harmony_v4_native.py` | `resources/mining/cosmic_harmony_v4_native.py` | ✅ ctypes FFI, 457 ř. |
| C native lib source | `L1/native-libs/all/cosmic_harmony_v4_native.c` | ✅ 1826 ř., parity fix `f0ebf20` |
| Build skript | `L1/native-libs/all/build_macos.sh` | ✅ CHv4 sekce |

### Co CHYBÍ / je ROZBITÉ

| Problém | Dopad |
|---|---|
| `is_gpu_mineable(CosmicHarmony)` = `false` | **M1 Metal GPU je vypnuté** → mining na CPU fallback |
| `resources/native-libs/` prázdné | Python `cosmic_harmony_v4_native.py` nemůže načíst dylib |
| `prepare-rust-miner.js` nekopíruje `L1/libcosmic_harmony.dylib` | dylib nikdy nedorazí do resources |
| Python stratum miner (`zion_native_miner_v2_9.py`) používá CHv3 hash | `cosmic_harmony_v4_native.py` existuje ale není použito pro mining |
| Rust miner kompilován bez `--features parallel` | Rayon parallel batch není aktivní |

---

## Plán implementace

### A. Fix `is_gpu_mineable` → M1 Metal CHv4 re-enable

**Soubor:** `L1/miner/src/miner/mod.rs`  
**Změna:** Řádek `Algorithm::CosmicHarmony => false` → `true` (Metal only)

```rust
Algorithm::CosmicHarmony => matches!(platform, gpu::GpuPlatform::Metal),
```

**Důvod:** Metal shader je plně implementovaný pro CHv4 (NPU + 512 KiB scratchpad). Parity fix byl aplikován (commit `f0ebf20`). Blokáda byla nouzový workaround.

---

### B. Rebuild libcosmic_harmony.dylib

**Příkaz:**
```bash
cd L1/native-libs/all && bash build_macos.sh
```

Výsledek: `libcosmic_harmony.dylib` + `libcosmic_harmony_v4.dylib` zkopírovány do `L1/`.

---

### C. Bundle dylib do agent resources

**Cíl:** `APP&WEB/desktop-agent/resources/native-libs/libcosmic_harmony.dylib`

**Postup:**
1. Přidání `L1/libcosmic_harmony.dylib` jako explicitní search path do `prepare-rust-miner.js`
2. Skript kopíruje dylib do `resources/native-libs/`
3. Python `cosmic_harmony_v4_native.py` hledá dylib v `resources/native-libs/` → najde

---

### D. prepare-rust-miner.js — oprava bundlování dylib

**Soubor:** `APP&WEB/desktop-agent/scripts/prepare-rust-miner.js`

Přidat do `nativeSearchPaths`:
```js
path.join(workspaceRoot, 'L1'),   // libcosmic_harmony.dylib ze L1/ root
```

Explicitně zkopírovat `libcosmic_harmony.dylib`:
```js
// Special: always bundle libcosmic_harmony.dylib from L1/ root
const explicitDylib = path.join(workspaceRoot, 'L1', `libcosmic_harmony${libExt}`);
if (fs.existsSync(explicitDylib)) {
  fs.copyFileSync(explicitDylib, path.join(nativeLibDir, `libcosmic_harmony${libExt}`));
  console.log(`[prepare-rust-miner] ✅ Bundled libcosmic_harmony${libExt}`);
}
```

---

### E. Python miner upgrade — CHv4 native jako primární hash engine

**Soubor:** `APP&WEB/desktop-agent/resources/zion_native_miner_v2_9.py`

**Změny:**
1. Import `cosmic_harmony_v4_native.py` (CosmicHarmonyV4Native) jako **primární** hash engine
2. Fallback na CHv3 Python pokud dylib není dostupný
3. Přidání dylib search path pro `resources/native-libs/` (relativně k miner skriptu)

**Architektura Python mineru:**
```
CosmicHarmonyV4Native (dylib ctypes)  ← PRIMÁRNÍ (multi-thread, ~70 H/s)
    ↓ fallback (dylib missing)
CosmicHarmonyV3Python (pure Python)   ← ZÁLOHA
```

---

### F. Rebuild Rust miner s `--features metal,parallel`

```bash
cd /Users/yeshuae/Projects/2.9.6
cargo build -p zion-miner --release --features metal,parallel
cp target/release/zion-miner "APP&WEB/desktop-agent/resources/zion-universal-miner"
chmod +x "APP&WEB/desktop-agent/resources/zion-universal-miner"
```

**Přidané schopnosti:**
- `metal`: M1 Metal GPU backend aktivní
- `parallel`: rayon parallel CPU batch mining aktivní

---

### G. Parity test — Rust == C dylib

```bash
cargo test -p zion-cosmic-harmony-v3 --release -- parity 2>&1
```

Pokud test neexistuje, spustit manuální validaci:
```bash
python3 APP&WEB/desktop-agent/resources/mining/cosmic_harmony_v4_native.py test
```

---

### H. main.js — Python CHv4 mining path

**Soubor:** `APP&WEB/desktop-agent/src/main.js`

**Stav:** Python mining path existuje, ale odkazuje na `cosmic_harmony_v3_python.py`.  
**Změna:** Prioritizovat `cosmic_harmony_v4_native.py` + dylib cestu.

Klíčový řádek 1241:
```js
'mining/cosmic_harmony_v3_python.py',
```
→ přidat `cosmic_harmony_v4_native.py` jako preferovaný Python miner (nebo zajistit,  
  že `zion_native_miner_v2_9.py` sám vybere CHv4).

---

## Očekávané výsledky po upgradu

| Metrika | Před | Po |
|---|---|---|
| GPU mining (M1 Metal) | ❌ zakázáno (is_gpu_mineable=false) | ✅ aktivní, ~40-50 MH/s |
| Python hash engine | CHv3 pure Python (<1 H/s) | CHv4 native dylib (70+ H/s) |
| dylib v resources | ❌ chybí | ✅ `resources/native-libs/libcosmic_harmony.dylib` |
| CPU parallel mining | 1 vlákno | rayon N vláken |
| Hash parity | --- | CPU == C dylib == Metal GPU |

---

## Soubory dotčené upgradem

| Soubor | Změna |
|---|---|
| `L1/miner/src/miner/mod.rs` | `is_gpu_mineable`: CosmicHarmony → true na Metal |
| `APP&WEB/desktop-agent/scripts/prepare-rust-miner.js` | přidat L1/ do dylib search paths |
| `APP&WEB/desktop-agent/resources/zion_native_miner_v2_9.py` | upgrade CHv3→CHv4 hash engine |
| `APP&WEB/desktop-agent/resources/zion-universal-miner` | rebuild s metal+parallel features |
| `APP&WEB/desktop-agent/resources/native-libs/libcosmic_harmony.dylib` | nový soubor (bundled) |

---

## Rizika a mitigace

| Riziko | Pravděpodobnost | Mitigace |
|---|---|---|
| Metal shader hash ≠ Rust CPU hash | Nízká (parity fix aplikován `f0ebf20`) | Parity test před deploymentem |
| dylib load selhání (quarantine macOS) | Střední | `xattr -dr com.apple.quarantine` po kopii |
| Scratchpad 512 KiB × batch → OOM na M1 | Střední | Omezit batch size Metal na 2M-4M |
| Python ctypes segfault na starší dylib | Nízká | Rebuild dylib před bundlováním |

---

## Stav implementace

- [x] Plán napsán
- [x] B: Rebuild libcosmic_harmony.dylib (67 KB, arm64, sha256 parity OK)
- [x] C+D: Bundle dylib do `resources/native-libs/`, fix `prepare-rust-miner.js`
- [x] E: Python miner CHv4 upgrade (`_CHv4CompatWrapper`, `COSMIC_V4_AVAILABLE`)
- [x] A+F: Fix `is_gpu_mineable` CosmicHarmony → true (Metal) + Rust rebuild metal+parallel (42.5s)
- [x] G: Parity test → `134f268c...` Rust == C == Python(dylib) ✅
- [x] H: main.js Python path fine-tuning (quarantine xattr, binaryNames update)
- [x] `cosmic_harmony_v4_native.py` search path + `resources/native-libs/`
- [x] `L1/miner/Cargo.toml` — `parallel` feature přidán
- [x] Commit + push

---

*Autor: GitHub Copilot (ZION AI Native) | 2026-03-04*
