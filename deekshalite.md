# DeekshaLite v1 — Deployment Status & Runbook

> Datum: 2026-06-07
> Verze: v3.0.0-dev
> Autor: Devin

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
| URL | `https://zionterranova.com/zion-miner/zion-sm3033d.zip` |

**Status**: ❌ **BLOKOVÁNO** — rig stále používá starou binárku

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

### 3.3 Problém #3: Vega 64 OpenCL kernel chyba (známé)

Na Vega 64 (gfx900, ROCm 5.16.16) kernel `deeksha_lite.cl` neprojde kompilací:

```
error: passing 'const __global uchar *' to parameter of type
        'const __private uchar *' changes address space of pointer
bytes_to_ulong8(pad + off, chunk64);
```

**Důvod**: Funkce `bytes_to_ulong8` a `ulong_from_bytes` mají parametry v `__private` adresovém prostoru, ale předává se jim `__global` pointer z OpenCL bufferu.

**Následek**: Miner padne na CPU fallback (`gpu_init_fallback using=cpu`).

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
| `zion-sm3033d.zip` | `https://zionterranova.com/zion-miner/zion-sm3033d.zip` | **STARÝ** — obsahuje starou binárku |
| `zion-sm3036.zip` | `https://zionterranova.com/zion-miner/zion-sm3036.zip` | **NOVÝ** — SMOS binárka + DeekshaLite kernel |

⚠️ **Důležité**: Aktuální SMOS Group Config (`Zion-`) má URL `zion-sm3033d.zip`, který SMOS cachuje. Musí se změnit na `zion-sm3036.zip`.

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
   - Na: `https://zionterranova.com/zion-miner/zion-sm3036.zip --pool 77.42.71.94:8444 --wallet zion1w2z3l0q2x5e3q752d3v8k5k3u366j5j3t79n5w3 --worker vega-smos`
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

**Priorita**: HIGH

Kernel `deeksha_lite.cl` nefunguje na Vega 64 (gfx900) kvůli address space chybě.

**Možná řešení**:
1. Odstranit `const` qualifier z parametrů `bytes_to_ulong8` a `ulong_from_bytes`
2. Použít `__constant` místo `__private` pro lookup tabulky
3. Přidat `__global` overload pro bufferové operace

**Soubor**: `V3/L1/cosmic-harmony/src/gpu/kernels/deeksha_lite.cl`

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
*Další pokračování: oprava Vega 64 OpenCL kernel + dokončení SMOS deploy*
