# 🌐 ZION Pool - Multichain Architecture v2.9

> **Status**: Implementováno | **Datum**: 20. ledna 2026

## 📋 Přehled

ZION Pool v2.9 nyní podporuje **multichain routing** – schopnost obsluhovat více blockchainů současně z jedné pool instance. Každý miner může specifikovat `chain_id` při loginu a pool automaticky routuje joby, template updaty a block submity na správný chain.

## 🏗️ Architektura

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ZION Universal Pool v2.9                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                 MultiBlockTemplateManager                    │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │    │
│  │  │ chain=zion  │  │ chain=etc   │  │ chain=erg   │  ...    │    │
│  │  │ TemplateM.  │  │ TemplateM.  │  │ TemplateM.  │         │    │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘         │    │
│  └─────────┼────────────────┼────────────────┼─────────────────┘    │
│            │                │                │                       │
│  ┌─────────▼────────────────▼────────────────▼─────────────────┐    │
│  │                      JobManager                              │    │
│  │  • templates_by_chain: Dict[chain_id, template]              │    │
│  │  • current_height_by_chain: Dict[chain_id, int]              │    │
│  │  • create_job(session_id, algorithm, chain_id, difficulty)   │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    SessionManager                            │    │
│  │  • MinerSession.chain_id: str = "zion"                       │    │
│  │  • get_sessions_by_chain(chain_id) → List[MinerSession]      │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                   ProtocolHandler                            │    │
│  │  • handle_login: extrahuje chain_id z login requestu         │    │
│  │  • handle_submit: routuje share k správnému chain templatu   │    │
│  │  • _submit_found_block: posílá block na správný chain RPC    │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## 🔑 Klíčové komponenty

### 1. MultiBlockTemplateManager

**Soubor**: `src/pool/blockchain/multi_template_manager.py`

Routing layer, která drží mapu `chain_id → BlockTemplateManager`. Pokud chain není specifikován, použije se default (`zion`).

```python
@dataclass
class MultiBlockTemplateManager:
    managers: Dict[str, BlockTemplateManager]
    default_chain_id: str = "zion"
    
    async def get_template(self, chain_id: str = None, force_refresh: bool = False):
        mgr = self.get_manager(chain_id)
        return await mgr.get_template(force_refresh=force_refresh)
    
    def get_template_for_job(self, algorithm: str = None, chain_id: str = None):
        mgr = self.get_manager(chain_id)
        return mgr.get_template_for_job(algorithm=algorithm)
```

### 2. JobManager (chain-aware)

**Soubor**: `src/pool/mining/job_manager.py`

Udržuje per-chain template cache a výšky:

```python
class JobManager:
    templates_by_chain: Dict[str, Dict]      # chain_id → template data
    current_height_by_chain: Dict[str, int]  # chain_id → block height
    
    def update_template(self, template: Dict, chain_id: str = None):
        cid = (chain_id or self.default_chain_id).lower()
        self.templates_by_chain[cid] = template
        self.current_height_by_chain[cid] = template.get('height', 0)
    
    def create_job(self, session_id, algorithm, chain_id=None, difficulty=None):
        cid = (chain_id or self.default_chain_id).lower()
        template = self.templates_by_chain.get(cid)
        # ... vytvoří job s chain_id
```

### 3. MinerSession + SessionManager

**Soubor**: `src/pool/auth/session_manager.py`

Každá session má `chain_id` field:

```python
@dataclass
class MinerSession:
    session_id: str
    wallet_address: str
    worker_name: str
    algorithm: str
    protocol: str
    chain_id: str = "zion"  # ← NEW
    # ...

class SessionManager:
    def get_sessions_by_chain(self, chain_id: str) -> List[MinerSession]:
        """Vrátí všechny sessions pro daný chain."""
        cid = (chain_id or "zion").lower()
        return [s for s in self.sessions.values() 
                if (getattr(s, "chain_id", "zion") or "zion").lower() == cid]
```

### 4. MiningJob

**Soubor**: `src/pool/mining/job_manager.py`

Job obsahuje `chain_id` pro správný routing při validaci:

```python
@dataclass
class MiningJob:
    job_id: str
    algorithm: str
    blob: str
    target: str
    height: int
    seed_hash: str
    next_seed_hash: str = ''
    chain_id: str = "zion"  # ← NEW
    # ...
```

## 🔄 Flow: Template Update Loop

```python
# src/pool/zion_pool_v2_9.py

async def _template_update_loop(self):
    while self._running:
        await asyncio.sleep(5)
        
        # Pro každý registrovaný chain:
        for chain_id in self.template_manager.chain_ids:
            template = await self.template_manager.get_template(
                force_refresh=True,
                chain_id=chain_id,
            )
            
            if not template:
                continue
            
            # Zkontroluj, jestli je nová výška
            template_height = template.get('height', 0)
            current_height = self.job_manager.get_current_height(chain_id)
            
            if template_height <= current_height:
                continue
            
            # Nový blok! Update template a broadcast joby
            template_data = self.template_manager.get_template_for_job(chain_id=chain_id)
            self.job_manager.update_template(template_data, chain_id=chain_id)
            await self._broadcast_new_jobs(chain_id=chain_id)
```

