# ZION v3.2.0 — Boost Miner (V31)

**Mine ZION. Earn ZION. Grow ZION.**

> **⚠️ Mainnet Alpha — mine and transact at your own risk**
> The V31 network is live and producing blocks. Genesis chain is permanent.

---

## What's new in v3.2.0?

### Canonical Ekam Deeksha v3.2 PoW

ZION blocks are now mined exclusively with the canonical, ASIC-hardened
`EkamDeeksha` v3.2 algorithm: 512 KiB scratchpad, 2 passes (forward +
backward), 128 random reads per pass. This replaces the earlier Deeksha
Lite v1 (128 KiB) algorithm used in v3.0.x/v3.1.x public builds.

### One-click GPU auto-detect

| Platform | NVIDIA | AMD / Intel | Apple Silicon |
|----------|--------|-------------|----------------|
| Linux x86_64 | CUDA | OpenCL | — |
| Windows x86_64 | CUDA | OpenCL | — |
| macOS aarch64 | — | OpenCL (legacy) | Metal |
| macOS x86_64 | — | OpenCL (legacy) | Metal |

No flags needed — `zion-miner` picks CUDA → OpenCL → Metal → CPU
automatically. Note: Metal GPU mining for Ekam Deeksha v3.2 is disabled on
Apple Silicon (CPU is 8-10x faster for this workload on M-series chips);
the miner falls back to CPU automatically for Stream 1 on those machines.

### Public build (Boost branding)

This is the **public-facing** miner. The TUI, banner, setup menu, and all
logs show only **ZION** plus **BOOST 1** / **BOOST 2** for the two
auxiliary revenue streams. The merged-mining backend still runs exactly
as before to optimize total revenue, but:

- no external coin ticker is ever displayed to the user;
- no internal job id or stratum pool URL is ever printed to stdout or the
  application logs in the public build.

### Unified native algorithms

Builds include `native-all` + `native-hashers`: VerusHash, RandomX,
GhostRider, Etchash, KawPow, Autolykos, kHeavyHash, BLAKE3, Cosmic
Harmony/Ekam Deeksha.

---

## Build information

Binaries are built from the ZION V31 workspace using:

- `public_build` — public Boost branding + log masking
- Per-platform GPU backends: CUDA/OpenCL on Linux/Windows, Metal/OpenCL on macOS
- `tui` — interactive terminal dashboard
- `native-all` — RandomX, GhostRider, VerusHash, Etchash, KawPow, Autolykos,
  kHeavyHash, BLAKE3, Ekam Deeksha native implementations

See `build-macos.sh`, `build-linux.sh`, `build-windows.sh`.

---

## Support

- Website: [zionterranova.com](https://zionterranova.com)
- Explorer: [app.zionterranova.com](https://app.zionterranova.com)
- Pool: `stratum.zionterranova.com:8444`
- RPC: `rpc.zionterranova.com:8443`
