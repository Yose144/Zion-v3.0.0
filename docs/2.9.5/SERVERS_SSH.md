# 🌍 ZION TerraNova v2.9.5 - Server Infrastructure

> **Aktualizováno:** 11. února 2026  
> **Status:** P2P Network LIVE (Native Rust, 2-node topology)

---

## 📋 Přehled Serverů

| Server | Role | IP/Host | P2P Port | RPC Port | Pool Port | SSH Key | Stav |
|--------|------|---------|----------|----------|-----------|---------|------|
| **Helsinki** 🇫🇮 | 🌟 SEED NODE + WEB | 77.42.31.72 | 8334 | 8444 | 3333 | `zion_hetzner_key` | ✅ Online |
| **Germany** 🇩🇪 | 🔗 PEER NODE | 195.201.31.201 | 8334 | 8444 | 3333 | `zion_hetzner_key` | ✅ Online |
| **NewEarth.cz** | 🌐 LANDING PAGE | dw214.webglobe.com | - | - | - | password | ✅ Online |

> Kanonické porty pro v2.9.5 jsou sjednocené napříč nody: P2P `8334`, RPC `8444`, Stratum `3333`, Pool API `8080`.

### ❌ Decommissioned servery
| Server | IP | Důvod | Datum |
|--------|-----|-------|-------|
| USA | 5.78.145.234 | Offline, konsolidace na 2 nody | leden 2026 |
| Singapore | 5.223.56.124 | Offline, konsolidace na 2 nody | leden 2026 |
| Old DE | 91.98.122.165 | Nahrazen novým Germany serverem | únor 2026 |

## 🆕 Native Rust Implementation (v2.9.5)

Servery běží **Docker-first**: kontejnery s nativními Rust binárkami.
- `zion-core` - Blockchain node
- `zion-pool` - Mining pool
- `zion-miner` - CPU miner
- `zion-redis` - share tracking/cache

### Doporučené compose soubory
- Full stack (web/api/nginx): [2.9.5/docker-compose.native-2.9.5.yml](../docker-compose.native-2.9.5.yml)
- Node stack (core+pool+redis): [2.9.5/docker-compose.node-2.9.5.yml](../docker-compose.node-2.9.5.yml)

---

## 🔐 SSH Připojení

### Helsinki (PRIMARY SEED NODE + zionterranova.com)
```bash
ssh -i ~/.ssh/zion_hetzner_key root@77.42.31.72
```

### Germany (PEER NODE — Falkenstein, DE)
```bash
ssh -i ~/.ssh/zion_hetzner_key root@195.201.31.201
```

### NewEarth.cz (Landing Page Hosting)
```bash
ssh -p 20002 ssh-685961@dw214.webglobe.com
```
> ⚠️ Vyžaduje heslo (Webglobe hosting)

---

## 🇫🇮 HELSINKI SERVER (SEED NODE + WEBSITE)

**IP:** `77.42.31.72`  
**Hostname:** `ubuntu-8gb-hel1-1`  
**Provider:** Hetzner Helsinki (8GB RAM, 75GB SSD)

### 🔧 Docker služby
```bash
docker ps
docker logs -f zion-core
docker logs -f zion-pool
docker logs -f zion-web
docker logs -f zion-miner
```

### 🌐 Služby & Porty
| Port | Služba | Popis |
|------|--------|-------|
| 8334 | P2P | Blockchain P2P (SEED) |
| 8444 | RPC | Blockchain JSON-RPC |
| 3333 | Stratum | Mining pool |
| 8080 | Pool API | Pool statistics |
| 3000 | Next.js | Website (zion-web) |
| 80/443 | nginx | Web reverse proxy → zionterranova.com |

### 📁 Důležité Cesty
```bash
/root/zion-v2.9/2.9.5/        # repo + docker-compose
/root/zion-2.9.5/              # Dockerfiles
/opt/zion/website-v2.9/        # website source + Docker build
/var/lib/docker/volumes/       # docker volumes
```

