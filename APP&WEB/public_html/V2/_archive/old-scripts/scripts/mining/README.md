# ⛏️ Mining Scripts & Tools

Skripty pro spuštění, konfiguraci a monitorování mining operací

---

## 📂 Struktura

```
scripts/
├── 2.8/                     # LEGACY scripts z verze 2.8
├── mining/                  # Current mining skripty
└── [ostatní skripty]
```

---

## ⛏️ Mining Scripts (`scripts/mining/`)

### Spouštěcí Skripty
- `start_ai_miner.py` - Spuštění AI mineru
- `start_universal_miner.py` - Spuštění universal mineru (v ai/mining/)

### Utility a Monitoring
- `final_stats.py` - Finální statistiky mining
- `pool_working_backup.py` - Backup pracovního pool

### Testovací Skripty
- `quick_pool_test.py` - Rychlý test pool (v tests/mining/)
- `real_mining_no_sim.py` - Reálný mining test (v tests/mining/)

---

## 🔧 AI Mining Modules (`ai/mining/`)

Přesunuté do logického umístění v `ai/mining/`:

### Miner Implementace
- `zion_universal_miner.py` - Universal miner (všechny algo)
- `zion_yescrypt_optimized.py` - Optimalizovaný Yescrypt
- `zion_yescrypt_real.py` - Native Yescrypt

### Stratum Client
- `stratum_client.py` - Stratum v1 klient
- `stratum_client_sync.py` - Synchronní Stratum klient
- `pool_stratum_bridge.py` - Bridge do Stratum poolu

### Runner
- `start_universal_miner.py` - Start script pro universal miner

---

## 🚀 Příklady Spuštění

### Spuštění AI Mineru
```bash
cd /root  # Na serveru
python3 scripts/mining/start_ai_miner.py --algorithm randomx --wallet YOUR_WALLET
```

### Spuštění Universal Mineru
```bash
python3 ai/mining/start_universal_miner.py --algorithm yescrypt --pool 127.0.0.1:3333 --wallet YOUR_WALLET
```

### Test Mining
```bash
python3 tests/mining/quick_pool_test.py
python3 tests/mining/real_mining_no_sim.py
```

### Monitoring
```bash
python3 scripts/mining/final_stats.py
```

---

## 📊 Algoritmy

Podporované algoritmy v mineru:

- **RandomX** - CPU mining
- **Yescrypt** - CPU optimalizovaný
- **Autolykos v2** - GPU mining
- **KawPow** - GPU mining

---

## 🎯 Konfigurace

### Pool Nastavení
```yaml
Pool Server: 127.0.0.1
Pool Port: 3333
Stratum Version: 1
Timeout: 30s
```

### Miner Nastavení
```yaml
Algorithm: auto (detekce)
Threads: auto (CPU cores)
Difficulty: auto-adjust
Reconnect: 30s
```

---

## 📂 LEGACY Scripts (`scripts/2.8/`)

Staré skripty z verze 2.8:

- `backup_ssh_full.sh` - Full SSH backup
- `setup_yescrypt_miner.sh` - Yescrypt setup
- `xmrig_test.sh` - xmrig test
- atd.

Viz `docs/2.8/INDEX.md` pro detaily.

---

## 🔍 Troubleshooting

### Miner se nepřipojuje
1. Zkontroluj pool běhá na portu 3333
2. Zkontroluj wallet adresu
3. Zkontroluj network connectivity

### Low Hashrate
1. Ověř CPU load
2. Zkontroluj difficulty nastavení
3. Vyzkoušej jiný algoritmus

### Pool Rejection
1. Zkontroluj share validity
2. Ověř Yescrypt/RandomX implementaci
3. Vyzkoušej real_mining_no_sim.py test

---

**Status**: ✅ Organized  
**Location**: /root/scripts/mining  
**Last Updated**: 23. září 2025
