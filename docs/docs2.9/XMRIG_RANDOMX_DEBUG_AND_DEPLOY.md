# XMRig / RandomX – Debug & Deploy Guide (ZION 2.8)

This document summarizes what changed, why XMRig showed "login error code: 5", how we fixed it, and how to deploy + verify on Linux so XMRig starts hashing against the pool.

## Current status

- Root cause of code:5: the pool on production sent a non‑Monero blob and a wrong target format.
  - Production response (bad):
    - blob: started with `0606...`, length > 152 hex
    - target: 64‑hex (32 bytes)
  - XMRig expectation (good):
    - 76‑byte hashing blob = 152 hex, typically starting `0d00...` for RandomX era
    - 8‑byte little‑endian target = 16 hex
- Local pool + RPC now produce the correct formats and pass the login smoke test.

## Changes made in repo

- Monero/CryptoNote hashing blob (76 bytes, 152 hex)
  - RPC server: `zion/rpc/server.py::_create_hashing_blob`
    - Packs header: `[major=0x0d][minor=0x00][timestamp LE 4B][prev_hash 32B][merkle_root 32B][nonce 4B]`, padded to 76B.
    - Returned in `getblocktemplate` as `blockhashing_blob`.
  - Pool: `src/core/zion_universal_pool_v2.py::build_monero_hashing_blob`
    - Best‑effort builder with stejným layoutem; používá se v `create_randomx_job` pokud máme template data.
- Target encoding for XMRig
  - Job `target` je 8B LE (16 hex) – generováno v `create_randomx_job()` a posíláno v loginu.
- Robustnost importů
  - `prometheus_client` je volitelný (no‑op fallback), aby běh poolu nic neblokovalo.
- Docker image poolu
  - `docker/Dockerfile.mining-pool`:
    - Instaluje závislosti z `requirements.txt`.
    - Kopíruje celý repozitář (řeší importy v `src/` a `zion/`).
    - Exponuje porty 3333 (Stratum), 3334 (API), 3336 (Cosmic Harmony).
    - Spouští Universal Pool: `python src/core/zion_universal_pool_v2.py`.

## Why XMRig returned code: 5

- XMRig validuje login result podle Monero Stratum:
  - `job.blob` musí být přesně 152 hex (76 B)
  - `job.target` musí být 16 hex (8 B LE)
- Produkce posílala starý formát (delší blob a 64‑hex target), proto miner končil s `login error code: 5`.

## What to deploy (Linux)

- Použij Docker compose stack v `docker/docker-compose.zqal.yml` – služba `mining-pool`.
- Změny v `Dockerfile.mining-pool` přesměrují kontejner na Universal Pool (port 3333), kde je nový Monero‑style login.

### Rebuild & restart only mining‑pool

```bash
cd /path/to/Zion-2.8
chmod +x docker/build.sh
./docker/build.sh

# Spusť jen mining-pool (ne celý stack)
docker-compose -f docker/docker-compose.zqal.yml up -d --build mining-pool

# Stav a logy
docker-compose -f docker/docker-compose.zqal.yml ps
docker-compose -f docker/docker-compose.zqal.yml logs -f mining-pool
```

Tipy:
- Pokud používáš starý compose plugin `docker compose`, uprav příkazy podle své verze.
- Ujisti se, že port 3333 hostu směruje na správný container `zion-mining-pool`.

## Smoke tests (po restartu)

1) RPC getblocktemplate – blob 152 hex

```bash
curl -s -X POST http://localhost:18089/json_rpc \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"getblocktemplate","params":{}}' | jq .
```
- Očekávání: `result.blockhashing_blob` má délku 152 znaků.

2) Pool login – Monero‑style job (blob 152 hex, target 16 hex)

```bash
printf '{"id":1,"jsonrpc":"2.0","method":"login","params":{"login":"ZION_TEST_ADDR","pass":"x","agent":"XMRig/6.24.0"}}\n' \
| nc -w 5 <POOL_HOSTNAME> 3333
```
- Očekávání:
  - `result.status`: `OK`
  - `result.job.blob`: 152 hex, typicky začíná `0d00`
  - `result.job.target`: 16 hex (8B LE)
  - `seed_hash`: nenulový

