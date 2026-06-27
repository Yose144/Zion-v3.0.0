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

### 1.4 L2 Mainnet Snapshot (2026-06-22)

| Metrika | Hodnota |
|---------|---------|
| wZION totalSupply (Base) | **300 wZION** |
| wZION v `UniV3Pool` | **54 wZION** + 0.000463 WETH |
| wZION na `ZIONBridge` | **0 wZION** (bridge vault na Base je prázdný, L1 lock mintuje on-demand) |
| Zbytek wZION | ~246 wZION drží uživatelé/treasury |

> **Poznámka:** 300 wZION jsou tedy **celkový oběh**, nikoliv zásoba na bridge. Na bridge se ZION dostává až locknutím na L1 (vytvoří se wZION na Base). Pro DeFi swap je 54 wZION v UniV3 poolu.

### 1.5 L2 Kanonizace Úkoly
- [x] Aktualizace `StatusV3.md` — označit L2 jako "Live"
- [ ] Dokončit L2 dokumentaci v `V3/L2/README.md`
- [x] Audit L2 bridge — `L2audit.md` v rootu
- [x] Sjednotit testnet konfigurace na 2/2 multisig
- [x] Připravit mainnet konfiguraci pro 5/5 multisig
- [x] Nahradit mainnet placeholder adresy reálnými adresami z webu
- [x] Zafundovat 5 mainnet validator adresy ETH na Base (minimum done)
- [x] Nasadit nový 5/5 `ZIONBridge` na 0x89504D6eD6993d726438E1A9C18aaC79e8d0eF88
- [x] Nasadit nový 5/5 `BridgeValidator` na 0x9C138dC6ebA8A883AB3802F6Dcb79C772a835627
- [x] Převést wZION BRIDGE_ROLE na nový 5/5 bridge
- [x] Spustit mainnet bridge relay v3.0.2 na Edge serveru (L1 node + EVM watcher aktivní)
- [x] Deploynout web v3.0.2 na `zionterranova.com/defi` s novou bridge adresou
- [ ] Dofundovat validator adresy na ≥0.01 ETH pro provozní rezervu
- [ ] Provést E2E test: L1 lock → Base mint a Base burn → L1 unlock
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
| 3.0.2 | 2026-06-18 | L2/L3 kanonizace, L4 Oasis příprava, root cleanup |
| **3.0.3** | **2026-06-27** | **Decimal fork (1e12→1e6), Edge deployment, web upgrade, dashboard tuning** |
| 3.1.0 | 2026-Q4 | Full L2-L6 integrace, satellite test |

### 3.0.3 Decimal Fork — Co bylo dokončeno (2026-06-27)

- ✅ **L1 Core:** migration.rs module, height-conditional consensus, RPC contract bump (_flowers canonical)
- ✅ **L2 Bridge:** FLOWERS_TO_WEI_FACTOR 1e6→1e12 (EVM 18-6=12)
- ✅ **L2 DAO:** FLOWERS_PER_ZION, thresholds, treasury, vote weights
- ✅ **L3 WARP:** ChainId decimals, fees, router, xp_bridge
- ✅ **L3 NCL + AI-Native:** pricing, orchestrator, transfer limits
- ✅ **ZION_OS Dashboard:** app.py, dashboard.js, l3.html (34 replacements)
- ✅ **Web v2.9:** constants.ts, zion-rpc.ts, 10 .tsx files (16 amount conversions)
- ✅ **Edge deployment:** DB preserved, MIGRATION_HEIGHT=17995, 13/13 services active
- ✅ **Documentation:** 27 files + StatusV3.md + AGENTS.md + ROADMAP.md + upgrade doc
- ✅ **Tests:** ~1,223 workspace tests, 0 failures
- ✅ **Price decision:** $0.0002/ZION (Doge legend)

Viz [`ZION_3.0.3_DECIMAL_FORK_PLAN.md`](ZION_3.0.3_DECIMAL_FORK_PLAN.md) pro kompletní plán a [`StatusV3.md`](StatusV3.md) pro deployment detaily.

---

## 7. Okamžité Akce (Next Steps po 3.0.3)

### ✅ Hotovo (3.0.3 Decimal Fork — 2026-06-27)
- [x] Decimal fork 1e12→1e6 — kompletní ekosystém migrován
- [x] Edge deployment — DB preserved, 13/13 services active
- [x] Web v2.9 upgrade — constants + .tsx + upgrade doc
- [x] Dashboard tuning — PPLNS, payout, balance, send e2e verifikováno
- [x] Dokumentace — 27+ souborů aktualizováno

### 🔄 Další na plánu (3.1.0 — Q4 2026)

> **Audit:** Viz [`AUDIT_3.1.0_EXISTING_CODE.md`](AUDIT_3.1.0_EXISTING_CODE.md) — všechny 4 komponenty už existují, potřebují 3.0.3 fix + completion (žádné duplikace).

#### Fáze 1 — 3.0.3 Compatibility Fix ✅ DONE (commit `61ddc587`)
1. ✅ **Wallet SDK 3.0.3 fix** — `1e12`→`1e6` v 6 souborech, build, testy (35/35 pass)
2. ✅ **Mobile App 3.0.3 fix** — `1e12`→`1e6` v 6 souborech + fee constants
3. ✅ **Desktop Agent 3.0.3 fix** — `1e12`→`1e6` v 6 souborech + fee constants
4. ✅ **Fee constants aligned** — MIN_TX_FEE=1 across all SDKs

#### Fáze 2 — TX History RPC ✅ DONE (commit `77776e48`, Edge deployed)
5. ✅ **getTransactionHistory UTXO + coinbase fix** — scan `block.utxo_transactions` + coinbase rewards, `tx_model` field, 3 tests, 47/47 RPC suite, Edge deployed (69,694 txs verified)
6. 🔵 **Address index** — `HashMap<String, Vec<(height, tx_hash)>>` v ChainState pro O(1) lookup (optional, linear scan funguje)

#### Fáze 3 — L4 Oasis Backend Completion (větší)
5. **WebSocket events** — wire event broadcasting logic
6. **Data files** — doplnit data/avatars.json, data/golden_egg.json
7. **L1 blockchain listener** — real-time block-mined XP hooks
8. **Wallet signature auth** — API endpoint auth
9. **E2E test** — UE5 → Rust → L1 flow

#### Fáze 4 — Mobile App Polish (větší)
10. **QR code** scan/generate
11. **Biometric auth** (FaceID/TouchID)
12. **Deep linking** (Universal Links / App Links)
13. **Build + test** na device

#### Ostatní (paralelně)
14. **DeFi Liquidity Seeding** — UniV3Pool inicializace (≥0.80 ETH), Staking/Farm reward activation
15. **E2E Bridge test (burn direction)** — Base burn → L1 unlock (P0 blocker)
16. **Validator funding** — 5 mainnet validator adres na ≥0.01 ETH
17. **L3 verify** — WARP registry, swap agregátor E2E

---

## Přílohy

- [StatusV3.md](StatusV3.md) — Aktuální technický status
- [ROADMAP.md](ROADMAP.md) — Dlouhodobá cestovní mapa
- [AGENTS.md](AGENTS.md) — Devin/WARP/Copilot instrukce
- [docs/3.0.1Genesis/](docs/3.0.1Genesis/) — Archiv verzí 3.0.0–3.0.1
