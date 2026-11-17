# ZION Native Swap — Design Proposal

**Dokument:** `docs/NATIVE_SWAP_DESIGN.md`  
**Verze:** 0.1 (návrh)  
**Datum:** 2026-06-29  
**Autor:** ZION Core Team (session 5)  
**Status:** 📐 DESIGN — neschváleno, neprodukováno

---

## 1. Záměr

Cíl: umožnit uživatelům ZION provést **přímou výměnu nativních coinů**
(BTC, ETH, SOL, ...) bez nutnosti vlastnit nebo procházet wZION.

Příklady use-case:

```
BTC  →  SOL    (bez wZION mezivrsky)
ETH  →  BTC
SOL  →  USDT
BTC  →  ZION   (L1 nativní výběr)
```

Tato funkcionalita je rozšíření stávajícího WARP L3 routeru,
**nikoli** náhrada za wZION/L2 DeFi stack.

---

## 2. Terminologie

| Termín | Popis |
|--------|-------|
| **Native Swap** | Výměna dvou nativních coinů (ne wrapped ERC-20) |
| **WARP Router** | Stávající L3 cross-chain engine (`V3/L3/warp/`) |
| **Atomic Swap** | Výměna bez důvěry pomocí HTLC (Hash Time-Locked Contracts) |
| **Aggregated Swap** | Výměna přes agregátor likvidity (1inch, KyberSwap, Jupiter) |
| **ZION Fee Token** | ZION se platí poplatek i za Native Swap; ZION není nutně v trase |

---

## 3. Dvě architektonické varianty

### Varianta A — HTLC Atomic Swap (trustless, L3 extension)

Rozšíření stávajícího `ZIONAtomicSwap.sol` a WARP routeru o cross-chain
HTLC páry. ZION funguje pouze jako **fee token**, ne jako intermediate asset.

```
Uživatel A (má BTC)                   Uživatel B (má SOL)
      │                                       │
      │  1. Lock BTC do HTLC(hashlock H)     │
      │  ────────────────────────────────►   │
      │                                       │  2. Lock SOL do HTLC(hashlock H)
      │  3. Reveal preimage R (unlock SOL)   │
      │  ◄────────────────────────────────   │
      │                                       │  4. Claim BTC s preimage R
      │                                       │
```

**Výhody:**
- Trustless — žádný custodian
- ZION validátoři jen orkestrují, nevlastní assets
- Existující ZIONAtomicSwap.sol základ je ready (EVM strana)

**Nevýhody:**
- Vyžaduje druhou stranu trhu (counterparty matching)
- Pomalé u BTC (60 min finality)
- Komplexní uživatelská zkušenost bez UI abstrakce

**Implementační náročnost:** 🔴 Vysoká (6–12 měsíců)

---

### Varianta B — Aggregated Swap přes DEX/Aggregátor (s WARP relay)

WARP Router přijme požadavek `swap(from_chain, to_chain, from_token, to_token, amount)`,
interně zlikviduje přes agregátor (1inch, KyberSwap, Jupiter, Uniswap),
a doručí cílový token uživateli. ZION je fee token.

```
Uživatel
   │  swap(ETH, SOL, 1.0 ETH, recipient_sol_address)
   │
   ▼
WARP Router (L3)
   │
   ├─► ETH Adapter → swap 1.0 ETH → USDC via 1inch/Base
   │
   ├─► WARP Internal USDC Bridge (stablecoin relay)
   │
   └─► SOL Adapter → swap USDC → SOL via Jupiter
          │
          └─► doručit SOL na recipient_sol_address
```

Intermediate stablecoin (USDC/USDT) slouží jako **settlement vrstva**
— uživatel ji nikdy nevidí.

**Výhody:**
- Likvidity DEXů (Uniswap, Jupiter) = reálné kurzy
- Rychlé (sekund–minuty)
- Uživatel vidí jen "dám ETH, dostanu SOL"
- ZION fee je transparentní add-on

**Nevýhody:**
- Dependence na externích DEXech (centralizace rizika)
- Router musí držet relayový stablecoin float (nebo použít flash liquidity)
- Regulatorní riziko (MSB/custody)

