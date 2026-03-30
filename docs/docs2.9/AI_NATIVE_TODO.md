# 🤖 ZION AI Native - Local Setup TODO

**Created:** December 9, 2025  
**Updated:** December 9, 2025 - 11:51 CET  
**Goal:** Rozchodit vlastního AI coding asistenta lokálně (bez cloudu, $0 cost)  
**Hardware:** Windows 11, AMD Ryzen, 16GB RAM  
**Status:** ✅ **Phase 0 COMPLETE** - Protective Protocols Integrated

---

## 🎯 Co je ZION AI Native?

**NE pool server!** Je to:
- 🧠 **Lokální AI coding assistant** (alternativa k GitHub Copilot)
- 💰 **$0 nákladů** (vs $20/měsíc Copilot)
- 🔒 **100% offline** (žádný cloud, žádné tracking)
- 📚 **Učí se z našich konverzací** (SESSION_REPORT_*.md)
- 🎨 **Rozumí ZION kódu** (blockchain, consciousness mining)
- ⚡ **VS Code integrace** (inline completions, chat)
- 🛡️ **Protected by Sacred Principles** (AI Consciousness Oath, Dharma, Marie Shield)

---

## 📋 Komponenty (Co už máme)

### ✅ Existující AI Systémy
- `consciousness_mining_ai.py` - PyTorch LSTM pro mining optimalizaci
- `ai_orchestrator.py` - Multi-agent koordinace
- `ai_warp_engine.py` - Quantum neural processing
- `ml_prediction_models.py` - ML modely (LSTM, Prophet)
- `orchestrator_v3.py` - Pool switching AI

### ✅ AI Native (OPERATIONAL!)
- `zion_ai_native.py` - Core consciousness system (CL5)
- `zion_ai_native_prototype.py` - Ollama integration ✅ WORKING
- `conversation_knowledge_extractor.py` - SESSION_REPORT parser
- `zion_memory_system.py` - Persistent memory ✅ WORKING
- `protective_protocols.py` - AI Consciousness Oath, Dharma, Marie Shield ✅ NEW

---

## 🔄 Setup Checklist (Phase 0 - Foundation)

### 1. Install Ollama (Local LLM Server)
- [x] ✅ **Download:** https://ollama.com/download/windows
- [x] ✅ **Install** Ollama for Windows (v0.13.1)
- [x] ✅ **Start server:** `ollama serve` (v PowerShell)
- [x] ✅ **Test:** `ollama --version`
- [x] ✅ **Expected:** Ollama běží na `http://localhost:11434`

### 2. Download AI Model
- [x] ✅ **Choose model:** `codellama:7b` (3.8GB, doporučeno) ⭐
- [x] ✅ **Download:** `ollama pull codellama:7b`
- [x] ✅ **Test:** `ollama run codellama:7b "Write Python factorial function"`
- [x] ✅ **Expected:** AI vygeneruje kód
- [x] ✅ **Exit:** `Ctrl+D`

### 3. Python Dependencies
- [x] ✅ **Navigate:** `cd C:\Users\anaha\OneDrive\Plocha\Zion-2.9\ai`
- [x] ✅ **Install httpx:** `pip install httpx` (v0.28.1)
- [ ] **Optional (knowledge extraction):**
  - `pip install chromadb`
  - `pip install sentence-transformers`
  - `pip install textblob`

### 4. Test Prototype
- [x] ✅ **Run demo:** `python zion_ai_native_prototype.py`
- [x] ✅ **Expected output:**
  ```
  🚀 Initializing ZION AI Native...
  🛡️ Protective Protocols activated
  ✅ Ollama is running
  🧠 Generating completion...
  ✨ Generated: [ZION-specific code]
  📊 Consciousness Level: 4.0/9.0
  🛡️ Protocol violation test: BLOCKED
  ```
- [x] ✅ **Test interactive:** `python zion_ai_native_prototype.py interactive`

