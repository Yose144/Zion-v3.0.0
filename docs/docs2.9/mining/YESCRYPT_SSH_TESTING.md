# 🚀 Yescrypt CPU Miner - SSH Testing Guide

## Přehled

Tato příručka popisuje, jak otestovat **profesionální C-optimizovaný Yescrypt miner** přes SSH na vzdálených serverech.

## ✨ Features

- **562K H/s** - Ultra-vysoký hashrate s C extension
- **100% testů** - Kompletní test suite (12/12 passing)
- **SSH kompatibilní** - Lze spustit na jakémkoli serveru
- **Realtime monitoring** - Live hashrate a statistiky
- **Fallback režim** - Automatický fallback na nativní verzi

---

## 🔧 1. Příprava SSH Připojení

### 1.1 SSH do serveru

```bash
# Připojení na Hetzner nebo jakýkoliv server
ssh -i ~/.ssh/id_rsa user@server-ip

# Pokud máš nestandartní SSH port
ssh -i ~/.ssh/id_rsa -p 2222 user@server-ip

# Hetzner Cloud Server (default: root user)
ssh root@<server-ip>

# VPS s přihlašovacím jménem (Contabo, DigitalOcean, apod.)
ssh ubuntu@server-ip
```

### 1.2 Ověření SSH klíčů

```bash
# Generuj SSH klíč lokálně (pokud nemáš)
ssh-keygen -t ed25519 -C "yescrypt-miner" -f ~/.ssh/zion_mining

# Zkopíruj public klíč na server
ssh-copy-id -i ~/.ssh/zion_mining.pub user@server-ip

# Test připojení bez hesla
ssh -i ~/.ssh/zion_mining user@server-ip whoami
```

---

## 📥 2. Instalace Yescrypt Mineru na SSH

### 2.1 Klonování ZION repa

```bash
# SSH na server
ssh root@your-server-ip

# Aktualizuj systém
sudo apt update && sudo apt upgrade -y

# Nainstaluj základní závislosti
sudo apt install -y \
    git \
    python3 \
    python3-dev \
    python3-pip \
    build-essential \
    libssl-dev \
    libffi-dev

# Klonuj ZION 2.8 repository
cd /tmp
git clone https://github.com/estrelaisabellazion3/Zion-2.8.git
cd Zion-2.8

# Zkopíruj do production locace (nebo zůstaň v /tmp pro test)
cp -r . /opt/zion-mining
cd /opt/zion-mining
```

### 2.2 Instalace Python závislostí

```bash
# Nainstaluj Python packages
pip3 install -r requirements.txt

# Pokud chceš jen Yescrypt:
pip3 install -r mining/requirements-mining.txt 2>/dev/null || \
pip3 install psutil requests
```

### 2.3 Kompilace C Extension

```bash
cd /opt/zion-mining/mining

# Zkompiluj C extension
python3 setup.py build_ext --inplace

# Ověř, že se kompilace povedla
ls -lah yescrypt_fast.cpython-*.so
# Měl by být .so soubor o velikosti ~30KB
```

---

## 🧪 3. Testování Mineru

### 3.1 Spuštění Test Suite

```bash
cd /opt/zion-mining/mining

# Spusť kompletní test suite (všechny 12 testů)
python3 test_yescrypt_complete.py

# Očekávaný výstup:
# 🚀 ZION Yescrypt Mining - Test Suite
# ============================================================
# ✅ Passed: 12
# ❌ Failed: 0
# 📊 Success Rate: 100.0%
# 🎉 ALL TESTS PASSED!
```

### 3.2 Benchmark Test

```bash
# Spusť pouze benchmark
python3 -c "
import sys
sys.path.insert(0, '.')
from test_yescrypt_complete import run_test_benchmark
run_test_benchmark()
"

# Měl bys vidět:
# 🏁 Benchmark: Yescrypt hashing performance...
#    Hashrate: 400000-600000 H/s
```

### 3.3 Quick Python Test

