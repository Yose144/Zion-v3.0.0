# Mainnet Alpha — Multi-Chain L2 Unifikace (mimo V3)

> **Verze:** 1.0 (draft)  
> **Datum:** 2026-07-27  
> **Status:** koncept / návrh pro `V31/`  
> **Scope:** čistý `V31/` strom; `V3/` se nesmí měnit, dokud `V31/` není E2E ověřený.

---

## 1. Proč sjednocení?

Současná architektura má **příliš mnoho L2/L3 komponent**, které dělají podobné věci:

| Komponenta | Co dělá | Duplikace |
|---|---|---|
| `V3/L2/bridge` | L1 <-> EVM lock/mint | vlastní L1 watcher, EVM tx signing, decimal/memo logika |
| `V3/L3/warp` | Univerzální 12-chain bridge | vlastní `ChainAdapter`, `DepositProof`, `MintInstruction`, memo parser |
| `V3/L2/atomic-swap` | HTLC trustless swap | vlastní HTLC stav, hashlock/timelock logika |
| `ZionDex/` | DEX router + intent | vlastní executor, signing, chain adapters |
| `V3/L2/swap-aggregator` | AMM quote aggregator | vlastní routing, fee logika |
| `V3/L2/dao` | Governance/treasury | částečně překrývá se treasury/wallet logikou |

Každý crate má vlastní `Cargo.toml`, `rusqlite` DB, `axum` server, config, signer a adresní/decimal logiku. Pro **Mainnet Alpha** je to neudržitelné.

Cíl tohoto konceptu: navrhnout **nejmenší možný L2 strom**, který pokryje všechny value-moving operace jednou sadou typů, traitů a jednou binárkou.

---

## 2. Základní principy sjednocení

1. **Jeden `ChainAdapter` trait** pro všechno. Přesunout do `V31/L2/multichain/src/chain/adapter.rs` (odvozený od WARP `ChainAdapter`). Bridge, WARP, DEX, wallet — všichni ho používají.
2. **Jedna `Asset` abstrakce**. Místo `ExternalCoin`, `wZION`, `BridgeToken`, `ZDXToken` použít jeden `Asset { chain, contract, decimals, ticker }`.
3. **Jedna `Transfer` pipeline**. Lock/mint, HTLC a DEX swap jsou jen tři módy stejného `Transfer` stavového stroje: `Pending → Detected → Validating → Executing → Completed|Failed|Refunded`.
4. **Jedna interní měna — Dharma Credits**. Všechny pool odměny, bridge poplatky a swap fee se účtují v `DharmaCredits` a až na požádání se konvertují na cílový chain/asset. Viz `MULTICHAIN_WALLET_POOL_CONCEPT.md`.
5. **Jedna binárka `zion-multichain`**. Moduly se zapínají feature flagy a konfigurací, ne samostatnými procesy.
6. **Jeden REST API gateway**. `/v1/multichain/transfers`, `/v1/multichain/swaps`, `/v1/multichain/bridge`, `/v1/multichain/dex` na jednom portu.

---

## 3. Cílová struktura V31/L2

```
V31/
├── L1/                           (node, miner, pool, cosmic-harmony)
│   └── ...
├── L2/
│   └── multichain/                  ← JEDINÝ L2 crate pro value operations
│       ├── Cargo.toml
│       └── src/
│           ├── main.rs           # zion-multichain binary
│           ├── lib.rs
│           ├── config.rs         # jeden multichain.toml
│           ├── db.rs             # jedna multichain.db (SQLite)
│           ├── server.rs         # jeden axum server (port 8453 default)
│           ├── router.rs         # HTTP routing
│           ├── types.rs          # Asset, Transfer, TransferStatus, Address
│           ├── chain/
│           │   ├── mod.rs
│           │   ├── adapter.rs    # ChainAdapter async trait (z WARP)
│           │   ├── zion_l1.rs    # L1 RPC + signing
│           │   ├── evm.rs        # EVM (Base, Arbitrum, Optimism, BSC, ...)
│           │   ├── bitcoin.rs    # BTC / mempool.space
│           │   └── solana.rs     # (post-Alpha)
│           ├── wallet/
│           │   ├── keyring.rs    # BIP39 seed, per-coin derivation
│           │   ├── signer.rs     # generic sign() dispatch
│           │   └── zion_cli.rs   # CLI wallet commands
│           ├── bridge/
│           │   ├── lock_mint.rs  # obecný lock/mint (absorbuje bridge + warp core)
│           │   ├── watcher.rs    # deposit/burn event polling
│           │   └── validator.rs  # guardian threshold signing
│           ├── swap/
│           │   ├── htlc.rs       # atomic swap (absorbuje atomic-swap)
│           │   └── dex.rs        # intent + AMM aggregator (absorbuje ZionDex + swap-aggregator)
│           ├── credits/
│           │   └── ledger.rs     # Dharma Credits accounting
│           └── metrics.rs
│
├── L3/
│   ├── ai-native/                # Hiran / orchestrator (žádná value logika)
│   └── ncl/                      # AI compute marketplace
│
└── cli/                          # thin wrapper: zion send, zion swap, zion bridge, ...
```

