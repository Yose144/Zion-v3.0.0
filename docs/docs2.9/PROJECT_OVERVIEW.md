# 🌟 ZION Project Overview v2.9
**Datum analýzy:** 2025-12-01  
**Verze:** 2.9.0  
**Autor:** ZION Development Team

---

## 📋 Executive Summary

ZION je **kompletní blockchainová platforma** s integrovaným mining poolem, AI orchestrátorem, webovým frontendem a e-shopem. Projekt kombinuje kryptomenu, decentralizovanou těžbu a humanitární filozofii ("Consciousness Mining").

### Klíčová čísla
| Metrika | Hodnota |
|---------|---------|
| **Celkem souborů** | ~3,000+ |
| **Python souborů** | ~400+ |
| **Řádků kódu (Python)** | ~150,000+ |
| **Hlavních modulů** | 15+ |
| **Těžební algoritmy** | 4 (Cosmic Harmony, RandomX, Yescrypt, Autolykos v2) |
| **Max supply** | 144 miliard ZION |
| **Premine** | 15.78 miliard ZION (10.96%) |

---

## 🏗️ Architektura projektu

```
ZION-2.9/
├── 🔷 CORE BLOCKCHAIN
│   ├── src/core/                 # Blockchain jádro
│   │   ├── new_zion_blockchain.py   # Hlavní blockchain (1,342 řádků)
│   │   ├── algorithms.py            # PoW algoritmy (302 řádků)
│   │   ├── zion_p2p_network.py      # P2P síť
│   │   ├── zion_rpc_server.py       # RPC API server
│   │   └── crypto_utils.py          # Kryptografické utility
│   │
│   └── zion/                     # Nativní knihovny
│       ├── mining/                  # C++/Python mining
│       ├── wallet/                  # Peněženka
│       └── core/                    # Jádro
│
├── 🏊 MINING POOL
│   └── src/pool/                 # Pool v2.9 (modular)
│       ├── zion_pool_v2_9.py        # Hlavní pool server
│       ├── auth/                    # Autentizace minerů
│       ├── mining/                  # Jobs, shares, difficulty
│       ├── blockchain/              # RPC klient, templates
│       ├── network/                 # Stratum server
│       └── database/                # SQLite persistence
│
├── 🤖 AI ORCHESTRATOR
│   └── ai/                       # AI komponenty
│       ├── ai_orchestrator.py       # Hlavní orchestrátor
│       ├── consciousness_mining_ai.py
│       ├── zion_quantum_ai.py
│       ├── zion_cosmic_ai.py
│       └── ml_prediction_models.py
│
├── 🌐 WEB FRONTEND
│   └── public_html/              # Kompletní web
│       ├── index.html               # Landing (matrix theme)
│       ├── V2/                      # Dashboard, shop, admin
│       │   ├── main.html
│       │   ├── shop.html
│       │   ├── admin.html
│       │   └── api/                 # PHP backend
│       └── assets/                  # CSS, JS, fonts
│
├── 🔌 API LAYER
│   └── api/                      # FastAPI endpoints
│       ├── __init__.py              # Hlavní FastAPI app
│       ├── ai_endpoints.py
│       ├── explorer_endpoints.py
│       └── wallet_endpoints.py
│
├── 🐳 DOCKER & DEPLOYMENT
│   ├── docker-compose.yml           # Orchestrace služeb
│   ├── docker/
│   │   ├── core-v2.9/               # Blockchain Dockerfile
│   │   ├── pool-v2.9/               # Pool Dockerfile
│   │   └── api-v2.9/                # API Dockerfile
│   └── k8s/                         # Kubernetes manifesty
│
├── 📊 MONITORING
│   └── monitoring/
│       ├── prometheus.yml
│       └── grafana/
│
├── 🧪 TESTS
│   └── tests/                    # Unit, integration, E2E
│
└── 📚 DOCUMENTATION
    └── docs/                     # Dokumentace (tato složka)
```

---

## 🔷 1. Core Blockchain (`src/core/`)

