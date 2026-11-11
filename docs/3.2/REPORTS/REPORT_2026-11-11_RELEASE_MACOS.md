# REPORT — macOS release artefakty 9.B4 + oprava builderu (2026-11-11)

> Autonomní fronta, Priorita 1 #3 (release artefakty 9.B4). Cíl: doplnit
> poslední chybějící target `x86_64-apple-darwin` a mít macOS sadu
> ověřenou verifierem. Bez produkčního deploye, bez zásahu do G8 služeb.

## 1. Proč to dřív nešlo

`docs` tvrdily dvě různé věci podle hostu:

- **PC (Linux):** na disku jen 2 linux tarbally, macOS/Windows toolchain chybí.
- **Mac:** cross-toolchain `x86_64-apple-darwin` **ověřen funkční**, ale
  **disk byl 100 % plný** (~115 MB) → `cargo build --release` nemožný.

Stav 11. 11. večer na tomto Macu: **17–22 GB volných** (Data volume 88–92 %),
takže blocker zmizel.

## 2. Co se postavilo

Spuštěno `scripts/ops/build-release-artifacts.sh --isolate` z commitu
`5a9e41a40` (izolace = `git archive`, takže paralelní session může mít
rozpracovaný strom a artefakt má přesto `tree_state: clean`).

| Adresář | Target | Varianty | Verifier |
|---|---|---|---|
| `dist/v3.2.0-rc-w1.5/` | `x86_64-apple-darwin` | default | **PASS** (1) |
| `dist/v3.2.0-rc-w1.5-macos/` | `aarch64-apple-darwin` | default + `gpu-metal` | **PASS** (2) |

Každý tarball (~18 MB) obsahuje `zion-miner`, `zion-node`, `zion-migrate`,
`zion` + `BUILD-INFO.txt` (commit, `tree_state: clean`, `locked: yes`,
rustc/cargo verze, SHA256 každé binárky). `Mach-O 64-bit executable x86_64`
resp. `arm64` ověřeno přes `file`.

## 3. 🔴 Chyba, kterou odhalil verifier

První běh skončil `RESULT: FAIL (BUILD-INFO features mismatch)` u
`+gpu-metal`. Příčina v builderu:

```bash
[ "$variant" = "$features" ] && features=""   # "--variant default" form
```

Guard měl pokrýt jen formu **bez dvojtečky** (`--variant default`), ale
spustil se i pro `--variant gpu-metal:gpu-metal` (kde `variant` i `features`
jsou `gpu-metal`). Následek: varianta se zkompilovala **bez** feature flagu
a jen se přejmenovala → **dva identické CPU balíčky**, jeden z nich
vydávaný jako „gpu-metal".

Důkaz: `build-aarch64-apple-darwin+gpu-metal.log` měl **0** zmínek o „metal"
(žádné Metal kernely) a binárky měly stejnou velikost.

Oprava (`5a9e41a40`):

```bash
case "$v" in
  *:*) ;;                 # "--variant name:features" — features jak jsou
  *) features="" ;;       # "--variant default" — bez features
esac
```

Po opravě: `features: gpu-metal` v `BUILD-INFO.txt`, `zion-miner`
6 237 216 B (vs 6 087 728 B CPU), log obsahuje `metal`, verifier **PASS**.

## 4. Co zůstává

- **Linux targety** — musí v kontejneru, aby artefakt nezávisel na glibc
  hostu: `--container rust:1.97-bullseye` (baseline glibc 2.31).
- **`x86_64-pc-windows-gnu`** — mingw-w64 (`gcc-mingw-w64-x86-64`), na
  tomto Macu není.
- **Finální rebuild všech targetů z RC commitu** — povinný, až 👤 vystaví
  tag `v3.2.0` (gate 9.S1). Teprve ten dá jednu konzistentní matici pro
  všechny platformy; dnešní sada jsou **draft-grade** artefakty ze dvou
  sousedních commitů (rozdíl je jen oprava builderu, binárky jsou shodné).

## 5. Poznámky pro další session

- `dist/v3.2.0-rc-w1.4/` **`--verify` FAIL** — chybí `RELEASE-MATRIX.json`
  (starší formát). Není to regrese, jen důkaz, že matrix vzniká až buildem.
- `--isolate` je nutné, když je strom špinavý (paralelní session), a je
  to i správnější provenance: `tree_state: clean` místo `dirty (N changes)`.
- Build je cold ~15–18 min na target (480 závislostí), druhý target
  v témže `--isolate` běhu už jen ~5 min.
- Disk: každý `--isolate` běh si dělá vlastní `target/` v tempu a na konci
  ho uklidí; před během měj ≥ 8 GB volných.
