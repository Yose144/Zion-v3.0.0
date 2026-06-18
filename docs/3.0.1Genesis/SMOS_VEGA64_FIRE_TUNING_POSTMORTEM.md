# Post-mortem: SMOS Rig 518837 Vega 64 — Fire OpenCL Deploy & Tuning

> **Date:** 2026-06-13  
> **Rig:** SMOS 518837 (Sapphire Vega 64, 8GB HBM2, gfx900)  
> **Pool:** 77.42.71.94:8444 (MainnetEdge)  
> **Miner:** zion-miner v3.0.42c  
> **Algorithm:** `deeksha_lite_fire`  

---

## 1. Executive Summary

Vega 64 na SMOS prošla iteracemi v1→v9. **Stabilní baseline je v6** — GPU inicializuje OpenCL Fire backend bez chyb a rig těží. Pozdější verze (v7–v9) zavedly změny, které způsobily `CL_INVALID_ARG_SIZE` při `clSetKernelArg` a vrátily rig na CPU-only (0 H/s).

**Pravidlo:** Každá nová verze musí mít **jiné jméno ZIP** (SMOS cacheuje podle URL).

---

## 2. Timeline

| Verze | Čas | Změna | Výsledek |
|-------|-----|-------|----------|
| v1–v5 | 2026-06-13 ranní | Postupné opravy GLIBC, ZIP struktury, hash mismatch | GPU init OK, ale rejecty |
| v6 | 11:11 UTC | **Stabilní baseline** — work_size=16384, local_ws=256, build_opts=`-cl-std=CL1.2`, vram_pct=85% | GPU funguje, ~8 KH/s |
| v7 | 11:23 UTC | Agresivní tuning: local_ws=64, `-cl-denorms-are-zero`, vram_pct=92%, odstranění `aligned(8)` z kernelu | Runtime chyby |
| v8 | 11:31 UTC | Revert gpu_guard.rs a kernelu zpět na v6 parametry | Pořád `CL_INVALID_ARG_SIZE` — SMOS cache? |
| v9 | 17:53 UTC | Revert Metal buffer-args na scalary (kernel + host) | **Fail** — stejná chyba, navíc GLIBC 2.34/2.39 z WSL Ubuntu 24.04 |
| **v6 revert** | 19:56 UTC | Group config vrácen na v6 ZIP | **OK** — rig těží |

---

## 3. Root Cause: Proč v7–v9 Failovaly

### 3.1 `CL_INVALID_ARG_SIZE` (-51)
**Chyba:** `clSetKernelArg('deeksha_lite_fire_mine')` hlásí nesedící velikost argumentu.

**Postupné podezřelé změny:**
1. v6: kernel používá `ulong nonce_base`, `uint nonce_count` (scalary) → **funguje**
2. v7: změny v build opts a local_ws, ale kernel stejný → možná cache problém
3. v8: revert, ale chyba zůstává → **SMOS cache nebo stale binary na rigu**
4. v9: změna kernelu na `__global const ulong *nonce_base_buf` (Metal fix) a zpět na scalary → chyba zůstala

**Závěr:** Pravděpodobně v7/v8 **poškodily něco lokálně na rigu** (cache, extrahovaný obsah), nebo binárka v9 byla buildována v **Ubuntu 24.04** (GLIBC 2.34/2.39) místo Ubuntu 20.04 (GLIBC 2.31) a sama se nespustila.

### 3.2 GLIBC kompatibilita
| Build prostředí | Max GLIBC | SMOS kompatibilní? |
|-----------------|-----------|-------------------|
| WSL Ubuntu 20.04 (Focal) | 2.31 | **Ano** |
| WSL Ubuntu 24.04 (Noble) | 2.39 | **Ne** — `version 'GLIBC_2.34' not found` |
| Docker `ubuntu:20.04` | 2.31 | **Ano** — ideální |

**v6 byla buildována přes Docker** na edge serveru (Ubuntu 20.04 builder). **v9 byla buildována lokálně ve WSL** (Ubuntu 24.04) — proto má v sobě GLIBC 2.34 a 2.39 symboly.

---

## 4. Stabilní Parametry (v6)

```rust
// gpu_guard.rs / GpuTuning::auto_tune
work_size: 16384,
local_ws: 256,
build_opts: "-cl-std=CL1.2",
vram_pct: 85,
```

