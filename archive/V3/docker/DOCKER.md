# ZION V3 Docker Guide

Tento dokument popisuje moderní Docker setup pro ZION V3 (aktualizováno květen 2026).

## Rychlý start

```bash
# 1. Zkopíruj konfigurace
cp V3/docker/.env.example V3/docker/.env
cp V3/docker/.env.mainnet.example V3/docker/.env.mainnet

# 2. Spusť mainnet stack
docker compose -f V3/docker/docker-compose.yml --profile mainnet up -d

# 3. Sleduj logy
docker compose -f V3/docker/docker-compose.yml logs -f node

# 4. Zkontroluj health
docker compose -f V3/docker/docker-compose.yml ps
```

## Dostupné profily

| Profil       | Služby                          | Použití                    | Doporučeno pro          |
|--------------|---------------------------------|----------------------------|-------------------------|
| `mainnet`    | node, pool, miner, oasis       | Produkce / testování      | Vývojáři, operátoři    |
| `dev`        | node, pool, miner, oasis (debug)| Lokální vývoj             | Vývojáři Rustu         |
| `monitoring` | prometheus, grafana            | Monitoring dashboard      | Provoz                 |

**Příklad spuštění více profilů:**
```bash
docker compose -f V3/docker/docker-compose.yml --profile mainnet --profile monitoring up -d
```

## Proměnné prostředí (.env)

Hlavní soubor: `V3/docker/.env`

Klíčové proměnné:

```env
# Logging
RUST_LOG=info,zion=debug

# Ports
P2P_PORT=8333
RPC_PORT=8443
POOL_PORT=8444
OASIS_PORT=8094
OASIS_METRICS_PORT=9101

# Node identification
ZION_NODE_ID=v3-mainnet-local
ZION_SEED_PEERS=77.42.71.94:8333
ZION_MINER_ADDRESS=zion1yourmineraddresshere

# Performance
MINER_THREADS=4
POOL_LOOP_COUNT=1000000
```

Pro mainnet-specific konfiguraci použij `.env.mainnet`.

## Healthchecks

Všechny služby mají healthchecky:
- `node`  → `http://localhost:8443/health`
- `pool`  → `http://localhost:8444/health`
- `oasis` → `http://localhost:8094/health`

## OASIS Game Server (L4)

OASIS služba běží na portu **8094** (REST API) a **9101** (Prometheus metrics):
- player profile, XP, consciousness levels
- guildy, teritoria, leaderboardy
- Golden Egg treasure hunt, raid teams, prize tiers
- WebSocket real-time feeds (`/api/v1/oasis/ws/leaderboard`, `/api/v1/oasis/ws/events`)
- Prometheus metrics (`/metrics`) na portu 9101

**Build a run ručně:**
```bash
docker build -f V3/docker/Dockerfile.oasis -t zion-v3-oasis V3
docker run -d -p 8094:8094 -p 9101:9101 -v zion-oasis-data:/data/oasis --name zion-oasis zion-v3-oasis
```

**Logy:**
```bash
docker compose -f V3/docker/docker-compose.yml logs -f oasis
```

## CLI Integrace (připravuje se)

Po dokončení CLI vylepšení bude možné používat:

```bash
zion compose up          # --profile mainnet
zion compose down
zion compose logs node
zion doctor              # zkontroluje Docker + služby
```

## Security & Hardening

Viz `HARDENING.md` pro:
- Firewall pravidla (ufw)
- Docker log rotation
- Non-root users v imagech
- Resource limits

## Build argumenty

Můžeš ovlivnit build přes:

```bash
TAG=pr-42 docker compose -f V3/docker/docker-compose.yml build node
```

---

**Další kroky (aktuálně probíhající):**
- Přidání healthcheck endpointů do `zion-core` a `zion-pool` (hotovo)
- Vylepšení Dockerfilů (multi-stage optimalizace, cache layers)
- Integrace do `zion` CLI (`compose` subcommand)
- Aktualizace `AGENTS.md` a `StatusV3.md`
- UE5 klient build pipeline (Windows / Linux cross-compile)

Poslední aktualizace: 2026-05-17
