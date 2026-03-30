# 🤖 ZION AI System - Technická dokumentace

## Obsah
1. [Přehled](#přehled)
2. [Architektura](#architektura)
3. [Komponenty](#komponenty)
4. [AI Orchestrátor](#ai-orchestrátor)
5. [Consciousness Mining](#consciousness-mining)
6. [Konfigurace](#konfigurace)
7. [API Integrace](#api-integrace)
8. [Deployment](#deployment)

---

## Přehled

ZION AI System je **multi-agent AI framework** pro optimalizaci těžby kryptoměny, využívající neuronové sítě, consciousness-based algoritmy a real-time adaptaci.

### Klíčové vlastnosti
- **Neural Network Optimization**: PyTorch LSTM pro predikci hashrate
- **Consciousness Mining**: Spirituálně-inspirovaná optimalizace
- **Multi-Agent Coordination**: 3 nezávislé AI agenty spolupracující
- **Real-time Adaptation**: 60s cyklus optimalizace
- **Redis Messaging**: Event-driven komunikace

---

## Architektura

```
┌───────────────────────────────────────────────────────────────┐
│                    ZION AI ORCHESTRATOR                       │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │ Consciousness│  │    Pool      │  │    Warp      │        │
│  │    Agent     │  │   Agent      │  │   Agent      │        │
│  │              │  │              │  │              │        │
│  │ - Optimizer  │  │ - Strategy   │  │ - Quantum    │        │
│  │ - Metrics    │  │ - Selection  │  │ - Coherence  │        │
│  │ - Prediction │  │ - Switching  │  │ - Adaptation │        │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘        │
│         │                 │                 │                 │
│         └─────────────────┼─────────────────┘                 │
│                           │                                   │
│  ┌────────────────────────┴────────────────────────┐         │
│  │            CONFLICT RESOLUTION                   │         │
│  │                                                  │         │
│  │   Weighted Voting: consciousness=0.4            │         │
│  │                   pool=0.3, warp=0.3            │         │
│  └────────────────────────┬────────────────────────┘         │
│                           │                                   │
│  ┌────────────────────────┴────────────────────────┐         │
│  │            UNIFIED STRATEGY                      │         │
│  │                                                  │         │
│  │   - Mining Parameters                           │         │
│  │   - Pool Strategy                               │         │
│  │   - Warp Parameters                             │         │
│  └─────────────────────────────────────────────────┘         │
│                                                               │
└───────────────────────────────────────────────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │        REDIS           │
              │                        │
              │  ai:optimized_params   │
              │  ai:pool_recommendation│
              │  ai:warp_optimization  │
              └────────────────────────┘
```

---

## Komponenty

### 1. Consciousness Mining AI (`consciousness_mining_ai.py`)

Neuronová síť pro predikci a optimalizaci těžby.

```python
class MiningOptimizer(nn.Module):
    """
    LSTM + Attention model pro mining optimization
    
    Input:  (batch, seq_len=50, features=8)
    Output: (batch, 8) - optimized parameters
    """
    
    def __init__(self):
        # LSTM: 2 vrstvy, hidden_size=64
        self.lstm = nn.LSTM(input_size=8, hidden_size=64, num_layers=2)
        
        # Multi-head Attention: 4 hlavy
        self.attention = nn.MultiheadAttention(64, num_heads=4)
        
        # FC vrstvy: 64 → 32 → 16 → 8
        self.fc = nn.Sequential(...)
```

#### Input features (8)
| Feature | Popis | Rozsah |
|---------|-------|--------|
| hash_rate | Aktuální hashrate | 0 - 10M H/s |
| difficulty | Síťová obtížnost | 0.1 - 10.0 |
| block_time | Čas mezi bloky | 10 - 600s |
| temperature | Teplota GPU/CPU | 30 - 100°C |
| power_consumption | Spotřeba | 50 - 500W |
| efficiency | H/s per Watt | 0 - 10000 |
| reward_rate | Odměna/hodina | 0 - 100 ZION |
| network_hash_rate | Celková síť | 0 - 100G H/s |

#### Output parameters (8)
| Parameter | Popis | Rozsah |
|-----------|-------|--------|
| target_difficulty | Cílová obtížnost | 0.1 - 10.0 |
| hash_rate_target | Cílový hashrate | 1k - 1M H/s |
| power_limit | Max spotřeba | 50 - 500W |
| temperature_limit | Max teplota | 50 - 90°C |
| efficiency_weight | Váha efektivity | 0.0 - 1.0 |
| reward_weight | Váha odměn | 0.0 - 1.0 |
| network_adaptation | Síťová adaptace | 0.0 - 1.0 |
| consciousness_boost | Consciousness bonus | 0.0 - 1.0 |

### 2. AI Pool Orchestrator (`ai_pool_orchestrator.py`)

Inteligentní správa mining poolů.

```python
class AIPoolOrchestrator:
    """Optimalizace výběru a přepínání poolů"""
    
    async def get_optimal_pool_recommendation(self) -> dict:
        # Analyzuje:
        # - Latence jednotlivých poolů
        # - Stability a uptime
        # - Fee struktura
        # - Hashrate distribuce
        
        return {
            'recommendation': 'zion-official',
            'confidence': 0.85,
            'strategy_weights': {
                'zion-official': 0.6,
                'backup-pool': 0.4
            }
        }
```

### 3. AI Warp Engine (`ai_warp_engine.py`)

Quantum-inspired optimalizace.

```python
class AIWarpEngine:
    """Warp field a quantum coherence optimalizace"""
    
    # Parametry:
    # - field_intensity: 0.0 - 1.0
    # - field_frequency: Hz (default 7.83 - Schumannova rezonance)
    # - field_coherence: 0.0 - 1.0
```

### 4. AI Orchestrator (`ai_orchestrator.py`)

Master koordinátor všech AI agentů.

```python
class ZIONAIOrchestrator:
    """Multi-agent decision making system"""
    
    # Agent váhy pro conflict resolution
    agent_weights = {
        'consciousness': 0.4,  # Highest priority
        'pool': 0.3,
        'warp': 0.3
    }
    
    # Coordination interval
    coordination_interval = 30  # seconds
```

---

## AI Orchestrátor

### Životní cyklus

```
1. INIT
   └── Připojení k Redis
   └── Inicializace agentů
   └── Load modelů

2. START
   └── Spuštění všech agentů
   └── Start coordination loop
   └── Start health monitoring

3. COORDINATION LOOP (každých 30s)
   └── Collect agent decisions
   └── Resolve conflicts
   └── Implement unified strategy
   └── Store results

4. HEALTH MONITORING (každých 30s)
   └── Check agent status
   └── Detect unhealthy agents
   └── Auto-recovery (TODO)

5. STOP
   └── Graceful shutdown
   └── Stop všech agentů
   └── Cleanup resources
```

### Conflict Resolution

```python
def resolve_agent_conflicts(self, decisions: Dict) -> Dict:
    """
    Weighted voting pro kombinaci AI doporučení
    
    Příklad:
    - Consciousness AI říká: hash_rate_target = 60000
    - Warp Engine říká: hash_rate_target = 40000
    
    Výsledek (weighted average):
    hash_rate_target = 60000 * 0.4 + 40000 * 0.3 / (0.4 + 0.3)
                     = (24000 + 12000) / 0.7
                     = 51428 H/s
    """
```

---

## Consciousness Mining

### Princip

Consciousness Mining je spirituálně-inspirovaný systém, kde "vědomí" mineru ovlivňuje jeho úspěšnost.

```python
class ConsciousnessLevel:
    """
    Úrovně vědomí (0.0 - 1.0)
    
    0.0 - DORMANT:   Základní operace
    0.3 - AWAKENING: Začátek optimalizace
    0.5 - AWARE:     Aktivní přizpůsobení
    0.7 - CONSCIOUS: Pokročilá predikce
    1.0 - ENLIGHTENED: Maximální efektivita
    """
```

### Výpočet consciousness score

```python
def _calculate_performance_score(metrics: Dict) -> float:
    """
    Složky performance score:
    
    1. Efficiency (40%):
       - efficiency / 1000, max 1.0
       - Vyšší H/W = lepší score
    
    2. Stability (30%):
       - 1 / (1 + variance)
       - Stabilnější hashrate = lepší score
    
    3. Rewards (30%):
       - reward_rate / 100, max 1.0
       - Více odměn = lepší score
    """
    
    score = efficiency_score * 0.4 + stability_score * 0.3 + reward_score * 0.3
    return score
```

### Consciousness Enhancement

```python
def _apply_consciousness_enhancement(params: Dict, metrics: Dict) -> Dict:
    """
    Vysoké consciousness (>0.5) aplikuje bonusy:
    
    - efficiency_weight *= (1 + consciousness_level)
    - reward_weight *= (1 + consciousness_level * 0.5)
    - learning_rate = 0.001 * (1 + consciousness_level)
    """
```

---

## Konfigurace

### Redis keys

```
# AI Optimized Parameters
ai:optimized_params = {
    "target_difficulty": 1.2,
    "hash_rate_target": 55000,
    "power_limit": 180,
    "temperature_limit": 72,
    "efficiency_weight": 0.65,
    "reward_weight": 0.55,
    "network_adaptation": 0.4,
    "consciousness_boost": 0.3
}

# Pool Recommendation
ai:pool_recommendation = {
    "recommendation": "zion-official",
    "confidence": 0.85,
    "strategy_weights": {...}
}

# Warp Optimization
ai:warp_optimization = {
    "warp_field_optimization": {
        "intensity": 0.6,
        "frequency": 7.83,
        "coherence": 0.75
    },
    "mining_optimization": {...}
}

# Orchestrator outputs
orchestrator:mining_params = {...}
orchestrator:pool_strategy = {...}
orchestrator:warp_params = {...}
orchestrator:health = {...}
orchestrator:history = [...]
```

### zion_miner_config.json

```json
{
  "ai": {
    "enabled": true,
    "consciousness_mining": true,
    "optimization_interval": 60,
    "learning_rate": 0.001,
    "adaptation_threshold": 0.1
  },
  "redis": {
    "host": "localhost",
    "port": 6379
  },
  "agents": {
    "consciousness": {
      "weight": 0.4,
      "enabled": true
    },
    "pool": {
      "weight": 0.3,
      "enabled": true
    },
    "warp": {
      "weight": 0.3,
      "enabled": true
    }
  }
}
```

---

## API Integrace

### AI Endpoints

```
GET  /api/ai/overview       - Přehled AI systému
GET  /api/ai/status         - Status všech AI komponent
GET  /api/ai/status/{name}  - Status konkrétní komponenty
POST /api/ai/activate/{name} - Aktivace AI komponenty
POST /api/ai/deactivate/{name} - Deaktivace AI komponenty
POST /api/ai/execute/{name}  - Spuštění AI úlohy
GET  /api/ai/metrics        - Performance metriky
```

### Příklady volání

```bash
# Získat AI status
curl http://localhost:8000/api/ai/status

# Response:
{
  "consciousness": {
    "running": true,
    "consciousness_level": 0.72,
    "optimization_cycles": 1543,
    "performance_score": 0.65
  },
  "pool": {
    "running": true,
    "active_pools": 3,
    "current_strategy": "zion-official",
    "recommendation_confidence": 0.85
  },
  "warp": {
    "running": true,
    "warp_intensity": 0.6,
    "quantum_coherence": 0.75,
    "adaptation_cycles": 892
  }
}
```

```bash
# Aktivovat AI komponentu
curl -X POST http://localhost:8000/api/ai/activate/consciousness \
  -H "Content-Type: application/json" \
  -d '{"optimization_interval": 30}'

# Response:
{
  "status": "activated",
  "component": "consciousness",
  "config": {"optimization_interval": 30}
}
```

---

## Deployment

### Standalone

```bash
# Spustit AI Orchestrator
cd ai/
python ai_orchestrator.py

# Nebo použít shell script
./start_ai_orchestrator.sh

# Stop
./stop_ai_orchestrator.sh
```

### Docker

```yaml
# docker-compose.yml
services:
  ai-orchestrator:
    build:
      context: .
      dockerfile: docker/Dockerfile.ai
    depends_on:
      - redis
    environment:
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - PYTHONUNBUFFERED=1
    volumes:
      - ./ai:/app/ai
    command: python ai/ai_orchestrator.py
```

### Requirements

```txt
# requirements-ai.txt
torch>=2.0.0
numpy>=1.24.0
pandas>=2.0.0
scikit-learn>=1.2.0
redis>=4.5.0
psutil>=5.9.0
GPUtil>=1.4.0
```

---

## Další AI komponenty

### zion_quantum_ai.py
Quantum computing simulace pro optimalizaci.

### zion_cosmic_ai.py
Cosmic pattern recognition pro predikci.

### zion_oracle_ai.py
Prorocká AI pro market prediction.

### zion_bio_ai.py
Bio-inspired algoritmy.

### ml_prediction_models.py
Další ML modely pro predikci.

---

## Monitoring & Debugging

### Logs

```bash
# Sledovat AI logy
docker logs -f zion-ai-orchestrator

# Filtrovat podle úrovně
docker logs zion-ai-orchestrator 2>&1 | grep -E "(ERROR|WARNING)"
```

### Redis monitoring

```bash
# Připojit se k Redis
redis-cli

# Sledovat AI klíče
KEYS ai:*
KEYS orchestrator:*

# Sledovat coordination events
SUBSCRIBE orchestrator:events
```

### Health check

```bash
# Získat health status z Redis
redis-cli GET orchestrator:health | jq .

# Response:
{
  "timestamp": "2024-01-15T10:30:00",
  "agent_statuses": {...},
  "overall_health": "healthy"
}
```

---

**ZION AI System** - Consciousness-Enhanced Mining 🧠⛏️
