# ⛏️📖 ZION MINING VALIDATION GUIDE - PODROBNÝ NÁVOD ⛏️📖

**Kompletní návod na spuštění ZION mining pro validaci 60 bloků**  
*Krok za krokem postupy pro úspěšné ZION mining*

---

## 🎯 **CÍL: Validace 60 Bloků ZION**

Tento návod tě provede celým procesem spuštění ZION mining systému pro validaci 60 bloků na tvém PC.

---

## 📋 **KROK 1: Příprava Systému**

### 🔧 **Kontrola Docker Stavu**

```bash
# Zkontroluj běžící kontejnery
docker ps

# Zkontroluj dostupné ZION images
docker images | grep zion

# Vyčisti staré kontejnery (pokud potřeba)
docker stop $(docker ps -aq) 2>/dev/null || true
docker rm $(docker ps -aq) 2>/dev/null || true
```

### 🌐 **Kontrola Portů**

```bash
# Zkontroluj, které porty jsou obsazené
netstat -tulpn | grep -E "3333|8888|11898|11899"

# Pokud jsou porty obsazené, zastaň procesy:
sudo kill -9 $(lsof -t -i:3333) 2>/dev/null || true
sudo kill -9 $(lsof -t -i:8888) 2>/dev/null || true
```

---

## 📋 **KROK 2: Spuštění ZION Core Node**

### 🚀 **Spuštění Unified Node**

```bash
# Spuštění ZION unified node s pool podporou
docker run -d --name zion-mining-node \
  -p 3333:3333 \
  -p 8888:8888 \
  -p 11898:11898 \
  -p 11899:11899 \
  zion:unified

# Čekej 10 sekund na inicializaci
sleep 10

# Zkontroluj logy
docker logs zion-mining-node --tail 20
```

### ✅ **Ověření Node Zdraví**

```bash
# Test health endpointu
curl -s http://localhost:8888/health | head -5

# Test mining pool endpointu
curl -s http://localhost:8888/api/mining/status

# Zkontroluj, že port 3333 naslouchá
netstat -tulpn | grep 3333
```

---

## 📋 **KROK 3: Konfigurace Mining**

### 📝 **Vytvoření Mining Konfigurace**

Vytvoř soubor `/media/maitreya/ZION1/mining/zion-validation-config.json`:

```json
{
    "api": {
        "id": null,
        "worker-id": "zion-validator-60blocks"
    },
    "http": {
        "enabled": true,
        "host": "127.0.0.1",
        "port": 8080,
        "access-token": null,
        "restricted": true
    },
    "autosave": true,
    "background": false,
    "colors": true,
    "title": true,
    "randomx": {
        "init": -1,
        "init-avx2": -1,
        "mode": "auto",
        "1gb-pages": false,
        "rdmsr": true,
        "wrmsr": true,
        "cache_qos": false,
        "numa": true,
        "scratchpad_prefetch_mode": 1
    },
    "cpu": {
        "enabled": true,
        "huge-pages": true,
        "huge-pages-jit": false,
        "hw-aes": null,
        "priority": null,
        "memory-pool": false,
        "yield": true,
        "max-threads-hint": 100,
        "asm": true,
        "argon2-impl": null,
        "cn/0": false,
        "cn-lite/0": false
    },
    "pools": [
        {
            "algo": "rx/0",
            "coin": "ZION",
            "url": "localhost:3333",
            "user": "Z3222ywic7fGUZHv9EfFwEKf1VJRrEqPbLrHgRiBb43LWaS1Cz2gVwgdF2kvUPsGb9jSvUUf31oNCSZgNEtUiGDT4sBLtXmGzc",
            "pass": "x",
            "rig-id": "zion-validator-pc",
            "nicehash": false,
            "keepalive": true,
            "enabled": true,
            "tls": false,
            "daemon": false
        }
    ],
    "print-time": 30,
    "health-print-time": 60,
    "retries": 5,
    "retry-pause": 5,
    "verbose": 2,
    "watch": true
}
```

---

## 📋 **KROK 4: Spuštění Miningu**

### 🐳 **Metoda A: Docker XMRig**

```bash
# Spuštění pomocí Docker
docker run -d --name zion-validator-60blocks \
  --network host \
  -v /media/maitreya/ZION1/mining/zion-validation-config.json:/config.json \
  zion:xmrig \
  xmrig --config=/config.json

# Čekej 5 sekund
sleep 5

# Zkontroluj logy
docker logs zion-validator-60blocks --tail 20
```

### 💻 **Metoda B: Přímé Parametry**

```bash
# Spuštění s přímými parametry
docker run -d --name zion-direct-miner \
  --network host \
  zion:xmrig \
  xmrig \
  -o localhost:3333 \
  -u Z3222ywic7fGUZHv9EfFwEKf1VJRrEqPbLrHgRiBb43LWaS1Cz2gVwgdF2kvUPsGb9jSvUUf31oNCSZgNEtUiGDT4sBLtXmGzc \
  -p x \
  -a rx/0 \
  --threads=4 \
  --log-level=2 \
  --http-enabled \
  --http-port=8080 \
  --rig-id=zion-validator-60blocks
```

### 🖥️ **Metoda C: Lokální Binárka**

```bash
# Nastavení oprávnění
sudo chmod +x /media/maitreya/ZION1/mining/xmrig-6.21.3/xmrig

# Kontrola souborového systému
mount | grep /media/maitreya/ZION1

# Pokud je noexec, přesuň do /tmp
cp /media/maitreya/ZION1/mining/xmrig-6.21.3/xmrig /tmp/
chmod +x /tmp/xmrig

# Spuštění
cd /tmp && ./xmrig --config=/media/maitreya/ZION1/mining/zion-validation-config.json
```

