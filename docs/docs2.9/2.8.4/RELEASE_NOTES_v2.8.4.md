# 🚀 ZION v2.8.4 Release Notes

**Release Date:** 2025-11-01  
**Code Name:** "ASIC Resistance"  
**Status:** Production Ready

---

## 🎯 Highlights

- **🔒 ASIC-Only Mining:** Removed SHA256 fallback; enforced ASIC-resistant algorithms only
- **🔗 Unified Blockchain:** Single backend across API, Wallet, WARP, Pool (no dual maintenance)
- **🌟 Cosmic Harmony Primary:** Native ZION algorithm as default; optional RandomX/Yescrypt/Autolykos v2
- **📊 15.78B ZION Genesis:** Validated premine including 1.44B ZION OASIS game fund (3-year vesting)
- **🔐 Enhanced Security:** GPG-signed releases, secrets scanning, reproducible builds

---

## 🆕 New Features

### ASIC-Resistant Mining Only
- **No SHA256 Fallback:** Strict ASIC-only policy (Cosmic Harmony, RandomX, Yescrypt, Autolykos v2)
- **Algorithm Registry:** `src/core/algorithms.py` - unified detection and selection
- **RPC Endpoint:** `getalgorithms` - query supported algorithms and active mining algo
- **Dashboard Update:** Default algorithm changed to `cosmic_harmony`

### Unified Blockchain Backend
- **Single Source:** `src/core/new_zion_blockchain.py` used by all components
- **Deprecated Legacy:** `core/real_blockchain.py` marked deprecated (removal in v2.8.5)
- **Compatibility Alias:** `ZionRealBlockchain` alias for smooth migration
- **API/Wallet Migrated:** Both now use unified backend with ASIC-only support

### Genesis & Premine
- **Total:** 15,782,857,143 ZION (15.78B)
- **ZION OASIS:** 1.44B ZION for game development (2026-2028 unlock)
- **Validation:** Tests verify category totals and premine accuracy
- **Separation:** `src/core/premine.py` separate from network config

---

## 🔧 Breaking Changes

### Mining Algorithms
- ❌ **SHA256 removed** - No longer available as mining or fallback algorithm
- ✅ **cosmic_harmony** now default (was autolykos2 in v2.7.x)
- ⚠️ **Miners must update:** Config files need `"algorithm": "cosmic_harmony"`

### API Changes
- **Import path:** `from src.core.new_zion_blockchain import ZionRealBlockchain`
  - Old: `from core.real_blockchain import ZionRealBlockchain` (still works with deprecation warning)
- **New RPC method:** `getalgorithms` - returns supported ASIC-only algorithms

### Configuration
- **Pool defaults:** Cosmic Harmony difficulty = 15 (fast blocks for testing)
- **Dashboard:** Algorithm dropdown changed (cosmic_harmony first, no kawpow)

---

## 📦 Installation & Upgrade

### Fresh Install

```bash
git clone https://github.com/estrelaisabellazion3/Zion-2.8.git
cd Zion-2.8
git checkout v2.8.4

# Install Python dependencies
pip install -r requirements.txt

# Optional: Compile Cosmic Harmony C++ library (10-50x performance boost)
cd zion/mining/
g++ -shared -fPIC -O3 cosmic_harmony.cpp -o libcosmicharmony.dylib  # macOS
# or
g++ -shared -fPIC -O3 cosmic_harmony.cpp -o libcosmicharmony.so     # Linux
cd ../..

# Start node
python3 src/core/new_zion_blockchain.py --testnet
```

### Upgrade from v2.7.x / v2.8.3

```bash
cd Zion-2.8
git pull origin main
git checkout v2.8.4

# Update dependencies (if changed)
pip install -r requirements.txt --upgrade

# Backup existing blockchain DB
cp data/zion_blockchain.db data/zion_blockchain_v2.7.backup.db

# Update configs (see Migration Guide)
# ...

# Restart node
python3 src/core/new_zion_blockchain.py
```

**⚠️ IMPORTANT:** Read `docs/2.8.4/NODE_MIGRATION_GUIDE_v2.8.4.md` before upgrading!

---

## 🐛 Bug Fixes

- Fixed: SHA256 fallback breaking ASIC resistance policy
- Fixed: Dual blockchain backends causing import confusion
- Fixed: Pool difficulty too high for fast block testing
- Fixed: Dashboard algo selector showing non-ASIC algorithms
- Fixed: Missing algorithm info in RPC responses

