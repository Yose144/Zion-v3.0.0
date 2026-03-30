# 🧹 ZION v2.9 → v2.9.1 CLEANUP STRATEGY

**Datum:** 14. prosince 2025  
**Důvod:** Masivní duplikace kódu, nejasná struktura, nemožné najít JEDINÝ pravdivý zdroj  
**Cíl:** Vytvořit čistou strukturu `Zion-2.9.1/` s jasnou hierarchií

---

## 🔍 FORENSIC AUDIT - CO JSME NAŠLI

### KRITICKÝ PROBLÉM: Masivní duplikace

---

### 1️⃣ BLOCKCHAIN CORE - 5 IMPLEMENTACÍ! 🔴

| Soubor | Velikost | Řádky | Datum | Status |
|--------|----------|-------|-------|--------|
| **src/core/new_zion_blockchain.py** | 174.9 KB | 5,098 | 2025-12-13 | ✅ **MAIN v2.9** |
| core/blockchain.py | 14.9 KB | 369 | 2025-11-27 | ⚠️ **Legacy v2.7.1** |
| core/real_blockchain.py | 38.9 KB | 987 | 2025-11-27 | ❌ **DEPRECATED v2.7.5** |
| zion/core/blockchain.py | 20.0 KB | 538 | 2025-09-16 | ❓ Native C++ wrapper? |
| src/core/simple_blockchain.py | 9.0 KB | 249 | 2025-11-27 | 🧪 **Simplified demo** |

**Analýza:**
- `src/core/new_zion_blockchain.py` = **PRIMARY** (NewZionBlockchain class, 5K LOC)
- `core/real_blockchain.py` = **DEPRECATED** (má warning v kódu!)
- `core/blockchain.py` = **v2.7.1 LEGACY** (čistá RandomX implementace)
- `zion/core/blockchain.py` = **UNKNOWN PURPOSE** (ZionBlockchain, ZionMempool classes)
- `src/core/simple_blockchain.py` = **TESTING/DEMO** (SimpleBlockchain)

**Rozhodnutí:**
```
✅ KEEP: src/core/new_zion_blockchain.py (MAIN)
❌ DELETE: core/real_blockchain.py (deprecated)
❌ DELETE: core/blockchain.py (legacy v2.7.1)
⚠️  AUDIT: zion/core/blockchain.py (může být užitečný?)
✅ KEEP: src/core/simple_blockchain.py (tests/demo)
```

---

### 2️⃣ MINING POOL - 6+ IMPLEMENTACÍ! 🔴

| Soubor | Velikost | Řádky | Datum | Popis |
|--------|----------|-------|-------|-------|
| **src/pool/zion_pool_v2_9.py** | 16.3 KB | 437 | 2025-12-02 | ✅ **Modular v2.9** |
| **zion_native_pool_v2_9.py** | 29.3 KB | 810 | 2025-12-03 | ⚡ **Standalone native** |
| zion/pool/mining_pool.py | 43.6 KB | 1,012 | 2025-09-16 | 🌐 WebSocket pool |
| src/core/zion_universal_pool_v2.py | 75.8 KB | 1,762 | 2025-11-27 | 🎯 Universal orchestrator |
| ai/ai_pool_orchestrator.py | 60.6 KB | 1,492 | 2025-11-27 | 🤖 AI pool manager |
| ai/mining/pool_stratum_bridge.py | 21.7 KB | 531 | 2025-11-20 | 🔌 Stratum integration |

**Analýza:**
- `src/pool/zion_pool_v2_9.py` = **MODULAR ARCHITECTURE** (auth, mining, network layers)
- `zion_native_pool_v2_9.py` = **STANDALONE VERSION** (embedded Stratum, pro testování)
- `src/core/zion_universal_pool_v2.py` = **ORCHESTRATOR** (multi-pool management)
- `ai/ai_pool_orchestrator.py` = **AI-ENHANCED** (ML predictions, auto-switching)
- `zion/pool/mining_pool.py` = **LEGACY?** (WebSocket-based, older architecture)
- `ai/mining/pool_stratum_bridge.py` = **INTEGRATION LAYER** (bridge pattern)