---

## 📋 **KROK 5: Monitoring a Validace**

### 📊 **Kontrola Mining Stavu**

```bash
# Mining statistiky
curl -s http://localhost:8080/1/summary | jq '.'

# Node mining status
curl -s http://localhost:8888/api/mining/stats

# Počet přijatých shares
docker logs zion-validator-60blocks | grep -i "accepted"

# Aktuální hashrate
docker logs zion-validator-60blocks --tail 5 | grep -i "speed"
```

### 🔍 **Sledování Pokroku**

```bash
# Průběžné sledování logů
docker logs -f zion-validator-60blocks

# Počítání validovaných bloků
docker logs zion-mining-node | grep -c "Block accepted"

# Node zdraví
watch -n 30 'curl -s http://localhost:8888/health | jq ".modules.mining"'
```

---

## 📋 **KROK 6: Řešení Problémů**

### ❌ **Login Error Code: 1**

```bash
# Zkontroluj node logy
docker logs zion-mining-node --tail 10

# Restartuj node
docker restart zion-mining-node
sleep 10

# Restartuj miner
docker restart zion-validator-60blocks
```

### ❌ **Connection Refused**

```bash
# Zkontroluj porty
netstat -tulpn | grep 3333

# Zkontroluj firewall
sudo ufw status

# Zkontroluj Docker sítě
docker network ls
docker network inspect bridge
```

### ❌ **Permission Denied**

```bash
# Zkontroluj mount options
mount | grep noexec

# Použij /tmp pro spuštění
cp /media/maitreya/ZION1/mining/xmrig-6.21.3/xmrig /tmp/
cd /tmp && ./xmrig [parametry]
```

---

## 📋 **KROK 7: Úspěšné Mining - Co Očekávat**

### ✅ **Pozitivní Znaky**

```
[2025-09-26 19:45:00.123] net      new job from localhost:3333 diff 1000 algo rx/0 height 1
[2025-09-26 19:45:05.456] cpu      speed 10s/60s/15m 1234.5 1198.7 1205.3 H/s max 1250.0 H/s
[2025-09-26 19:45:10.789] net      submit to localhost:3333
[2025-09-26 19:45:10.812] net      accepted (1/0) diff 1000 (100.0%) 
```

### 📈 **Sledování Pokroku**

- **Hashrate**: Měl by být stabilní 800-1500 H/s na Ryzen 5 3600
- **Accepted Shares**: Měly by se objevovat každých 30-60 sekund
- **Height**: Číslo bloku by se mělo postupně zvyšovat
- **Diff**: Obtížnost by měla být okolo 1000

---

## 📋 **KROK 8: Validace 60 Bloků**

### 🎯 **Sledování Pokroku**

```bash
# Skript pro sledování validovaných bloků
cat > /tmp/count_blocks.sh << 'EOF'
#!/bin/bash
echo "=== ZION MINING PROGRESS TRACKER ==="
echo "Timestamp: $(date)"
echo "Target: 60 blocks"
echo ""

# Počet accepted shares
ACCEPTED=$(docker logs zion-validator-60blocks 2>/dev/null | grep -c "accepted" || echo 0)
echo "Accepted Shares: $ACCEPTED"

# Aktuální výška bloku
HEIGHT=$(curl -s http://localhost:8888/api/blockchain/height 2>/dev/null | jq -r '.height // "N/A"')
echo "Current Block Height: $HEIGHT"

# Hashrate
HASHRATE=$(docker logs zion-validator-60blocks --tail 20 2>/dev/null | grep "speed" | tail -1 | grep -o "[0-9]\+\.[0-9]\+ H/s" || echo "N/A")
echo "Current Hashrate: $HASHRATE"

echo ""
echo "Progress: $ACCEPTED/60 blocks validated"
PERCENT=$(echo "scale=1; $ACCEPTED/60*100" | bc -l 2>/dev/null || echo "0")
echo "Completion: ${PERCENT}%"
EOF

chmod +x /tmp/count_blocks.sh

# Spusť sledování každých 60 sekund
watch -n 60 /tmp/count_blocks.sh
```

### 🏁 **Dokončení**

Po dosažení 60 validovaných bloků:

```bash
# Zastaň mining
docker stop zion-validator-60blocks

# Generuj report
echo "=== ZION 60 BLOCKS VALIDATION COMPLETE ===" > /tmp/validation_report.txt
echo "Completed at: $(date)" >> /tmp/validation_report.txt
echo "Total Accepted: $(docker logs zion-validator-60blocks | grep -c accepted)" >> /tmp/validation_report.txt
echo "Final Height: $(curl -s http://localhost:8888/api/blockchain/height | jq -r '.height')" >> /tmp/validation_report.txt

cat /tmp/validation_report.txt
```

---

## 🎉 **ZÁVĚR**

Tento návod ti pomůže úspěšně spustit ZION mining a validovat 60 bloků. Klíčové je:

1. **Správně spustit ZION node** na portu 3333
2. **Nakonfigurovat miner** s validní Z3 adresou
3. **Sledovat progress** pomocí logů a API
4. **Řešit problémy** podle sekce troubleshootingu

**JAI ZION MINING! ⛏️✨**

*Nechť jsou všechny tvé hashe požehnány a všechny bloky validovány!* 🙏

---

**Pro podporu kontaktuj:** ZION Divine Mining Council 📞  
**Mining adresa:** `Z3222ywic7fGUZHv9EfFwEKf1VJRrEqPbLrHgRiBb43LWaS1Cz2gVwgdF2kvUPsGb9jSvUUf31oNCSZgNEtUiGDT4sBLtXmGzc`