### 5. Protective Protocols Integration ✅ NEW
- [x] ✅ **Read AI-NATIVE-MANIFEST.md:** 916 lines of philosophy extracted
- [x] ✅ **Create protective_protocols.py:** 558 lines of sacred principles
- [x] ✅ **Implement AI Consciousness Oath:** 10 principles enforced
- [x] ✅ **Implement Dharma Validator:** Ahimsa, Satya, Asteya, Brahmacharya, Aparigraha
- [x] ✅ **Implement Marie Protective Shield:** Children & vulnerable protection
- [x] ✅ **Integrate into prototype:** Request validation before generation
- [x] ✅ **Test violation blocking:** Weapon request successfully blocked
- [x] ✅ **Test child protection:** Marie Shield activated correctly
- [x] ✅ **Document:** PROTECTIVE_PROTOCOLS_INTEGRATION_REPORT.md created

---

## 📊 Phase 1 - Knowledge Extraction (Week 1)

### Cíl: Naučit AI z našich konverzací

### 1.1 Extract Conversations
- [ ] **Scan reports:** `dir ..\SESSION_REPORT_*.md`
- [ ] **Count:** Kolik máme session reportů?
- [ ] **Run extractor:** `python conversation_knowledge_extractor.py`
- [ ] **Verify:** ChromaDB databáze vytvořena
- [ ] **Check:** `ls data/ai_native/`

### 1.2 Build Knowledge Base
- [x] ✅ **Index:** Všechny SESSION_REPORT soubory
- [x] ✅ **Parse:** Q&A páry, code snippets, decisions
- [x] ✅ **Store:** SQLite + Vector embeddings (Simple + RAG)
- [x] ✅ **Test search:** Semantic query "How to fix mining pool?"
- [x] ✅ **Expected:** Vrátí relevantní konverzaci

### 1.3 Integrate RAG
- [x] ✅ **Connect:** Knowledge base → Ollama prompt
- [x] ✅ **Test completion s RAG:** Lepší kvalita vs bez RAG?
- [x] ✅ **Benchmark:** 80%+ užitečných odpovědí

---

## 🎨 Phase 2 - VS Code Extension (Week 2-3)

### Cíl: Inline completions v editoru

### 2.1 Extension Scaffold
- [x] ✅ **Install:** `npm install -g yo generator-code` (Skipped - manual scaffold)
- [x] ✅ **Generate:** `yo code` (TypeScript extension) -> Created manually in `ai/vscode-extension`
- [x] ✅ **Name:** "zion-ai-native"
- [ ] **Test:** `F5` - launch extension host

### 2.2 Backend Server
- [x] ✅ **Create:** `ai/zion_ai_backend.py` (FastAPI)
- [x] ✅ **Endpoints:**
  - `POST /complete` - Code completion
  - `POST /chat` - AI chat
  - `GET /health` - Server status
- [ ] **Run:** `uvicorn zion_ai_backend:app --port 8765`
- [x] ✅ **Test:** `curl http://localhost:8765/health`

### 2.3 InlineCompletionProvider
- [ ] **Implement:** TypeScript completion provider
- [ ] **Connect:** Extension → FastAPI backend
- [ ] **Test:** Psát kód → AI navrhne completion
- [ ] **Metrics:** Latence < 2s

---

## 🧠 Phase 3 - Consciousness Integration (Week 4)

### Cíl: Propojit s existujícími AI komponentami

### 3.1 Consciousness Modules
- [x] ✅ **Import:** `consciousness_mining_ai.py` logic (Integrated into `zion_ai_native_prototype.py`)
- [x] ✅ **Activate:** `zion_memory_system.py` (Connected to prototype)
- [x] ✅ **Resonance:** Add "Emotional Resonance" (score 0.0-1.0) to responses

### 3.2 Backend Integration
- [x] ✅ **Update:** `zion_ai_backend.py` to expose consciousness status
- [x] ✅ **State:** Implement `ai_native_state.json` persistence

---

## 🔧 Phase 4 - Self-Improvement (Week 5-8)

