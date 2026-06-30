# LI.FI L2 — Cross-Chain DEX + Bridge Integration Plan

> **Status:** ✅ Fáze 1 hotová (WidgetLight migrace) · Fáze 2 plánovaná (Arbitrum P0) · Fáze 3 WARP D-04
> **Poslední update:** 2026-06-30 (Session 11 — WidgetLight + slippage fix + fee monetizace)
> **Owner:** Zion Protocol Team

---

## 1. Cíl

Integrovat **univerzální cross-chain swap + bridge** do Zion web app pomocí LI.FI aggregatoru. Nahradit hardcoded Uniswap V3 swap widget (1 DEX, 3 pooly) za řešení které agreguje 30+ DEX a 20+ bridge protokolů na 25+ chainech.

**Princip:** Jedna integrace, každý chain, každý token, každá likviditní zdroj.

---

## 2. Aktuální stav (po Session 11)

### ✅ Hotovo

| Komponenta | Status | Popis |
|------------|--------|-------|
| `LiFiWidget.tsx` | ✅ WidgetLight | `@lifi/widget-light` postMessage bridge (místo plain iframe) |
| Slippage fix | ✅ Opraveno | `0.01` (1% jako decimal 0-1) — původně `100` (= 10000%!) |
| Fee monetizace | ✅ Aktivní | `feeConfig.fee: 0.005` (0.5% integrator fee na každý swap) |
| Route priority | ✅ RECOMMENDED | `routePriority: 'RECOMMENDED'` + `useRelayerRoutes: true` (gasless) |
| Chain filtering | ✅ 7 EVM chainů | Base, Ethereum, Arbitrum, BSC, Polygon, Optimism, Avalanche |
| Custom RPC | ✅ Per-chain | 7 RPC URLs (mainnet.base.org, llamarpc, arbitrum.io, binance, etc.) |
| Appearance | ✅ Dark + theme | `appearance: 'dark'` + custom `theme.container.borderRadius` |
| WalletContext | ✅ toAddress pre-fill | Destination address z našeho WalletContext when connected |
| DEX agregace na Base | ✅ Automatická | Uniswap V3/V4, Aerodrome, PancakeSwap, SushiSwap + 25 dalších |
| Cross-chain bridge | ✅ Automatická | Stargate, Across, Hop, Synapse, deBridge, Squid, Portal/Wormhole + 13 dalších |
| Build | ✅ Pass | `next build --webpack` prošel |
| Deploy | ✅ Live | Commity `6730e2ba` + `cecb9cfa` + `b54752d3` — zionterranova.com |
| Ankr RPC (L2 bridge) | ✅ Implementováno | `ankr.rs` — multi-chain HTTP JSON-RPC, fallback v evm_watcher |

### ⚠️ Omezení současné implementace

- Widget je **hosted iframe** — závislost na `widget.li.fi` dostupnosti (WidgetLight to ale řeší lépe než plain iframe)
- wZION je přednastavený jen na **Base** (chain 8453) — na jiných chainech wZION neexistuje (blokuje Fázi 2)
- Wallet connection uvnitř widgetu je **oddělená** od našeho WalletContext (pouze toAddress pre-fill, ne sign)
- **ANKR_API_KEY** není nastavena — free tier rate-limited (premium potřeba pro mainnet)
- **Arbitrum One** v bridge-mainnet.toml = `enabled = false`, placeholder adresy

---

## 3. Architektura