### Hlavní soubory
| Soubor | Řádků | Popis |
|--------|-------|-------|
| `new_zion_blockchain.py` | 1,342 | Kompletní blockchain implementace |
| `algorithms.py` | 302 | Registry PoW algoritmů |
| `zion_p2p_network.py` | ~800 | Peer-to-peer síť |
| `zion_rpc_server.py` | ~600 | JSON-RPC API (Monero kompatibilní) |
| `crypto_utils.py` | ~200 | Hashování, podpisy |
| `seednodes.py` | ~300 | Seed uzly a konfigurace |

### Blockchain specifikace
```yaml
Max Supply: 144,000,000,000 ZION
Premine: 15,780,000,000 ZION (10.96%)
Block Reward: 50 ZION (klesající)
Block Time: ~60 sekund
Difficulty: Dynamická (retarget každý blok)
Consensus: Proof-of-Work (multi-algo)
```

### Genesis distribuce
| Příjemce | Částka | Podíl |
|----------|--------|-------|
| Mining Operators | 8.25B ZION | 52.3% |
| DAO Winners | 1.75B ZION | 11.1% |
| ZION OASIS (Game Dev) | 1.44B ZION | 9.1% |
| Infrastructure | 4.34B ZION | 27.5% |

### PoW algoritmy
```python
# Podporované algoritmy (src/core/algorithms.py)
AVAILABLE_ALGOS = {
    "cosmic_harmony": ~500,000 H/s (native C++)
    "randomx":        ~6,600 H/s (CPU optimized)
    "yescrypt":       ~500 H/s (fallback)
    "autolykos_v2":   ~50,000 H/s (GPU ready)
}
```

---

## 🏊 2. Mining Pool (`src/pool/`)

### Modulární architektura (v2.9)
```
src/pool/
├── zion_pool_v2_9.py     # Entry point (387 řádků)
├── auth/
│   ├── login_handler.py      # XMRig/Stratum login
│   ├── address_validator.py  # ZION bech32 adresy
│   └── session_manager.py    # Aktivní session
├── mining/
│   ├── algorithm_detector.py # Native library loader
│   ├── job_manager.py        # Job distribuce
│   ├── share_validator.py    # Validace shares
│   └── difficulty_manager.py # VarDiff
├── blockchain/
│   ├── rpc_client.py         # ZION Core RPC
│   ├── template_manager.py   # Block templates
│   ├── reward_calculator.py  # PPLNS odměny
│   └── consciousness_game.py # Humanitární bonus
├── network/
│   ├── stratum_server.py     # Async TCP server
│   └── protocol_handler.py   # Message routing
└── database/
    └── models.py             # SQLite schema
```

### Pool konfigurace (`config/pool_production.json`)
```json
{
  "pool": {
    "name": "ZION Universal Pool v2.9",
    "port": 3333,
    "fee_percent": 1.0,
    "consciousness_tithe": 1.618,
    "min_difficulty": 1000,
    "max_difficulty": 10000000
  },
  "blockchain": {
    "host": "blockchain",
    "port": 18081
  }
}
```

### Consciousness Game
```
🌟 Filozofie: "Higher consciousness = Easier mining"

Score Range: 0.5 - 2.0
- Humanitarian Donation: +0.0 to +0.5
- Community Participation: +0.0 to +0.2
- Stable Hashrate: +0.0 to +0.1

Difficulty Multiplier: 1.5 (hard) → 0.5 (easy)
Humanitarian Tithe: 1.618% (Golden Ratio φ)
```

---

## 🤖 3. AI Orchestrator (`ai/`)

### Komponenty
| Modul | Funkce |
|-------|--------|
| `ai_orchestrator.py` | Centrální řízení AI |
| `ai_pool_orchestrator.py` | Pool-specific AI |
| `consciousness_mining_ai.py` | Consciousness scoring |
| `zion_quantum_ai.py` | Kvantové algoritmy |
| `zion_cosmic_ai.py` | Kosmická harmonie |
| `ml_prediction_models.py` | ML predikce |
| `zion_oracle_ai.py` | Cenové predikce |

