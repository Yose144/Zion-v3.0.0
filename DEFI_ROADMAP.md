# ZION DeFi Roadmap

> **Datum:** 12. května 2026
> **Stav:** Aktivní vývoj
> **Aktuální web:** website-v2.9 (Next.js 16 + React 19)
> **Reference dokumentace:** [`docs/DEFI_FULL_ROADMAP.md`](docs/DEFI_FULL_ROADMAP.md)

## 📊 Aktuální Stav (Květen 2026)

### Co už existuje ve web2.9:
- **✅ DeFi Hub UI** (`/defi`) - swap, bridge, portfolio tabs
- **✅ SwapWidget** - Uniswap V3 integrace (ETH↔wZION)
- **✅ BridgeBurnWidget** - Base→L1 burn interface
- **✅ DefiBalances** - Portfolio overview
- **✅ Wallet integration** - MetaMask, Base network switch
- **✅ Contract addresses table** - Basescan links

### Co chybí (podle docs/DEFI_FULL_ROADMAP.md):
- **✅ RPC rozšíření (6 nových metod)** - getTransactionHistory, getAddressInfo, estimateFee, getBlockRange, getNetworkStats, getTokenInfo
- **✅ WebSocket subscriptions** (new blocks, pending TX) - IMPLEMENTOVáno 2026-05-13
- **✅ Wallet SDK** (TypeScript/JS library) - `APP&WEB/zion-wallet-sdk/`, integrováno do webu, desktop agenta a mobilní appky
- **❌ Swap Aggregator backend** (orchestrace bridge+swap)
- **❌ Price feed / oracle** (Uni V3 TWAP)
- **❌ Bridge Tracker** (live view lock→bridge→mint)
- **❌ Mempool Viewer** (pending TX)
- **❌ Network stats dashboard** (hashrate, difficulty grafy)
- **❌ Supply dashboard** (circulating, locked, staked, burned)
- **❌ Staking dashboard** (APR, rewards history)
- **❌ DAO proposals UI** (governance voting)
- **❌ Explorer upgrade** (search, TX history, UTXO view)

## 🎯 Priority Matrix

### 🔥 Critical P0 (Launch blockers)
Tyto úkoly musí být hotové před veřejným oznámením:

| Úkol | Oblast | Odhad | Status | Poznámky |
|------|--------|-------|--------|-----------|
| Bridge validator 3/5 multisig | Bridge | 3 dny | ⬜ | Bezpečnostní upgrade |
| Burn→Unlock E2E test | Bridge | 2 dny | ⬜ | Reverse bridge směr |
| WebSocket subscriptions (WS) | Backend | 4 dny | ✅ DOKONČENO | new blocks, pending TX streaming (2026-05-13) |
| Bridge Tracker UI | Explorer | 3 dny | ⬜ | Live status lock→bridge→mint |

### 🟡 High Priority P1 (Důležité pro UX)
| Úkol | Oblast | Odhad | Status |
|------|--------|-------|--------|
| RPC rozšíření (6 metod) | Backend | ✅ DOKONČENO | getTransactionHistory, getAddressInfo, estimateFee, getBlockRange, getNetworkStats, getTokenInfo |
| Wallet SDK (TS/JS) | Infrastructure | ✅ DOKONČENO | 4 dny | V3-compatible address derivation + checksum, keypair, crypto, tx builder, RPC client, storage adapters; integrováno do webu, desktop agenta a mobilní appky |
| Price feed oracle | Backend | 3 dny | ⬜ |
| Supply dashboard | Explorer | 2 dny | ⬜ |
| Mempool viewer | Explorer | 2 dny | ⬜ |
| Network stats grafy | Explorer | 3 dny | ⬜ |

### 🟢 Medium Priority P2 (Nice to have)
| Úkol | Oblast | Odhad | Status |
|------|--------|-------|--------|
| Staking dashboard | DeFi UI | 2 dny | ⬜ |
| DAO proposals UI | DeFi UI | 2 dny | ⬜ |
| Search upgrade | Explorer | 1 den | ⬜ |
| TradingView charts | Explorer | 2 dny | ⬜ |
| Push notifications | Mobile | 2 dny | ⬜ |

## 🗺️ Implementační Plán

### Fáze 1: Bridge Hardening (1 týden)
- [ ] Burn→Unlock E2E test (Base→L1)
- [ ] Validator threshold upgrade (1/2 → 3/5)
- [ ] Bridge monitoring dashboard (Grafana integration)