## 🔄 Flow: Job Broadcast

```python
async def _broadcast_new_jobs(self, chain_id: str = "zion"):
    # Získej pouze sessions pro tento chain
    sessions = self.session_manager.get_sessions_by_chain(chain_id)
    
    for session in sessions:
        job = self.job_manager.create_job(
            session_id=session.session_id,
            algorithm=session.algorithm,
            chain_id=chain_id,  # ← Explicitně
            difficulty=initial_diff
        )
        
        # Pošli job minerovi
        await self.stratum_server.send_job(session.session_id, job_response)
```

## 🔄 Flow: Miner Login

```
Miner → Pool: {"method":"login", "params":{"login":"wallet.worker", "algo":"cosmic_harmony_v3", "chain":"zion"}}
                                                                                        ↑
Pool extracts chain_id from login params ─────────────────────────────────────────────────┘

Pool:
  1. Vytvoří MinerSession s chain_id
  2. Vytvoří první job z chain-specific template
  3. Uloží chain_id do connection objektu
  4. Odpoví s job payload
```

## ⚙️ Konfigurace

### Aktuální (single-chain default)

Default zůstává single-chain (`zion`). Pokud nic nenastavíš, pool vytvoří pouze chain `zion` z existující sekce `blockchain` (+ env override `BLOCKCHAIN_HOST/BLOCKCHAIN_PORT`).

Interně se ale i v single-chain módu používá `MultiRPCClient` + `MultiBlockTemplateManager` (jen s jedním záznamem v mapě).

```python
# V ZionUniversalPool.__init__():

self.block_template_mgr = BlockTemplateManager(
    rpc_client=self.rpc_client,
    pool_wallet=pool_cfg.get('wallet_address'),
)

# Multi-chain wrapper (default: single chain "zion")
self.template_manager = MultiBlockTemplateManager(
    managers={"zion": self.block_template_mgr},
    default_chain_id="zion",
)
```

### Multi-chain přes config (`blockchains`)

Pokud chceš více chainů se stejným ZION JSON-RPC rozhraním, přidej do configu sekci `blockchains`:

```json
{
    "blockchain": { "host": "127.0.0.1", "port": 18081 },
    "blockchains": {
        "zion": { "host": "127.0.0.1", "port": 18081 },
        "zion-testnet": {
            "host": "127.0.0.1",
            "port": 28081,
            "pool_wallet": "zion1...",
            "template_update_interval": 10
        }
    }
}
```

Pool pak automaticky vytvoří:
- `MultiRPCClient(clients={...})`
- `MultiBlockTemplateManager(managers={...})`
- per-chain template update loop + per-chain broadcast jobů

### Budoucí rozšíření (non-ZION chains)

```python
# Příklad pro ETC merged mining:
etc_rpc = ZionRPCClient(host="etc-node", port=8545)
etc_template_mgr = BlockTemplateManager(rpc_client=etc_rpc, ...)

self.template_manager = MultiBlockTemplateManager(
    managers={
        "zion": self.block_template_mgr,
        "etc": etc_template_mgr,
    },
    default_chain_id="zion",
)
```

## 📁 Změněné soubory

| Soubor | Změna |
|--------|-------|
| `src/pool/blockchain/__init__.py` | Export `MultiBlockTemplateManager` |
| `src/pool/blockchain/multi_template_manager.py` | **NOVÝ** - routing layer |
| `src/pool/mining/job_manager.py` | `chain_id` v `MiningJob`, per-chain templates |
| `src/pool/auth/session_manager.py` | `chain_id` v `MinerSession`, `get_sessions_by_chain()` |
| `src/pool/network/protocol_handler.py` | Chain routing v login/submit |
| `src/pool/zion_pool_v2_9.py` | Wire `MultiBlockTemplateManager`, chain-aware loops |

## ✅ Zpětná kompatibilita

- **Default chain_id**: `"zion"` - pokud miner nepošle chain, použije se default
- **Existing miners**: Fungují beze změny - nemusí posílat chain_id
- **Single-chain deployment**: Funguje identicky jako předtím
- **API**: Všechny existující endpointy zůstávají kompatibilní

## 🧪 Testování

```bash
# Unit testy pro share validaci (včetně CHv3 server-side)
pytest -q tests/test_share_validator.py -k "chv3"

# Block submission flow
pytest -q tests/test_block_submission_fix.py
```

## 🚀 Další kroky

1. **Multi-RPC routing**: Přidat `MultiRPCClient` pro routing block submitů na správný chain
2. **Config-driven chains**: Načítat chainy z `config/pool_production.json`
3. **CH v3 merged mining**: Napojit `ch3_hash_submitter` na multichain template manager
4. **Metrics per chain**: Prometheus metriky rozdělené podle chain_id

---

*Dokument vytvořen: 20. ledna 2026 | ZION TerraNova v2.9*
