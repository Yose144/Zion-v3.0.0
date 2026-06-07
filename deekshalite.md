# DeekshaLite v1 — Deployment Status & Runbook

> Datum: 2026-06-07
> Verze: v3.0.0-dev
> Autor: Devin
> Update: v3.0.25+ (keccak_f1600 Rho+Pi fix + CPU/GPU unification)

---

## 1. Co je DeekshaLite v1

DeekshaLite je zjednodušený ASIC-odolný algoritmus nahrazující původní `cosmic_harmony_ekam_deeksha_v2`.

- **Výhody**: méně paměťově náročný, lepší kompatibilita s AMD GCN (Vega), nižší DAG
- **Aktivace**: pool-side přes `ZION_POOL_ALGORITHM=deeksha_lite_v1`
- **Fallback**: staré minery s `cosmic_harmony_ekam_deeksha_v2` jsou poolem odmítány

---

## 2. Stav jednotlivých komponent

### 2.1 Pool (Edge server — 77.42.71.94:8444)

| Parametr | Hodnota |
|----------|---------|
| Algoritmus | `deeksha_lite_v1` |
| Binary | `/usr/local/bin/zion-pool-server` |
| Systemd | `zion-edge-pool.service` |
| Env var | `ZION_POOL_ALGORITHM=deeksha_lite_v1` |
| Welcome msg | `algorithm="deeksha_lite_v1"` |
| Share validation | `candidate.hash_with_algorithm(&config.algorithm)` |

**Status**: ✅ Běží, odmítá staré minery správně.

```
Error: unsupported miner algorithm: expected deeksha_lite_v1, got cosmic_harmony_ekam_deeksha_v2
```

### 2.2 Lokální GPU test (RX 5600 XT, Windows)

| Parametr | Hodnota |
|----------|---------|
| GPU | AMD RX 5600 XT (gfx1010:xnack-) |
| Backend | OpenCL |
| Welcome | `algorithm="deeksha_lite_v1"` ✅ |
| GPU init | `gpu_opencl_lite_init` ✅ |
| Share | **ACCEPTED** (100.0%) ✅ |

**Status**: ✅ Lokální test prošel end-to-end.

### 2.3 SMOS rig (Rig 518837, Vega 64)

| Parametr | Hodnota |
|----------|---------|
| Rig ID | 518837 |
| GPU | RX Vega 64 (gfx900) |
| OS | SimpleMining OS (Ubuntu 20.04, kernel 5.15.80) |
| Group Config | `Zion-` (ID 1773590) |
| URL | `https://zionterranova.com/zion-miner/zion-sm3037.zip` |

**Status**: ⏳ **ČEKÁ NA SMOS DASHBOARD UPDATE** — nová binárka připravena, čeká na změnu URL v Group Config

---

## 3. Proč SMOS rig nefunguje (root cause)

### 3.1 Problém #1: Cachovaná stará binárka

SMOS agresivně cachuje stažený miner v `/root/miner/custom_zion-sm3033d/`. 
- `reload` ani `reboot` **nevynutí** nové stažení zipu
- SMOS stahuje nový zip pouze při změně URL v Group Config

### 3.2 Problém #2: GLIBC nekompatibilita (vyřešeno)

Původní binárka buildnutá na Edge serveru (Ubuntu 22.04) vyžadovala GLIBC 2.32–2.34.
SMOS používá Ubuntu 20.04 (GLIBC 2.31) → staré minery crashovaly.

**Řešení**: Build přes Docker s `rust:1.85-bullseye` (Debian 11) + `ubuntu:20.04` runtime.
Výsledná binárka vyžaduje pouze GLIBC_2.2.5.

### 3.3 Problém #3: GPU backend vždy volil cosmic_harmony_deeksha.cl (vyřešeno)

`create_gpu_backend()` vždy inicializoval `OpenClDeekshaMiner`, který načítá `cosmic_harmony_deeksha.cl`.
Při `algorithm="deeksha_lite_v1"` se tedy používal špatný kernel.

