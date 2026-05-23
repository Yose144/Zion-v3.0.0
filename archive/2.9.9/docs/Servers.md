# ZION Mainnet V3 — Infrastructure & Launch Plan

Poslední úprava: 2026-05-21  
Architektura: **Core (lokální PC) + Edge Relay (VPS)** — vše ostatní vyřazeno.

---

## Flotila (aktuální)

| Role | Lokace | IPv4 | Tailscale | Služby |
|------|--------|------|-----------|--------|
| **Core** | ZionServer (local) | — | `100.86.102.5` | Node 1, Node 2, Pool (master), Miner, Dashboard, Zálohy |
| **Edge** | MainnetEdge (Hetzner) | `77.42.71.94` | `100.66.162.125` | Node 1 (relay), Pool (relay), P2P inbound |

Všechny ostatní servery (Helsinki, Singapore, USA, Praha) byly vyřazeny. Flotila je zredukovaná na **Core + Edge** s Tailscale VPN tunelem.

### SSH přístup

```bash
# Edge server (přes SSH klíč vygenerovaný pro tento projekt)
ssh -i ~/.ssh/ssh-key-zion-edge root@77.42.71.94

# Nebo přes alias (přidej do ~/.ssh/config):
# Host zion-edge
#     HostName 77.42.71.94
#     User root
#     IdentityFile ~/.ssh/ssh-key-zion-edge
#     IdentitiesOnly yes
```

### Tailscale síť

| Uzel | Tailscale IP | Popis |
|------|-------------|-------|
| Core (ZionServer) | `100.86.102.5` | Lokální PC, zdroj pravdy, zálohy |
| Edge (MainnetEdge) | `100.66.162.125` | Veřejný relay, přijímá inbound z internetu |

```bash
# Ověření konektivity z Core na Edge
tailscale ping 100.66.162.125
# Ověření z Edge na Core
tailscale ping 100.86.102.5
```

---

## Topologie Core + Edge

```
                            INTERNET
                               │
              ┌────────────────┼────────────────┐
              │                │                │
         Ext. Miner #1    Ext. Miner #2    Ext. Node #3
              │                │                │
              └────────────┬───┘                │
                           │                    │
                  tcp://77.42.71.94:8333 ───────┘
                           │
              ┌────────────▼────────────┐
              │      EDGE (VPS)         │
              │  P2P: 0.0.0.0:8333      │  ← Veřejný relay
              │  Pool: 0.0.0.0:8444     │  ← Veřejný stratum
              │  VPN: 100.66.162.125    │
              └────────────┬────────────┘
                           │ Tailscale (WireGuard)
              ┌────────────▼────────────┐
              │      CORE (PC)          │
              │  Node 1: 0.0.0.0:8333   │  ← Zdroj pravdy
              │  Node 2: 0.0.0.0:8334   │  ← Lokální follower
              │  Pool: 127.0.0.1:8444   │  ← Master PPLNS
              │  RPC: 127.0.0.1:8443    │
              │  Dashboard: 127.0.0.1:8765│
              │  VPN: 100.86.102.5      │
              │  Zálohy: V3/data/       │
              └────────────┬────────────┘
                           │
                    ┌──────┴──────┐
                    │  GPU Miner   │
                    │  127.0.0.1   │
                    └──────────────┘
```

---

## Parametry Edge serveru (77.42.71.94)

### Hardware

| Parametr | Hodnota |
|----------|---------|
| Provider | Hetzner Cloud |
| Lokace | Německo (hel) |
| Image | Ubuntu 26.04 |
| vCPU | 2 |
| RAM | 4 GB |
| Disk | 80 GB NVMe |
| Veřejná IP | `77.42.71.94` |
| Tailscale IP | `100.66.162.125` |
| SSH klíč | `ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOBW4wUXIVo7dUJ9lkFzfSYyV3JxCOmFNf+ezJMlMpNE` |

