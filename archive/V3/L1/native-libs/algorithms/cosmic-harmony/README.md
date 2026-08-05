# Cosmic Harmony v3 — ZION Native Lib

**Coins:** ZION  
**Algorithm:** CHv3 = Keccak-256 → SHA3-512 → Golden Matrix (PHI-based) → Cosmic Fusion  
**Source:** `V3/L1/native-ffi/csrc/cosmic_harmony/cosmic_harmony_v3_native.c`

## Acceptance Checklist

- [x] C source ported from `L1/native-libs/all/cosmic_harmony_v3_native.c`
- [x] ARM NEON + x86 AVX2 paths present in source (compile-time detection)
- [x] Cargo feature `native-cosmic-harmony` wired in `zion-native-ffi`
- [x] Miner feature `native-cosmic-harmony` propagated through `zion-miner`
- [x] Smoke test: deterministic non-zero output, nonce variant differs
- [ ] Parity test vs Rust CHv3 reference path in `zion-core`
- [ ] AVX2 path verified on x86-64 Linux
- [ ] NEON path verified on ARM64

## Key FFI Functions

```c
int    cosmic_harmony_v3_hash(header, header_len, nonce, output)  // returns 0 on ok
int    cosmic_harmony_v3_hash_raw(input, input_len, output)
double cosmic_harmony_v3_benchmark(duration_seconds)
const char* cosmic_harmony_v3_get_info(void)   // reports NEON/AVX2/scalar
void   cosmic_harmony_v3_keccak256(input, len, output)
void   cosmic_harmony_v3_sha3_512(input, len, output)
```

## Build

```powershell
cargo build --manifest-path V3/L1/native-ffi/Cargo.toml --features native-cosmic-harmony
```

## Build (all algorithms)

```powershell
cargo build --manifest-path V3/L1/native-ffi/Cargo.toml --features native-all
```
