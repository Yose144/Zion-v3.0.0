# 🚀 Mainnet Launch plán

> *Archive note: tento dokument zachovava tehdejsi launch plan snapshot. Neni to aktualni verejny launch commit.*

> *Historicke cilove okno: konec 2026. Od testnetu k launch gate.*

---

## 1. Timeline

```
        Q1 2026          Q2 2026           Q3 2026          Q4 2026
        ┌───────────┐    ┌───────────┐    ┌───────────┐    ┌───────────┐
  Únor  │ CHv3       │    │ Audit     │    │ Exchange  │    │ MAINNET   │
        │ unifikace  │    │ + Bug     │    │ listing   │    │ LAUNCH    │
  Březen│ Dual-mining│    │ bounty    │    │ prep      │    │ 31.12.    │
        │ VRSC E2E   │    │           │    │           │    │ 2026      │
        └───────────┘    └───────────┘    └───────────┘    └───────────┘
```

---

## 2. Fáze

### Fáze 1 — Stabilizace (Únor–Březen 2026) ✅ / 🔄

| Úkol | Status |
|------|--------|
| CHv3 unifikace (single PoW) | ✅ Hotovo |
| Memory-hard scratchpad (fork h=50k) | ✅ Implementováno |
| Paralelní dual-mining (ZION 3T + VRSC 1T) | ✅ PerMiner groups v pool |
| VerusHash 2.2 ARM64 nativní | ✅ E2E (2/2 accepted shares) |
| GPU mining (Metal/OpenCL) | 🔄 CPU↔GPU parity v testování |
| Pool share validator sjednocen | ✅ Hotovo |
| docs/v2.9.6 dokumentace | 🔄 V průběhu |

### Fáze 2 — Audit & Testnet stress (Duben–Červen 2026)

| Úkol | Status |
|------|--------|
| Security audit (3rd party nebo self-audit) | ⏳ |
| Bug bounty program | ⏳ |
| Testnet stress test (100+ minerů) | ⏳ |
| Difficulty reorg attack simulace | ⏳ |
| 51% attack cost analýza | ⏳ |
| P2P síť rozšíření (5+ seed nodů) | ⏳ |
| Block explorer (veřejný) | ⏳ |
| Wallet GUI (desktop) | ⏳ |

### Fáze 3 — Exchange & Ecosystem (Červenec–Září 2026)

| Úkol | Status |
|------|--------|
| Tier 5 exchange listing prep | ⏳ |
| CoinGecko / CoinMarketCap listing | ⏳ |
| Whitepaper finalizace (EN) | ⏳ |
| Mobile wallet (React Native) | ⏳ |
| Mining pool třetích stran | ⏳ |
| Community growth (Discord, Telegram) | ⏳ |

### Fáze 4 — Historical Mainnet Launch Window (Říjen–Prosinec 2026)

| Úkol | Status |
|------|--------|
| Genesis block finalizace | ⏳ |
| Premine wallet distribuce | ⏳ |
| Seed node deployment (3+ kontinenty) | ⏳ |
| Mainnet config finalizace | ⏳ |
| Emission schedule DAO vote | ⏳ |
| **🚀 Historical target window: 31. 12. 2026** | ⏳ |

---

## 3. Infrastruktura

### Aktuální servery (testnet)

| Server | IP | Lokace | Služby |
|--------|------|--------|--------|
| Zion2 | seed.zionterranova.com | cloud VPS | Primary host, pool, web, API |
| seed1.zionterranova.com | internal | cloud VPS | Internal seed container |

### Mainnet cíl

> Poznámka 2026-03-12: Tabulka níže je plánovaná cílová topologie, ne aktuální live stav testnetu.

| Server | Lokace | Role |
|--------|--------|------|
| seed1.zionterranova.com | EU (Helsinki) | Seed + pool |
| seed2.zionterranova.com | EU (Německo) | Peer + backup |
| seed3.zionterranova.com | US East | Seed (low-latency Americas) |
| seed4.zionterranova.com | Asia (SG) | Seed (APAC coverage) |
| explorer.zionterranova.com | EU | Block explorer |

---

## 4. Pre-launch checklist

```
Pre-launch (30 dní před):
  [ ] Freeze kódu — žádné konsenzus změny
  [ ] Finální security audit report
  [ ] Genesis block vygenerován (offline)
  [ ] Premine wallets distribuovány
  [ ] Seed nody nasazeny a testovány
  [ ] Mining pool operátorům zaslány instrukce
  [ ] Exchange listing dohody podepsány
  [ ] Whitepaper publikován
  [ ] Website aktualizován

Launch day:
  [ ] Genesis block broadcastován
  [ ] Seed nody synchronizovány
  [ ] Pool přepnut na mainnet config
  [ ] Miner binárky (macOS/Linux/Windows) publikovány
  [ ] Community announcement (Discord, Twitter, Reddit)
  [ ] Block explorer live

Post-launch (7 dní):
  [ ] Monitorování difficulty adjustment
  [ ] Kontrola orphan rate
  [ ] Ověření block time stability (target 60s)
  [ ] Prvních 100 bloků audit
  [ ] Exchange deposit/withdrawal test
```

---

## 5. Rizika

| Riziko | Pravděpodobnost | Mitigace |
|--------|----------------|----------|
| Nízký hashrate při launchi | Vysoká | Dual-mining VRSC pro revenue, community outreach |
| 51% attack | Střední | LWMA rychlá difficulty adjustace, monitoring |
| Exchange odmítne listing | Střední | Začít s DEX (Uniswap wrapped), pak CEX |
| Bug v konsenzus kódu | Nízká | Audit, testnet stress, bug bounty |
| Regulatorní problémy | Nízká | Právní review, decentralizace od dne 1 |