### Služby a porty

| Služba | Port | Bind | Popis |
|--------|------|------|-------|
| ZION Node P2P | `8333/tcp` | `0.0.0.0` | Veřejný P2P — inbound z internetu |
| ZION Pool Stratum | `8444/tcp` | `0.0.0.0` | Veřejný pool — externí minery |
| ZION Node RPC | `8443/tcp` | `127.0.0.1` | Interní RPC (jen localhost) |
| **ZION Public RPC** | `8443/tcp` | `77.42.71.94` | **Read-only proxy** (getBalance, getChainInfo, getTransaction...) — nginx + Python filter |
| Tailscale | `41641/udp` | — | VPN tunnel |
| SSH | `22/tcp` | `0.0.0.0` | Admin přístup (klíč-only) |

### Environment (Edge)

```bash
# Node
ZION_NODE_ID=zion-edge-relay
ZION_P2P_BIND=0.0.0.0:8333
ZION_RPC_BIND=127.0.0.1:8443
ZION_SEED_PEERS=100.86.102.5:8333       # Core via Tailscale
ZION_NODE_STATE_PATH=/root/zion-2.9.6-main/data/edge-state.db

# Pool (relay mode)
ZION_POOL_BIND=0.0.0.0:8444
ZION_NODE_RPC_ADDR=127.0.0.1:8443
ZION_POOL_LOOP_COUNT=1000000
ZION_MAX_SESSIONS_PER_IP=10
ZION_NONCE_COUNT=4096
ZION_VARDIFF_START_DIFF=1
ZION_VARDIFF_MAX_DIFF=1000000
ZION_UPSTREAM_POOL_ADDR=100.86.102.5:8444  # ShareRelay → Core

# Pool wallet (Edge vlastní — payouty z Edge poolu)
ZION_POOL_WALLET=zion1a6z5a4m830w6s6k7r508n300n6z30022q6qt0n7
ZION_POOL_PAYOUT_SK_HEX=[REDACTED — pool SK removed for security]

# Fee split (shodné s Core)
ZION_HUMANITARIAN_WALLET=zion1t4w447d7k4c600h3x893m5r55645w4p057yf4d7
ZION_ISSOBELLA_WALLET=zion1e4t5a390m2r427a8f3s39885v4f2v6n8u3mj3f5
ZION_POOL_FEE_WALLET=zion1f3d840y886x6r658j3t0f583j347l2e2h84z402
```

### Systemd služby

| Služba | Popis | Status |
|--------|-------|--------|
| `zion-edge.service` | ZION Node relay | `enabled + running` |
| `zion-edge-pool.service` | ZION Pool (Edge relay) | `enabled + running` |
| `tailscaled.service` | Tailscale VPN | `enabled + running` |
| `ufw.service` | Firewall | `enabled + active` |

```bash
# Edge server — kontrola
systemctl status zion-edge zion-edge-pool tailscaled ufw
journalctl -u zion-edge -f
journalctl -u zion-edge-pool -f
```

---

## Parametry Core serveru (ZionServer)

### Hardware

| Parametr | Hodnota |
|----------|---------|
| Lokace | Lokální PC (Windows 11) |
| Tailscale IP | `100.86.102.5` |
| Lokální IP | `192.168.x.x` (NAT, žádná veřejná IP) |
| GPU | AMD Radeon (OpenCL miner) |

### Služby a porty

| Služba | Port | Bind | Popis |
|--------|------|------|-------|
| Node 1 P2P | `8333/tcp` | `0.0.0.0` | P2P (jen lokální síť + Tailscale) |
| Node 2 P2P | `8334/tcp` | `0.0.0.0` | Follower (jen lokální síť) |
| Node 1 RPC | `8443/tcp` | `0.0.0.0` | RPC (lokální + Tailscale) |
| Node 2 RPC | `8446/tcp` | `0.0.0.0` | Follower RPC |
| Pool Stratum | `8444/tcp` | `0.0.0.0` | Master pool (PPLNS okno) |
| Dashboard | `8765/tcp` | `127.0.0.1` | Web UI |
| Metrics Node 2 | `9116/tcp` | `0.0.0.0` | Prometheus metrics |