**Rozhodnutí:**
```
✅ KEEP: src/pool/zion_pool_v2_9.py (MAIN implementation)
✅ KEEP: src/core/zion_universal_pool_v2.py (orchestrator)
⚠️  MERGE: zion_native_pool_v2_9.py → merge best features do src/pool/
❓ REVIEW: ai/ai_pool_orchestrator.py (je to používané?)
❌ DELETE?: zion/pool/mining_pool.py (legacy WebSocket)
❌ DELETE?: ai/mining/pool_stratum_bridge.py (redundantní?)
```

---

### 3️⃣ STRATUM CLIENT - 4 VERZE! 🔴

| Soubor | Velikost | Řádky | Datum | Typ |
|--------|----------|-------|-------|-----|
| ai/mining/stratum_client.py | 13.4 KB | 349 | 2025-11-20 | ⚡ Async |
| ai/mining/stratum_client_sync.py | 16.1 KB | 412 | 2025-11-20 | 🔄 Sync |
| **ai/stratum_client_sync.py** | 16.1 KB | 412 | 2025-11-20 | ❌ **DUPLIKÁT!** |
| zion/mining/stratum_client.cpp | 5.1 KB | 142 | 2025-09-16 | 🔧 C++ native |

**Analýza:**
- `ai/stratum_client_sync.py` vs `ai/mining/stratum_client_sync.py` = **100% IDENTICKÉ!**
  - SHA256: 🔴 **STEJNÝ HASH** (potvrzený duplikát)
- `stratum_client.py` (async) vs `stratum_client_sync.py` (sync) = Různé architektury
- `stratum_client.cpp` = Native C++ verze (pro performance)

**Rozhodnutí:**
```
❌ DELETE: ai/stratum_client_sync.py (100% duplikát!)
✅ KEEP: ai/mining/stratum_client_sync.py (sync version)
✅ KEEP: ai/mining/stratum_client.py (async version)
✅ KEEP: zion/mining/stratum_client.cpp (native)
→ MERGE do: src/pool/network/ (sjednotit lokaci)
```

---

### 4️⃣ AI/ SLOŽKA - 60+ SOUBORŮ 🟡

**Struktura:**
```
ai/ (2.5+ MB, 60+ souborů)
├── mining/           # 17 souborů (mining komponenty)
│   ├── stratum_client.py ✅
│   ├── stratum_client_sync.py ✅
│   ├── pool_stratum_bridge.py ⚠️
│   ├── cosmic_harmony_gpu_miner.py ✅
│   ├── cosmic_harmony_zion.dll ✅ (native)
│   ├── librandomx_zion.dll ✅ (native)
│   └── ...
│
├── core/             # 5 souborů (AI core logic)
├── analytics/        # 8 souborů (blockchain analytics)
├── trading/          # 3 soubory (trading bots)
├── data/             # Data storage
├── tests/            # ❌ VLASTNÍ TESTY! (měly by být v tests/)
│
├── ai_orchestrator.py        ✅ Main AI orchestrator
├── ai_pool_orchestrator.py   ⚠️ Pool AI (duplikát?)
├── consciousness_mining_*.py ✅ Consciousness features
├── zion_*_ai.py              🎨 Specialized AIs (music, gaming, quantum...)
├── stratum_client_sync.py    ❌ DUPLIKÁT!
└── ...
```