**Implementační náročnost:** 🟡 Střední (3–6 měsíců)

---

### Varianta C — Hybridní (doporučeno pro ZION)

Kombinuje A + B:
- **Malé swappy** (< 10K USD) → Aggregated (rychlé, UX-friendly)
- **Velké swappy** (> 10K USD) → HTLC Atomic (trustless, bez custody)
- **ZION ↔ cokoliv** → vždy přes WARP bridge (native integrace)

```
swap(from, to, amount)
      │
      ├── amount < $10K ──► Aggregated path (DEX aggregátor)
      │
      ├── amount ≥ $10K ──► HTLC Atomic path
      │
      └── from/to == ZION ─► WARP native bridge path
```

---

## 4. Technická architektura (Varianta B/C)

### 4.1 Nové komponenty

```
V3/L3/warp/
├── swap/
│   ├── mod.rs            ← SwapRouter trait
│   ├── aggregated.rs     ← DEX aggregátor adapter (1inch, KyberSwap, Jupiter)
│   ├── htlc.rs           ← HTLC atomic swap engine (rozšíření ZIONAtomicSwap)
│   ├── quote.rs          ← Quote engine (cena, slippage, fees)
│   ├── settlement.rs     ← Stablecoin settlement layer (USDC/USDT relay)
│   └── router.rs         ← Unified swap router (pathfinding)
├── adapters/
│   ├── evm.rs            ← (existuje) rozšíření o aggregátor volání
│   ├── solana.rs         ← (existuje) + Jupiter integration
│   ├── bitcoin.rs        ← (existuje) + HTLC extension
│   └── …
```

### 4.2 Nový API endpoint (WARP REST API)

```
POST /api/warp/swap/quote
{
  "from_chain": "ethereum",
  "to_chain":   "solana",
  "from_token": "ETH",
  "to_token":   "SOL",
  "amount":     "1.0",
  "slippage_bps": 50
}

Response:
{
  "quote_id":       "q_abc123",
  "from_amount":    "1.0 ETH",
  "to_amount":      "14.82 SOL",
  "rate":           "14.82 SOL/ETH",
  "fee_zion":       "2.5 ZION",
  "fee_usd":        "$0.50",
  "path":           ["ETH", "USDC", "SOL"],
  "route":          "1inch(ETH→USDC) + Jupiter(USDC→SOL)",
  "expires_at":     1720000060,
  "estimated_time": "45 seconds"
}

POST /api/warp/swap/execute
{
  "quote_id":    "q_abc123",
  "from_address": "0x...",
  "to_address":   "7xKX...",
  "signature":    "..."
}
```

### 4.3 Pathfinding algoritmus

```rust
// V3/L3/warp/swap/router.rs

pub struct SwapPath {
    pub hops: Vec<SwapHop>,
    pub total_fee_bps: u32,
    pub estimated_output: u128,
    pub route_type: RouteType,  // Aggregated | Atomic | Hybrid
}

pub enum SwapHop {
    DexSwap   { dex: DexId, from: Token, to: Token, fee_bps: u32 },
    WarpBridge { from_chain: ChainId, to_chain: ChainId, token: Token },
    ZionFee   { amount_zion: u64 },
}

// Canonical intermediate tokens (settlement layer)
const SETTLEMENT_TOKENS: &[(&str, &str)] = &[
    ("ethereum",  "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"), // USDC
    ("base",      "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"), // USDC
    ("solana",    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"), // USDC SPL
    ("tron",      "TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8"),          // USDC TRC-20
];
```

---

## 5. Fee model pro Native Swap

| Route typ | ZION Fee | + DEX slippage |
|-----------|----------|----------------|
| Same-chain swap (např. ETH→USDC na Base) | 0.05% | ✓ |
| Cross-chain (např. ETH→SOL) | 0.20% | ✓ |
| ZION↔native | 0.10% | – |
| HTLC Atomic | 0.30% | – |

**Fee distribuce (stejná jako WARP):**
- 🔥 50% BURN (deflace ZION)
- 🏛️ 25% DAO Treasury
- 💰 25% Validátoři

