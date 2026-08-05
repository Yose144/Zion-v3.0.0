# Etchash / Ethash — ZION Native Lib

**Coins:** ETC (Ethereum Classic), legacy Ethereum  
**Algorithm:** Ethash / EtcHash (Dagger-Hashimoto + Keccak-256)  
**Source:** `V3/L1/native-ffi/csrc/etchash/etchash_native.c`

## Acceptance Checklist

- [x] C source ported from `L1/native-libs/all/ethash_native.c`
- [x] Cargo feature `native-etchash` wired in `zion-native-ffi`
- [x] Miner feature `native-etchash` propagated through `zion-miner`
- [x] Smoke test: non-zero 32-byte output for fixed header/nonce
- [ ] Deterministic parity test vs Python reference miner
- [ ] Windows MSVC build verified
- [ ] Docker Linux build verified

## Key FFI Functions

```c
void     ethash_init(void)
void     ethash_hash(header, header_len, nonce, height, output)
int32_t  ethash_verify(header, header_len, nonce, height, target)
uint32_t ethash_get_epoch(block_number)
double   ethash_benchmark(iterations)
const char* ethash_version(void)
```

## Build

```powershell
cargo build --manifest-path V3/L1/native-ffi/Cargo.toml --features native-etchash
```

## Notes

- Light-client evaluation: DAG cache capped at 64 MB for CPU use.
- Full GPU DAG is ~4 GB per epoch; link a GPU DAG generator for production ETCPoW mining.
