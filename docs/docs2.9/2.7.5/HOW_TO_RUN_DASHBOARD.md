# 🚀 ZION Matrix SSH Dashboard - Jak spustit

## ✅ SSH Server je připravený!

```bash
✅ SSH: root@91.98.122.165:22 - ONLINE
✅ zion_unified.py - RUNNING  
✅ Block height: 16+
✅ Pool: Active with shares
```

## 📋 Jak spustit Dashboard

### 1. **Test SSH připojení** (volitelné)
```bash
python3 test_ssh_connection.py
```
Měl by ukázat:
```
✅ SSH Connected!
✅ Block height: 16
✅ zion_unified.py is running
```

### 2. **Spusť Dashboard**
```bash
python3 Dashboard_SSH_Optimized.py
```

### 3. **Co uvidíš:**

```
╔══════════════════════════════════════════════════════════════╗
║  🔷     ⚡ Z I O N  M A T R I X  S S H ⚡                   ║
║ LOGO    > Wake up, Neo... The blockchain is on SSH...      ║
║         [ REMOTE • 91.98.122.165 • YESCRYPT MINING ]       ║
╠══════════════════════════════════════════════════════════════╣
║ [REFRESH] [SSH STATUS] [START MINING] [STOP MINING]        ║
║                                   [ SSH: 91.98.122.165 ]    ║
╠══════════════════════════════════════════════════════════════╣
║  ╭───────────────╮  ╭───────────────╮  ╭───────────────╮   ║
║  │ SSH STATUS    │  │ BLOCK HEIGHT  │  │ LOCAL HASHRATE│   ║
║  │ ✅ CONNECTED  │  │  16           │  │  0.00 H/s     │   ║
║  ╰───────────────╯  ╰───────────────╯  ╰───────────────╯   ║
║                                                              ║
║  ╭───────────────╮                                          ║
║  │ POOL HASHRATE │                                          ║
║  │  5.2K H/s     │                                          ║
║  ╰───────────────╯                                          ║
╠══════════════════════════════════════════════════════════════╣
║  📊 Overview │ ⛏️ Mining │ 🔗 Blockchain │ ⚙️ Settings    ║
║ ┌────────────────────────────────────────────────────────┐ ║
║ │                                                        │ ║
║ │  [Tab s real-time daty ze serveru]                    │ ║
║ │                                                        │ ║
║ └────────────────────────────────────────────────────────┘ ║
╠══════════════════════════════════════════════════════════════╣
║ [03:10:15] ✅ SSH connected                                 ║
╚══════════════════════════════════════════════════════════════╝
```

## 🎯 Co Dashboard dělá:

### 📊 **Quick Stats Cards** (aktualizace každých 5s)
- ✅ **SSH STATUS** - Zelené ✅ když connected, červené ❌ když failed
- 📦 **BLOCK HEIGHT** - Aktuální výška blockchainu ze serveru
- ⛏️ **LOCAL HASHRATE** - Tvůj lokální mining (když běží)
- 🌊 **POOL HASHRATE** - Celkový hashrate poolu ze serveru

### 🔗 **SSH Connection**
- Auto-connects při startu
- Background thread - neblokuje UI
- Zobrazuje chyby pokud selže
- Retry button v "SSH STATUS"

### ⛏️ **Local Mining**
- Klik na [START MINING] → spustí Yescrypt miner
- 11 threads, 80W, eco mode
- Real-time hashrate v quick stats
- Připojuje se na pool 91.98.122.165:3333

### 📈 **Tabs**
1. **Overview** - Přehled všech metrik
2. **Mining** - Kontrola lokálního miningu
3. **Blockchain** - Raw blockchain data z SSH
4. **Settings** - SSH konfigurace

## 🔧 **Troubleshooting**

### Dashboard se nespustí
```bash
# Zkontroluj syntax
python3 -m py_compile Dashboard_SSH_Optimized.py

# Zkontroluj dependencies
pip3 install paramiko pillow psutil
```

### SSH neukazuje data
```bash
# Test SSH manuálně
ssh root@91.98.122.165

# Test přes python script
python3 test_ssh_connection.py
```

### Quick stats zůstávají na "0"
- Počkej 5-10 sekund (první update)
- Zkontroluj SSH status card - musí být ✅ CONNECTED
- Klikni [REFRESH] pro manuální update

### Mining se nespustí
```bash
# Zkontroluj že existuje miner
ls -la mining/zion_yescrypt_hybrid.py

# Zkontroluj dependencies
pip3 install hashlib
```

## 🎨 **Přidání Loga**

```bash
# 1. Ulož tvoje hexagon logo
cp /path/to/your/logo.png assets/zion_logo.png

# 2. Restart dashboard
python3 Dashboard_SSH_Optimized.py
```

Logo se objeví v levém horním rohu vedle titulku!

## 📊 **Co uvidíš v každém tabu:**

### 📊 Overview Tab
```
🔗 Blockchain Status (Remote)
   Block Height: 16
   Difficulty: 1500
   Connections: 3

⛏️ Mining Status (Local)  
   Hashrate: 0 H/s (když není aktivní)
   Shares: 0
   Eco Shares: 0

🌊 Pool Status (Remote)
   Pool Hashrate: 5.2K H/s
   Active Miners: 1
   Blocks Found: 16
```

### ⛏️ Mining Tab
```
💚 Local Yescrypt Mining

Status: [⚫ INACTIVE] nebo [🟢 ACTIVE]
Hashrate: 0.00 H/s
Threads: 11
Power: 80W
Eco Mode: ✅ Enabled (+15%)

[▶️ Start Mining]  [⏹️ Stop Mining]

⚙️ Settings
CPU Threads: [11] (1-16)
Pool: 91.98.122.165:3333
```

### 🔗 Blockchain Tab
```json
{
  "height": 16,
  "difficulty": 1500,
  "connections": 3,
  "last_block": "00252ac83dd5504d...",
  "timestamp": "2025-10-09 23:58:13"
}
```

### ⚙️ Settings Tab
```
SSH Configuration

Host: [91.98.122.165]
Port: [22]
Username: [root]
Password: [••••••••]

[💾 Save]  [🔗 Test Connection]
```

## ✨ **Features v Dashboard:**

- ✅ Matrix cyberpunk design
- ✅ Zakulacené rohy s neon glow
- ✅ Auto SSH reconnect
- ✅ Real-time data každých 5s
- ✅ Background updates (neblokuje UI)
- ✅ Error handling s user-friendly hláškami
- ✅ Hashrate formatting (H/s, KH/s, MH/s)
- ✅ Mining log s timestamps
- ✅ Status bar s real-time messages

## 🚀 **Ready to Launch!**

```bash
# Jednoduchý příkaz:
python3 Dashboard_SSH_Optimized.py

# Máš krásný Matrix dashboard připojený na SSH! 🎉
```

**Vše funguje! SSH test prošel! Enjoy your Matrix dashboard! ✨🔷**
