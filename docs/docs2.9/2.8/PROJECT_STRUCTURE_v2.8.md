# ZION 2.8.0 Project Structure

Complete overview of the Zion-2.8 repository structure for clean migration.

---

## 📁 Root Directory

### Core Files
- `zion_universal_pool_v2.py` - **Main Stratum pool server** (port 3333)
- `consciousness_mining_game.py` - Consciousness Mining Game engine
- `new_zion_blockchain.py` - ZION blockchain core
- `blockchain_rpc_client.py` - RPC client for blockchain
- `crypto_utils.py` - Cryptographic utilities
- `zion_p2p_network.py` - P2P networking layer
- `zion_rpc_server.py` - RPC server

### Configuration
- `.env.example` - Environment template
- `.env.production` - Production config
- `.gitignore` - Git ignore rules (cleaned v2.8.0)
- `.dockerignore` - Docker ignore rules
- `requirements.txt` - Python dependencies

### Documentation
- `Readme.md` - **Main README** (updated to 2.8.0)
- `RELEASE_NOTES_v2.8.0.md` - **Release notes**

### Executables
- `zion_cli.py` - CLI interface
- `zion_simple_cli.py` - Simplified CLI
- `zion_smart_cli.py` - Smart contract CLI

### Databases (Production)
- `zion_pool.db` - Pool shares & stats
- `consciousness_game.db` - Consciousness Mining Game state
- `zion_smart_blockchain.db` - Smart contract data
- `zion_unified_blockchain.db` - Unified blockchain state

---

## 📂 Key Directories

### `/ai/` - **AI & Mining Core** ⭐
```
ai/
├── autolykos_v2.py                 # Autolykos v2 GPU engine
├── stratum_client_sync.py          # Stratum client (with anti-duplicate v2.8.0)
├── zion_universal_miner.py         # Universal multi-algo miner
├── pool_stratum_bridge.py          # Pool-blockchain bridge
├── zion_ai_afterburner.py          # AI Afterburner
├── zion_ai_master_orchestrator.py  # AI orchestrator
├── zion_oracle_ai.py               # Oracle AI
├── zion_cosmic_ai.py               # Cosmic AI
├── zion_quantum_ai.py              # Quantum AI
├── zion_gaming_ai.py               # Gaming AI
├── zion_lightning_ai.py            # Lightning Network AI
├── zion_music_ai.py                # Music AI
├── zion_bio_ai.py                  # Bio AI
├── zion_security_monitor.py        # Security Monitor AI
├── zion_trading_bot.py             # Trading Bot AI
├── zion_blockchain_analytics.py    # Analytics AI
├── zion_predictive_maintenance.py  # Predictive Maintenance
├── zion_cosmic_image_analyzer.py   # Image Analyzer
└── README_UNIVERSAL_MINER.md       # Miner documentation
```

### `/zion/` - **Core Blockchain Modules**
```
zion/
├── __init__.py          # Package init (v2.8.0)
├── core/                # Blockchain core
│   └── blockchain.py
├── mining/              # Mining engines
│   └── randomx_engine.py
├── rpc/                 # RPC server
│   └── server.py
├── cli/                 # CLI tools
└── ai/                  # AI integrations
```

### `/docs/` - **Documentation** 📚
```
docs/
├── RELEASE_NOTES.md
├── MAINNET_LAUNCH.md
├── LIGHTNING_NETWORK_INTEGRATION.md
├── ZION_COSMIC_DHARMA_WHITEPAPER_2025.md
├── ZION_GALAXY_ARCHITECTURE.md
├── ZION_GPU_MINING_GUIDE.md
├── MULTI_CHAIN_TECHNICAL_ROADMAP.md
├── RAINBOW_BRIDGE_44_44.md
├── NEW-JERUSALEM-MASTER-PLAN.md
├── LIBERATION-MANIFESTO.md
├── GOLDEN_EGG_GAME/
├── SACRED_TRINITY/
├── WHITEPAPER_2025/
└── CORE/
```

