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

## Session 9 — Revenue systém E2E verifikace (VRSC→XMR + algo flag)

**Datum:** 19. února 2026  
**Platforma:** Helsinki 77.42.31.72 (ARM64), macOS M1 (agent)

### Root cause #1 — `ZION_CPU_REVENUE_COIN=VRSC` (VerusHash nepodporován)

Pool byl nakonfigurován s `VRSC` jako revenue coinem. Miner binary nepodporuje VerusHash
(`cosmic_harmony · randomx · yescrypt · blake3` — bez verushash). Pool posílal VerusHash
joby → miner mlčky zahodil → 0 hashrate, žádný výstup.

**Fix:** `docker/docker-compose.testnet.yml`:
```
ZION_CPU_REVENUE_COIN=VRSC → ZION_CPU_REVENUE_COIN=XMR
```
Pool se restartoval, výpis potvrzen: `💹 CPU-only mode: Revenue 25% locked to XMR (RandomX → MoneroOcean)`

### Root cause #2 — `revenueArgs` chyběl `--algorithm randomx`

Revenue process byl spouštěn bez `--algorithm` flagu → miner se připojil s defaultním
algoritmem (cosmic_harmony), ale pool mu posílal RandomX job → nesoulad protokolu → odpojení každé 2-3s.

**Fix:** v `main.js` přidán do `revenueArgs`:
```javascript
'--algorithm', 'randomx',  // Revenue group mines XMR via pool (CPU-only mode → RandomX)
```

### Stav po opravách

| Komponenta | Stav |
|---|---|
| Pool revenue proxy → MoneroOcean (XMR) | ✅ `[XMR] ✅ CN Login successful` |
| Job broadcasting → revenue miners | ✅ `📢 New Revenue job (xmr) → broadcasting to 1 Revenue miners` |
| Miner `--algorithm randomx` flag | ✅ přidán (commit níže) |
| xmrig crash na Helsinki (ARM64) | ❌ `exit status: 1` — server-side problém |

### Commits

- `62dedff` — `fix(pool): revenue coin VRSC→XMR (miner nepodporuje VerusHash)`
- *(aktuální)* — `fix(agent): revenue --algorithm randomx flag přidán`

---

## Session 10 — Pool login response: `seed_hash` chyběl (RandomX not initialized)

**Datum:** 19. února 2026  
**Platforma:** Helsinki 77.42.31.72 (ARM64), macOS M1 (dev)

### Root cause — `seed_hash` neuvedena v CN login response

Po opravě `--algorithm randomx` flagu (Session 9) se miner připojil správně. Přesto
RandomX stále odmítalo hashovat s chybou: `RandomX not initialized - call init_randomx() first`.

Diagnóza přes `--debug` flag (`406K řádků logu`):

```
📦 Received job object: {"job_id": "ext-xmr-41947213", "algo": "randomx", ...}
   (NO seed_hash field!)
randomx: missing/invalid seed_hash in job ext-xmr-41947213
🧪 RandomX first hash: ERROR in 1.5µs: RandomX not initialized
```

**Root cause:** `handle_login()` v `server_v2.rs` extrahovala ze scheduled Revenue
jobu `sj.job_id`, `sj.blob`, `sj.height`, `sj.algorithm` — ale **ne** `sj.seed_hash`.
Login response tedy neobsahovala `seed_hash` → miner `cpu.rs` nepovolal
`init_randomx_with_key` → `RANDOMX_KEY` globální RwLock zůstal prázdný →
"RandomX not initialized" při každém pokusu o hash.

**`getjob` handler byl v pořádku** (měl `"seed_hash": sched_job.seed_hash`).
Problém byl výhradně v login response.

**Fix:** `L1/pool/src/stratum/server_v2.rs`, funkce `handle_login()`:

```rust
// Před opravou — seed_hash se neextrahovala:
if let Some(sj) = scheduled_job {
    job_id = sj.job_id.clone();
    blob = sj.blob.clone();
    height = sj.height;
    // ❌ sj.seed_hash nebyla přečtena!
    ...
}

// Po opravě:
let mut seed_hash = String::new();
if let Some(sj) = scheduled_job {
    job_id = sj.job_id.clone();
    blob = sj.blob.clone();
    height = sj.height;
    seed_hash = sj.seed_hash.clone(); // ✅ Needed for RandomX initialization
    ...
}

// Login response nyní obsahuje:
"job": {
    "blob": blob, "job_id": job_id, "target": target,
    "difficulty": diff, "height": height, "algo": algorithm,
    "seed_hash": seed_hash,   // ✅ Required for RandomX (XMR revenue jobs)
    "cosmic_state0_endian": Self::COSMIC_STATE0_ENDIAN
}
```

