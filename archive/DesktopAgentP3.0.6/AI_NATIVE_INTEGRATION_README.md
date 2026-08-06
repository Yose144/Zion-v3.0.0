# 🌟 ZION Desktop Agent - AI Native Integration

Desktop Agent je nyní plně integrován s **AI Native Server** běžícím na aktuálním primárním hostu Zion2 (91.98.122.165:8001).

---

## 📊 Co je hotovo

### ✅ AI Native Client (`resources/ai_native_client.py`)
Python klient pro komunikaci s AI Native Server přes HTTP API.

**Funkce:**
- ✅ **Knowledge Search** - Vyhledávání v 796 dokumentech
- ✅ **AI Chat** - Konverzace s CodeLlama 7B + context
- ✅ **Memory System** - Ukládání a vyhledávání konverzací (ChromaDB)
- ✅ **Self-Learning** - Analýza logů, pattern recognition
- ✅ **Blockchain Monitoring** - Real-time blockchain status
- ✅ **Pool Monitoring** - Current public host + internal service visibility
- ✅ **System Health** - Comprehensive health checks
- ✅ **Dashboard Data** - All-in-one endpoint

### ✅ Main Process Integration (`src/main.js`)
Desktop Agent main process nyní používá `ai_native_client.py` místo původního `ai_native_bridge.py`.

**Změny:**
- ✅ Updated path: `ai_native_client.py` 
- ✅ JSON-lines communication (stdin/stdout)
- ✅ Ready detection: `status: "ready"` message
- ✅ Error handling pro network issues

### ✅ IPC Handlers (8 nových metod)
```javascript
// Original
ipcMain.handle('ai-native-start', ...)
ipcMain.handle('ai-native-stop', ...)
ipcMain.handle('ai-native-stats', ...)
ipcMain.handle('ai-native-status', ...)

// NEW - AI Native API operations
ipcMain.handle('ai-native-chat', ...)              // AI conversation
ipcMain.handle('ai-native-search-knowledge', ...)  // Knowledge base search
ipcMain.handle('ai-native-ask', ...)               // Quick AI Q&A
ipcMain.handle('ai-native-dashboard', ...)         // Dashboard data
ipcMain.handle('ai-native-blockchain-status', ...) // Blockchain info
ipcMain.handle('ai-native-pool-monitor', ...)      // Pool monitoring
ipcMain.handle('ai-native-system-health', ...)     // Health check
```

### ✅ Preload API (`src/preload.js`)
Renderer process má přístup k novým AI Native metodám:

```javascript
window.electronAPI.aiNativeChat(messages)
window.electronAPI.aiNativeSearchKnowledge(query, limit)
window.electronAPI.aiNativeAsk(question)
window.electronAPI.aiNativeDashboard()
window.electronAPI.aiNativeBlockchainStatus()
window.electronAPI.aiNativePoolMonitor()
window.electronAPI.aiNativeSystemHealth()
```

---

## 🚀 Použití

### 1. Z Python kódu (direct)
```python
from resources.ai_native_client import AINativeClient

client = AINativeClient("http://localhost:8001")
await client.connect()

# Knowledge search
results = await client.search_knowledge("mining pool")

# AI Chat
response = await client.chat([
    {"role": "user", "content": "How do I mine ZION?"}
])

# Dashboard
dashboard = await client.get_dashboard_data()
```

### 2. Z Desktop Agent UI (JavaScript)
```javascript
// Chat with AI
const response = await window.electronAPI.aiNativeChat([
    {role: "user", content: "What is consciousness mining?"}
]);

// Search knowledge
const docs = await window.electronAPI.aiNativeSearchKnowledge("pool config", 5);

// Get system health
const health = await window.electronAPI.aiNativeSystemHealth();
```

### 3. Z Main Process (Electron)
```javascript
// In main.js
const chatResult = await aiNativeSend({
    cmd: 'chat',
    messages: [{role: "user", content: "Hello"}]
});

const dashboard = await aiNativeSend({
    cmd: 'dashboard'
});
```

---

## 🔗 Connection Modes

### Mode 1: SSH Tunnel (DOPORUČENO)
Pro development/testing z lokalu:

```bash
# Vytvoř SSH tunel
ssh -i ~/.ssh/zion_hetzner_key -L 8001:localhost:8001 root@91.98.122.165 -N -f

# Připoj se přes localhost
client = AINativeClient("http://localhost:8001")
```

**Výhody:**
- ✅ Bezpečné (šifrované SSH)
- ✅ Funguje i bez otevřeného firewallu
- ✅ Žádná extra konfigurace serveru

### Mode 2: Direct Connection
Pro produkci (vyžaduje otevřený firewall):

```python
client = AINativeClient("http://91.98.122.165:8001")
```

**Poznámka:** Pokud není port 8001 dostupný přímo zvenku, použij SSH tunel nebo reverzní proxy.

---

## 🧪 Testing

### Quick Test
```bash
cd desktop-agent

# S aktivním SSH tunelem:
python3 test_ai_native_client.py
```

