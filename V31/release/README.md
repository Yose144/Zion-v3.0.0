# ZION V31 — Public Boost Miner Release

This directory builds the **public-facing** ZION miner binary from the `V31/`
workspace. It is the V31 successor to `archive/MinerP3.0.6/` (the old V3
public-miner template), updated to:

- **v3.2.0** versioning
- the canonical `EkamDeeksha` v3.2 PoW (512 KiB scratchpad, 2 passes, 128
  random reads — see `V31/L1/cosmic-harmony`)
- the `public_build` Cargo feature, which:
  - shows only **ZION** + **Boost Stream 1 / Boost Stream 2** in the TUI,
    banner, and setup menu (real coin tickers for Stream 2/3 AuxPoW are
    never displayed to the user — see `ui.rs`, `interactive.rs`,
    `auto_detect.rs`, `banner.rs`);
  - fully suppresses internal AuxPoW/Trinity tracing + stdout log lines
    that would otherwise reveal external coin names, job ids, or stratum
    URLs (`crate::ext_log`, used across `runtime.rs`, `v3_pool_client.rs`,
    `gpu/mod.rs`, `gpu/cuda_external.rs`, `auxpow/*.rs`).
  - Stream 2/3 AuxPoW still run in the background exactly as before — this
    only affects what is visible to the end user, not mining behavior.

## Build

```bash
./build-macos.sh
```

Produces (native aarch64 + cross-compiled x86_64):

```
V31/release/dist/macos-aarch64/zion-miner-macos-aarch64.tar.gz
V31/release/dist/macos-x86_64/zion-miner-macos-x86_64.tar.gz
V31/release/dist/SHA256SUMS.txt
```

Linux/Windows build scripts (`build-linux.sh`, `build-windows.sh`) are
adapted from `archive/MinerP3.0.6/` for reference/cross-compile hosts; they
are not run automatically here.

## Verifying the public_build masking

```bash
ZION_INTERACTIVE=0 ./dist/macos-aarch64/zion-miner --help
```

- No `ZANO`, `VRSC`, or other external coin ticker should ever appear in
  `--help`, banner, TUI, or logs.
- Stream labels appear as `ZION`, `BOOST 1` (GPU AuxPoW), `BOOST 2` (CPU
  AuxPoW).