### AI Features
- **Hashrate Prediction**: ML model pro odhad hashrate
- **Difficulty Adjustment**: AI-asistované ladění obtížnosti
- **Anomaly Detection**: Detekce podezřelého chování
- **Pool Switching**: Automatický výběr nejlepšího poolu

---

## 🌐 4. Web Frontend (`public_html/`)

### Struktura
```
public_html/
├── index.html            # Landing (Matrix theme)
├── indexM.html          # Mobile verze
├── matrix.css/js        # Hacker efekty
├── stargate.css/js      # Portal animace
├── assets/              # Bootstrap, FontAwesome
│   ├── css/
│   ├── js/
│   └── webfonts/
├── V2/                  # Hlavní portál
│   ├── main.html        # Dashboard
│   ├── shop.html        # E-shop
│   ├── cart.html        # Košík
│   ├── admin.html       # Admin panel
│   ├── dashboard.html   # Pool stats
│   ├── api/             # PHP backend
│   │   ├── create-order.php
│   │   ├── stripe-checkout.php
│   │   ├── wallet-lib.php
│   │   └── invoice-generator.php
│   ├── blog/            # Články
│   ├── gal/             # Galerie
│   └── video/           # Videa
└── shop/                # Legacy shop
```

### Funkce webu
- **Landing**: Matrix-style intro s ASCII art
- **Dashboard**: Live pool statistiky, hashrate grafy
- **E-shop**: Stripe payments, ZION wallet integrace
- **Admin**: Správa objednávek, wallet ledger
- **Blog**: Články o projektu
- **Dokumenty**: PDF knihy (CosmicEgg, SmaragdoveDesky, etc.)

---

## 🔌 5. API Layer (`api/`)

### FastAPI Server
```python
# api/__init__.py
from fastapi import FastAPI
app = FastAPI(title="ZION API", version="2.9.0")

# Endpoints
GET  /health              # Health check
GET  /v2.8.8/pool/stats   # Pool statistiky
GET  /v2.8.8/history/pool # Historická data
GET  /v2.8.8/leaderboard  # Top miners
WS   /v2.8.8/ws/{client}  # WebSocket real-time
POST /wallet/create       # Nová peněženka
POST /wallet/send         # Odeslat transakci
```

### Endpoint moduly
| Modul | Endpointy |
|-------|-----------|
| `ai_endpoints.py` | AI predikce, orchestrace |
| `explorer_endpoints.py` | Blockchain explorer |
| `wallet_endpoints.py` | Peněženka operace |

---

## 🐳 6. Docker & Deployment

### docker-compose.yml služby
```yaml
services:
  blockchain:       # ZION Core node
    ports: [8545, 18081]
    
  pool:            # Mining pool
    ports: [3333, 8080]
    depends_on: blockchain
    
  redis:           # Cache
    ports: [6379]
    
  prometheus:      # Monitoring
    ports: [9090]
    
  grafana:         # Dashboards
    ports: [3000]
    
  api:             # FastAPI
    ports: [8001]
```

### Spuštění
```bash
# Development
docker compose up -d

# Production
docker compose -f docker-compose.yml up -d --build

# Pouze pool
docker compose up -d pool
```

---

## 📦 7. Native Mining Libraries (`zion/mining/`)

### Kompilované knihovny
```
zion/mining/
├── libcosmic_harmony.so.2.9.0      # Cosmic Harmony (C++)
├── libcosmic_harmony_zion.so.2.9.0 # ZION-specific variant
├── librandomx_zion.so.2.9.0        # RandomX (Linux)
├── libyescrypt_zion.so.2.9.0       # Yescrypt
└── *.py                            # Python wrappery
```

### Python wrappery
| Wrapper | Nativní knihovna | Fallback |
|---------|------------------|----------|
| `cosmic_harmony_wrapper.py` | libcosmic_harmony | Python SHA3 |
| `randomx_wrapper.py` | librandomx | SHA3 chain |
| `yescrypt_wrapper.py` | libyescrypt | PBKDF2 |