### Fixes & commits

| Fix | Commit |
|---|---|
| Wallet validator P2WSH (20..=45 → 20..=90) | `81c4229` |
| `seed_hash` v CN login response | `de3f0e9` |

### Rebuild pool image

Po commitu fixů byl zdrojový kód rsyncnut na Helsinki (`/root/zion-build/`) a
pool Docker image přebuildován:

```bash
rsync -a --exclude='target/' L1/ root@77.42.31.72:/root/zion-build/L1/
rsync -a docker/Dockerfile.pool Cargo.toml Cargo.lock root@77.42.31.72:/root/zion-build/
ssh root@77.42.31.72 'cd /root/zion-build && nohup docker build -f Dockerfile.pool -t zion-pool:2.9.6-testnet . > /root/docker-build.log 2>&1 &'
# Restart pool containeru:
ssh root@77.42.31.72 'docker stop zion-pool && docker rm zion-pool'
ssh root@77.42.31.72 'docker run -d --name zion-pool --network docker_zion-net \
  --restart unless-stopped -p 3333:3333 -p 8080:8080 \
  -v pool-testnet-data:/data/zion-pool \
  -v /root/Zion-2.9.5/config/ch3_revenue_settings.json:/config/ch3_revenue_settings.json:ro \
  -v /usr/local/bin/xmrig:/usr/local/bin/xmrig:ro \
  -e REDIS_URL="redis://:ZionTestNet2025SecureR3d1s@redis:6379" \
  -e ZION_REVENUE_CONFIG=/config/ch3_revenue_settings.json \
  -e ZION_CPU_REVENUE_COIN=XMR -e ZION_HAS_GPU=0 \
  -e RUST_LOG=info -e ZION_CORE_RPC=http://core:8444/jsonrpc \
  zion-pool:2.9.6-testnet'
```

### E2E verifikace (po rebuildu pool image)

```
✅ RandomX initialized with key (len=32, hash=ce1fc29930bbbc08...)
SPEED   10s 21.60 H/s   algo: randomx
pool: stratum+tcp://77.42.31.72:3333   worker: Jose--MacBook-Pro.local
```

Miner se připojil, dostal login response se `seed_hash`, inicializoval RandomX a ihned hashuje 21 H/s.

### Pool xmrig (server-side)

```
📊 xmrig: 213.8 H/s | accepted=1 rejected=0
```

Pool's own xmrig (MoneroOcean) stabilní, přijímá shares.

### Root cause: Dockerfile glibc mismatch

xmrig binárka na hostu vyžaduje GLIBC_2.38, container měl Debian Bookworm (glibc 2.36):
```
/usr/local/bin/xmrig: /lib/aarch64-linux-gnu/libc.so.6: version 'GLIBC_2.38' not found
```

**Fix:** Změna runtime stage v `Dockerfile.pool`:
```dockerfile
# Bylo:
FROM debian:bookworm-slim   # glibc 2.36
# Teď:
FROM ubuntu:24.04            # glibc 2.39 ✅
```

### Root cause: Rust 1.85 neznámá `is_multiple_of()` (stable od 1.86)

Build selhal s:
```
error[E0658]: use of unstable library feature `unsigned_is_multiple_of`
  --> L1/cosmic-harmony/src/engine.rs:45
  --> L1/pool/src/merged_mining.rs:88
```

**Fix:** nahradit `.is_multiple_of(N)` → `% N == 0` (backwards compatible).

---

## Infrastruktura

- **GPU (AMD server):** AMD Radeon RX 5600/5700 (gfx1010, 18 CU, 6128 MB)
- **CPU (AMD server):** AMD Ryzen 5 3600 6-Core
- **M1 Mac (dev):** Apple M1, arm64, Metal GPU (CoreML NCL)
- **Pool:** Helsinki 77.42.31.72:3333 (Docker zion-pool:2.9.6-testnet)
- **SSH:** `ssh -i ~/.ssh/zion_hetzner_key root@77.42.31.72`
- **Build (Linux):** `cargo build --release -p zion-miner --features gpu`
- **Deploy (Linux):** Copy `target/release/zion-miner.exe` → `APP&WEB/desktop-agent/resources/zion-universal-miner.exe`
