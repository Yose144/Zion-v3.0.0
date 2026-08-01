# ZION Public Desktop Miner v3.0.6

Public-facing desktop mining GUI for ZION TerraNova.

This public-facing desktop agent **shows only the ZION/Deeksha work stream in the UI** and hides all Trinity/AuxPoW external coin names (ZANO, VRSC, XMR, RTM, KAS, etc.). The packaged `zion-miner` binary is compiled with the `public_build` Rust feature and still mines the external GPU and CPU streams in the background for revenue.

---

## Features

- One-click start/stop mining
- Real-time hashrate and share tracking
- CPU and NVIDIA GPU mining toggle
- System tray integration
- Configuration persistence
- Linux AppImage + DEB packages

---

## 📦 Installation

### Download

Pre-built artifacts are attached to the `Zion-TerraNova/v3-Mainnet` GitHub release:

- `zion-public-miner-v3.0.6-linux-x86_64.AppImage`
- `zion-public-miner-v3.0.6-linux-amd64.deb`

### AppImage

```bash
chmod +x zion-public-miner-v3.0.6-linux-x86_64.AppImage
./zion-public-miner-v3.0.6-linux-x86_64.AppImage
```

If `libfuse2` is missing:

```bash
sudo apt install libfuse2
```

### Debian / Ubuntu

```bash
sudo dpkg -i zion-public-miner-v3.0.6-linux-amd64.deb
sudo apt-get -f install
zion-public-miner
```

---

## 🚀 Quick Start

1. Launch the application.
2. Enter your ZION wallet address (`ZION_...`).
3. Set pool to `62.171.141.136:8444` (default).
4. Choose a worker name.
5. Adjust CPU threads and enable GPU if available.
6. Click **Start Mining**.

---

## ⚙️ Configuration

The first time the app runs it asks for:

- **Wallet Address** — your ZION address
- **Pool** — `62.171.141.136:8444`
- **Worker Name** — identifier for this rig
- **Threads** — number of CPU threads
- **GPU** — enable if an NVIDIA GPU and CUDA drivers are present

Configuration is stored under:

- **Linux:** `~/.config/zion-public-miner/`
- **macOS:** `~/Library/Application Support/zion-public-miner/`
- **Windows:** `%APPDATA%\zion-public-miner\`

---

## 🛠️ Build from source

See [`BUILD_GUIDE.md`](BUILD_GUIDE.md) for detailed build instructions per platform.

Quick Linux build:

```bash
cd DesktopAgentP3.0.6
./build.sh
```

---

## 🖥️ Development

```bash
npm ci
npm run dev        # development mode
npm run build:linux
```

---

## 🔧 Troubleshooting

### App does not start on Wayland / NVIDIA

The app re-execs itself with `--ozone-platform=x11 --disable-gpu-sandbox` on Linux. If it still fails, launch manually:

```bash
./zion-public-miner-v3.0.6-linux-x86_64.AppImage --no-sandbox --ozone-platform=x11 --disable-gpu-sandbox
```

### Missing FUSE

```bash
sudo apt install libfuse2
```

### Miner does not start

- Ensure a valid ZION wallet address is set.
- Check logs in the configuration directory.
- Verify the pool is reachable: `nc -vz 62.171.141.136 8444`.

---

## 📚 Project structure

```
DesktopAgentP3.0.6/
├── build.sh              # Linux build + SHA256
├── BUILD_GUIDE.md        # Detailed build instructions
├── RELEASE_NOTES.md      # Release notes
├── src/
│   ├── main.js           # Electron main process
│   ├── preload.js        # IPC bridge
│   └── ui/
│       ├── index.html    # Main UI
│       └── renderer.js   # UI logic
└── package.json          # Electron / build config
```

---

## 📜 License

MIT — see top-level `LICENSE`.

## Support

- Website: https://zionterranova.com
- Pool: `62.171.141.136:8444`
- RPC: `rpc.zionterranova.com:8443`
