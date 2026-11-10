# Analýza EDGE 1 vs EDGE 2 — ZION TerraNova infrastruktura

> **Vytvořeno:** 2026-11-02
> **Rozsah:** `infra/edge-deploy/` (legacy V3, EDGE1) vs `V31/deploy/` (V31 Mainnet Alpha, EDGE2)
> **Zdroj pravdy:** `AGENTS.md` topologie, `docs/3.2/StatusV3.md`, `docs/plans/INFRA-SPLIT-PLAN.md`

---

## 1. Shrnutí (executive summary)

ZION TerraNova běží na **dvou edge serverech**, které plní odlišné role:

| | **EDGE1** (legacy/ops) | **EDGE2** (primary + web ingress) |
|---|---|---|
| **IP (IPv4)** | `62.171.141.136` | `207.180.217.100` |
| **Hostname** | `vmi3425821.contaboserver.net` | `vmi3684458.contaboserver.net` |
| **Hardware** | 4c / 8 GB / 145 GB | 6c EPYC / 11 GB / 193 GB |
| **Role** | Ops + pool + stray subs + follower nodes | Primary node + web ingress + všechny L2–L6 služby |
| **Deploy projekt** | `infra/edge-deploy/` (V3, **deprecated**) | `V31/deploy/` (V31, **aktivní**) |
| **nginx** | Ops/legacy vhosty (grafana, dashboard, api, explorer, mining, testnet, newearth.cz, wildcard) | Veřejné vhosty (apex, app, auth, freeworld, market, oasis, pool, rpc, updates, dex, kingdom) |
| **Stav** | Follower nodes + pool stratum + monitoring | Source of truth pro chain, web, auth, L2–L6 |

**Klíčové zjištění:** EDGE1 je **legacy V3-era** deploy projekt (`infra/edge-deploy/`), který je v AGENTS.md označen jako **DEPRECATED** — V3 byl archivován 2026-08-04. Aktivní deploy je `V31/deploy/` (EDGE2). EDGE1 stále běží jako **ops/pool/monitoring** box, ale jeho deploy skript (`infra/edge-deploy/deploy-edge.sh`) se už nepoužívá pro V31.

---

## 2. Srovnávací tabulka projektů

### 2.1 Deploy skripty

| Atribut | EDGE1 (`infra/edge-deploy/`) | EDGE2 (`V31/deploy/`) |
|---|---|---|
| Skript | `infra/edge-deploy/deploy-edge.sh` | `V31/deploy/deploy-edge.sh` |
| Stav | ⚠️ DEPRECATED (legacy V3) | ✅ Aktivní (V31 Mainnet Alpha) |
| Cílový host | `62.171.141.136` | `zion-v6` alias (IPv6 `2a02:c207:2342:5821::1`, port 2222) |
| Binární prefix | `node`, `server` (V3) | `zion-node`, `zion-pool` (V31) |
| Kódová cesta | `/opt/zion/V3/` | `/opt/zion/V31/` |
| Build | `cargo build --release --bin node --bin server …` | `cargo build --release --bin zion-node --bin zion-pool --bin zion-miner …` |
| Env soubor | `/etc/zion/edge-environment.sh` (V3 template) | `/etc/zion/edge-environment.sh` (V31 template) |
| SSH key | `~/.ssh/zion-edge-post-wipe-2026-07-29` | stejný |

### 2.2 Systemd služby

| Kategorie | EDGE1 (`infra/edge-deploy/systemd/`) | EDGE2 (`V31/deploy/systemd/`) |
|---|---|---|
| Počet `.service` | **20** | **29** |
| Node služby | `zion-edge-node1`, `zion-edge-node2` | `zion-v31-node` (primary), `zion-v31-node2`, `zion-v31-node3` (followers) |
| Pool | `zion-edge-pool` | `zion-v31-pool` (primary) + `zion-v31-pool-standby` (HA) |
| L2/L3 | bridge, dao, atomic-swap, warp, oasis, dex | multichain (unified bridge+warp+atomic-swap+dex), dao, oasis, free-world, issobella, hiran-gateway, hiran-inference, ai-native |
| Web | `zion-edge-dashboard`, `zion-edge-python-dashboard`, `zion-edge-dex` | `zion-website`, `zion-marketplace` |
| Monitoring | `zion-edge-watchdog` (timer 2 min) | `zion-v31-watchdog` (timer), `zion-g8-probe`, `zion-g8-evidence` (timer), `zion-g8-alert-sink` |
| Backup | `zion-edge-backup` (timer 4h), `zion-pg-backup` (timer) | `zion-edge-backup` (timer) |
| Maintenance | `zion-edge-maintenance` (timer daily) | `zion-edge-maintenance` (timer) |
| Miner | `zion-edge-miner` | `zion-v31-miner` |
| Agent | `zion-edge-agent` | (přes ZION_OS/agent) |
| LND | `zion-edge-lnd` | — (není v V31 deploy) |
| NCL | `zion-v31-ncl` | — |
| THP disable | `zion-thp-disable` | — |

