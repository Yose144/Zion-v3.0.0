<p align="center">
  <img src="../assets/logo/Z.gif" alt="ZION" width="120"/>
</p>

<h1 align="center">ZION Desktop Mining Agent v2.9</h1>

<p align="center">
  <strong>Professional desktop application for ZION TerraNova mining with consciousness evolution tracking.</strong>
</p>

## Features

✨ **Complete Mining Solution**
- One-click start/stop mining
- Real-time hashrate monitoring
- Share acceptance tracking
- System tray integration
- Auto-start on launch

🎮 **Consciousness Gamification**
- Live consciousness level tracking
- XP progress visualization
- Spiritual evolution milestones
- Visual progress indicators

📊 **Professional Dashboard**
- Real-time statistics
- Beautiful gradient UI
- Mining logs viewer
- Configuration management

⚙️ **Easy Configuration**
- Simple wallet setup
- Pool configuration
- CPU/GPU toggle
- Thread optimization

## 📦 Installation & Setup

### Prerequisites

**1. Node.js & npm**
```bash
# Check version (need 16.x or higher)
node --version
npm --version

# If not installed, download from: https://nodejs.org
```

**2. Python 3.10+**
```bash
# Check version
python3 --version

# The miner backend requires Python
```

**3. Build Tools**

**macOS:**
```bash
xcode-select --install
```

**Windows:**
```bash
# Install Visual Studio Build Tools
# https://visualstudio.microsoft.com/downloads/
# Select "Desktop development with C++"
```

**Linux:**
```bash
sudo apt-get install build-essential
```

---

## 🚀 Quick Start

### 1. Clone & Install

```bash
# Navigate to desktop-agent folder
cd desktop-agent

# Install dependencies
npm install

# Install Python requirements
cd resources
pip3 install -r requirements.txt
cd ..
```

### 2. Run in Development Mode

```bash
# Start the app (hot-reload enabled)
npm start
```

**First-time setup:**
1. Enter your ZION wallet address
2. Set pool: `pool.zionterranova.com:3333`
3. Choose worker name (e.g., `my-rig-01`)
4. Select CPU/GPU and threads
5. Click "Start Mining" ⛏️

### 3. Build Production Release

**macOS:**
```bash
npm run build:mac
# Output: dist/ZION-Desktop-Agent-2.9.0.dmg
```

**Windows:**
```bash
npm run build:win
# Output: dist/ZION-Desktop-Agent-Setup-2.9.0.exe
```

**Linux:**
```bash
npm run build:linux
# Output: dist/ZION-Desktop-Agent-2.9.0.AppImage
```

---

## ⚙️ Configuration

### Settings Overview

On first launch, configure your settings:

1. **Wallet Address**: Your ZION wallet (ZION_...)
2. **Pool**: pool.zionterranova.com:3333 (default)
3. **Worker Name**: Identifier for this miner
4. **Threads**: CPU cores to use
5. **GPU**: Enable GPU mining (if available)

## System Requirements

- **OS**: Windows 10+, macOS 10.13+, Ubuntu 18.04+
- **RAM**: 4GB minimum
- **CPU**: Multi-core recommended
- **GPU**: NVIDIA/AMD (optional)
- **Python**: 3.10+ (for miner backend)

## Architecture

```
desktop-agent/
├── src/
│   ├── main.js         # Electron main process
│   ├── preload.js      # IPC security bridge
│   └── ui/
│       ├── index.html  # Main UI
│       └── renderer.js # UI logic
└── package.json        # Build config
```

## Features in Detail

### System Tray
- Minimize to tray
- Quick start/stop from tray menu
- Real-time hashrate in tooltip
- Status indicators

### Auto-start
- Launch on system startup
- Start mining automatically
- Background operation

### Logs
- Real-time log streaming
- Color-coded messages
- Open log file button
- Auto-scroll

### Stats Tracking
- Current hashrate (H/s)
- Accepted/rejected shares
- Mining uptime
- Consciousness level & XP

---

## 🔧 Troubleshooting

### Issue: "Python not found"

**Solution:**
```bash
# macOS/Linux
which python3
# Add to PATH if needed

# Windows
where python
# Install from python.org if missing
```

### Issue: "Native module failed to load"

**Solution:**
```bash
# Rebuild native modules
cd desktop-agent
npm rebuild
```

### Issue: "Miner won't start"

**Check:**
1. Python is installed (`python3 --version`)
2. Requirements installed (`pip3 install -r resources/requirements.txt`)
3. Miner script exists (`resources/zion_native_miner_v2_9.py`)
4. Valid wallet address (starts with `ZION_`)

**Logs location:**
- **macOS**: `~/Library/Logs/ZION-Desktop-Agent/`
- **Windows**: `%APPDATA%\ZION-Desktop-Agent\logs\`
- **Linux**: `~/.config/ZION-Desktop-Agent/logs/`

### Issue: "GPU not detected"

**Solution:**
```bash
# Check GPU drivers
# NVIDIA: nvidia-smi
# AMD: rocm-smi

# Install CUDA/ROCm if needed
```

### Issue: "App won't build"

**macOS:**
```bash
# Sign with Apple Developer cert
export CSC_IDENTITY_AUTO_DISCOVERY=false
npm run build:mac
```

**Windows:**
```bash
# Disable code signing temporarily
set CSC_IDENTITY_AUTO_DISCOVERY=false
npm run build:win
```

---

## 📚 Advanced Usage

### Custom Miner Configuration

Edit `resources/config.json`:
```json
{
  "algorithm": "cosmic_harmony",
  "threads": 4,
  "gpu": true,
  "log_level": "info"
}
```

### Command-Line Mining (without GUI)

```bash
cd resources
python3 zion_native_miner_v2_9.py \
  --pool pool.zionterranova.com:3333 \
  --wallet YOUR_ZION_ADDRESS \
  --worker my-worker
```

---

## 🛠️ Development

Built with:
- **Electron** 34.0.0 - Desktop framework
- **electron-builder** - Packaging
- **Native HTML/CSS/JS** - No heavy frameworks

### Development Scripts

```bash
npm start         # Run in dev mode
npm run build     # Build for current platform
npm run build:all # Build for all platforms (Mac only)
npm run lint      # Check code style
```

### Project Structure

```
desktop-agent/
├── src/
│   ├── main.js          # Electron main (Node.js)
│   ├── preload.js       # IPC bridge
│   ├── wallet-generator.js # ZION wallet utils
│   └── ui/
│       ├── index.html   # Main UI
│       └── renderer.js  # UI logic (browser context)
├── resources/
│   ├── zion_native_miner_v2_9.py  # Python miner
│   ├── requirements.txt           # Python deps
│   └── mining/          # Native libs (compile needed)
└── package.json         # Electron config
```

---

## 📜 License

MIT - See LICENSE file

## Support

- Website: https://zionterranova.com
- Pool: pool.zionterranova.com:3333
- Docs: https://zionterranova.com/docs

---

**ZION TerraNova v2.9** - Where Technology Meets Spirit 🌟
