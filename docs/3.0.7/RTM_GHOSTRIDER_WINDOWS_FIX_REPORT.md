# RTM GhostRider — native-ghostrider Windows/MSVC Fix Report

> **Datum:** 2026-07-28
> **Verze:** 3.0.7 Trinity
> **Feature:** `native-ghostrider` (RTM / Raptoreum)
> **Status:** ✅ **Production-ready na Windows/MSVC i Linuxu**

---

## Shrnutí

Feature `native-ghostrider` (RTM / Raptoreum CPU mining) nemohla být zkompilována s MSVC na Windows. Pět nezávislých root causes bylo identifikováno a opraveno. Po opravě miner úspěšně produkuje RTM GhostRider shares, které jsou akceptovány upstream poolem (zpool.ca).

## Root causes a opravy

Všechny změny jsou v `V3/L1/native-ffi/`.

### 1. VLA v `gr.c` (Variable Length Array)

**Soubor:** `csrc/ghostrider/real/gr.c`

```c
// PŮVODNÍ (C99 VLA — MSVC nepodporuje):
bool selectedAlgo[algoCount];

// OPRAVENO:
bool selectedAlgo[15];  // HASH_FUNC_COUNT = 15
```

MSVC nepodporuje C99 variable-length arrays. `algoCount` je vždy ≤ 15 (`HASH_FUNC_COUNT`), takže fixed-size array je bezpečné.

### 2. VLA v `sph/fugue.c` (ROR makro)

**Soubor:** `csrc/ghostrider/real/sph/fugue.c`

```c
// PŮVODNÍ:
#define ROR(n, s)   do { \
    sph_u32 tmp[n]; \
    ...

// OPRAVENO:
#define ROR(n, s)   do { \
    sph_u32 tmp[15]; \
    ...
```

Makro `ROR(n, s)` je voláno s `n` ∈ {3, 8, 9, 11, 12, 14, 15}, takže `tmp[15]` pokrývá všechny případy.

### 3. `#ifdef WIN32` → `#ifdef _WIN32` v `oaes_lib.c`

**Soubor:** `csrc/ghostrider/real/cryptonote/crypto/oaes_lib.c`

```c
// PŮVODNÍ:
#ifdef WIN32
#include <process.h>
#else
#include <sys/types.h>
#include <unistd.h>
#endif

// OPRAVENO:
#ifdef _WIN32
#include <process.h>
#else
#include <sys/types.h>
#include <unistd.h>
#endif
```

MSVC definuje `_WIN32`, nikoliv `WIN32`. Bez této opravy se na Windows brala POSIX větev (`<unistd.h>`), která neexistuje.

### 4. Unguarded `#include <unistd.h>` ve 8 cryptonight souborech

**Soubory:** `cryptonight.c`, `cryptonight_dark.c`, `cryptonight_dark_lite.c`, `cryptonight_fast.c`, `cryptonight_lite.c`, `cryptonight_soft_shell.c`, `cryptonight_turtle.c`, `cryptonight_turtle_lite.c`

```c
// PŮVODNÍ:
#include <unistd.h>

// OPRAVENO:
#ifndef _WIN32
#include <unistd.h>
#else
#include <io.h>
#endif
```

Všech 8 souborů mělo `#include <unistd.h>` bez jakéhokoliv platform guardu.

### 5. `alloca` linker error

**Soubor:** `build.rs`

```rust
if is_msvc {
    add_msvc_includes(&mut b);
    // MSVC uses _alloca (from <malloc.h>); GCC/Clang use alloca.
    b.define("alloca", "_alloca");
}
```

MSVC neposkytuje `alloca` symbol — používá `_alloca` z `<malloc.h>`. Bez tohoto define linker hlásí `LNK2019: unresolved external symbol alloca`.

### Bonus: `/utf-8` flag pro MSVC

**Soubor:** `build.rs`

Některé sphlib C zdroje obsahují UTF-8 em-dash/en-dash znaky v komentářích. Bez `/utf-8` flagu MSVC tiše failuje (žádná chybová zpráva, jen exit code 2).

```rust
b.flag_if_supported("/utf-8");
```

Přidáno v `add_msvc_includes()` i v `base_build()`.

## Build

```powershell
cargo build --release -p zion-miner --features "gpu-opencl,native-randomx,native-ghostrider,native-verushash"
```

Build úspěšný za ~2m 51s na Windows 11 / MSVC 14.51 / GTX 1070 Ti.

## Live E2E verifikace

### Konfigurace

- **Miner:** `zion-miner.exe` (Windows 11, 6c/12t CPU, GTX 1070 Ti)
- **Pool:** `62.171.141.136:8444` (Edge pool)
- **Payout:** `zion16825y2v5f3q507e5c2e0j8n666z43558l3zt604`
- **CPU coin:** RTM (`--cpu-coin RTM`)
- **Upstream pool:** zpool.ca (RTM GhostRider)

### Spuštění

```powershell
$env:ZION_PAYOUT_ADDRESS='zion16825y2v5f3q507e5c2e0j8n666z43558l3zt604'
$env:ZION_MINER_ID='local-miner'
$env:ZION_WORKER_NAME='cpu-rig-0'
$env:ZION_LOOP_COUNT='1000000'
.\target\release\zion-miner.exe --pool 62.171.141.136:8444 --gpu-opencl --cpu-coin RTM
```

### Výsledky

| Metrika | Hodnota |
|---------|--------|
| **Hashrate** | ~125–430 H/s (kolísá podle job rotation) |
| **RTM shares found** | 2 (v ~90s okně) |
| **Upstream acceptance** | ✅ `result=true` (zpool.ca) |
| **Pool confirmation** | `external_share_result miner=local-miner coin=RTM accepted=true status=accepted` |

### Pool log důkaz

```
auxpow: RTM try_forward job_id=2d339 nonce=17829199467328660516 meets=true pfx=0x00 hash_hex=a0c82b30c32bf974 target_hex=00031fffcdffffff
auxpow: RTM submit — job=2d339 en2=00000000 ntime=6a690f8a nonce=cfb56424
auxpow: submitting share request {"id":200,"jsonrpc":"2.0","method":"mining.submit","params":["RBksKgzcxTWaewQQ7niX1KT4r4L5Ch8iJB.pool-rtm","2d339","00000000","6a690f8a","cfb56424"]}
auxpow: RTM poll msg id=Some(Number(200)) method=None result=Some(Bool(true)) error=Some(Null) pending=1
external_share_result miner=local-miner coin=RTM accepted=true status=accepted
```

Druhý share:
```
auxpow: RTM try_forward job_id=2d364 nonce=14406981048105090685 meets=true pfx=0x00 hash_hex=f004b963123f8d67
auxpow: RTM poll result=Some(Bool(true))
external_share_result miner=local-miner coin=RTM accepted=true status=accepted
```

## Závěr

`native-ghostrider` feature je nyní plně production-ready na Windows/MSVC i Linuxu. RTM (Raptoreum) GhostRider shares jsou akceptovány upstream poolem zpool.ca. Společně s `native-randomx` (XMR) a `native-verushash` (VRSC) tak všechny tři CPU-minable coiny podporované Edge poolem fungují na Windows.
