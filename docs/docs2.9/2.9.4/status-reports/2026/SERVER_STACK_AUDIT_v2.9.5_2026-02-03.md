# 🛰️ ZION v2.9.5 — Audit běžícího stacku na serverech (SSH)

**Datum:** 2026-02-03  
**Scope:** reálný stav na serverech (Helsinki/USA/Singapore) ověřený přes SSH klíč `~/.ssh/zion_hetzner_key`.  
**Cíl:** mít „čistý“ faktický snapshot: co skutečně běží, na jakých portech, jak se to spouští (docker vs systemd), a co je největší drift vůči dokumentaci.

---

## 0) Executive summary (realita)

- Deployment je aktuálně **mix**:
  - `zion-core` běží na všech 3 serverech jako **Docker container** `zion-core:2.9.5`.
  - `zion-pool` běží:
    - Helsinki: **systemd service** (host proces),
    - USA + Singapore: **Docker container** `zion-pool:2.9.5` v `network=host`.
- Systemd unit soubory existují, ale jsou **disabled** a často **inactive**, tj. nejsou kanonickým způsobem provozu.
- Kritický drift vůči plánované konfiguraci:
  - Docker `zion-core` se spouští s `--rpc-port 8080` a `--p2p-port 8334` **na všech serverech** (včetně USA/SG), tj. nerespektuje per-region porty z infra dokumentu.
  - Healthcheck pro core (`/health`) vrací stav `unhealthy` (HTTP 503), takže Docker reportuje core jako `unhealthy`.
- Singapore pool vrací `redis=false` v `/health` → buď Redis neběží / není dostupný / je špatně nakonfigurován.

---

## 1) Helsinki — 77.42.31.72 (TreeOfLife-Zion)

### Běžící služby (ověřeno)
- Docker:
  - `zion-core` (`image=zion-core:2.9.5`, network `zion-native-295_default`)
  - `zion-redis` (`redis:7-alpine`)
- Systemd:
  - `zion-pool` je **active (running)** (ExecStart: `/root/zion-v2.9.5/zion-native/target/release/zion-pool`)
  - `zion-core` systemd service je **inactive (dead)** (a v logu historicky „Permission denied“ na storage)

### Otevřené porty (výběr)
- `8334/tcp` P2P: přes `docker-proxy` (core container)
- `8080/tcp` Core HTTP/RPC/metrics: přes `docker-proxy` (core container)
- `3333/tcp` Stratum: `zion-pool` (systemd)
- `8181/tcp` Pool API: `zion-pool` (systemd)

### Lokální health (curl)
- `http://127.0.0.1:8080/health` → JSON obsahuje `status="unhealthy"` (time_since_last_block ~ 650s)
- `http://127.0.0.1:8181/health` → `{"status":"ok","redis":true}`

### Poznámky
- `zion-core` container command:
  - `zion-core --data-dir /data --p2p-port 8334 --rpc-port 8080 --peers 5.78.145.234:8334,5.223.56.124:8334`
- Binárky existují i v `/usr/local/bin/` (sha256 byl zjištěn), ale kanonicky se core stejně spouští jako container.

---

## 2) USA — 5.78.145.234 (Node1)

### Běžící služby (ověřeno)
- Docker:
  - `zion-core` (`image=zion-core:2.9.5`, network `zion-native-295_default`)
  - `zion-pool` (`image=zion-pool:2.9.5`, `network=host`)
- Systemd:
  - `zion-core` service je inactive
  - `zion-pool` service je inactive; v historii logu: `Exec format error` (binárka nejspíš pro jinou architekturu)

### Otevřené porty (výběr)
- `8080/tcp` core přes `docker-proxy`
- `8334/tcp` p2p přes `docker-proxy`
- `3333/tcp` stratum: `zion-pool` (container host network)
- `8181/tcp` pool API: `zion-pool` (container host network)

### Lokální health (curl)
- `http://127.0.0.1:8080/health` → `status="unhealthy"`
- `http://127.0.0.1:8181/health` → `{"status":"ok","redis":true}`

### Poznámky
- `zion-core` container command je opět `--p2p-port 8334 --rpc-port 8080` (tj. není to `8335/8444`).

---

## 3) Singapore — 5.223.56.124 (Node2)

### Běžící služby (ověřeno)
- Docker:
  - `zion-core` (`image=zion-core:2.9.5`, network `zion-native-295_default`)
  - `zion-pool` (`image=zion-pool:2.9.5`, `network=host`)
- Systemd:
  - unit soubory existují (zamýšlené porty `8336/8446`), ale jsou disabled/inactive

### Otevřené porty (výběr)
- `8080/tcp` core přes `docker-proxy`
- `8334/tcp` p2p přes `docker-proxy`
- `3333/tcp` stratum: `zion-pool` (container host network)
- `8181/tcp` pool API: `zion-pool` (container host network)

### Lokální health (curl)
- `http://127.0.0.1:8080/health` → `status="unhealthy"`
- `http://127.0.0.1:8181/health` → `{"status":"ok","redis":false}`  ⚠️

---

## 4) Drift matrix (co nesedí vůči infra docs)

Infra dokument (viz `2.9.5/docs/SERVERS_SSH.md`) uvádí per-region P2P/RPC porty (USA 8335, SG 8336, RPC 8444/8446) a že vše běží jako „native binaries“ přes systemd.

Reálný běh (ověřeno přes SSH):
- `zion-core` běží všude jako Docker container a používá **stejné** porty `p2p=8334`, `rpc=8080`.
- `zion-pool` je mix systemd (Helsinki) a Docker host network (USA/SG).
- Pool API v běhu je `8181`, ne `8080`.

➡️ Roadmap P0: sjednotit (1) deployment metodu, (2) port matrix, (3) názvy env/config.

---

## 5) Doporučené P0 kroky (ops + repo změny)

1) **Rozhodnout kanonický runtime**:
   - buď 100% `systemd` (binárky v `/usr/local/bin` + jednotný env/config),
   - nebo 100% `docker compose` (bez systemd).

2) **Sjednotit core konfiguraci**:
   - Core entrypoint dnes bere CLI args (viz `core/src/main.rs`), ale Dockerfile/compose pracuje s env.
   - Prakticky: buď doplnit čtení env (`ZION_RPC_PORT`, `ZION_P2P_PORT`, `ZION_DATA_DIR`, `ZION_P2P_SEEDS`), nebo v compose explicitně nastavovat `command:` s CLI.

3) **Upravit Docker healthcheck pro core**:
   - `/health` vrací HTTP 503 při `status=unhealthy` → container je permanentně `unhealthy`.
   - Pro „liveness“ by dávalo smysl přepnout healthcheck na `/liveness` (pokud je cílem jen detekce deadlocku), nebo změnit thresholdy.

4) **Singapore Redis**:
   - zjistit, jestli má pool vůbec používat Redis (a kde běží),
   - pokud ano: spustit Redis a opravit `REDIS_URL`/`ZION_REDIS_URL` drift v konfiguraci.

5) **Zavřít staré systemd jednotky nebo je zprovoznit**:
   - Dnes jsou disabled a navíc na USA je evidován `Exec format error`.

---

## 6) Další ověření (navazující audit)

Pokud chceš, v dalším kroku udělám ještě „deep ops“ audit:
- `ufw status` + veřejně otevřené porty,
- skutečné `docker-compose.yml` na serverech (bez citlivých hodnot),
- kontrola P2P konektivity mezi nody (RPC endpointy + peer list),
- verze binárek / build provenance (reproducible build plan).
