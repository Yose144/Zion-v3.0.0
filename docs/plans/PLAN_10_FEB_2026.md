# 📋 ZION v2.9.5 — Plán 10. února 2026

> **Cíl dne:** Desktop Agent = one-click mining na všech platformách (macOS Metal GPU hashuje, pool přijímá shares)

---

## ✅ Co je hotové (9.–10. únor)

| # | Úkol | Stav |
|---|------|------|
| 1 | Desktop Agent — CH3 UI (Network tab, GPU badge, stream indicator, server monitor) | ✅ |
| 2 | Desktop Agent — IPC bridges (preload.js) + renderer logika | ✅ |
| 3 | Desktop Agent — main.js GPU auto-detect, server status, CH3 parsing | ✅ |
| 4 | Rust miner rebuild s `--features metal` (Apple Silicon M1-M5) | ✅ |
| 5 | `prepare-rust-miner.js` — auto-detect platforma (macOS→metal, Linux→gpu+cuda, Win→gpu+cuda) | ✅ |
| 6 | `package.json` — `--auto` flag místo hardcoded `--features gpu` | ✅ |
| 7 | Metal binárka zkopírovaná do `resources/` (2.7 MB arm64 Mach-O) | ✅ |
| 8 | 3 servery online (Helsinki/USA/Singapore), pool přijímá shares od Docker mineru | ✅ |
| 9 | **Pool Stratum fix** — restart vyřešil stuck handler, pool login + job funguje | ✅ |
| 10 | **Metal GPU mining ověřeno** — Apple M1 @ **2.44 MH/s**, 45+ shares ACCEPTED, 0 rejected | ✅ |
| 11 | **End-to-end test** — přímý miner → Helsinki pool → shares accepted (`result: true`) | ✅ |

---

## 🟢 Vyřešené problémy (10. únor)

### P1: Pool Stratum handshake ✅ VYŘEŠENO
- **Symptom:** Miner se připojí, ale login timeoutuje
- **Příčina:** Pool handler se zasekl (deadlock/stuck state). Docker interní miner fungoval, externí ne.
- **Řešení:** `docker compose restart pool` na Helsinki. Po restartu pool okamžitě odpovídá na login + posílá Cosmic Harmony joby.
- **Výsledek:** Login OK → job `h822, algo=cosmic_harmony, diff=1000` → shares ACCEPTED

### P2: Metal GPU mining ✅ OVĚŘENO
- **Apple M1**: 2.44 MH/s (batch 2.50 MH/s), batch size 500,000
- **CPU (1 vlákno)**: ~550 kH/s
- **Combined**: ~2.0 MH/s celkový hashrate
- **Share rate**: ~2 shares/sec (1 share na ~500k hashů při diff=1000)
- **45 GPU shares ACCEPTED za 40 sekund, 0 REJECTED**

### P3: NCL AI Native server offline — NEBLOKUJE
- Graceful offline mode funguje (`⚠️ NCL init failed: Request timeout`)
- Mining pokračuje bez NCL bonusů

---

## 🔴 Zbývající problémy

### P4: RPC port 8545 nereaguje
- **Příčina:** `zion-core` v Dockeru naslouchá na portu 8444, není exposed
- **Řešení:** Přidat `8545:8444` port mapping v docker-compose
- **Dopad:** Pool nemůže fetcovat block templates → `height: 0` joby

---

## 📌 Plán na 10. únor — Prioritní pořadí

### 🔥 Priorita 1: Fix Pool Stratum (aby miner hashoval)
```
Čas: ~1-2h
```
1. SSH na Helsinki, zkontrolovat pool Rust source — Stratum listener
2. Ověřit že pool odpovídá na `mining.subscribe` + `mining.authorize` pro lokální minere
3. Pool musí poslat Cosmic Harmony job po autorizaci
4. Test: Desktop Agent → 77.42.31.72:3333 → shares accepted → hashrate > 0

### 🔥 Priorita 2: Verify Metal GPU mining
```
Čas: ~30min
```
1. Spustit Desktop Agent (`npm start`)
2. Ověřit v logách: `Metal GPU initialized` (ne `Metal feature not enabled`)
3. Ověřit GPU hashrate v dashboard — měl by být vyšší než CPU-only
4. Pokud Metal nefunguje → zkontrolovat `zion-cosmic-harmony-v3/src/metal.rs` runtime

### ⚡ Priorita 3: One-click test na macOS
```
Čas: ~30min
```
1. `npm run build:mac` → ověřit že electron-builder vytvoří .dmg/.app
2. Test: otevřít .app → auto-start mining → shares přijaty → hashrate zobrazený
3. Ověřit Network tab — servery zelené, GPU detected, stream indicator živý

### 🛠️ Priorita 4: Cross-platform build ověření
```
Čas: ~1h
```
1. `npm run build:win` → .exe portable (GPU=OpenCL)
2. `npm run build:linux` → .AppImage (GPU=OpenCL+CUDA)
3. Ověřit `prepare-rust-miner.js` auto-detect na jiné platformě (nebo cross-compile)

### 📊 Priorita 5: Dashboard polish
```
Čas: ~30min
```
1. Network tab — live server status se zeleným/červeným indikátorem
2. GPU badge na dashboard — "Apple M1 Metal" nebo "CPU Only"
3. Stream indicator — zobrazit aktuální algoritmus + revenue coin
4. Allocation bar — Z:50% R:25% N:25% vizualizace

---

## 🎯 Definition of Done (10. únor večer)

- [x] Desktop Agent spustí mining jedním klikem
- [x] Metal GPU aktivní a hashuje na Apple Silicon — **2.44 MH/s**
- [x] Pool přijímá shares od desktop mineru — **45+ accepted, 0 rejected**
- [x] Hashrate > 0 zobrazený v dashboard — **~2.0 MH/s combined**
- [ ] Network tab ukazuje živý stav serverů
- [x] `npm run build:mac` vytvoří funkční .app/.dmg — **250 MB DMG, arm64**
- [x] Vše commitnuté a pushnuté na git — `1f8e984`

---

## 📁 Soubory k úpravě

| Soubor | Úprava |
|--------|--------|
| `2.9.5/zion-native/pool/src/stratum/` | Fix Stratum handshake pro lokální minere |
| `desktop-agent/src/main.js` | Případné tweaky miner spawn args |
| `desktop-agent/resources/zion-universal-miner` | Nová Metal binárka (už hotová) |
| `docker-compose na serverech` | Fix RPC port mapping |

---

## 🏗️ Architektura (připomenutí)

```
Desktop Agent (Electron)
  ├── resources/zion-universal-miner (Rust, --features metal)
  ├── src/main.js → spawns miner → parses stdout
  ├── src/preload.js → IPC bridge
  └── src/ui/ → index.html + renderer.js
        ├── Dashboard: hashrate, shares, GPU badge, stream
        ├── Network: servers, GPU detect, CH3 scheduler
        └── Wallet, AI, Chat, Settings, Logs, About

Pool (Rust, Docker)
  ├── Stratum :3333 → accepts miners
  ├── CH3 Stream Scheduler → ZION/Revenue/NCL time-split
  └── Revenue Proxy → MoneroOcean, 2miners, etc.

Servers: Helsinki 🇫🇮 | USA 🇺🇸 | Singapore 🇸🇬
```

---

*Vytvořeno: 9. února 2026, 03:45 CET*
*Aktualizováno: 10. února 2026, 11:20 CET — P1+P2 vyřešeny, e2e mining funguje*
