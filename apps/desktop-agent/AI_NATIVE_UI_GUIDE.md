# AI Native UI Guide - Desktop Agent

## 🎨 Design Přehled

Desktop agent nyní obsahuje **AI Native consciousness mining** sekci s designem odpovídajícím website-v2.9.

### Barevná paleta (z website-v2.9)
```css
--zion-gold: rgb(255, 215, 0)       /* Zlatá - hlavní akcent */
--zion-purple: rgb(147, 51, 234)    /* Fialová - consciousness */
--zion-cyan: rgb(6, 182, 212)       /* Cyan - AI/tech */
--zion-blue: rgb(30, 58, 138)       /* Modrá - podpora */
```

### Vizuální prvky
- ✨ **Gradient text** - zlato → fialová → cyan
- 🌟 **Glow effects** - neon borders s 0.3 opacity
- 🔲 **Glass morphism** - rgba(0,0,0,0.55) s blur(20px)
- 📊 **Card layout** - rounded corners (12-16px)
- 🎯 **Status badges** - animated pulse effect

## 📱 UI Struktura

### 1. AI View (Sekce AI)
Lokace: Sidebar → AI (ikona ⭐)

```
┌─────────────────────────────────────────┐
│ 🧠 AI Native Consciousness Mining       │
│                         [OFF badge]     │
├─────────────────────────────────────────┤
│ Pokročilé AI mining s vědomostní...    │
├─────────────────────────────────────────┤
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐       │
│ │🎯   │ │🧠   │ │✓    │ │⚡   │       │
│ │Stav │ │Vědomí│ │Úkoly│ │Výkon│       │
│ │STOP │ │Lv 1 │ │0/0  │ │0 H/s│       │
│ └─────┘ └─────┘ └─────┘ └─────┘       │
├─────────────────────────────────────────┤
│ [▶ Start AI Native]                    │
│ [■ Stop AI Native]                     │
├─────────────────────────────────────────┤
│ 📊 Detaily                             │
│ Pool: http://localhost:8001            │
│ Consciousness Level: 1                 │
│ GPU: No | Threads: 4                   │
└─────────────────────────────────────────┘
```

**Komponenty:**
- **Status badge** - TOP RIGHT corner, animated pulse
- **Stats grid** - 4 karty (2x2 na desktop, 1x4 na mobile)
- **Control buttons** - gradient purple→cyan, white text
- **Details panel** - dark background, monospace info

### 2. Settings View (Nastavení)
Lokace: Sidebar → Settings (ikona ⚙️) → AI Native sekce

```
┌─────────────────────────────────────────┐
│ ⚙️ Mining Settings                     │
│ [wallet input]                         │
│ [pool input]                           │
│ ...                                    │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ 🧠 AI Native Consciousness Mining       │
│ (purple border, glow effect)           │
├─────────────────────────────────────────┤
│ ☐ Enable AI Native Mining             │
│   OFF by default, vyžaduje API server  │
├─────────────────────────────────────────┤
│ AI Native Pool URL:                    │
│ [http://localhost:8001]                │
├─────────────────────────────────────────┤
│ 🧠 Consciousness Level       Level 1   │
│ [━━○───────────────────] (1-10)       │
│ 1=Physical, 5=Mental, 10=On The Star  │
├─────────────────────────────────────────┤
│ 💡 Jak to funguje:                     │
│ 1. Spusť API: python -m src.api...    │
│ 2. Zapni AI Native                     │
│ 3. Ulož a restart                      │
│ 4. Sleduj v AI sekci                   │
├─────────────────────────────────────────┤
│ [💾 Save AI Native Settings]           │
└─────────────────────────────────────────┘
```

**Komponenty:**
- **Purple border** - 2px solid rgba(147, 51, 234, 0.3)
- **Checkbox** - Enable/Disable toggle
- **Slider** - Consciousness level 1-10 with live value display
- **Info box** - Gradient background (purple→cyan, 0.15 opacity)

## 🎯 Interaktivní prvky

### Status Badge
```css
.status-badge.mining {
  background: linear-gradient(135deg, rgba(74, 222, 128, 0.25), rgba(34, 197, 94, 0.15));
  color: rgb(74, 222, 128);
  animation: pulse 2s infinite;
}

.status-badge.stopped {
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(220, 38, 38, 0.15));
  color: rgb(248, 113, 113);
}
```

### Gradient Buttons
```css
.btn-primary {
  background: linear-gradient(135deg, var(--zion-purple), var(--zion-cyan));
  border: none;
  color: white;
  transition: all 0.3s;
}

.btn-primary:hover {
  box-shadow: 0 0 30px rgba(147, 51, 234, 0.4);
  transform: translateY(-2px);
}
```

### Stat Cards
```css
.stat-card {
  background: rgba(0, 0, 0, 0.55);
  border: 1px solid rgba(255,255,255,0.10);
  border-radius: 16px;
  padding: 28px;
  backdrop-filter: blur(20px);
  box-shadow: 0 0 18px rgba(147,51,234,0.18);
}

.stat-card:hover {
  border-color: var(--zion-purple);
  transform: translateY(-4px);
}
```

## 🔄 Stavy UI

