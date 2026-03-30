# ZION v2.9.0 - Session Report
**Datum:** 20. listopadu 2025  
**Téma:** Produkční redeploy poolu + blockchainu (152-hex blobs)

---

## 🎯 Cíle session

1. Nahrát poslední úpravy blockchain/pool kódu na produkční server (91.98.122.165)
2. Znovu postavit Docker image pro `zion-blockchain` a `zion-pool-v2.9`
3. Ověřit, že pool dostává 152-hex `blockhashing_blob` z RPC (`getblocktemplate`)
4. Zajistit, že kontejnery běží na společné síti s aliasem `blockchain`
5. Diagnostikovat zbývající chyby (hash mismatch, cleanup loop)

---

## 📦 Provedené úkony

### 1. Synchronizace kódu na server
- Využil jsem existující SSH klíč `~/.ssh/zion_deployment_key`
- Zkopíroval nové soubory (zejména `src/core/new_zion_blockchain.py`, `src/pool/blockchain/template_manager.py`, `src/pool/mining/job_manager.py`) na `/root/Zion-2.9-main`

### 2. Rebuild blockchain image (`zion-29-core-v2.9`)
```bash
cd /root/Zion-2.9-main/docker/core-v2.9
DOCKER_BUILDKIT=1 docker build -t zion-29-blockchain:latest .
```
- Po buildu byl starý kontejner odstraněn
- Nový kontejner spuštěn s aliasem `blockchain` na síti `zion-29_zion-network`:
```bash
docker run -d --name zion-blockchain \
  --restart unless-stopped \
  --network zion-29_zion-network \
  --network-alias blockchain \
  -p 8545:8545 -p 18081:18081 \
  -v /root/Zion-2.9-main/config:/app/config \
  zion-29-blockchain:latest
```

### 3. Rebuild pool image (`zion-29-main-pool`)
```bash
cd /root/Zion-2.9-main/docker/pool-v2.9
DOCKER_BUILDKIT=1 docker build -t zion-29-main-pool:latest .
```
- Po buildu byl kontejner spuštěn s aktualizovanými proměnnými:
```bash
docker run -d --name zion-pool-v2.9 \
  --restart unless-stopped \
  --env-file config/phase2_config.env \
  -e PYTHONUNBUFFERED=1 \
  -e LOG_LEVEL=DEBUG \
  -e BLOCKCHAIN_HOST=zion-blockchain \
  -e BLOCKCHAIN_PORT=18081 \
  -p 3333:3333 -p 8080:8080 \
  -v /root/Zion-2.9-main/config/pool_production.json:/app/config/pool_production.json:ro \
  -v /root/Zion-2.9-main/logs/pool:/app/logs \
  -v /root/Zion-2.9-main/data/pool:/app/data \
  --network zion-29_zion-network \
  zion-29-main-pool:latest
```

### 4. Validace RPC + logů
- `docker logs zion-pool-v2.9` nyní ukazuje `blob_len=152` při loginu XMRig
- Dřívější chyba `Cannot connect to host blockchain:18081` zmizela díky aliasu
- Přímá kontrola RPC:
```bash
curl -s -X POST http://localhost:18081 \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"getblocktemplate","params":{"wallet_address":"zion1qyfe883hey23jwfj498djawe98rfu0w0j23p7f"}}'
```
  - `blockhashing_blob`: `0d0083b31e69...000000000000` (152 hex znaků)
  - `next_seed_hash` je přítomen -> pool dostává obě seed hodnoty

### 5. Otevřené problémy (nutné další úpravy)
- **Hash mismatch při share:** Pool odmítá share minerů (chybné výpočty hashů)
- **JobManager cleanup bug:** Periodicky `Error in cleanup loop: 'bool' object is not callable` ve `src.pool.mining.job_manager`
- **Blockchain height** zůstává na 1 (žádný share nedosáhne cíle kvůli nesouladu)

---

## 📊 Stav serveru po redeployi (20. 11. 2025, 06:15 UTC)

| Kontejner | Image | Porty | Stav |
|-----------|-------|-------|------|
| zion-blockchain | zion-29-blockchain:latest | 8545, 18081 | ✅ Running (alias `blockchain`)
| zion-pool-v2.9 | zion-29-main-pool:latest | 3333, 8080 | ✅ Running (blob_len=152)
| zion-redis | redis:7-alpine | 6379 | ✅ Running
| zion-prometheus | prom/prometheus | 9090 | ✅ Running
| zion-grafana | grafana/grafana | 3000 | ✅ Running

---

## ✅ Shrnutí výsledků

| Úkol | Stav | Poznámka |
|------|------|---------|
| Upload a rebuild blockchain | ✅ | Image `zion-29-blockchain:latest` běží, RPC OK |
| Upload a rebuild pool | ✅ | Stratum server běží, 152-hex blob potvrzen |
| Síťové propojení pool ↔ blockchain | ✅ | Alias `blockchain` funguje |
| Share validace | ⚠️ | `Hash mismatch` – vyžaduje další debugging |
| JobManager cleanup | ⚠️ | Vyvolává `'bool' object is not callable` |

---

## 🔭 Doporučené další kroky
1. **JobManager cleanup fix** – projít `src/pool/mining/job_manager.py` a zjistit, která boolean proměnná se chová jako callable
2. **Share validator audit** – ověřit, že miner blob/hash se porovnává se správnou referenční funkcí (RandomX vs fallback)
3. **End-to-end test** – po opravě share validace znovu otestovat XMRig (očekává se zvýšení výšky blockchainu)
4. **Monitoring** – přidat alerty na `hash mismatch` a cleanup exceptions, aby se včas zachytily další chyby

---

## 📁 Git status

Aktuální stav lokálního repozitáře (`git status -sb`):
```
## main...origin/main
 M coverage.xml
 M docker-compose.yml
 M scripts/deploy_zion_production.sh
 M scripts/start_macos_local.sh
 M scripts/start_zion_local.sh
 M src/core/new_zion_blockchain.py
 M src/core/simple_blockchain.py
 M src/core/standalone_rpc_server.py
 M src/core/zion_node.py
 M src/core/zion_rpc_server.py
 M src/pool/blockchain/template_manager.py
 M src/pool/mining/job_manager.py
 M src/pool/network/protocol_handler.py
 M src/pool/network/stratum_server.py
?? scripts/deploy_docker_fix.sh
?? test_supply_fix.py
```

> Pozn.: Před pushnutím je potřeba projít výše uvedené změny, přidat nový report `SESSION_REPORT_2025-11-20.md`, doplnit unit testy (pokud relevantní) a spustit základní validace (pytest / mypy dle potřeby).

---

## 🧭 Závěr
Redeploy byl úspěšný – pool nyní dostává správné 152-hex blockhashing bloby, oba kontejnery běží a RPC je dosažitelný. Produkční stack je připraven na další ladění share validace a cleanup smyčky. Po dokončení těchto oprav lze očekávat, že blockchain začne přijímat bloky a mining provoz bude stabilní.