### Fáze 1: RPC + Wallet SDK (2 týdny)
- [x] Implement getTransactionHistory RPC
- [x] Implement estimateFee RPC
- [x] Implement getAddressInfo RPC
- [x] Implement getBlockRange RPC
- [x] Implement getNetworkStats RPC
- [x] Implement getTokenInfo RPC
- [x] WebSocket subscriptions (new blocks, pending TX) - IMPLEMENTOVáno 2026-05-13
- [x] TypeScript Wallet SDK package — `APP&WEB/zion-wallet-sdk/` (address, keypair, crypto, tx, RPC, storage, wallet-manager)
- [x] Multi-wallet management — integrováno do website-v2.9 (`ZionWalletContext.tsx` + `/wallet` stránka)

### Fáze 3: Swap Aggregator (2 týdny)
- [ ] Swap Aggregator backend service
- [ ] Price feed oracle (Uni V3 TWAP)
- [ ] Best-route calculation
- [ ] Status tracking API

### Fáze 4: Explorer Upgrade (2 týdny)
- [ ] Bridge Tracker live UI
- [ ] Mempool viewer
- [ ] Network stats dashboard
- [ ] Supply dashboard
- [ ] Search upgrade (jeden search bar)

### Fáze 5: Desktop/Mobile DeFi UI (2 týdny)
- [ ] Real bridge integration (mobile)
- [ ] Swap UI v desktop agentu
- [ ] Staking UI v desktop/mobilu
- [ ] Portfolio dashboard

### Fáze 6: Website + Marketing (1 týden)
- [ ] `/defi/staking` stránka
- [ ] `/defi/dao` stránka
- [ ] `/defi/farming` stránka
- [ ] Technical whitepaper
- [ ] BitcoinTalk ANN post
- [ ] Social media assets

## 🏗️ Architektura

```
┌─────────────────────────────────────────────────────────────┐
│                      Uživatelské rozhraní                   │
│  web2.9 (Next.js 16) │ Desktop (Electron) │ Mobile (RN)  │
└───────────────────────────┬───────────────────────────────┘
                            │
        ┌───────────────────┴───────────────────┐
        │          Backend Services              │
        │  ┌──────────┐  ┌──────────┐  ┌───────┐ │
        │  │ ZION RPC │  │ Bridge   │  │ Swap  │ │
        │  │          │  │ Relay    │  │ Agg   │ │
        │  └──────────┘  └──────────┘  └───────┘ │
        └───────────────────┬───────────────────────┘
                            │
        ┌───────────────────┴───────────────────────┐
        │              Blockchains                   │
        │  ZION L1 (Ekam Deeksha)  ↔  Base (wZION)   │
        └───────────────────────────────────────────┘
```

## 📝 Git Workflow

Pro systematický vývoj:

1. Vytvořit větev `defi-phase-N` pro každou fázi
2. Commitovat s descriptivními messages (např. "feat(bridge): add burn-unlock E2E test")
3. Používát Conventional Commits
4. Pull request přes GitHub
5. Code review před merge

## 🚀 Milestones

| Milestone | Cílové datum | Klíčové deliverables |
|-----------|-------------|---------------------|
| Bridge Hardening | konec května 2026 | Burn→Unlock, 3/5 multisig |
| RPC + Wallet SDK | polovina června 2026 | 9 RPC metod, TS SDK |
| Swap Aggregator | konec června 2026 | One-click swap backend |
| Explorer Upgrade | polovina července 2026 | Bridge tracker, mempool, stats |
| Full DeFi Launch | konec června 2026 | Vše funkcionalitě ready |

## 📋 Notes

- web2.9 už má solidní základ pro DeFi UI
- Backend RPC a bridge relayer potřebují rozšíření
- Wallet SDK umožní konzistentní integraci napříč platformy
- Swap Aggregator je klíčový pro "one-click" experience
- Bridge Tracker je nejdůležitější pro uživatelskou důvěru

---

**Reference:**
- Detailní dokumentace: [`docs/DEFI_FULL_ROADMAP.md`](docs/DEFI_FULL_ROADMAP.md)
- Aktuální web: [`APP&WEB/website-v2.9/`](APP&WEB/website-v2.9/)
- Hlavní roadmap: [`ROADMAP.md`](ROADMAP.md)
- V3 status: [`StatusV3.md`](StatusV3.md)