### 2.3 Nginx vhosty

| | EDGE1 (`infra/nginx/edge-current/`) | EDGE2 (`infra/nginx/edge2/`) |
|---|---|---|
| Počet confů | 14 | 14 |
| Veřejné weby | oasis, market (proxy), nirvana | apex (zionterranova.com), app, auth, freeworld, market, oasis, pool, rpc, updates, dex, kingdom, catchall |
| Ops/legacy | grafana, auth, rpc, pool, nirvana, newearth.cz, zion-edge-download, zion-nginx (master) | rate-limit, catchall, auth (bez .conf) |
| Master config | `zion-nginx.conf` | (distributed per-vhost) |

### 2.4 Klíčové rozdíly v architektuře

| Aspekt | EDGE1 (V3 legacy) | EDGE2 (V31 aktivní) |
|---|---|---|
| **Node RPC port** | 9443 | 9445 (primary), 9446/9447 (followers) |
| **P2P port** | 8333/8334 | 8335/8336/8337 |
| **Pool stratum** | 8444 | 8444 (stejný) |
| **Pool HTTP API** | 8080 (V3) | 8080 (V31) |
| **Multichain API** | 8453 (warp) + 8454 (dex) | 8453 (warpd unified) |
| **DAO API** | 8450 | 8456 |
| **OASIS API** | 8094 | 8094 |
| **Free World** | — | 8095 |
| **Issobella** | — | 8097 |
| **AI-native** | — | 8001 |
| **Hiran inference** | — | 8002 (CPU fallback) + 8004 (proxy) |
| **Website** | Docker `zion-web:3000` | `zion-website:3000` (systemd) |
| **Marketplace** | Docker `zion-marketplace:3100` | `zion-marketplace:3100` (systemd) |
| **HA pool** | — | `zion-v31-pool-standby` (G1–G6 fencing) |
| **G8 evidence** | — | `zion-g8-probe`, `zion-g8-evidence` (30-day gate) |

---

## 3. Topologie (podle AGENTS.md)

```
EDGE2 (207.180.217.100) — PRIMARY + WEB INGRESS
├── nginx :80/:443 — veřejné vhosty (apex, app, auth, freeworld, market, oasis, pool, rpc, updates, dex, kingdom)
├── V31 primary node (RPC 9445, P2P 8335)
├── bitcoind mainnet (8332, pruned)
├── quantus (9944 + QUIC 9833)
├── pearl stack (44207 / 8477)
├── PostgreSQL 16 (5432)
├── WARP (8453/8454), ZIS (8096), DAO (8456), OASIS (8094), free-world (8095), issobella (8097), NCL (8098)
├── website (3000), marketplace (3100), ai-native (8001), btcunlock (8779)
└── hiran inference (8002 CPU fallback)

EDGE (62.171.141.136) — OPS + POOL + STRAY SUBS
├── nginx — jen ops/legacy vhosty (grafana, dashboard, api, explorer, mining, testnet, newearth.cz, wildcard *)
├── pool 8444/8445 (stratum + TLS) + API 8080
├── fallback-miner
├── node2 (9446) + node3 (9447) followeři
├── regtest BTC
├── dashboard (8766), grafana, prometheus, fail2ban
└── (web ingress PŘESUNUT na EDGE2 — Edge nginx = fallback)

TUNELY:
  edge → EDGE2: zion-chain-tunnel (chaintunnel, permitopen whitelist)
  EDGE2 → edge: zion-edge-tunnel (edgetunnel: 8080, 8003, 9446, 9447)
  latence ≈ 1 ms → cross-box RPC prakticky lokální
```

