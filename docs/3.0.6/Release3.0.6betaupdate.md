# ZION v3.0.6-beta — Public Release Update

**Release date:** 21 July 2026
**Tag:** `v3.0.6-beta` (prerelease)
**Repository:** [github.com/Zion-TerraNova/v3-Mainnet](https://github.com/Zion-TerraNova/v3-Mainnet)
**Release URL:** [v3.0.6-beta](https://github.com/Zion-TerraNova/v3-Mainnet/releases/tag/v3.0.6-beta)
**Status:** Published (prerelease) — Mainnet Beta, mine and transact at your own risk

---

## 1. Release Summary

ZION v3.0.6-beta introduces the **Trinity** mining engine and
publishes the canonical whitepaper collection to the public repository.

### What was released

| Component | Description | Status |
|-----------|-------------|--------|
| **Miner binary** | `zion-miner-linux-x86_64.tar.gz` (3.4 MB) | Published |
| **SHA256 checksum** | `SHA256SUMS.txt` | Published |
| **Release notes** | Full quick-start guide, GPU requirements, troubleshooting | Published |
| **Whitepapers** | 11 documents in `public/docs/WP/` (CZ + EN) | Published |
| **Source code** | `public_build` feature flag, GPU kernels, native hashers | Published |

### Key features

- **Trinity engine** — GPU + CPU mine simultaneously; the pool handles
  all conversions internally so the miner only sees ZION earnings.
- **Zion Grow** — continuous mining compounds the miner's ZION position.
- **Zion Liquidity** — every hash deepens the ZION liquidity pool; zero sell
  pressure on the open market.
- **`public_build` feature** — the public binary contains full Trinity
  support but the TUI displays only "ZION / Deeksha Lite v1". No external
  coin names, algorithms, or internal mechanics are visible to the user.

---

## 2. Binary Verification

| Field | Value |
|-------|-------|
| File | `zion-miner-linux-x86_64.tar.gz` |
| Size | 3,377,554 bytes (3.4 MB) |
| SHA256 | `ad1b6be71be7046f0a77be445089f637587c43e36e6ace00532696a3b3217f44` |
| Platform | Linux x86_64 only |
| License | MIT (binary); Trinity engine source is proprietary |

### Verify the download

```bash
wget https://github.com/Zion-TerraNova/v3-Mainnet/releases/download/v3.0.6-beta/zion-miner-linux-x86_64.tar.gz
sha256sum zion-miner-linux-x86_64.tar.gz
# Must match: ad1b6be71be7046f0a77be445089f637587c43e36e6ace00532696a3b3217f44

tar xzf zion-miner-linux-x86_64.tar.gz
chmod +x zion-miner
./zion-miner --version
# Should print: zion-miner 3.0.6
```

---

## 3. Build Instructions (reproducible)

The public binary is built with the `public_build` feature flag, which
hides Trinity internals in the TUI while keeping the full engine
active internally.

### Prerequisites

- Rust stable (latest)
- OpenCL headers (`rocm-opencl-dev` on Ubuntu/AMD, `nvidia-opencl-dev` on NVIDIA)
- Linux x86_64

### Build commands

```bash
# From the repository root
cd V3

# Public build (Trinity hidden in TUI)
cargo build --release -p zion-miner \
    --features public_build,gpu-opencl,native-hashers,native-verushash,native-randomx

# Binary location
ls -la target/release/zion-miner
```

### Package and checksum

```bash
# Package
tar czf zion-miner-linux-x86_64.tar.gz \
    -C target/release zion-miner

# SHA256
sha256sum zion-miner-linux-x86_64.tar.gz > SHA256SUMS.txt
```

### Build script

A reproducible build script is included at
[`MinerP3.0.6/build.sh`](./MinerP3.0.6/build.sh):

```bash
./MinerP3.0.6/build.sh
# Output: MinerP3.0.6/dist/zion-miner-linux-x86_64.tar.gz
#         MinerP3.0.6/dist/SHA256SUMS.txt
```

---

## 4. GitHub Release Process

### Create the release

```bash
gh release create v3.0.6-beta \
    --repo Zion-TerraNova/v3-Mainnet \
    --title "ZION v3.0.6-beta — Trinity Miner" \
    --notes-file MinerP3.0.6/RELEASE_NOTES.md \
    --prerelease \
    MinerP3.0.6/dist/zion-miner-linux-x86_64.tar.gz \
    MinerP3.0.6/dist/SHA256SUMS.txt
```

### Update an existing release

```bash
# Upload a new asset to an existing release
gh release upload v3.0.6-beta \
    --repo Zion-TerraNova/v3-Mainnet \
    zion-miner-linux-x86_64.tar.gz \
    SHA256SUMS.txt \
    --clobber

# Edit release notes
gh release edit v3.0.6-beta \
    --repo Zion-TerraNova/v3-Mainnet \
    --notes-file MinerP3.0.6/RELEASE_NOTES.md
```

### Verify the release

```bash
gh release view v3.0.6-beta --repo Zion-TerraNova/v3-Mainnet
gh release download v3.0.6-beta --repo Zion-TerraNova/v3-Mainnet \
    -p "SHA256SUMS.txt" -O -
```

---

## 5. Public Repository Sync

The `public/` directory is a git subtree of
`github.com/Zion-TerraNova/v3-Mainnet`. After any change to files inside
`public/`, sync to the public repo:

### Two-step push

```bash
# 1. Commit to private repo (origin)
git add public/docs/WP/
git commit -m "docs(WP): publish canonical whitepapers to public/docs/WP/"
git push origin main

# 2. Subtree push to public repo
git subtree push --prefix=public public main
```

### Subtree commands reference

```bash
# Pull latest from public repo into public/
git subtree pull --prefix=public public/main --squash

# Push local changes in public/ to the public repo
git subtree push --prefix=public public main

# Fetch public remote (update refs without merging)
git fetch public
```

### What is in public/ (safe for public release)

- `V3/` — L1 core, L2 contracts, bridge, DAO, atomic-swap, cosmic-harmony,
  pool, miner, CLI, SDK, docs
- `docs/` — Whitepapers, Ethics & Philosophy, Bodhisattva Vow codex,
  genesis.md, legal docs, security disclosures, multilingual READMEs
- `docs/WP/` — Canonical whitepaper collection (this release)
- `evoluZionV2.md` — PoW → Proof-of-Care vision
- Root files: `README.md`, `README_FULL.md`, `SECURITY.md`,
  `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `LICENSE` (MIT), `Cargo.toml`

### What is NOT in public/ (stays private)

- `APP&WEB/` — website, desktop agent, mobile app source
- `ZION_OS/` — dashboard, monitoring, operational scripts
- `ZionStart/` — bootstrap tooling
- `PoC-lab/` — research/proof-of-concept code
- `HiranV2.x/` — AI layer (IP protection)
- `edge-deploy/` — server deploy configs
- `scripts/` — ops scripts
- `MinerP3.0.6/` — internal build scripts (the binary itself is public)
- Server configs, deploy scripts, environment files, private keys

---

## 6. Published Whitepapers (`public/docs/WP/`)

This release publishes the canonical whitepaper collection — 11 documents
in Czech and English:

### Master / Canonical Synthesis

| Document | Language | Description |
|----------|----------|-------------|
| `ZION_MASTER_WHITEPAPER_3.1_CZ.md` | Czech | The Golden Book — synthesis of all four ZION books for Mainnet Alpha 3.1 |
| `ZION_MASTER_WHITEPAPER_3.1_EN.md` | English | English translation of the Golden Book |

### Story / Narrative

| Document | Language | Description |
|----------|----------|-------------|
| `ZION_Kniha_Zrozeni_v3.0_CZ.pdf` | Czech | Book of Genesis — origin story, algorithm, Golden Egg, six layers |
| `ZION_Book_of_Genesis_v3.0_EN.pdf` | English | English translation of the Book of Genesis |
| `Zion-WpLite_CZ.pdf` | Czech | Fable Edition — fairy tale with verifiable chronicle entries |
| `Zion-WpLite_EN.pdf` | English | English translation of the Fable Edition |
| `WpStory6_CZ.md` | Czech | Chronicle addendum: v3.0.1 → v3.0.6-beta, Three Streams of One River |
| `WpStory6_EN.md` | English | English translation of the chronicle addendum |

### Technical

| Document | Language | Description |
|----------|----------|-------------|
| `ZION_Technical_Whitepaper_v3.1_CZ.md` | Czech | Canonical technical reference |
| `ZION_Technical_Whitepaper_v3.1_EN.md` | English | English translation |

### PDF generation

PDFs are generated on Linux via `fpdf2` + DejaVu fonts:

```bash
# Install fpdf2
pip3 install --user --break-system-packages fpdf2

# Generate all 4 PDFs (CZ + EN)
python3 docs/WP-Mainet/generate_genesis_pdfs.py
python3 docs/WP-Mainet/generate_wplite_pdfs.py
```

---

## 7. Confidentiality Review

Before publishing, all documents were reviewed for confidential
information leaks.

### Verified clean (0 matches)

- External coin names (ZANO, VRSC, Verus, Monero, XMR, etc.)
- Algorithm internals (ProgPoW, kernel details, DAG, nonce patterns)
- Server details (IPs beyond the public pool address, hostnames, SSH keys)
- Internal pool addresses, conversion rates, hashrate internals
- Private keys, mnemonics, seed phrases
- Deploy scripts, ops configs, fail2ban, VNC, TeamViewer

### Acceptable matches (already public in v3.0.5)

- Pool address `62.171.141.136:8444` — public since v3.0.5
- Genesis hash `4f75a0dfe6dde3b167287d445aa1ade56577b0e9166c641ed288b4c20a79bd6e`
- Contract addresses on Basescan (verifiable on-chain)
- Security disclosure IDs (ZION-2026-001…005) — public by design
- "TeamViewer compromise | Removed" — historical, no active details

### `public_build` feature flag

The public binary contains the full Trinity engine but the TUI
displays only "ZION / Deeksha Lite v1":

- Header shows "ZION MINER" (not "ZION MINER | TRINITY")
- Only Stream 1 (ZION/Deeksha) is displayed; Streams 2 and 3 are hidden
- All shares display as "ZION" regardless of which stream found them
- Sticky stats box shows "ZION v3.0.6 Miner" and filters to ZION stream only

Trinity still runs internally — only the display is suppressed.

---

## 8. Miner Quick Start (for end users)

### Step 1: Download and verify

```bash
wget https://github.com/Zion-TerraNova/v3-Mainnet/releases/download/v3.0.6-beta/zion-miner-linux-x86_64.tar.gz
sha256sum zion-miner-linux-x86_64.tar.gz
# Must match: ad1b6be71be7046f0a77be445089f637587c43e36e6ace00532696a3b3217f44

tar xzf zion-miner-linux-x86_64.tar.gz
chmod +x zion-miner
```

### Step 2: Create a wallet

```bash
# Download the community CLI (v3.0.5-beta) for wallet creation
wget https://github.com/Zion-TerraNova/v3-Mainnet/releases/download/v3.0.5-beta/zion-cli-linux-x86_64.tar.gz
tar xzf zion-cli-linux-x86_64.tar.gz
chmod +x zion

# Create wallet — WRITE DOWN the 24-word recovery phrase on paper!
./zion wallet new --mnemonic --out my-wallet.json
./zion wallet info --wallet my-wallet.json
# Your address starts with "zion1..."
```

### Step 3: Start mining

```bash
./zion-miner \
    --pool 62.171.141.136:8444 \
    --wallet zion1YOUR_WALLET_ADDRESS \
    --worker my-rig \
    --gpu opencl \
    --algorithm deeksha_lite_v1 \
    --profile pool
```

The miner displays a live dashboard: ZION hashrate, accepted/rejected
shares, pool height, and uptime.

### All options

```bash
--pool <addr>          Pool address (default: 62.171.141.136:8444)
--wallet <addr>        Your ZION wallet address
--worker <name>        Worker name (default: local-gpu)
--gpu <backend>        GPU backend: opencl, cuda, cpu (default: opencl)
--algorithm <algo>     Algorithm: deeksha_lite_v1 (default)
--profile <mode>       Mining mode: pool, benchmark (default: pool)
--loops <n>            Number of mining loops (default: 999999)
```

---

## 9. GPU Requirements

| GPU | Minimum | Recommended |
|-----|---------|-------------|
| **AMD** | RX 560 (4GB) | RX 5600 XT / 5700 XT (6GB+) |
| **NVIDIA** | GTX 1060 (6GB) | RTX 3060 (12GB) |
| **RAM** | 8GB | 16GB+ |
| **OS** | Ubuntu 20.04+ | Ubuntu 22.04+ |
| **Driver** | AMDPRO 22.x+ / NVIDIA 525+ | Latest |

### Performance reference

| GPU | Algorithm | Hashrate |
|-----|-----------|----------|
| RX 5600 XT | Deeksha Lite v1 | 34 KH/s (solo) / 17 KH/s (Trinity) |
| RX 5700 XT | Deeksha Lite v1 | 28-30 KH/s |

> **AMD users:** Install AMDPRO (ROCm) driver for best performance.
> OpenCL 2.0+ required.

---

## 10. Troubleshooting

### Miner hangs on startup

```bash
# Check GPU is detected
clinfo -l

# If no GPU detected, install AMDPRO driver:
# Ubuntu: sudo apt install rocm-opencl-dev
```

### Low hashrate

```bash
# Check GPU is being used — the dashboard shows "GPU OPENCL" if active
# Try different work sizes
export ZION_GPU_WORK_SIZE=8192    # Default for 18 CU GPUs
export ZION_NONCE_COUNT=32768     # 4x work_size
```

### Connection refused

```bash
# Check pool is reachable
nc -zv 62.171.141.136 8444

# If connection fails, check your firewall or try again later
```

---

## 11. Post-Release Checklist

### Done

- [x] Build public binary with `public_build` feature
- [x] Compute SHA256 checksum
- [x] Create GitHub release `v3.0.6-beta` (prerelease)
- [x] Upload binary + SHA256SUMS.txt
- [x] Publish release notes
- [x] Generate PDF whitepapers (CZ + EN)
- [x] Create canonical technical whitepaper v3.1 (CZ + EN)
- [x] Create Master Whitepaper / Golden Book (CZ + EN)
- [x] Create WpStory6 chronicle addendum (CZ + EN)
- [x] Copy all whitepapers to `public/docs/WP/`
- [x] Confidentiality review (0 sensitive leaks)
- [x] Fact consistency check (genesis hash, supply, split, rewards)
- [x] Commit to private repo (`origin/main`)
- [x] Subtree push to public repo (`public/main`)

### Pending (future releases)

- [ ] macOS build (Apple Silicon + Intel) — target v3.0.7
- [ ] Windows build — target v3.0.7
- [ ] ARM64 build (Raspberry Pi) — target v3.0.7
- [ ] External security audit (Trail of Bits / Halborn / OtterSec) — Q3 2026
- [ ] Mobile wallet (iOS + Android) — Q3 2026
- [ ] Mainnet Alpha 3.1 public launch — 31 December 2026

---

## 12. Commit History (this release)

| Commit | Description |
|--------|-------------|
| `6ac734af9` | release: v3.0.6-beta Trinity Miner + public_build feature |
| `49005b86d` | docs(whitepaper): add WpStory6 canonical addendum (CZ+EN) |
| `a407361df` | docs(whitepaper): ZION Master Whitepaper for Mainnet Alpha 3.1 (CZ+EN) |
| `ffbd72271` | docs(WP): publish canonical whitepapers to public/docs/WP/ (CZ+EN) |
| `ed0b7afff` | docs(WP): add Master Whitepaper (Golden Book) CZ+EN to public/docs/WP/ |

---

## 13. Support

- **Documentation:** [docs.zionterranova.com](https://docs.zionterranova.com)
- **Website:** [zionterranova.com](https://zionterranova.com)
- **Pool:** `62.171.141.136:8444`
- **RPC:** `rpc.zionterranova.com:8443`
- **Source code:** [github.com/Zion-TerraNova/v3-Mainnet](https://github.com/Zion-TerraNova/v3-Mainnet)
- **Whitepapers:** [docs/WP/](./public/docs/WP/)

---

## 14. License

- **ZION blockchain core, pool, community CLI:** MIT License
- **Miner binary:** MIT License
- **Trinity engine source:** Proprietary (not included in public repo)
- **Whitepapers:** MIT License

---

*Mine ZION. Earn ZION. Grow ZION.*

*Gate, Gate, Paragate, Parasamgate, Bodhi Svaha.*
