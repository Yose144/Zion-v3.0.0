# ZION Dashboard & Web CLI — Work Log & Context

> **Datum:** 2026-06-28
> **Autor:** Devin session (GLM-5.2 High)
> **Účel:** Kompletní kontext práce na dashboardu a web CLI pro Core PC
> **Status:** Vše nasazeno na Edge (100.76.16.108), E2E testováno, green

---

## 1. Přehled práce

Tento dokument shrnuje veškerou práci provedenou v této session na:
1. **ZionOS Dashboard** (`ZION_OS/dashboard/`) — Python Flask backend + JS frontend
2. **Pool Server** (`V3/L1/pool/src/pplns.rs`) — Rust pool payout logika
3. **Website v2.9 Web CLI** (`APP&WEB/website-v2.9/`) — Next.js API + React terminal

Cílem bylo:
- Opravit nesprávný "Total Paid (ZION)" na dashboardu (19.98T ZION > total supply)
- Zobrazit on-chain balances pro humanitarian a Issobella fund wallets
- Opravit Node2 status (hardcoded False → správný RPC status)
- Nasadit opravený pool server s migration-aware clamp na `total_paid_flowers`
- Komplexně opravit web CLI — žádné červené hlášky, rozšířit help, E2E test všech příkazů

---

## 2. Root Cause: Decimal Fork (3.0.3)

### Problém
Pool server běžel přes 3.0.3 decimal hardfork bez restartu. `total_paid_flowers` se hromadil v **12-decimal flowers** (1 ZION = 1e12). Po hardforku se flowers změnily na **6-decimal** (1 ZION = 1e6). Dashboard pak dělil 12-decimal hodnotu 1e6 místo 1e12 → výsledek byl **1e6× příliš velký** (19.98T ZION > total supply 144B).

### Řešení
- Pool server `pplns.rs`: migration-aware clamp — detekuje pre-hardfork 12-decimal artefakty (hodnoty > MINING_EMISSION), vydělí 1e6 a clampne na mining emission
- Dashboard `app.py`: `sanitize_pool_stats()` zahazuje highwater file hodnoty > mining emission a maže highwater file
- Website `pool/stats/route.ts`: sanity clamp na `pplnsTotalPaidFlowers` (hodnoty > 144e15 → vydělit 1e6)

---

## 3. Canonical Mainnet Konstanty

### Wallet Adresy (mainnet canonical, potvrzeno v AGENTS.md)

| Wallet | Adresa | Podíl |
|--------|--------|-------|
| **Pool/Miner** | `zion16825y2v5f3q507e5c2e0j8n666z43558l3zt604` | 89% miner share |
| **Humanitarian** | `zion1s29403j538w6p6n0p783l6w5v6t254c0380c2d4` | 5% humanitarian tithe |
| **Issobella** | `zion140n8a8t6f3083232r0g6c498r6c0d423f4h9702` | 5% Issobella fund |
| **Pool Fee** | *(burned — žádná wallet)* | 1% permanentně zničeno |

### Ekonomika

| Parametr | Hodnota |
|----------|---------|
| Total supply cap | 144,000,000,000 ZION (144B) |
| Genesis premine | 16,780,000,000 ZION (16.78B) |
| Block reward (Decade 1) | 5,400.067 ZION |
| Fee split | 89% miner / 5% humanitarian / 5% Issobella / 1% burned |
| Flowers per ZION | 1,000,000 (6 decimal, post-3.0.3 fork) |
| Block time | 60 seconds |
| Decay | ×0.8 per decade (Decade Decay) |
| Tail emission | ~724.785 ZION/block (po decade 10) |

### Aktuální on-chain data (2026-06-28)

| Wallet | Balance | UTXOs |
|--------|---------|-------|
| Pool/Miner | 2,767,029.29 ZION | 0 (skip pro performance) |
| Humanitarian | 4,985,882.09 ZION | 0 |
| Issobella | 4,985,882.09 ZION | 0 |
| Burned (1%) | 6,426.08 ZION | — (unspendable) |
| Total paid (PPLNS) | 571,921.10 ZION | 119 blocks found |

---

