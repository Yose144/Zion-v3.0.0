# 🌍 ZION TerraNova v2.9 - Server Infrastructure

> **Aktualizováno:** 17. ledna 2026  
> **Status:** Production-Ready (TestNet)

---

## 📋 Přehled Serverů

| Server | Role | IP/Host | SSH Port | SSH Key | Stav |
|--------|------|---------|----------|---------|------|
| **Helsinki** | 🌟 PRIMARY SEED + WEBSITE | 77.42.31.72 | 22 | `zion_hetzner_key` | ✅ Online |
| **Singapore** | 🔗 PEER NODE 2 | 5.223.56.122 | 22 | `zion_hetzner_key` | ✅ Online |
| **USA** | 🔗 PEER NODE 1 | 5.78.138.238 | 22 | `zion_hetzner_key` | ✅ Online |
| **NewEarth.cz** | 🌐 LANDING PAGE | dw214.webglobe.com | 20002 | user password | ✅ Online |

---

## 🔐 SSH Připojení

### Helsinki (PRIMARY SEED NODE + zionterranova.com)
```bash
ssh -i ~/.ssh/zion_hetzner_key root@77.42.31.72
```

### Singapore Server (PEER NODE 2) 🆕
```bash
ssh -i ~/.ssh/zion_hetzner_key root@5.223.56.122
```

### USA Server (PEER NODE 1)
```bash
ssh -i ~/.ssh/zion_hetzner_key root@5.78.138.238
```

### NewEarth.cz (Landing Page Hosting)
```bash
ssh -p 20002 ssh-685961@dw214.webglobe.com
```
> ⚠️ Vyžaduje heslo (Webglobe hosting)

---

## 🇫🇮 HELSINKI SERVER (PRIMARY SEED NODE + WEBSITE)

**IP:** `77.42.31.72`  
**Hostname:** `ubuntu-8gb-hel1-1`  
**Provider:** Hetzner (8GB RAM, 75GB SSD)  
**Disk Usage:** 25% (18G/75G)

### 🌐 HOSTUJE: zionterranova.com
```
Domain: zionterranova.com
SSL: ✅ Aktivní (Let's Encrypt)
Frontend: Next.js / Static
```

### 📦 Docker Containers
| Container | Status | Porty |
|-----------|--------|-------|
| `zion-blockchain-helsinki` | ✅ Healthy | 8334 (P2P), 8444 (RPC), 18082 (Monero-style RPC) |
| `zion-pool-helsinki` | ✅ Running | 3333 (Stratum), 8080 (Pool API) |
| `zion-peer1-helsinki` | ✅ Running | 8335 (P2P), 8445 (RPC) |
| `zion-peer2-helsinki` | ✅ Running | 8336 (P2P), 8446 (RPC) |
| `zion-postgres-helsinki` | ✅ Healthy | 5433 (PostgreSQL) |
| `zion-redis-helsinki` | ✅ Healthy | 6380 (Redis) |

### 🌐 Služby & Porty
| Port | Služba | Popis |
|------|--------|-------|
| 80 | nginx | Reverse proxy |
| 3333 | Stratum | Mining pool protocol |
| 8001 | Dashboard API | FastAPI (standalone) |
| 8002 | AI Knowledge Server | Enhanced knowledge extractor |
| 8080 | Pool HTTP API | Pool statistics |
| 8334 | P2P Main | Blockchain node (seed) |
| 8335 | P2P Peer1 | Internal peer |
| 8336 | P2P Peer2 | Internal peer |
| 8444-8446 | RPC | Blockchain RPC endpoints |
| 11434 | Ollama | Local LLM inference |
| 18082 | Monero RPC | Compatibility endpoint |

### 📁 Důležité Cesty
```bash
/root/zion-v2.9/           # Hlavní projekt
/root/dashboard_api.py      # Dashboard API server
/app/ai/                    # AI Knowledge system
/var/www/html/              # Nginx web root
```

### 🔧 Systémové Služby
- `docker.service` - Docker daemon
- `nginx.service` - Web server / reverse proxy

### ⚙️ Rychlé Příkazy
```bash
# Restart blockchain
docker restart zion-blockchain-helsinki

# Logy pool
docker logs -f zion-pool-helsinki

# Restart Dashboard API
pkill -f dashboard_api && python3 /root/dashboard_api.py &

# Test pool
curl http://localhost:8080/stats
```

---

## 🇸🇬 SINGAPORE SERVER (PEER NODE 2) ✅

**IP:** `5.223.56.122`  
**Hostname:** `PeerNode2`  
**Provider:** Hetzner Singapore (2GB RAM, 38GB SSD)  
**Disk Usage:** 4% (1.2G/35G) ✅

### 📦 Docker Containers
| Container | Status | Porty |
|-----------|--------|-------|
| `zion-blockchain-singapore` | ✅ Running | 8335 (P2P), 8444 (RPC), 18082 (Monero RPC) |
| `zion-pool-singapore` | ✅ Running | 3333 (Stratum), 8080 (Pool API) |
| `zion-redis-singapore` | ✅ Running | 6379 (Redis) |

### 🌐 Služby & Porty
| Port | Služba | Popis |
|------|--------|-------|
| 3333 | Stratum | Mining pool |
| 8080 | Pool API | Statistics |
| 8335 | P2P | Blockchain peer |
| 8444 | RPC | Blockchain RPC |
| 18082 | Monero RPC | Compatibility |

