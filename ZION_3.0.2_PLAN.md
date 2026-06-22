# ZION 3.0.2 — Kanonický Plán L2/L3/L4 Oasis

> **Jedna vize, jeden zdroj pravdy, šest vrstev.**
> 
> Datum: 2026-06-22 | Verze: 3.0.2-beta | Autor: ZION Core Team

---

## Přehled

Verze 3.0.2 představuje přechod z čistého L1 mainnetu k **plně integrovanému ekosystému L1-L6**. Zaměřuje se na:

1. **L2 Kanonizace** — Bridge, DAO, Atomic Swap jsou mainnet-ready
2. **L3 Kanonizace** — WARP cross-chain, AI-Native layer, NCL marketplace  
3. **L4 Oasis Příprava** — UE5 základ, BP_HUD, BP_Character, territory systém
4. **Jeden Zdroj Pravdy** — všechny dokumenty konsolidovány, žádné duplicity

---

## 1. L2 — Zion Layer 2 (Dokončeno ✓)

### 1.1 Bridge (L1 ↔ EVM)
- [x] Relay daemon s L1 + EVM watchery
- [x] SQLite persistencia
- [x] Prometheus metrics
- [x] Mainnet konfigurace v `V3/L2/bridge/`

### 1.2 DAO
- [x] Axum HTTP API
- [x] Treasury + governance moduly
- [x] SQLite backend
- [x] Deploy na Edge server

### 1.3 Atomic Swap (HTLC)
- [x] HTLC swap daemon
- [x] L1 watcher + refund loop
- [x] Volitelný EVM watcher
- [x] `/swap` web stránka
- [x] E2E integrační testy

### 1.4 L2 Kanonizace Úkoly
- [ ] Aktualizace `StatusV3.md` — označit L2 jako "Live"
- [ ] Dokončit L2 dokumentaci v `V3/L2/README.md`
- [x] Audit L2 bridge — `L2audit.md` v rootu
- [x] Sjednotit testnet konfigurace na 2/2 multisig
- [x] Připravit mainnet konfiguraci pro 5/5 multisig
- [x] Nahradit mainnet placeholder adresy reálnými adresami z webu
- [ ] Zafundovat 5 mainnet validator adresy ETH na Base
- [ ] Nasadit nový 5/5 `ZIONBridge` (stávající mainnet bridge má threshold 1 — single-sig)
- [ ] Převést wZION ownership na nový 5/5 bridge
- [ ] Přesunout `L2bigupgrade.md` → `docs/3.0.1Genesis/L2bigupgrade.md` (již hotovo)

---

## 2. L3 — WARP + AI-Native + NCL (Dokončeno ✓)

### 2.1 WARP Cross-Chain
- [x] 21 chain adaptérů (Bitcoin Lightning, Sui, Aptos, Near, Ton, EVM tier-1)
- [x] Axum API + background watcher
- [x] Swap agregátor s reálnými EVM RPC quotes
- [x] Bridge API integrace

### 2.2 AI-Native Layer
- [x] AI Safety guards + kill switch
- [x] Audit log
- [x] Agent CLI kompatibilní endpointy
- [x] Hiran v2.3 inference (llama-server.exe / LM Studio / Ollama)

### 2.3 NCL Marketplace
- [x] NCL gateway
- [x] Dashboard API proxy
- [x] Slot0 parsing + orchestrator unit testy

### 2.4 L3 Kanonizace Úkoly
- [ ] Aktualizovat `V3/L3/README.md` s kompletním registry
- [ ] Dokumentace swap agregátoru v `V3/L3/warp/docs/`
- [ ] Přesunout `L3bigupdate.md` → `docs/3.0.1Genesis/` (již hotovo)

---

## 3. L4 — ZION Oasis (Příprava 🚧)

### 3.1 UE5 Základ
- [x] `V3/L4/oasis/ue5/` — Unreal Engine 5 projekt
- [x] BP_GoldenEggManager, BP_TerritoryManager
- [x] BP_ZionOasisGameMode, BP_ZionCharacter
- [x] BP_ZionPlayerController, BP_ZionHUD
- [x] LV_MainMenu, LV_World