### ⚙️ Rychlé Příkazy
```bash
# Test RPC
curl -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"get_block_template","params":{"wallet":"test"}}' \
  http://127.0.0.1:8444/jsonrpc

# Test pool connection
echo '{"id":1,"method":"login","params":{"login":"test"}}' | nc localhost 3333

# Docker cleanup (spouštět pravidelně!)
docker image prune -f && docker builder prune -f && docker volume prune -f
```

---

## 🇩🇪 GERMANY SERVER (PEER NODE)

**IP:** `195.201.31.201`  
**Hostname:** `Germany / Falkenstein`  
**Provider:** Hetzner Germany (8GB RAM, 75GB SSD)

### 🔧 Docker služby
```bash
docker ps
docker logs -f zion-core
docker logs -f zion-pool
docker logs -f zion-miner
```

### 🌐 Služby & Porty
| Port | Služba | Popis |
|------|--------|-------|
| 8334 | P2P | Blockchain P2P |
| 8444 | RPC | Blockchain JSON-RPC |
| 3333 | Stratum | Mining pool |
| 8080 | Pool API | Pool statistics |

### 📁 Cesty
```bash
/root/zion-v2.9/2.9.5/
/var/lib/docker/volumes/
```

---

## 🌐 NEWEARTH.CZ (Landing Page)

**Host:** `dw214.webglobe.com`  
**SSH Port:** `20002`  
**User:** `ssh-685961`  
**Provider:** Webglobe (shared hosting)

### 📁 Struktura
```bash
/home/html/newearth.cz/
├── public_html/           # Web root
│   ├── index.html         # Landing page
│   ├── .htaccess          # Apache config
│   ├── V2/                # Presale & wallet pages
│   │   ├── presale.html
│   │   ├── wallet.html
│   │   └── dashboard.html
│   └── images/
│       ├── pf2026q.optim.mp4
│       └── logo144.png
└── logs/                  # Apache logs
```

### 🔧 Deploy Skript
```bash
# Z lokálního prostředí
./scripts/deploy_newearth_landing.sh
```

### ⚠️ Omezení
- Shared hosting (bez root přístupu)
- Pouze PHP & statické soubory
- FTP/SFTP deploy
- Bez Docker podpory

---

## 🔗 P2P Síť

### Peer Discovery
```
SEED NODES:
├── 77.42.31.72:8334   (Helsinki - PRIMARY SEED + WEB)
└── 195.201.31.201:8334 (Germany - PEER NODE)
```

### Genesis Block
```
Hash: 464197061ebf84652bdeec238791ba27755dcd59...
All nodes synchronized: ✅
```

---

## 🔒 Firewall Rules (doporučené)

### Helsinki (Seed Node + Website)
```bash
ufw allow 22/tcp        # SSH
ufw allow 80/tcp        # HTTP
ufw allow 443/tcp       # HTTPS
ufw allow 3000/tcp      # Next.js (zion-web)
ufw allow 3333/tcp      # Stratum
ufw allow 8080/tcp      # Pool API
ufw allow 8334/tcp      # P2P
ufw allow 8444/tcp      # RPC
ufw allow 9090/tcp      # Prometheus (optional)
ufw allow 3001/tcp      # Grafana (optional)
```

### Germany (Peer Node)
```bash
ufw allow 22/tcp        # SSH
ufw allow 3333/tcp      # Stratum
ufw allow 8080/tcp      # Pool API
ufw allow 8334/tcp      # P2P
ufw allow 8444/tcp      # RPC
ufw allow 9100/tcp      # Node Exporter (monitoring)
```

---

## 📊 API Endpoints

### Helsinki (Primary + Website)
```bash
# Health check
curl http://77.42.31.72/api/dashboard/health

# Pool stats
curl http://77.42.31.72/api/dashboard/pool/stats

# Blockchain stats
curl http://77.42.31.72/api/dashboard/blockchain/stats

# Website health
curl https://zionterranova.com/api/health

# Pool direct
curl http://77.42.31.72:8080/stats
```