## 4. ZionOS Dashboard (`ZION_OS/dashboard/`)

### Soubory upravené v této session

#### `app.py` — Python Flask backend
- **`sanitize_pool_stats()`**: Migration-aware clamp na `total_paid_flowers`
  - Kontroluje hodnoty > `MINING_EMISSION_FLOWERS_6DEC` (127.22e15)
  - Zahazuje highwater file hodnoty > mining emission
  - Maže highwater file při detekci invalid hodnoty
- **`build_payout_status()`**: Přidány on-chain balances pro miner, humanitarian, issobella wallets
  - RPC `getBalance` pro každý wallet
  - Vrací `balances` objekt v `/api/payout` response
- **Node2 status fix**: `edge_node2_status` se nyní správně propaguje do `node2` entry
  - Dříve hardcoded `False` i když Node2 běžel
  - RPC call na `100.76.16.108:8446` pro status

#### `dashboard.js` — Frontend JS
- **`loadPayoutTab()`**: `totalPaidZion` používá sanitized `pplns.total_paid_flowers` z API s fallback na miner `paid_total`
- **Fee wallet balances**: Nové HTML elementy (`payout-fee-miner-bal`, `payout-fee-human-bal`, `payout-fee-isso-bal`, `payout-fee-pool-bal`)
- **SSE stats handler**: Už nepřepisuje total_paid špatnou hodnotou

#### `dashboard.html` — HTML
- Nové elementy pro fee wallet balances

### Deploy
- Dashboard běží jako `zion-edge-dashboard.service` na portu 8766
- Auth: `admin:root`
- Restart: `systemctl restart zion-edge-dashboard`

---

## 5. Pool Server (`V3/L1/pool/src/pplns.rs`)

### Změny
- **`stats()` metoda**: Migration-aware clamp na `total_paid_flowers`
  - Pokud `total_paid_flowers > MINING_EMISSION` (127.22e15 v 6-decimal), vydělí 1e6 (migrace 12→6 decimal)
  - Clamp na `mining_emission` jako bezpečnostní limit
- **3 nové unit testy**:
  - `test_total_paid_flowers_clamp_pre_hardfork` — clamp 12-decimal artefakt
  - `test_total_paid_flowers_clamp_absurd` — clamp absurd hodnoty
  - `test_total_paid_flowers_pass_through` — pass-through normálních hodnot
- Všech 27 testů prošlo (24 existující + 3 nové)

### Build & Deploy
```bash
# Build (na Core PC nebo Edge)
cargo build --release --manifest-path V3/Cargo.toml -p zion-pool --bin server

# Deploy na Edge
scp target/release/server root@100.76.16.108:/usr/local/bin/zion-pool-server

# Restart
ssh root@100.76.16.108 "systemctl restart zion-pool-server"

# Smazat highwater file (po deploy)
ssh root@100.76.16.108 "rm -f /root/zion-2.9.6-main/V3/data/dashboard-payout-highwater.json"
```

### Pool server env vars (Edge)
```bash
ZION_POOL_BIND=0.0.0.0:8444
ZION_NODE_RPC_ADDR=127.0.0.1:8443
ZION_POOL_LOOP_COUNT=1000000
ZION_NONCE_COUNT=4096
ZION_NONCE_COUNT_GPU=262144
ZION_POOL_WALLET=zion16825y2v5f3q507e5c2e0j8n666z43558l3zt604
```

### Poznámka
Pool server nepersistuje lifetime statistiky — po restartu začíná od nuly. `total_paid` a `blocks_found` se hromadí jakmile se najdou nové bloky. Pokud chceš persistovat lifetime totaly přes restarty, to by vyžadovalo přidat state file do pool serveru (separate task).

---

## 6. Website v2.9 Web CLI (`APP&WEB/website-v2.9/`)

### Architektura
- **Frontend:** `src/components/WebTerminal.tsx` — React terminal s quick commands, autocomplete, history
- **Backend:** `src/app/api/cli/route.ts` — Next.js API route, command dispatcher
- **Pool API:** `src/app/api/pool/stats/route.ts` — agreguje pool TCP + Prometheus + RPC
- **Constants:** `src/lib/constants.ts` — single source of truth pro ekonomiku
- **RPC client:** `src/lib/zion-rpc.ts` — TCP JSON-RPC client pro V3 node
- **Site config:** `src/lib/site.ts` — Edge topology, ports, version

