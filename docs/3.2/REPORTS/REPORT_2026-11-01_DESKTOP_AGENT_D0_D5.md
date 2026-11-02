# REPORT 2026-11-01 — Desktop Agent D0–D5 (VIP + Public)

> **Scope:** oba desktop klienti — VIP (`apps/desktop-agent`, placený) a Public (`apps/public-miner`, zdarma) — one-click mining, build matrix, licence/autoupdate, BOOST revenue.
> **Plán:** [`DESKTOP-AGENT-COMPLETE-PLAN.md`](../../3.3/DESKTOP-AGENT-COMPLETE-PLAN.md) v1.3
> **Build guide pro GPU stroj:** [`docs/3.2/ops/DESKTOP-GPU-BUILD-GUIDE.md`](../ops/DESKTOP-GPU-BUILD-GUIDE.md)
> **Baseline commit:** `d83a24041` (+ tento report)

---

## 1. Hotovo

### D0 — Rozdělení editions ✅

| Změna | Soubor |
|---|---|
| `--edition vip\|public` flag, VIP bez `public_build`, Public s ním | `apps/desktop-agent/scripts/prepare-rust-miner.js` |
| Public miner přesunut z `archive/DesktopAgentP3.0.6` → `apps/public-miner/` | git mv (65 tracked souborů) |
| Update/license server přesunut `archive/update-server` → `apps/update-server/` | git mv |
| Ověřeno: VIP `aarch64` binary obsahuje ZANO/QTC/PEARL/VRSC + pool URLs | `strings`, `--version` |

### D3 — Build pipeline (mac hotovo)

| Artefakt | Cesta | Velikost |
|---|---|---|
| VIP macOS arm64 DMG | `apps/desktop-agent/dist/zion-desktop-agent-v3.2.0-mac-arm64.dmg` | 187 MB |
| Public macOS arm64 DMG | `apps/public-miner/dist/zion-public-miner-v3.2.0-mac-arm64.dmg` | 146 MB |
| Windows CPU-only binárky | `dist/desktop-2026-11-01/windows-x64/` | 4× .exe |

- Oba DMG: ad-hoc signed, notarizace skipped, BUILD-INFO + SHA256SUMS.
- Mac binárky: `zion-miner`, `zion-universal-miner`, `zion-node`, `zion` (CLI), builděné 1. 11.
- Windows CPU-only: bez `gpu-opencl` (mingw OpenCL ICD nedostupný).

### D4 — Autoupdate kód ✅

- VIP: license-gated `updates.zionterranova.com/api/check-update` primární, GitHub fallback (`apps/desktop-agent/src/main.js`).
- Public: GitHub feed (existující).
- Deploy artefakty: `.env.example`, `deploy/zion-update-server.service`, `infra/nginx/edge2/updates.zionterranova.com.conf` (staged).

### D5 — Public revenue ✅

- BOOST **vždy on** — `default_stream3_enabled()` = `true` v `V31/L1/miner/src/auto_detect.rs` (obě editions).
- Jasné vysvětlení BOOST v public first-run wizardu (cs) — `apps/public-miner/src/ui/index.html`.
- **Revenue dashboard** — `ZION_OS/revenue-dash/` (Flask, port 8770), live data z pool API:
  - 11 BOOST coinů + ZION
  - 12,3 PH/s total hashrate (PRL dominuje)
  - 465k accepted shares
  - auto-refresh 30 s, deploy unit

---

## 2. Klíčová zjištění

