# VerusHash v2.2 — ZION Native Lib

**Coins:** VRSC (VerusCoin)  
**Algorithm:** VerusHash v2.2 (Haraka-512 + CLHash + BLAKE2b-256)  
**Source:** `V3/L1/native-ffi/csrc/verushash/verushash_portable.c` (portable stub)

## Acceptance Checklist

- [x] Portable stub (Keccak-256 fallback) compiled — FFI ABI satisfied
- [x] Cargo feature `native-verushash` wired in `zion-native-ffi`
- [x] Miner feature `native-verushash` propagated through `zion-miner`
- [x] Smoke test: deterministic non-zero output
- [ ] Full Haraka + CLHash pipeline (replace stub with VerusCoin upstream sources)
- [ ] AES-NI / ARM-crypto path verified
- [ ] Production parity test vs VerusCoin reference node

## Key FFI Functions

```c
void    verushash_init(void)
void    verushash_hash(header, header_len, nonce, output)
int32_t verushash_verify(header, header_len, nonce, target)
double  verushash_benchmark(iterations)
const char* verushash_version(void)
```

## Upgrade to Full Implementation

1. Obtain Haraka + CLHash sources from https://github.com/VerusCoin/VerusCoin/tree/master/src/crypto
2. Place in `V3/L1/native-ffi/csrc/verushash/`
3. Update `build.rs` `native-verushash` block to compile the C++ files (see `L1/native-libs/verushash-native/build.rs` for reference)
4. Remove the stub file or guard with `#ifdef VERUSHASH_STUB`

## Build (current portable stub)

```powershell
cargo build --manifest-path V3/L1/native-ffi/Cargo.toml --features native-verushash
```
