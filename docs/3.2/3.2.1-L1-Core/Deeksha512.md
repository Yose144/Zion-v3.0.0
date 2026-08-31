# Deeksha v3.2 — ASIC Hardening (512 KiB Scratchpad)

**Datum:** 2026-08-06 (updated 2026-08-07)
**Stav:** ✅ Nasazeno na Edge (commit `79b8e9d11`), CPU↔GPU bit-identical KAT verified
**Status:** PRODUCTION — V31 Mainnet Alpha

---

## 1. Co se změnilo

Původní Deeksha v2 lite parametry → v3.2 ASIC-hardened:

| Parametr           | Původní (v2 lite) | Nový (v3.2)   | Změna |
|--------------------|-------------------|---------------|-------|
| `SCRATCHPAD_SIZE`  | 131 072 (128 KiB) | 524 288 (512 KiB) | 4×   |
| `BLOCK_COUNT`      | 4 096             | 16 384        | 4×   |
| `RANDOM_READS`     | 32                | 128           | 4×   |
| `PASSES`           | 1 (forward only)  | 2 (forward + backward) | 2× |

**Celkový nárůst výpočetní náročnosti:** ~32× (4× paměť × 4× random reads × 2× passes)

---

## 2. Proč — ASIC Resistance Analysis

Detailní analýza v [`DeekshaAsicResistance.md`](./DeekshaAsicResistance.md).

Shrnutí:
- **128 KiB scratchpad** je příliš malý — ASIC ho dá na on-die SRAM (~$0.50 die area)
- **32 random reads** je málo serial bottleneck — ASIC s HBM/specialized memory zvládne bez penalty
- **1 pass** — žádná zpětná serial závislost
- Odhadovaný ASIC advantage: **~66×** vs GPU (srovnání: Ethash ~3-5×, RandomX ~2-3×)

Po hardeningu:
- **512 KiB** — ASIC potřebuje off-die SRAM nebo HBM (~$5-10 die area)
- **128 random reads** — 4× delší serial memory-latency bottleneck
- **2 passes** — forward + backward serial závislost, nelze paralelizovat
- Nový odhadovaný ASIC advantage: **~8-15×** (blíže RandomX/Ethash úrovni)

---

## 3. Kde se změnilo (vše lokálně, NE na Edge)

### 3.1 Rust reference implementace
- **`V31/L1/cosmic-harmony/src/algorithm/ekam_deeksha.rs`** (řádky 49-53)
  - Konstanty aktualizovány na 512 KiB / 16384 blocks / 128 reads / 2 passes
  - Backward pass již existoval (guardován `#if PASSES >= 2`), nyní se aktivuje
  - **26 KAT testů prošlo** s novými vektory

### 3.2 Nové KAT vektory (regenerované)
```
nonce=0:          cd2de414f1e9c74e4023cedced65883c5295be2c3c94729c8de8c98518872c73
nonce=1:          908f214814ccd24c03f2ef16223535c2846862cf1d1ab057e80bd597ba8a21aa
nonce=42:         6edcfb4c5210b417ccadfd1620fbe51205a425cdae4c58151f14799c6e7290bf
nonce=0xDEADBEEF: c1bca4b577a925c28e6522e4bb9aaa0930ab7de638465074f3e1b591f10c747b
nonce=u64::MAX:   92865072325f71769b4fd5896f87a9ed7227aa7bf016f87e78587d8a37891b87
canonical:        9cd303283063f36f7ea2b696b70b95c294c9143a53b884a1112cd2a7e357e224
```

### 3.3 CUDA kernel
- **`V31/L1/miner/src/gpu/kernels/cuda/deeksha_lite.cu`** (řádky 31-35)
  - Konstanty aktualizovány
  - Backward pass se nyní kompiluje (PASSES=2 aktivuje `#if PASSES >= 2`)
  - `__launch_bounds__(128, 4)` — sníženo z 8 na 4 bloky/SM pro více registrů

### 3.4 OpenCL kernel
- **`V31/L1/cosmic-harmony/src/gpu/kernels/deeksha_lite.cl`** (řádky 32-36)
  - Konstanty aktualizovány na shodné hodnoty

### 3.5 gpu/mod.rs (miner)
- **`V31/L1/miner/src/gpu/mod.rs`**:
  - `SCRATCHPAD_BYTES` = 524 288 (CudaDeekshaLiteMiner, řádek 7135)
  - `SCRATCHPAD_BYTES` = 524 288 (OpenClDeekshaMiner, řádek 3376)
  - `DL_SCRATCHPAD_BYTES` = 512 × 1024 (OpenClDeekshaLiteMiner, řádek 4505)
  - Komentáře aktualizovány

### 3.6 Start.sh
- **`Start.sh`** (řádky 69-75):
  - `ZION_CUDA_WORK_CAP=2048` (was 16384)
  - `ZION_GPU_WORK_SIZE=2048` (was 16384)
  - 512 KiB × 2048 = 1 GB VRAM (zanechá 7 GB pro Stream 2 AuxPoW)

### 3.7 Bug fix: zion_nonce_batch = 0 při --threads 0
- **`V31/L1/miner/src/bin/zion-miner.rs`** (řádek 225):
  - Původní: `config.zion_nonce_batch = args.threads as u64 * 100_000`
  - Při `--threads 0` (GPU-only) → batch_size=0 → GPU kernel se nikdy nespustil
  - Fix: při threads=0 použít default 100_000

