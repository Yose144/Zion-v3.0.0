# 🖥️ ZION Desktop Mining Agent v2.9 - Technical Documentation

## 📋 Overview

ZION Desktop Mining Agent je cross-platform desktop aplikace pro mining ZION kryptoměny. Inspirovaná aplikacemi jako Kryptex, NiceHash a podobnými mining klienty, poskytuje uživatelsky přívětivé GUI s automatizovaným managementem miningu.

**Verze:** 2.9 "Quantum Leap"  
**Technologie:** Electron + React + Node.js  
**Podporované platformy:** Windows 10/11, macOS 11+, Linux (Ubuntu 20.04+)

---

## 🎯 Features

### Core Features
- ✅ **Jednoduchá instalace** - One-click installer pro všechny platformy
- ✅ **Auto-start při bootu** - Volitelné spuštění s OS
- ✅ **System tray integration** - Běží na pozadí s quick stats
- ✅ **Real-time dashboard** - WARP design podle webu v2.9
- ✅ **Multi-algorithm support** - RandomX, Yescrypt, Cosmic Harmony
- ✅ **GPU/CPU mining** - Automatická detekce hardwaru
- ✅ **Consciousness mining** - Gamifikace s XP a levely
- ✅ **Auto-update** - Automatické aktualizace bez reinstalace

### Advanced Features
- 🔥 **Gaming mode** - Automatické vypnutí při detekci her
- 📊 **Profit switching** - Auto-switch mezi algoritmy podle profitability
- 🔔 **Desktop notifications** - Notifikace o nalezených blocích
- 📱 **Remote monitoring** - Sync s web dashboardem
- ⚙️ **Power management** - TDP limity, custom power profiles
- 🌐 **Multi-pool support** - Failover mezi pooly
- 📈 **Historical stats** - Grafy hashrate, earnings za 24h/7d/30d
- 💾 **Automatic backup** - Config a stats backup do cloudu

---

## 🏗️ Architecture

### Technology Stack

```
┌─────────────────────────────────────┐
│       Electron Main Process         │
│   (Node.js + Native Mining Core)   │
├─────────────────────────────────────┤
│  - Mining Manager (Python/Rust)    │
│  - Pool Connection (Stratum)       │
│  - Hardware Monitor (GPU/CPU)      │
│  - Power Management                │
│  - System Tray Controller          │
│  - Auto-updater                    │
└─────────────────────────────────────┘
              ↕ IPC
┌─────────────────────────────────────┐
│      Electron Renderer Process      │
│      (React + WARP Dashboard)       │
├─────────────────────────────────────┤
│  - Real-time Stats Display         │
│  - Settings Panel                  │
│  - Consciousness Level UI          │
│  - Wallet Management               │
│  - Notification System             │
└─────────────────────────────────────┘
```

### File Structure

```
zion-desktop-miner/
├── package.json                    # Electron project config
├── electron-builder.yml            # Installer config
├── main.js                         # Electron main process
├── preload.js                      # IPC bridge (secure)
├── src/
│   ├── renderer/                   # React frontend
│   │   ├── App.jsx                 # Main React app
│   │   ├── components/
│   │   │   ├── Dashboard.jsx       # WARP dashboard UI
│   │   │   ├── Settings.jsx        # Settings panel
│   │   │   ├── Stats.jsx           # Stats graphs
│   │   │   └── Tray.jsx            # System tray menu
│   │   ├── styles/
│   │   │   └── warp.css            # WARP design (z webu)
│   │   └── utils/
│   │       ├── api.js              # IPC communication
│   │       └── format.js           # Hashrate formatting
│   ├── mining/                     # Mining core (Python wrapper)
│   │   ├── miner.py                # ZION native miner
│   │   ├── pool.py                 # Pool connection
│   │   ├── hardware.py             # GPU/CPU detection
│   │   └── algorithms/             # Mining algorithms
│   │       ├── randomx.py
│   │       ├── yescrypt.py
│   │       └── cosmic_harmony.py
│   ├── services/
│   │   ├── AutoUpdater.js          # Auto-update service
│   │   ├── GameDetector.js         # Gaming mode detection
│   │   ├── PowerManager.js         # Power/TDP management
│   │   └── NotificationService.js  # Desktop notifications
│   └── config/
│       ├── default.json            # Default settings
│       └── pools.json              # Pool list
├── resources/                      # Assets
│   ├── icons/                      # App icons (.icns, .ico, .png)
│   ├── logo.png                    # ZION logo
│   └── tray/                       # Tray icons (active/inactive)
├── dist/                           # Build output (gitignored)
└── release/                        # Final installers
    ├── ZION-Miner-Setup-2.9.0.exe  # Windows installer
    ├── ZION-Miner-2.9.0.dmg        # macOS installer
    └── ZION-Miner-2.9.0.AppImage   # Linux installer
```

