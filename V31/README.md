# V31 — Mainnet Alpha Workspace

Čistý `V31/` strom pro ZION **Mainnet Alpha** (3.1.0). Produkční `V3/` zůstává nedotčená, dokud `V31/` neprojde E2E ověřením.

## Struktura

| Adresář | Layer | Popis |
|---|---|---|
| `L1/types` | L1 | Sdílené primitivy: `Address`, `ChainId`, `Asset`, `Hash`, `Amount`. |
| `L1/cosmic-harmony` | L1 | Kanonický PoW `EkamDeeksha` a profit routing (`ExternalCoin`, `CoinProfile`). |
| `L1/core` | L1 | Node consensus, block, transaction (ve výstavbě). |
| `L1/miner` | L1 | **Triple Stream** miner — ZION + volitelný AuxPoW GPU/CPU fallback. |
| `L1/pool` | L1 | Stratum pool + PPLNS accounting. |
| `L2/multichain` | L2 | **Multi-Chain** — jednotná vrstva pro bridge, swap, DEX, wallet a Dharma Credits. |
| `cli` | CLI | `zion` operátorské CLI (thin wrapper nad L2/L1). |

## Filozofie

- **Úplně čistý kód:** žádný legacy, žádné duplikáty, žádné dead code.
- **Jeden zdroj pravdy:** `zion-l1-types` pro primitivy, `zion-cosmic-harmony` pro `ExternalCoin` a PoW.
- **Triple Stream:** primární mining model = ZION canonical + volitelné AuxPoW GPU + CPU fallback.
- **AuxPoW jako fallback:** externí coiny přinášejí dodatečný revenue, ale miner musí umět běžet jen na ZION.
- **Mimo `V3/`:** všechny nové změny v `V31/`; `V3/` běží na Edge.
- **Postupné napojení:** L1 core, pool, miner se přenesou až po All Green verifikaci coinů.

## Build

```bash
cd V31
cargo check
cargo test
```

## Kanonický plán

Detailní stavbu a fázový plán najdeš v [`ALPHA_BUILD_PLAN.md`](./ALPHA_BUILD_PLAN.md).

## Další krok

Fáze 0: robustní Triple Stream miner s volitelným AuxPoW fallback a reálným stratum clientem.
