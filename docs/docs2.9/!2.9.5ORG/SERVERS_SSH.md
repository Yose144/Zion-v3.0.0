# 🌍 ZION TerraNova v2.9.5 - Server Infrastructure

> **Aktualizováno:** 31. ledna 2026  
> **Status:** P2P Network LIVE (Native Rust)

---

## 📋 Přehled Serverů

| Server | Role | IP/Host | P2P Port | RPC Port | Pool Port | SSH Key | Stav |
|--------|------|---------|----------|----------|-----------|---------|------|
| **Helsinki** | 🌟 SEED NODE | 77.42.31.72 | 8334 | 8444 | 3333 | `zion_hetzner_key` | ✅ Online |
| **USA** | 🔗 PEER NODE 1 | 5.78.145.234 | 8334 | 8444 | 3333 | `zion_hetzner_key` | ✅ Online |
| **Singapore** | 🔗 PEER NODE 2 | 5.223.56.124 | 8334 | 8444 | 3333 | `zion_hetzner_key` | ✅ Online |
| **NewEarth.cz** | 🌐 LANDING PAGE | dw214.webglobe.com | - | - | - | password | ✅ Online |

> Kanonické porty pro v2.9.5 jsou sjednocené napříč nody: P2P `8334`, RPC `8444`, Stratum `3333`, Pool API `8080`.

## 🆕 Native Rust Implementation (v2.9.5)

Servery běží **Docker-first**: kontejnery s nativními Rust binárkami.
- `zion-core` - Blockchain node
- `zion-pool` - Mining pool
- `redis` - share tracking/cache

### Doporučené compose soubory
- Full stack (web/api/nginx): [2.9.5/docker-compose.native-2.9.5.yml](../docker-compose.native-2.9.5.yml)
- Node stack (core+pool+redis): [2.9.5/docker-compose.node-2.9.5.yml](../docker-compose.node-2.9.5.yml)

---

## 🔐 SSH Připojení

### Helsinki (PRIMARY SEED NODE + zionterranova.com)
```bash
ssh -i ~/.ssh/zion_hetzner_key root@77.42.31.72
```

### Singapore Server (PEER NODE 2) 🆕
```bash
ssh -i ~/.ssh/zion_hetzner_key root@5.223.56.124
```

### USA Server (PEER NODE 1)
```bash
ssh -i ~/.ssh/zion_hetzner_key root@5.78.145.234
```

### NewEarth.cz (Landing Page Hosting)
```bash
ssh -p 20002 ssh-685961@dw214.webglobe.com
```
> ⚠️ Vyžaduje heslo (Webglobe hosting)

---

## 🇫🇮 HELSINKI SERVER (SEED NODE)

**IP:** `77.42.31.72`  
**Hostname:** `ubuntu-8gb-hel1-1`  
**Provider:** Hetzner (8GB RAM, 75GB SSD)

### 🔧 Docker služby
```bash
docker ps
docker logs -f zion-core
docker logs -f zion-pool
```

### 🌐 Služby & Porty
| Port | Služba | Popis |
|------|--------|-------|
| 8334 | P2P | Blockchain P2P (SEED) |
| 8444 | RPC | Blockchain JSON-RPC |
| 3333 | Stratum | Mining pool |
| 8080 | Pool API | Pool statistics |
| 80/443 | nginx | Web reverse proxy |

### 📁 Důležité Cesty
```bash
/root/zion-v2.9/2.9.5/      # repo + docker-compose
/var/lib/docker/volumes/    # docker volumes
```

### ⚙️ Rychlé Příkazy
```bash
# Test RPC
curl -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"get_block_template","params":{"wallet":"test"}}' \
  http://127.0.0.1:8444/jsonrpc

# Test pool connection
echo '{"id":1,"method":"login","params":{"login":"test"}}' | nc localhost 3333
```

---

## 🇸🇬 SINGAPORE SERVER (PEER NODE 2)

**IP:** `5.223.56.124`  
**Hostname:** `Node2`  
**Provider:** Hetzner Singapore (2GB RAM, 38GB SSD)

### ⚠️ Poznámka
Pokud by provider blokoval nějaký port, řeš to primárně přes firewall/security group.
Kanonický Stratum port je `3333`.

### 🔧 Docker služby
```bash
docker ps
docker logs -f zion-core
docker logs -f zion-pool
```

### 🌐 Služby & Porty
| Port | Služba | Popis |
|------|--------|-------|
| 8334 | P2P | Blockchain P2P |
| 8444 | RPC | Blockchain RPC |
| 3333 | Stratum | Mining pool |
| 8080 | Pool API | Statistics |

### 📁 Cesty
```bash
/root/zion-v2.9/2.9.5/
/var/lib/docker/volumes/
```

### PostgreSQL
```bash
# DB: zion_pool, User: zion, Pass: zion123
sudo -u postgres psql zion_pool
```

---

## 🇺🇸 USA SERVER (PEER NODE 1)

**IP:** `5.78.145.234`  
**Hostname:** `SeedNodes`  
**Provider:** Hetzner USA (4GB RAM, 38GB SSD)

### 🔧 Docker služby
```bash
docker ps
docker logs -f zion-core
docker logs -f zion-pool
```

### 🌐 Služby & Porty
| Port | Služba | Popis |
|------|--------|-------|
| 8334 | P2P | Blockchain P2P |
| 8444 | RPC | Blockchain RPC |
| 3333 | Stratum | Mining pool |
| 8080 | Pool API | Statistics |

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
├── 77.42.31.72:8334  (Helsinki - PRIMARY SEED + WEB)
├── 5.78.145.234:8334  (USA - PEER 1)
└── 5.223.56.124:8334  (Singapore - PEER 2)
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
ufw allow 8334/tcp      # P2P
```

### USA (Peer Node 1)
```bash
ufw allow 22/tcp        # SSH
ufw allow 3333/tcp      # Stratum
ufw allow 8080/tcp      # Pool API
ufw allow 8334/tcp      # P2P
```

### Singapore (Peer Node 2) 🆕
```bash
ufw allow 22/tcp        # SSH
ufw allow 3333/tcp      # Stratum
ufw allow 8080/tcp      # Pool API
ufw allow 8334/tcp      # P2P
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
curl http://5.78.145.234:8080/stats
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
ssh -i ~/.ssh/zion_hetzner_key root@5.78.145.234 "cd /root/zion-v2.9 && git pull && docker compose up -d --build"

# Singapore (Peer 2)
ssh -i ~/.ssh/zion_hetzner_key root@5.223.56.122 "cd /root/zion-v2.9 && git pull && docker compose up -d --build"
```

### Kontrola Genesis Sync
```bash
for server in "77.42.31.72" "5.78.145.234" "5.223.56.122"; do
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
ssh -i ~/.ssh/zion_hetzner_key root@5.78.145.234

# Singapore (PEER 2) 🆕
ssh -i ~/.ssh/zion_hetzner_key root@5.223.56.122

# NewEarth.cz (LANDING)
ssh -p 20002 ssh-685961@dw214.webglobe.com
```

---

*Peace & One Love ☮️❤️*  
*ZION TerraNova - Where Technology Meets Spirit*