---

## 4. Analýza problémů a rizik

### 4.1 Duplicitní/deprecated deploy projekty
- `infra/edge-deploy/` je **DEPRECATED** (hlavička skriptu: "legacy V3 edge setup script"). V3 archivován 2026-08-04.
- Přesto `infra/edge-deploy/` stále obsahuje 20 systemd unitů, nginx confy a deploy skript — **riziko záměny** při deployi.
- `V31/deploy/deploy-edge.sh` je **aktivní**, ale má známé problémy (viz §4.3).

### 4.2 V31 deploy skript — známé defekty (z AGENTS.md)
- **Out of sync s live službami:** `deploy-edge.sh` se pokouší buildovat neexistující `--bin zion-bridge` a instalovat neexistující `zion-edge-dashboard`/`zion-edge-dex`/`zion-edge-python-dashboard` systemd unity.
- **Manuální workaround (2026-08-05):** deploy se dělá ručně — rsync + `sed` na Cargo.toml (odstranění cli/smoke) + `cargo build -p zion-core -p zion-pool -p zion-miner -p zion-dao -p zion-multichain` + chown + restart.
- **SSH rate limiting:** rapidní SSH spojení spouští fail2ban / MaxStartups → `Connection refused`. Doporučeno použít IPv6 alias `zion-v6` s ControlMaster socketem.

### 4.3 EDGE1 vs EDGE2 — split-brain rizika
- EDGE1 drží **follower nodes 9446/9447** + pool stratum 8444 (veřejné).
- EDGE2 je **source of truth** (primary node 9445).
- Tunel `zion-chain-tunnel` (edge→EDGE2) je **single point of failure** pro monitoring G8 (historicky způsobil 10.1h `chain_live` outage 2026-10-10).
- Oprava: G8 probe teď sleduje lokální followery 9446/9447 + primární 9445 (quorum fallback).

### 4.4 Disk/backup retence
- EDGE: `/opt/zion/backups` byl 42 GB z 101 GB (retence 14 runů × 4h = 2.3 d). Opraveno: retence 42 runů (~7 d), orphan sweep.
- EDGE2: 58 % disk usage, bez kritických problémů.

### 4.5 Fail2ban self-DoS
- Rapid SSH z dev hostu na EDGE (port 2222) = opakované `Connection refused` bany.
- Whitelist: `ignoreip += 207.180.217.100 62.171.141.136` v `jail.d/zion-sshd.conf`.
- **Doporučení:** batchovat SSH nebo použít `zion-v6` (IPv6 alias nebyl banován).

### 4.6 Build/provenance
- EDGE checkout sedí na `6fae7b60d` + **7258 dirty souborů** (kumulativní rsync overlaye).
- EDGE2 `/opt/zion/V31` = jen `target/` (žádný git — build se dělá na EDGE a rsyncuje).
- Pool binary `47b3136c` je pre-`66d15bef4` → `--version` zatím bez build id.
- **Doporučení:** build/deploy z čistého worktree `/opt/zion-rel/build` (pattern z 2026-10-29).

### 4.7 HA fencing (pool)
- `pool-promote-guard.sh` implementuje runbook §4 (G1–G6): primary prokazatelně mrtvý, auto-restart pryč, stratum zavřený, parita bez FAIL, single-flight token (O_EXCL, TTL 900s), cooldown.
- Read-only sonda primáru přes **omezený klíč** (`command="edge-pool-probe.sh"`, `from="207.180.217.100"`, no-pty).
- **Stav:** live `--check` = BLOKOVÁNO (primár žije) — správné chování.

---

## 5. Služby — detailní přehled

### 5.1 EDGE2 (primary) — klíčové služby

