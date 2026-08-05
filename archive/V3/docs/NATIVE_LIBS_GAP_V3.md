# V3 Native Libs Gap - audit a migracni plan

Status: 2026-03-21 (Sprint 7 — runtime self-test implemented)

## Shrnuti

V3 uz ma jak scaffold (`V3/L1/native-libs/`), tak implementacni FFI crate (`V3/L1/native-ffi/`) s feature-gated C buildem.

Aktualni gap je nyni hlavne v produkcnim hardeningu (CI matrix, artifact signing, per-algo verify/perf gates), ne v absenci runtime kodu.

## Co je v legacy, ale neni ve V3

Zdroj: L1/native-libs/

- build skripty: build_linux.sh, build_windows.ps1
- OpenCL import artefakty: OpenCL.def, OpenCL.exp, OpenCL.lib
- verushash-native/ subtree
- prebuild dylib/so artefakty pro vice alg:
  - randomx
  - yescrypt
  - autolykos
  - kawpow
  - kheavyhash
  - ethash/progpow/equihash
  - cosmic_harmony v2/v3 variants

V3/L1 uz obsahuje navic:

- native-libs/ (scaffold)
  - algorithms/randomx
  - algorithms/kawpow
  - algorithms/autolykos
  - scripts/build_windows.ps1
  - scripts/build_linux.sh
  - include/zion_native_abi.h
- native-ffi/ (implementace)
  - Cargo crate s feature flags: native-etchash, native-kawpow, native-autolykos, native-kheavyhash, native-blake3-algo, native-cosmic-harmony, native-verushash, native-randomx, native-all
  - csrc/ porty pro etchash, kawpow, autolykos, kheavyhash, blake3, cosmic-harmony, verushash, randomx
  - build.rs s platform include discovery (MSVC/Windows SDK) a per-feature kompilaci

## Co uz V3 ma nativne v rust/opencl

- zion-miner: DCR Blake3 GPU backend pres OpenCL (feature gpu)
- zion-cosmic-harmony: native-npu feature scaffold (ONNX/ORT)

To znamena, ze cast nativniho vykonu je uz integrovana primo v rust codebase a FFI vrstva existuje; zbyva sjednotit production-grade validaci a release workflow.

Aktualni runtime napojeni:

- `zion-miner` podporuje DCR CPU hash impl switch `ZION_DCR_HASH_IMPL=rust|native` (native vyzaduje `--features native-blake3-algo`)
- pokud je pozadovan `native` bez feature, runtime fallbackne na rust-precompute cestu a vypise explicitni warning

## Dopad na E2E

Bez migrace native-libs do V3:

- chybi jednotny build/release pipeline pro FFI knihovny
- chybi konzistentni runtime fallback policy mezi platformami
- chybi parity coverage proti legacy pro specific alg cesty

## Doporučeny migracni plan

### Faze 1 - inventar + rozhrani (kratkodobe)

Status: Hotovo (scaffold + ABI header + build scripts + native-ffi crate + feature flags).

Navazne dodelat:

1. Dopsat symbol-load smoke testy primo do V3 test flow
2. Dopsat per-algo verify testy v rust wrappers (minimal vectors)

### Faze 2 - postupna migrace (strednedobe)

1. RandomX knihovna + smoke test
2. KawPow knihovna + verify test
3. Autolykos knihovna + verify test
4. Volitelne: verushash-native subtree po auditu

### Faze 3 - produkcni hardening (dlouhodobe)

1. CI build matrix (Windows/Linux)
2. artifact signing + checksum publish
3. ~~runtime self-check (dlopen/load + symbol test)~~ → ✅ Sprint 7: `runtime_self_test()` validates determinism + non-zero for each compiled algorithm, `AlgoTestResult` struct, `all_algorithms_healthy()` convenience wrapper, 4 tests pass
4. perf baselines a regression gates

## Minimalni acceptance criteria

- V3 build projde s i bez native feature flagu
- E2E miner run fallbackne na rust path, kdyz native lib chybi
- pro kazdou native lib existuje 1 verify test + 1 perf smoke test
- release artefakty jsou reprodukovatelne a auditovatelne

## Poznamka k scope

V3 je clean-room mainnet line. Migrace native libs ma byt selektivni:

- portovat jen auditovane a potrebne cesty
- neportovat historical ballast bez realneho runtime use-casu