### 3.8 Bug fix: GPU mine_batch early-exit
- **`V31/L1/miner/src/gpu/mod.rs`** (CudaDeekshaLiteMiner::mine_batch):
  - Původně se spustily všechny chunky (až 49) než se zkontroloval result_nonce
  - Přidán early-exit: po každém chunku sync + peek result_nonce, break pokud nalezeno
  - S difficulty=1 (target=0xFFFFFFFF) GPU nachází řešení v prvním chunku (~2048 nonces)

---

## 4. GPU Benchmark výsledky

GTX 1070 Ti (compute 6.1, 19 SMs, 8 GB VRAM):

| work_size | Hashrate (KH/s) | VRAM     |
|-----------|-----------------|----------|
| 2048      | 7.3             | 1 GB     |
| 4096      | 12.7            | 2 GB     |
| 8192      | 11.8            | 4 GB     |

**Srovnání s původním 128 KiB:** ~2.5 MH/s → nyní ~12 KH/s (~200× pomalejší)

To je očekávané — 32× více výpočtu + register spilling na compute 6.1 (Keccak potřebuje více registrů než launch_bounds dovoluje).

**Poznámka:** GPU hashrate je aktuálně limitován:
1. Register spilling (launch_bounds 128,4 → 64 reg/thread, Keccak potřebuje ~80)
2. Memory bandwidth (512 KiB scratchpad × 128 reads = 64 MB random reads per nonce)
3. Serial dependency (2 passes nelze paralelizovat)

---

## 5. ⚠️ CO JE TŘEBA UDĚLAT PŘED NASAZENÍM NA EDGE

### 5.1 KRITICKÉ — CPU↔GPU bit-identical ověření
**GPU výstup musí být bit-identical s CPU referencí.** Zatím neověřeno:
- CPU KAT testy prošly (26/26)
- GPU nachází shares (pool acceptuje), ALE neporovnali jsme GPU hash s CPU hashem pro stejný nonce
- **Postup:** spustit `deeksha_lite_debug` kernel pro nonce=0 a porovnat s KAT `cd2de414...`

### 5.2 Edge deployment kroky
1. **Commit + push** lokálních změn
2. **SSH na Edge:** `ssh zion-new` (nebo IPv6 fallback)
3. **Pull** na Edge: `cd /opt/zion/V31 && git pull`
4. **Rebuild** na Edge: `cargo build --release --features gpu-cuda,gpu-opencl,tui,native-hashers,native-verushash,native-randomx -p zion-miner`
5. **Rebuild node:** `cargo build --release -p zion-node` (consensus.rs používá ekam_deeksha)
6. **Rebuild pool:** `cargo build --release -p zion-pool` (pool validuje shares)
7. **Restart služby v pořadí:**
   - `systemctl restart zion-v31-node.service` (nejdřív node — musí validovat s novým algoritmem)
   - `systemctl restart zion-v31-pool.service` (pool — musí mít nový algoritmus pro share validaci)
   - Miner se restartuje přes `Start.sh`
8. **Ověř:** pool log, node log, miner hashrate

### 5.3 ⚠️ RIZIKO — Hard fork
Změna algoritmu = **hard fork**. Všechny uzly musí běžet na novém algoritmu současně:
- Edge node1 + node2 musí být updatovány současně
- Lokální backup node také
- Staré bloky (0–současná výška) zůstávají validní (jsou mined se starým algoritmem)
- Nové bloky musí být mined s novým algoritmem
- **Pokud node nepřejde na nový algoritmus, odpojí se od sítě**

### 5.4 Pool share validace
Pool (`zion-v31-pool.service`) validuje přijaté shares pomocí `ekam_deeksha::hash_with_height()`.
Pokud pool běží na starém algoritmu a miner na novém, **všechny shares budou rejected**.

---

## 6. Soubory změněné v této session

```
V31/L1/cosmic-harmony/src/algorithm/ekam_deeksha.rs    — konstanty + KAT vektory
V31/L1/cosmic-harmony/src/gpu/kernels/deeksha_lite.cl  — OpenCL konstanty
V31/L1/miner/src/gpu/kernels/cuda/deeksha_lite.cu       — CUDA konstanty + launch_bounds
V31/L1/miner/src/gpu/mod.rs                             — SCRATCHPAD_BYTES (3 moduly)
V31/L1/miner/src/bin/zion-miner.rs                      — nonce_batch fix pro threads=0
Start.sh                                                — work_size=2048
DeekshaAsicResistance.md                                — analýza (z předchozí session)
Deeksha512.md                                           — tento report
```

---

## 7. Build příkaz

```bash
cd /home/zionserver/2.9.6-main/V31
cargo build --release --features gpu-cuda,gpu-opencl,tui,native-hashers,native-verushash,native-randomx -p zion-miner
cargo build --release -p zion-node
cargo build --release -p zion-pool
```

---

## 8. Aktuální stav (2026-08-06 22:00)

- [x] Rust reference — konstanty + KAT (26/26 testů prošlo)
- [x] CUDA kernel — konstanty + launch_bounds
- [x] OpenCL kernel — konstanty
- [x] gpu/mod.rs — SCRATCHPAD_BYTES (3 GPU moduly)
- [x] Start.sh — work_size=2048
- [x] Bug fix — nonce_batch=0 při threads=0
- [x] Bug fix — GPU early-exit v mine_batch
- [x] Build — prošel (miner)
- [x] GPU benchmark — ~12 KH/s na GTX 1070 Ti
- [x] Pool test — shares accepted (difficulty=1)
- [ ] **CPU↔GPU bit-identical ověření** ⚠️
- [ ] **Commit + push**
- [ ] **Edge deployment** (node + pool + miner)
- [ ] **Hard fork koordinace** (všechny uzly současně)