### Environment (Core)

```powershell
# Topology mode
$env:ZION_TOPOLOGY = 'CORE'
$env:EDGE_TS_IP = '100.66.162.125'

# Node 1 (Genesis)
$env:ZION_NODE_ID='w11-native-node'
$env:ZION_P2P_BIND='0.0.0.0:8333'
$env:ZION_RPC_BIND='0.0.0.0:8443'
$env:ZION_SEED_PEERS='100.66.162.125:8333'   # Edge via Tailscale

# Node 2 (Follower)
$env:ZION_NODE_ID='w11-native-node2'
$env:ZION_P2P_BIND='0.0.0.0:8334'
$env:ZION_RPC_BIND='0.0.0.0:8446'
$env:ZION_METRICS_BIND='0.0.0.0:9116'
$env:ZION_SEED_PEERS='127.0.0.1:8333'

# Pool (Master)
$env:ZION_POOL_BIND='0.0.0.0:8444'
$env:ZION_NODE_RPC_ADDR='127.0.0.1:8443'
$env:ZION_POOL_LOOP_COUNT='1000000'
$env:ZION_NONCE_COUNT='4096'
$env:ZION_VARDIFF_MAX_DIFF='1000000'

# Miner
$env:ZION_POOL_ADDR='127.0.0.1:8444'
$env:ZION_LOOP_COUNT='1000000'
$env:ZION_GPU_BACKEND='opencl'
$env:ZION_GPU_WORK_SIZE='4096'
```

---

## Launch Stack (Core)

```powershell
# Spustí vše: Node1 + Node2 + Pool + Miner
$env:ZION_TOPOLOGY = 'CORE'
$env:EDGE_TS_IP = '100.66.162.125'
powershell -ExecutionPolicy Bypass -File .\scripts\launch-stack.ps1
```