### Hashrate comparison
```
Algorithm          Native (Linux)   Python Fallback   Slowdown
──────────────────────────────────────────────────────────────
Cosmic Harmony     ~500,000 H/s     ~8,000 H/s        62x
RandomX            ~6,600 H/s       ~80 H/s           82x
Yescrypt           ~4,800 H/s       ~500 H/s          10x
Autolykos v2       ~180,000 H/s     ~50,000 H/s       4x
```

---

## 📊 8. Monitoring (`monitoring/`)

### Prometheus metriky
```yaml
# monitoring/prometheus.yml
scrape_configs:
  - job_name: 'zion-pool'
    static_configs:
      - targets: ['pool:9090']
  - job_name: 'zion-api'
    static_configs:
      - targets: ['api:8001']
```

### Grafana dashboards
- **Pool Overview**: Hashrate, miners, shares
- **Blockchain**: Height, difficulty, TPS
- **API Performance**: Latence, requests/sec
- **System**: CPU, RAM, disk

### Alerty (20+)
- Pool hashrate drop
- No active miners
- High share rejection
- High API latency
- Database slow queries

---

## 🧪 9. Testing (`tests/`)

### Test struktura
```
tests/
├── unit/              # Unit testy
│   ├── test_algorithms.py
│   ├── test_blockchain.py
│   └── test_pool.py
├── integration/       # Integration testy
│   ├── test_pool_blockchain.py
│   └── test_api_pool.py
├── e2e/              # End-to-end
│   └── test_full_mining_flow.py
└── performance/      # Benchmarky
    └── test_hashrate.py
```

### Spuštění
```bash
pytest                          # Všechny testy
pytest -m unit                  # Pouze unit
pytest --cov=src               # S coverage
pytest tests/performance/      # Benchmarky
```

### Coverage: **90%+** ✅

---

## ⚙️ 10. Konfigurace

### Hlavní konfigurační soubory
| Soubor | Účel |
|--------|------|
| `config/pool_production.json` | Pool nastavení |
| `config/zion_global.json` | Globální ZION config |
| `config/gpu_mining.json` | GPU mining params |
| `.env.production` | Environment variables |
| `pyproject.toml` | Python project config |
| `pytest.ini` | Test configuration |

### Environment proměnné
```bash
# .env.production
BLOCKCHAIN_HOST=blockchain
BLOCKCHAIN_PORT=18081
POOL_PORT=3333
API_PORT=8001
REDIS_HOST=redis
LOG_LEVEL=INFO
```

---

## 📚 11. Dokumentace (`docs/`)

### Existující docs
```
docs/
├── CORE/                    # Blockchain dokumentace
├── mining/                  # Mining guides
├── guides/                  # Uživatelské příručky
├── technical/               # Technická dokumentace
├── WHITEPAPER_2025/         # Whitepaper
├── COSMIC_MAP/              # Project roadmaps
├── session-logs/            # Development logs
└── *.md                     # Různé docs
```

---

## 🔐 12. Bezpečnost

### Implementované funkce
- ✅ Parametrizované SQL dotazy
- ✅ Input validace (Pydantic)
- ✅ Rate limiting
- ✅ CORS konfigurace
- ✅ Non-root Docker user
- ✅ Secret scanning (gitleaks)
- ✅ Dependency audit (pip-audit)

### Bezpečnostní nástroje
```bash
bandit -r src/           # Code security
pip-audit                # Dependency vulnerabilities
safety check             # Known CVEs
trivy image zion:latest  # Docker security
```

---

## 🗺️ 13. Roadmapa

### Dokončeno ✅
- v2.8.7: Performance optimalizace
- v2.8.8: WebSocket, monitoring
- v2.8.9: Code quality, GPU mining
- v2.9.0: Modular pool, web frontend

### Nadcházející 🚀
- v2.9.1: Native miner stabilizace
- v2.9.2: Cross-chain bridges
- v3.0.0: DAO governance 2.0

---

## 📞 Kontakt

- **Website**: https://zionterranova.com
- **GitHub**: https://github.com/Yose144/Zion-2.9
- **Discord**: https://discord.gg/zion

---

**Vytvořeno s ❤️ ZION Development Team**
