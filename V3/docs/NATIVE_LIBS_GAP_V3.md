# V3 Native Libs Gap - audit a migracni plan

Status: 2026-03-16

## Shrnuti

V3 momentalne nema samostatny modul pro nativni knihovny (FFI/native-libs), zatimco legacy L1 ma rozsahlou sadu binarek a build skriptu.

To je aktualni gap pro vykonove a operacni parity scenare.

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

V3/L1 momentalne obsahuje jen:

- core/
- cosmic-harmony/
- miner/
- pool/

## Co uz V3 ma nativne v rust/opencl

- zion-miner: DCR Blake3 GPU backend pres OpenCL (feature gpu)
- zion-cosmic-harmony: native-npu feature scaffold (ONNX/ORT)

To znamena, ze cast nativniho vykonu je uz integrovana primo v rust codebase, ale neexistuje sjednocena V3 native-libs vrstva pro dalsi algoritmy.

## Dopad na E2E

Bez migrace native-libs do V3:

- chybi jednotny build/release pipeline pro FFI knihovny
- chybi konzistentni runtime fallback policy mezi platformami
- chybi parity coverage proti legacy pro specific alg cesty

## Doporučeny migracni plan

### Faze 1 - inventar + rozhrani (kratkodobe)

1. Zavest V3/L1/native-libs/ s README + build skripty
2. Definovat minimalni FFI ABI contract pro kazdy algoritmus
3. Pridat Cargo features ve V3 crates:
   - native-randomx
   - native-kawpow
   - native-autolykos
   - native-all

### Faze 2 - postupna migrace (strednedobe)

1. RandomX knihovna + smoke test
2. KawPow knihovna + verify test
3. Autolykos knihovna + verify test
4. Volitelne: verushash-native subtree po auditu

### Faze 3 - produkcni hardening (dlouhodobe)

1. CI build matrix (Windows/Linux)
2. artifact signing + checksum publish
3. runtime self-check (dlopen/load + symbol test)
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