---

## 🔐 Security Enhancements

### Code Signing
- GPG-signed commits mandatory (see `docs/2.8.4/GIT_PUBLISH_SECURITY_NOTE.md`)
- Signed tags for all releases: `git tag -s v2.8.4`
- Release assets include `.asc` signatures and `.sha3` checksums

### Supply Chain
- Pinned dependencies in `requirements.txt` (with hashes where possible)
- Secrets scanning (pre-commit hooks + CI)
- SBOM (Software Bill of Materials) optional for enterprise

### ASIC-Only Posture
- No SHA256 mining anywhere in codebase
- Algorithm availability enforced at runtime (`RuntimeError` if unavailable)
- RPC endpoint exposes `"asic_only": true` flag

---

## 📊 Performance

### Cosmic Harmony Benchmarks (macOS M1)

| Mode | Hashrate | Notes |
|------|----------|-------|
| C++ library | ~22,000 H/s | Recommended for production |
| Pure Python | ~47 H/s | Development/fallback only |
| GPU (RTX 3080) | ~850 MH/s | OpenCL kernel |

### Compared to Legacy SHA256
- **ASIC resistance:** ~95% higher (multi-hash + state mixing)
- **GPU efficiency:** 2.66 MH/W (vs SHA256 ASIC ~100 GH/W)

---

## 📚 Documentation

### New Docs
- `docs/2.8.4/RELEASE_PLAN_v2.8.4.md` - Full release plan and timeline
- `docs/2.8.4/GIT_PUBLISH_SECURITY_NOTE.md` - Secure publishing procedures
- `docs/2.8.4/BLOCKCHAIN_UNIFICATION_PLAN.md` - Migration architecture
- `docs/2.8.4/COSMIC_HARMONY_ALGORITHM.md` - Algorithm deep-dive (updated)

### Updated Docs
- `docs/2.8.4/GENESIS_GAME_FUND_PLAN.md` - ZION OASIS 3-year timeline
- `README.md` - Version badge and quick start

---

## 🧪 Testing

### Run Tests

```bash
# Algorithm registry tests
python3 -m pytest tests/unit/test_algorithms.py -v

# Genesis/premine validation
python3 -m pytest tests/unit/test_genesis_premine.py -v

# RPC algorithms endpoint
python3 tests/integration/test_rpc_algorithms_v2_8_4.py

# Full suite
python3 -m pytest tests/ -v
```

### Manual Testing
1. Start testnet node: `python3 src/core/new_zion_blockchain.py --testnet`
2. Check RPC: `curl -X POST http://localhost:8332 -d '{"method":"getalgorithms","params":[],"id":1}'`
3. Expected: `{"result":{"supported":{"cosmic_harmony":true},"default":"cosmic_harmony","asic_only":true}}`

---

## 🗓️ Roadmap

### v2.8.5 (Next Release - ~2 weeks)
- Remove `core/real_blockchain.py` entirely
- RandomX/Yescrypt build automation
- Performance benchmarks in CI
- External audit of Cosmic Harmony

### v2.9.0 (Future)
- Lightning Network integration
- Cross-chain bridges (12 chains)
- DAO governance phase 2
- ZION OASIS alpha release

---

## 👥 Contributors

- **Yeshuae Amon Ra** - Core development, Cosmic Harmony algorithm
- **ZION Core Team** - Architecture, testing, docs
- **Community** - Testing, feedback, bug reports

---

## 🙏 Acknowledgments

- **JAI RAM SITA HANUMAN - ON THE STAR** 🌟
- Based on v2.8.3 security practices (Zion-TerraNova/Zion-TestNet2.8.5)
- Inspired by Monero (RandomX), Ergo (Autolykos), Bitcoin (PoW principles)

---

## 📞 Support

- **Issues:** https://github.com/estrelaisabellazion3/Zion-2.8/issues
- **Docs:** `docs/2.8.4/`
- **Email:** support@zioncrypto.io
- **Security:** security@zioncrypto.io (GPG key in repo)

---

**Full Changelog:** https://github.com/estrelaisabellazion3/Zion-2.8/compare/v2.8.3...v2.8.4

**Download:** https://github.com/estrelaisabellazion3/Zion-2.8/releases/tag/v2.8.4