### `/docker/` - **Docker Infrastructure**
```
docker/
├── Dockerfile.zion-cryptonote.minimal
├── docker-compose.production.yml
└── docker-compose.sacred-production.yml
```

### `/scripts/` - **Utility Scripts**
```
scripts/
├── deploy_zion_pool.sh
├── start_zion_27.sh
├── start_mining_now.sh
└── ...
```

### `/tools/` - **Development Tools** ⭐
```
tools/
├── sqlite_retry.py      # NEW in v2.8.0: DB retry wrapper
└── DATABASE_MAINTENANCE.md
```

### `/frontend/` - **Web Dashboard**
```
frontend/
├── README.md
├── COSMIC_INTEGRATION_COMPLETE.md
└── (Next.js app)
```

### `/wallet/` - **Wallet System**
```
wallet/
├── __init__.py
├── zion_wallet.py
└── (wallet components)
```

### `/mining/` - **Mining Utilities**
```
mining/
├── README.md
├── ZION_YESCRYPT_MINER_GUIDE.md
└── ...
```

### `/config/` - **Configuration Files**
```
config/
├── pool_config.json
├── miner_config.json
└── ...
```

---

## 🗂️ Archive Directories (NOT for new repo)

### `/version/` - **Historical Versions**
```
version/
├── 2.7/
├── 2.7.1/
├── 2.7.2/
├── 2.7.3/
├── 2.7.4/
├── 2.7.5/
└── 2.7.5-old-files/
```
**Action:** Exclude from new repo (kept in local archive only)

### Special Folders
- `$RECYCLE.BIN/` - Windows recycle bin (auto-ignored)
- `.Trash-1000/` - Linux trash (auto-ignored)
- `System Volume Information/` - Windows system folder (auto-ignored)

---

## 🎯 Files for NEW Zion-2.8 Repo

### Must Include
1. **Core Code**
   - `/ai/` (complete)
   - `/zion/` (complete)
   - `/tools/` (complete)
   - `zion_universal_pool_v2.py`
   - `consciousness_mining_game.py`
   - `new_zion_blockchain.py`
   - All utility scripts in root

2. **Documentation**
   - `Readme.md` (updated)
   - `RELEASE_NOTES_v2.8.0.md` (new)
   - `/docs/` (complete)

3. **Configuration**
   - `requirements.txt`
   - `.env.example`
   - `.gitignore`
   - `.dockerignore`
   - Docker configs

4. **Infrastructure**
   - `/docker/`
   - `/scripts/`
   - `/config/`

5. **Supporting Dirs**
   - `/frontend/`
   - `/wallet/`
   - `/mining/`
   - `/network/`
   - `/core/`
   - `/api/`

### Exclude
- `/version/` (all historical versions)
- `.Trash-1000/`
- `$RECYCLE.BIN/`
- `System Volume Information/`
- `*.log` files
- `*.db` files (except schema templates)
- `__pycache__/`
- `*.pyc`
- `venv/`

---

## 📋 Migration Checklist

- [x] Version bumped to 2.8.0
- [x] Release notes created
- [x] README updated
- [x] SQLite retry wrapper added
- [x] Anti-duplicate cache added
- [x] Test logs cleaned
- [x] __pycache__ cleaned
- [x] .pyc files cleaned
- [ ] .gitignore verified
- [ ] Dependencies checked
- [ ] Final commit message prepared
- [ ] New GitHub repo created
- [ ] Push to https://github.com/estrelaisabellazion3/Zion-2.8

---

## 🌟 Ad Astra Per Estrella

Version 2.8.0 represents a clean break from legacy versions with:
- Production-ready Stratum infrastructure
- Autolykos v2 GPU mining
- Consciousness-aligned game theory
- Professional documentation

**Total Size (estimated):** ~500MB (without version archives)  
**Core Code:** ~50MB  
**Docs:** ~20MB  
**AI Models/Data:** ~430MB  

---

**Next:** Initialize git, add remote, commit, and push to new repo.
