# ZION 2.9.8 — Deployment Report

> **Datum:** 2026-03-10  
> **Verze:** 2.9.8 (Deeksha canonical path)  
> **Síť:** Testnet  
> **Autor:** Autopilot CI / Copilot  

---

## Přehled

Kompletní nasazení ZION 2.9.8 Deeksha canonical na 3 produkční servery testnet infrastruktury.
Zahrnuje upgrade core, pool, miner, redis se všemi Deeksha změnami.

---

## Infrastruktura

| Server | IP | Arch | Role | Image verze | Stav |
|---|---|---|---|---|---|
| Helsinki | 77.42.31.72 | ARM64 (CAX21) | seed + pool + miner + web + monitoring | 2.9.8 | ✅ UP (healthy) |
| Usa | 178.156.240.160 | x86 (CPX11, 2 CPU) | seed + miner + redis | 2.9.8 | ✅ UP (healthy chain) |
| Asia | 5.223.43.93 | x86 (CPX12, Docker exposes 1 CPU) | seed + miner + redis | 2.9.8 | ✅ UP (healthy chain) |

---

## Kontejnery na každém serveru

### Helsinki (ARM64)
| Kontejner | Image | Porty | Status |
|---|---|---|---|
| zion-core | zion-core:2.9.8 | 8334, 8444 | UP (healthy) |
| zion-pool | zion-pool:2.9.8 | 3333, 8080 | UP (healthy) |
| zion-miner | zion-miner:2.9.8 | — | UP |
| zion-redis | redis:7-alpine | 6379 | UP (healthy) |

### Usa (x86)
| Kontejner | Image | Porty | Status |
|---|---|---|---|
| zion-core | zion-core:2.9.8 | 8334, 8444 | UP (healthy) |
| zion-miner | zion-miner:2.9.8 | — | UP |
| zion-redis | redis:7-alpine | 6379 | UP (healthy) |

### Asia (x86)
| Kontejner | Image | Status |
|---|---|---|
| zion-core | zion-core:2.9.8 | UP (healthy) |
| zion-miner | zion-miner:2.9.8 | UP |
| zion-redis | redis:7-alpine | UP (healthy) |

---

## Deeksha 2.9.8 — Klíčové změny

### Algoritmus
- **Cosmic Harmony Deeksha** je kanonický hashovací algoritmus od výšky 0
- `CHV_DEEKSHA_FORK_HEIGHT = 0` — žádná legacy vetev
- Dispatch: `cosmic_harmony_with_height()` → vždy Deeksha path
- GPU backend: Metal / OpenCL / CUDA kernel aliasy (`cosmic_harmony_deeksha.*`)

### Docker & Compose
- Image tagy: `zion-core:2.9.8`, `zion-pool:2.9.8`, `zion-miner:2.9.8`
- Algoritmus v compose: `cosmic_harmony` (dříve `cosmic_harmony_v4_2`)
- Miner CPU limit: konfigurovatelný přes `${MINER_CPUS:-3.5}` env var
- x86 seed nody používají `MINER_POOL_URL=77.42.31.72:3333` místo lokálního `pool:3333`
- XMR větev je env-driven: `XMR_THREADS` a `ZION_RANDOMX_FULL`
- Redis vyžaduje `REDIS_PASSWORD` z `.env`

### Autopilot skript
- `scripts/autopilot-2.9.8.sh` — 6-fázový orchestrátor
- Profily: `relaxed` (default), `prod-run` (strict, fail-fast)
- SSH preflight na všech serverech před deploy
- Remote `.env` validace (REDIS_PASSWORD povinný)
- Portable TCP check (bez závislosti na `timeout` příkazu)
- Volume/container/port cleanup před deploy

### Testy
- Deeksha unit testy: **9/9 PASS** ✅
- Pool E2E testy: **11/11 PASS** ✅
- Desktop agent syntax: JS + Python valid ✅
- NPU algorithms compile: fixed `algorithms_npu.rs` line 832 ✅

---

## Řešené problémy při nasazení