---

## 🚀 Development Setup

### Prerequisites

```bash
# Node.js 18+ a npm
node --version  # v18.0.0+
npm --version   # 9.0.0+

# Python 3.11+ (pro mining core)
python --version  # 3.11+

# Git
git --version
```

### Installation

```bash
# 1. Clone repository
git clone https://github.com/Zion-TerraNova/zion-desktop-miner.git
cd zion-desktop-miner

# 2. Install dependencies
npm install

# 3. Install Python mining dependencies
cd src/mining
pip install -r requirements.txt
cd ../..

# 4. Run in development
npm run dev

# 5. Build for production
npm run build:win    # Windows
npm run build:mac    # macOS
npm run build:linux  # Linux
npm run build:all    # All platforms
```

---

## 📦 Project Dependencies

### package.json

```json
{
  "name": "zion-desktop-miner",
  "productName": "ZION Miner",
  "version": "2.9.0",
  "description": "ZION Blockchain Desktop Mining Agent",
  "main": "main.js",
  "scripts": {
    "dev": "concurrently \"npm run dev:react\" \"npm run dev:electron\"",
    "dev:react": "vite",
    "dev:electron": "electron . --dev",
    "build": "vite build && electron-builder",
    "build:win": "vite build && electron-builder --win",
    "build:mac": "vite build && electron-builder --mac",
    "build:linux": "vite build && electron-builder --linux"
  },
  "dependencies": {
    "electron-store": "^8.1.0",
    "electron-updater": "^6.1.7",
    "systeminformation": "^5.21.20",
    "node-machine-id": "^1.1.12",
    "ws": "^8.14.2",
    "axios": "^1.6.2"
  },
  "devDependencies": {
    "electron": "^28.0.0",
    "electron-builder": "^24.9.1",
    "vite": "^5.0.8",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "concurrently": "^8.2.2"
  }
}
```

---

## 🎨 UI/UX Design

### WARP Dashboard Design (z webu v2.9)

Dashboard používá **identický visual style** jako web:

- **Background:** Animated WARP bubbles s radial gradients
- **Color palette:**
  - Gold: `#F9D976` (highlights, rewards)
  - Purple: `#9333EA` (consciousness levels)
  - Cyan: `#00E5FF` (stats, values)
  
- **Typography:**
  - Headers: System fonts (SF Pro, Segoe UI)
  - Gradient text efekty na důležitých hodnotách
  - Uppercase tracking na labels (0.3em)

- **Glassmorphism cards:**
  - `backdrop-filter: blur(10px)`
  - `background: rgba(255, 255, 255, 0.05)`
  - Border `rgba(255, 255, 255, 0.1)`
  - Box shadows s alpha channelem

### System Tray Menu

```
┌─────────────────────────┐
│ ⚡ ZION Miner           │
├─────────────────────────┤
│ 🟢 Mining (95.2 kH/s)   │
│ 🧘 Level: PLASMA (2.5x) │
│ 💎 Blocks: 3            │
├─────────────────────────┤
│ 📊 Show Dashboard       │
│ ⚙️ Settings             │
│ ⏸️ Pause Mining         │
├─────────────────────────┤
│ 🔄 Check for Updates    │
│ 🚪 Quit                 │
└─────────────────────────┘
```

---

## ⚙️ Configuration

