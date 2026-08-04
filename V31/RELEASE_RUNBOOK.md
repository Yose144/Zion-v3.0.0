# V31 Release Runbook — 3.1.0-alpha.2

> Autor: Devin, 2026-08-04  
> Použití: návod pro opakovatelný multi-platform release `zion` CLI a služeb V31.

---

## 1. Předpoklady

- macOS Apple Silicon (má k dispozici cross-toolchainy).
- `rustup` s nainstalovanými targety:
  ```bash
  rustup target add aarch64-apple-darwin x86_64-apple-darwin
  rustup target add x86_64-pc-windows-gnu
  rustup target add x86_64-unknown-linux-musl
  ```
- `x86_64-w64-mingw32-gcc` (Windows linker).
- `x86_64-linux-musl-gcc` (Linux musl linker).
- `gh` CLI přihlášen k `github.com/Yose144`.

---

## 2. Build jednotlivých targetů

### macOS aarch64 (nativní)

```bash
cargo build --release
```

### macOS x86_64 (cross)

```bash
cargo build --release --target x86_64-apple-darwin
```

### Windows x86_64 (cross, MinGW)

```bash
cargo build --release --target x86_64-pc-windows-gnu
```

### Linux x86_64 (cross, musl)

```bash
CARGO_TARGET_X86_64_UNKNOWN_LINUX_MUSL_LINKER=x86_64-linux-musl-gcc \
CC_x86_64_unknown_linux_musl=x86_64-linux-musl-gcc \
cargo build --release --target x86_64-unknown-linux-musl \
  -p zion-core -p zion-cli -p zion-pool -p zion-miner
```

> Poznámka: celý workspace pro `x86_64-unknown-linux-musl` se nebuildí z důvodu L3-L6 statického linkování (ring/aws-lc/blake3). Pro produkční Edge build se používá nativní Linux build s `glibc`.

---

## 3. Výběr binárek do release balíčku

Pro všechny platformy kopíruj tyto binárky:

- `zion` — hlavní CLI
- `zion-node` — L1 node
- `zion-pool` — stratum pool
- `zion-miner` — triple-stream miner
- `zion-universal-miner` — universal miner
- `zion-wallet` — wallet utility
- `zion-dao` — DAO API server (kde dostupné)

Windows balíček je `.zip`, ostatní `.tar.gz`.

---

## 4. SHA256

```bash
cd V31/releases
cat */SHA256SUMS.txt > SHA256SUMS.txt
shasum -a 256 -c SHA256SUMS.txt
```

---

## 5. GitHub Release

Vytvoření draft releasu (nebo přidání assetů k existujícímu):

```bash
gh release create v3.1.0-alpha.2-YYYY-MM-DD \
  --title "ZION V31 3.1.0-alpha.2 multi-platform" \
  --notes-file V31/REPORT_2026-08-04_SESSION.md \
  --draft \
  V31/releases/macos-aarch64/zion-macos-aarch64-3.1.0-alpha.2.tar.gz \
  V31/releases/macos-x86_64/zion-macos-x86_64-3.1.0-alpha.2.tar.gz \
  V31/releases/linux-x86_64/zion-linux-x86_64-3.1.0-alpha.2.tar.gz \
  V31/releases/windows-x86_64/zion-windows-x86_64-3.1.0-alpha.2.zip \
  V31/releases/SHA256SUMS.txt
```

Pak ručně publikovat na GitHubu.

---

## 6. Architektury a know-how

- **macOS aarch64/x86_64**: Apple LLVM toolchain umí oba targety; univerzální binárku lze vytvořit `lipo`, pokud je potřeba.
- **Windows x86_64**: MinGW cross-linker funguje pro většinu crates; `ring` a `aws-lc-rs` kompilují s MinGW GNU ABI.
- **Linux x86_64**: `musl` target umožňuje staticky linkované binárky, ale L3-L6 crate (oasis, free-world, issobella) mají problém s C knihovnami. Pro tyto aplikace se doporučuje nativní `x86_64-unknown-linux-gnu` build na Edge serveru.

---

## 7. Známé limitace

- `zion-pool` produkuje 7 non-fatal warnings (unused imports, deprecated `set_linger`, unused variables).
- `zion-dao` má 1 dead-code warning (`ApiOk`).
- Linux musl build neobsahuje `zion-dao`, `zion-oasis`, `zion-free-world`, `zion-issobella`.
- Plný multi-platform release vyžaduje testovací runner pro každou platformu.
