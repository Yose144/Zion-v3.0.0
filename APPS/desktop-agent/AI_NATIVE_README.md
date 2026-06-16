# AI Native Integration - Desktop Agent

## ✨ Co bylo přidáno

Desktop agent nyní podporuje **AI Native consciousness mining** jako volitelnou funkci.

### Nové soubory
- `resources/ai_native_bridge.py` - Python bridge mezi Electronem a AI Native systémem (200+ řádků)

### Změny v existujících souborech

#### src/main.js
- **Globální proměnné** (řádek ~241):
  - `aiNativeProc`, `aiNativeReady`, `aiNativeStdoutBuf`, `aiNativeQueue`, `aiNativeReqId`
  
- **Config options** (řádek ~515):
  - `aiNative: false` (OFF by default)
  - `aiNativePoolUrl: 'http://localhost:8001'`
  - `aiNativeConsciousness: 1` (úroveň vědomí 1-10)

- **Service funkce** (řádek ~1517):
  - `ensureAiNativeServiceRunning()` - spouští Python bridge
  - `aiNativeSend(payload)` - posílá JSON příkazy
  - `stopAiNativeService()` - ukončuje service

- **IPC handlers** (řádek ~2125):
  - `ai-native-start` - spustí consciousness mining
  - `ai-native-stop` - zastaví mining
  - `ai-native-stats` - získá statistiky
  - `ai-native-status` - zjistí aktuální stav

- **Startup integrace** (řádek ~791):
  - Automaticky startuje při `config.aiNative === true`
  
- **Cleanup** (řádek ~2619):
  - Ukončí service při zavření aplikace

#### src/preload.js
- Přidány API metody pro renderer:
  - `aiNativeStart(config)`
  - `aiNativeStop()`
  - `aiNativeStats()`
  - `aiNativeStatus()`

## 🚀 Jak používat

### 1. Povolit AI Native v konfiguraci

```javascript
{
  "aiNative": true,                           // Zapnout (default: false)
  "aiNativePoolUrl": "http://localhost:8001", // API endpoint
  "aiNativeConsciousness": 5,                 // Úroveň vědomí (1-10)
  "wallet": "ZION_YOUR_ADDRESS",
  "gpu": false,
  "threads": 4
}
```

### 2. Programatické ovládání

```javascript
// Start consciousness mining
const result = await window.electronAPI.aiNativeStart({
  wallet: 'ZION_ADDR',
  aiNativePoolUrl: 'http://localhost:8001',
  aiNativeConsciousness: 3,
  gpu: false,
  threads: 4
});

// Get stats
const stats = await window.electronAPI.aiNativeStats();
console.log(stats);

// Stop
await window.electronAPI.aiNativeStop();
```

### 3. Spuštění desktop agenta

```bash
cd desktop-agent
npm install
npm start
```

## 🏗️ Architektura

```
Desktop Agent (Electron)
    ↕ IPC (JSON-lines)
AI Native Bridge (Python)
    ↕ HTTP
AI Native API (FastAPI)
    ↕
AI Task Handler + Orchestrator
```

### Komunikační protokol

Bridge používá JSON-lines přes stdin/stdout (stejný pattern jako Afterburner):

```json
// Příkazy do bridge
{"cmd": "start", "config": {...}}
{"cmd": "stop"}
{"cmd": "stats"}
{"cmd": "status"}

// Odpovědi z bridge
{"ready": true}
{"result": {...}}
{"error": "..."}
{"stats": {...}}
```

## 🧪 Testing

```bash
# Rychlý test integrace
node test_ai_native_integration.js

# Manuální test bridge
cd resources
python3 ai_native_bridge.py

# Pošli test příkaz (v jiném terminálu)
echo '{"cmd":"status"}' | python3 ai_native_bridge.py
```

## ⚙️ Konfigurace

AI Native je **OFF by default** - musí být explicitně povolen v nastavení. To zajišťuje:
- Žádný konflikt s existujícím minerem
- Žádné nechtěné spuštění
- Uživatel musí vědomě aktivovat

### Default hodnoty
```javascript
aiNative: false                       // Vypnuto
aiNativePoolUrl: 'http://localhost:8001'
aiNativeConsciousness: 1              // Minimální level
```

## 🔧 Troubleshooting

### Bridge se nespustí
```bash
# Zkontroluj Python dependencies
cd /Users/yeshuae/Desktop/ZION/Zion-2.9-main
pip3 install -r requirements.txt

# Test bridge samostatně
cd desktop-agent/resources
python3 ai_native_bridge.py
```

### API není dostupné
```bash
# Spusť FastAPI server
cd /Users/yeshuae/Desktop/ZION/Zion-2.9-main
python3 -m src.api.ai_native_api

# Nebo přes Docker
docker-compose -f docker-compose-v2.9-production.yml up -d api
```

### Debug logy
```javascript
// V main.js jsou console.log() výstupy
// Bridge má vlastní logging do stderr
// Sleduj terminál kde běží desktop agent
```

## 📝 Implementace detaily

### Proč JSON-lines?
- Jednoduchá komunikace přes pipes
- Žádné externí dependencies
- Stejný pattern jako Afterburner (konzistence)
- Easy debugging (každá řádka = 1 zpráva)

### Proč OFF by default?
- Bezpečnost - uživatel má kontrolu
- Stabilita - neruší existující mining
- Jasnost - vědomá aktivace

### Proč samostatný proces?
- Izolace - pádu bridge nezhroutí Electron
- Asynchronita - neblokuje UI
- Flexibilita - lze restartovat nezávisle

## 🎯 Co dál?

- [ ] UI controls v settings panelu
- [ ] Real-time stats display
- [ ] Consciousness level vizualizace
- [ ] Integration testing
- [ ] Production deployment

## 📚 Související dokumentace

- [AI Native API Guide](../docs/AI_NATIVE_INTEGRATION_GUIDE.md)
- [AI Native Beginner Guide](../docs/AI_NATIVE_BEGINNER_GUIDE.md)
- [Desktop Agent Original README](./README.md)

---

**Status**: ✅ Core integration complete  
**Test results**: 8/10 checks pass + 4/4 API exposed  
**Ready for**: UI development + testing