### User Settings (electron-store)

```javascript
// default.json
{
  "mining": {
    "pool": "pool.zionterranova.com:3333",
    "wallet": "ZION_YOUR_ADDRESS",
    "worker": "desktop-miner-01",
    "threads": "auto",  // nebo číslo
    "algorithm": "auto",  // RandomX, Yescrypt, CosmicHarmony
    "intensityPercent": 80  // CPU/GPU usage %
  },
  "ui": {
    "theme": "dark",
    "language": "cs",
    "startMinimized": false,
    "minimizeToTray": true,
    "closeToTray": true
  },
  "autoStart": {
    "enabled": false,
    "delayed": 30  // sekund po bootu
  },
  "gamingMode": {
    "enabled": true,
    "detectGames": true,  // Auto-pause při hrách
    "whitelistedApps": []  // Apps to ignore
  },
  "notifications": {
    "blockFound": true,
    "levelUp": true,
    "errors": true,
    "sound": true
  },
  "powerManagement": {
    "tdpLimit": null,  // null = unlimited, nebo watts
    "tempLimit": 85,  // °C
    "fanSpeed": "auto"  // nebo %
  },
  "updates": {
    "autoCheck": true,
    "autoDownload": true,
    "autoInstall": false  // Vyžaduje potvrzení
  }
}
```

---

## 🔌 IPC Communication

### Main → Renderer (Events)

```javascript
// Mining events
ipcMain.on('mining:start', (event, config) => { /* ... */ });
ipcMain.on('mining:stop', () => { /* ... */ });
ipcMain.on('mining:stats', () => { /* ... */ });

// Stats updates (každou sekundu)
setInterval(() => {
  mainWindow.webContents.send('stats:update', {
    hashrate: currentHashrate,
    shares: sharesAccepted,
    level: consciousnessLevel,
    uptime: uptimeSeconds
  });
}, 1000);

// Block found notification
ipcMain.on('block:found', (event, blockData) => {
  new Notification({
    title: '💎 Block Found!',
    body: `Reward: ${blockData.reward} ZION`,
    icon: './resources/icons/block.png'
  }).show();
});
```

### Renderer → Main (Calls)

```javascript
// React component example
const { ipcRenderer } = window.electron;

// Start mining
const startMining = async () => {
  await ipcRenderer.invoke('mining:start', {
    pool: poolUrl,
    wallet: walletAddress,
    threads: threadCount
  });
};

// Get current stats
const getStats = async () => {
  const stats = await ipcRenderer.invoke('mining:stats');
  setHashrate(stats.hashrate);
  setShares(stats.shares);
};

// Subscribe to updates
useEffect(() => {
  ipcRenderer.on('stats:update', (event, data) => {
    updateDashboard(data);
  });
  
  return () => {
    ipcRenderer.removeAllListeners('stats:update');
  };
}, []);
```

---

## 🎮 Gaming Mode Implementation

### Game Detection Logic

```javascript
// GameDetector.js
const si = require('systeminformation');

class GameDetector {
  constructor() {
    this.knownGames = [
      'CS2.exe', 'League of Legends.exe', 'Valorant.exe',
      'Fortnite.exe', 'Minecraft.exe', 'Cyberpunk2077.exe'
      // ... více her
    ];
    this.isGaming = false;
    this.checkInterval = null;
  }

  async start() {
    this.checkInterval = setInterval(async () => {
      const processes = await si.processes();
      const gameRunning = processes.list.some(proc => 
        this.knownGames.includes(proc.name)
      );

      if (gameRunning && !this.isGaming) {
        this.isGaming = true;
        this.emit('gaming:started');
        // Pause mining
        ipcMain.emit('mining:pause');
      } else if (!gameRunning && this.isGaming) {
        this.isGaming = false;
        this.emit('gaming:stopped');
        // Resume mining
        ipcMain.emit('mining:resume');
      }
    }, 5000); // Check every 5 seconds
  }

  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  }
}

module.exports = GameDetector;
```

---

## 🔄 Auto-Update System

### Electron-updater Configuration