| # | Zjištění | Dopad |
|---|---|---|
| 1 | **PRL (Pearl) je `disabled`** v `CoinProfile` („not production-ready / placeholder pool and kernel") | Stream 4 = PRL nejede; aktuálně QTC (GPU) + VRSC (CPU). Pool PRL ale live (12,3 TH/s, `prl-native`+`prl-upstream` connected) → `disabled_reason` může být zastaralý, rozhodnutí 👤. |
| 2 | **Linux cross-compile z macOS selhal** (`blake3`/`ring` C build scripts pod `cargo-zigbuild`) | Vyžaduje Linux host nebo Docker. |
| 3 | **Windows OpenCL cross-compile z macOS selhal** (`-lOpenCL`) | Vyžaduje Windows host s OpenCL SDK + MSVC target. |
| 4 | **Code signing** — macOS ad-hoc, Windows unsigned | Vyžaduje Apple Developer ID + Windows cert. |
| 5 | Public miner `node_modules` (612 MB) v archivu | Odstraněno, `.gitignore` pokrývá `**/node_modules/`. |

---

## 3. Co zbývá (mimo tento Mac)

| Úkol | Závislost | Postup |
|---|---|---|
| Windows GPU installer (NSIS) | Windows + NVIDIA CUDA + OpenCL SDK + MSVC | [GPU build guide](../ops/DESKTOP-GPU-BUILD-GUIDE.md) §1 |
| Linux AppImage + DEB | Linux + OpenCL ICD + CUDA | [GPU build guide](../ops/DESKTOP-GPU-BUILD-GUIDE.md) §2 |
| Code signing | Apple Developer ID / Windows cert | [GPU build guide](../ops/DESKTOP-GPU-BUILD-GUIDE.md) §3 |
| Licence server nasazení | 👤 (DNS flip, certbot, systemd) | `apps/update-server/deploy/` |
| Stripe/Coinbase checkout | 👤 klíče | D4 |
| Licence enforcement | závisí na serveru | D4 |
| EN překlad BOOST wizardu | i18n systém (nyní cs only) | D5 |
| PRL povolení jako BOOST | 👤 rozhodnutí (odstranit `disabled_reason`) | D5 |

---

## 4. Ověření

- `node --check` na `apps/desktop-agent/src/main.js`, `renderer.js`, `prepare-rust-miner.js` — PASS.
- `cargo check -p zion-miner` po změně `auto_detect.rs` — PASS.
- macOS DMG: `zion-miner --version` = `3.2.0 build 86064c342608` (VIP) / `70ed7b7557fa-dirty` (Public).
- Revenue dashboard: `/health` 200, `/api/revenue` vrací 12 coinů, 11 BOOST aktivních, 465k accepted.
- Windows CPU-only: 4× `.exe` + SHA256SUMS.

---

## 5. Ekosystémové změny (kontext pro GPU build)

Paralelní stopy (MarketPlace, nirvana) dodaly změny, na které desktop navazuje:

| Změna | Commit | Dopad na desktop |
|---|---|---|
| Time-boxed token kampaně — `book-001` 144k ZION do 24. 12. 2026, `campaign:*` ShopSetting | `6ad1d4e0f` | desktop shop musí číst `zionTokens` snapshot ze serveru, ne hardcodovat |
| Shop paid-path + bonus auto-payout + CLI 3.2.0 fix | `a7b083d92` | desktop payout path vyžaduje **zion 3.2.0 CLI** (bundle 1. 11. = 3.2.0) |
| Rasta e-maily (7 typů) | `3ec2900d9` | — |
| Hiran Sun portál (nirvana `#portal=hiran`, `/api/hiran` proxy) | `906f3ee8f` | desktop `ai-chat-ask` používá `HIRAN_INFERENCE_URL`; fallback EDGE2 CPU |
| VR test (1M ZION bonus, block 104061) | `a7b083d92` | — |

Detail: [`DESKTOP-AGENT-COMPLETE-PLAN.md`](../../3.3/DESKTOP-AGENT-COMPLETE-PLAN.md) §13.

---

## 6. Commity

| Commit | Obsah |
|---|---|
| `0db74fb00` | desktop plán v1.0 |
| `b9bef821c` | W0 closeout (Fáze A) |
| `aa6599cce` | kanonizace truth-sync |
| `10760c6f7` | W1.5 audit pin |
| `ff240b98c` | kanonizace W2/W3 |
| `86064c342` | W1.4 windows pokus |
| `d9358015e` | 6.B4 DeSci (paralelní) |
| `0a0618102` | D5/D4 BOOST + update-server |
| `308c0c0d2` | D5 public wizard BOOST |
| `14ab3d373` | D4 VIP autoupdate |
| `1e65206c5` | plán v1.2 |
| `70ed7b755` | D3 mac VIP DMG |
| `f5546312e` | D3 mac Public DMG |
| `d5f81c01b` | D3 Linux cross-compile fail |
| `ca6aeeafe` | public-miner lock sync |
| `d83a24041` | D5 revenue dashboard |
