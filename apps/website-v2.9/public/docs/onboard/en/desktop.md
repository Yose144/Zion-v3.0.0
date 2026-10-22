# ZION Public Miner — Desktop application for beginners

The simplest and fastest way to get started with ZION is the **ZION Public Miner** desktop application. You download it, install it, allow it in your system settings, and within a few minutes you can be mining.

## What is ZION Public Miner?

It is the official desktop client for Windows 11 and macOS, which includes:

- a simple GUI for mining,
- an integrated wallet,
- connection to the public pool,
- CPU and GPU (NVIDIA) mining,
- Bridge, DeFi, and Market directly from the app.

## 1. Download the installer

Go to the GitHub release v3.1.0 desktop:

- `https://github.com/Zion-TerraNova/v3-Mainnet/releases/tag/v3.1.0-desktop`

Choose the file for your system:

| System | File |
|--------|--------|
| Windows 11 (x64) | `zion-public-miner-v3.1.0-windows-x64.exe` |
| macOS (Apple Silicon M1/M2/M3) | `zion-public-miner-v3.1.0-mac-arm64.dmg` |
| macOS (Intel) | `zion-public-miner-v3.1.0-mac-x64.dmg` |

## 2. Install and allow in settings

### Windows 11

1. Run the downloaded `.exe`.
2. The NSIS installer will appear — follow the instructions.
3. If Windows SmartScreen shows a warning "Unrecognized app publisher...":
   - Click **More info**.
   - Then click **Run anyway**.
4. After installation, you'll find the app in the Start menu as **ZION Public Miner**.

### macOS

1. Open the downloaded `.dmg`.
2. Drag the **ZION Public Miner** icon into the **Applications** folder.
3. On first launch, macOS may show a message that the app is not verified:
   - Open **System Settings → Privacy & Security**.
   - Find the message about **ZION Public Miner** and click **Open Anyway**.
   - Alternatively, right-click the app and choose **Open**.
4. On Apple Silicon, you may need to allow apps from the App Store and identified developers.

## 3. First launch and wallet setup

After launching the app for the first time:

1. The app will ask for your **ZION address** (wallet).
2. If you don't have an address yet:
   - Go to the **Wallet** tab in the app.
   - Click **Create Wallet** and write down your seed in a safe place.
   - Copy your public address (`zion1...`) and paste it into the mining settings.
3. Set the **Pool** to the public pool:
   ```
   pool.zionterranova.com:8444
   ```
4. Choose a **Worker Name** — any name for your device, e.g. `my-mac` or `home-pc`.
5. Set the number of **CPU threads** according to your processor's core count.
6. Turn on **GPU** if you have an NVIDIA or Apple Silicon GPU.

## 4. Start mining

1. Click the **Start Mining** button on the main screen.
2. The app will connect to the pool and start showing:
   - current hashrate,
   - accepted shares,
   - estimated earnings.
3. Done — your computer is now mining ZION.

## 5. Quitting and notes

- The app also runs in the system tray / menu bar.
- Mining rewards are automatically credited to your ZION address according to pool payouts.
- For best performance, keep your computer on and connected to the internet.

## Alternative: Linux

For Linux there is a `.AppImage` and a `.deb` package. The process is similar — download, run, and set your address.