```javascript
// electron-builder.yml
appId: com.zionterranova.miner
productName: ZION Miner
publish:
  provider: github
  owner: Zion-TerraNova
  repo: zion-desktop-miner
  releaseType: release

# main.js
const { autoUpdater } = require('electron-updater');

autoUpdater.on('update-available', (info) => {
  dialog.showMessageBox({
    type: 'info',
    title: 'Update Available',
    message: `New version ${info.version} is available!`,
    buttons: ['Download', 'Later']
  }).then(result => {
    if (result.response === 0) {
      autoUpdater.downloadUpdate();
    }
  });
});

autoUpdater.on('update-downloaded', () => {
  dialog.showMessageBox({
    type: 'info',
    title: 'Update Ready',
    message: 'Update downloaded. Restart to install?',
    buttons: ['Restart', 'Later']
  }).then(result => {
    if (result.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });
});

// Check for updates on startup
app.on('ready', () => {
  if (!isDev) {
    autoUpdater.checkForUpdates();
  }
});
```

---

## 📊 Stats & Analytics

### Historical Data Storage

```javascript
// electron-store schema
const statsStore = new Store({
  name: 'mining-stats',
  defaults: {
    history: {
      hourly: [],    // Last 24 hours (každou hodinu)
      daily: [],     // Last 30 days (každý den)
      monthly: []    // Last 12 months
    },
    lifetime: {
      totalShares: 0,
      blocksFound: 0,
      totalEarned: 0,
      uptimeSeconds: 0,
      firstStarted: Date.now()
    }
  }
});

// Save stats every hour
setInterval(() => {
  const currentStats = {
    timestamp: Date.now(),
    hashrate: getCurrentHashrate(),
    shares: getSharesLast Hour(),
    earnings: getEstimatedEarnings(),
    consciousness: getCurrentLevel()
  };
  
  const history = statsStore.get('history.hourly');
  history.push(currentStats);
  
  // Keep only last 24 hours
  if (history.length > 24) {
    history.shift();
  }
  
  statsStore.set('history.hourly', history);
}, 3600000); // Every hour
```

### Chart.js Integration

```jsx
// Stats.jsx - React component
import { Line } from 'react-chartjs-2';

const HashrateChart = ({ data }) => {
  const chartData = {
    labels: data.map(d => new Date(d.timestamp).toLocaleTimeString()),
    datasets: [{
      label: 'Hashrate (H/s)',
      data: data.map(d => d.hashrate),
      borderColor: 'rgb(249, 217, 118)',
      backgroundColor: 'rgba(249, 217, 118, 0.1)',
      tension: 0.4
    }]
  };

  const options = {
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#F9D976',
        bodyColor: '#fff'
      }
    },
    scales: {
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.1)' },
        ticks: { color: 'rgba(255, 255, 255, 0.6)' }
      },
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.1)' },
        ticks: { color: 'rgba(255, 255, 255, 0.6)' }
      }
    }
  };

  return <Line data={chartData} options={options} />;
};
```

---

## 📦 Build & Distribution

### Windows Installer

```yaml
# electron-builder.yml - Windows config
win:
  target:
    - nsis
    - portable
  icon: resources/icons/icon.ico
  publisherName: ZION TerraNova
  
nsis:
  oneClick: false
  perMachine: false
  allowToChangeInstallationDirectory: true
  createDesktopShortcut: true
  createStartMenuShortcut: true
  shortcutName: ZION Miner
  installerIcon: resources/icons/installer.ico
  uninstallerIcon: resources/icons/uninstaller.ico
  installerHeaderIcon: resources/icons/header.ico
  license: LICENSE.txt
  warningsAsErrors: false
```

### macOS DMG

```yaml
# electron-builder.yml - macOS config
mac:
  target:
    - dmg
    - zip
  icon: resources/icons/icon.icns
  category: public.app-category.utilities
  hardenedRuntime: true
  gatekeeperAssess: false
  entitlements: build/entitlements.mac.plist
  
dmg:
  contents:
    - x: 130
      y: 220
    - x: 410
      y: 220
      type: link
      path: /Applications
  window:
    width: 540
    height: 380
  backgroundColor: '#000000'
  icon: resources/icons/volume.icns
```