3) XMRig – start těžby

```bash
xmrig -o <POOL_HOSTNAME>:3333 -u <TVUJ_ZION_WALLET> -p x --algo=rx/0 --keepalive --donate-level=0
```
- Očekávání: zmizí "login error code: 5" a miner začne hashovat.

## Troubleshooting (pokud code:5 přetrvá)

- Tento rychlý test prozradí tvar odpovědi:

```bash
printf '{"id":1,"jsonrpc":"2.0","method":"login","params":{"login":"ZION_TEST_ADDR","pass":"x","agent":"XMRig/6.24.0"}}\n' \
| nc -w 5 <POOL_HOSTNAME> 3333 | sed -n '1,3p'
```
- Pokud vidíš:
  - `blob` začíná `0606...` nebo má délku ≠ 152 → stále běží stará verze image / proces.
  - `target` má 64 hex → stále starý kód; restart/rebuild image.
- Ověř, že běží container `zion-mining-pool` z `docker-compose.zqal.yml` a spouští `src/core/zion_universal_pool_v2.py`.
- Pokud je v téže mašině další proces na portu 3333, ukonči ho (port conflict).

## Next steps (pro plnou RandomX integraci)

- Wire RPC getblocktemplate v poolu
  - Brát `blockhashing_blob` přímo z RPC (`zion/rpc/server.py`) – jeden kanonický builder.
  - Zahrnout seed epochy: `seed_hash`/`next_seed_hash` spojit s výškou/epoch.
- Submit/validation share
  - Z `submit` rekonstruovat hlavičku s rezervou/extranonce, spočítat RandomX hash a porovnat s targetem; logovat accepted/invalid.
  - Plná submitace bloku do sítě může být následný krok.
- Yescrypt (paralelně, pokud potřebné)
  - Zarovnat coinbase/script a merkle konstrukci podle zpool.ca, aby `cpuminer-opt` začal těžit (extranonce2_size=4).

## Reference – očekávaná login odpověď (XMRig)

Struktura `result.job`:
- `job_id`: řetězec (unikátní ID jobu)
- `blob`: 152 hex (76 B)
- `seed_hash`: 64 hex (nenulový)
- `next_seed_hash`: 64 hex (nenulový)
- `target`: 16 hex (8 B little‑endian)
- `height`: celé číslo (výška bloku)

Ukázka (zkrácena):
```json
{
  "id": 1,
  "jsonrpc": "2.0",
  "result": {
    "id": "zion_...",
    "job": {
      "job_id": "zion_rx_000001",
      "blob": "0d00...<152 hex>...",
      "seed_hash": "...64 hex...",
      "next_seed_hash": "...64 hex...",
      "target": "...16 hex...",
      "height": 1
    },
    "status": "OK"
  }
}
```

## Poznámky k prostředí

- Linux je doporučený pro Docker build/deploy (na macOS byl Docker démon vypnutý).
- RandomX knihovna (librandomx.so) je volitelná pro RPC server; fallback běží i bez ní, ale pro produkční výkon ji doporučujeme (viz `docker/Dockerfile.zion-node`).
- Prometheus metriky jsou volitelné; pokud klient není nainstalován, pool běží s no‑op fallbackem.

## Hotovo vs. TODO

- Hotovo:
  - Hashing blob 76B v RPC i poolu
  - Target 8B LE v jobu i login response
  - Dockerfile.mining-pool přesměrován na Universal Pool a správné porty/healthcheck
- TODO (priorita):
  - Rebuild & restart mining‑pool container na produkci
  - Smoke test loginu (152‑hex blob, 16‑hex target)
  - XMRig run ověření (zmizí code:5)
  - Dále: RPC getblocktemplate wiring v poolu, submit validace
```
