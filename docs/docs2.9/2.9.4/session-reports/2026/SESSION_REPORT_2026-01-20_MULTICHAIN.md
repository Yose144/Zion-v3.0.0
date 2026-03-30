# 📋 SESSION REPORT: Multichain Architecture + CHv3 Real Validation

**Datum**: 20. ledna 2026  
**Session ID**: Q3_MULTICHAIN_CHV3  
**Status**: ✅ COMPLETED

---

## 🎯 Cíle session

1. **CH v3 "real" validace** - Pool nesmí trustovat miner-provided hash pro Cosmic Harmony v3
2. **Multichain refactor** - Zavést chain_id routing do template/job/session systému
3. **Zpětná kompatibilita** - Default chování musí zůstat identické

---

## ✅ Dokončené úkoly

### 1. Cosmic Harmony v3 - Server-side hash validace

**Problém**: Pool dříve trustoval `result` hash od minera pro CH v3, což nebylo "real" ověření.

**Řešení**:
- `ShareValidator` nyní defaultně počítá hash server-side pro `cosmic_harmony`, `cosmic_harmony_v3`, `cosmic`
- Parametr `validate_cosmic_hashes: bool = True` v konstruktoru
- Miner-provided `result` se ignoruje pro validaci (jen jako fallback)
- XMRig submit path používá 64-bit LE target (16 hex) pro správnou 32-bit state0 komparaci

**Soubory**:
- `src/pool/mining/share_validator.py`
- `src/pool/network/protocol_handler.py`

**Testy**:
```bash
pytest -q tests/test_share_validator.py -k "chv3"  # 2 passed
```

### 2. Multichain Template Manager

**Nový soubor**: `src/pool/blockchain/multi_template_manager.py`

```python
@dataclass
class MultiBlockTemplateManager:
    managers: Dict[str, BlockTemplateManager]
    default_chain_id: str = "zion"
    
    def get_manager(self, chain_id: str = None) -> BlockTemplateManager
    async def get_template(chain_id: str = None, force_refresh: bool = False)
    def get_template_for_job(algorithm: str = None, chain_id: str = None)
    def invalidate_template(chain_id: str = None)
```

### 3. Chain-aware Session & Job

**MinerSession** (`src/pool/auth/session_manager.py`):
```python
@dataclass
class MinerSession:
    # ... existing fields ...
    chain_id: str = "zion"  # NEW

class SessionManager:
    def get_sessions_by_chain(self, chain_id: str) -> List[MinerSession]  # NEW
```

**MiningJob** (`src/pool/mining/job_manager.py`):
```python
@dataclass
class MiningJob:
    # ... existing fields ...
    chain_id: str = "zion"  # NEW
```

### 4. Chain-aware Pool Loops

**Template update loop** (`src/pool/zion_pool_v2_9.py`):
- Iteruje přes `template_manager.chain_ids`
- Pro každý chain refreshne template
- Porovná s `job_manager.get_current_height(chain_id)`
- Broadcast joby pouze sessionám daného chainu

**Job broadcast**:
- `_broadcast_new_jobs(chain_id: str = "zion")`
- Používá `session_manager.get_sessions_by_chain(chain_id)`

### 5. Protocol Handler Routing

- XMRig login: extrahuje `chain_id` z login params
- Stratum authorize: propaguje `chain_id` do session
- Submit: routuje share validaci na správný chain template
- Block submit: používá `chain_id` z job/session

---

## 📁 Změněné soubory

| Soubor | Typ změny |
|--------|-----------|
| `src/pool/blockchain/__init__.py` | Export `MultiBlockTemplateManager` |
| `src/pool/blockchain/multi_template_manager.py` | **NOVÝ** |
| `src/pool/mining/share_validator.py` | CHv3 server-side hashing |
| `src/pool/mining/job_manager.py` | `chain_id` field, per-chain templates |
| `src/pool/auth/session_manager.py` | `chain_id` field, `get_sessions_by_chain()` |
| `src/pool/network/protocol_handler.py` | Chain routing, XMRig target fix |
| `src/pool/zion_pool_v2_9.py` | Wire multichain, chain-aware loops |
| `tests/test_share_validator.py` | CHv3 regression testy |
| `docs/MULTICHAIN_ARCHITECTURE.md` | **NOVÝ** - dokumentace |

---

## 🧪 Testování

```bash
# CHv3 server-side hash testy
pytest -q tests/test_share_validator.py -k "chv3"
# Result: 2 passed

# Block submission flow
pytest -q tests/test_block_submission_fix.py
# Result: 1 passed

# Docker E2E smoke test (cosmic_harmony_v3 login + submit)
# Result: Share accepted, server-side hash computed
```

---

## 🔧 Technické detaily

### CHv3 Target Handling

```python
# V share_validator.py pro cosmic_harmony_v3:
if len(job_target) == 16:  # XMRig 64-bit LE
    target_bytes = bytes.fromhex(job_target)
    target_64 = int.from_bytes(target_bytes, "little", signed=False)
    target_int = target_64 >> 32  # Scale to 32-bit
```

### Dataclass Field Ordering Fix

Python 3.14 strict mode vyžaduje non-default fields před defaulted:
```python
@dataclass
class MiningJob:
    job_id: str       # required
    algorithm: str    # required
    blob: str         # required
    # ...
    chain_id: str = "zion"  # default - MUST come after required
```

---

## 🚀 Další kroky (TODO)

1. **Multi-RPC Client** - Routing block submitů na správný chain RPC
2. **Config-driven chains** - Načítat chainy z JSON configu
3. **CH v3 hash export** - Napojit na `ch3_hash_submitter` pro merged mining
4. **Per-chain metrics** - Prometheus metriky rozdělené podle chain_id
5. **Production test** - Deploy na testnet a ověřit s reálnými minery

---

## 📊 Metriky session

- **Doba trvání**: ~3 hodiny
- **Nové soubory**: 2
- **Upravené soubory**: 8
- **Nové testy**: 2
- **Řádků kódu**: ~300 přidáno/upraveno

---

*Session dokončena: 20. ledna 2026 06:40 UTC*
