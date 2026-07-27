# Trinity Public / Private Boundary

## Principle

- **Backend code (public repo):** Full native, all algorithms, CUDA + OpenCL,
  Triple Stream (ZION + GPU external + CPU external). The complete miner and
  pool source code stays in the public repository under MIT license.
- **Public-facing UI and documentation (private/hidden):** Trinity internals
  are never revealed to end users. Only generic "Trinity engine" wording is
  used. Specific coins (ZANO, VRSC), algorithms (ProgPoWZ, VerusHash), stream
  numbering (Stream 1/2/3), and internal env vars must not appear in public
  docs, release notes, TUI, or help output.

## Implementation

- The `public_build` Cargo feature hides Trinity stream details in the TUI and
  help text. Public release binaries are always built with `--features public_build`.
- Public docs (SMOS/HiveOS guide, release notes, READMEs) mention only:
  - ZION (Deeksha Lite v1)
  - generic "Trinity engine" or "proprietary Trinity engine"
  - multi-GPU support
  - SMOS/HiveOS support
- Never list ZANO, VRSC, ProgPoWZ, VerusHash, `ZION_STREAM*_ENABLED`,
  `ZION_MINER_GPU_COIN`, `ZION_MINER_CPU_COIN`, or similar internals in
  public-facing content.

## Build command for public binaries

```bash
cargo build --release -p zion-miner --features "gpu-opencl,native-all,public_build"
```

## Why

Trinity engine mechanics are ZION's competitive secret. The pool and binary
provide the functionality automatically; users do not need to know which
auxiliary coins are mined or how the pool converts them internally.
