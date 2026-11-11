# REPORT — release artefakty 9.B4: celá sada + oprava builderu (2026-11-11)

> Autonomní fronta, Priorita 1 #3 (release artefakty 9.B4). Cíl: doplnit
> chybějící targety a mít celou sadu ověřenou verifierem. Bez produkčního
> deploye, bez zásahu do G8 služeb.
>
> **Stav na konci: 6 artefaktů, všechny `--verify` PASS** — macOS (x86_64
> i aarch64, každý default + gpu-metal), linux-gnu (glibc 2.29) a
> windows-gnu (PE32+). Viz §6.

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

---

## 6. Doplnění: linux + windows + koherentní sada (tentýž den, večer)

### 6.1 Windows — `mingw-w64` (na Macu je z Homebrew)

```bash
CARGO_TARGET_X86_64_PC_WINDOWS_GNU_LINKER=x86_64-w64-mingw32-gcc \
CC_x86_64_pc_windows_gnu=x86_64-w64-mingw32-gcc \
  build-release-artifacts.sh --target x86_64-pc-windows-gnu --isolate
```

Výsledek: 4× `PE32+ executable (console) x86-64`, `--verify` **PASS**.

### 6.2 Linux — `--zig 2.31` (nový flag builderu)

Docker na tomto Macu není, takže `--container rust:1.97-bullseye` nešel.
`zig` + `cargo-zigbuild` ano, a navíc pinuje glibc baseline — přesně to,
co by container dělal.

```bash
AR_x86_64_unknown_linux_gnu=/usr/bin/ar \
RANLIB_x86_64_unknown_linux_gnu=/usr/bin/ranlib \
  build-release-artifacts.sh --target x86_64-unknown-linux-gnu --zig 2.31 --isolate
```

**⚠️ Past, která stála jeden běh:** bez override `AR`/`RANLIB` spadne build
na `ring`/`aws-lc-sys` s `ar: error: unable to open '…/libring_core…a':
No such file or directory` — `cargo-zigbuild` 0.23 dá cc-rs vlastní `ar`
wrapper, který v této kombinaci archivaci nedokončí. Systémový `/usr/bin/ar`
(archiv je formátově neutrální, ELF objekty zvládne) to řeší.

Ověřeno na hotovém artefaktu:

- `ELF 64-bit LSB pie executable, x86-64`
- max požadavek **`GLIBC_2.29`** (baseline 2.31 → běží na Ubuntu 20.04+,
  Debian 11+, RHEL 9)
- `BUILD-INFO.txt`: `glibc_baseline: 2.31 (cargo zigbuild)`, `tree_state: clean`

Bez `--zig` by artefakt nesl glibc hostu (macOS) — nepoužitelný.

### 6.3 Koherentní sada

Původně měl každý target vlastní adresář a tím i vlastní commit. Nakonec
všechno vzniklo z **jednoho commitu `df4dc3296`**:

| Adresář | Artefakty |
|---|---|
| `dist/v3.2.0-rc-w1.5-macos/` | `x86_64-apple-darwin` (+gpu-metal), `aarch64-apple-darwin` (+gpu-metal) |
| `dist/v3.2.0-rc-w1.5-linux/` | `x86_64-unknown-linux-gnu` (glibc 2.29) |
| `dist/v3.2.0-rc-w1.5-win/` | `x86_64-pc-windows-gnu` (PE32+) |

Každý tarball ~17–18 MB, 4 binárky (`zion-miner`, `zion-node`,
`zion-migrate`, `zion`) + `BUILD-INFO.txt`; každý adresář má
`RELEASE-MATRIX.json` + `SHA256SUMS`.

**Ověřeno:** `--verify` na všech třech = **PASS (6 artefacts)**; `file`
u každé binárky sedí s targetem; `features: gpu-metal` je jen u GPU
variant a ty mají větší binárku (aarch64 6 336 544 B vs 6 154 032 B,
x86_64 6 980 084 B vs 6 807 152 B). Redundantní `v3.2.0-rc-w1.5/`
(starší Intel-only) smazán, aby sada byla jednoznačná.

### 6.4 Co zůstává na 👤

- **Tag `v3.2.0` (gate 9.S1)** → finální rebuild všech targetů z RC commitu
  (`--from-commit <tag>`); dnešní sada je draft-grade, protože RC tag
  neexistuje.
- Zvážit, zda Intel varianta `gpu-metal` má smysl (AGENTS matice uvádí pro
  macOS x86_64 `gpu-opencl`); dnes vznikla jako vedlejší produkt
  `--variant gpu-metal` nad oběma targety.
