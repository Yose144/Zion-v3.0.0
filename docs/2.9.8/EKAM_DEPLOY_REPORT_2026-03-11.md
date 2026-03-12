# ZION 2.9.8 — Ekam Deeksha Deploy Report

> **Datum:** 2026-03-11  
> **Síť:** testnet  
> **Host:** `91.98.122.165`  
> **Rozsah:** clean reset chainu + rebuild `core/pool/miner` + live mining validace

---

## Shrnutí

Na jediném aktivním infrastrukturním hostu `91.98.122.165` byl dokončen plný Ekam Deeksha rollout od genesis.

Výsledek:

- canonical path běží od výšky `0`
- chain po resetu znovu rostl
- pool přijímal share bez rejectů
- miner těžil přes `algo=cosmic_harmony`
- build problém v poolu byl opraven v repu i na serveru

---

## Výchozí stav před zásahem

- na serveru běžel starší testnet chain kolem height `1063`
- host obsahoval kontejnery `zion-core`, `zion-pool`, `zion-miner`, `zion-website`, `zion-redis`, `zion-seed-1`, `zion-seed-2`
- uživatel explicitně rozhodl, že Ekam Deeksha má běžet od genesis a stack se má celý restartovat

---

## Nasazené rozhodnutí

- `CHV_EKAM_FORK_HEIGHT = 0`
- jediný live deploy target: `91.98.122.165`
- topologie: single primary host + interní seed kontejnery
- compose profil: `docker/docker-compose.testnet.yml`

---

## Provedené kroky

### 1. Sync kódu na server

Na server byly potvrzeny tyto klíčové změny:

- `L1/cosmic-harmony/src/deeksha.rs`
- `L1/cosmic-harmony/src/scratchpad_ekam.rs`
- GPU kernel assets pro OpenCL/CUDA/Metal
- Python mining wrapper soubory v `APP&WEB/desktop-agent/resources/mining/`

### 2. Nalezený build blocker v poolu

Serverový Docker build poolu selhal, i když lokální `cargo check -p zion-pool` procházel.

Root cause:

- `L1/pool/src/gpu_mining.rs` mělo parametry `_stats` a `_write_half`
- v blocích za `#[cfg(feature = "native-ethash")]` a `#[cfg(feature = "native-autolykos")]` se ale používaly identifikátory `stats` a `write_half`
- bez feature flagů se chyba lokálně neukázala
- Docker build feature flagy aktivoval a kompilace spadla

Fix:

- parametry byly přejmenovány na `stats` a `write_half`
- obě cesty byly lokálně ověřeny přes:
  - `cargo check -p zion-pool`
  - `cargo check -p zion-pool --features native-ethash,native-autolykos,native-kheavyhash`

### 3. Rebuild image na serveru

Úspěšně znovu sestaveno:

- `zion-core:2.9.8`
- `zion-pool:2.9.8`
- `zion-miner:2.9.8`

### 4. Clean reset chainu

Byl zastaven stack, smazány data volumes a znovu vytvořeny external volumes:

- `docker_seed1-testnet-data`
- `docker_seed2-testnet-data`
- `pool-testnet-data`
- `zion-testnet-data`

### 5. Restart stacku

Kritické zjištění:

- start bez `--env-file .env` ponechá `REDIS_PASSWORD` prázdný
- Redis pak končí na chybě `requirepass wrong number of arguments`

Správný start:

```bash
cd /root/zion-2.9.6
docker compose -f docker/docker-compose.testnet.yml --env-file .env up -d
```

---

## Live validace po restartu

### Core

- `get_info` vrátil po startu height `4`
- následně height `5`
- po 30 sekundách height `7`
- difficulty rostla `1209 -> 2015`

### Miner

Snapshot z mineru:

- `1.23 kH/s`
- `accepted: 61`
- `rejected: 0`
- worker: `testnet-miner-91`
- algo: `cosmic_harmony`

### Pool

Snapshot z pool API/logů:

- hashrate `101.63 H/s`
- connected `true`
- `Share ACCEPTED` potvrzeno v logu
- `BLOCK FOUND` potvrzeno v logu pro height `5`
- reward split log potvrzuje model `89 / 5 / 5 / 1`

---

## Aktuální live kontejnery

| Kontejner | Stav | Image |
|---|---|---|
| `zion-core` | healthy | `zion-core:2.9.8` |
| `zion-pool` | healthy | `zion-pool:2.9.8` |
| `zion-miner` | up | `zion-miner:2.9.8` |
| `zion-redis` | healthy | `redis:7-alpine` |
| `zion-seed-1` | up | `zion-core:2.9.8` |
| `zion-seed-2` | up | `zion-core:2.9.8` |
| `zion-website` | healthy | `zion-website:2.9.6` |

---

## Operativní závěry

1. Ekam Deeksha je na live testnet hostu opravdu aktivní od genesis.
2. Single-host topologie s interními seedy je provozně funkční.
3. Pool build musí být validován i s feature flagy, ne jen default `cargo check`.
4. Compose operace pro tento stack musí explicitně používat `.env`.

---

## Navazující source of truth

- root infra: `SERVERS.md`
- live snapshot: `LIVESTATS.md`
- status souhrn: `STATUS_REPORT_2026-03-10.md`
- starý 3-server snapshot: `DEPLOY_REPORT_2.9.8.md` pouze jako historický kontext