```
┌─ Zion Web App (Next.js) ─────────────────────────────────┐
│                                                           │
│  /defi page → Swap tab                                    │
│  ├── LiFiWidget.tsx (WidgetLight → widget.li.fi)         │
│  │   ├── fromToken: wZION (Base)                         │
│  │   ├── toToken: ETH (Base)                             │
│  │   ├── chains: Base, Eth, Arb, BSC, Polygon, OP, Avax  │
│  │   ├── slippage: 0.01 (1%), fee: 0.005 (0.5%)         │
│  │   ├── routePriority: RECOMMENDED, relayer: true       │
│  │   ├── custom RPC per chain (7 URLs)                   │
│  │   └── Built-in wallet: MetaMask, WalletConnect        │
│  │                                                       │
│  └── SwapWidget.tsx (původní Uniswap V3 — zachován)      │
│      └── Direct pool swap wZION/ETH 0.3%                 │
│                                                           │
└───────────────────────────────────────────────────────────┘
          │
          ▼
┌─ LI.FI Aggregator (widget.li.fi) ────────────────────────┐
│                                                           │
│  Routing engine → 30+ DEX + 20+ bridges                  │
│                                                           │
│  DEX na Base:                                            │
│  ├── Uniswap V3/V4                                       │
│  ├── Aerodrome (Slipstream + V1)                         │
│  ├── PancakeSwap V3                                      │
│  ├── SushiSwap V3                                        │
│  ├── BaseSwap V2/V3                                      │
│  ├── Alien Base V3                                       │
│  └── +25 dalších                                         │
│                                                           │
│  Bridge protokoly:                                       │
│  ├── Stargate, Across, Hop, Synapse                      │
│  ├── deBridge, Squid, Portal (Wormhole)                  │
│  ├── Celer cBridge, Connext, Socket                      │
│  └── +13 dalších                                         │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

---

## 4. Fáze rozvoje

### Fáze 1: LI.FI Widget (✅ Hotovo — Session 10 + 11)

- [x] Install `@lifi/sdk`, `@lifi/widget`, `viem`
- [x] Vytvořit `LiFiWidget.tsx` (iframe, wZION default) — Session 10
- [x] Integrovat do `/defi` page swap tab
- [x] Build test pass
- [x] Commit + push (`6eb31435`)
- [x] **Session 11:** Migrace na `@lifi/widget-light` WidgetLight (postMessage)
- [x] **Session 11:** Slippage fix `100` → `0.01` (kritický bug — 10000% → 1%)
- [x] **Session 11:** Fee monetizace `feeConfig.fee: 0.005` (0.5% integrator fee)
- [x] **Session 11:** Route priority + gasless relayer routes
- [x] **Session 11:** Chain filtering (7 EVM chainů)
- [x] **Session 11:** Custom RPC per chain (7 URLs)
- [x] **Session 11:** Dark appearance + custom theme
- [x] **Session 11:** WalletContext toAddress pre-fill
- [x] **Session 11:** Build + deploy na zionterranova.com (`6730e2ba` + `cecb9cfa` + `b54752d3`)

### Fáze 1.5: Ankr Premium RPC (⚠️ Částečně — chybí API key)

**Co je hotovo:**
- [x] `ankr.rs` — AnkrClient s eth_blockNumber, eth_getLogs, eth_sendRawTransaction, eth_call, eth_getBalance
- [x] Auto-chunking pro eth_getLogs (MAX_LOG_BLOCK_RANGE: 3,000)
- [x] Fallback mechanism v evm_watcher (direct RPC → Ankr)
- [x] Config file + `ANKR_API_KEY` env var support
- [x] Health check

**Co chybí:**
- [ ] **`ANKR_API_KEY` nastavit** na Edge serveru (premium tier — vyšší rate limits)
- [ ] Ankr Advanced API (multichain token balances, NFT, staking) — zatím jen basic JSON-RPC
- [ ] Ankr WebSocket support (zatím jen HTTP polling)

**Postup:**
1. Registrace na app.ankr.com → získání API key
2. `ANKR_API_KEY=xxx` do `docker-compose.v3-l2.yml` env sekce
3. Restart `zion-edge-bridge.service`
4. Verify: `curl https://rpc.ankr.com/base/<KEY> -X POST -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'`

### Fáze 2: wZION Multi-Chain Deploy (Plánované)

**Cíl:** wZION ERC-20 deploy na dalších EVM chainech aby LI.FI widget mohl swappovat wZION cross-chain.

| Chain | Chain ID | Priorita | Úsilí | Poznámka |
|-------|----------|----------|-------|----------|
| **Arbitrum One** | 42161 | P0 | 2-3 dny | Největší L2, nízké gas, config už existuje |
| **Ethereum Mainnet** | 1 | P1 | 2-3 dny | Pro DeFi integrace, vyšší gas |
| **BSC** | 56 | P1 | 2-3 dny | Velký user base, nízké gas |
| **Polygon** | 137 | P2 | 2-3 dny | Multi-chain exposure |
| **Optimism** | 10 | P2 | 2-3 dny | OP Stack, Base sibling |
| **Avalanche** | 43114 | P3 | 2-3 dny | Menší share |

**Deploy kroky pro každý chain:**
1. Deploy `wZION.sol` na cílový chain
2. Deploy `ZIONBridge.sol` (5/5 multisig)
3. Grant `BRIDGE_ROLE` na wZION pro ZIONBridge
4. Konfigurovat 5 validator adres
5. Přidat chain do `bridge-mainnet.toml` (`enabled = true`)
6. Aktualizovat `bridge-api.ts` s novými adresami
7. Aktualizovat `LiFiWidget.tsx` — wZION adresy per chain
8. Fund validatorů s native gas tokenem
9. E2E test (lock→mint, burn→unlock)

**Predpoklady:**
- 5 validator adres (už existují z Base deploy)
- Bridge relay běží 24/7 na Edge serveru
- Ankr RPC (multi-chain, už konfigurované)