**Očekávaný output:**
```
✅ PASS: Connected to Enhanced AI Knowledge Server
✅ PASS: Found 5 documents
✅ PASS: Memory stats retrieved (4 conversations, 2 learnings)
✅ PASS: Health score 100/100
✅ PASS: Blockchain height 5
✅ PASS: 1/1 public hosts online
✅ PASS: Dashboard data retrieved
✅ PASS: AI responded
✅ Stats: 12 queries, 0 errors, 0.00% error rate
```

### Integration Test
```bash
cd desktop-agent
node test_ai_native_integration.js
```

---

## 📡 AI Native Server Endpoints

### Base URL
- **Zion2**: `http://91.98.122.165:8001`
- **Localhost**: `http://localhost:8001` (with tunnel)

### Available Endpoints

#### 📚 Knowledge Base
```
GET  /health
GET  /knowledge/search?q=query&limit=5&category=docs
GET  /knowledge/stats
GET  /knowledge/categories
GET  /knowledge/recent?limit=10
```

#### 🤖 AI Chat
```
POST /ai/ask
     {"question": "...", "use_knowledge": true, "context_limit": 3}

POST /ai/ask_with_memory
     {"question": "...", "use_knowledge": true, "use_memory": true}
```

#### 🧠 Memory System
```
POST /memory/add
     {"user_message": "...", "ai_response": "...", "tags": [], "context": {}}

GET  /memory/search?q=query&limit=5
GET  /memory/context?q=query
GET  /memory/stats
```

#### 🎓 Self-Learning
```
POST /learning/analyze_log
     {"log_path": "/path/to/log", "category": "pool"}

GET  /learning/insights?limit=10
POST /learning/health_analysis
GET  /learning/summary
```

#### ⛓️ Monitoring
```
GET  /blockchain/status
GET  /blockchain/health
GET  /pool/monitor
GET  /system/health
```

---

## 🔧 Troubleshooting

### Connection Timeout
```python
# Error: Connection timeout
```

**Fix:**
1. Ověř že AI Native Server běží:
   ```bash
    ssh root@91.98.122.165 "ps aux | grep enhanced_knowledge_server"
   ```

2. Vytvoř SSH tunel:
   ```bash
    ssh -i ~/.ssh/zion_hetzner_key -L 8001:localhost:8001 root@91.98.122.165 -N -f
   ```

3. Test:
   ```bash
    curl http://localhost:8001/health
   ```

### AI Response Timeout
```json
{"answer": "AI response timeout"}
```

**Příčina:** CodeLlama 7B model je pomalý (25s timeout).

**Fix:** Používej jednodušší dotazy nebo zvyš timeout v `enhanced_knowledge_server.py`.

### Process Already Running
```
Error: AI Native service startup timed out
```

**Fix:**
```bash
# Kill old process
ps aux | grep ai_native_client | grep -v grep | awk '{print $2}' | xargs kill

# Restart Desktop Agent
```

---

## 📊 Current Status

| Component | Status | Details |
|-----------|--------|---------|
| AI Native Server | ✅ RUNNING | Zion2 primary host, port 8001 |
| Knowledge Base | ✅ ACTIVE | 796 documents indexed |
| Memory System | ✅ ACTIVE | 4 conversations, 2 learnings |
| Self-Learning | ✅ ACTIVE | Pattern recognition operational |
| Blockchain Monitor | ✅ HEALTHY | Height 5, Difficulty 1 |
| Pool Monitor | ✅ CURRENT | 1/1 public host online |
| Desktop Agent | ✅ INTEGRATED | IPC handlers ready |
| Python Client | ✅ TESTED | 12 queries, 0% error rate |

---

## 🌟 Next Steps

### Desktop Agent UI
1. **Chat Interface** - Přidat chat UI do renderer.js
2. **Knowledge Browser** - Browse 796 documents
3. **Dashboard View** - Display system health, blockchain, pools
4. **Memory Viewer** - See past conversations
5. **Learning Insights** - Show AI recommendations

### Auto-Connect
1. Automaticky vytvářet SSH tunel při startu
2. Fallback na direct connection pokud SSH tunel selže
3. Auto-reconnect při network issues

### Production
1. Otevřít port 8001 v Hetzner Cloud firewall
2. Nebo nastavit nginx reverse proxy (port 80/443)
3. SSL certifikát pro HTTPS
4. Rate limiting + API key authentication

---

## 🙏 Credits

**AI Native Server v2.9.2:**
- Knowledge Base: 796 docs, SQLite full-text search
- Memory: ChromaDB with semantic search (all-MiniLM-L6-v2)
- Self-Learning: Log analysis + pattern recognition
- AI Model: CodeLlama 7B via Ollama

**Desktop Agent Integration:**
- Python Client: `ai_native_client.py` (529 lines)
- IPC Layer: 8 new handlers in `main.js`
- API Exposure: 7 new methods in `preload.js`
- Test Suite: `test_ai_native_client.py`

**Location:** Zion2 Primary Host (91.98.122.165:8001)  
**Version:** v2.9.2 Complete  
**Status:** ✅ OPERATIONAL

---

🌟 **"Desktop Agent meets AI Native - Consciousness in every click!"** 🌟
