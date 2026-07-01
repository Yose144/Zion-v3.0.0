# Zion — Quick Start Guide & FAQ (for Everyone)

> **Last updated:** 2026-06-07  
> **What you need:** Windows 11, internet connection, and about 10 minutes of patience.
> **Active chain:** Genesis `7543004c` · Consensus `deeksha_lite_v1` · Pool: `77.42.71.94:8444`

---

## What is Zion?

Zion is a decentralized blockchain network. You can run a **node** (a copy of the network ledger) and/or a **miner** (a program that helps secure the network and earns rewards). Everything is open-source and runs on your own computer.

---

## What do I need?

| Thing | Why | Do I need it? |
|-------|-----|---------------|
| **Windows 11** | The easiest way to run Zion right now | Yes (for this guide) |
| **Rust** | Compiles the Zion programs (`node`, `miner`) | Yes — install from [rustup.rs](https://rustup.rs) |
| **Python 3** | Only if you want the web dashboard | Optional |
| **Git** | To download the code | Optional — you can also download a ZIP |
| **Good internet** | To sync with the network | Yes |

---

## Step 1: Get the code

Open **PowerShell** or **Command Prompt** and run:

```powershell
cd C:\Users\%USERNAME%\Desktop
git clone https://github.com/ZionTerranova/zion-2.9.6-main.git
```

Or just download the ZIP from GitHub and extract it to your Desktop.

---

## Step 2: Install Rust (one-time only)

1. Go to [rustup.rs](https://rustup.rs)
2. Download and run `rustup-init.exe`
3. Choose option **1** (default installation)
4. Restart your terminal / PC when it asks

Check it worked:

```cmd
cargo --version
```

You should see something like `cargo 1.82.0`.

---

## Step 3: The super-easy launch

In the root of the folder you just downloaded, double-click this file:

```
start-zionos-dashboard.bat
```

It will:
1. Check that Rust is installed
2. Build the `node` and `miner` programs (this takes a few minutes the **first time only**)
3. Open two windows:
   - **Node** — keeps a copy of the blockchain and talks to the network
   - **CPU Miner** — starts helping secure the network

That’s it. You are now running Zion.

---

## Step 4: Open the interactive control panel (Zion CLI)

Zion also has a **command-line control panel** that works like a video-game menu — you move with your arrow keys.

Double-click this file in the same root folder:

```
start-zion-cli.bat
```

It will:
1. Build the `zion` CLI tool (first time only, ~2–5 minutes)
2. Open the **interactive menu** where you can:
   - Check network status
   - Browse blocks
   - Manage wallets
   - Run diagnostics

> **Tip:** If you prefer typing commands instead of arrow keys, close the menu and type `zion --help` inside the same window.

---

## What should I see?

After running the `.bat` file you will have two new command windows:

### Node window
- It connects to the **Edge server** (`77.42.71.94:8333`) to download the latest blocks
- Your local RPC is at: `http://127.0.0.1:8443`
- It creates a small database file in `V3/data/zion-node-state.db`

### Miner window
- It connects to the public pool at `77.42.71.94:8444`
- It starts searching for valid hashes (this is called "mining")
- By default it uses your **CPU** with 2 threads

---

## How do I know it is working?

Look at the **miner** window. If you see lines like:

```
[miner] connected to 77.42.71.94:8444
[miner] received job ...
```

…then everything is fine.

If you want numbers, open your browser and go to:

```
http://127.0.0.1:8443
```

(That is your local node speaking JSON-RPC. You can use it with wallets or explorers.)

---

## Controlling Zion from the command line (Zion CLI)

Besides the `.bat` launcher, Zion has a powerful command-line tool called **`zion`**. It lets you talk to your running node, check health, manage wallets, and more — all without touching the code.

### How to run it

Open **PowerShell** or **Command Prompt** inside the repo folder and type:

```cmd
cargo run --manifest-path V3/Cargo.toml -p zion-cli -- --help
```

After the first build you can also run it directly from the release folder:

```cmd
V3\target\release\zion-cli.exe --help
```

### Everyday commands (copy & paste)

```cmd
:: Check if everything is healthy
zion status

:: Run a quick diagnostic (config, ports, tools)
zion doctor

:: Open the interactive arrow-key menu
zion menu

:: Open the block explorer inside your terminal
zion explorer

:: Watch all layers live in a TUI dashboard
zion monitor

:: Open the web dashboard in your browser
zion dashboard
```

### Wallet basics

```cmd
:: Create a new wallet
zion wallet create --name my-wallet

:: Show your address and balance
zion wallet info

:: List all wallets
zion wallet list
```

### Node commands

```cmd
:: Query chain height
zion node height

:: Show connected peers
zion node peers

:: Get info about a transaction
zion node tx <tx-hash>
```

### Miner commands

```cmd
:: Start the miner through the CLI (same as the .bat, but with logs inside terminal)
zion mine start

:: Show miner stats
zion mine status

:: Benchmark your GPU/CPU
zion mine benchmark
```

> **Tip:** If you forget a command, just type `zion --help` or `zion <command> --help`. The CLI tells you everything it can do.

---

## How do I switch to GPU mining?

The default is CPU because it works on every PC. If you have an AMD or NVIDIA graphics card and want more speed:

1. Close the miner window
2. Open `start-zionos-dashboard.bat` in a text editor
3. Find these two lines inside the file:

```bat
set ZION_GPU_BACKEND=cpu
set ZION_MINER_ID=w11-cpu-miner-01
```

4. Change them to:

```bat
set ZION_GPU_BACKEND=opencl
set ZION_MINER_ID=w11-gpu-miner-01
```

5. Save and double-click the `.bat` again.

> **Note:** GPU mining needs working OpenCL drivers. Most modern AMD/NVIDIA cards have them by default. If it fails, switch back to `cpu`.

---

## Frequently Asked Questions (FAQ)

### Q: Is this safe? Will it break my PC?
**A:** Yes, it is safe. Zion only uses your CPU/GPU to do math (hashing). It does not install anything into Windows system folders. It does not need Administrator rights. Your PC will not overheat — modern hardware has built-in thermal protection. If you are worried, use **CPU mode** and limit threads in the `.bat` file (`ZION_MINER_THREADS=2`).

### Q: Do I need to open ports in my router?
**A:** No. The node **outbound** connects to the Edge seed (`77.42.71.94:8333`), so it works behind a normal home router without port forwarding. If you want other people to connect **to you**, then yes, you would need to forward port `8333` — but that is optional.

### Q: How much internet does it use?
**A:** Very little. The blockchain data is small (megabytes, not gigabytes). The miner sends tiny "share" packets every few seconds. A normal home internet connection is more than enough.

### Q: Can I close the windows?
**A:** Yes. If you close the **node** window, your local copy of the chain stops syncing. If you close the **miner** window, you stop mining. You can restart both anytime by running the `.bat` again.

### Q: Where are my earnings / wallet?
**A:** This guide is about **running the software**. Wallet setup, receiving addresses, and reward payouts are handled by the pool operator and the Zion CLI. For wallet commands see the `V3/cli` directory or ask in the community channel.

> **Important:** When connecting to the pool, you **must** set `ZION_PAYOUT_ADDRESS` to a valid 44-char `zion1...` address. The pool will close the connection if this is missing or invalid — this is a security requirement, not a bug.

### Q: The first build takes forever. Is it broken?
**A:** No. Rust compiles everything from source. The first build can take **2–10 minutes** depending on your CPU. After that, the `.bat` finds the already-built files and starts instantly.

### Q: I see "connection refused" or "timeout"
**A:** Check that:
- Your internet is on
- Windows Firewall is not blocking the programs (allow `node.exe` and `zion-miner.exe` if prompted)
- The Edge server is online (it usually is, but rare maintenance happens)

### Q: Can I run this on Linux or macOS?
**A:** The core Rust code is cross-platform. This particular `.bat` file is Windows-only. On Linux/macOS you can run the same commands manually — see `AGENTS.md` and the `V3/` README for shell equivalents.

### Q: What is the "Edge server"?
**A:** Edge (`77.42.71.94`) is a public Zion node run by the core team on a VPS (Hetzner). It acts as a "seed" — the first friend your node talks to so it can find the rest of the network. You do **not** need to trust it; your node validates everything locally.

### Q: Can I mine on multiple PCs?
**A:** Yes. Run the `.bat` on each PC. Give each miner a unique name by changing `ZION_WORKER_NAME` and `ZION_MINER_ID` in the `.bat` file.

### Q: What if I only want the dashboard, not mining?
**A:** The `.bat` currently starts both node and miner. If you only want to **watch** the network, you can run the Python dashboard manually:

```cmd
cd ZION_OS\dashboard
python app.py
```

Then open `http://127.0.0.1:8766` in your browser.

---

## Troubleshooting Cheatsheet

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| `cargo not found` | Rust not installed or not in PATH | Reinstall Rust, restart PC |
| `node.exe` crashes on start | Port 8333 or 8443 already in use | Close other Zion instances |
| Miner says `Bye` every second | `ZION_LOOP_COUNT` is too low (default was 1 in old versions) | Our `.bat` already sets it to `1000000` |
| Very low hashrate (30 H/s) | Same as above — constant reconnects | Check the `.bat` has `ZION_LOOP_COUNT=1000000` |
| `OpenCL` errors | Missing/broken GPU drivers | Switch to `ZION_GPU_BACKEND=cpu` |
| Dashboard shows no data | Node not running or RPC blocked | Make sure the node window is open and firewall allows port 8443 |
| Pool closes connection |  missing or invalid | Set valid 44-char  address in  |
| Node stuck at height 0 / wrong genesis | State DB from old chain | Delete  and restart |

---

## Useful links

- **Main code & docs:** `V3/README.md`
- **Agent / operator docs:** `AGENTS.md`
- **Windows stack (legacy):** `scripts/start-windows-stack.bat`
- **Desktop dashboard (Tauri):** `ZION_OS/desktop/`
- **Status & launch blockers:** `StatusV3.md`

---

*If something is missing from this guide, open an issue or ask in the Zion community channels.*
