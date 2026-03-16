# V3 L1 Native Libs Scaffold

Status: phase 1 scaffold

This folder is the clean V3 entrypoint for native (FFI) performance libraries.

## Goals

- Keep one auditable native boundary for V3 miner/runtime.
- Support optional native acceleration with safe Rust fallback.
- Make Windows/Linux build artifacts reproducible.

## Initial Scope

- randomx
- kawpow
- autolykos

## Directory Layout

- algorithms/randomx
- algorithms/kawpow
- algorithms/autolykos
- include
- scripts
- artifacts

## Build Policy

- Native libs are optional and feature-gated in Rust crates.
- Missing native libs must never break baseline runtime.
- Every native lib needs:
  - one symbol-load smoke test
  - one deterministic output verify test

## Next Steps

1. Implement randomx dynamic library build in algorithms/randomx.
2. Add exported ABI header in include/.
3. Wire feature flags in V3 miner crate.
4. Add CI matrix for Windows/Linux native artifact build.
