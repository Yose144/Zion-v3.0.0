# V3 L1 Native Libs

Status: phase 2 — all testnet algorithms wired

This folder documents the native algorithm library surface for V3.
The actual C sources and Rust FFI crate live at `V3/L1/native-ffi/`.

## Algorithms (all testnet-active coins)

| Feature flag             | Algorithm        | Coins          | C source                                   |
|--------------------------|------------------|----------------|--------------------------------------------|
| `native-etchash`         | Ethash / EtcHash | ETC            | csrc/etchash/etchash_native.c              |
| `native-kawpow`          | KawPow           | RVN, CLORE     | csrc/kawpow/kawpow_native.c                |
| `native-autolykos`       | Autolykos v2     | ERG            | csrc/autolykos/autolykos_native.c          |
| `native-kheavyhash`      | kHeavyHash       | KAS            | csrc/kheavyhash/kheavyhash_native.c        |
| `native-blake3-algo`     | Blake3           | ALPH, DCR      | csrc/blake3/blake3_native.c                |
| `native-cosmic-harmony`  | Cosmic Harmony v3| ZION           | csrc/cosmic_harmony/cosmic_harmony_v3_native.c |
| `native-verushash`       | VerusHash v2.2   | VRSC           | csrc/verushash/verushash_portable.c (stub) |
| `native-randomx`         | RandomX          | XMR, ZEPH      | csrc/randomx/randomx_stub.c (stub)         |
| `native-all`             | All above        | —              | —                                           |

## Rust FFI Crate

`V3/L1/native-ffi/` — Cargo crate `zion-native-ffi`.  Each algorithm is a
separate feature flag; the `cc` build crate compiles the relevant C sources at
`cargo build` time.

```toml
# Use in your crate:
zion-native-ffi = { path = "../native-ffi", features = ["native-all"] }
```

## Directory Layout

```
V3/L1/native-libs/
  algorithms/
    etchash/        # README + acceptance checklist
    kawpow/
    autolykos/
    randomx/
    kheavyhash/
    blake3/
    cosmic-harmony/
    verushash/
  include/
    zion_native_abi.h   # shared ABI header
  scripts/
    build_windows.ps1
    build_linux.sh
    smoke_check.ps1
  artifacts/           # build output
```

## Build Policy

- Native libs are optional and feature-gated. Missing features must never break
  the baseline runtime.
- Every algorithm needs:
  1. Smoke test (non-zero output, link succeeds)
  2. Deterministic output verify test

## Next Steps

1. Replace randomx stub with Tevador/randomx wrapper.
2. Replace verushash stub with full Haraka + CLHash pipeline from VerusCoin.
3. Add CI matrix job for Windows + Linux native-all build.
4. Add parity tests for CHv3 (native vs Rust reference).