Nebo pomocí wrapperu:
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\_launch-core.ps1
```

### Dashboard

```powershell
# Web UI na http://127.0.0.1:8765
powershell -ExecutionPolicy Bypass -File .\dashboard\start-dashboard.ps1
```

---

## Mainnet Launch Plán

### Fáze 0: Příprava (nyní)

- [x] **SSH klíče**: Vygenerovány a nasazeny na Edge
- [x] **Tailscale**: Nainstalován na Core i Edge, ověřen ping oběma směry
- [x] **Edge server**: Ubuntu 26.04, Rust, ZION repo, firewall, systemd služby
- [x] **Edge binary**: Node + Pool zkompilovány a nasazeny
- [x] **Edge wallet**: Pool wallet vygenerován (`zion1a6z5a4m830w6s6k7r508n300n6z30022q6qt0n7`)
- [x] **ShareRelay**: Edge → Core PPLNS synchronizace implementována
- [x] **Dashboard**: Dual-pool view (Core + Edge)
- [x] **Genesis #0**: Ověřit genesis block hash shodu mezi Core a Edge
  - Core: `85d8d6b29cdfa32b036068c70416c948b6eca63ba18bb20d0bfeb051f44ec897`
  - Edge: `85d8d6b29cdfa32b036068c70416c948b6eca63ba18bb20d0bfeb051f44ec897`
  - Status: **IDENTICAL**
- [x] **Test miner na Edge**: Připojit externího mineru k `77.42.71.94:8444`
  - TCP connect: OK, Hello/Welcome: OK, Job: OK (height=468), Result: OK
  - Status: **POOL COMMUNICATION WORKS**
- [x] **Test block propagation**: Najít block na Core, ověřit relay na Edge
  - Core height: 467, tip: `00000f899559d1929bd9e2c90167bec35e0824ae844f79354d9655b29a72544f`
  - Edge height: 467, tip: `00000f899559d1929bd9e2c90167bec35e0824ae844f79354d9655b29a72544f`
  - Status: **SYNCED**

### Fáze 1: Soft Launch (1–3 dny) — DONE 2026-05-23

- [x] **Lokální miner**: Core miner běží stabilně, hashrate konzistentní
  - Hashrate: ~10 KH/s (10s avg 9.44–10.64 KH/s)
  - GPU: AMD Radeon gfx1010, OpenCL backend
  - Backend: cosmic_harmony_ekam_deeksha_v2
  - Status: **STABLE**
- [x] **Edge sync**: Edge node sleduje Core height bez gapů
  - Core height: 469, Edge height: 468 (1 block behind, normal sync lag)
  - Tip hash shoda ověřena před restartem
  - Known peers: Core 100.86.102.5:8333
  - Status: **SYNCED**
- [x] **Edge pool**: Externí test miner připojen, share relay funguje
  - TCP connect: OK, Hello/Welcome: OK, Job: OK
  - ShareRelay config aktivní (`ZION_UPSTREAM_POOL_ADDR=100.86.102.5:8444`)
  - Status: **READY** (čeká na prvního externího mineru)
- [x] **Payout test**: Ověřit payout mechanismus na Core
  - Core pool: `payout_execution=enabled`
  - Pool wallet: `zion182e2v4x4r3u2j5r5t305k0d5y643q6l3n6je5f8`
  - Fee split: 89/5/5/1 (miners/humanitarian/issobella/pool)
  - Signing key: nakonfigurováno
  - Status: **ENABLED** (payouty se provedou při nalezení bloku)
- [x] **Firewall audit**: UFW pravidla správná, žádné zbytečné otevřené porty
  - Audit proveden: všechny otevřené porty jsou aktivně používané
  - 80/443: nginx (ZION web), 3000: zion-website (Docker)
  - 8333: P2P, 8444: pool, 8443: RPC, 8080: pool metrics
  - 22: SSH, 41641: Tailscale
  - Status: **AUDITED**
- [x] **Log rotace**: Nastavit logrotate na Edge (`/var/log/journal` limit)
  - `/etc/logrotate.d/zion`: daily, rotate 7, compress
  - `/etc/systemd/journald.conf.d/zion.conf`: max 500M, max file 50M, 1 week retention
  - Status: **CONFIGURED**

### Fáze 2: Hardening (3–7 dní) — DONE 2026-05-23

- [x] **Zálohy Core**: Automatická záloha `V3/data/` + `.env` na externí disk
  - Skript: `scripts/backup-core.ps1` — timestamped zip do `C:\ZION-Backups\`
  - Zálohuje: `V3/data/`, `.env.*`, `ssh-key-zion-edge.pub`, git state
  - Status: **CONFIGURED**
- [x] **Edge záloha**: Snapshot Edge VPS (Hetzner backup image)
  - Snapshot ID: `631712387075142` (vytvořeno přes Hetzner API)
  - Disaster recovery: nový VPS z tohoto image obnoví kompletní stav
  - Status: **CREATED**
- [x] **Failover test**: Vypnout Edge, ověřit že Core běží dál; pak obnovit Edge
  - Edge services: `systemctl stop zion-edge zion-edge-pool`
  - Core miner: pokračoval stabilně, height 493 (žádný gap)
  - Edge restart: `systemctl start zion-edge zion-edge-pool` — úspěšně obnoveno
  - Status: **PASSED**
- [ ] **Monitoring**: Prometheus + Grafana pro Core (už běží, ověřit metrics)
  - Prometheus scrapuje `zion-hiran-inference`, pool metrics, node metrics
  - Grafana dashboard: 16 panelů (latency, GPU, requests)
  - Status: **PARTIAL** (scraping běží, node/pool-specific dashboardy potřeba dodělat)
- [ ] **Alerting**: Nastavit upozornění na: node down, pool down, sync gap > 5 bloků
  - Alertmanager konfigurace: `V3/docker/prometheus/alertmanager.yml` (template)
  - Pravidla: 5 alertů definováno (down, high latency, error rate, GPU memory, GPU utilization)
  - Status: **PENDING** (potřeba aktivovat Alertmanager + webhook/notification channel)
- [ ] **Tailscale ACL**: Nastavit Tailscale ACL pro omezení přístupu jen na ZION uzly
  - Tailscale admin console: https://login.tailscale.com/admin/acls
  - Cíl: pouze tag: `zion` uzly se vzájemně vidí, ostatní traffic deny
  - Status: **PENDING** (ruční konfigurace v Tailscale admin UI)

### Fáze 3: Scale (1–2 týdny)

- [ ] **Node 3 (Edge #2)**: Nový VPS jako follower na Edge, seed `77.42.71.94:8333`
- [ ] **Node 4 (Edge #3)**: Další VPS pro redundanci
- [ ] **Load balancer**: DNS round-robin nebo anycast pro pool (`pool.zion.network`)
- [ ] **Community miners**: Otevřít pool pro veřejnost, fee split 89/5/5/1 komunikován
- [ ] **Block explorer**: Veřejný RPC endpoint pro prohlížení chainu (read-only)

### Fáze 4: Full Mainnet (1 měsíc+)

- [ ] **DAO spuštění**: Governance aktivní, proposal systém live
- [ ] **Bridge**: Cross-chain bridge L1 ↔ EVM (Ethereum/Polygon)
- [ ] **Atomic swap**: HTLC swaps mezi ZION a BTC/ETH
- [ ] **Hiran AI**: Inference endpoint pro ZION ecosystem queries
- [ ] **Audit**: Externí security audit L1 consensus + pool + bridge
- [ ] **Bug bounty**: Veřejný bug bounty program

---

## Plán budoucích nodů (Edge cluster)

### Příští uzly na Edge infrastruktuře

| Priorita | Role | Lokace | Seed | Pool | Popis |
|----------|------|--------|------|------|-------|
| 1 | Edge #2 | Hetzner (jiný region) | `77.42.71.94:8333` | Ano | Druhý relay pro redundanci |
| 2 | Edge #3 | OVH / DigitalOcean | `77.42.71.94:8333` | Ano | Třetí relay pro geografickou diverzitu |
| 3 | Archive | Core PC | `100.66.162.125:8333` | Ne | Full history node pro zálohy |

### Pravidla pro nové Edge nody

1. **Core zůstává lokální**: Všechny zálohy, genesis, a master PPLNS zůstávají na Core PC
2. **Edge = relay only**: Nové uzly na Edge jsou follower/relay, ne source-of-truth
3. **Veřejný P2P**: Každý Edge node binduje P2P na `0.0.0.0:8333`
4. **Tailscale povinný**: Každý Edge node musí být na Tailscale pro VPN sync s Core
5. **Pool relay**: Každý Edge pool používá `ZION_UPSTREAM_POOL_ADDR` na Core
6. **Samostatný wallet**: Každý Edge pool má vlastní wallet pro payouty (není sdílené)
7. **systemd + auto-restart**: Všechny služby přes systemd s `Restart=always`
8. **UFW minimum**: Pouze 8333/tcp (P2P), 8444/tcp (pool), 22/tcp (SSH), 41641/udp (Tailscale)

### Bootstrap nového Edge nodu

```bash
# 1. Vytořit VPS (Hetzner / OVH / DO)
# 2. Přidat SSH klíč z tohoto repa
# 3. Spustit setup
ssh root@<NEW_EDGE_IP> "bash /root/edge-server-setup.sh"