### Co zmizí jako samostatný crate?

- `V3/L2/bridge` → `multichain::bridge`
- `V3/L3/warp` → `multichain::bridge` (lock/mint) + `multichain::chain` (adapters)
- `V3/L2/atomic-swap` → `multichain::swap::htlc`
- `ZionDex/` + `V3/L2/swap-aggregator` → `multichain::swap::dex`
- `V3/cli/src/commands/wallet.rs` → `multichain::wallet` + `V31/cli` thin commands

`V3/L2/dao` zůstává samostatně, protože governance není value transfer, ale používá `multichain` pro treasury payout.

---

## 4. Jednotné API (příklady)

### 4.1 Bridge / lock-mint

```http
POST /v1/multichain/bridge
{
  "from": { "chain": "zion-l1", "asset": "ZION" },
  "to":   { "chain": "base",    "asset": "wZION" },
  "amount": "1000000000",
  "recipient": "0x..."
}
```

### 4.2 Atomic swap (HTLC)

```http
POST /v1/multichain/swaps/htlc
{
  "from": { "chain": "bitcoin", "asset": "BTC" },
  "to":   { "chain": "zion-l1", "asset": "ZION" },
  "amount": "500000",
  "recipient": "zion1...",
  "hashlock": "0x...",
  "timelock": 7200
}
```

### 4.3 DEX swap

```http
POST /v1/multichain/swaps/dex
{
  "from": { "chain": "base", "asset": "wZION" },
  "to":   { "chain": "base", "asset": "USDC" },
  "amount": "1000000000",
  "slippage_bps": 50
}
```

### 4.4 Dharma Credits balance

```http
GET /v1/multichain/credits/:address
```

---

## 5. Mainnet Alpha scope — co musí být hotovo

Cílem není pokrýt všechny 12 chainy WARP. Cílem je mít **jednu ověřenou cestu** pro každou operaci.

| Funkce | Minimální podpora v Mainnet Alpha | Standard (post-launch) |
|---|---|---|
| **Wallet** | ZION, BTC, EVM (Base) adresy ze jednoho seedu | + XMR, DCR, ZANO, SOL, ... |
| **Bridge** | ZION L1 <-> Base (wZION) lock/mint | + Arbitrum, Optimism, BSC, ... |
| **Atomic swap** | BTC <-> ZION HTLC | + XMR, LTC, DCR HTLC |
| **DEX** | wZION/USDC na Base přes Uniswap/V3 nebo ZionDex pool | + multi-chain routing |
| **Pool payouts** | Dharma Credits accounted, paid in ZION or BTC | + native coin payouts |
| **DAO treasury** | Payouty v ZION, multisig 3/5 | + treasury bridge do Base |

---

## 6. Fázový plán (mimo V3)

| Fáze | Co se dělá | Kde | Trvání |
|---|---|---|---|
| 0 | `V31/L2/multichain` scaffold: `ChainAdapter` trait, `Asset`, `Transfer`, SQLite schema, axum server | `V31/` | 1 týden |
| 1 | Migrace `zion-bridge` → `multichain::bridge` (L1 <-> Base) | `V31/L2/multichain/src/bridge/` | 2–3 týdny |
| 2 | Migrace `zion-atomic-swap` → `multichain::swap::htlc` (BTC <-> ZION) | `V31/L2/multichain/src/swap/htlc.rs` | 2 týdny |
| 3 | Migrace `ZionDex` router + `swap-aggregator` → `multichain::swap::dex` | `V31/L2/multichain/src/swap/dex.rs` | 3–4 týdny |
| 4 | `multichain::wallet` keyring + CLI commands (`zion send`, `zion bridge`, `zion swap`) | `V31/cli/` + `multichain::wallet/` | 2–3 týdny |
| 5 | `multichain::credits` Dharma Credits ledger + pool payout hook | `V31/L2/multichain/src/credits/` | 2 týdny |
| 6 | E2E smoke: L1 <-> Base bridge, BTC <-> ZION HTLC, wZION/USDC swap, pool payout | staging Edge | 2 týdny |

