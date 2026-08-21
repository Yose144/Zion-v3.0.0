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

This is the **public-facing** miner (`public_build` Cargo feature). The
TUI, banner, setup menu, and all logs show only **ZION** plus **BOOST 1**
/ **BOOST 2** for the two auxiliary revenue streams. Stream 2 (GPU AuxPoW)
and Stream 3 (CPU AuxPoW) still run internally exactly as before to
optimize total revenue, but:

- no external coin ticker (ZANO, VRSC, KAS, RVN, etc.) is ever displayed;
- no AuxPoW/Trinity tracing or stdout log line reveals a coin name, job
  id, or stratum pool URL (see `crate::ext_log` in
  `V31/L1/miner/src/ext_log.rs`).

### Unified native algorithms

Builds include `native-all` + `native-hashers`: VerusHash, RandomX,
GhostRider, Etchash, KawPow, Autolykos, kHeavyHash, BLAKE3, Cosmic
Harmony/Ekam Deeksha.

---

## Build information

Binaries are built from the `V31/` workspace using:

- `public_build` — public Boost branding + log masking
- `full` — OpenCL + CUDA + Metal + all native algorithms
- `tui` — interactive terminal dashboard

See `V31/release/build-macos.sh`, `build-linux.sh`, `build-windows.sh`.

---

## Support

- Website: [zionterranova.com](https://zionterranova.com)
- Explorer: [app.zionterranova.com](https://app.zionterranova.com)
- Pool: `62.171.141.136:8444`
- RPC: `rpc.zionterranova.com:8443`