### Linux AppImage

```yaml
# electron-builder.yml - Linux config
linux:
  target:
    - AppImage
    - deb
    - rpm
  icon: resources/icons/
  category: Utility
  
appImage:
  license: MIT
  artifactName: ${productName}-${version}.${ext}
```

### Build Process

```bash
# Full build wszystkich platform (macOS only)
npm run build:all

# Publish na GitHub Releases
GH_TOKEN=your_github_token npm run publish

# Build konkrétní platformy
npm run build:win      # Windows (NSIS + Portable)
npm run build:mac      # macOS (DMG + ZIP)
npm run build:linux    # Linux (AppImage + DEB + RPM)
```

---

## 🔐 Security Considerations

### Wallet Protection

```javascript
// Encrypt wallet address in store
const crypto = require('crypto');
const { machineIdSync } = require('node-machine-id');

const ALGORITHM = 'aes-256-gcm';
const KEY = crypto.scryptSync(machineIdSync(), 'salt', 32);

function encryptWallet(walletAddress) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  
  let encrypted = cipher.update(walletAddress, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return {
    encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex')
  };
}

function decryptWallet(data) {
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    KEY,
    Buffer.from(data.iv, 'hex')
  );
  
  decipher.setAuthTag(Buffer.from(data.authTag, 'hex'));
  
  let decrypted = decipher.update(data.encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
```

### Code Signing

```bash
# Windows Code Signing (Authenticode)
# Vyžaduje certifikát (.pfx) od CA

# electron-builder.yml
win:
  certificateFile: certs/zion-code-signing.pfx
  certificatePassword: ${CERT_PASSWORD}
  signDlls: true
  
# macOS Code Signing (Apple Developer)
mac:
  identity: "Developer ID Application: ZION TerraNova (TEAM_ID)"
  type: distribution
```

---

## 📱 Remote Monitoring Integration

### WebSocket Sync s Web Dashboardem

```javascript
// RemoteSync.js
const WebSocket = require('ws');

class RemoteSync {
  constructor(userId, apiKey) {
    this.userId = userId;
    this.apiKey = apiKey;
    this.ws = null;
  }

  connect() {
    this.ws = new WebSocket('wss://api.zionterranova.com/ws', {
      headers: {
        'X-User-ID': this.userId,
        'X-API-Key': this.apiKey
      }
    });

    this.ws.on('open', () => {
      console.log('Connected to remote dashboard');
      this.sendStats();
    });

    this.ws.on('message', (data) => {
      const command = JSON.parse(data);
      this.handleRemoteCommand(command);
    });
  }

  sendStats() {
    setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: 'stats',
          data: {
            hashrate: getCurrentHashrate(),
            shares: getTotalShares(),
            level: getConsciousnessLevel(),
            uptime: getUptime(),
            hardware: getHardwareInfo()
          }
        }));
      }
    }, 5000); // Every 5 seconds
  }

  handleRemoteCommand(command) {
    switch (command.type) {
      case 'start':
        ipcMain.emit('mining:start');
        break;
      case 'stop':
        ipcMain.emit('mining:stop');
        break;
      case 'config':
        updateConfig(command.data);
        break;
    }
  }
}

module.exports = RemoteSync;
```

---

## 🐛 Debugging & Logging

### Logging System

```javascript
// logger.js
const log = require('electron-log');
const path = require('path');

log.transports.file.level = 'debug';
log.transports.file.maxSize = 10 * 1024 * 1024; // 10MB
log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}';
log.transports.file.file = path.join(app.getPath('userData'), 'logs', 'main.log');

log.transports.console.level = 'debug';

// Usage
log.info('Mining started', { pool: poolUrl });
log.error('Connection failed', { error: err.message });
log.debug('Stats update', { hashrate: 95000 });

module.exports = log;
```

### Crash Reporter

