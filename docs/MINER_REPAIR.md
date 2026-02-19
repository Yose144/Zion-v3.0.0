# MINER REPAIR REPORT

**Datum:** 19. února 2026  
**Verze:** 2.9.6  
**Stav:** 🔴 GPU share stále rejected — CPU verifikace přidána, čeká se na diagnostiku

---

## Přehled problému

GPU mining běží (AMD Radeon RX 5600/5700, ~40-64 MH/s), ale **100 % share je odmítáno poolem** s důvodem:
```
Does not meet target difficulty
```

CPU mining funguje korektně — share jsou přijímány. Problém je výhradně v GPU OpenCL kernelu.

---

## Co bylo opraveno (Session 1-5)

### 1. Desktop Agent startup
- **Bug:** `&` v cestě způsoboval crash Electronu
- **Fix:** `scripts/launch-electron.js` — spuštění přes Node.js child_process

### 2. GPU Buffer Overflow
- **Bug:** Header buffer nebyl dostatečně velký pro OpenCL
- **Fix:** Padding na 144 bytes v `opencl.rs`

### 3. CL_INVALID_WORK_GROUP_SIZE (-54)
- **Bug:** local_work_size překračoval device maximum
- **Fix:** Query `max_wg_size()`, cap na 256, round-up global work size

### 4. CPU throttle + Revenue logging
- **Fix:** `yield_now()` + `sleep(ZION_CPU_SLEEP_MS)` mezi batche (default 1ms)
- **Fix:** Pool rejection logy nyní zobrazují skutečný důvod (code + message)

### 5. GPU Kernel — kompletní rewrite (Session 6)
Původní kernel měl **3 kritické bugy**:

| Fáze | Bug | Fix |
|------|-----|-----|
| GoldenMatrix | Špatný algoritmus (XOR/rotate) | Byte matrix × PHI_POWERS_FP, sum >> 32 |
| CosmicFusion | Špatný algoritmus (simple mixing) | 4× Keccak-256 + XOR COSMIC_XOR_MASK + SHA3-512 |
| Target check | Špatné porovnání (u64 stage2) | u32 LE z hash[0..4] <= target_u32 |

Kernel `cosmic_harmony_v3.cl` přepsán z 242 na 292 řádků.

---

## Aktuální stav (Session 7) — GPU share stále rejected

### Pozorování
- Pool výška: h15–h19 (pod 50,000 = pod memory-hard fork)
- Pool i miner používají `cosmic_harmony_v3_legacy()` (bez scratchpadu) → OK
- Pool **vždy přepočítává hash** z (blob, nonce, height) — nikdy nevěří miner result
- Pool endian: `cosmic_state0_endian = "little"` → `u32::from_le_bytes(hash[0..4])`
- Miner posílá nonce jako `format!("{:08x}", nonce as u32)` → pool parsuje `u32::from_str_radix`

### Podezřelé oblasti (ke zkoumání)

1. **Keccak-256 implementace v GPU**
   - GPU: manuální padding `0x01` (Keccak, ne SHA3)
   - CPU: `sha3::Keccak256` crate
   - Potřeba: ověřit identický výstup na známých test vektorech

2. **SHA3-512 implementace v GPU**
   - GPU: padding `0x06`, rate=72B (9 words)
   - CPU: `sha3::Sha3_512` crate
   - Potřeba: ověřit identický výstup

3. **GoldenMatrix — akumulátor overflow?**
   - GPU: `ulong` (u64) akumulátor
   - CPU: `u128` akumulátor
   - Analýza: max součet 8 termů ≈ 1.2e16 → vejde se do u64 (max 1.8e19)
   - Pravděpodobně OK, ale nutno empiricky ověřit

4. **Blob formát — header délka**
   - Template blob: 165 bytes (version+height+prev_hash+merkle+timestamp+difficulty+algo+nonce)
   - GPU kernel: používá prvních 80 bytes + 8B nonce = 88B
   - CPU (`cosmic_harmony_v3_legacy`): `input[..80]` z blob + nonce LE
   - **Potenciální problém:** blob je 165B, GPU bere prvních 80B, ale CPU také bere prvních 80B → mělo by být OK

5. **Nonce truncation**
   - GPU kernel pracuje s `u64 nonce` ale submit dělá `nonce as u32`
   - Pokud GPU nonce > u32::MAX, pool dostane oříznutou hodnotu → jiný hash
   - `nonce_start` začíná od 0 a inkrementuje per-batch → po ~4B hashů (4M batch × ~1000 batchů) překročí u32
   - **MOŽNÁ ROOT CAUSE** pokud miner běží dlouho

### Přidaná diagnostika (Session 7)

Do `mod.rs` GPU loop přidána **CPU verifikace každého GPU share**:
```rust
// ═══ GPU→CPU verification: re-hash on CPU and compare ═══
let cpu_hash = cosmic_harmony_v3_with_height(&blob_bytes, nonce, job.height);
log::warn!("🔬 GPU→CPU verify: nonce={} gpu_hash={} cpu_hash={} ...");
```