# 4. Tailscale login (stejný tailnet)
tailscale up

# 5. Zkopírovat ZION repo
scp -r -i ssh-key-zion-edge V3 root@<NEW_EDGE_IP>:/root/V3/

# 6. Build
ssh root@<NEW_EDGE_IP> "cd /root/V3 && . ~/.cargo/env && cargo build --release --bin node --bin server"

# 7. Vytvořit pool wallet
ssh root@<NEW_EDGE_IP> "/root/V3/target/release/gen-keys | grep ZION_POOL"

# 8. Nastavit systemd services (podle šablony z MainnetEdge)
# 9. Změnit ZION_SEED_PEERS na 77.42.71.94:8333 (nebo jiný Edge)
# 10. Start: systemctl start zion-edge zion-edge-pool
```

---

## Operativní příkazy

### Edge server

```bash
# Status všech služeb
systemctl status zion-edge zion-edge-pool tailscaled ufw

# Logy
journalctl -u zion-edge -f
journalctl -u zion-edge-pool -f

# Restart
systemctl restart zion-edge
systemctl restart zion-edge-pool

# Tailscale
 tailscale status
tailscale ping 100.86.102.5

# Firewall
ufw status numbered

# Disk
 df -h
 du -sh /root/V3/data/ /root/zion-2.9.6-main/data/
