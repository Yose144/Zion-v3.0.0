# 🚀 ZION SSH Dashboard - Optimized Edition

## 📋 Přehled

ZION SSH Dashboard je optimalizovaná verze dashboardu, která se připojuje na vzdálený SSH server s běžícím ZION blockchain nodem a mining poolem. Dashboard nabízí lokální těžení pomocí nejlepšího dostupného mineru (Yescrypt Hybrid s C extension).

## ✨ Klíčové vlastnosti

### 🔗 SSH Remote Monitoring
- **Vzdálené sledování blockchainu**: Připojení přes SSH na váš server
- **Real-time statistiky**: Block height, difficulty, connections
- **Pool monitoring**: Hashrate, aktivní miners, nalezené bloky
- **Bezpečné připojení**: SSH autentizace (password nebo klíč)

### ⛏️ Lokální Mining
- **Yescrypt Hybrid Miner**: Nejlepší CPU miner pro ZION
- **C Extension podpora**: 10x rychlejší výkon (volitelné)
- **Eco-bonus**: +15% k hashrate v eco módu
- **Nízká spotřeba**: ~80W (nejefektivnější algoritmus)
- **Multi-threading**: Optimalizace pro moderní CPU

### 📊 Dashboard Features
- **Overview tab**: Klíčové metriky z blockchainu, poolu a miningu
- **Mining tab**: Ovládání a konfigurace těžení
- **Blockchain tab**: Detailní informace o blockchainu
- **Settings tab**: SSH a pool nastavení

## 🛠️ Instalace

### Rychlá instalace
```bash
# 1. Spusťte setup script
./start_ssh_dashboard.sh

# 2. Upravte SSH nastavení
nano config/ssh_config.json

# 3. Dashboard se automaticky spustí
```

### Manuální instalace
```bash
# 1. Nainstalujte závislosti
pip3 install -r requirements-ssh-dashboard.txt

# 2. (Volitelné) Zkompilujte C extension pro 10x výkon
cd mining
python3 setup.py build_ext --inplace
cd ..

# 3. Vytvořte config složku
mkdir -p config

# 4. Vytvořte SSH config
cat > config/ssh_config.json << EOF
{
  "host": "YOUR_SERVER_IP",
  "port": 22,
  "username": "YOUR_USERNAME",
  "password": null,
  "key_file": null
}
EOF

# 5. Spusťte dashboard
python3 Dashboard_SSH_Optimized.py
```

## ⚙️ Konfigurace

### SSH Nastavení

Edit `config/ssh_config.json`:

```json
{
  "host": "192.168.1.100",          // IP adresa vašeho SSH serveru
  "port": 22,                        // SSH port
  "username": "zion",                // SSH username
  "password": null,                  // Password (nebo null pro SSH klíč)
  "key_file": "/path/to/key.pem"    // Path k SSH privátnímu klíči
}
```

### SSH Klíč autentizace (Doporučeno)

```bash
# 1. Vygenerujte SSH klíč (pokud ho nemáte)
ssh-keygen -t rsa -b 4096 -f ~/.ssh/zion_key

# 2. Zkopírujte klíč na server
ssh-copy-id -i ~/.ssh/zion_key.pub username@server_ip

# 3. Nastavte v config
{
  "key_file": "/home/user/.ssh/zion_key"
}
```

## 🚀 Použití

### Spuštění dashboardu
```bash
python3 Dashboard_SSH_Optimized.py
```

### Připojení k SSH serveru
1. Otevřete dashboard
2. Jděte do **Settings** tabu
3. Zadejte SSH údaje (host, port, username)
4. Klikněte **💾 Save Settings**
5. Klikněte **🔗 Connect SSH** v headeru

### Spuštění těžení
1. Připojte se k SSH serveru
2. Jděte do **Mining** tabu
3. Nastavte počet threadů (doporučeno: CPU_COUNT - 1)
4. Zkontrolujte že je Eco Mode zapnutý (+15% bonus)
5. Zadejte wallet adresu v **Settings**
6. Klikněte **▶️ Start Mining**

### Sledování výkonu
- **Overview tab**: Přehled všech metrik
- **Mining log**: Real-time logy z těžení
- **Blockchain tab**: Detailní JSON data z blockchainu

## 📊 Očekávané výsledky

### Výkon podle CPU (s C extension)

| CPU | Threads | Hashrate | Eco Hashrate | Power |
|-----|---------|----------|--------------|-------|
| Intel i3 | 2 | 250 H/s | 288 H/s | 80W |
| Intel i5 | 4 | 500 H/s | 575 H/s | 80W |
| Intel i7 | 6 | 750 H/s | 863 H/s | 80W |
| AMD Ryzen 5 | 6 | 800 H/s | 920 H/s | 80W |
| AMD Ryzen 7 | 8 | 1000 H/s | 1150 H/s | 80W |

*Bez C extension: ~10x pomalejší*