**Problematické soubory:**
- `ai/stratum_client_sync.py` = **DUPLIKÁT** ai/mining/stratum_client_sync.py
- `ai/tests/` = **Měly by být v tests/ai/**
- `ai/ai_pool_orchestrator.py` = **Redundantní?** (vs src/orchestration/)

**Rozhodnutí:**
```
❌ DELETE: ai/stratum_client_sync.py (duplikát)
🔄 MOVE: ai/tests/ → tests/ai/
⚠️  REVIEW: ai/ai_pool_orchestrator.py (merge do src/orchestration?)
✅ KEEP: ai/mining/*.dll (native libraries)
✅ KEEP: ai/zion_*_ai.py (specialized AI features)
✅ CLEAN: Remove __pycache__, *.pyc
```

---

### 5️⃣ ZION/ SLOŽKA - Paralelní C++/Python? 🟡

**Struktura:**
```
zion/
├── core/          # blockchain.py (20 KB, 538 lines)
├── pool/          # mining_pool.py (43.6 KB, 1,012 lines)
├── mining/        # stratum_client.cpp, autolykos_v2_gpu.py
├── network/       # seed_node.py
├── ai/            # gaming_ai.py, quantum_ai.py, music_ai.py...
├── bridge/
├── rpc/
└── wallet/
```

**Analýza:**
- Vypadá jako **paralelní implementace** Python/C++
- Některé soubory mají ekvivalenty v `src/`, `ai/`, `core/`
- C++ soubory (`stratum_client.cpp`) = native performance
- Python wrappers? Nebo legacy?

**Rozhodnutí:**
```
⚠️  FULL AUDIT NEEDED!
❓ Compare: zion/core/blockchain.py vs src/core/new_zion_blockchain.py
❓ Compare: zion/pool/mining_pool.py vs src/pool/zion_pool_v2_9.py
❓ Compare: zion/ai/*.py vs ai/*.py (duplicity?)
✅ KEEP: zion/mining/stratum_client.cpp (native)
```

---

### 6️⃣ DALŠÍ DUPLIKÁTY

**Miner implementace:**
```
❌ zion/mining/zion-real-miner.py
❌ zion/mining/zion-real-miner-v2.py
❌ zion/mining/zion-cli-test.py
❌ zion/mining/zion-test-pool.py
→ Legacy testing files, DELETE nebo ARCHIVE
```

**Database helpers:**
```
✅ src/database/optimized_db.py (MAIN)
❓ data/pool_working_backup.py (backup?)
❓ scripts/mining/pool_working_backup.py (duplikát?)
```

**Test duplikáty:**
```
❌ ai/tests/ → mělo by být tests/ai/
❌ tests/2.8.2/ → legacy tests, ARCHIVE
❌ tests/helpers/mock_xmrig_pool.py → OK (mock)
```

---

## 📊 SOUHRN DUPLIKACÍ

### Kritické duplikáty (DELETE immediately):
```
❌ ai/stratum_client_sync.py (100% duplikát)
❌ core/real_blockchain.py (deprecated)
❌ core/blockchain.py (legacy v2.7.1)
❌ zion/mining/zion-real-miner*.py (legacy testing)
❌ tests/2.8.2/ (legacy tests)
```

### Vyžadují audit (REVIEW before action):
```
⚠️  zion/ složka (celá - paralelní implementace?)
⚠️  ai/ai_pool_orchestrator.py vs src/orchestration/
⚠️  zion_native_pool_v2_9.py vs src/pool/zion_pool_v2_9.py
⚠️  ai/mining/pool_stratum_bridge.py (je používán?)
```

### Doporučené MERGE:
```
🔄 zion_native_pool_v2_9.py → merge features do src/pool/
🔄 ai/tests/ → tests/ai/
🔄 Stratum clients → consolidate do src/pool/network/
```

---

## 🎯 PRIORITIZACE CLEANUP

### PHASE 1: Quick wins (1 hodina)
```bash
# 1. DELETE 100% duplikáty
rm ai/stratum_client_sync.py
rm core/real_blockchain.py

# 2. ARCHIVE legacy
mkdir docs/legacy_v2.7/
mv core/blockchain.py docs/legacy_v2.7/
mv tests/2.8.2/ docs/legacy_v2.7/tests/

# 3. DELETE legacy testing miners
rm zion/mining/zion-*-test*.py
rm zion/mining/zion-real-miner*.py
```

### PHASE 2: Audit & Decide (2-3 hodiny)
```bash
# 1. Compare zion/ vs src/
#    → Which is newer/better?
#    → Merge or delete?

# 2. Review ai/ai_pool_orchestrator.py
#    → Used in production?
#    → Merge to src/orchestration/?

# 3. Compare pool implementations
#    → src/pool/zion_pool_v2_9.py (modular)
#    → zion_native_pool_v2_9.py (standalone)
#    → Which features to merge?
```

### PHASE 3: Merge & Consolidate (3-4 hodiny)
```bash
# 1. Merge pool features
#    → Take best from both versions

# 2. Consolidate Stratum
#    → All in src/pool/network/

# 3. Move ai/tests/ → tests/ai/

# 4. Clean zion/ folder
#    → Keep only C++ native
#    → Delete Python duplicates
```

---

## 📊 ANALÝZA SLOŽEK (Size & Purpose)

### ✅ KEEP - Důležité složky:

**1. `src/` - Core Source Code** (priorita: KEEP & CLEAN)
```
src/
├── core/              # Blockchain engine (new_zion_blockchain.py)
├── pool/              # Mining pool (zion_pool_v2_9.py)
├── wallet/            # Wallet registry
├── orchestration/     # ML orchestration
├── bridges/           # WARP 2.0 bridges
├── database/          # DB helpers
└── algorithms/        # Hashing algorithms
```
**Status:** ✅ Toto je HLAVNÍ implementace  
**Akce:** Použít jako základ pro 2.9.1

**2. `dao/` - DAO Governance**
```
dao/
├── contracts/         # Solidity smart contracts
├── dashboard/         # Next.js frontend
└── tests/             # DAO tests
```
**Status:** ✅ Standalone, funguje  
**Akce:** Zachovat beze změn

**3. `wallet/` - Wallet System**
```
wallet/
├── zion_wallet_registry.py
├── qr_generator.py
├── wallet_schema.sql
└── tests/
```
**Status:** ✅ Produkční, 91% test pass  
**Akce:** Zachovat

**4. `public_html/` - Presale & Website**
```
public_html/
├── V2/               # Presale frontend
└── api/              # Presale backend (FastAPI)
```
**Status:** ✅ Production ready, čeká na TestNet  
**Akce:** Zachovat

**5. `tests/` - Test Suite**
```
tests/
├── unit/
├── integration/
├── helpers/
└── 2.8.2/ (legacy?)
```
**Status:** ⚠️ BROKEN (pytest-cov missing)  
**Akce:** Fix config, remove duplicates

---

### ⚠️ REVIEW - Duplikáty/Legacy:

**6. `core/` - Legacy blockchain?**
```
core/
├── blockchain.py
├── wallet.py
└── consensus.py
```
**Status:** ⚠️ DUPLICITA `src/core/`?  
**Akce:** SMAZAT nebo MERGE do `src/core/`

**7. `ai/` - AI Components (CHAOS)**
```
ai/ (70+ souborů)
├── mining/ (11 souborů - některé duplikáty!)
├── core/
├── analytics/
├── trading/
└── tests/ (vlastní pytest!)
```
**Status:** 🔴 MASIVNÍ CHAOS  
**Akce:** AUDIT - co je skutečně používáno?

**8. `zion/` - Native C++ wrappers?**
```
zion/
├── core/
├── pool/
├── mining/
├── network/
└── ai/
```
**Status:** ⚠️ Paralelní implementace v C++?  
**Akce:** AUDIT - co je hotové vs skeleton

**9. `build_zion/` - Native Compilation**
```
build_zion/
├── cosmic_harmony/
├── randomx/
├── yescrypt/
└── CMakeLists.txt
```
**Status:** ✅ Native DLLs, important!  
**Akce:** KEEP - GPU mining depends on this

**10. `powerpool/` - ???**
```
powerpool/ (neznámý účel)
```
**Status:** 🔴 NEZNÁMÝ  
**Akce:** AUDIT nebo SMAZAT

---

### ❌ DELETE - Garbage/Legacy:

**11. `reports/` - Staré reporty** (root level)
```
reports/ (duplicita docs/reports/)
```
**Status:** 🔴 DUPLIKÁT  
**Akce:** SMAZAT (máme docs/reports/)

**12. `builds/` - Staré buildy**
```
builds/ (compiled artifacts?)
```
**Status:** 🔴 BUILD ARTIFACTS  
**Akce:** Přidat do .gitignore, smazat

**13. `external/` - External dependencies?**
```
external/ (co je tam?)
```
**Status:** ⚠️ AUDIT  
**Akce:** Zkontrolovat obsah

**14. Legacy soubory v rootu:**
```
❌ consciousness_game.db-shm/wal (testovací DB)
❌ pool_native_test.db
❌ presale_wallet.tar.gz
❌ docs.zip
❌ zion-ai-native-ryzen.tar.gz
```
**Akce:** SMAZAT archives/backups

---

## 🎯 STRATEGIE CLEANUP - PHASE 1

### Krok 1: Vytvoření čisté struktury `Zion-2.9.1/`

```powershell
# Vytvořit novou složku
mkdir "c:\Users\anaha\OneDrive\Plocha\Zion-2.9.1"

# Základní struktura
Zion-2.9.1/
├── src/              # Core source (from Zion-2.9/src/)
├── dao/              # DAO (copy as-is)
├── wallet/           # Wallet (copy as-is)
├── public_html/      # Presale (copy as-is)
├── tests/            # Tests (cleaned)
├── build/            # Native builds (renamed from build_zion/)
├── docker/           # Docker configs
├── deployment/       # Deployment scripts
├── docs/             # Documentation (cleaned)
├── scripts/          # Utility scripts
├── config/           # Configuration files
└── tools/            # Dev tools
```

### Krok 2: AUDIT každé složky v `Zion-2.9/`

**Proces:**
1. **List all files** v složce
2. **Identify duplicates** (shodné názvy/funkce)
3. **Choose ONE source of truth** (nejnovější/nejkompletnější)
4. **Copy to `Zion-2.9.1/`**
5. **Document decision** v `MIGRATION_LOG.md`

### Krok 3: Merge duplicit

**Pravidla:**
- `src/` = PRIMARY source
- Starší implementace v `core/`, `zion/`, `ai/` → MERGE nebo DELETE
- Keep only ONE version každého modulu

---

## 📋 AUDIT CHECKLIST - Složka po složce

### Round 1: Core Components (Priority: CRITICAL)

```markdown
[ ] 1. src/core/ - Blockchain core
    [ ] new_zion_blockchain.py (5,000 LOC) - MAIN
    [ ] Identifikovat závislosti
    [ ] Test coverage check
    [ ] Copy to 2.9.1/src/core/
    
[ ] 2. src/pool/ - Mining pool
    [ ] zion_pool_v2_9.py (437 LOC) - MAIN
    [ ] Porovnat s zion_native_pool_v2_9.py
    [ ] Merge best features
    [ ] Copy to 2.9.1/src/pool/
    
[ ] 3. src/wallet/ - Wallet registry
    [ ] zion_wallet_registry.py
    [ ] QR generator
    [ ] Test results (20/22 pass)
    [ ] Copy to 2.9.1/wallet/
    
[ ] 4. dao/ - DAO governance
    [ ] Smart contracts (Solidity)
    [ ] Dashboard (Next.js)
    [ ] Copy as-is to 2.9.1/dao/
    
[ ] 5. public_html/ - Presale
    [ ] V2/ frontend
    [ ] api/ backend
    [ ] Copy as-is to 2.9.1/public_html/
```

### Round 2: Build & Infrastructure

```markdown
[ ] 6. build_zion/ → build/
    [ ] Native DLLs (cosmic_harmony, randomx, yescrypt)
    [ ] CMakeLists.txt
    [ ] Test compilation
    [ ] Rename & copy to 2.9.1/build/
    
[ ] 7. docker/ - Docker configs
    [ ] docker-compose.yml
    [ ] Dockerfiles
    [ ] Health checks
    [ ] Copy to 2.9.1/docker/
    
[ ] 8. deployment/ - Deployment scripts
    [ ] Production configs
    [ ] SSH deployment
    [ ] Copy to 2.9.1/deployment/
    
[ ] 9. monitoring/ - Monitoring stack
    [ ] Prometheus
    [ ] Grafana
    [ ] Copy to 2.9.1/monitoring/
```

### Round 3: Duplicates Resolution

```markdown
[ ] 10. core/ vs src/core/
    [ ] Compare implementations
    [ ] Choose ONE (likely src/core/)
    [ ] Merge unique features
    [ ] DELETE duplicate
    
[ ] 11. ai/ - AI components
    [ ] List all 70+ souborů
    [ ] Identify used vs unused
    [ ] Merge duplicates (stratum_client!)
    [ ] Clean structure → 2.9.1/src/ai/
    
[ ] 12. zion/ - Native C++ wrappers
    [ ] Audit completeness
    [ ] Compare with src/
    [ ] Merge or DELETE
    
[ ] 13. Root Python files
    [ ] zion_native_miner_v2_9.py → scripts/
    [ ] zion_native_pool_v2_9.py → MERGE to src/pool/?
    [ ] start_native_pool.py → scripts/
```

### Round 4: Tests & Documentation

```markdown
[ ] 14. tests/ - Test suite
    [ ] Remove duplicates (ai/tests/)
    [ ] Fix pytest config (install pytest-cov)
    [ ] Remove legacy (tests/2.8.2/)
    [ ] Organize: unit/, integration/, e2e/
    [ ] Copy to 2.9.1/tests/
    
[ ] 15. docs/ - Documentation
    [ ] Keep structure (reports/, roadmaps/, settings/)
    [ ] Remove duplicates
    [ ] Archive old roadmaps
    [ ] Copy to 2.9.1/docs/
    
[ ] 16. scripts/ - Utility scripts
    [ ] Collect from root & scripts/
    [ ] Organize by purpose
    [ ] Copy to 2.9.1/scripts/
```

### Round 5: Garbage Cleanup

```markdown
[ ] 17. Delete build artifacts
    [ ] builds/ (compiled artifacts)
    [ ] __pycache__/ (Python cache)
    [ ] .pytest_cache/
    [ ] *.pyc, *.pyo
    
[ ] 18. Delete legacy archives
    [ ] docs.zip
    [ ] presale_wallet.tar.gz
    [ ] zion-ai-native-ryzen.tar.gz
    
[ ] 19. Delete test databases
    [ ] consciousness_game.db-*
    [ ] pool_native_test.db
    
[ ] 20. Delete unknown folders
    [ ] powerpool/ (audit first!)
    [ ] reports/ (root level, duplicita)
    [ ] external/ (audit first!)
```

---

## 🗂️ FINAL STRUCTURE - Zion-2.9.1/

```
Zion-2.9.1/
├── 📄 README.md                      # Main README
├── 📄 ROADMAP_REALISTIC_v2.9.md      # Current roadmap
├── 📄 LICENSE                        # MIT license
├── 📄 pyproject.toml                 # Python config
├── 📄 pytest.ini                     # Pytest config (FIXED)
├── 📄 requirements.txt               # Dependencies
├── 📄 docker-compose.yml             # Docker stack
│
├── 📂 src/                           # ⭐ CORE SOURCE CODE
│   ├── core/                         # Blockchain engine
│   │   ├── new_zion_blockchain.py   # Main blockchain (5,000 LOC)
│   │   ├── algorithms.py            # Mining algorithms
│   │   └── zion_rpc_server.py       # RPC server
│   │
│   ├── pool/                         # Mining pool
│   │   ├── zion_pool_v2_9.py        # Universal pool (MERGED)
│   │   ├── auth/                    # Authentication
│   │   ├── mining/                  # Mining logic
│   │   ├── blockchain/              # Blockchain integration
│   │   ├── network/                 # Stratum server
│   │   └── database/                # DB layer
│   │
│   ├── wallet/                       # Wallet registry
│   │   ├── zion_wallet_registry.py
│   │   ├── qr_generator.py
│   │   └── wallet_schema.sql
│   │
│   ├── orchestration/                # ML orchestration
│   │   ├── ml/                      # ML models
│   │   └── ai/                      # AI components (CLEANED)
│   │
│   ├── bridges/                      # WARP 2.0 bridges
│   │   ├── bitcoin_bridge_production.py
│   │   ├── ethereum_bridge_production.py
│   │   └── bridge_router.py
│   │
│   ├── database/                     # Database helpers
│   │   ├── optimized_db.py
│   │   └── cache_manager.py
│   │
│   └── algorithms/                   # Hash algorithms
│       ├── cosmic_harmony.py
│       ├── randomx_wrapper.py
│       └── yescrypt_wrapper.py
│
├── 📂 dao/                           # DAO Governance
│   ├── contracts/                   # Solidity contracts
│   │   ├── ZIONGovernance.sol
│   │   └── ZIONTreasury.sol
│   │
│   └── dashboard/                   # Next.js frontend
│       ├── components/
│       ├── pages/
│       └── package.json
│
├── 📂 wallet/                        # Wallet system
│   ├── zion_wallet_registry.py
│   ├── qr_generator.py
│   ├── wallet_schema.sql
│   └── tests/
│
├── 📂 public_html/                   # Presale & Website
│   ├── V2/                          # Presale frontend
│   │   ├── presale.html
│   │   └── dashboard.html
│   │
│   └── api/                         # FastAPI backend
│       ├── presale/
│       └── stripe_integration.py
│
├── 📂 build/                         # Native compilation
│   ├── cosmic_harmony/              # C++ algo
│   ├── randomx/                     # RandomX C++
│   ├── yescrypt/                    # Yescrypt C
│   └── CMakeLists.txt
│
├── 📂 docker/                        # Docker configs
│   ├── blockchain/                  # Blockchain Dockerfile
│   ├── pool/                        # Pool Dockerfile
│   └── docker-compose.yml
│
├── 📂 deployment/                    # Deployment scripts
│   ├── webglobe/                    # Production deployment
│   ├── systemd/                     # Systemd services
│   └── nginx/                       # Nginx configs
│
├── 📂 monitoring/                    # Monitoring stack
│   ├── prometheus/                  # Prometheus config
│   ├── grafana/                     # Grafana dashboards
│   └── alertmanager/
│
├── 📂 tests/                         # Test suite
│   ├── unit/                        # Unit tests
│   ├── integration/                 # Integration tests
│   ├── e2e/                         # End-to-end tests
│   ├── helpers/                     # Test helpers
│   └── conftest.py                  # Pytest config
│
├── 📂 docs/                          # Documentation
│   ├── roadmaps/                    # Roadmaps
│   │   ├── ROADMAP_REALISTIC_v2.9.md
│   │   └── archive/                # Old roadmaps
│   │
│   ├── reports/                     # Session reports
│   │   ├── session_reports/
│   │   ├── blockchain/
│   │   └── eshop/
│   │
│   ├── deployment/                  # Deployment guides
│   ├── settings/                    # Server settings
│   └── api/                         # API documentation
│
├── 📂 scripts/                       # Utility scripts
│   ├── mining/                      # Mining scripts
│   │   ├── start_miner.py
│   │   └── benchmark.py
│   │
│   ├── deployment/                  # Deployment helpers
│   └── testing/                     # Test runners
│
├── 📂 config/                        # Configuration
│   ├── blockchain.json              # Blockchain config
│   ├── pool.json                    # Pool config
│   └── production.json              # Production settings
│
└── 📂 tools/                         # Dev tools
    ├── debuggers/
    └── profilers/
```

---

## 🚀 EXECUTION PLAN - Krok za krokem

### PHASE 1: Příprava (1 hodina)

```powershell
# 1. Vytvoř novou složku
New-Item -ItemType Directory -Path "c:\Users\anaha\OneDrive\Plocha\Zion-2.9.1"

# 2. Vytvoř základní strukturu
cd Zion-2.9.1
mkdir src, dao, wallet, public_html, build, docker, deployment, monitoring, tests, docs, scripts, config, tools

# 3. Vytvoř MIGRATION_LOG.md pro tracking
New-Item -ItemType File -Path "MIGRATION_LOG.md"
```

### PHASE 2: Core Migration (2-3 hodiny)

```powershell
# Priority 1: src/core/
robocopy "c:\Users\anaha\OneDrive\Plocha\Zion-2.9\src\core" ".\src\core" /E /XD __pycache__

# Priority 2: src/pool/
robocopy "c:\Users\anaha\OneDrive\Plocha\Zion-2.9\src\pool" ".\src\pool" /E /XD __pycache__

# Priority 3: wallet/
robocopy "c:\Users\anaha\OneDrive\Plocha\Zion-2.9\wallet" ".\wallet" /E /XD __pycache__

# Priority 4: dao/
robocopy "c:\Users\anaha\OneDrive\Plocha\Zion-2.9\dao" ".\dao" /E /XD node_modules __pycache__

# Priority 5: public_html/
robocopy "c:\Users\anaha\OneDrive\Plocha\Zion-2.9\public_html" ".\public_html" /E
```

### PHASE 3: Duplicates Resolution (3-4 hodiny)

**Tento krok vyžaduje MANUÁLNÍ AUDIT!**

```markdown
1. Compare src/core/ vs core/ vs zion/core/
2. Compare src/pool/ vs zion_native_pool_v2_9.py vs zion/pool/
3. Resolve ai/ duplicates (stratum_client!)
4. Merge best features
5. Document decisions in MIGRATION_LOG.md
```

### PHASE 4: Tests & Docs (1-2 hodiny)

```powershell
# Tests (cleaned)
robocopy "c:\Users\anaha\OneDrive\Plocha\Zion-2.9\tests" ".\tests" /E /XD __pycache__ .pytest_cache 2.8.2

# Docs (cleaned)
robocopy "c:\Users\anaha\OneDrive\Plocha\Zion-2.9\docs" ".\docs" /E

# Copy main files
Copy-Item "c:\Users\anaha\OneDrive\Plocha\Zion-2.9\README.md" "."
Copy-Item "c:\Users\anaha\OneDrive\Plocha\Zion-2.9\ROADMAP_REALISTIC_v2.9_2025-2027.md" "."
Copy-Item "c:\Users\anaha\OneDrive\Plocha\Zion-2.9\requirements.txt" "."
Copy-Item "c:\Users\anaha\OneDrive\Plocha\Zion-2.9\pytest.ini" "."
Copy-Item "c:\Users\anaha\OneDrive\Plocha\Zion-2.9\docker-compose.yml" "."
```

### PHASE 5: Verification (1 hodina)

```powershell
# Install dependencies
pip install -r requirements.txt
pip install pytest-cov  # FIX missing dependency!

# Run tests
pytest tests/ -v --cov=src

# Check Docker
docker-compose config

# Verify structure
Get-ChildItem -Recurse | Measure-Object
```

---

## ✅ SUCCESS CRITERIA

### Struktura:
- [ ] Žádné duplikáty (každý modul má JEDEN zdroj)
- [ ] Jasná hierarchie (src/ = main, dao/wallet/public_html separate)
- [ ] Clean root (pouze README, ROADMAP, config files)

### Funkcionalita:
- [ ] Tests pass (pytest)
- [ ] Docker compose valid
- [ ] No import errors

### Documentation:
- [ ] MIGRATION_LOG.md complete
- [ ] README updated
- [ ] All decisions documented

---

## 🎯 NEXT STEPS - Po dokončení cleanup

1. **Fix P0 Blockers** (podle ROADMAP)
   - Block submission validation
   - Pytest infrastructure
   
2. **Deploy to Webglobe**
   - Production TestNet
   - Public mining pool
   
3. **Launch Presale**
   - Marketing campaign
   - €1.7M target

---

**Status:** 📋 PŘIPRAVEN KE SPUŠTĚNÍ  
**Estimated Time:** 8-10 hodin (s pečlivým auditem)  
**Owner:** Dev team  
**Start:** NA TVŮJ POKYN! 🚀

---

**JAI RAM - CLEAN CODE, CLEAR MIND!** 🕉️
