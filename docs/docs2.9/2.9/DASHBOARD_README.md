# 🎯 ZION Miner Dashboard v2.9

**Real-time webový dashboard pro monitoring ZION native minera**

![Dashboard](https://img.shields.io/badge/Status-Production%20Ready-success)
![Version](https://img.shields.io/badge/Version-2.9-blue)

---

## ✨ Features

### 📊 Real-time Monitoring
- **Live Hashrate** - Aktuální výkon mineru (H/s, KH/s, MH/s)
- **Shares Statistics** - Accepted/Total shares + acceptance rate
- **Block Findings** - Počet nalezených bloků
- **Uptime Tracking** - Čas běhu mineru

### 🧘 Consciousness Mining
- **Level Progress** - Aktuální consciousness level (PHYSICAL → ON_THE_STAR)
- **XP Tracking** - Sledování experience points
- **Multiplier Display** - Consciousness bonus (1.0x - 10.0x)
- **Level-up Notifications** - Real-time upozornění na postup

### 💰 Reward Calculator
- **Block Rewards** - Očekávaná odměna za blok
- **Base + Bonus Breakdown** - 5,400.067 ZION + consciousness bonus
- **Miner Share** - 89% po humanitarian tithe (10%) a pool fee (1%)
- **Daily Estimates** - Odhad denního zisku

### 🔒 Whitelist Status
- **Authorization Check** - Kontrola whitelistu
- **Bonus Availability** - Indikace zda je consciousness bonus aktivní
- **Visual Alerts** - Barevné oznámení autorizace

### 📈 Statistics
- **24h Metrics** - Průměrný hashrate, celkové shares
- **Pool Info** - Height, difficulty, algorithm
- **Connection Status** - Real-time připojení k poolu
- **Activity Log** - Historie událostí (shares, blocks, level-ups)

---

## 🚀 Rychlý Start

### Varianta 1: Standalone Dashboard (Simulace)

Nejjednodušší - prostě otevři HTML soubor v prohlížeči:

```bash
# Windows
start zion_miner_dashboard.html

# Linux/Mac
open zion_miner_dashboard.html
```

**Zobrazí:** Dashboard se simulovanými daty (pro testování UI)

---

### Varianta 2: S Backend Serverem (Doporučeno)

Dashboard s Python backend serverem pro real-time data:

#### 1. Instalace závislostí

```bash
pip install aiohttp
```

#### 2. Spuštění

**Windows:**
```batch
start_dashboard.bat
```

**Linux/Mac:**
```bash
python start_miner_with_dashboard.py
```

#### 3. Otevření dashboardu

Automaticky se otevře v prohlížeči na:
```
http://localhost:8080
```

---

### Varianta 3: Integrace s Minerem

Pro připojení k běžícímu ZION native mineru:

```python
from zion_miner_dashboard_server import MinerDashboard

# Vytvoř dashboard instanci
dashboard = MinerDashboard(port=8080)

# Nastav miner stats
dashboard.update_stat('wallet_address', 'YOUR_WALLET_ADDRESS')
dashboard.update_stat('worker_name', 'your-worker')
dashboard.update_stat('hashrate', 95000)  # v H/s
dashboard.update_stat('shares_accepted', 42)
dashboard.update_stat('shares_total', 45)
dashboard.update_stat('is_whitelisted', True)
dashboard.update_stat('connected', True)

# Spusť server
await dashboard.start()
```

---

## 📡 API Endpoints

Dashboard backend poskytuje REST API:

### GET /stats

Vrací aktuální mining statistiky jako JSON:

```bash
curl http://localhost:8080/stats
```

**Response:**
```json
{
  "hashrate": 95234.5,
  "shares_accepted": 142,
  "shares_total": 150,
  "blocks_found": 2,
  "uptime_seconds": 3600,
  "consciousness_level": "LIQUID",
  "consciousness_multiplier": 1.5,
  "current_xp": 1420,
  "wallet_address": "ZION_SACRED_B0FA7E2A234D8C2F08545F02295C98",
  "pool_url": "localhost:3333",
  "worker_name": "sacred-miner-01",
  "algorithm": "RandomX",
  "blockchain_height": 18,
  "difficulty": 100,
  "is_whitelisted": true,
  "connected": true
}
```

### WebSocket /ws

Real-time updates přes WebSocket:

```javascript
const ws = new WebSocket('ws://localhost:8080/ws');

ws.onmessage = (event) => {
    const stats = JSON.parse(event.data);
    console.log('Hashrate:', stats.hashrate);
};

// Request stats
ws.send(JSON.stringify({ command: 'get_stats' }));
```

---

## 🧩 Soubory

```
zion_miner_dashboard.html          # Frontend (HTML + CSS + JS)
zion_miner_dashboard_server.py     # Backend server (WebSocket + REST API)
start_miner_with_dashboard.py      # Launcher script
start_dashboard.bat                 # Windows launcher
data/miner_stats.json              # Persistent stats (auto-created)
```

---

## 🎨 Dashboard Layout

```
┌─────────────────────────────────────────────────────────────┐
│                 ⚡ ZION MINER DASHBOARD v2.9                │
│                        🟢 ONLINE                             │
├─────────────────────────────────────────────────────────────┤
│  🔒 Whitelist Status: ✅ AUTHORIZED - Consciousness ENABLED │
├──────────────┬──────────────┬──────────────┬────────────────┤
│  ⚡ Hashrate │ ✅ Shares    │ 💎 Blocks    │ ⏱️ Uptime      │
│  95.2 KH/s  │  142/150     │     2        │  01:23:45      │
│  [████████] │  (94.7%)     │  Last: 10m   │                │
├──────────────┴──────────────┴──────────────┴────────────────┤
│  🧘 Consciousness Mining Level                              │
│  LIQUID (1.5x) 🌊                                           │
│  [██████░░░░░░░░░░] 1,420 / 5,000 XP                       │
│                                                              │
│  Levels:                                                     │
│  🌱 PHYSICAL (1.0x)    0 - 1,000 XP                        │
│  🌊 LIQUID (1.5x)      1,000 - 5,000 XP  ← YOU ARE HERE    │
│  🔥 PLASMA (2.5x)      5,000 - 15,000 XP                   │
│  ⚛️ QUANTUM (5.0x)     15,000 - 50,000 XP                  │
│  ⭐ ON_THE_STAR (10x)  50,000+ XP                          │
├──────────────────────────────────────────────────────────────┤
│  💰 Expected Rewards (2025)                                 │
│                                                              │
│  7,754.52 ZION per block 💎                                │
│                                                              │
│  Base:          5,400.07 ZION                               │
│  Consciousness: +2,354.45 ZION (1.5x)                      │
│  ─────────────────────────────                              │
│  Your share:    6,901.52 ZION (89%)                        │
├─────────────┬──────────────┬─────────────────────────────────┤
│ 🏊 Pool     │ 👤 Miner     │ 📊 Statistics (24h)            │
│             │              │                                 │
│ localhost   │ Worker:      │ Avg: 94.5 KH/s                 │
│ Height: 18  │ sacred-01    │ Shares: 1,420                  │
│ Diff: 100   │ Threads: 4   │ Est/Day: 12,500 ZION          │
│ RandomX     │ Session: OK  │ Power: ~50W                    │
└─────────────┴──────────────┴─────────────────────────────────┘
│  📜 Activity Log                                            │
│  [17:45:32] ✅ Share accepted! (+10 XP)                    │
│  [17:45:15] 🌟 LEVEL UP! You reached LIQUID (1.5x)        │
│  [17:44:58] ✅ Share accepted! (+10 XP)                    │
│  [17:43:21] 🎉 BLOCK FOUND! Height 18 - Reward: 6,901 ZION│
└─────────────────────────────────────────────────────────────┘
```

---

## 🔧 Konfigurace

### Port Change

Změna portu dashboardu:

```python
# V start_miner_with_dashboard.py
dashboard = MinerDashboard(port=9090)  # Change from 8080
```

### Stats File Location

Změna umístění stats souboru:

```python
dashboard = MinerDashboard(
    miner_stats_file="custom/path/stats.json",
    port=8080
)
```

### Update Interval

Změna frekvence aktualizace (výchozí 1s):

```python
# V zion_miner_dashboard_server.py, update_stats_loop()
await asyncio.sleep(0.5)  # Update každých 500ms
```

---

## 📊 Consciousness Levels

| Level | Emoji | Multiplier | XP Range |
|-------|-------|------------|----------|
| PHYSICAL | 🌱 | 1.0x | 0 - 1,000 |
| LIQUID | 🌊 | 1.5x | 1,000 - 5,000 |
| PLASMA | 🔥 | 2.5x | 5,000 - 15,000 |
| QUANTUM | ⚛️ | 5.0x | 15,000 - 50,000 |
| ON_THE_STAR | ⭐ | 10.0x | 50,000+ |

**XP Získávání:**
- ✅ Share accepted: +10 XP
- 💎 Block found: +1,000 XP

---

## 🐛 Troubleshooting

### Dashboard se neotevře

```bash
# Zkontroluj že port 8080 není obsazený
netstat -ano | findstr :8080

# Nebo změň port:
python start_miner_with_dashboard.py  # Vyber jinou možnost
```

### Python modul error

```bash
# Reinstalace závislostí
pip install --upgrade aiohttp
```

### Stats se neaktualizují

1. Zkontroluj že backend server běží
2. Zkontroluj konzoli pro chyby
3. Obnov stránku v prohlížeči (F5)

---

## 🌟 Pro vývojáře

### Přidání nové metriky

1. **Backend** (`zion_miner_dashboard_server.py`):
```python
self.stats = {
    # ... existující stats
    "new_metric": 0  # Přidej novou metriku
}
```

2. **Frontend** (`zion_miner_dashboard.html`):
```html
<div class="card">
    <div class="card-title">🆕 New Metric</div>
    <div class="card-value" id="new-metric">0</div>
</div>
```

```javascript
// V updateDashboard()
document.getElementById('new-metric').textContent = state.new_metric;
```

---

## 📝 License

Stejná licence jako ZION projekt (MIT/GPL/Custom)

---

## 🤝 Contributing

Pull requesty vítány! Pro větší změny nejdřív otevři issue.

---

## 💬 Support

- **Issues:** [GitHub Issues](https://github.com/zion-project/issues)
- **Discord:** [ZION Community](https://discord.gg/zion)
- **Docs:** [Full Documentation](https://docs.zion-project.io)

---

**Made with ❤️ for ZION Community** ⚡💎🚀