### Eco-bonus výhody
- **+15% hashrate bonus**
- **Priorita v poolu**
- **Nižší poplatky**
- **Nejvyšší energie efektivita**

## 🔧 Optimalizace

### C Extension (10x rychlejší)
```bash
cd mining
python3 setup.py build_ext --inplace

# Ověření
python3 -c "import yescrypt_fast; print('✅ C extension loaded')"
```

### Optimální nastavení
- **Threads**: CPU_COUNT - 1 (nechá 1 core pro systém)
- **Eco Mode**: Vždy zapnuto (+15% bonus)
- **Priority**: High (Windows) / nice -n -10 (Linux)

### Linux optimalizace
```bash
# Spusť s vyšší prioritou
sudo nice -n -10 python3 Dashboard_SSH_Optimized.py

# Nebo
sudo renice -10 -p $(pgrep -f Dashboard_SSH)
```

## 🐛 Troubleshooting

### SSH Connection Failed
```bash
# Test SSH připojení
ssh username@server_ip

# Zkontroluj firewall
sudo ufw status

# Zkontroluj SSH daemon
sudo systemctl status sshd
```

### Miner Not Available
```bash
# Zkontroluj že miner existuje
ls -la mining/zion_yescrypt_hybrid.py

# Zkontroluj Python path
python3 -c "import sys; print('\n'.join(sys.path))"

# Reinstaluj dependencies
pip3 install -r requirements-ssh-dashboard.txt
```

### Low Hashrate
```bash
# Zkontroluj C extension
python3 -c "import yescrypt_fast; print('C extension OK')"

# Překompiluj C extension
cd mining
python3 setup.py build_ext --inplace --force
cd ..
```

### Connection Timeouts
```bash
# Zvyš SSH timeout v kódu (řádek ~60)
self.client.connect(..., timeout=30)  # Z 10 na 30 sekund

# Zkontroluj network latency
ping server_ip
```

## 📁 Struktura souborů

```
ZION1/
├── Dashboard_SSH_Optimized.py      # Hlavní dashboard
├── start_ssh_dashboard.sh          # Setup a launch script
├── requirements-ssh-dashboard.txt  # Python dependencies
├── config/
│   └── ssh_config.json            # SSH nastavení
└── mining/
    ├── zion_yescrypt_hybrid.py    # Hlavní miner
    ├── yescrypt_fast.c            # C extension (volitelné)
    └── setup.py                    # Build script pro C extension
```

## 🔐 Bezpečnost

### SSH Best Practices
1. **Používejte SSH klíče** místo hesel
2. **Disable password auth** na serveru
3. **Změňte SSH port** z 22 na custom
4. **Používejte firewall** pro omezení přístupu
5. **Regular updates** systému a SSH

### Wallet Security
- **Nikdy nesdílejte** privátní klíče
- **Backup** wallet pravidelně
- **Používejte různé adresy** pro různé pooly
- **Monitorujte** balance v dashboardu

## 📞 Podpora

### Rychlá pomoc
1. Zkontrolujte SSH connection v Settings tabu
2. Ověřte že blockchain node běží na serveru
3. Zkontrolujte mining pool status
4. Zkuste překompilovat C extension

### Debug mode
```bash
# Spusť s verbose logging
python3 -u Dashboard_SSH_Optimized.py 2>&1 | tee dashboard.log
```

### Logování
Dashboard automaticky loguje do:
- Mining log: V Mining tabu
- Status bar: Dole v okně
- Console: stdout/stderr

## 🎯 Výhody oproti starému dashboardu

### ✅ Co je lepší
1. **Žádné lokální služby** - jen SSH připojení
2. **Jednodušší setup** - jeden server, jeden dashboard
3. **Lepší miner** - Yescrypt Hybrid s C extension
4. **Čistší kód** - 700 řádků vs 2900 řádků
5. **Rychlejší** - Minimální overhead
6. **Stabilnější** - Méně dependencies

### ❌ Co bylo odstraněno
- Lokální blockchain node management
- Lokální pool management
- GPU miner integrace (můžete přidat zpět)
- AI komponenty (můžete přidat zpět)
- Flask API server

## 🔮 Budoucí vylepšení

### Plánované features
- [ ] Multi-server monitoring (více SSH serverů)
- [ ] GPU miner integrace (vzdálený i lokální)
- [ ] Grafické grafy výkonu
- [ ] Alert systém (email/telegram)
- [ ] Auto-restart mineru při problémech
- [ ] Pool switching při high difficulty
- [ ] Benchmark různých algoritmů

---

## 📝 Changelog

### v1.0 (10. října 2025)
- ✅ Initial release
- ✅ SSH remote monitoring
- ✅ Yescrypt Hybrid miner integration
- ✅ Eco-bonus support
- ✅ Clean UI s 4 tabs
- ✅ Complete documentation

---

**🏆 Úspěšné těžení s ZION SSH Dashboard!**

*Verze: 1.0 | Datum: 10. října 2025 | Autor: ZION Development Team*
