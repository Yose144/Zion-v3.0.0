# LI.FI L2 — Cross-Chain DEX + Bridge Integration Plan

> **Status:** ✅ Fáze 1 hotová (LI.FI widget integrovaný) · Fáze 2-3 plánované
> **Poslední update:** 2026-06-30 (Session 10)
> **Owner:** Zion Protocol Team

---

## 1. Cíl

Integrovat **univerzální cross-chain swap + bridge** do Zion web app pomocí LI.FI aggregatoru. Nahradit hardcoded Uniswap V3 swap widget (1 DEX, 3 pooly) za řešení které agreguje 30+ DEX a 20+ bridge protokolů na 25+ chainech.

**Princip:** Jedna integrace, každý chain, každý token, každá likviditní zdroj.

---

## 2. Aktuální stav (po Session 10)

### ✅ Hotovo

| Komponenta | Status | Popis |
|------------|--------|-------|
| `LiFiWidget.tsx` | ✅ Produkční | iframe widget z `widget.li.fi`, wZION jako výchozí token |
| `/defi` page integrace | ✅ Produkční | Widget v swap tabu nad původním SwapWidget |
| Chain podpora | ✅ 7 chainů | Base, Ethereum, Arbitrum, BSC, Polygon, Optimism, Avalanche |
| DEX agregace na Base | ✅ Automatická | Uniswap V3/V4, Aerodrome, PancakeSwap, SushiSwap + 25 dalších |
| Cross-chain bridge | ✅ Automatická | Stargate, Across, Hop, Synapse, deBridge, Squid, Portal/Wormhole + 13 dalších |
| Build | ✅ Pass | `next build --webpack` prošel |
| Git | ✅ Pushnuto | Commit `6eb314355` na main |

### ⚠️ Omezení současné implementace

- Widget je **hosted iframe** — závislost na `widget.li.fi` dostupnosti
- wZION je přednastavený jen na **Base** (chain 8453) — na jiných chainech wZION neexistuje
- Wallet connection je **oddělená** od našeho WalletContext (widget má vlastní)
- Žádná **fee monetizace** (fee=0) — LI.FI podporuje custom fee pro integrátory

---

## 3. Architektura

```
┌─ Zion Web App (Next.js) ─────────────────────────────────┐
│                                                           │
│  /defi page → Swap tab                                    │
│  ├── LiFiWidget.tsx (iframe → widget.li.fi)              │
│  │   ├── fromToken: wZION (Base)                         │
│  │   ├── toToken: ETH (Base)                             │
│  │   ├── chains: Base, Eth, Arb, BSC, Polygon, OP, Avax  │
│  │   ├── theme: dark, slippage: 1%, fee: 0%              │
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

### Fáze 1: LI.FI Widget (✅ Hotovo — Session 10)

- [x] Install `@lifi/sdk`, `@lifi/widget`, `viem`
- [x] Vytvořit `LiFiWidget.tsx` (iframe, wZION default)
- [x] Integrovat do `/defi` page swap tab
- [x] Build test pass
- [x] Commit + push

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

**Cíl:** Dokončit WARP `execute_mint()` pro non-EVM chainy (Solana, Bitcoin, Tron, Stellar, Cardano, Cosmos).

**WARP status:**
- 80% hotový, běží na Edge (port 9333)
- 7 adapterů implementováno (EVM, Solana, BTC, Tron, Stellar, Cardano, Cosmos)
- 252 testů pass
- **Blocker:** `execute_mint()` vrací `NotImplemented("D-04")`

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
