# 🛠️ ZION v2.9 Developer Guide

**Verze**: 2.9 TestNet  
**Poslední aktualizace**: 1. ledna 2026

---

## 📋 Obsah

1. [Rychlý start](#-rychlý-start)
2. [Architektura](#-architektura)
3. [Lokální vývoj](#-lokální-vývoj)
4. [Testování](#-testování)
5. [Code Style](#-code-style)
6. [Git workflow](#-git-workflow)
7. [Debugging](#-debugging)
8. [Deployment](#-deployment)

---

## 🚀 Rychlý start

### Požadavky

- Python 3.11+ (doporučeno 3.12)
- Docker & Docker Compose
- Git
- Redis (pro lokální dev)
- 8GB RAM minimum

### Setup prostředí

```bash
# 1. Klonuj repo
git clone https://github.com/zion-terranova/Zion-2.9.git
cd Zion-2.9

# 2. Vytvoř virtuální prostředí
python3 -m venv .venv
source .venv/bin/activate  # Linux/Mac
# .venv\Scripts\activate   # Windows

# 3. Instaluj dependencies
pip install -r requirements.txt
pip install -r requirements-dev.txt  # Pro vývojáře

# 4. Nastav environment
cp config/.env.example config/.env
# Uprav .env podle potřeby

# 5. Spusť testy
pytest tests/ -v
```

### Spuštění lokálně

```bash
# Varianta A: Docker stack (doporučeno)
docker-compose up -d
docker-compose logs -f

# Varianta B: Jednotlivé komponenty
# Terminal 1 - Blockchain
python -m src.main --testnet

# Terminal 2 - Pool
python -m src.pool.zion_pool_v2_9 --config config/pool_local_test.json

# Terminal 3 - API
uvicorn src.api:app --host 0.0.0.0 --port 8001 --reload
```

---

## 🏗️ Architektura

```
┌─────────────────────────────────────────────────────────────────┐
│                        ZION v2.9 Stack                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐            │
│  │ Frontend│  │   API   │  │  Pool   │  │Blockchain│            │
│  │ Next.js │  │ FastAPI │  │ Stratum │  │   Core  │            │
│  │  :3000  │  │  :8001  │  │  :3333  │  │  :8545  │            │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘            │
│       │            │            │            │                  │
│       └────────────┼────────────┼────────────┘                  │
│                    │            │                               │
│              ┌─────┴─────┐  ┌───┴───┐                          │
│              │   Redis   │  │SQLite │                          │
│              │   :6379   │  │ .db   │                          │
│              └───────────┘  └───────┘                          │
└─────────────────────────────────────────────────────────────────┘
```

### Klíčové moduly

| Modul | Cesta | Popis |
|-------|-------|-------|
| Blockchain Core | `src/core/new_zion_blockchain.py` | PoW blockchain, transakce, konsenzus |
| P2P Network | `src/core/zion_p2p_network.py` | Peer discovery, block propagace |
| Mining Pool | `src/pool/zion_pool_v2_9.py` | Stratum server, share validace |
| Reward Calculator | `src/pool/blockchain/reward_calculator.py` | PPLNS, consciousness bonus |
| Payout Manager | `src/pool/payout/payout_manager.py` | Automatické výplaty |
| Crypto Utils | `src/core/crypto_utils.py` | ECDSA klíče, signing |
| API Gateway | `src/api/router_v2_9.py` | REST API endpointy |

### Datový tok

```
Miner → Stratum:3333 → Pool validates share
                            ↓
                    Share valid? → Credit pending balance
                            ↓
                    Block found? → Submit to blockchain:8545
                            ↓
                    Block accepted → Distribute rewards (PPLNS)
                            ↓
                    Payout threshold → Send transaction
```

---

## 💻 Lokální vývoj

### Struktura projektu

```
Zion-2.9/
├── src/                    # Hlavní zdrojový kód
│   ├── core/              # Blockchain jádro
│   ├── pool/              # Mining pool
│   ├── api/               # REST API
│   ├── wallet/            # Wallet management
│   └── miner/             # Native miner
├── tests/                  # Pytest testy
├── config/                 # Konfigurace
├── docs/                   # Dokumentace
├── scripts/               # Utility skripty
├── monitoring/            # Prometheus, Grafana
└── docker/                # Docker soubory
```

### Hot reload

```bash
# API s hot reload
uvicorn src.api:app --reload --port 8001

# Pool (restart vyžadován)
python -m src.pool.zion_pool_v2_9 --config config/pool_local_test.json
```

### Environment variables

```bash
# Důležité proměnné
ZION_NETWORK=testnet        # testnet | mainnet
ZION_RPC_PORT=8545
POOL_PORT=3333
REDIS_URL=redis://localhost:6379
LOG_LEVEL=DEBUG             # DEBUG | INFO | WARNING | ERROR
```

---

## 🧪 Testování

### Spuštění testů

```bash
# Všechny testy
pytest tests/ -v

# Jen unit testy (rychlé)
pytest tests/ -m unit -v

# Integration testy (vyžaduje běžící služby)
pytest tests/ -m integration -v

# S coverage reportem
pytest tests/ --cov=src --cov-report=html
open htmlcov/index.html

# Konkrétní test soubor
pytest tests/test_crypto_utils.py -v

# Konkrétní test
pytest tests/test_crypto_utils.py::TestKeyPair::test_keypair_creation -v
```

### Test markers

```python
# V pytest.ini jsou definovány markers:
@pytest.mark.unit           # Rychlé unit testy
@pytest.mark.integration    # Vyžadují služby
@pytest.mark.e2e           # End-to-end
@pytest.mark.slow          # Trvají > 5s
@pytest.mark.requires_gpu  # Vyžadují GPU
```

### Psaní testů

```python
# tests/test_example.py
import pytest
from src.core.crypto_utils import generate_keypair

class TestExample:
    """Vždy používej třídy pro logické seskupení."""
    
    @pytest.fixture
    def keypair(self):
        """Fixtures pro opakovaně použitelné objekty."""
        return generate_keypair()
    
    def test_something(self, keypair):
        """Test názvy začínají 'test_' a jsou popisné."""
        assert keypair.public_key_hex is not None
        assert len(keypair.public_key_hex) == 128
    
    @pytest.mark.asyncio
    async def test_async_function(self):
        """Pro async kód použij pytest-asyncio."""
        result = await some_async_function()
        assert result is True
```

---

## 📝 Code Style

### Python

- **Formatter**: Black (line length 100)
- **Linter**: Ruff
- **Type hints**: Povinné pro public API

```bash
# Formátování
black src/ tests/ --line-length 100

# Linting
ruff check src/ tests/

# Type checking
mypy src/ --ignore-missing-imports
```

### Příklad dobrého kódu

```python
"""
Module docstring - krátký popis modulu.
"""
from __future__ import annotations

import logging
from typing import Dict, Optional
from decimal import Decimal

logger = logging.getLogger(__name__)


class RewardCalculator:
    """
    Třída pro výpočet mining odměn.
    
    Attributes:
        pool_fee: Procento poplatku poolu (0.01 = 1%)
    """
    
    def __init__(self, pool_fee: Decimal = Decimal("0.01")):
        self.pool_fee = pool_fee
    
    def calculate_reward(
        self,
        block_reward: Decimal,
        miner_address: str,
    ) -> Dict[str, Decimal]:
        """
        Vypočítá rozdělení odměny.
        
        Args:
            block_reward: Celková odměna za blok
            miner_address: Adresa příjemce
            
        Returns:
            Dict s rozdělenými částkami
            
        Raises:
            ValueError: Pokud block_reward < 0
        """
        if block_reward < 0:
            raise ValueError("Block reward cannot be negative")
        
        pool_fee_amount = block_reward * self.pool_fee
        miner_reward = block_reward - pool_fee_amount
        
        logger.info(
            "Calculated reward",
            extra={"miner": miner_address, "amount": float(miner_reward)}
        )
        
        return {
            "total": block_reward,
            "miner_reward": miner_reward,
            "pool_fee": pool_fee_amount,
        }
```

---

## 🔀 Git workflow

### Branches

- `main` - Produkční kód, vždy stabilní
- `develop` - Integrační branch
- `feature/XXX` - Nové funkce
- `fix/XXX` - Bug fixy
- `hotfix/XXX` - Urgentní produkční fixy

### Commit messages

```
type(scope): krátký popis

[volitelné tělo]

[volitelná patička]
```

**Typy**:
- `feat`: Nová funkce
- `fix`: Bug fix
- `docs`: Dokumentace
- `test`: Testy
- `refactor`: Refactoring
- `perf`: Performance
- `chore`: Údržba

**Příklady**:
```
feat(pool): add PPLNS reward distribution
fix(crypto): handle empty signature gracefully
docs(readme): update installation steps
test(p2p): add multi-node sync tests
```

### Pull Request process

1. Vytvoř branch z `develop`
2. Implementuj změny
3. Přidej/aktualizuj testy
4. Spusť `pytest tests/ -v` lokálně
5. Vytvoř PR do `develop`
6. Code review (min 1 approval)
7. Squash & merge

---

## 🐛 Debugging

### Logging

```python
import logging

# Nastav úroveň
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Použij structured logging
logger.info(
    "Processing block",
    extra={"height": 123, "hash": "abc...", "miner": "ZION_..."}
)
```

### Běžné problémy

#### Import errors
```bash
# Zkontroluj PYTHONPATH
export PYTHONPATH="${PYTHONPATH}:$(pwd)"

# Nebo použij
python -m src.module  # místo python src/module.py
```

#### Database locked (SQLite)
```bash
# Najdi proces
fuser data/*.db

# Restart služby
docker restart pool
```

#### Port already in use
```bash
# Najdi proces
lsof -i :8545

# Ukonči
kill -9 <PID>
```

### Profiling

```bash
# CPU profiling
python -m cProfile -o profile.out src/main.py
python -m pstats profile.out

# Memory profiling
pip install memory-profiler
python -m memory_profiler src/main.py
```

---

## 🚢 Deployment

### TestNet (91.98.122.165)

```bash
# SSH přístup
ssh -i ~/.ssh/zion_server_key root@91.98.122.165

# Deploy
cd /root/zion-v2.9
git pull origin main
docker-compose build --no-cache
docker-compose up -d
```

### Checklist před deployem

- [ ] Všechny testy prochází (`pytest tests/ -v`)
- [ ] Žádné linting errory (`ruff check src/`)
- [ ] Dokumentace aktualizována
- [ ] CHANGELOG aktualizován
- [ ] Testováno lokálně s Docker stack
- [ ] Code review schválen

### Rollback

```bash
# Rychlý rollback na předchozí verzi
git log --oneline -5  # najdi předchozí commit
git checkout <commit-hash>
docker-compose build --no-cache
docker-compose up -d
```

---

## 📚 Další zdroje

- [Architektura](docs/technical/PROJECT_ARCHITECTURE_OVERVIEW.md)
- [Ekonomický model](ECONOMIC_CALCULATIONS_CORRECT.md)
- [Consciousness Mining](docs/2.7.5/CONSCIOUSNESS_MINING_GAME_SPEC.md)
- [Production Runbook](docs/PRODUCTION_RUNBOOK.md)
- [API dokumentace](src/api/README.md)

---

*Vytvořeno s ❤️ pro ZION TerraNova komunitu*