Toto ukáže:
- Jestli GPU a CPU produkují **stejný hash** pro stejný (blob, nonce)
- Pokud ne → bug v OpenCL kernelu (Keccak/SHA3/GoldenMatrix/CosmicFusion)
- Pokud ano → bug v target check nebo nonce handling

---

## Další kroky

1. **Build a spustit miner s diagnostikou**
   ```
   cargo build --release -p zion-miner --features gpu
   ```

2. **Analyzovat GPU→CPU verify logy**
   - Pokud `gpu_hash != cpu_hash` → kernel bug, porovnat mezikroky
   - Pokud `gpu_hash == cpu_hash` → target/nonce bug

3. **Pokud kernel bug:**
   - Napsat Rust unit test s known test vectors pro Keccak-256(88B)
   - Porovnat s GPU výstupem
   - Opravit konkrétní fázi

4. **Pokud nonce bug:**
   - Zajistit `nonce_start` nepřekročí u32::MAX
   - Nebo změnit submit na u64

5. **Po opravě:**
   - Build → deploy → test na Helsinki pool
   - Ověřit accepted share

---

## Soubory modifikované

| Soubor | Popis |
|--------|-------|
| `L1/miner/src/miner/gpu/kernels/cosmic_harmony_v3.cl` | Kompletní rewrite kernelu (292 řádků) |
| `L1/miner/src/miner/gpu/opencl.rs` | target u32, header cap 80B, batch 4M, local_ws 256 |
| `L1/miner/src/miner/mod.rs` | GPU batch 4M, CPU verifikace GPU share, is_gpu_mineable |
| `L1/miner/src/miner/cpu.rs` | CPU throttle, lepší rejection logging |
| `L1/miner/src/stratum/mod.rs` | Skutečný pool rejection reason v logu |

---

## Session 8 — Desktop Agent na macOS M1 (CPU mining opraveno)

**Datum:** aktuální session  
**Platforma:** Apple M1, macOS (developer machine)  
**Binárka:** `APP&WEB/desktop-agent/resources/zion-universal-miner` (arm64 Mach-O, 4.8 MB, self-contained Rust)

### Symptom

Desktop Agent opakovaně zobrazoval "Mining stopped" ihned po pokusu o spuštění.
Log diagnostiky:
```
minerExists: true
dllExists: {cosmic: false, yescrypt: false, randomx: false}   ← diagnostika, neblokuje
nativeLibsDir: false, nativeLibCount: 0                       ← diagnostika, neblokuje
```

### Root cause #1 — execute bit chybí

`zion-universal-miner` byl uložen bez execute bitu (`-rw-r--r--`).
`spawn()` v Node.js → EACCES → okamžitý exit → "Mining stopped".

**Fix (trvalý):** přidáno do `main.js` těsně před každý `spawn()`:
```javascript
if (process.platform !== 'win32') {
  try { require('fs').chmodSync(spawnCommand, 0o755); } catch { }
}
```

### Root cause #2 — `--gpu` flag na M1

Agent předával `--gpu` i na macOS. M1 nemá OpenCL; miner zkusí OpenCL inicializaci
→ selže → exit → "Mining stopped". M1 používá Metal API interně (bez flagů).

**Fix:** v `main.js` (line 1946):
```javascript
// bylo:  if (effectiveGpu) args.push('--gpu');
if (effectiveGpu && process.platform !== 'darwin') args.push('--gpu');
```

### Výsledek po opravě

Manuální test (`chmod +x` + spuštění bez `--gpu`):
```
SPEED   10s  850.37 kH/s
SHARES  A: 12   R: 0   rate: 100.0%
ncl     ENABLED [CoreML] 11.0 TFLOPS    ← NCL funguje na M1 přes CoreML!
```
Připojeno na Helsinki pool, 12 přijatých share, 0 odmítnutých.

### Commit

`699dc44` — `fix(agent): macOS GPU flag + chmod+x pred spawn`

---

## Infrastruktura

- **GPU (AMD server):** AMD Radeon RX 5600/5700 (gfx1010, 18 CU, 6128 MB)
- **CPU (AMD server):** AMD Ryzen 5 3600 6-Core
- **M1 Mac (dev):** Apple M1, arm64, Metal GPU (CoreML NCL)
- **Pool:** Helsinki 77.42.31.72:3333 (Docker zion-pool:2.9.6-testnet)
- **SSH:** `ssh -i ~/.ssh/zion_hetzner_key root@77.42.31.72`
- **Build (Linux):** `cargo build --release -p zion-miner --features gpu`
- **Deploy (Linux):** Copy `target/release/zion-miner.exe` → `APP&WEB/desktop-agent/resources/zion-universal-miner.exe`