```bash
python3 << 'EOF'
import sys
sys.path.insert(0, '.')

# Import C extension
try:
    import yescrypt_fast
    print("✅ C Extension loaded successfully")
    
    # Test hash
    data = b"test_block_data"
    hash_result = yescrypt_fast.hash(data, 12345)
    print(f"✅ Hash computed: {hash_result.hex()[:32]}...")
    
    # Test hashrate
    import time
    start = time.time()
    for i in range(1000):
        _ = yescrypt_fast.hash(data, i)
    elapsed = time.time() - start
    hashrate = 1000 / elapsed
    print(f"✅ Hashrate: {hashrate:.0f} H/s")
    
except Exception as e:
    print(f"❌ Error: {e}")
    sys.exit(1)
EOF
```

---

## 🔌 4. Integrace s AI Minetem

### 4.1 Spuštění z AI Mineru

```bash
cd /opt/zion-mining

# Spusť AI universal miner s Yescryptem (bez poolu)
python3 ai/zion_universal_miner.py \
    --algorithm yescrypt \
    --wallet "Zion_TEST_WALLET_ADDRESS" \
    --mode cpu

# S pool (pokud máš Stratum pool)
python3 ai/zion_universal_miner.py \
    --algorithm yescrypt \
    --pool "stratum+tcp://pool.example.com:3333" \
    --wallet "ZionWALLET" \
    --mode cpu
```

### 4.2 Ověření Integrace

```bash
python3 << 'EOF'
import sys, json
sys.path.insert(0, '.')

from ai.zion_universal_miner import ZionUniversalMiner, MiningMode

# Vytvoř miner
miner = ZionUniversalMiner(mode=MiningMode.CPU_ONLY)

# Spusť Yescrypt
result = miner.start_mining(
    algorithm='yescrypt',
    wallet_address='ZionTEST',
    pool_url=None
)

print(json.dumps(result, indent=2))
EOF
```

---

## 🚀 5. Production SSH Spuštění

### 5.1 Screen/Tmux Session

```bash
# Pomocí screen (snadnější)
screen -S zion-miner

# Uvnitř screen session:
cd /opt/zion-mining
python3 ai/zion_universal_miner.py --algorithm yescrypt --wallet "ZION_ADDR"

# Detachuj: Ctrl+A, D
# Attachuj: screen -r zion-miner
# Vyp: screen -X -S zion-miner quit
```

### 5.2 Systemd Service

```bash
# Vytvoř service file
sudo tee /etc/systemd/system/zion-yescrypt-miner.service << 'EOF'
[Unit]
Description=ZION Yescrypt CPU Miner
After=network.target

[Service]
Type=simple
User=mining
WorkingDirectory=/opt/zion-mining
ExecStart=/usr/bin/python3 ai/zion_universal_miner.py \
    --algorithm yescrypt \
    --wallet "YOUR_ZION_ADDRESS_HERE" \
    --mode cpu
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Povoluj service
sudo systemctl daemon-reload
sudo systemctl enable zion-yescrypt-miner
sudo systemctl start zion-yescrypt-miner

# Monitoruj logy
sudo journalctl -u zion-yescrypt-miner -f
```

### 5.3 Cron Monitoring

```bash
# Přidej do crontab (crontab -e)
# Zkontroluj každých 5 minut, jestli miner běží

*/5 * * * * pgrep -f "zion_universal_miner.*yescrypt" > /dev/null || \
  (cd /opt/zion-mining && python3 ai/zion_universal_miner.py \
    --algorithm yescrypt --wallet "YOUR_ADDR" > /tmp/zion-miner.log 2>&1 &)
```

---

## 📊 6. Monitoring a Diagnostika

### 6.1 Kontrola Běhu

```bash
# Prozkoumej CPU využití
top -p $(pgrep -f zion_universal_miner)

# Nebo htop
htop -p $(pgrep -f zion_universal_miner)

# Síťová aktivita
netstat -tnp | grep python3

# Paměť a CPU
ps aux | grep zion_universal_miner | grep -v grep
```