Celkem: **3–4 měsíce** pro funkční Mainnet Alpha `V31/L2/multichain` bez zásahu do `V3/`.

---

## 7. Jak to sjednotit s pool/wallet konceptem?

`MULTICHAIN_WALLET_POOL_CONCEPT.md` navrhuje multichain wallet a nativní multichain pool. Tento dokument navrhuje, že obojí sedí nad `V31/L2/multichain`:

- **Multichain wallet** = `multichain::wallet` keyring. CLI `zion wallet` jen volá `multichain::wallet` API.
- **Pool payouts** = miner najde block → pool zavolá `multichain::credits::credit(miner_address, value)` → miner si vybere payout asset přes `multichain::swap` nebo `multichain::bridge`.
- **Bridge/WARP** = `multichain::bridge` používá `multichain::chain` adapters. Kdokoliv může locknout asset na jednom chainu a mintnout ho na druhém.
- **Atomic swap / DEX** = `multichain::swap` modul. Uživatel nemusí vědět, jestli jde o HTLC nebo AMM — router vybere nejlevnější cestu.

---

## 8. Co zůstává oddělené a proč?

| Komponenta | Proč zůstává samostatná |
|---|---|
| `L1/core` + `L1/miner` + `L1/pool` | Consensus a mining nesmí být v L2. Pool ale posílá payouty do `multichain`. |
| `L2/dao` | Governance není value transfer; treasury payout ale jde přes `multichain`. |
| `L3/ai-native` / `ncl` | AI orchestrace nesahá na prostředky uživatelů. Může číst `multichain` metrics. |
| `edge-deploy/` | Ops zůstává mimo kód, ale `zion-multichain` config je jeden soubor. |

---

## 9. Rizika a mitigace

| Riziko | Mitigace |
|---|---|
| `V31/L2/multichain` bude moc velký monolit | Rozdělení do `src/{chain,bridge,swap,wallet,credits}` modulů; feature flagy zapínají moduly; testy per module. |
| Sjednocení Bridge + WARP ztratí univerzálnost | `ChainAdapter` zůstává extensible; další chainy se přidávají jako `chain/adapters/<chain>.rs` bez změny API. |
| Dharma Credits jsou matoucí název | V Mainnet Alpha použít interní název `ZION Credit` nebo `Pool Credit` pro uživatele; Dharma Credits zůstává kódový termín. |
| Pool payout v `credits` může být centralizovaný | Všechny credit operace jsou on-chain nebo verifikovatelné; treasury/DAO ovládá minting kontrakt. |
| Změna portů/configů na Edge | `zion-multichain` běží na novém portu (např. 8453 pro L2 gateway); legacy služby zůstávají, dokud není cutover. |

---

## 10. Vztah k existujícím plánům

- [`V3.1_MIGRATION_PLAN.md`](../3.0.6/V3.1_MIGRATION_PLAN.md) říká *co* se má přesunout a kam.
- [`V3.1_INTEGRATION_PLAN.md`](../3.0.6/V3.1_INTEGRATION_PLAN.md) říká *jak* spojit Bridge↔WARP a AuxPoW→Miner.
- **Tento koncept** navrhuje jít dál: ne jen spojit Bridge↔WARP, ale vytvořit jediný `V31/L2/multichain` crate pro všechny value-moving operace.
- [`MULTICHAIN_WALLET_POOL_CONCEPT.md`](MULTICHAIN_WALLET_POOL_CONCEPT.md) doplňuje wallet a pool stranu.

---

## 11. Následující krok

Pokud tento směr schvaluješ, doporučuji:

1. ✅ Název vybrán: **Multi-Chain** — kódový crate `zion-multichain` (Rust modul `multichain`), REST prefix `/v1/multichain`.
2. Vybrat první 2 moduly pro Phase 0: `chain` + `bridge` (Base <-> ZION L1).
3. Vytvořit `V31/L2/multichain` scaffold na `v3.1-migration` větvi.
4. Nezasahovat do `V3/` — všechny změny v `V31/`.

---

*Koncept připraven k diskuzi. Cílem je redukovat počet L2/L3 crateů a konceptů na minimum pro Mainnet Alpha, bez ztráty funkčnosti.*