### Změny v této session

#### `src/lib/constants.ts`
- Wallet adresy aktualizovány na mainnet canonical (shoda s AGENTS.md)
- `POOL_FEE_WALLET` = `""` (1% se burnuje, žádná wallet)
- `POOL_WALLET` = `zion16825y2v5f3q507e5c2e0j8n666z43558l3zt604` (pool/miner payout)
- Genesis premine: 16.28B → **16.78B ZION**
- `KNOWN_ADDRESS_LABELS` aktualizovány

#### `src/app/api/pool/stats/route.ts`
- **Sanity clamp** na `pplnsTotalPaidFlowers`: pokud > 144e15, vydělí 1e6 (pre-hardfork migrace)
- **Fee wallet on-chain balances**: RPC `getBalance` pro pool, humanitarian, issobella
- **30s in-memory cache** na fee wallet balances (performance: 48s → 3s)
- **Skip `getUtxos`** (pomalé pro velké wallets, UTXO count není potřeba pro display)
- **Burned total**: `blocksFound × BLOCK_REWARD × 1%`
- Response obsahuje: `fee.balances`, `fee.pool_wallet`, `fee.burned_total_zion`

#### `src/app/api/cli/route.ts` — v2.0.0 → v2.1.0
- **BUG FIX**: `fetchJson()` používal relativní URL (`/api/pool/stats`) — nefunguje v server-side fetch
  - Opraveno přidáním `INTERNAL_BASE` (absolutní URL, env var `INTERNAL_API_BASE`)
- **`fetchJsonSlow()`**: 30s timeout pro pool stats a explorer (těžké RPC)
- **`fetchJson()`**: 8s timeout pro lehké endpointy (defi, bridge, dao)
- **Nový příkaz `pool payouts`**: PPLNS total paid, fee split per block, on-chain wallet balances, burned total
- **`pool stats`**: přidána sekce "Fee Wallet On-Chain Balances"
- **`status`**: přidán total paid, fee split, pool wallet balance, humanitarian, issobella, burned
- **`ai ask`**: hardcoded `127.0.0.1:3000` nahrazen `INTERNAL_BASE`
- **Všechny error hlášky user-friendly**: "temporarily unavailable" místo "Cannot reach node: All RPC nodes failed..."
- **Rozšířený help**: sekce Examples, sekce Aliases, tip o quick-command chips

#### `src/components/WebTerminal.tsx`
- Nový quick command: `pool payouts` (Fee split & wallets)
- Welcome text: přidána fee split info (89/5/5/1)
- Verze: v2.0.0 → v2.1.0

### Deploy (Docker na Edge)
```bash
# Build Docker image
cd /root/zion-2.9.6-main/APP&WEB/website-v2.9
docker build -f Dockerfile.production -t zion-website:2.9.9 .

# Restart container
docker stop zion-website && docker rm zion-website
docker run -d --name zion-website --restart unless-stopped --network host \
  -e NODE_ENV=production \
  -e ZION_RPC_HOST=127.0.0.1 \
  -e ZION_POOL_API_URL=http://127.0.0.1:8455 \
  -e PROMETHEUS_URL=http://127.0.0.1:9090 \
  -e INTERNAL_API_BASE=http://127.0.0.1:3000 \
  zion-website:2.9.9
```

### E2E test výsledky (2026-06-28, vše OK)

