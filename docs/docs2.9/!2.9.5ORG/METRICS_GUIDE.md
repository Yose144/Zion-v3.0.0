# 📊 ZION Universal Miner v2.9.5 - Metriky a Monitoring

## ✅ Základní Metriky (jako Python verze + více)

### 🔥 Real-Time Display (každých 5 sekund)

```
⚡ Hashrate: | 676.17 kH/s kH/s | Shares: 0 / 0 | Blocks: 0 | Uptime 0:00:05
```

### 📊 Detailní Telemetry Systém

#### 1. **Hashrate Tracking** (3 úrovně průměrů)
- **Current**: Aktuální hashrate (real-time)
- **10s average**: Průměr za posledních 10 sekund
- **1m average**: Průměr za poslední minutu
- **1h average**: Průměr za poslední hodinu

#### 2. **Share Statistics**
- **Submitted**: Celkový počet odeslaných shares
- **Accepted**: Přijaté shares (zelená)
- **Rejected**: Odmítnuté shares (červená)
- **Acceptance rate**: Úspěšnost v % (99%+ je ideální)

#### 3. **Block Tracking**
- **Blocks found**: Počet nalezených bloků
- **Last block time**: Čas posledního nalezeného bloku

#### 4. **System Metrics**
- **Uptime**: Čas běhu ve formátu HH:MM:SS
- **CPU Usage**: Vytížení procesoru v %
- **Memory**: Spotřeba RAM v MB
- **Total Hashes**: Celkový počet vypočítaných hashů

#### 5. **Network Info**
- **Current Difficulty**: Aktuální obtížnost
- **Pool Status**: Stav připojení k poolu
- **Latency**: Ping na pool

#### 6. **Hardware Monitoring** (pokud dostupné)
- **Temperature**: Teplota CPU/GPU v °C
- **Power**: Spotřeba energie ve wattech
- **Fan Speed**: Otáčky ventilátorů v RPM

## 🎨 Barevný Output

Miner používá barevné označení pro lepší čitelnost:

- 🟢 **Zelená**: Accepted shares, úspěchy
- 🔴 **Červená**: Rejected shares, chyby
- 🟡 **Žlutá**: Warnings, důležité info
- 🔵 **Modrá**: Info messages
- 🟣 **Magenta**: Konfigurace, nastavení
- 🟦 **Cyan**: Network, pool info

## 📈 Výstupní Formáty

### Console Output (default)
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Mining Stats (10:15:30)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚡ Hashrate:  676.17 kH/s (current)
              670.23 kH/s (1m avg)
              665.45 kH/s (1h avg)

✅ Shares:    1,234 accepted (99.2%)
❌ Rejected:  10 (0.8%)
🎯 Blocks:    2 found

⏱️  Uptime:   2h 15m 30s
💻 CPU:       45% (4 threads)
🧠 Memory:    48 MB
🌡️  Temp:     65°C

🌐 Pool:      pool.zionterranova.com:3333
📡 Latency:   12ms
⚙️  Diff:     1000
```

### Quiet Mode (--quiet)
```
[12:15:30] 676.17 kH/s | 1234/10 shares | 2 blocks
```

### JSON Output (pro external monitoring)
```json
{
  "timestamp": "2026-01-14T12:15:30Z",
  "hashrate": {
    "current": 676170,
    "avg_1m": 670230,
    "avg_1h": 665450
  },
  "shares": {
    "submitted": 1244,
    "accepted": 1234,
    "rejected": 10,
    "acceptance_rate": 99.2
  },
  "blocks_found": 2,
  "uptime_seconds": 8130,
  "system": {
    "cpu_usage": 45.0,
    "memory_mb": 48,
    "temperature_c": 65.0
  },
  "pool": {
    "url": "pool.zionterranova.com:3333",
    "difficulty": 1000,
    "latency_ms": 12
  }
}
```

## 🔧 Konfigurace Monitoringu

### Log Levels
```bash
# Debug - všechny detaily
--debug

# Info - standardní output (default)
# (žádný flag)

# Quiet - minimální output
--quiet

# Bez barev
--no-color
```

### Update Frequency
Standardně: update každých **5 sekund**

## 📡 Future: Telemetry API (v2.9.6)

Plánované featury:
- HTTP endpoint na portu 8080
- Prometheus metrics export
- Grafana dashboard template
- WebSocket real-time stream
- Web-based dashboard

### API Endpoints (coming soon)
```
GET /api/stats          - Current stats
GET /api/history        - Historical data
GET /api/metrics        - Prometheus format
GET /ws/live            - WebSocket stream
```

## 🆚 Srovnání s Python verzí

| Feature | Python v2.8 | Rust v2.9.5 |
|---------|-------------|-------------|
| **Hashrate display** | ✅ | ✅ |
| **Share tracking** | ✅ | ✅ |
| **Block tracking** | ✅ | ✅ |
| **Uptime counter** | ✅ | ✅ |
| **CPU/Memory stats** | ✅ | ✅ |
| **Hashrate averaging** | ❌ | ✅ (3 úrovně) |
| **Temperature** | ❌ | ✅ |
| **Power usage** | ❌ | ✅ |
| **JSON export** | ❌ | ✅ |
| **Colored output** | ✅ | ✅ |
| **Update frequency** | 10s | 5s |
| **API endpoint** | ❌ | 🔜 v2.9.6 |
| **WebUI** | ❌ | 🔜 v2.9.6 |

## 💡 Použití

### Základní monitoring
```bash
./zion-universal-miner \
  --pool pool.zionterranova.com:3333 \
  --wallet YOUR_ADDRESS \
  --threads 8
```

### Quiet mode (pro scripty)
```bash
./zion-universal-miner \
  --pool pool.zionterranova.com:3333 \
  --wallet YOUR_ADDRESS \
  --quiet
```

### Debug mode
```bash
./zion-universal-miner \
  --pool pool.zionterranova.com:3333 \
  --wallet YOUR_ADDRESS \
  --debug
```

## 🎯 Závěr

**ZION Universal Miner v2.9.5 má LEPŠÍ metriky než Python verze:**

✅ Všechny základní metriky z Python verze  
✅ Plus 3-úrovňové hashrate průměry  
✅ Plus temperature/power monitoring  
✅ Plus připravený telemetry systém  
✅ Plus barevný, přehledný output  
✅ Update každých 5s (místo 10s)  

**A to ještě není WebUI (v2.9.6)!** 🚀
