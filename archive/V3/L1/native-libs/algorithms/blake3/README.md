# Blake3 (Native) — ZION Native Lib

**Coins:** ALPH (Alephium), DCR (Decred — Blake3 variant)  
**Algorithm:** Blake3 + double-Blake3 (Alephium)  
**Source:** `V3/L1/native-ffi/csrc/blake3/blake3_native.c`

**Note:** This is the *native C* Blake3 implementation for mining.  The workspace
also uses the pure-Rust `blake3` crate for internal ZION hashing; both coexist
because this crate's feature is named `native-blake3-algo` (not `native-blake3`).

## Acceptance Checklist

- [x] C source ported from `L1/native-libs/all/blake3_native.c`
- [x] Cargo feature `native-blake3-algo` wired in `zion-native-ffi`
- [x] Miner feature `native-blake3-algo` propagated through `zion-miner`
- [x] Smoke test: non-zero 32-byte output
- [ ] Parity test vs Rust blake3 crate
- [ ] Windows MSVC build verified

## Key FFI Functions

```c
void blake3_hash(input, input_len, output)
void blake3_mine(header, header_len, nonce, output)
void blake3_alph(header, header_len, nonce, output)   // double-Blake3 for ALPH
int  blake3_verify(header, header_len, nonce, target)
double blake3_benchmark(iterations)
const char* blake3_version()
```

## Build

```powershell
cargo build --manifest-path V3/L1/native-ffi/Cargo.toml --features native-blake3-algo
```