### 1. Initial State (OFF)
- Badge: "OFF" (červená)
- Start button: Visible
- Stop button: Hidden
- Stats: Default values (0/0, Level 1, 0 H/s)

### 2. Starting
- Badge: "STARTING..." (žlutá)
- Buttons: Disabled
- Log: "Starting AI Native consciousness mining..."

### 3. Running
- Badge: "RUNNING" (zelená, animated pulse)
- Start button: Hidden
- Stop button: Visible
- Stats: Live updates každých 5s
- Stats polling: Active

### 4. Stopping
- Badge: "STOPPING..." (žlutá)
- Buttons: Disabled
- Log: "Stopping AI Native..."

### 5. Error State
- Badge: "ERROR" (červená)
- Alert: Error message + řešení
- Stats: Zastaveno polling
- UI: Reset to OFF state

## 📊 Stats Formátování

### Hashrate
```javascript
function formatHashrate(hashrate) {
  if (hashrate < 1000) return `${hashrate.toFixed(2)} H/s`;
  if (hashrate < 1000000) return `${(hashrate/1000).toFixed(2)} kH/s`;
  if (hashrate < 1000000000) return `${(hashrate/1000000).toFixed(2)} MH/s`;
  return `${(hashrate/1000000000).toFixed(2)} GH/s`;
}
```

### Consciousness Level
```javascript
const levelNames = {
  1: 'Physical',
  2: 'Physical+',
  3: 'Mental',
  4: 'Mental+',
  5: 'Cosmic',
  6: 'Cosmic+',
  7: 'Astral',
  8: 'Astral+',
  9: 'On The Star',
  10: 'Master'
};
```

### Tasks Display
```
Format: "completed / total"
Example: "42 / 100"
Color: cyan (#06B6D4)
```

## 🎬 Animace

### Pulse Animation (status badge)
```css
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
```

### Card Hover
```css
.stat-card {
  transition: all 0.3s ease;
}

.stat-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 0 30px rgba(147, 51, 234, 0.3);
}
```

### Button Press
```css
.btn:active {
  transform: scale(0.98);
}
```

## 📱 Responsivní design

### Desktop (>1200px)
- Stats grid: 4 columns (2x2)
- Sidebar: Fixed width 280px
- Cards: minmax(180px, 1fr)

### Tablet (768-1200px)
- Stats grid: 2 columns (2x2)
- Sidebar: Collapsible
- Cards: minmax(150px, 1fr)

### Mobile (<768px)
- Stats grid: 1 column (1x4)
- Sidebar: Hidden (hamburger menu)
- Cards: Full width

## 🔧 JavaScript Events

### Event Listeners
```javascript
// Start button
ai-native-start-btn.addEventListener('click', async () => {
  await window.electronAPI.aiNativeStart(config);
  updateAiNativeUI(true);
  startAiNativeStatsPolling();
});

// Stop button
ai-native-stop-btn.addEventListener('click', async () => {
  await window.electronAPI.aiNativeStop();
  updateAiNativeUI(false);
  stopAiNativeStatsPolling();
});

// Consciousness slider
consciousness-input.addEventListener('input', (e) => {
  consciousness-value.textContent = e.target.value;
});

// Save settings
save-ai-native-settings-btn.addEventListener('click', async () => {
  config.aiNative = ai-native-enabled-checkbox.checked;
  config.aiNativePoolUrl = ai-native-pool-url-input.value;
  config.aiNativeConsciousness = parseInt(consciousness-input.value);
  await window.electronAPI.saveConfig(config);
});
```

### Stats Polling
```javascript
// Poll every 5 seconds
aiNativeStatsInterval = setInterval(async () => {
  const result = await window.electronAPI.aiNativeStats();
  updateAiNativeStats(result.stats);
}, 5000);
```

## 🎯 Best Practices

### ✅ DO:
- Používej CSS variables (--zion-gold, --zion-purple, atd.)
- Gradient backgrounds pro buttony a text
- Animuj transitions (0.3s ease)
- Blur backdrop-filter pro glass effect
- Box-shadow s low opacity pro glow

### ❌ DON'T:
- Nekombinuj různé barevné schémata
- Nepřepisuj globální CSS
- Nepoužívej inline styles (kromě dynamic updates)
- Nezapomeň na hover states
- Neblokuj UI během async operací

## 📸 Screenshots placeholders

(TODO: Přidat screenshoty při prvním spuštění)

1. **AI View - OFF state**
2. **AI View - RUNNING state**
3. **Settings - AI Native section**
4. **Status badge - animated pulse**
5. **Consciousness slider - interaction**

## 🚀 Testing Checklist

- [ ] AI view zobrazuje všechny komponenty
- [ ] Settings zobrazuje AI Native sekci
- [ ] Start button funguje
- [ ] Stop button funguje
- [ ] Stats se aktualizují každých 5s
- [ ] Consciousness slider je responsive
- [ ] Save settings ukládá config
- [ ] Badge se mění podle stavu
- [ ] Gradient buttony mají hover effect
- [ ] Karty mají hover animation
- [ ] Error handling zobrazuje alerts
- [ ] OFF by default při prvním spuštění

---

**Status**: ✅ UI Complete  
**Design**: website-v2.9 style matched  
**Ready for**: User testing + screenshots
