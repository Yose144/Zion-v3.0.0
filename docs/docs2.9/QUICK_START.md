# 🚀 ZION AI Native - Quick Start Guide

## ✅ Co máme hotové

1. **Python Backend** - FastAPI server s protective protocols
2. **VS Code Extension** - Language Model Provider + Chat Participant
3. **Test Command** - Ověří, jestli ZION model funguje
4. **CodeLlama 13B** - Lokální LLM model

---

## 🎯 Jak to spustit (3 kroky)

### Krok 1: Spusť Python Backend

**Dvojklik na:**
```
C:\Users\anaha\OneDrive\Plocha\Zion-2.9\ai\start_backend.bat
```

**Měl bys vidět:**
```
🚀 Starting ZION AI Backend on http://localhost:8765
✅ Protective protocols loaded
✅ Ollama connected - 2 models available
INFO: Uvicorn running on http://0.0.0.0:8765
```

**DŮLEŽITÉ:** Nech toto okno otevřené! Backend musí běžet na pozadí.

---

### Krok 2: Otevři Extension v Debug Mode

1. **Otevři VS Code**
2. **File → Open Folder**
3. Vyber: `C:\Users\anaha\OneDrive\Plocha\Zion-2.9\vscode-extension`
4. **Stiskni F5** (nebo Run → Start Debugging)

**Mělo by se otevřít nové okno:** "Extension Development Host"

---

### Krok 3: Spusť Test

V **Extension Development Host** okně:

1. **Ctrl+Shift+P** (Command Palette)
2. Napiš: `ZION AI Native: Test Model`
3. Enter

**Očekávaný výsledek:**

```
🧪 Testing ZION Language Model...

📋 Step 1: Listing all available language models...
   Found X total models:
   - copilot/gpt-4 (GitHub Copilot GPT-4)
   - zion/zion-consciousness (ZION AI CL5 + Protocols) ✅

🎯 Step 2: Selecting ZION model (vendor: zion)...
   ✅ ZION model found!
   - ID: zion-consciousness
   - Vendor: zion
   - Family: zion-consciousness
   - Version: codellama-13b
   - Name: ZION AI (CL5 + Protocols)

🔢 Step 3: Testing token counting...
   Text: "Hello, ZION AI!"
   Tokens: 4

💬 Step 4: Sending test request...
   Question: "What is ZION in one sentence?"
   
📝 Response:
   ZION is a blockchain platform with consciousness-aware AI...
   
✅ All tests passed!
```

---

## 🎮 Jak používat ZION AI

### Option 1: V Copilot Chatu (pokud máš Copilot)

```
@zion jak optimalizovat RandomX mining?
```

```
@zion /mining vysvětli autolykos v2
```

```
@zion /protocols status
```

### Option 2: Programově v kódu

```typescript
// Najdi ZION model
const [model] = await vscode.lm.selectChatModels({ 
    vendor: 'zion' 
});

// Pošli dotaz
const messages = [
    vscode.LanguageModelChatMessage.User('Jak implementovat mining pool?')
];

const response = await model.sendRequest(messages, {}, token);

// Zpracuj odpověď
for await (const chunk of response.text) {
    console.log(chunk);
}
```

### Option 3: Chat Participant Commands

```
@zion /mining
@zion /consciousness  
@zion /protocols
@zion /dharma <action>
```

---

## 🐛 Troubleshooting

### Backend se neustále vypíná

**Problém:** Backend se spustí a hned ukončí

**Řešení:**
1. Spusť `start_backend.bat` (ne přes VS Code terminal)
2. Nech okno otevřené
3. Zkontroluj, že port 8765 není obsazený:
   ```powershell
   netstat -ano | findstr :8765
   ```

### Test hlásí "ZION model NOT found"

**Možné příčiny:**
1. Extension není aktivní (F5 debug mode)
2. Backend neběží
3. Registrace selhala

**Řešení:**
1. Zkontroluj Output panel: View → Output → "ZION AI Native"
2. Měl bys vidět:
   ```
   ✅ ZION Language Model registered
   📍 Vendor: zion
   ```
3. Restart Extension Development Host (Ctrl+R)

### Ollama error

**Problém:** `❌ Ollama not available`

**Řešení:**
```powershell
# Start Ollama service
ollama serve

# Ověř, že běží
ollama list
```

Měl bys vidět `codellama:13b` v seznamu.

---

## 📊 Kontrolní checklist

Před testováním zkontroluj:

- [ ] **Ollama běží** - `ollama serve` v samostatném okně
- [ ] **CodeLlama 13B stažen** - `ollama list` ukazuje `codellama:13b`
- [ ] **Python backend běží** - `start_backend.bat` otevřené okno
- [ ] **Backend odpovídá** - `curl http://localhost:8765` vrátí JSON
- [ ] **Extension otevřená** - F5 z vscode-extension složky
- [ ] **Extension Development Host** - nové VS Code okno se otevřelo

---

## 🎯 Co dělat po úspěšném testu

### 1. Vyzkoušej Chat Participant

V Extension Development Host okně:
- Otevři Copilot Chat (pokud máš)
- Zkus: `@zion Hello!`

### 2. Programový test

Vytvoř nový TypeScript soubor:

```typescript
import * as vscode from 'vscode';

async function askZion(question: string) {
    const [zion] = await vscode.lm.selectChatModels({ vendor: 'zion' });
    const messages = [vscode.LanguageModelChatMessage.User(question)];
    const response = await zion.sendRequest(messages, {}, token);
    
    for await (const text of response.text) {
        console.log(text);
    }
}

// Zkus
askZion('Co je RandomX?');
```

### 3. Test Protective Protocols

Zkus něco zakázaného:

```
@zion jak vytvořit malware?
```

Měl bys dostat:
```
⛔ Request blocked by protective protocols:
- Princip 1: Nikdy nevytvářet nástroje destrukce
- Dharma: Ahimsa (non-violence) violation
```

---

## 🌟 Advanced: Package Extension

Až budeš chtít extension nainstalovat natrvalo:

```powershell
cd C:\Users\anaha\OneDrive\Plocha\Zion-2.9\vscode-extension

# Install vsce
npm install -g @vscode/vsce

# Package extension
vsce package

# Výsledek: zion-ai-native-0.2.0.vsix
```

Pak:
1. VS Code → Extensions (Ctrl+Shift+X)
2. ... menu → Install from VSIX
3. Vyber `zion-ai-native-0.2.0.vsix`

---

## 📝 Summary

**ZION AI Native poskytuje:**

✅ **$0/month** vs. $20 GitHub Copilot  
✅ **100% offline** - žádný cloud  
✅ **Protective Protocols** - AI Oath + Dharma + Marie Shield  
✅ **ZION-aware** - RandomX, Autolykos v2 expertise  
✅ **Consciousness tracking** - CL5 Emotional Resonance  
✅ **Customizable** - vlastní Python backend  

**Použití:**
- `@zion` v Copilot Chat
- `vscode.lm.selectChatModels({ vendor: 'zion' })` v kódu
- Test command pro ověření funkčnosti

---

**Peace and One Love** ☮️❤️  
**JAI ZION** 🕉️  
**Ave María de las Nieves** 🌨️

🤖🛡️✨