### 3.2 L4 Přípravné Úkoly
- [ ] Definovat L4 → L1 bridge (OASIS token standard)
- [ ] Návrh territory systému (on-chain land registry)
- [ ] Integrace BP_HUD s live L1 daty (pool, hashrate, cena)
- [ ] Mobilní companion app (React Native) — základ
- [ ] Základní ekonomika Oasis (resource mining, crafting)

---

## 4. Kanonizace — Jeden Zdroj Pravdy

### 4.1 Root Adresář (Dokončeno ✓)
- [x] MD soubory → `docs/3.0.1Genesis/`
- [x] Bat soubory ponechány v rootu (`start-all.bat`, `run-*.bat`)
- [x] PS1 skripty → `scripts/` nebo ponechány pro lokální spuštění
- [x] Python deploy skripty → `scripts/`
- [x] Log soubory → `logs/`

### 4.2 Dokumentační Strom
```
Root kanonické soubory:
├── README.md              — Hlavní dokumentace (v3.0.2)
├── ROADMAP.md             — Cestovní mapa
├── AGENTS.md              — Agent instrukce
├── StatusV3.md            — Aktuální status
├── QUICKSTART.md          — Rychlý start
├── ZION_3.0.2_PLAN.md     — Tento soubor
└── LICENSE

Archiv / Historie:
docs/3.0.1Genesis/         — Všechny 3.0.0–3.0.1 dokumenty
```

### 4.3 Přesunuté Soubory (v3.0.2 cleanup)
| Soubor | Původní umístění | Nové umístění |
|--------|-----------------|----------------|
| L2bigupgrade.md | root | docs/3.0.1Genesis/ |
| L3bigupdate.md | root | docs/3.0.1Genesis/ |
| GENESIS_HARD_RESET_E2E.md | root | docs/3.0.1Genesis/ |
| FIRE_*_PLAN.md | root | docs/3.0.1Genesis/ |
| HIRAN_*_GUIDE.md | root | docs/3.0.1Genesis/ |
| deploy_*.py | root | scripts/ |
| tmp_*.py | root | docs/3.0.1Genesis/ |
| *.log | root | logs/ |

---

## 5. L5/L6 — Issobella + Humanitarian (Plánováno)

### 5.1 L5 — Issobella Space Layer
- [ ] Satellite node komunikační protokol
- [ ] Space-hardened consensus (Byzantine fault tolerant)
- [ ] Ground station API

### 5.2 L6 — Humanitarian Layer  
- [ ] Children Future Fund distribuce (automatizovaná)
- [ ] NGO partner integrace
- [ ] Transparentní audit trail on-chain

---

## 6. Verzovací Schéma

| Verze | Datum | Co je hotovo |
|-------|-------|--------------|
| 3.0.0 | 2026-05 | Genesis reset, L1 mainnet, core pool/miner |
| 3.0.1 | 2026-06-10 | Fire fork, KAT vektory, dashboard 2.0, L2/L3 základ |
| **3.0.2** | **2026-06-18** | **L2/L3 kanonizace, L4 Oasis příprava, root cleanup** |
| 3.0.3 | 2026-07 | L4 Oasis alpha, mobilní app, L2/L3 mainnet deploy |
| 3.1.0 | 2026-Q4 | Full L2-L6 integrace, satellite test |

---

## 7. Okamžité Akce (Next Steps)

1. **Commit cleanup** — `git add -A && git commit`
2. **Push** — `git push origin main`
3. **Edge sync** — `git pull origin main` na Edge serveru
4. **L2 deploy** — Spustit bridge, DAO, atomic-swap na Edge
5. **L3 verify** — Testovat WARP registry, swap agregátor
6. **L4 kickoff** — UE5 build pipeline, L4 → L1 bridge návrh

---

## Přílohy

- [StatusV3.md](StatusV3.md) — Aktuální technický status
- [ROADMAP.md](ROADMAP.md) — Dlouhodobá cestovní mapa
- [AGENTS.md](AGENTS.md) — Devin/WARP/Copilot instrukce
- [docs/3.0.1Genesis/](docs/3.0.1Genesis/) — Archiv verzí 3.0.0–3.0.1