**Proč ZION fee i bez wZION v trase:**
- Uživatel musí vlastnit minimálně malé množství ZION na zaplacení poplatku
- Alternativa: fee se strhne z output tokenu a přemění přes WARP na ZION (auto-fee)
- Auto-fee varianta: uživatel nemusí vlastnit ZION vůbec

---

## 6. Integrace s existující architekturou

### Co existuje a dá se přidat

| Komponenta | Stav | Rozšíření pro Native Swap |
|------------|------|---------------------------|
| `V3/L3/warp/` WARP Router | ✅ existuje | + `swap/` modul |
| `ZIONAtomicSwap.sol` | ✅ deployed (Sepolia) | + cross-chain HTLC extension |
| EVM adapter | ✅ existuje | + 1inch/KyberSwap aggregátor volání |
| Solana adapter | ✅ existuje (skeleton) | + Jupiter aggregátor |
| Bitcoin adapter | ✅ existuje (HTLC) | ready pro atomic |
| `/warp` UI stránka | ✅ existuje | + Swap widget tab |
| `ZIONBridge.sol` | ✅ live mainnet | neměnit |
| wZION pool | ✅ live mainnet | neměnit |

### Co je potřeba nového

| Co | Priorita |
|----|----------|
| `swap/router.rs` — pathfinding | P0 |
| `swap/quote.rs` — DEX quote API integration | P0 |
| `swap/aggregated.rs` — 1inch + Jupiter | P1 |
| `swap/settlement.rs` — USDC relay | P1 |
| `/api/warp/swap/quote` + `/execute` endpoints | P0 |
| UI: Swap widget na `/warp` stránce | P1 |
| `swap/htlc.rs` — cross-chain HTLC | P2 (V2) |

---

## 7. UI/UX návrh

### Swap Widget (přidání tab na `/warp`)

```
┌─────────────────────────────────────────┐
│  ZION Native Swap                       │
│                                         │
│  From:  [ETH ▼]  [1.0        ]         │
│         Ethereum · Balance: 1.5 ETH     │
│                                         │
│  ↕ (swap direction)                     │
│                                         │
│  To:    [SOL ▼]  [≈ 14.82    ]         │
│         Solana · Address: 7xKX...       │
│                                         │
│  Route: ETH → USDC (1inch) → SOL (Jupiter)
│  Fee: 0.20% · ~$0.50 · Est. 45s        │
│                                         │
│  [Get Quote]  [Execute Swap]            │
└─────────────────────────────────────────┘
```

Implementace jako nový `NativeSwapWidget.tsx` (vedle stávajícího `SwapWidget.tsx`).

---

## 8. Bezpečnostní úvahy

### 8.1 Slippage & MEV ochrana
- Quote má expiraci (default 60s)
- Slippage tolerance nastavitelná (default 0.5%)
- Pro HTLC: timelock = max(from_chain_finality × 2, 30 min)

### 8.2 Partial fill riziko
- Aggregátorové swappy mohou být partially filled
- Řešení: revert pokud `output < min_output` (slippage check)

### 8.3 Bridge relay riziko
- Stejný 3-of-5 quorum jako WARP
- Stablecoin settlement float je minimalizován (flash-style relay)

### 8.4 Regulatorní
- Native Swap bez custody (HTLC) = nízké MSB riziko
- Aggregated varianta = možný custodian moment (právní analýza nutná před prod.)

---

## 9. Implementační plán (fáze)

### Fáze 1 — Quote engine (2–4 týdny)
- [ ] `swap/quote.rs` — integrace 1inch Quote API (EVM) + Jupiter Quote API (Solana)
- [ ] `GET /api/warp/swap/quote` endpoint
- [ ] UI: Swap widget (read-only, jen cena)

### Fáze 2 — Aggregated execution (4–8 týdnů)
- [ ] `swap/aggregated.rs` — volání 1inch Router + Jupiter swap
- [ ] `swap/settlement.rs` — USDC relay přes WARP
- [ ] `POST /api/warp/swap/execute` endpoint
- [ ] UI: Execute button, status tracking