**Řešení** (commit `8e4c7cad`):
- `create_gpu_backend()` nyní přijímá parametr `algorithm`
- Pro `deeksha_lite_v1` vytvoří `OpenClDeekshaLiteMiner` s `deeksha_lite.cl` kernelem
- Pro ostatní algoritmy použije původní `OpenClDeekshaMiner`

### 3.4 Problém #4: Vega 64 OpenCL address space chyby (vyřešeno)

Kernel `deeksha_lite.cl` obsahoval pointer casty `((uchar *)st)` uvnitř keccak funkcí,
 které GCN kompilátor (gfx900) odmítá.

**Řešení** (commit `8e4c7cad`):
- Odstraněny všechny `((uchar *)st)` casty
- Nahrazeno pomocnými funkcemi `dl_xor_byte_into_state` a `dl_get_byte_from_state`
- Přidány explicitní `__private` address space kvalifikátory pro všechny lokální parametry

### 3.5 Problém #5: keccak_f1600 špatná Rho+Pi implementace → GPU vs CPU hash mismatch (vyřešeno)

**Root cause**: Kernel `deeksha_lite.cl` měl špatnou Rho+Pi část v `keccak_f1600` — používal loop s pomocnými poli `bc0..bc4`, která produkovala nesprávné výsledky na AMD GFX1010/RDNA (RX 5600 XT).

Navíc CPU reference v `deeksha_lite.rs` se lišila od GPU v:
1. **Scratchpad fill**: CPU používal Blake3 XOF, GPU SHA3-512 chain → neshoda v každém bloku
2. **random_read_mix idx**: CPU použil `u32` ze 4 bytů, GPU `u32` z 8 bytů → neshoda od první iterace
3. **Finální hash step 4**: CPU používal Blake3-256, GPU Keccak256 → jiný výstup

**Řešení** (commit `217f6ac7`):
- `keccak_f1600` přepsán s kanonickým 23-prvkovým lineárním swap chainem z `cosmic_harmony_deeksha.cl`
- `ROL64` používá `rotate(long, long)` formu — oprava AMD GCN/RDNA hardware bugu s unsigned rotate
- CPU `deeksha_lite.rs` (V3 produkce) přepsán: SHA3-512 fill, u64 idx ze 8 bytů, Keccak256 finál
- Ověřeno: 16/16 nonces MATCH na GPU (RX 5600 XT, gfx1010:xnack-) vs CPU
- 125/125 Rust testů prochází (`cargo test -p zion-cosmic-harmony`)

**Parametry V3 produkce** (musí souhlasit CPU ↔ GPU):

| Parametr | Hodnota |
|---|---|
| SCRATCHPAD_SIZE | 262 144 B (256 KiB) |
| BLOCK_COUNT | 8 192 |
| BLOCK_SIZE | 32 B |
| PASSES | 2 |
| RANDOM_READS | 64 |

---

## 4. Připravené artefakty na serveru

### 4.1 Binárky

| Soubor | Cesta | Popis |
|--------|-------|-------|
| SMOS kompatibilní | `/var/www/zion-miner/zion-miner-smos` | Ubuntu 20.04, GLIBC 2.2.5 |
| Edge release | `/usr/local/bin/zion-pool-server` | Pool server |
| Edge build | `/root/2.9.6-main/V3/target/release/zion-miner` | Lokální |

### 4.2 ZIPy

| Soubor | URL | Obsah |
|--------|-----|-------|
| `zion-sm3038.zip` | `https://zionterranova.com/zion-miner/zion-sm3038.zip` | **NEJNOVěJŠÍ** ⏳ sestavit — keccak_f1600 Rho+Pi fix + CPU/GPU hash unification (commit `217f6ac7`) |
| `zion-sm3037.zip` | `https://zionterranova.com/zion-miner/zion-sm3037.zip` | Předchozí — GCN address space fixes, ale hash stále nesprávný (commit `8e4c7cad`) |
| `zion-sm3036.zip` | `https://zionterranova.com/zion-miner/zion-sm3036.zip` | Starý — bez GCN fixů |
| `zion-sm3033d.zip` | `https://zionterranova.com/zion-miner/zion-sm3033d.zip` | **ZASTARALÝ** — stará binárka |