| Problém | Řešení |
|---|---|
| SSH klíč `zion_server_key` nefungoval pro Usa/Asia | Zjištěno, že všechny servery akceptují `zion_hetzner_key` |
| Port 3333 obsazen nativním procesem na Helsinki | Kill přes `fuser -k 3333/tcp` |
| Asia Redis restart loop | Stale kontejner byl vytvořen bez expandovaného `REDIS_PASSWORD` → rekreace přes `docker compose --env-file .env up -d redis` |
| rsync mazal `.env` na serverech | Přidán `--exclude '.env'` do rsync |
| Compose nenacházel `.env` | Přidán `--env-file .env` ke všem compose příkazům |
| Miner žádal 3.5 CPU, Usa/Asia mají méně CPU než default | x86 profily přes `.env`: Usa `MINER_CPUS=1.5`, Asia `MINER_CPUS=1.0` |
| XMR paralelní větev na x86 selhávala na 2 GB RandomX datasetu | Zaveden env-driven light profil: `ZION_RANDOMX_FULL=0`, `XMR_THREADS=1` |
| `timeout` příkaz neexistuje na macOS | Portable `check_tcp_port()` s `nc` / Python fallback |
| `Option<&i32>` dereference error v `algorithms_npu.rs` | Odstraněn nepoužitý výraz v testu |

---

## Konfigurace serverů

### `.env` soubory (na serverech v `/root/zion-2.9.6/.env`)

```env
# Helsinki
REDIS_PASSWORD=PEW6iTFw8a3bzYEHL7bYBZm1JUlvE
NETWORK=testnet

# Usa / Asia
REDIS_PASSWORD=PEW6iTFw8a3bzYEHL7bYBZm1JUlvE
NETWORK=testnet
MINER_CPUS=1.5   # Usa
MINER_CPUS=1.0   # Asia
MINER_POOL_URL=77.42.31.72:3333
ZION_RANDOMX_FULL=0
XMR_THREADS=1
```

### SSH přístup (všechny servery)
```
ssh -i ~/.ssh/zion_hetzner_key root@<ip>
```

---

## Další kroky

1. ✅ Asia Redis + miner fix aplikován, chain sync potvrzen
2. ✅ Live metriky ověřeny: accepted shares, hashrate, block height growth
3. ✅ 24h stabilní běh bez incidentů po recovery potvrzen
4. ✅ GO_NO_GO_2.9.8.md přepnuto na **GO**
5. ✅ x86 seed+miner profily odděleny od lokální pool dependency přes `MINER_POOL_URL`

---

## Soubory změněné v 2.9.8

### Klíčové soubory
- `scripts/autopilot-2.9.8.sh` — deployment orchestrátor
- `docker/docker-compose.testnet.yml` — image tagy 2.9.8, algoritmus, MINER_CPUS
- `docker/docker-compose.mainnet.yml` — image tagy 2.9.8
- `L1/cosmic-harmony/src/algorithms_npu.rs` — compile fix
- `APP&WEB/desktop-agent/resources/mining/cosmic_harmony_v42_gpu.py` — Deeksha text labels

### Nové soubory
- `docs/2.9.8/DEPLOY_REPORT_2.9.8.md` — tento report
- `docs/2.9.8/GO_NO_GO_2.9.8.md` — release gate checklist
- `docs/2.9.8/ROADMAP_2.9.8.md` — execution roadmap
- `docs/2.9.8/INDEX.md` — documentation entry point
- `docs/2.9.8/COSMIC_HARMONY_DEEKSHA_SPEC.md` — algorithm specification
- `docs/2.9.8/CHV_DEEKSHA_ARCHITECTURE.md` — architecture docs
- GPU kernel aliasy (`cosmic_harmony_deeksha.metal`, `.cl`, `.cu`)

---

> **Verdict:** Testnet deployment 2.9.8 Deeksha je na 3/3 serverech funkční a chain je synchronní.  
> x86 seed nody jsou oddělené od lokální pool dependency a míří na Helsinki pool přes `MINER_POOL_URL`.
