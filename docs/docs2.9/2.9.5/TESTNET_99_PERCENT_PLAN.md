# 🚀 ZION TestNet 2.9.5 - 99% Completion Plan

> **Datum:** 3. února 2026  
> **Cíl:** Dokončit TestNet pro zahájení MainNet roadmapy

---

## 📊 Aktuální Stav (aktualizováno 4.2.2026)

| Komponenta | Status | Poznámka |
|------------|--------|----------|
| Helsinki Core | ✅ healthy | height=60+, mining active |
| Helsinki Pool | ✅ healthy | port 3333 + 8181 |
| USA Core | ⚠️ missing | container `zion-core-2.9.5` neexistuje |
| USA Pool | ⚠️ unhealthy | běží ale unhealthy |
| Singapore Core | ✅ healthy | běží |
| Singapore Pool | ⚠️ unhealthy | běží ale unhealthy |
| Payout System | ✅ funguje | 58520 ZION vyplaceno! |
| Mining | ✅ funguje | 18202 shares accepted, 0 rejected |
| Blocks Found | ✅ | mnoho bloků (height 60+) |

---

## 🔨 KROK 1: Build Docker Images (na Ryzen)

```bash
# Klonuj repo (pokud nemáš)
git clone https://github.com/Yose144/Zion-2.9.git
cd Zion-2.9

# Nebo pull latest
cd Zion-2.9 && git pull origin main

# Build zion-core
cd 2.9.5
docker build -f zion-native/Dockerfile.core -t yose144/zion-core:2.9.5-dev .

# Build zion-pool  
docker build -f zion-native/Dockerfile.pool.prod -t yose144/zion-pool:2.9.5-dev .

# Push to Docker Hub
docker login
docker push yose144/zion-core:2.9.5-dev
docker push yose144/zion-pool:2.9.5-dev
```

---

## 🚀 KROK 2: Deploy na Servery

### SSH přístupy:
```bash
# Helsinki (hlavní pool)
ssh -i ~/.ssh/zion_hetzner_key root@77.42.31.72

# USA
ssh -i ~/.ssh/zion_hetzner_key root@5.78.145.234

# Singapore
ssh -i ~/.ssh/zion_hetzner_key root@5.223.56.124
```

### Deploy script (spustit na KAŽDÉM serveru):
```bash
cd /root/zion-v2.9

# Stáhni nové images
docker pull yose144/zion-core:2.9.5-dev
docker pull yose144/zion-pool:2.9.5-dev

# Update docker-compose.yml - změň image tagy na :2.9.5-dev
# Nebo použij:
docker-compose down
docker-compose up -d

# Ověř
docker ps
curl http://localhost:8080/health
```

---

## 🧪 KROK 3: Test Payout Systému (pouze Helsinki)

### 3.1 Aktivuj DEV_MODE
```bash
ssh -i ~/.ssh/zion_hetzner_key root@77.42.31.72

# Edituj docker-compose
nano /root/zion-v2.9/docker-compose.yml

# Přidej do core service environment:
#   - ZION_DEV_MODE=true
```

### 3.2 Kredit Pool Wallet
```bash
# Po restartu s DEV_MODE=true
curl -X POST http://localhost:8080/json-rpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "dev.credit_balance",
    "params": {
      "address": "zion1qpool_testnet_wallet_000000000000000000",
      "amount": 500000
    },
    "id": 1
  }'
```

### 3.3 Ověř PayoutManager
```bash
# Zkontroluj pool logy
docker logs zion-pool --tail 100 | grep -i payout

# Zkontroluj pending payouts
curl http://localhost:8181/api/v1/payouts/pending
```

---

## ⛏️ KROK 4: Mining Test

### 4.1 Spusť Native Miner
```bash
# Na tvém Ryzen PC
cd Zion-2.9
python zion_native_miner_v2_9.py \
  --pool 77.42.31.72:3333 \
  --wallet ZION_TEST_WALLET_RYZEN \
  --worker ryzen-test \
  --threads 8
```

### 4.2 Ověř Block Discovery
```bash
# Na Helsinki
curl http://localhost:8080/health | jq .height
curl http://localhost:8181/metrics | grep blocks_found
```

---

## 📝 KROK 5: Dokumentace

### Soubory k aktualizaci:
- [ ] `2.9.5/README.md` - aktuální stav
- [ ] `2.9.5/docs/TESTNET_STATUS.md` - detailní status
- [ ] `DEPLOYMENT_PLAN_v2.9_COMPLETE.md` - finální verze

### Release Notes Template:
```markdown
## ZION TestNet v2.9.5 Release Notes

### New Features
- Unified RPC port (8080)
- Payout system with consciousness multipliers
- Dev endpoints for testing (credit_balance)
- Multi-server P2P network

### Bug Fixes
- Fixed CLI --rpc-port being ignored (use ZION_RPC_PORT env)
- Fixed volume permissions in Docker
- Fixed P2P rate limiting issues

### Known Issues
- None critical

### Servers
- Helsinki: 77.42.31.72 (primary pool)
- USA: 5.78.145.234 (node)
- Singapore: 5.223.56.124 (node)
```

---

## ✅ KROK 6: 99% Checklist

| # | Task | Status |
|---|------|--------|
| 1 | Docker images built & pushed | ✅ yose144/zion-*:2.9.5-dev |
| 2 | Helsinki deployed & healthy | ✅ core + pool healthy |
| 3 | USA deployed & healthy | ⚠️ pool unhealthy, core missing |
| 4 | Singapore deployed & healthy | ⚠️ pool unhealthy, core ok |
| 5 | All nodes synced (same height) | ⚠️ Helsinki ahead (73), others behind |
| 6 | Pool accepting shares | ✅ **100% accept rate** (92 valid, 0 invalid) |
| 7 | Block found via mining | ✅ mnoho bloků nalezeno |
| 8 | Payout executed successfully | ✅ 58520.526 ZION vyplaceno |
| 9 | Documentation updated | ⬜ needs update |
| 10 | Git tagged as v2.9.5-rc1 | ⬜ ready to tag |

### ✅ Validace 5.2.2026:
- **Rust Miner**: 100% share acceptance ✅
- **NCL AI Bonus**: Working ✅
- **Pool Stats**: 92 valid shares, 0 invalid
- **Hashrate**: ~240 kH/s (2 CPU threads)

### Zbývá na 99%:
1. **USA/Singapore sync** - buď reimport chain nebo fresh genesis
2. **Pool healthchecks** - opravit unhealthy status na USA/Singapore
3. **Dokumentace** - finální README update
4. **Git tag** - `v2.9.5-rc1`

---

## 🎯 Po Dokončení

Když bude vše ✅:

```bash
# Tag release
git tag -a v2.9.5-rc1 -m "TestNet 2.9.5 Release Candidate 1"
git push origin v2.9.5-rc1

# Pak můžeme začít MainNet roadmapu!
```

---

## 📞 Quick Commands Reference

```bash
# Check all servers
for ip in 77.42.31.72 5.78.145.234 5.223.56.124; do
  echo "=== $ip ===" 
  ssh -i ~/.ssh/zion_hetzner_key root@$ip "curl -s localhost:8080/health | jq -c"
done

# Pool stats
curl http://77.42.31.72:8181/metrics | grep -E "shares|blocks"

# Test stratum
echo '{"id":1,"method":"login","params":{"login":"TEST"}}' | nc 77.42.31.72 3333
```

---

**🌟 "Technology serving consciousness evolution" 🌟**