⚠️ **Důležité**: Aktuální SMOS Group Config (`Zion-`) má URL `zion-sm3033d.zip`, který SMOS cachuje. Po sestavení `zion-sm3038.zip` musí se změnit na tuto URL.

> **Poznámka**: `zion-sm3038.zip` je třeba teprve sestavit (Docker build na Edge) a nahrát na server.

### 4.3 Docker build

```bash
cd /root/2.9.6-main/V3
docker build --no-cache -f docker/Dockerfile.miner-smos -t zion-miner-smos .
```

Dockerfile používá:
- Builder: `rust:1.85-bullseye` (GLIBC 2.31 kompatibilní)
- Runtime: `ubuntu:20.04` + `ocl-icd-libopencl1`

---

## 5. Návod k manuálnímu dokončení deploy

### Krok 1: Přihlásit se do SMOS dashboard

1. Otevřít `https://simplemining.net`
2. Přihlásit se (`omnity.company@gmail.com`)
3. Jít do **Rigs** → najít **ZionRig** (ID 518837)

### Krok 2: Aktualizovat Group Config

1. Jít do **Group Configs**
2. Najít config **Zion-** (ID 1773590)
3. Změnit **Miner URL / Options**:
   - Ze: `https://zionterranova.com/zion-miner/zion-sm3033d.zip --pool 77.42.71.94:8444 --wallet zion1w2z3l0q2x5e3q752d3v8k5k3u366j5j3t79n5w3 --worker vega-smos`
   - Na: `https://zionterranova.com/zion-miner/zion-sm3037.zip --pool 77.42.71.94:8444 --wallet zion1w2z3l0q2x5e3q752d3v8k5k3u366j5j3t79n5w3 --worker vega-smos`
4. Uložit config

### Krok 3: Reload rigu

1. V dashboard kliknout na **Reload** nebo **Reboot** pro rig 518837
2. Počkat ~30 sekund, až rig nabootuje
3. Kontrolovat console

### Krok 4: Ověření

V console by mělo být vidět:

```
wire_hello={"type":"hello","miner_id":"local-miner","worker_name":"vega-smos",
            "algorithm":"deeksha_lite_v1",...}
```

A pool by měl přijmout share:

```
accepted 1/0 (+1) diff 178 [Xms] (100.0%)
```

---

## 6. Známé problémy k vyřešení

### 6.1 Vega 64 OpenCL kernel

**Priorita**: ✅ **VYŘEŠENO** (commity `8e4c7cad` + `217f6ac7`)

- GPU backend správně vybírá `deeksha_lite.cl` pro `algorithm="deeksha_lite_v1"`
- Address space pointer casty odstraněny pomocí `dl_xor_byte_into_state` / `dl_get_byte_from_state`
- Explicitní `__private` kvalifikátory pro GCN kompatibilitu
- `keccak_f1600` Rho+Pi kanonická implementace (23-prvkový swap chain), `ROL64` jako `rotate(long,long)`
- CPU a GPU pipeline plně sjednoceny: SHA3-512 fill, u64 idx, Keccak256 finál, 256 KiB / 8192 bloků

### 6.4 SMOS zion-sm3038.zip — čeká na Docker build

**Priorita**: HIGH

Po commitu `217f6ac7` je třeba:
1. SSH na Edge: `ssh root@77.42.71.94`
2. Pull nejnovější kód: `cd /root/2.9.6-main && git pull`
3. Docker build SMOS binárky: `docker build --no-cache -f V3/docker/Dockerfile.miner-smos -t zion-miner-smos .`
4. Extrahovat binárku a zabalit do `zion-sm3038.zip` (viz sekce 4.3 níže)
5. Nahrát na server: `cp /tmp/zion-sm3038.zip /var/www/zion-miner/`
6. Aktualizovat SMOS Group Config URL na `zion-sm3038.zip`