| Služba | Port | Popis |
|---|---|---|
| `zion-v31-node` | 9445 (RPC), 8335 (P2P) | Primary node (genesis) |
| `zion-v31-node2` | 9446, 8336 | Follower |
| `zion-v31-node3` | 9447, 8337 | Follower |
| `zion-v31-pool` | 8444 (stratum), 8080 (HTTP API) | Primary pool |
| `zion-v31-pool-standby` | 8444 | HA standby (manual promote) |
| `zion-v31-multichain` | 8453 | WARP relay (unified) |
| `zion-v31-dao` | 8456 | DAO governance API |
| `zion-v31-oasis` | 8094 | OASIS API |
| `zion-v31-free-world` | 8095 | Free World fund tracker |
| `zion-v31-issobella` | 8097 | Issobella space fund tracker |
| `zion-v31-miner` | — | CPU miner (4 threads) |
| `zion-v31-watchdog` | timer 2 min | Health + auto-restart |
| `zion-g8-probe` | 9105 | 30-day run probe exporter |
| `zion-g8-evidence` | timer | Evidence collection |
| `zion-hiran-gateway` | 8007 | Hiran LLM gateway |
| `zion-hiran-inference` | 8002 | CPU inference (fallback) |
| `zion-v31-ai-native` | 8001 | Maestro AI-native |
| `zion-website` | 3000 | Next.js web (systemd) |
| `zion-marketplace` | 3100 | Marketplace (systemd) |
| `zion-zis` | 8096 | Identity service |
| `zion-ncl` | 8098 | NCL service |
| `bitcoind` | 8332 | Bitcoin mainnet (pruned) |
| `quantus` | 9944 + QUIC 9833 | Quantus node |
| `pearl` | 44207 / 8477 | Pearl PoUW stack |
| `PostgreSQL 16` | 5432 | DB |
| `nginx` | 80/443 | Web ingress |

### 5.2 EDGE1 (ops) — klíčové služby

| Služba | Port | Popis |
|---|---|---|
| `zion-v31-node` (follower) | 9446, 9447 (node2/3) | Follower nodes |
| `zion-v31-pool` (stratum) | 8444/8445 | Stratum + TLS (veřejné) |
| `zion-v31-pool` (HTTP API) | 8080 | Pool API + metrics |
| `zion-fallback-miner` | — | Fallback miner |
| `zion-edge-backup` | timer 4h | Backup |
| `zion-edge-maintenance` | timer daily | Maintenance |
| `zion-edge-watchdog` | timer 2 min | Watchdog |
| `dashboard` | 8766 | Python dashboard |
| `grafana` | 3000 (grafana) | Monitoring |
| `prometheus` | 9090 | Metrics |
| `fail2ban` | — | IP banning |
| `nginx` | 80/443 | Ops/legacy vhosty |

---

## 6. Doporučení

1. **Konsolidovat deploy projekty:** Odstranit nebo archivovat `infra/edge-deploy/` (legacy V3) — způsobuje záměnu. Ponechat jen `V31/deploy/`.
2. **Opravit V31 deploy skript:** Aktualizovat `V31/deploy/deploy-edge.sh` — odstranit reference na neexistující binárky (`zion-bridge`) a služby (`zion-edge-dashboard`, `zion-edge-dex`). Použít manuální workaround jako základ.
3. **Standardizovat build cestu:** Používat čistý worktree `/opt/zion-rel/build` místo dirty `/opt/zion/V31` (pattern z 2026-10-29).
4. **HA pool:** Otestovat promote guard na stagingu před aktivací (armed mode).
5. **Monitoring:** Dokončit G8 30-day run gate (aktuálně run #7 `g8-20261106T145125Z`, gate pending, cíl 6. 12. 14:51Z; run #6 zastaven 6. 11. jako `evidence_incomplete`).
6. **Disk:** Nastavit automatický orphan sweep + retenci na obou boxech.
7. **SSH:** Používat IPv6 alias `zion-v6` s ControlMaster pro batch operace.

---

## 7. Zdroje

- `AGENTS.md` — kanonická topologie a provozní log
- `docs/3.2/StatusV3.md` — live stav
- `docs/plans/INFRA-SPLIT-PLAN.md` — plán splitu EDGE→EDGE2
- `V31/deploy/README.md` — V31 deploy dokumentace
- `V31/deploy/deploy-edge.sh` — aktivní deploy skript
- `infra/edge-deploy/deploy-edge.sh` — deprecated V3 deploy skript
- `infra/edge-deploy/config/edge-environment.sh` — V3 env template
- `V31/deploy/config/edge-environment.sh` — V31 env template
- `V31/deploy/systemd/` — 29 V31 systemd unitů
- `infra/edge-deploy/systemd/` — 20 V3 systemd unitů
- `infra/nginx/edge-current/` — EDGE1 nginx vhosty
- `infra/nginx/edge2/` — EDGE2 nginx vhosty