### Germany (Peer Node)
```bash
# Pool status
curl http://195.201.31.201:8080/stats

# Blockchain RPC
curl http://195.201.31.201:8444/health
```

---

## 🛠️ Maintenance Příkazy

### Docker Cleanup (spouštět pravidelně!)
```bash
# Helsinki
ssh -i ~/.ssh/zion_hetzner_key root@77.42.31.72 "docker image prune -f && docker builder prune -f && docker volume prune -f && df -h /"

# Germany
ssh -i ~/.ssh/zion_hetzner_key root@195.201.31.201 "docker image prune -f && docker builder prune -f && docker volume prune -f && df -h /"
```

### Aktualizace Všech Serverů
```bash
# Helsinki (Primary + Web)
ssh -i ~/.ssh/zion_hetzner_key root@77.42.31.72 "cd /root/zion-v2.9/2.9.5 && git pull && docker compose up -d --build"

# Germany (Peer)
ssh -i ~/.ssh/zion_hetzner_key root@195.201.31.201 "cd /root/zion-v2.9/2.9.5 && git pull && docker compose up -d --build"
```

### Kontrola Stavu Obou Serverů
```bash
for server in "77.42.31.72" "195.201.31.201"; do
  echo "=== $server ==="
  ssh -o ConnectTimeout=10 -i ~/.ssh/zion_hetzner_key root@$server \
    "df -h / | tail -1; docker ps --format 'table {{.Names}}\t{{.Status}}'; echo ''"
done
```

### Kontrola Chain Sync
```bash
for server in "77.42.31.72" "195.201.31.201"; do
  echo "=== $server ==="
  ssh -o ConnectTimeout=10 -i ~/.ssh/zion_hetzner_key root@$server \
    "curl -s http://127.0.0.1:8444/health 2>/dev/null || echo 'RPC not responding'"
done
```

---

## 📝 Poznámky

### ⚠️ Důležité!
1. **zionterranova.com** je na **Helsinki** serveru (nginx → zion-web:3000)
2. **Helsinki** je PRIMARY SEED + WEB — oba nody se k němu připojují
3. **Germany** je PEER NODE v Hetzner Falkenstein (8GB RAM, 75GB SSD)
4. **NewEarth.cz** je pouze pro landing page (PHP hosting)
5. **USA** a **Singapore** servery byly zrušeny (leden 2026) — konsolidace na 2 nody
6. **Old DE server** (91.98.122.165) nahrazen novým Germany (195.201.31.201) v únoru 2026
7. ⚠️ **Docker image bloat** — oba servery mají tendenci hromadit dangling images. Spouštět `docker image prune -f` pravidelně!

### 🔑 SSH Klíče
```bash
~/.ssh/zion_hetzner_key    # Helsinki + Germany (stejný klíč pro oba servery)
```

### 📧 E-mail Setup
- SMTP Server: mail.newearth.cz
- From: admin@newearth.cz, shop@newearth.cz

---

## 🌟 Quick Reference

```bash
# Helsinki (SEED + WEBSITE)
ssh -i ~/.ssh/zion_hetzner_key root@77.42.31.72

# Germany (PEER NODE)
ssh -i ~/.ssh/zion_hetzner_key root@195.201.31.201

# NewEarth.cz (LANDING)
ssh -p 20002 ssh-685961@dw214.webglobe.com

# Quick Docker cleanup (oba servery)
for s in 77.42.31.72 195.201.31.201; do
  echo "=== $s ===" && ssh -o ConnectTimeout=10 -i ~/.ssh/zion_hetzner_key root@$s \
    "docker image prune -f 2>&1 | tail -1; docker builder prune -f 2>&1 | tail -1; df -h / | tail -1"
done
```

---

*Peace & One Love ☮️❤️*  
*ZION TerraNova - Where Technology Meets Spirit*
