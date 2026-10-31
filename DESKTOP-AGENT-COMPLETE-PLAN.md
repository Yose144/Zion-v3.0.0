# ZION Desktop Agent — kompletní plán (VIP + Public)

> **Verze:** 1.0 · **Datum:** 2026-11-01 · **HEAD:** `86064c342`
> **Rozsah:** dva desktop klienti — **VIP** (`apps/desktop-agent`, placený) a **Public** (`archive/DesktopAgentP3.0.6`, veřejný zdarma). Cíl: oba do plné podoby s one-click miningem na macOS, Windows a Ubuntu.
> **Nadřazené dokumenty:** [`AGENTS.md`](AGENTS.md) (topologie, release proces), [`docs/3.2/3.2.1-3.2.9_PLAN.md`](docs/3.2/3.2.1-3.2.9_PLAN.md) (RC/Stable gate), [`NIRVANA-V3.3-KRALOVSTVI-SRDCE-PLAN.md`](NIRVANA-V3.3-KRALOVSTVI-SRDCE-PLAN.md) (W0–W6). Tento plán je **sub-plán pro desktop klienty**, nenahrazuje je.

---

## 0. Jak číst

1. **§1** je ověřený stav — měřeno 1. 11. 2026 v kódu, ne citováno z README.
2. **§2** je architektura mineru (feature flags, backends, streamy, coiny).
3. **§3** je gap analýza VIP, **§4** Public.
4. **§5** one-click mining (společný pro oba).
5. **§6** build pipeline (macOS / Windows / Ubuntu × OpenCL / CUDA / Metal).
6. **§7** licencování a platba VIP, **§8** revenue/liquidity pro Public.
7. **§9** fáze, **§10** akceptační kritéria, **§11** rizika, **§12** co plán nedělá.

---

## 1. Ověřený stav (2026-11-01)

### 1.1 Dvě verze — kde jsou

| Verze | Cesta | `package.json` name | Verze | Branding | Stav |
|---|---|---|---|---|---|
| **VIP** (placená) | `apps/desktop-agent/` | `zion-desktop-agent` | `3.2.0` | plné coiny (ZANO/QTC/PEARL/VRSC), Trinity, license gate | 🔄 funkční základ, ale buildí `public_build` (rozpor) |
| **Public** (zdarma) | `archive/DesktopAgentP3.0.6/` | `zion-public-miner` | `3.2.0` | `PUBLIC_BUILD=true`, BOOST 1/BOOST 2 | 🔄 nedodělaná, zastaralá, `node_modules` v archivu |

### 1.2 Co oba mají

- Electron + Node.js (`src/main.js` ~9 500 řádků, `src/ui/renderer.js` ~8 000 řádků).
- Bundlované binárky v `resources/`: `zion-miner`, `zion-universal-miner`, `zion-node`, `zion`, `zion-miner-linux-x86_64`.
- Trinity panel (3 streamy: ZION + GPU externí + CPU externí).
- Auto-detekce HW (`V31/L1/miner/src/auto_detect.rs`).
- Multi-GPU (`config.gpuDevices`, per-device quarantine, VRAM budget).
- Per-stream toggles (`stream1/2/3`), duty-starvation guard, GPU health guard.
- Build skripty: `build:win` (NSIS+zip), `build:mac` (dmg), `build:linux` (AppImage+deb), `build:all`.

### 1.3 Co VIP má navíc (oproti Public)

- License gate (`get/set/validate-license` IPC, `X-License-Key` header pro update server).
- Auto-update přes `updates.zionterranova.com` (license-gated) vs. Public GitHub feed.
- Plné coin names v UI/logech (ZANO, QTC, PEARL, VRSC).
- Autonomous profit router (`V31/L1/miner/src/autonomous.rs`) — jen `#[cfg(not(feature = "public_build"))]`.

### 1.4 Klíčový rozpor (musí se opravit)

`apps/desktop-agent/scripts/prepare-rust-miner.js` řádek 131–133:
```js
// The desktop agent is the public-facing bundle: always use public_build
const publicFlag = 'public_build';
```
**To je v rozporu se zadáním.** VIP verze musí být builděná **bez** `public_build`, aby odhalila ZANO/QTC/PEARL a profit router. `public_build` patří jen Public verzi. Toto je **první oprava** (Fáze D0).