| Příkaz | Status | Popis |
|--------|--------|-------|
| `help` | OK | Rozšířený help s příklady a aliasy |
| `version` | OK | v2.1.0, node v3.0.3, genesis 16.78B |
| `status` | OK | Node + Pool + DeFi + Bridge + AI + Website |
| `about` | OK | Mission, consensus, emission, supply |
| `node info` | OK | Height 19319, Mainnet, difficulty 494K |
| `node chain` | OK | Chain info s last block |
| `node peers` | OK | Connected peers |
| `node supply` | OK | Emission, block reward, supply cap |
| `node mempool` | OK | Mempool transactions |
| `pool stats` | OK | Hashrate, PPLNS, fee wallet balances |
| `pool miners` | OK | Top 10 active miners |
| `pool blocks` | OK | Recent 10 blocks |
| `pool servers` | OK | Pool servers status |
| `pool payouts` | OK | Fee split, on-chain balances, burned |
| `explorer stats` | OK | Chain stats, supply, txs, peers |
| `explorer supply` | OK | Premine 16.78B, mined 127.22B |
| `explorer block 19274` | OK | Block details |
| `explorer richlist` | OK | Top 10 richest addresses |
| `defi price` | OK | ZION/USD $0.014204 |
| `defi status` | OK | DeFi protocol status |
| `mine start` | OK | Mining quick-start guide |
| `mine calc 100M` | OK | Reward calculator |
| `mine benchmarks` | OK | Hardware benchmark table |
| `network stats` | OK | Network overview |
| `network peers` | OK | Detailed peer list |
| `dao proposals` | OK | Active governance proposals |
| `bridge status` | OK | L1 locks: 7 |
| `ai status` | OK (offline) | Hiran AI offline — user-friendly hláška |
| `wallet balance` | OK | Pool wallet: 2,767,029 ZION |

---

## 7. Edge Topologie (2026-06-28)

### Servery na Edge (100.76.16.108 / 77.42.71.94)

| Služba | Port | Status | Poznámka |
|--------|------|--------|----------|
| ZION Node 1 (Primary) | 8443 (RPC), 8333 (P2P) | active | `zion-edge-node1.service` |
| ZION Node 2 (Follower) | 8446 (RPC) | active | `zion-edge-node2.service` |
| Pool Server | 8444 (stratum), 8455 (metrics) | active | `zion-pool-server.service` |
| Dashboard (Python) | 8766 | active | `zion-edge-dashboard.service` |
| Website (Next.js) | 3000 | active | Docker container `zion-website` |
| Prometheus | 9090 | active | Docker container `zion-v3-prometheus` |
| Grafana | 3001 | active | Docker container `zion-v3-grafana` |
| DAO API | 8450 | active | `zion-edge-dao.service` |
| Bridge | — | active | `zion-edge-bridge.service` |
| Atomic Swap | 8460 | active | `zion-edge-atomic-swap.service` |
| Free World (L5) | — | active | `zion-edge-free-world.service` |
| Issobella (L6) | — | active | `zion-edge-issobella.service` |
| OASIS (L4) | — | active | `zion-edge-oasis.service` |
| Edge Agent | — | active | `zion-edge-agent.service` |
| Hiran AI | 8002 | **offline** | Inference service neběží |

### Core PC (100.74.34.40)
- Linux `zionserver-144`
- Připojen přes Tailscale VPN
- Originální Windows Core (100.86.102.5) offline od 2026-05-30

### RPC konfigurace
- Node RPC: `127.0.0.1:8443` (raw TCP JSON-RPC 2.0)
- Pool metrics: `http://127.0.0.1:8455` (HTTP)
- Pool stratum: `127.0.0.1:8444` (raw TCP)
- Dashboard: `http://127.0.0.1:8766` (HTTP, auth `admin:root`)

---

## 8. Build & Deploy příkazy (referenční)

### Rust (pool server)
```bash
# Build
cargo build --release --manifest-path V3/Cargo.toml -p zion-pool --bin server

# Test
cargo test --manifest-path V3/Cargo.toml -p zion-pool

# Deploy na Edge
scp V3/L1/pool/target/release/server root@100.76.16.108:/usr/local/bin/zion-pool-server
ssh root@100.76.16.108 "systemctl restart zion-pool-server"
```