### Fáze 3: WARP D-04 — Non-EVM Chainy (Plánované)

**Cíl:** Dokončit WARP `execute_mint()` pro non-EVM chainy (Cardano, Cosmos) a implementovat Lightning adapter.

**WARP status (přesný audit Session 11):**

| Adapter | watch_events | execute_mint | Status |
|---------|-------------|--------------|--------|
| EVM (9 chainů) | ✅ | ✅ Live signing | ✅ Plně funkční |
| Bitcoin | ✅ HTLC + OP_RETURN | ✅ P2WPKH BIP143 | ✅ Plně funkční (placeholder HTLC addr) |
| Solana | ✅ | ✅ SPL mintTo | ✅ Plně funkční |
| Tron | ✅ | ✅ TRC-20 mint | ✅ Plně funkční |
| Stellar | ✅ | ✅ Payment signing | ✅ Plně funkční |
| Cosmos | ✅ | ❌ D-04 stub | ⚠️ Částečně |
| Cardano | ✅ | ❌ D-04 stub | ⚠️ Částečně |
| Lightning | ❌ | ⚠️ BOLT11 placeholder | ⚠️ Stub |
| Aptos | ✅ health | ❌ AdapterNotImplemented | ❌ Stub |
| NEAR | ✅ health | ❌ AdapterNotImplemented | ❌ Stub |
| Sui | ✅ health | ❌ AdapterNotImplemented | ❌ Stub |
| TON | ✅ health | ❌ AdapterNotImplemented | ❌ Stub |

- WARP běží na Edge (port 8453), 252+ testů pass
- **6 adapterů plně funkčních** (EVM, BTC, SOL, TRX, XLM + Cosmos/Cardano watch)
- **Blocker:** `execute_mint()` pro Cosmos/Cardano = "Signing service (D-04) pending"
- **Lightning:** BOLT11 stub, žádný LND/CLN node — viz [WARP_LIGHTNING_PLAN.md](./docs/WARP_LIGHTNING_PLAN.md)

**Potřebná práce:**
1. Implement `execute_mint()` pro každý adapter (mint signing)
2. L1 RPC endpointy: `getBridgeLocks`, `submitBridgeUnlock`, `getBridgeVaultBalance`
3. Validator key management (HSM nebo multi-sig aggregation)
4. Replay protection (nonce / seen-tx database)
5. Deploy wZIO kontrakty na non-EVM chainech (SPL, TRC-20, etc.)
6. Nahradit placeholder adresy reálnými
7. Security audit
8. UI integrace (WARP transfer form)

**Odhad:** 8-12 týdnů

### Fáze 4: Pokročilé funkce (Future)

- [ ] **Fee monetizace** — LI.FI podporuje custom fee (basis points) pro integrátory
- [ ] **LI.FI SDK** — přejít z iframe na nativní SDK integraci (lepší UX, custom UI)
- [ ] **Token list** — standardizovaný `tokens.json` (Uniswap token list schema)
- [ ] **Aerodrome pool deploy** — wZION likvidita na Aerodrome (62% Base TVL)
- [ ] **1inch Fusion+** — atomic cross-chain swap SDK jako alternativa
- [ ] **WalletContext integrace** — propojit LI.FI widget s naším WalletContext (postMessage)
- [ ] **Route filtering** — allow/deny specifické bridgey nebo DEXy
- [ ] **Custom theme** — match Zion design system (rainbow gradient, dark mode)

---

## 5. Kontrakty a adresy

### wZION na Base (✅ Deployed)

```
wZION:          0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6
ZIONBridge:     0x72c8f0Dc60E27aB7A83fe3B416fab4F0600a6467
BridgeValidator:0x9C138dC6ebA8A883AB3802F6Dcb79C772a835627
```

### wZION na dalších chainech (⚠️ Nedeployed)

| Chain | wZION | ZIONBridge | Status |
|-------|-------|------------|--------|
| Arbitrum | TBD | TBD | Nedeployed |
| Ethereum | TBD | TBD | Nedeployed |
| BSC | TBD | TBD | Nedeployed |
| Polygon | TBD | TBD | Nedeployed |
| Optimism | TBD | TBD | Nedeployed |

### LI.FI konfigurace

```
Widget URL:     https://widget.li.fi
Integrator:     ZionProtocol
From chain:     8453 (Base)
From token:     0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6 (wZION)
To chain:       8453 (Base)
To token:       0x0000000000000000000000000000000000000000 (native ETH)
Theme:          dark
Fee:            0 (0% — no markup)
Slippage:       100 (1%)
Chains:         8453, 1, 42161, 56, 137, 10, 43114
```

---

## 6. Soubory