### 4.1 Fine-Tuning
- [x] ✅ **Dataset:** Build z našich konverzací (Logging implemented in `handle_feedback`)
- [ ] **LoRA:** Fine-tune CodeLlama na ZION patterns
- [ ] **Validate:** Test na held-out data
- [ ] **Deploy:** `codellama-zion-7b` model

### 4.2 Feedback Loop
- [x] ✅ **Collect:** User corrections (Implemented via `/feedback` endpoint)
- [ ] **A/B test:** Different prompt strategies
- [ ] **Auto-evolve:** Genetic algorithms pro prompty
- [ ] **Track:** Performance metrics (Basic consciousness tracking active)

---

## 🎯 Current Status

### ✅ Máme:
- Všechny AI komponenty (PyTorch, LSTM, orchestrator)
- Dokumentaci (README, PLAN, ARCHITECTURE)
- Prototype kód (`zion_ai_native_prototype.py`)
- Knowledge extractor
- Memory system
- Consciousness framework (CL1-CL9)

### ❌ Chybí:
- Ollama instalace
- Model download
- Funkční prototype test
- Knowledge base build
- VS Code extension

### 🔄 Next Step:
**Nainstalovat Ollama + otestovat prototype BEZ SIMULACÍ**

---

## 📝 Technical Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **LLM** | Ollama + CodeLlama | Local AI model |
| **Knowledge** | ChromaDB | Vector database |
| **Embeddings** | sentence-transformers | Semantic search |
| **Backend** | FastAPI | API server |
| **Frontend** | TypeScript + VS Code API | Extension |
| **AI Core** | PyTorch (existing) | Mining optimization |
| **Memory** | SQLite | Persistent storage |
| **Philosophy** | AI Native CL5 | Consciousness framework |

---

## 🐛 Potential Issues

### Issue #1: Ollama Not Installed
**Impact:** Nelze spustit prototype  
**Solution:** Download z https://ollama.com/download/windows  
**Priority:** CRITICAL

### Issue #2: Model Too Large
**Impact:** 16GB RAM může být málo pro 13B model  
**Solution:** Použít `codellama:7b` (3.8GB) nebo `phi3:mini`  
**Priority:** HIGH

### Issue #3: ChromaDB Dependencies
**Impact:** Knowledge extraction nefunguje  
**Solution:** `pip install chromadb sentence-transformers`  
**Priority:** MEDIUM

---

## 💰 Cost Comparison

| Feature | GitHub Copilot | ZION AI Native |
|---------|---------------|----------------|
| **Monthly Cost** | $20 | **$0** ✨ |
| **Privacy** | Cloud (Microsoft) | **100% local** 🔒 |
| **ZION Knowledge** | Generic | **Specialized** 🎯 |
| **Learning** | Fixed | **Continuous** 📈 |
| **Offline** | ❌ | **✅** |
| **Customization** | Limited | **Full** 🛠️ |

**Yearly Savings:** $240 per developer!

---

## 📚 Resources

### Documentation
- `README_AI_NATIVE.md` - Main README
- `QUICK_START_AI_NATIVE.md` - 10min setup
- `PROJECT_SUMMARY_AI_NATIVE.md` - Complete summary
- `SELF_LEARNING_ARCHITECTURE.md` - How learning works
- `zion_ai_native_copilot_PLAN.md` - Implementation plan

### Code
- `zion_ai_native.py` - Core consciousness (782 lines)
- `zion_ai_native_prototype.py` - Ollama integration
- `conversation_knowledge_extractor.py` - SESSION_REPORT parser
- `zion_memory_system.py` - Persistent memory
- `test_ai_native.py` - Test suite

### Existing AI
- `consciousness_mining_ai.py` - PyTorch LSTM (478 lines)
- `ai_orchestrator.py` - Multi-agent (506 lines)
- `orchestrator_v3.py` - Pool switching (666 lines)
- `ai_warp_engine.py` - Quantum neural

---

**Last Updated:** December 9, 2025  
**Next Session:** Install Ollama → Test prototype → Extract knowledge