```

### Core PC

```powershell
# Status procesů
tasklist | findstr node
tasklist | findstr server
tasklist | findstr zion-miner

# Logy
type logs\node1.log | findstr "relay\|sync\|height"
type logs\pool.log | findstr "share_relay\|valid_share\|Accepted"
type logs\miner.log | findstr "hashrate\|Accepted\|Rejected"

# Dashboard
 curl http://127.0.0.1:8765/api/status | python -m json.tool

# Tailscale
& "C:\Program Files\Tailscale\tailscale.exe" status
& "C:\Program Files\Tailscale\tailscale.exe" ping 100.66.162.125
```

---

## Bezpečnostní checklist

- [x] **SSH**: Pouze klíč (PasswordAuthentication no, PermitRootLogin prohibit-password)
- [x] **UFW**: Minimum portů (8333, 8444, 22, 41641)
- [x] **Tailscale**: Mesh VPN, žádné veřejné porty na Core
- [x] **Pool wallet**: Každý pool má vlastní wallet + signing key
- [x] **RPC**: Core RPC binduje 0.0.0.0:8443 (přístupné přes Tailscale, ne internet)
- [ ] **Tailscale ACL**: Omezit přístup na tailnetu (jen ZION uzly)
- [ ] **2FA**: Hetzner Console 2FA zapnuto
- [ ] **Backup**: Automatická záloha Core datadir
- [ ] **Secrets**: Žádné privátní klíče v gitu (`.gitignore` obsahuje `*.key`, `ssh-key-*`)

---

## Kontakty & odkazy

| Dokument | Cesta |
|----------|-------|
| Network Topology (architektura) | `docs/ZION_NETWORK_TOPOLOGY.md` |
| Topology Diagram | `docs/ZION_TOPOLOGY_DIAGRAM.md` |
| Edge Setup Script | `scripts/edge-server-setup.sh` |
| Edge Launch Script | `scripts/launch-edge-node.sh` |
| Deploy Orchestrator | `scripts/deploy-edge.ps1` |
| Tailscale Setup (Linux) | `scripts/setup-tailscale.sh` |
| Tailscale Setup (Windows) | `scripts/setup-tailscale.ps1` |
| Hetzner API Helper | `scripts/hetzner-api.ps1` |
| SSH Config Template | `scripts/ssh-config.txt` |
| Core Launch (wrapper) | `scripts/_launch-core.ps1` |
| StatusV3 (kanonický stav) | `StatusV3.md` |
| Docker/Hardening | `V3/docker/HARDENING.md` |
| Deploy Runbook | `V3/docs/MAINNET_DEPLOY_RUNBOOK.md` |
