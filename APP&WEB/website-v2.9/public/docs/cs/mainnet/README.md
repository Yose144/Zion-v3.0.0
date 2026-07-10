# ZION MainNet — v3.0.5-beta Status

> **Genesis #0 launched:** June 11, 2026
> **Current version:** v3.0.5-beta (Simplified Community CLI)
> **Status:** Mainnet Beta — live, pool active, mining operational
> **Official public launch:** 31 December 2026

---

## Live Infrastructure

| Service | Status |
|---------|--------|
| **Edge Node 1** | ✅ Active (Primary / Genesis) |
| **Edge Node 2** | ✅ Active (Follower / Peer) |
| **Pool Server** | ✅ Active (`62.171.141.136:8444`) |
| **Web / Dashboard** | ✅ Active (`zionterranova.com`) |
| **Bridge** | ✅ Active (6 chains) |
| **Local Backup Node** | ✅ Syncing |

---

## v3.0.5-beta — What's new

- **Single binary** — no more 8 separate packages, one `zion` binary
- **Interactive menu** — arrow-key navigation, no need to memorize commands
- **Guided setup** — wallet → node → pool → miner, step by step
- **Live dashboard** — `zion monitor` shows node status, miner status, wallet balance
- **Self-contained on Windows** — node, pool, and miner embedded in CLI (10 MB total)
- **GPU mining support** — Metal (macOS), OpenCL/CUDA (Linux), CPU fallback
- **4 platforms** — Linux x86_64, macOS Apple Silicon, macOS Intel, Windows x86_64

---

## Download

| Platform | File | Size |
|----------|------|------|
| Linux x86_64 | `zion-cli-linux-x86_64.tar.gz` | 2.3 MB |
| macOS Apple Silicon (M1–M4) | `zion-cli-macos-aarch64.tar.gz` | 2.1 MB |
| macOS Intel x86_64 | `zion-cli-macos-x86_64.tar.gz` | 2.3 MB |
| Windows x86_64 | `zion-cli-windows-x86_64.zip` | 4.7 MB |
| SHA256 Checksums | `SHA256SUMS.txt` | — |

**Download URL:** https://github.com/Zion-TerraNova/v3-Mainnet/releases/tag/v3.0.5-beta

---

## Mining — Ekam Deeksha

**Algorithm:** Ekam Deeksha — dual-algo PoW: BLAKE3 + RandomNPU

| Backend | Platform | Best for |
|---------|----------|----------|
| `cpu` | All | Default, works everywhere |
| `opencl` | Linux/Windows | AMD + NVIDIA GPU |
| `cuda` | Linux/Windows | NVIDIA GPU |
| `metal` | macOS Apple Silicon | M1–M4 GPU |

**Pool connection:** `stratum+tcp://62.171.141.136:8444`

---

## Block Reward Distribution

| Recipient | Share |
|-----------|-------|
| ⛏️ Miners | 89% |
| 🕊️ Humanitarian Tithe | 5% |
| 🔭 L5/L6 Issobella Fund | 5% |
| 🏊 Pool Fee | 1% |

---

## Canonical Parameters

| Parameter | Value |
|-----------|-------|
| Chain ID | `zion-mainnet-1` |
| Block time | 60 s |
| Block reward | 5,400.067 ZION → Decade Decay (-20%/10 years) |
| Tail emission | 724.784723787776 ZION/block (from ~2126) |
| Total supply | 144,000,000,000 ZION |
| Decimals | 6 (1 ZION = 1,000,000 flowers) |
| Mining horizon | 100+ years + tail ∞ |
| DAA | LWMA (60 blocks, ±25%) |
| Fees | Split 89/5/5/1 |
| Genesis hash | `4f75a0dfe6dde3b167287d445aa1ade56577b0e9166c641ed288b4c20a79bd6e` |

---

*ZION TerraNova MainNet • v3.0.5-beta • updated 10 Jul 2026*