### 1.5 Ověřené binárky v resources

- `apps/desktop-agent/resources/zion-miner` — 5,4 MB, 24. 10. (stará, před RC).
- `apps/desktop-agent/resources/zion-miner-linux-x86_64` — 8,8 MB, 24. 10.
- `archive/DesktopAgentP3.0.6/resources/` — stejná sada, `node_modules` přítomný (rozbalený, ~200 MB).

---

## 2. Architektura mineru (co je k dispozici)

### 2.1 Cargo features (`V31/L1/miner/Cargo.toml`)

| Feature | Význam |
|---|---|
| `auxpow` (default) | external streamy (GPU + CPU) |
| `public_build` | skryje coiny v TUI/logech → BOOST branding |
| `native-hashers` | C toolchain (RandomX, GhostRider, VerusHash, …) |
| `native-all` | všechny native algo shimy |
| `gpu-opencl` | AMD/Intel/NVIDIA přes OpenCL |
| `gpu-cuda` | NVIDIA CUDA (vyžaduje NVRTC runtime) |
| `gpu-metal` | Apple Silicon Metal |
| `gpu-all` / `full` | všechny backendy + native |
| `tui` | ratatui interaktivní TUI |

### 2.2 GPU backendy per platforma

| Platforma | NVIDIA | AMD/Intel | Apple Silicon |
|---|---|---|---|
| Linux x86_64 | OpenCL / CUDA | OpenCL | — |
| Windows x86_64 | OpenCL / CUDA | OpenCL | — |
| macOS arm64 | — | OpenCL (legacy) | Metal |
| macOS x86_64 | — | OpenCL (legacy) | Metal |

### 2.3 Trinity streamy

- **Stream 1** — ZION (`ekam_deeksha`), vždy on.
- **Stream 2** — GPU externí (ZANO `progpow_zano` / QTC / PEARL `pearl_pouw`), `public_build` → BOOST 1.
- **Stream 3** — CPU externí (VRSC `verushash`), `public_build` → BOOST 2.

### 2.4 Coiny (`V31/L1/cosmic-harmony/src/profit.rs`)

`ExternalCoin` enum obsahuje 33 coinů včetně **Zano**, **Pearl**, **Quantus (QTC)**, **Verus (VRSC)**, **Beam**, **Karlsen**, **Ravencoin**, **Ergo**, **Monero**, **Kaspa**, **Alephium**, **Decred** ad. `select_best_coin` filtruje `disabled_reason` coiny.

### 2.5 Autonomní profit router

`autonomous.rs` — fetch profitability (whattomine/coingecko + fallback), net profit = revenue − electricity, hysteresis 15 %, jen `not(public_build)`.

---

## 3. Gap analýza — VIP (`apps/desktop-agent`)

| # | Gap | Dopad | Návrh |
|---|---|---|---|
| V1 | **Buildí `public_build`** (rozpor §1.4) | VIP skrývá coiny, profit router je no-op | `prepare-rust-miner.js`: VIP větev bez `public_build`; Public větev s ním. Přidat `--edition vip|public`. |
| V2 | **One-click mining** není plně automatický | Uživatel musí projít nastavením | First-run wizard: detekce HW → auto-výběr backendu → auto-výběr coinů → start. `config.autonomous=true` default pro VIP. |
| V3 | **Přepínání coinů ZANO/QTC/PEARL** jen částečné | Chybí UI pro ruční override + live profit ranking | Trinity panel: per-stream coin dropdown (VIP only) + profit ranking + hysteresis. |
| V4 | **Multi-GPU** funkční, ale UI nejasné | Uživatel nevidí, která karta dělá co | Per-GPU karta: hashrate, teplota, VRAM, quarantined, nonce range. |
| V5 | **Nativní buildy** (opencl/cuda/metal) závisí na `prepare-rust-miner` | CUDA build může tiše fallbackovat na OpenCL | Explicitní build matrix + verify (`--version` + backend probe) + BUILD-INFO. |
| V6 | **Licence/platba** jen update header | Není enforcement, není checkout | License server + Stripe/Coinbase checkout + offline grace period. |
| V7 | **Auto-update** license-gated, server neběží | VIP nedostane update | Rozhodnout: GitHub feed i pro VIP, nebo dofinancovat update server. |
| V8 | **Testy** chybí E2E pro všechny 3 platformy | Regrese při buildu | CI matrix (mac/win/linux) + smoke test one-click. |