```javascript
// main.js
const { crashReporter } = require('electron');

crashReporter.start({
  productName: 'ZION Miner',
  companyName: 'ZION TerraNova',
  submitURL: 'https://api.zionterranova.com/crashes',
  uploadToServer: true
});
```

---

## 📚 User Documentation

### Installer Průvodce

1. **Windows:**
   - Stáhnout `ZION-Miner-Setup-2.9.0.exe`
   - Spustit installer (může vyžadovat admin)
   - Vybrat instalační složku
   - Zadat wallet adresu při prvním spuštění

2. **macOS:**
   - Stáhnout `ZION-Miner-2.9.0.dmg`
   - Otevřít DMG a přetáhnout do Applications
   - První spuštění: System Preferences → Security → Allow
   - Zadat wallet adresu

3. **Linux:**
   - Stáhnout `ZION-Miner-2.9.0.AppImage`
   - Nastavit executable: `chmod +x ZION-Miner-2.9.0.AppImage`
   - Spustit: `./ZION-Miner-2.9.0.AppImage`

### Quick Start Guide

```markdown
# Quick Start - ZION Desktop Miner

## 1. První spuštění
- Otevřete ZION Miner
- Vložte vaši ZION wallet adresu
- Zvolte pool (doporučeno: pool.zionterranova.com:3333)
- Klikněte "Start Mining"

## 2. Optimalizace výkonu
Settings → Mining:
- Threads: Auto (nebo ručně nastavit)
- Intensity: 80% (nižší pro gaming)
- Algorithm: Auto (nebo konkrétní)

## 3. Gaming Mode
Settings → Gaming:
- ✅ Enable Gaming Mode
- Mining se automaticky pausne při detekci her
- Resume po ukončení hry

## 4. Auto-start
Settings → General:
- ✅ Start with system
- Delay: 30 seconds (optional)

## 5. Monitoring
- Dashboard: Real-time stats
- Tray icon: Quick overview
- Web dashboard: Remote monitoring
```

---

## 🔮 Roadmap

### v2.9.0 (Current) - "Quantum Leap"
- ✅ Electron base setup
- ✅ WARP dashboard design
- ✅ Mining core integration
- ✅ System tray
- ✅ Auto-updater
- ✅ Gaming mode
- ✅ Basic notifications

### v2.9.1 (Q1 2026) - "Enhanced Experience"
- 🔄 Mobile companion app (React Native)
- 🔄 Advanced profit switching
- 🔄 Cloud config sync
- 🔄 Hardware overclocking profiles
- 🔄 Multi-wallet support

### v3.0.0 (Q2 2026) - "AI Optimization"
- 🚀 AI-powered algorithm selection
- 🚀 Predictive maintenance
- 🚀 Smart power management
- 🚀 Benchmark automation
- 🚀 Pool performance scoring

---

## 💡 Best Practices

### Performance Tips
1. **CPU Mining:** Použít všechna vlákna kromě 1-2 (pro OS)
2. **GPU Mining:** Nastavit TDP limit pro lepší efficiency
3. **Cooling:** Monitoring teploty, auto-pause při >85°C
4. **Power:** Noční režim s vyšší intenzitou

### Security Tips
1. **Wallet:** Nikdy neukládat private key v aplikaci
2. **Pool:** Používat whitelisted adresy
3. **Updates:** Vždy verifikovat signature před instalací
4. **Backups:** Pravidelně zálohovat config

### UX Best Practices
1. **Onboarding:** Průvodce při prvním spuštění
2. **Tooltips:** Nápověda u všech nastavení
3. **Validation:** Real-time validace wallet adresy
4. **Feedback:** Vizuální feedback při všech akcích

---

## 📞 Support & Contact

- **Documentation:** https://docs.zionterranova.com
- **Discord:** https://discord.gg/zionterranova
- **GitHub Issues:** https://github.com/Zion-TerraNova/zion-desktop-miner/issues
- **Email:** support@zionterranova.com

---

**Last Updated:** December 16, 2025  
**Version:** 2.9.0 "Quantum Leap"  
**Status:** 📝 Technical Design Complete - Ready for Development

🌟 *Where technology meets spirit* 🌟
