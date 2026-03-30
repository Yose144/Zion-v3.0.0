# ZION v2.5 Testnet - Core Fixes

## 🛠️ Opravy jádra systému (2025-09-23)

### Problém 1: Docker kontejnery označované jako "unhealthy"
**Příčina**: Healthcheck selhal na RPC endpointech
**Oprava**: 
- Upraveny healthchecky v `docker/compose.pool-seeds.yml`
- Delší `start_period` (180s) pro pomalejší start daemonu
- Více RPC endpointů pro testování včetně JSON-RPC

### Problém 2: RPC shim chyby "Core is busy"
**Příčina**: Nedostatečná retry logika a fallback mechanismy
**Oprava**: 
- Přidán retry mechanismus s přepínáním mezi seed1 a seed2
- Zkráceny timeout hodnoty pro rychlejší reakce
- Lepší error handling v `adapters/zion-rpc-shim/server.js`

### Problém 3: Prázdný submodule zion-cryptonote
**Příčina**: Submodule nebyl inicializován
**Oprava (historické)**: 
- Dockerfile upravený pro lepší handling prázdných submodulů
- Automatické klonování z GitHub repo `Yose144/zion-cryptonote` branch `zion-mainnet`

Poznámka (2025-09-25): zion-cryptonote je nyní vendored přímo v repozitáři (už není submodule). Pokyny k inicializaci submodulů jsou tedy zastaralé.

## 🚀 Nasazení oprav

### 1. Lokálně
```bash
# Commituj opravy
git add .
git commit -m "fix: Core stability improvements - healthcheck, RPC retry, submodule handling"
git push origin main
```

### 2. Na produkčním serveru (91.98.122.165)
```powershell
# Redeploy s opravami
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\ssh-redeploy-pool.ps1 -ServerIp 91.98.122.165 -User root
```

### 3. Monitoring
Po nasazení sledujte:
```bash
# Stav kontejnerů
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Logy seed nodů
docker logs zion-seed1 --tail=50
docker logs zion-seed2 --tail=50

# RPC shim metriky
curl http://localhost:18089/metrics.json
```

## 🔍 Testování

### Test 1: Healthcheck
```bash
# Ověř, že seed nody jsou healthy
docker inspect zion-seed1 | jq '.[0].State.Health.Status'
docker inspect zion-seed2 | jq '.[0].State.Health.Status'
```

### Test 2: RPC funkčnost
```bash
# Test přes shim
curl -X POST http://localhost:18089/ -d '{"jsonrpc":"2.0","id":"1","method":"get_info","params":{}}' -H "Content-Type: application/json"

# Test getblocktemplate
curl -X POST http://localhost:18089/ -d '{"jsonrpc":"2.0","id":"1","method":"getblocktemplate","params":{"wallet_address":"Z1YourAddress","reserve_size":8}}' -H "Content-Type: application/json"
```

### Test 3: Pool komunikace
```bash
# Test pool portu
telnet localhost 3333
```

## ⚡ Očekávané výsledky
- ✅ Všechny kontejnery označeny jako "healthy" do 3 minut
- ✅ RPC shim odpovídá na volání bez "Core is busy" chyb
- ✅ Pool může získat block templates
- ✅ Mining může začít bez chyb

## 🐛 Další známé problémy k řešení
1. **Genesis block** - možná potřeba reinicializace
2. **Pool payments** - zatím zakázané
3. **P2P síť** - potřeba více seed nodů
4. **Wallet integration** - frontend API endpointy

---
**Vytvoření**: 2025-09-23  
**Status**: Připraveno k nasazení  
**Priorita**: Kritická