### Fáze 3 — HTLC Atomic (2–4 měsíce)
- [ ] `swap/htlc.rs` — cross-chain HTLC engine
- [ ] Rozšíření `ZIONAtomicSwap.sol` pro multi-chain
- [ ] Bitcoin HTLC adapter dokončení
- [ ] Counterparty matching (order-book nebo RFQ)

### Fáze 4 — Hybridní router (1 měsíc)
- [ ] `swap/router.rs` — unified pathfinding (auto-select A vs B)
- [ ] Fee optimization (minimalizace celkových nákladů)
- [ ] Dashboard integrace (metriky swapů)

---

## 10. Reference a závislosti

| Služba | Účel | API |
|--------|------|-----|
| **1inch** | EVM DEX aggregátor (ETH, Base, BSC, Polygon) | `https://api.1inch.dev/swap/v6.0/{chainId}/quote` |
| **Jupiter** | Solana DEX aggregátor | `https://quote-api.jup.ag/v6/quote` |
| **KyberSwap** | EVM + multi-chain aggregátor (Base používáme dnes) | `https://aggregator-api.kyberswap.com/{chain}/api/v1/routes` |
| **Uniswap V3** | EVM swap (Base — máme pooly) | přes SwapRouter02 |
| **Thorchain** | Native cross-chain swap (BTC, ETH, SOL bez wrapped) | `https://thornode.ninerealms.com` |
| **Chainflip** | Native BTC↔ETH bez wrapped | `https://chainflip.io` |

### Thorchain jako alternativa k vlastní implementaci

[Thorchain](https://thorchain.org) řeší přesně tento problém — nativní BTC↔ETH↔SOL swap
bez wrapped tokenů. Integrace přes Thorchain API by byla:
- **Rychlejší implementace** (týdny vs. měsíce)
- **Testovaná likvidita** ($500M+ v poolech)
- **Tradeoff:** závislost na externí protokol, poplatky Thorchain

Doporučení: **Fáze 1–2** vlastní implementace (EVM + Solana), **Fáze 3** zvážit
Thorchain relay pro BTC↔X namísto custom HTLC.

---

## 11. Otevřené otázky (k rozhodnutí)

| Otázka | Možnosti | Priorita |
|--------|----------|----------|
| Fee token: musí uživatel vlastnit ZION? | (A) Ano — ZION required; (B) Auto-fee z output | P0 |
| Custodian model: kdo drží inter-chain float? | (A) WARP validators; (B) flash relay; (C) Thorchain | P0 |
| Atomic vs. Aggregated threshold | $5K? $10K? Uživatelská volba? | P1 |
| Thorchain integrace (BTC rychlost) | Vlastní HTLC vs. TC relay | P1 |
| Právní analýza pro aggregated swap | Interní poradce nebo externě? | P1 |
| ZION jako output token (swap X → ZION) | Vždy přes L1 bridge nebo L2 wZION→ZION? | P2 |

---

## 12. Vztah k existující architektuře

```
ZION Ekosystém — vrstvová mapa

L1  ──── ZION Native Chain (PoW, UTXO)
          │
L2  ──── wZION Bridge (Base Mainnet) ──── Uniswap V3 (wZION/USDT, wZION/WETH, wZION/SOL)
          │                                     ← stávající DeFi stack
L3  ──── WARP Router (cross-chain)
          │
          ├── ZION ↔ BTC/ETH/SOL/...  ← stávající WARP transfer
          │
          └── [NEW] Native Swap       ← tento dokument
                   BTC ↔ ETH
                   ETH ↔ SOL
                   SOL ↔ USDT
                   ...
```

Native Swap **nenahrazuje** wZION ani L2 DeFi.
Je to nová služba na L3 WARP vrstvě pro uživatele,
kteří chtějí cross-chain výměnu **bez nutnosti vstoupit do ZION ekosystému**.
Generuje ale ZION fee demand → deflační tlak → value pro ZION holdery.

---

*Dokument vyžaduje schválení a architektonické review před implementací.*  
*Viz `V3/ROADMAP.md` pro kontext a prioritizaci.*
