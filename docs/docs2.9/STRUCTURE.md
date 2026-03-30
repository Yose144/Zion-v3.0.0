# 📁 ZION v2.9.5 — Struktura projektu (CURRENT vs LEGACY)

**Aktuální vývoj:** v2.9.5 native Rust stack v adresáři `2.9.5/`.  
Repo obsahuje historické stacky (Python/C++/shim) a velké množství reportů; proto je důležité držet se kanonických vstupů.

Kanonický index: [docs/README.md](README.md)

---

## ✅ CURRENT (v2.9.5 native)

```
ZION/
├── 2.9.5/                          # ⭐ CURRENT: native Rust stack
│   ├── zion-native/                # Core + Pool (Rust)
│   ├── zion-universal-miner/        # Miner (Rust)
│   ├── zion-ncl/                   # NCL (Compute Layer)
│   ├── zion-cosmic-harmony-v3/      # CH3 components
│   ├── docs/                       # REAL_STATUS + roadmapy pro 2.9.5
│   ├── docker-compose.native-2.9.5.yml
│   └── deploy-native-2.9.5.sh
│
├── docs/                            # Kanonická dokumentace + meta
│   ├── meta/                        # pravidla, port-matrix, cleanup plan
│   ├── reports/                     # deep analysis / reporty
│   └── roadmaps/                    # readiness, roadmapy
│
├── tests/                           # testy (různé generace)
├── scripts/                         # utility skripty
├── tools/                           # pomocné nástroje
└── (ostatní složky)                 # LEGACY / experimenty / archivy
```

### Nejrychlejší navigace

- Real status v2.9.5: [2.9.5/docs/REAL_STATUS_v2.9.5.md](../2.9.5/docs/REAL_STATUS_v2.9.5.md)
- Porty: [docs/2.9.4/meta/PORT_MATRIX_TESTNET_v2.9.5.md](2.9.4/meta/PORT_MATRIX_TESTNET_v2.9.5.md)
- MainNet gaps: [docs/2.9.4/roadmaps/MAINNET_READINESS_v2.9.5.md](2.9.4/roadmaps/MAINNET_READINESS_v2.9.5.md)

---

## 🧭 LEGACY (historické stacky)

Sem spadá většina mimo `2.9.5/` (např. Python core, starší docker runbooky, staré testnet/mainnet guide).  
Používej jen pro kontext/historii; pro v2.9.5 může obsahovat neplatné porty a návody.
```

### Documentation
```bash
cd /home/zion/ZION/2.8.3/docs        # Main docs
cd /home/zion/ZION/2.8.3/docs/phases # Phase reports
```

### Deployment
```bash
cd /home/zion/ZION/2.8.3/deployment  # Deployment scripts
```

### Configuration
```bash
cd /home/zion/ZION/docker            # Docker configs
cd /home/zion/ZION/scripts           # Utility scripts
```

---

## 🧹 Cleanup History

**Date:** October 30, 2025

**Changes Made:**
1. ✅ Moved phase reports to `2.8.3/docs/phases/`
2. ✅ Archived old 2.8.2 files to `archive/2.8.2/`
3. ✅ Moved logs to `logs/` directory
4. ✅ Moved databases to `data/databases/`
5. ✅ Moved test artifacts to `tests/artifacts/`
6. ✅ Moved mining tools to `tools/mining/`
7. ✅ Archived old builds to `archive/old_builds/`
8. ✅ Consolidated Docker files in `docker/`
9. ✅ Moved scripts to `scripts/` directory
10. ✅ Removed duplicate README.md (kept Readme.md)

**Result:** Clean, organized root directory with logical structure.

---

## 🔐 Security Notes

### Gitignored Directories
The following directories are automatically ignored by git:
- `logs/` - Contains runtime logs
- `tests/artifacts/` - Test coverage and cache
- `archive/` - Old files and builds
- `data/databases/` - Database files
- `venv_testing/` - Python virtual environment
- `*.db` - All database files
- `*.log` - All log files

### Private Files
Never commit:
- Database files (`.db`, `.sqlite`)
- Log files (`.log`)
- Coverage reports (`coverage.xml`, `.coverage`)
- Test artifacts (`htmlcov/`, `.pytest_cache/`)
- Build artifacts (`dist/`, `build/`)

---

## 📚 Additional Resources

- **Main README:** [Readme.md](Readme.md)
- **Roadmap:** [ROADMAP.md](ROADMAP.md)
- **Quick Start:** [2.8.3/docs/QUICK_START.md](2.8.3/docs/QUICK_START.md)
- **API Reference:** [2.8.3/docs/API_REFERENCE.md](2.8.3/docs/API_REFERENCE.md)
- **Deployment:** [2.8.3/deployment/README.md](2.8.3/deployment/README.md)

---

**🙏 JAI RAM SITA HANUMAN - ORGANIZED FOR COSMIC HARMONY! ⭐**

*Generated: October 30, 2025*  
*ZION 2.8.3 - Production-Ready Blockchain*