---

## 4. Gap analýza — Public (`archive/DesktopAgentP3.0.6`)

| # | Gap | Dopad | Návrh |
|---|---|---|---|
| P1 | **Umístění v `archive/`** | Není aktivní track, snadno zapadne | Přesunout do `apps/public-miner/` (nebo `apps/desktop-agent-public/`) a archivovat jen snapshot. |
| P2 | **Zastaralé binárky** (24. 10.) | Nekonzistentní s RC | Rebuild z RC commitu (`86064c342`+) se `public_build`. |
| P3 | **`node_modules` v archivu** | 200 MB balast v gitu/archivu | `.gitignore` + `npm ci` v buildu. |
| P4 | **One-click mining** jen částečný | Uživatel musí nastavit wallet/pool | First-run: auto wallet generate nebo import, default pool `stratum.zionterranova.com:8444`, start. |
| P5 | **BOOST branding** konzistentní, ale revenue streamy nejsou vidět | Uživatel neví, že přispívá | Volitelné „Support ZION" toggle (default on) s vysvětlením, že BOOST streamy financují vývoj/liquidity. |
| P6 | **Chybí licence/attribution** | Právní | MIT + disclaimer v installeru. |
| P7 | **Testy** chybí E2E | Regrese | Stejná CI matrix jako VIP (public edition). |
| P8 | **Update feed** GitHub (public) | OK, ale bez podpisu | Code signing (Win/mac) + notarizace (mac). |

---

## 5. One-click mining (společný cíl)

### 5.1 First-run flow (oba)

1. **Welcome** — jazyk (cs/en), licence/disclaimer.
2. **HW detekce** — CPU model/cores/SIMD, GPU devices (backend/CUs/VRAM), RAM. Progress bar, ~2 s.
3. **Backend výběr** — auto: CUDA > OpenCL > Metal > CPU. Override v advanced.
4. **Wallet** — generate (12/24 slov, seed záloha) nebo import (`zion1...`).
5. **Mining plán** — VIP: Trinity + profit router (ZANO/QTC/PEARL auto); Public: ZION + BOOST 1/2 (auto, bez názvů coinů).
6. **Start** — jeden klik. Tray icon, hashrate, accept rate, block found toast.

### 5.2 Průběžný one-click

- **Start/Stop** — jedno tlačítko, drain-safe.
- **Pause** — dočasné pozastavení bez ztráty session.
- **Restart miner** — hot restart s novým configem.
- **Auto-reconnect** — pool výpadek → backoff → reconnect.

### 5.3 UX gate

- Bez konzole: vše v GUI (logy v collapsible panelu).
- Bez env vars: vše v UI, env jen pro power users.
- Error states: jasná hláška + „zkopírovat diagnostiku" tlačítko.

---

## 6. Build pipeline (macOS / Windows / Ubuntu)

### 6.1 Matice

| Cíl | Host | Nástroje | Feature flags | Artefakt |
|---|---|---|---|---|
| macOS arm64 | Apple Silicon Mac | Xcode CLT, Metal | `auxpow,gpu-metal,gpu-opencl,native-all,tui` | `.dmg` |
| macOS x86_64 | Intel Mac / cross | Xcode CLT, OpenCL | `auxpow,gpu-opencl,gpu-metal,native-all,tui` | `.dmg` |
| Windows x64 | Windows / cross (mingw) | VS Build Tools, CUDA Toolkit, NVRTC | `auxpow,gpu-opencl,gpu-cuda,native-all,tui` | `.exe` (NSIS), `.zip` |
| Linux x86_64 | Ubuntu 22.04/24.04 | build-essential, OpenCL ICD, CUDA | `auxpow,gpu-opencl,gpu-cuda,native-all,tui` | `.AppImage`, `.deb` |

