# 📦 ZION 2.8 Legacy Archive

**Archivace dat z verzí 2.7.5 - 2.8.0**

---

## 📋 Obsah archívu

### 📖 Dokumentace
- `ZION_2.8_COMPLETE_ROADMAP.md` - Kompletní plán verze 2.8
- `ZION_2.8.0_COMPLETION_SUMMARY.md` - Shrnutí dokončení 2.8.0
- `RELEASE_NOTES_v2.8.0.md` - Poznámky k verzi 2.8.0
- `PROJECT_STRUCTURE_v2.8.md` - Struktura projektu 2.8
- `SSH_UPGRADE_2.8.0_SUCCESS.md` - Zpráva o úspěšném SSH upgradu
- `SSH_TESTING_README.md` - Dokumentace SSH testování
- `GITHUB_RELEASE_INSTRUCTIONS.md` - Pokyny pro GitHub release
- `MANUAL_2.7.5_RESTORE_INSTRUCTIONS.md` - Manuální restore pro 2.7.5
- `WARP_POC_README.md` - Dokumentace WARP POC
- `WARP_POC_TEST_RESULTS.md` - Výsledky testování WARP
- `research_pools.md` - Výzkum poolů

### 🔧 Konfigurace
```
config/2.8/
├── xmrig-production-config.json    (produkční konfigurace)
├── xmrig_config_ssh.json           (SSH konfigurace)
├── zion_gpu_config.txt             (GPU nastavení)
└── zion_hybrid_config.json         (hybrid pool konfigurace)
```

### 🛠️ Skripty
```
scripts/2.8/
├── backup_ssh_full.sh              (Full SSH backup)
├── quick_backup_ssh.sh             (Quick backup)
├── apply_pool_fix.sh               (Pool fix skript)
├── fix_pool_login_job.sh           (Login fix)
├── setup_yescrypt_miner.sh         (Yescrypt setup)
├── ssh_test_yescrypt.sh            (SSH Yescrypt test)
├── restart_pool_standard_port.sh   (Pool restart)
├── start_warp_engine.sh            (WARP engine start)
├── start_macos_local.sh            (macOS local start)
├── start_zion_local.sh             (Local start)
├── xmrig_test.sh                   (xmrig test)
├── test_xmrig_direct.sh            (Direct xmrig test)
└── zion_startup.sh                 (Startup skript)
```

### 📄 Ostatní soubory
- `COMMIT_MESSAGE_v2.8.0.txt` - Commit zpráva
- `requirements.txt` - Python requirements pro 2.8

---

## 🏁 Status

- **Verze 2.8.0**: Kompletní archiv
- **Verze 2.7.5**: Instrukce pro restore
- **Cleanup**: ✅ Hotovo (23. září 2025)
- **Aktuální verze**: **2.8.1 "Estrella"** (v root adresáři)

---

## 📂 Aktuální struktura

```
ZION-2.8-main/
├── docs/
│   ├── 2.8/                    (LEGACY ARCHIVE ← Tahle složka)
│   ├── 2.8.1_deployment_guide.md
│   ├── DEPLOYMENT_2.8.1_ESTRELLA_COMPLETE.md
│   └── ...
├── scripts/
│   ├── 2.8/                    (LEGACY SCRIPTS)
│   └── ...
├── config/
│   ├── 2.8/                    (LEGACY CONFIG)
│   ├── ssh_config.json
│   └── ...
├── [CORE PYTHON FILES - 2.8.1]
│   ├── new_zion_blockchain.py
│   ├── zion_universal_pool_v2.py
│   ├── zion_warp_engine_core.py
│   └── ... (43 core files)
└── [CORE DIRECTORIES]
    ├── ai/
    ├── api/
    ├── frontend/
    ├── lightning/
    └── ...
```

---

## 🎯 Referenční body

### Deployment 2.8.0
- Server: SSH backup z verze 2.8.0 uložen v `backups/`
- Pool: `pool_working_backup.py` v root
- Blockchain: Původní implementace v archívech

### Upgrady na 2.8.1
- Blockchain core: Nový `new_zion_blockchain.py`
- Pool: Vylepšený `zion_universal_pool_v2.py` (bez duplicate shares)
- Consciousness: `consciousness_mining_game.py` (bez DB locking)
- WARP: `zion_warp_engine_core.py` (full integration)

---

## 🚀 Pro migraci

Pokud potřebuješ vrátit se na 2.8.0 konfiguraci:

```bash
# Kopíruj config
cp config/2.8/xmrig-production-config.json ./

# Kopíruj skripty
cp scripts/2.8/*.sh ./

# Čti dokumentaci
cat docs/2.8/ZION_2.8_COMPLETE_ROADMAP.md
```

---

**Archiv vytvořen:** 23. září 2025  
**Status:** 🏛️ Legacy Archive  
**Aktuální produkce:** 2.8.1 "Estrella" (v root + deployment na 91.98.122.165)