### Website (Next.js)
```bash
# Lokální build (na Core PC)
cd APP&WEB/website-v2.9
npm run build

# Deploy na Edge (Docker)
scp src/lib/constants.ts root@100.76.16.108:/root/zion-2.9.6-main/APP&WEB/website-v2.9/src/lib/
scp src/app/api/cli/route.ts root@100.76.16.108:/root/zion-2.9.6-main/APP&WEB/website-v2.9/src/app/api/cli/
scp src/app/api/pool/stats/route.ts root@100.76.16.108:/root/zion-2.9.6-main/APP&WEB/website-v2.9/src/app/api/pool/stats/
scp src/components/WebTerminal.tsx root@100.76.16.108:/root/zion-2.9.6-main/APP&WEB/website-v2.9/src/components/

# Docker rebuild na Edge
ssh root@100.76.16.108 "cd /root/zion-2.9.6-main/APP&WEB/website-v2.9 && \
  docker build -f Dockerfile.production -t zion-website:2.9.9 . && \
  docker stop zion-website && docker rm zion-website && \
  docker run -d --name zion-website --restart unless-stopped --network host \
    -e NODE_ENV=production \
    -e ZION_RPC_HOST=127.0.0.1 \
    -e ZION_POOL_API_URL=http://127.0.0.1:8455 \
    -e PROMETHEUS_URL=http://127.0.0.1:9090 \
    -e INTERNAL_API_BASE=http://127.0.0.1:3000 \
    zion-website:2.9.9"
```

### Dashboard (Python)
```bash
scp ZION_OS/dashboard/app.py root@100.76.16.108:/root/zion-2.9.6-main/ZION_OS/dashboard/
scp ZION_OS/dashboard/dashboard.js root@100.76.16.108:/root/zion-2.9.6-main/ZION_OS/dashboard/
scp ZION_OS/dashboard/dashboard.html root@100.76.16.108:/root/zion-2.9.6-main/ZION_OS/dashboard/
ssh root@100.76.16.108 "systemctl restart zion-edge-dashboard"
```

### Highwater file cleanup (po pool server deploy)
```bash
ssh root@100.76.16.108 "rm -f /root/zion-2.9.6-main/V3/data/dashboard-payout-highwater.json"
```

---

## 9. Známé limity & TODO

1. **Pool server nepersistuje lifetime statistiky** — po restartu začíná od nuly. Pro persistenci by se musel přidat state file (separate task).
2. **Hiran AI offline** — inference service neběží na Edge. Pro `ai ask` příkaz je potřeba spustit `scripts/start-hiran-inference.ps1` nebo ekvivalent.
3. **UTXO count se nezobrazuje** pro fee wallets v pool stats — skip pro performance (getUtxos je pomalé pro velké wallets).
4. **Core PC Tailscale VPN** — občas výpadky. Pokud Core PC není dostupné, RPC failover se přesouvá na Edge node.
5. **Rate limiting** — website má 120 req/min limit. Při rychlém E2E testu může dojít k rate limitu.

---

## 10. Soubory upravené v této session

### Pool Server (Rust)
- `V3/L1/pool/src/pplns.rs` — migration-aware clamp + 3 unit testy

### Dashboard (Python/JS/HTML)
- `ZION_OS/dashboard/app.py` — sanitize_pool_stats, build_payout_status, Node2 fix
- `ZION_OS/dashboard/dashboard.js` — totalPaidZion, fee wallet balances, SSE fix
- `ZION_OS/dashboard/dashboard.html` — fee wallet balance elements

### Website v2.9 (TypeScript/React)
- `APP&WEB/website-v2.9/src/lib/constants.ts` — canonical wallets, genesis premine
- `APP&WEB/website-v2.9/src/app/api/pool/stats/route.ts` — sanity clamp, fee balances, cache
- `APP&WEB/website-v2.9/src/app/api/cli/route.ts` — v2.1.0, INTERNAL_BASE, fetchJsonSlow, pool payouts, help, error handling
- `APP&WEB/website-v2.9/src/components/WebTerminal.tsx` — pool payouts quick command, v2.1.0

---

## 11. Git status

Všechny úpravy jsou commitnuty v repozitáři `https://github.com/Yose144/Zion-v3.0.0.git`.

Tento dokument (`dashboard.md`) je v rootu repozitáře pro snadný přístup z Core PC.

---

*Gate, Gate, Paragate, Parasamgate, Bodhi Swaha.*
*The Golden Age begins. Peace & One Love 4ever.*