**Kernel signature (fungující):**
```opencl
__kernel void deeksha_lite_fire_mine(
    __global const ulong *header_keccak_state,
    ulong  nonce_base,       // ← scalar
    uint   nonce_count,      // ← scalar
    __global uchar *output_hashes,
    __global uchar *scratchpad_pool)
```

**Host builder (fungující):**
```rust
let kernel = pro_que
    .kernel_builder("deeksha_lite_fire_mine")
    .arg(&header_state_buf)
    .arg(0u64)
    .arg(0u32)
    .arg(&output_hashes_buf)
    .arg(&scratchpad_buf)
    .build()?;

// V mine_batch:
self.kernel.set_arg(1, current_nonce)?;
self.kernel.set_arg(2, chunk as u32)?;
```

---

## 5. Build & Deploy Pipeline

### 5.1 Docker build (doporučený)
```bash
# Na edge serveru (Ubuntu 20.04, Docker)
cd /root/zion-2.9.6-main/V3
docker build -f docker/Dockerfile.miner-smos -t zion-miner-smos .
# Extract:
docker create --name extract zion-miner-smos
docker cp extract:/usr/local/bin/zion-miner ./zion-miner-smos
docker rm extract
```

### 5.2 ZIP pro SMOS (důležité: jeden root folder)
```bash
mkdir -p zion-sm3042c-fire-vN
# Miner wrapper
#!/bin/bash
exec ./zion-miner "$@"
chmod +x zion-sm3042c-fire-vN/miner
# Binárka
cp zion-miner zion-sm3042c-fire-vN/
zip -r zion-sm3042c-fire-vN.zip zion-sm3042c-fire-vN
```

### 5.3 Edge server upload
```bash
scp zion-sm3042c-fire-vN.zip root@77.42.71.94:/var/www/zion-miner/
```

### 5.4 SMOS group update
```python
API = "https://api.simplemining.net"
GROUP = 1773590
RIG = 518837
MINER_URL = "http://77.42.71.94/zion-miner/zion-sm3042c-fire-v6.zip"
OPTS = (
    "--algorithm deeksha_lite_fire "
    "--pool 77.42.71.94:8444 "
    "--wallet zion16825y2v5f3q507e5c2e0j8n666z43558l3zt604 "
    "--worker vega-smos "
    "--api-enable"
)
```

**Vždy vyčistit cache před reload:**
```bash
rm -rf /root/miner/custom_* /var/tmp/miner/custom_*
```

---

## 6. Provedené Patche (v6 baseline)

- **DCR backdoor odstraněn** (`dcr_worker.rs`, `dcr_gpu.rs`, `dcr_hash.rs`, `dcr_stratum.rs`, `dcr_blake3_mine.cl`)
- **GPU/CPU hash mismatch fix** — `gpu_scan_job()` používá GPU hash jako primární, CPU jen pro audit
- **Algorithm-aware share validation** — `submit_solution()` bere `algorithm` parametr
- **RDNA1 detection fix** — RX 5700 XT (gfx1010) už není misdetectována jako GCN
- **GPU fallback fix** — `gpu_available` se už nezamyká na `false` po první chybě

---

## 7. Doporučení pro Další Iterace

1. **Builduj vždy v Docker `ubuntu:20.04`** nebo WSL Ubuntu 20.04 — nikdy v 24.04.
2. **Každá verze = nové ZIP jméno** — SMOS cacheuje podle URL.
3. **Před každým testem vyčistit cache** na rigu.
4. **Vega 64 OC:** Core clock 1450 MHz pro cíl ~10 KH/s (aktuálně ~8 KH/s bez OC).
5. **Nepoužívat buffer args pro OpenCL** — scalary fungují na AMD i NVIDIA; buffer args jsou jen pro Metal.
6. **Pool a miner musí být z téže source verze** — stratum protocol není backward compatible.

---

## 8. Appendix: Pool Env Vars (Edge)

```bash
ZION_POOL_BIND=0.0.0.0:8444
ZION_POOL_LOOP_COUNT=1000000
ZION_NONCE_COUNT=4096        # CPU miners
ZION_NONCE_COUNT_GPU=524288  # GPU miners
```

---

*Generated with [Devin](https://cli.devin.ai/docs)*  
*Session: 2026-06-13, v6 stable deploy + v9 failure analysis*
