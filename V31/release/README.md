# ZION V31 — Public Boost Miner Release

This directory builds the **public-facing** ZION miner binary from the
ZION V31 workspace. It is the successor to the archived V3 public-miner
template, updated to:

- **v3.2.0** versioning
- the canonical **Ekam Deeksha v3.2** PoW (512 KiB scratchpad, 2 passes, 128
  random reads)
- the **public build**, which:
  - shows only **ZION** + **Boost Stream 1 / Boost Stream 2** in the TUI,
    banner, and setup menu (real coin tickers for the auxiliary revenue
    streams are never displayed to the user);
  - suppresses internal merged-mining tracing and stdout log lines that
    would otherwise reveal external coin names, job ids, or stratum URLs.
  - The auxiliary streams still run in the background exactly as before —
    this only affects what is visible to the end user, not mining behavior.

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
provided as reference/cross-compile scripts.

## Verifying the public build masking

```bash
ZION_INTERACTIVE=0 ./dist/macos-aarch64/zion-miner --help
```

- No external coin ticker should ever appear in `--help`, banner, TUI, or logs.
- Stream labels appear as `ZION`, `BOOST 1` (GPU auxiliary), `BOOST 2` (CPU
  auxiliary).
