# 🚨 KRITICKÝ PROBLÉM: RPC Port Mismatch

**Datum**: 11.11.2025  
**Priorita**: VYSOKÁ 🔴  
**Impact**: Pool v2.9 nemůže komunikovat s ZION blockchain

---

## 🔍 Problém

### Aktuální Stav na Serveru (91.98.122.165):

**ZION Core Blockchain** ✅ BĚŽÍ:
```
PID: 2454303
Command: python -m src.core.new_zion_blockchain
RPC Port: 8545 (Ethereum-style) ← PROBLÉM!
Status: Healthy, běží 3+ hodiny
```

**Pool v2.9** ❌ NEKOMPATIBILNÍ:
```
Očekávaný port: 18081 (Monero-style)
Skutečný port: 8545 (ZION Core)
Result: Pool se nemůže připojit k blockchainu
```

---

## 📊 Analýza Portů

### Současná Konfigurace ZION Core:

**Soubor**: `src/core/seednodes.py`

```python
PORTS = {
    'rpc_mainnet': 8545,  # ← Ethereum-like RPC port
    'rpc_testnet': 8545,
    'pool_stratum': 3333,
}

RPC_CONFIG = {
    'host': '0.0.0.0',
    'port': 8545,  # ← KONFLIKUJE s Pool v2.9
}
```

### Pool v2.9 Konfigurace:

**Soubor**: `config/pool_production.json`

```json
{
  "blockchain": {
    "rpc_host": "127.0.0.1",
    "rpc_port": 18081,  # ← Monero-compatible port
  }
}
```

### Server Status (91.98.122.165):

```
✅ Port 8545: ZION Core RPC (Docker)
✅ Port 8080: ZION Node API (Docker)
✅ Port 3333: Pool v2.8 Stratum
❌ Port 18081: NEOBSAZENÝ (Pool v2.9 očekává zde daemon)
```

---

## 🎯 Příčina

**Warp 1 měl spustit:**
- ZION daemon na portu **18081** (Monero-compatible)
- Pro kompatibilitu s mining pooly (XMRig, stratum)

**Skutečnost:**
- ZION Core běží na portu **8545** (Ethereum-compatible)
- Používá `new_zion_blockchain.py` z Docker kontejneru
- Pool v2.9 hledá daemon na **18081** a nenajde ho

---

## 💡 Řešení

### Možnost A: Změnit Pool v2.9 → Port 8545 (RYCHLÉ)

**Výhody**:
- Žádná změna Core blockchainu
- Pool se připojí okamžitě
- Jednoduché

**Nevýhody**:
- Pool není Monero-compatible
- Nestandardní pro mining pools

**Implementace**:
```bash
# 1. Upravit pool config
sed -i 's/"rpc_port": 18081/"rpc_port": 8545/' config/pool_production.json
sed -i 's/"rpc_port": 18081/"rpc_port": 8545/' config/pool_local_test.json

# 2. Deploy pool v2.9
./deploy_pool_v2.9.sh
```

### Možnost B: Změnit ZION Core → Port 18081 (SPRÁVNÉ)

**Výhody**:
- Monero-compatible (standard pro mining)
- XMRig kompatibilita out-of-the-box
- Stratum protokol očekává 18081

**Nevýhody**:
- Vyžaduje restart ZION Core
- Změna centrální konfigurace
- Update Docker compose

**Implementace**:
```bash
# 1. Upravit seednodes.py
# 'rpc_mainnet': 18081  # Monero-compatible
# 'port': 18081

# 2. Rebuild Docker image
docker-compose build zion-node

# 3. Restart ZION Core
docker-compose restart zion-node

# 4. Deploy pool v2.9
./deploy_pool_v2.9.sh
```

### Možnost C: Dual Port Setup (KOMPLEXNÍ)

**Popis**: ZION Core naslouchá na OBOU portech
- **18081**: Monero-compatible RPC (pro mining pools)
- **8545**: Ethereum-compatible RPC (pro dApps/wallets)

**Výhody**:
- Maximální kompatibilita
- Podporuje oba ekosystémy

**Nevýhody**:
- Složitější konfigurace
- Více resources

---