### 📁 Důležité Cesty
```bash
/root/zion-v2.9/           # Hlavní projekt
/root/zion-v2.9/logs/      # Logy
```

### ⚙️ Rychlé Příkazy
```bash
# Deploy
cd /root/zion-v2.9 && docker compose up -d

# Logy blockchain
docker logs -f zion-blockchain-singapore

# Check peer connections
curl http://localhost:8080/stats | jq '.peers'
```

---

## 🇺🇸 USA SERVER (PEER NODE 1)

**IP:** `5.78.138.238`  
**Hostname:** `SeedNodes`  
**Provider:** Hetzner USA (4GB RAM, 38GB SSD)  
**Disk Usage:** 12% (4.3G/38G) ✅

### 📦 Docker Containers
| Container | Status | Porty |
|-----------|--------|-------|
| `zion-blockchain-usa` | ✅ Running | 8335 (P2P), 8444 (RPC), 18082 (Monero RPC) |
| `zion-pool-usa` | ✅ Running | 3333 (Stratum), 8080 (Pool API) |
| `zion-redis-usa` | ✅ Running | 6379 (Redis) |

### 🌐 Služby & Porty
| Port | Služba | Popis |
|------|--------|-------|
| 3333 | Stratum | Mining pool |
| 8080 | Pool API | Statistics |
| 8335 | P2P | Blockchain peer |
| 8444 | RPC | Blockchain RPC |
| 18082 | Monero RPC | Compatibility |

### ⚙️ Rychlé Příkazy
```bash
# Restart all
cd /root/zion-v2.9 && docker-compose restart

# Logy blockchain
docker logs -f zion-blockchain-usa

# Check peer connections
curl http://localhost:8080/stats | jq '.peers'
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
├── 77.42.31.72:8334  (Helsinki - PRIMARY SEED + WEB)
├── 5.78.138.238:8335  (USA - PEER 1)
└── 5.223.56.122:8335  (Singapore - PEER 2) 🆕
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
ufw allow 3333/tcp      # Stratum
ufw allow 8080/tcp      # Pool API
ufw allow 8334:8336/tcp # P2P
```

### USA (Peer Node 1)
```bash
ufw allow 22/tcp        # SSH
ufw allow 3333/tcp      # Stratum
ufw allow 8080/tcp      # Pool API
ufw allow 8335/tcp      # P2P
```

### Singapore (Peer Node 2) 🆕
```bash
ufw allow 22/tcp        # SSH
ufw allow 3333/tcp      # Stratum
ufw allow 8080/tcp      # Pool API
ufw allow 8335/tcp      # P2P
ufw allow 8444/tcp      # RPC
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
```

### USA (Peer Node 1)
```bash
# Pool status
curl http://5.78.138.238:8080/stats
```

### Singapore (Peer Node 2) 🆕
```bash
# Pool status
curl http://5.223.56.122:8080/stats

# Blockchain RPC
curl http://5.223.56.122:8444/health
```

---

## 🛠️ Maintenance Příkazy

### Aktualizace Všech Serverů
```bash
# Helsinki (Primary + Web)
ssh -i ~/.ssh/zion_hetzner_key root@77.42.31.72 "cd /root/zion-v2.9 && git pull && docker compose up -d --build"

# USA (Peer 1)
ssh -i ~/.ssh/zion_hetzner_key root@5.78.138.238 "cd /root/zion-v2.9 && git pull && docker compose up -d --build"

# Singapore (Peer 2)
ssh -i ~/.ssh/zion_hetzner_key root@5.223.56.122 "cd /root/zion-v2.9 && git pull && docker compose up -d --build"
```

### Kontrola Genesis Sync
```bash
for server in "77.42.31.72" "5.78.138.238" "5.223.56.122"; do
  echo "=== $server ==="
  ssh -i ~/.ssh/zion_hetzner_key root@$server "docker exec \$(docker ps -qf 'name=blockchain') cat /app/data/blockchain.db | strings | grep -o '^[0-9a-f]\{64\}' | head -1"
done
```

---

## 📝 Poznámky

### ⚠️ Důležité!
1. **zionterranova.com** je nyní na **Helsinki** serveru
2. **Helsinki** je PRIMARY SEED + WEB - všechny uzly se k němu připojují
3. **NewEarth.cz** je pouze pro landing page (PHP hosting)
4. **DE server** byl zrušen (17.1.2026)
5. **Singapore** je nový PEER NODE 2 v Asii

### 🔑 SSH Klíče
```bash
~/.ssh/zion_hetzner_key    # Helsinki, USA, Singapore (všechny servery)
```

### 📧 E-mail Setup
- SMTP Server: mail.newearth.cz
- From: admin@newearth.cz, shop@newearth.cz

---

## 🌟 Quick Reference

```bash
# Helsinki (SEED + WEBSITE)
ssh -i ~/.ssh/zion_hetzner_key root@77.42.31.72

# USA (PEER 1)
ssh -i ~/.ssh/zion_hetzner_key root@5.78.138.238

# Singapore (PEER 2) 🆕
ssh -i ~/.ssh/zion_hetzner_key root@5.223.56.122

# NewEarth.cz (LANDING)
ssh -p 20002 ssh-685961@dw214.webglobe.com
```

---

*Peace & One Love ☮️❤️*  
*ZION TerraNova - Where Technology Meets Spirit*