### 6.2 Klíčové build gotchy (z AGENTS.md + dnešní zkušenost)

1. **`-lOpenCL` na mingw cross-compile selhává** — Windows OpenCL vyžaduje ICD loader (Khronos `OpenCL.lib`/`libOpenCL.a`). Bez něj nelze `gpu-opencl` cross-compile. Řešení: Windows build na Windows hostu s OpenCL SDK, nebo dodat `libOpenCL.a` do mingw sysroot.
2. **`ZION_DISABLE_OPENMP=1`** — zamezí Homebrew `libomp` závislosti.
3. **CUDA build** vyžaduje NVRTC runtime (`nvrtc64_*.dll`); bez něj fallback na OpenCL.
4. **GLIBC pro Linux** — build na Ubuntu 20.04 (glibc 2.31) nebo Docker focal pro starší cíle; Ubuntu 24.04 = glibc 2.39.
5. **`public_build` flag** — VIP bez, Public s. Nikdy obojí v jednom binárním stromu bez přejmenování.
6. **Code signing** — Windows Authenticode, macOS Developer ID + notarizace (vyžaduje Apple Developer Program $99/yr).
7. **Electron builder** — `signAndEditExecutable: false` v aktuálním configu (Win); pro produkci zapnout signing.

### 6.3 CI matrix (GitHub Actions)

- `desktop-release-vip.yml` — mac/win/linux, `--edition vip`.
- `desktop-release-public.yml` — mac/win/linux, `--edition public`.
- Gate: `npm test` + `node --check` + smoke launch (xvfb na Linuxu).
- Artefakty + `SHA256SUMS.txt` + `BUILD-INFO.txt` (commit, edition, features, platform).

---

## 7. Licencování a platba — VIP

### 7.1 Model

- **Free trial** — 7 dní plných funkcí, pak omezení na ZION-only (jako Public).
- **Lifetime license** — jednorázově (např. $49–99) přes Stripe/Coinbase Commerce.
- **Subscription** — volitelně měsíčně (např. $9/mo) s auto-update.

### 7.2 Enforcement

- Offline grace: 14 dní bez serveru, pak read-only.
- License key = podepsaný token (Ed25519) s HW fingerprintem (volitelně 2 zařízení).
- Server: `updates.zionterranova.com` (AppPay plán) — license validate + entitlement + release feed.

### 7.3 Co je potřeba

- Update/license server (kód jen v `archive/update-server`, nic neběží).
- Stripe/Coinbase klíče (`STRIPE_SECRET_KEY`, `COMMERCE_API_KEY`).
- Apple Developer Program + Windows Code Signing cert.

---

## 8. Revenue / liquidity — Public

### 8.1 Princip

Public miner těží **ZION** (stream 1) pro uživatele a **BOOST 1/2** (externí coiny) pro ZION revenue/liquidity. Uživatel dostává ZION podle PPLNS; BOOST výnos jde do pool wallet → treasury/liquidity.

### 8.2 Co je potřeba

- Pool wallet funding (viz W3.4) — jinak loyalty výplaty nefungují.
- Jasná komunikace: „BOOST streamy financují vývoj a liquiditu ZION" (volitelné vypnutí?).
- Revenue dashboard (interní) — kolik BOOST vydělal, kam šel.

### 8.3 Rizika

- Uživatel může BOOST vypnout (`ZION_STREAM2_ENABLED=0`) — akceptovat.
- Externí pool výpadky → fallback na ZION-only.

---

## 9. Fáze a pořadí

### D0 — Rozdělení editions (1–2 dny) · 🤖
- [ ] `prepare-rust-miner.js`: `--edition vip|public`, VIP bez `public_build`.
- [ ] Ověřit, že VIP binary odhalí ZANO/QTC/PEARL v TUI.
- [ ] Public binary (z `archive/`) přesunout do `apps/public-miner/` + `public_build`.
- [ ] `.gitignore` pro `node_modules` v public.

### D1 — One-click mining (3–5 dní) · 🤖
- [ ] First-run wizard (HW → backend → wallet → plán → start).
- [ ] VIP: profit router default on, coin dropdown.
- [ ] Public: BOOST branding + „Support ZION" toggle.
- [ ] Start/Stop/Pause/Restart bez konzole.

