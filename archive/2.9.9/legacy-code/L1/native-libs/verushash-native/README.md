# verushash-native

Rust FFI wrapper for **VerusHash v2.2** — the Proof-of-Work hash function used by [VerusCoin](https://verus.io/).

Supports both **x86_64** (SSE4 + AES-NI + PCLMUL) and **aarch64 / ARM64** (NEON + Crypto extensions via sse2neon).

## Quick Start

### 1. Download the C/C++ source files

The VerusCoin crypto sources are not bundled in this repository. Run the download script to fetch them from GitHub:

```bash
cd native-libs/verushash-native
bash download_sources.sh
```

This downloads files from:
- `github.com/VerusCoin/VerusCoin` (crypto implementations)
- `github.com/DLTcollab/sse2neon` (ARM compatibility header)

The script also patches the sources to remove Bitcoin/Zcash dependencies (boost, uint256, serialize, etc.) and injects our `compat.h` shim.

### 2. Build

```bash
# From the workspace root:
cargo build -p verushash-native

# Or from this directory:
cargo build
```

### 3. Test

```bash
cargo test -p verushash-native
```

## Rust API

```rust
use verushash_native::{verus_hash_v2_2, verus_hash_v2_2_hex, is_cpu_optimized};

// Hash raw bytes
let hash: [u8; 32] = verus_hash_v2_2(b"block header data");

// Hash and get hex string
let hex: String = verus_hash_v2_2_hex(b"block header data");

// Check CPU capabilities
if is_cpu_optimized() {
    println!("Using optimized (AES-NI / ARM crypto) code path");
} else {
    println!("Using portable fallback");
}
```

## Architecture

```
csrc/
├── compat.h                # Stubs for boost, uint256, serialize, etc.
├── sse2neon.h              # SSE → NEON translation (downloaded)
├── haraka.h / haraka.c     # Haraka hash — optimized (downloaded)
├── haraka_portable.h / .c  # Haraka hash — portable fallback (downloaded)
├── verus_hash.h / .cpp     # CVerusHash / CVerusHashV2 (downloaded)
├── verus_clhash.h / .cpp   # CLHash optimized (downloaded)
├── verus_clhash_portable.cpp # CLHash portable (downloaded)
└── ffi_wrapper.cpp         # Our extern "C" bridge to Rust

src/
└── lib.rs                  # Safe Rust wrapper + FFI declarations

build.rs                    # cc-based build script with arch-specific flags
download_sources.sh         # Fetches C sources from GitHub
```

## Compiler Flags

| Architecture | Flags |
|-------------|-------|
| x86_64 | `-mpclmul -msse4 -msse4.1 -msse4.2 -mssse3 -maes` |
| aarch64 | `-march=armv8-a+crypto -flax-vector-conversions` |
| Common | `-O3 -funroll-loops -fomit-frame-pointer -fPIC` |

## Thread Safety

The `verus_hash_v2_2()` function is thread-safe:
- Global initialization uses `std::sync::Once`
- The C++ hasher uses `thread_local` scratchpads

## License

- **This wrapper**: MIT License
- **VerusCoin crypto code**: See [VerusCoin License](https://github.com/VerusCoin/VerusCoin/blob/master/COPYING)
- **sse2neon**: MIT License