| Soubor | Účel |
|--------|------|
| `APP&WEB/website-v2.9/src/components/LiFiWidget.tsx` | LI.FI iframe widget komponenta |
| `APP&WEB/website-v2.9/src/app/defi/page.tsx` | DeFi page — swap tab s LiFiWidget + SwapWidget |
| `APP&WEB/website-v2.9/src/components/SwapWidget.tsx` | Původní Uniswap V3 swap (zachován) |
| `APP&WEB/website-v2.9/src/lib/defi-contracts.ts` | Kontrakty, tokeny, ABIs |
| `APP&WEB/website-v2.9/src/lib/bridge-api.ts` | Bridge kontrakty per chain |
| `APP&WEB/website-v2.9/package.json` | Dependencies (@lifi/sdk, @lifi/widget, viem) |
| `V3/L2/bridge/config/bridge-mainnet.toml` | Bridge relay multi-chain config |
| `V3/L2/contracts/hardhat/sol/wZION.sol` | wZION ERC-20 contract (deploy na nové chainy) |
| `V3/L2/contracts/hardhat/sol/ZIONBridge.sol` | Bridge contract (deploy na nové chainy) |
| `V3/L3/warp/` | WARP universal bridge (non-EVM, 80% hotový) |

---

## 7. WARP vs LI.FI — Srovnání

| Aspekt | WARP (nativní) | LI.FI (aggregator) |
|--------|----------------|---------------------|
| **Chainy** | 10+ family (EVM + Solana, BTC, Tron...) | 25+ EVM chainů |
| **Architektura** | Hub-and-spoke přes ZION L1 | Agregace externích bridge protokolů |
| **Kontrola** | Plná (5/5 validator consensus) | Závislost na LI.FI infrastruktuře |
| **Non-EVM** | ✅ (Solana, BTC, Tron, Stellar, Cardano, Cosmos) | ❌ (jen EVM) |
| **Status** | 80% hotový, `execute_mint()` stub | ✅ Produkčně ready |
| **DEX agregace** | ❌ (jen bridge) | ✅ (30+ DEX na Base) |
| **Best price routing** | ❌ | ✅ (automatické) |
| **Úsilí do produkce** | 8-12 týdnů | ✅ Hotovo (dny) |
| **Monetizace** | Vlastní fee engine (0.15%) | LI.FI fee (custom basis points) |

**Strategie:** LI.FI pro EVM chainy (rychlé, hotové). WARP dokončit pro non-EVM chainy kde LI.FI nefunguje.

---

## 8. Roadmap

```
2026-06-30  Fáze 1: LI.FI widget           ✅ Hotovo
2026-07-XX  Fáze 2: wZION deploy Arbitrum   📋 Plánováno
2026-07-XX  Fáze 2: wZION deploy Ethereum   📋 Plánováno
2026-07-XX  Fáze 2: wZION deploy BSC        📋 Plánováno
2026-08-XX  Fáze 3: WARP D-04 (Solana)      📋 Plánováno
2026-09-XX  Fáze 3: WARP D-04 (Bitcoin)     📋 Plánováno
2026-XX-XX  Fáze 4: LI.FI SDK + fee         🔮 Future
2026-XX-XX  Fáze 4: Aerodrome pool deploy   🔮 Future
```

---

## 9. Rizika a mitigace

| Riziko | Pravděpodobnost | Mitigace |
|--------|-----------------|----------|
| LI.FI výpadek | Nízká | SwapWidget (Uniswap V3) zůstává jako fallback |
| LI.FI změní API | Střední | iframe izoluje změny, URL params stabilní |
| wZION nedostupná na jiném chainu | Jistá (Fáze 2) | Deploy wZION před aktivací chainu v widgetu |
| Bridge exploit | Nízká | LI.FI agreguje 20+ bridge, diversifikace rizika |
| WARP D-04 zdržení | Vysoká | LI.FI pokrývá EVM, WARP jen pro non-EVM |
| Validator key kompromitace | Nízká | 5/5 multisig, HSM doporučeno |

---

## 10. Poznámky

- **LI.FI widget** je zdarma pro standardní použití (žádné API key potřeba pro iframe)
- **LI.FI SDK** (non-iframe) vyžaduje registraci a integrator ID
- **Fee monetizace:** LI.FI podporuje `fee` parametr (basis points) — může přidat revenue stream
- **WARP** je unikátní v tom, že ZION L1 je settlement hub — žádný jiný bridge má tuto architekturu
- **Aerodrome** je dominantní DEX na Base (62% TVL) — deploy wZION poolu by výrazně zlepšil likviditu
- **EIP-7702 delegace** na deployer address je stále aktivní — viz Session 8 audit
