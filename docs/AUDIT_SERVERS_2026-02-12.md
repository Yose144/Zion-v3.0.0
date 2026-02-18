# 🔍 DEEP SERVER AUDIT — Stav vs Dokumentace

> **Datum:** 12. února 2026  
> **Autor:** AI Audit Agent  
> **Scope:** Helsinki (77.42.31.72), Germany (195.201.31.201), newearth.cz

---

## 📊 Executive Summary

| Oblast | Shoda s dokumentací | Závažnost |
|--------|:-------------------:|:---------:|
| Docker stack (Helsinki) | ✅ 95% | — |
| Docker stack (Germany) | ✅ 90% | 🟡 |
| Blockchain sync | ✅ OK | — |
| Mining | ⚠️ 70% | 🟡 |
| Pool | ⚠️ 60% | 🔴 |
| Monitoring (Prometheus/Grafana) | ❌ 0% | 🔴 |
| SSL/Firewall | ⚠️ 50% | 🔴 |
| newearth.cz (V2 web) | ⚠️ 75% | 🟡 |
| Seed Nodes dokumentace | ❌ Zastaralé | 🔴 |
| Website-v2.9 | ✅ 100% | — |

**Celková shoda: ~65%** — dokumentace popisuje cílový stav, servery jsou v testnet fázi s významnými mezerami.

---

## 1. 🇫🇮 Helsinki Server (77.42.31.72) — Primary Node

### 1.1 Systém
| Parametr | Stav | Dokumentace | Shoda |
|----------|------|-------------|:-----:|
| OS | Ubuntu 24.04.3 (aarch64) | ≥ Ubuntu 22.04 | ✅ |
| CPU | 4 cores ARM64 | 2+ cores | ✅ |
| RAM | 7.5 GB (5.2 GB used) | 2+ GB | ✅ |
| Swap | **0 B** | N/A | ⚠️ doporučen 4 GB |
| Disk | 75 GB (21% used = 15 GB) | 10+ GB SSD | ✅ |
| Load | 3.59 (na 4 cores = 90%) | — | ⚠️ vysoký |
| Uptime | 6 dní | — | ✅ |

### 1.2 Docker Stack
| Kontejner | Image | Status | Docs říkají | Shoda |
|-----------|-------|--------|-------------|:-----:|
| zion-core | 2.9.5-testnet | ✅ Up (healthy) | core na 8334/8444 | ✅ |
| zion-pool | 2.9.5-testnet | ✅ Up (healthy) | pool na 3333/8080 | ✅ |
| zion-miner | 2.9.5-testnet | ✅ Up | miner → pool:3333 | ✅ |
| zion-redis | redis:7-alpine | ✅ Up (healthy) | redis 6379 internal | ✅ |
| zion-web | latest | ✅ Up | Není v compose! | ⚠️ manuální |
| **prometheus** | — | ❌ NEBĚŽÍ | monitoring compose | 🔴 |
| **grafana** | — | ❌ NEBĚŽÍ | monitoring compose | 🔴 |
| **node-exporter** | — | ❌ NEBĚŽÍ | monitoring compose | 🔴 |
| **redis-exporter** | — | ❌ NEBĚŽÍ | monitoring compose | 🔴 |

### 1.3 Blockchain
| Metrika | Stav | Pozn. |
|---------|------|-------|
| Block height | 1358 | Testnet běží |
| Peers | 4 (z max 64) | ⚠️ nízký |
| IBD | Dokončen | ✅ |
| REST API `/api/blockchain/info` | ❌ Nefunguje | Chybí endpoint |
| RPC na 8444 | ✅ Funkční (healthcheck) | ✅ |

### 1.4 P2P Problémy
```
Invalid message from 172.18.0.1:43194: expected value at line 1 column 1
[P2P Security] Temporarily banned 172.18.0.1 for 300s
```
→ **Interní Docker IP (miner kontejner) posílá invalid zprávy do core**. Miner se pokouší o přímé P2P spojení místo Stratum.

### 1.5 Nginx
| Endpoint | Target | Stav |
|----------|--------|:----:|
| `/` | localhost:3000 (Next.js) | ✅ |
| `/dash/` | /var/www/html/dash/ | ⚠️ neověřeno |
| `/pool-api/` | localhost:8080 | ✅ |
| `/api/dashboard/` | localhost:8001 (FastAPI) | ❌ FastAPI neběží! |
| `/api/v2.9/` | localhost:8001 | ❌ FastAPI neběží! |
| `/api/rainbow-bridge/` | localhost:8001 | ❌ FastAPI neběží! |

**3 z 6 Nginx proxy targetů směřují na neexistující FastAPI backend (port 8001).**

### 1.6 SSL & Firewall
- ✅ Let's Encrypt ECDSA, expiry 2026-05-01 (78 dní)
- ✅ UFW aktivní, deny incoming default
- ⚠️ Port 8181, 3334 otevřeny bez účelu

---

## 2. 🇩🇪 Germany Server (195.201.31.201) — Secondary Node

### 2.1 Systém
| Parametr | Stav |
|----------|------|
| OS | Ubuntu 24.04.3 (x86_64) |
| CPU | 4 cores x86_64 |
| RAM | 7.6 GB (702 MB used — velmi nízké) |
| Disk | 75 GB (8% used) |
| Load | 0.25 (nízký) |

