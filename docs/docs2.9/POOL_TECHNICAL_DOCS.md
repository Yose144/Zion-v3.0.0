# 🏊 ZION Pool v2.9 - Technická dokumentace

## Obsah
1. [Přehled](#přehled)
2. [Architektura](#architektura)
3. [Moduly](#moduly)
4. [Konfigurace](#konfigurace)
5. [Stratum protokol](#stratum-protokol)
6. [Consciousness Game](#consciousness-game)
7. [Deployment](#deployment)
8. [Troubleshooting](#troubleshooting)

---

## Přehled

ZION Pool v2.9 je **modulární mining pool** s podporou více PoW algoritmů, consciousness-based odměnami a přímou integrací s ZION blockchain.

### Klíčové vlastnosti
- **Multi-protokol**: XMRig + Stratum protokoly
- **4 algoritmy**: Cosmic Harmony, RandomX, Yescrypt, Autolykos v2
- **Async architektura**: asyncio pro 10,000+ minerů
- **Consciousness Game**: Humanitární bonus snižuje obtížnost
- **PPLNS odměny**: Férový systém s konfigurovatelným fee
- **VarDiff**: Automatické přizpůsobení obtížnosti

---

## Architektura

```
┌─────────────────────────────────────────────────────────┐
│                    ZION Pool v2.9                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐          │
│  │   AUTH    │  │  MINING   │  │BLOCKCHAIN │          │
│  │           │  │           │  │           │          │
│  │ - Login   │  │ - Jobs    │  │ - RPC     │          │
│  │ - Adresy  │  │ - Shares  │  │ - Templates│         │
│  │ - Session │  │ - VarDiff │  │ - Rewards │          │
│  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘          │
│        │              │              │                 │
│        └──────────────┼──────────────┘                 │
│                       │                                │
│  ┌────────────────────┴────────────────────┐          │
│  │              NETWORK LAYER              │          │
│  │                                         │          │
│  │  StratumServer ←→ ProtocolHandler       │          │
│  │  (TCP :3333)     (XMRig/Stratum)        │          │
│  └─────────────────────────────────────────┘          │
│                       │                                │
│  ┌────────────────────┴────────────────────┐          │
│  │              DATABASE LAYER             │          │
│  │                                         │          │
│  │  SQLite: miners, shares, blocks, payouts│          │
│  └─────────────────────────────────────────┘          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Moduly

### 1. Auth (`src/pool/auth/`)

#### login_handler.py
```python
class LoginHandler:
    """Zpracování XMRig a Stratum login zpráv"""
    
    async def handle_login(self, params: dict) -> dict:
        # 1. Validace wallet adresy
        # 2. Detekce algoritmu z agent stringu
        # 3. Vytvoření session
        # 4. Return job pro minera
```

#### address_validator.py
```python
class ZionAddressValidator:
    """Validace ZION bech32 adres"""
    
    def validate(self, address: str) -> bool:
        # Podporované formáty:
        # - zion1... (mainnet)
        # - tzion1... (testnet)
        # - Starší formáty pro zpětnou kompatibilitu
```

#### session_manager.py
```python
class SessionManager:
    """Správa aktivních miner sessions"""
    
    # Ukládá:
    # - Session ID
    # - Wallet adresa
    # - Aktuální obtížnost
    # - Hashrate (rolling average)
    # - Poslední aktivita
```

### 2. Mining (`src/pool/mining/`)

#### algorithm_detector.py
```python
class AlgorithmDetector:
    """Detekce a načítání nativních knihoven"""
    
    algorithms = {
        "cosmic_harmony": {
            "lib": "libcosmic_harmony.so.2.9.0",
            "hashrate": 500_000,
            "fallback": True
        },
        "randomx": {
            "lib": "librandomx_zion.so.2.9.0",
            "hashrate": 6_600,
            "fallback": True
        },
        # ...
    }
```

#### job_manager.py
```python
class JobManager:
    """Vytváření a distribuce mining jobs"""
    
    def create_job(self, template: dict, difficulty: int) -> Job:
        return Job(
            id=generate_job_id(),
            blob=template['blocktemplate_blob'],
            target=difficulty_to_target(difficulty),
            height=template['height'],
            seed_hash=template.get('seed_hash')
        )
```

#### share_validator.py
```python
class ShareValidator:
    """Validace odeslaných shares"""
    
    def validate(self, job: Job, nonce: str, result: str) -> ShareResult:
        # 1. Zkontrolovat job_id existuje
        # 2. Aplikovat nonce na blob
        # 3. Spočítat hash
        # 4. Porovnat s target
        # 5. Zkontrolovat duplicity
```

#### difficulty_manager.py
```python
class DifficultyManager:
    """VarDiff - automatické přizpůsobení obtížnosti"""
    
    # Parametry:
    # - min_difficulty: 1000
    # - max_difficulty: 10_000_000
    # - target_time: 30 sekund (ideální čas mezi shares)
    # - retarget_time: 90 sekund (jak často přepočítat)
```

### 3. Blockchain (`src/pool/blockchain/`)

#### rpc_client.py
```python
class ZionRPCClient:
    """JSON-RPC klient pro ZION daemon"""
    
    async def get_block_template(self, wallet: str) -> dict:
        return await self.call("getblocktemplate", {
            "wallet_address": wallet
        })
    
    async def submit_block(self, block_hex: str) -> bool:
        return await self.call("submitblock", [block_hex])
```

#### template_manager.py
```python
class BlockTemplateManager:
    """Cache a refresh block templates"""
    
    # Každých 10 sekund:
    # 1. Fetch nový template z daemon
    # 2. Porovnat height
    # 3. Pokud nový blok, broadcast všem minerům
```

#### reward_calculator.py
```python
class RewardCalculator:
    """PPLNS výpočet odměn"""
    
    # Odečty:
    # - Pool fee: 1.0%
    # - Consciousness tithe: 1.618% (humanitární)
    # - Čistá odměna: 97.382%
```

#### consciousness_game.py
```python
class ConsciousnessGame:
    """Consciousness-based difficulty modifier"""
    
    def get_modifier(self, wallet: str) -> float:
        score = self.calculate_score(wallet)
        # score 0.5 → modifier 1.5 (těžší)
        # score 1.0 → modifier 1.0 (normální)
        # score 2.0 → modifier 0.5 (snazší)
        return 2.0 - score
```

### 4. Network (`src/pool/network/`)

#### stratum_server.py
```python
class StratumServer:
    """Async TCP server pro mining"""
    
    async def start(self):
        server = await asyncio.start_server(
            self.handle_connection,
            host=self.host,
            port=self.port
        )
```

#### protocol_handler.py
```python
class ProtocolHandler:
    """Routing zpráv podle metody"""
    
    methods = {
        "login": handle_login,
        "submit": handle_submit,
        "keepalive": handle_keepalive,
        "getjob": handle_getjob
    }
```

### 5. Database (`src/pool/database/`)

#### models.py
```sql
-- Tabulky
CREATE TABLE miners (
    address TEXT PRIMARY KEY,
    first_seen REAL,
    last_seen REAL,
    total_shares INTEGER,
    valid_shares INTEGER,
    hashrate REAL
);

CREATE TABLE shares (
    id INTEGER PRIMARY KEY,
    miner TEXT,
    job_id TEXT,
    nonce TEXT,
    result TEXT,
    difficulty INTEGER,
    valid BOOLEAN,
    timestamp REAL
);

CREATE TABLE blocks (
    height INTEGER PRIMARY KEY,
    hash TEXT,
    miner TEXT,
    reward REAL,
    status TEXT,
    timestamp REAL
);

CREATE TABLE payouts (
    id INTEGER PRIMARY KEY,
    miner TEXT,
    amount REAL,
    tx_hash TEXT,
    timestamp REAL
);
```

---

## Konfigurace

### pool_production.json
```json
{
  "pool": {
    "name": "ZION Universal Pool v2.9",
    "host": "0.0.0.0",
    "port": 3333,
    "wallet_address": "zion1qyfe883hey23jwfj498djawe98rfu0w0j23p7f",
    "fee_percent": 1.0,
    "consciousness_tithe": 1.618,
    "consciousness_enabled": true,
    "humanitarian_address": "zion1humanitarian0address0000000000000000test",
    "min_difficulty": 1000,
    "max_difficulty": 10000000,
    "target_share_time": 30.0,
    "retarget_time": 90.0,
    "keepalive_timeout": 300,
    "template_update_interval": 10,
    "database_path": "data/pool.db",
    "native_lib_path": "zion/mining",
    "pplns_window": 100000000,
    "strict_addresses": false,
    "min_payout": 0.1
  },
  "blockchain": {
    "host": "blockchain",
    "port": 18081,
    "user": null,
    "password": null
  },
  "network": {
    "host": "0.0.0.0",
    "port": 3333,
    "max_connections": 10000
  }
}
```

### Environment overrides
```bash
# Docker environment variables
BLOCKCHAIN_HOST=blockchain      # RPC host
BLOCKCHAIN_PORT=18081          # RPC port
POOL_PORT=3333                 # Stratum port
POOL_BASE_DIFFICULTY=1000      # Počáteční difficulty
SKIP_RPC_INIT=false            # Dev mode (skip RPC)
```

---

## Stratum protokol

### Login request
```json
{
  "id": 1,
  "jsonrpc": "2.0",
  "method": "login",
  "params": {
    "login": "zion1wallet_address",
    "pass": "x",
    "agent": "XMRig/6.20.0",
    "algo": ["cosmic_harmony", "rx/0"]
  }
}
```

### Login response
```json
{
  "id": 1,
  "jsonrpc": "2.0",
  "result": {
    "id": "session-uuid",
    "job": {
      "blob": "0707...",
      "job_id": "abc123",
      "target": "b4e40000",
      "height": 12345,
      "seed_hash": "...",
      "algo": "cosmic"
    },
    "status": "OK"
  }
}
```

### Submit share
```json
{
  "id": 2,
  "jsonrpc": "2.0",
  "method": "submit",
  "params": {
    "id": "session-uuid",
    "job_id": "abc123",
    "nonce": "12345678",
    "result": "hash_result_hex"
  }
}
```

### Submit response
```json
{
  "id": 2,
  "jsonrpc": "2.0",
  "result": {
    "status": "OK"
  }
}
```

---

## Consciousness Game

### Princip
```
"Mining should reward consciousness, not just computation"

Mineři s vyšším "consciousness score" dostávají snazší obtížnost.
Score se vypočítává z:
- Humanitárních darů
- Délky účasti v komunitě
- Stability hashrate
```

### Score výpočet
```python
def calculate_score(wallet: str) -> float:
    base = 1.0
    
    # Humanitární bonus (0.0 - 0.5)
    donations = get_humanitarian_donations(wallet)
    humanitarian_bonus = min(donations / 1000, 0.5)
    
    # Community bonus (0.0 - 0.2)
    days_active = get_days_active(wallet)
    community_bonus = min(days_active / 365, 0.2)
    
    # Stability bonus (0.0 - 0.1)
    hashrate_variance = get_hashrate_variance(wallet)
    stability_bonus = 0.1 if hashrate_variance < 0.1 else 0.0
    
    return base + humanitarian_bonus + community_bonus + stability_bonus
```

### Difficulty modifier
```python
def get_difficulty_modifier(score: float) -> float:
    # score 0.5 → modifier 1.5 (harder)
    # score 1.0 → modifier 1.0 (normal)
    # score 1.5 → modifier 0.75 (easier)
    # score 2.0 → modifier 0.5 (easiest)
    return max(0.5, min(1.5, 2.0 - score))
```

---

## Deployment

### Local development
```bash
# 1. Spustit blockchain (mock nebo real)
python -m src.core.new_zion_blockchain

# 2. Spustit pool
PYTHONPATH=. python -m src.pool.zion_pool_v2_9

# 3. Testovat
python test_share_submission.py --host 127.0.0.1 --port 3333
```

### Docker deployment
```bash
# Build a start
docker compose build pool
docker compose up -d pool

# Logs
docker logs -f zion-pool-v2.9

# Health check
curl http://localhost:3333/health
```

### Production checklist
- [ ] SSL/TLS terminace (nginx proxy)
- [ ] Firewall rules (port 3333)
- [ ] Log rotation
- [ ] Monitoring (Prometheus/Grafana)
- [ ] Backup databáze
- [ ] Rate limiting

---

## Troubleshooting

### Pool nestaruje
```bash
# Check logs
docker logs zion-pool-v2.9 | tail -100

# Check blockchain connection
curl http://blockchain:18081/json_rpc \
  -d '{"jsonrpc":"2.0","method":"getinfo"}'

# Check port
netstat -tlnp | grep 3333
```

### Miner se nepřipojí
```bash
# Test connection
nc -zv pool.zionterranova.com 3333

# Manual login test
echo '{"id":1,"method":"login","params":{"login":"zion1test"}}' | nc localhost 3333
```

### Share rejected
```
Příčiny:
1. Stale job (blok už byl vytěžen)
2. Duplicate share
3. Hash nesedí s target
4. Invalid nonce format

Řešení:
- Zkontrolovat pool logs
- Zkontrolovat miner logs
- Snížit difficulty pro testování
```

### High latency
```bash
# Check network
ping pool.zionterranova.com

# Check pool load
curl http://localhost:9090/metrics | grep pool_connections

# Check database
sqlite3 data/pool.db "PRAGMA integrity_check"
```

---

## API Reference

### Pool stats endpoint
```
GET http://localhost:8080/stats

Response:
{
  "pool": {
    "hashrate": 1234567,
    "miners": 42,
    "workers": 128,
    "blocks_found": 15,
    "last_block": 1234567890
  }
}
```

### Miner stats endpoint
```
GET http://localhost:8080/miner/{address}

Response:
{
  "address": "zion1...",
  "hashrate": 50000,
  "shares": {
    "valid": 1000,
    "invalid": 5
  },
  "balance": 123.456,
  "paid": 500.0
}
```

---

**ZION Pool v2.9** - Built with ❤️ for consciousness mining