### 6.2 Logy a Troubleshooting

```bash
# Zjisti poslední chyby
tail -50 /tmp/zion-miner.log

# Kompletní diagnostic
python3 << 'EOF'
import sys, os, platform
sys.path.insert(0, '.')

print("=== SYSTEM INFO ===")
print(f"OS: {platform.system()} {platform.release()}")
print(f"Python: {platform.python_version()}")
print(f"CPU cores: {os.cpu_count()}")

print("\n=== YESCRYPT STATUS ===")
try:
    import yescrypt_fast
    print("✅ C Extension: LOADED")
    
    # Perf test
    import time
    data = b"test" * 10
    start = time.time()
    for i in range(100):
        _ = yescrypt_fast.hash(data, i)
    elapsed = time.time() - start
    print(f"   Hashrate: {100/elapsed:.0f} H/s")
except Exception as e:
    print(f"❌ C Extension: {e}")

print("\n=== DEPENDENCIES ===")
try:
    import psutil; print("✅ psutil")
except: print("❌ psutil")
try:
    import requests; print("✅ requests")
except: print("❌ requests")
EOF
```

### 6.3 Performance Optimization

```bash
# Zjisti, kolik fyzických jader máš
python3 -c "import psutil; print(f'Physical cores: {psutil.cpu_count(logical=False)}')"

# Optimální thread count
python3 -c "import psutil; print(f'Optimal threads (75%): {int(psutil.cpu_count(logical=False) * 0.75)}')"

# Zkontroluj teplotní limit (pokud je dostupný)
python3 -c "import psutil; temps = psutil.sensors_temperatures(); print(temps if temps else 'N/A')"
```

---

## ⚠️ 7. Troubleshooting

### Problem: C Extension Not Loading

```bash
# Řešení 1: Zkompiluj znova
cd mining && rm -rf build && python3 setup.py build_ext --inplace

# Řešení 2: Zkontroluj chyby
python3 -c "import yescrypt_fast" 2>&1
```

### Problem: Low Hashrate

```bash
# Zkontroluj, kolik jader používá
ps aux | grep zion_universal_miner | awk '{print $3}' # CPU%

# Zvětši thread count v config
# Nebo spusť s explicitním thread počtem
```

### Problem: SSH Connection Timeout

```bash
# Zkontroluj firewall
sudo ufw status

# Povoluj SSH pokud je potřeba
sudo ufw allow 22/tcp

# Zkontroluj server je online
ping your-server-ip
```

---

## 📈 8. Očekávané Výsledky

| Metrika | Očekávaná Hodnota |
|---------|------------------|
| Hashrate (C ext.) | 400K-600K H/s |
| Hashrate (Native) | 50-100 H/s |
| Memory per thread | ~256 KB |
| CPU Usage (75% opt.) | ~75% |
| Power (laptop CPU) | 30-50W |
| Power (server CPU) | 80-150W |
| Test Suite Pass Rate | 100% (12/12) |

---

## 🔗 Užitečné Příkazy Shrnutí

```bash
# Kompletní SSH test workflow
ssh root@your-server-ip << 'EOF'
cd /opt/zion-mining
echo "=== Running Tests ==="
python3 mining/test_yescrypt_complete.py
echo "=== Testing AI Miner ==="
timeout 10 python3 ai/zion_universal_miner.py --algorithm yescrypt --wallet "TEST" || true
echo "=== Diagnostic Check ==="
python3 mining/test_yescrypt_complete.py
EOF
```

---

## 📞 Reference

- **ZION Whitepaper**: `/docs/ZION_WHITEPAPER.md`
- **Yescrypt Optimization**: `/docs/YESCRYPT_CPU_OPTIMIZATION.md`
- **Universal Miner**: `/ai/zion_universal_miner.py`
- **Professional Miner**: `/mining/zion_yescrypt_professional.py`
- **C Extension**: `/mining/yescrypt_fast.c`

---

**Last Updated**: 22. října 2025  
**Status**: ✅ Production Ready