### 2.2 Docker Stack — Shodný s Helsinki (4 kontejnery OK, monitoring chybí)

### 2.3 Pool Issues
```
ERROR ❌ Failed to restart xmrig with defaults: xmrig binary not found
WARN ❌ Share REJECTED: reason=Duplicate share (3×)
```
→ **xmrig binárka chybí** v pool kontejneru → XMR revenue mining nefunkční
→ **Duplicate shares** — miner posílá identické nonce

### 2.4 Blockchain — Fork/Reorg
```
🔀 Fork detected at height 1353 — reorg SUCCESS
```
→ Fungující, ale časté re-orgy indikují timing issues

### 2.5 🔴 KRITICKÉ
| Nález | Závažnost |
|-------|:---------:|
| **UFW NEAKTIVNÍ** — všechny porty otevřené | 🔴 |
| **Nginx neinstalován** | ⚠️ |
| **SSL/Certbot chybí** | ⚠️ |
| **Duplicitní repo** (Zion-2.9.5 + zion-2.9.5) | 🟡 |
| **Žádný crontab** | 🟡 |

---

## 3. 🌐 newearth.cz — V2 Web

### 3.1 Stav
| Metrika | Hodnota |
|---------|---------|
| HTTP | ✅ 200 OK, 107ms |
| PHP | 7.3.33 ⚠️ **EOL!** |
| Webroot | 520 MB |
| V2/ web | ✅ 24 stránek |
| **Bonus/** | ❌ CHYBÍ |
| **Amenti/** | ❌ CHYBÍ |
| .htaccess | ❌ CHYBÍ |

### 3.2 PHP Security — 10 souborů s exec/eval/system

---

## 4. 📋 Dokumentace vs Realita

### 4.1 QUICK_START.md — Seed Nodes
| Dokumentace | Skutečnost |
|-------------|------------|
| Helsinki 77.42.31.72:8334 | ✅ Běží |
| USA 5.78.145.234 | ❌ **NEEXISTUJE** |
| Singapore 5.223.56.124 | ❌ **NEEXISTUJE** |
| Germany 195.201.31.201 | ⚠️ Fyzicky běží ale **CHYBÍ v docs!** |

### 4.2 Monitoring — NEDEPLOYOVÁNO
- `docker-compose.monitoring.yml` existuje v repu
- Prometheus config: 10 scrape targetů
- `alerts.yml`: 15 alertů (Pool, Core, Infra, Redis)
- Grafana: 2 dashboardy (pool-overview, infrastructure)
- **Nic z toho neběží na žádném serveru.**

### 4.3 CH3 Revenue Architecture
| Feature | Docs | Realita |
|---------|------|---------|
| CosmicHarmony mining | ✅ | ✅ Funguje |
| XMR revenue mining | ✅ | ❌ xmrig chybí |
| ETC Keccak byproduct | ✅ | ❓ Neověřeno |
| ProfitSwitcher | ✅ | ⚠️ Částečně |
| BTC → DAO Treasury | ✅ | ❓ Žádný BTC mining |

### 4.4 Roadmap Claim "~92% MainNet readiness"
**Realita: spíše 65-70%** — monitoring kompletně chybí, pool bugy, revenue mining nefunkční.

---

## 5. 🚨 Kritické Nálezy (Prioritizované)

### 🔴 P1 — Okamžitě Řešit

| # | Nález | Server |
|---|-------|--------|
| 1 | **UFW neaktivní na Germany** — Redis 6379 přístupný z internetu | Germany |
| 2 | **Monitoring stack nedeployován** — 0% observability | Oba |
| 3 | **FastAPI (port 8001) neběží** — 3 Nginx endpoints 502 | Helsinki |
| 4 | **xmrig chybí v pool kontejneru** | Germany |
| 5 | **Bonus/ a Amenti/ chybí na newearth.cz** | newearth.cz |

### 🟡 P2 — Tento Týden

| # | Nález | Server |
|---|-------|--------|
| 6 | QUICK_START.md — neexistující USA/Singapore seed nody | Docs |
| 7 | Žádný swap na obou serverech | Oba |
| 8 | Duplicate shares na Germany | Germany |
| 9 | PHP 7.3 EOL na newearth.cz | newearth.cz |
| 10 | Vysoký load 90% na Helsinki | Helsinki |
| 11 | Duplicitní repo na Germany (512 MB) | Germany |
| 12 | P2P ban vlastního Docker IP | Helsinki |
| 13 | Neznámý collect_stats.sh crontab | Helsinki |
| 14 | Nepoužívané porty 8181, 3334 v UFW | Helsinki |

---

## 6. 📝 Akční Plán

### Okamžitě
```bash
# Germany UFW
ssh root@195.201.31.201 'ufw allow 22,8334,8444,3333,8080/tcp && ufw enable'

# Re-upload Bonus/Amenti na newearth.cz
scp -r Bonus/ Amenti/ ssh-685961@dw214.webglobe.com:public_html/V2/

# Fix QUICK_START.md seeds
sed -i 's/5.78.145.234/195.201.31.201/g' QUICK_START.md
```

### Tento Týden
```bash
# Deploy monitoring (Helsinki)
docker compose -f docker/docker-compose.monitoring.yml up -d

# Swap (oba servery)
fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile

# Cleanup Germany
rm -rf /root/Zion-2.9.5  # duplicate repo
```

---

*Další audit doporučen po implementaci P1 nálezů.*