### 6.2 Automatický SMOS deploy

**Priorita**: MEDIUM

SMOS API neumožňuje update Group Config miner URL. 
V budoucnu zvážit vlastní deploy agent na SMOS rig.

### 6.3 Pool odmítá staré minery

**Priorita**: LOW (očekávané chování)

Dokud všechny rigy nejsou updatované, staré minery budou odmítány.
Doba odmítnutí: ~15–60 sekund mezi reconnecty.

---

## 7. Git commits

| Commit | Popis |
|--------|-------|
| `217f6ac7` | **fix(deeksha_lite): keccak_f1600 Rho+Pi fix + CPU/GPU pipeline unification** |
| `8e4c7cad` | fix(gpu): DeekshaLite kernel selection + GCN address space fixes |
| `3f72021d` | dual-algo: pool + miner + core dual-algo support for DeekshaLite v1 |
| `869a35fd` | pool: welcome message uses config.algorithm instead of consensus_profile |
| `58acd104` | miner: default algorithm to deeksha_lite_v1 for SMOS rigs |
| `6460094a` | gpu(opencl): include deeksha_lite.cl kernel source |
| `f52d39a6` | docker: add SMOS-compatible Ubuntu 20.04 miner build |
| `059fe878` | docs: dual-algo deployment guide for DeekshaLite v1 |

---

## 8. Rychlé reference

### Pool status
```bash
# SSH na Edge
ssh root@77.42.71.94

# Kontrola pool logů
journalctl -u zion-edge-pool -n 50 --no-pager

# Kontrola env
systemctl show zion-edge-pool --property=Environment
```

### SMOS API
```bash
# API token: api-7a54810f8c4f608934d2adda0620153b260273737bcfa3279d35265f7d25265c
# Base URL: https://api.simplemining.net

# Zjistit rig
curl -H "X-AUTH-TOKEN: <token>" https://api.simplemining.net/rigs/518837

# Reload rig
curl -X PATCH -H "X-AUTH-TOKEN: <token>" \
  -H "Content-Type: application/merge-patch+json" \
  -d '{"rigIds": [518837]}' \
  https://api.simplemining.net/rigs/execute-reload

# Bash příkaz (cmdBash = commandId 7)
curl -X PATCH -H "X-AUTH-TOKEN: <token>" \
  -H "Content-Type: application/merge-patch+json" \
  -d '{"rigIds": [518837], "commandId": 7, "commandOptions": "<bash>"}' \
  https://api.simplemining.net/rigs/execute-command
```

### Docker build SMOS binárky
```bash
cd /root/2.9.6-main/V3
docker build --no-cache -f docker/Dockerfile.miner-smos -t zion-miner-smos .

# Extrahovat binárku
docker create --name extract zion-miner-smos
docker cp extract:/usr/local/bin/zion-miner /tmp/zion-miner-smos
docker rm extract

# Ověřit GLIBC
readelf -V /tmp/zion-miner-smos | grep GLIBC
```

---

## 9. Kontakt & Escalation

- **Pool / Edge server**: root@77.42.71.94
- **SMOS dashboard**: https://simplemining.net
- **SMOS API docs**: https://api.simplemining.net/docs.html
- **Git repo**: `/root/2.9.6-main` (Edge server)

---

*Dokument vytvořen: 2026-06-07 01:05 UTC*
*Aktualizován: 2026-06-07 09:30 UTC*
*Stav: keccak_f1600 Rho+Pi opraven, CPU a GPU pipeline plně sjednoceny, 125/125 testů prochází. Čeká na Docker build `zion-sm3038.zip` a manuální SMOS dashboard update.*
