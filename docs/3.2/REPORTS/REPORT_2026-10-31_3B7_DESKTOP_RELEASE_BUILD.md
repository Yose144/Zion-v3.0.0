# Report: 3.B7 — Desktop agent release build test

**Datum:** 2026-10-31 · **Scope:** `apps/desktop-agent` v3.2.0 (Electron 39.2.7) · **Status:** ✅ Linux verified end-to-end; win/mac = cross-toolchain follow-up

## Build pipeline ověřen

```
npm run prepare:rust-miner --auto   → cargo build --release -p zion-miner
                                     (+ zion-core node, + zion-cli)
                                     features: public_build,auxpow,gpu-opencl,
                                               gpu-cuda,native-all,tui
npx electron-builder --linux --x64  → AppImage + deb
```

| Krok | Výsledek |
|---|---|
| zion-miner + universal-miner | ✅ 5m56s (CUDA autodetect — NVRTC + GPU na hostu) |
| zion-node + `node` alias | ✅ 2m36s |
| zion-cli (`zion`) | ✅ 8m35s |
| 4 binárky → `resources/` | ✅ copied |
| electron-builder | ✅ clean (warnings jen: dup ethers deps, DEP0190) |

## Artefakty

| Soubor | Velikost | SHA256 (prefix) |
|---|---|---|
| `zion-desktop-agent-v3.2.0-linux-x86_64.AppImage` | 260 MB | `40c524aa106334c4` |
| `zion-desktop-agent-v3.2.0-linux-x86_64.deb` | 224 MB | `14824e1acd04b48f` |

## Smoke evidence (linux-unpacked)

- `resources/zion-miner --version` → `zion-miner 3.2.0 build f053df129e3a-dirty` (ELF x86-64 PIE, stripped)
- `./zion-desktop-agent` boot → `ZION Native Awakening v3.2.0 started`, `findRustMiner` resolvoval bundled `resources/zion-miner`, single-instance lock aktivní (běžel jiný instance — očekáváno, dev box)
- Electron 39.2.7, appId `com.zionterranova.desktop-agent`, productName „ZION Miner"

## Findings

1. **Stale `.bak` binárky se bundlují** — `resources/*.bak-*` + `zion-miner.bin*` ≈ **74 MB** zbytečné váhy v AppImage/deb. Doporučení: `extraResources` filter `!**/*.bak*` v package.json, nebo prepare script cleanup.
2. dist/ artefakty z srpna byly stale (2 měsíce, bez mineru) — teď přepsané čerstvým buildem.
3. Build embeduje `build <sha>-dirty` — dirty flag z necommitnutých worktree změn; pro release tag build z čistého checkoutu.

## Platform coverage

- ✅ **linux-x64** — full end-to-end PASS (this host)
- ⬜ **win-x64** (nsis/portable) — potřebuje Rust `x86_64-pc-windows-gnu` target pro miner cross-compile + electron-builder --win (CI nebo Win host)
- ⬜ **mac arm64/x64** — vyžaduje macOS host (Metal feature + codesign)

## Follow-up (ne blokery)

- `cargo fix` backlog: 107 warningů v zion-miner lib (unused vars apod.) — kandidát na samostatný lint commit
- Win/mac build matrix napojit na 2.S3 release-build proces (`scripts/ops/build-release-artifacts.sh` už řeší miner-only tarbally)
