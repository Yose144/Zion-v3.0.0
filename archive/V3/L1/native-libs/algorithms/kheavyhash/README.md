# kHeavyHash — ZION Native Lib

**Coins:** KAS (Kaspa)  
**Algorithm:** kHeavyHash = SHA3-256 → 64×64 matrix multiplication → SHA3-256  
**Source:** `V3/L1/native-ffi/csrc/kheavyhash/kheavyhash_native.c`

## Acceptance Checklist

- [x] C source ported from `L1/native-libs/all/kheavyhash_native.c`
- [x] Cargo feature `native-kheavyhash` wired in `zion-native-ffi`
- [x] Miner feature `native-kheavyhash` propagated through `zion-miner`
- [x] Smoke test: non-zero 32-byte output
- [ ] Deterministic parity test vs Python reference
- [ ] Windows MSVC build verified
- [ ] Docker Linux build verified

## Key FFI Functions

```c
void kheavyhash_hash(input, len, output)
void kheavyhash_mine(header, header_len, nonce, output)
int  kheavyhash_verify(header, header_len, nonce, target)
double kheavyhash_benchmark(iterations)
const char* kheavyhash_version()
```

## Build

```powershell
cargo build --manifest-path V3/L1/native-ffi/Cargo.toml --features native-kheavyhash
```