## 🔧 Doporučené Kroky

### Fáze 1: Okamžité Řešení (5 minut)

1. **Upravit Pool v2.9 config na port 8545**
   ```bash
   cd /home/zion/Zion-2.9-main
   
   # Update production config
   cat > config/pool_production.json << 'EOF'
   {
     "pool": {
       "name": "ZION Universal Pool v2.9",
       "host": "0.0.0.0",
       "port": 3333,
       "wallet": "zion1qyfe883hey23jwfj498djawe98rfu0w0j23p7f",
       "fee_percent": 1.0,
       "min_payout": 0.1
     },
     "blockchain": {
       "rpc_host": "127.0.0.1",
       "rpc_port": 8545,
       "wallet_rpc_host": "127.0.0.1",
       "wallet_rpc_port": 8546
     },
     "network": {
       "max_connections": 10000,
       "keepalive_interval": 60,
       "difficulty_target": 120
     },
     "database": {
       "path": "data/pool.db"
     }
   }
   EOF
   
   # Update local test config
   cat > config/pool_local_test.json << 'EOF'
   {
     "pool": {
       "name": "ZION Test Pool v2.9",
       "host": "0.0.0.0",
       "port": 3335,
       "wallet": "zion1testpooladdress123456789",
       "fee_percent": 1.0,
       "min_payout": 0.01
     },
     "blockchain": {
       "rpc_host": "127.0.0.1",
       "rpc_port": 8545,
       "wallet_rpc_host": "127.0.0.1",
       "wallet_rpc_port": 8546
     },
     "network": {
       "max_connections": 100,
       "keepalive_interval": 60,
       "difficulty_target": 120
     },
     "database": {
       "path": "data/pool_test.db"
     },
     "strict_addresses": false
   }
   EOF
   ```

2. **Deploy Pool v2.9**
   ```bash
   ./deploy_pool_v2.9.sh
   ```

3. **Ověřit Připojení**
   ```bash
   ssh -i ~/.ssh/id_ed25519_hetzner root@91.98.122.165 \
     'tail -f /opt/zion/Zion-2.9/logs/pool_v2.9.log | grep -i "connected\|rpc\|blockchain"'
   ```

### Fáze 2: Dlouhodobé Řešení (30 minut)

1. **Upravit ZION Core na port 18081** (Monero-compatible)
2. **Rebuild Docker images**
3. **Update dokumentace**
4. **Standardizovat porty napříč projektem**

---

## 📋 Checklist

### Okamžitá Akce:
- [ ] Změnit `config/pool_production.json` → port 8545
- [ ] Změnit `config/pool_local_test.json` → port 8545
- [ ] Deploy pool v2.9 na server
- [ ] Test připojení k ZION Core RPC
- [ ] Ověřit block template fetching

### Dlouhodobá Akce:
- [ ] Upravit `src/core/seednodes.py` → 'rpc_mainnet': 18081
- [ ] Update RPC_CONFIG → 'port': 18081
- [ ] Rebuild Docker images
- [ ] Restart ZION Core s novým portem
- [ ] Update pool config zpět na 18081
- [ ] Dokumentovat standardní porty

---

## 🌟 Poznámky

**Proč 18081?**
- Standard pro Monero/CryptoNote RPC
- XMRig a mining pools to očekávají
- Monero-compatible protokol

**Proč 8545?**
- Standard pro Ethereum JSON-RPC
- Web3 kompatibilita
- dApp ekosystém

**ZION by měl používat 18081** pro mining, protože:
- Je založen na Monero protokolu
- Používá Stratum mining
- XMRig kompatibilita je klíčová

---

## 🔗 Související Soubory

- `src/core/seednodes.py` - Centrální konfigurace portů
- `src/core/new_zion_blockchain.py` - Blockchain core
- `src/core/zion_rpc_server.py` - RPC server implementace
- `src/pool/blockchain/zion_rpc.py` - Pool RPC client
- `config/pool_production.json` - Pool production config
- `docker/compose.yml` - Docker services config

---

**Status**: 🔴 CRITICAL - Vyžaduje okamžitou akci  
**Next Action**: Změnit pool config na port 8545 a deployovat