### D2 — Multi-GPU + coin switching UI (3–5 dní) · 🤖
- [ ] Per-GPU karta (hashrate, temp, VRAM, quarantine).
- [ ] Per-stream coin dropdown (VIP).
- [ ] Profit ranking + hysteresis indikátor.

### D3 — Build pipeline (3–5 dní) · 🤖
- [ ] Build matrix mac/win/linux × editions.
- [ ] Windows OpenCL SDK / libOpenCL.a fix.
- [ ] CUDA verify (NVRTC presence).
- [ ] BUILD-INFO + SHA256SUMS.
- [ ] CI workflows.

### D4 — Licence/platba (5–7 dní) · 🤖→👤
- [ ] License server (AppPay) — validate, entitlement, feed.
- [ ] Stripe/Coinbase checkout.
- [ ] Trial + offline grace.
- [ ] Code signing (👤 Apple/Windows certs).

### D5 — Public revenue (2–3 dní) · 🤖→👤
- [ ] Revenue dashboard.
- [ ] Pool wallet funding (👤 W3.4).
- [ ] „Support ZION" copy.

### D6 — Release (2 dny) · 👤
- [ ] mac/win/linux artefakty, SHA256SUMS, BUILD-INFO.
- [ ] GitHub release (VIP + Public).
- [ ] Update feed live.

---

## 10. Akceptační kritéria

| ID | Kritérium | Důkaz |
|---|---|---|
| **DA-1** | VIP binary odhalí ZANO/QTC/PEARL a profit router | TUI screenshot + `--version` build id |
| **DA-2** | Public binary skryje coiny (BOOST branding) | TUI screenshot |
| **DA-3** | One-click mining na všech 3 platformách | E2E video/screenshot |
| **DA-4** | HW autodetect správně vybere backend | log `HARDWARE DETECTION` |
| **DA-5** | Multi-GPU: 2+ karty těží, per-GPU stats | screenshot |
| **DA-6** | Coin switching: profit router přepne při >15 % | log `profit_switch` |
| **DA-7** | Build matrix: 6 artefaktů (2 editions × 3 platformy) | SHA256SUMS + BUILD-INFO |
| **DA-8** | VIP licence: trial → paid → offline grace | license server test |
| **DA-9** | Public revenue: BOOST výnos viditelný v dashboardu | interní dashboard |
| **DA-10** | Žádná regrese v `node --check` / `npm test` | CI zelené |

---

## 11. Rizika

| Riziko | Dopad | Mitigace |
|---|---|---|
| Windows OpenCL cross-compile | Build selže | Build na Windows hostu nebo dodat ICD loader |
| CUDA NVRTC chybí na cíli | Fallback na OpenCL | Detekce + jasná hláška |
| Code signing certy | Installer varování | 👤 Apple/Windows certs |
| License server neběží | VIP bez update | Offline grace + GitHub fallback |
| Public revenue závisí na pool wallet | BOOST bez výplaty | 👤 W3.4 funding |
| `archive/` public verze zastaralá | Nekonzistence | D0 přesun + rebuild |
| GLIBC kompatibilita | Binary neběží na starších distrech | Docker focal build |

---

## 12. Co tento plán nedělá

- Nemění L1 consensus ani miner algoritmy (jen build/UI).
- Nepřepíná money-paths bez 👤 (pool wallet, treasury).
- Nezavádí nové coiny — používá existující `ExternalCoin` enum.
- Neimplementuje AppPay server od nuly — předpokládá `archive/update-server` jako základ.
- Není náhradou RC/Stable gate — desktop release je samostatná trať.

---

## 13. Změnový log

| Datum | Změna |
|---|---|
| 2026-11-01 | v1.0 — vytvořeno po průzkumu `apps/desktop-agent`, `archive/DesktopAgentP3.0.6`, `V31/L1/miner` (auto_detect, autonomous, Cargo features), `cosmic-harmony/profit.rs`, build skriptů. Ověřen rozpor §1.4 (VIP buildí `public_build`). |
