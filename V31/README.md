# V31 — Mainnet Alpha Workspace

Čistý `V31/` strom pro ZION **Mainnet Alpha** (3.1.0). Produkční `V3/` zůstává nedotčená, dokud `V31/` neprojde E2E ověřením.

## Struktura

| Adresář | Layer | Popis |
|---|---|---|
| `L1/types` | L1 | Sdílené primitivy: `Address`, `ChainId`, `Asset`, `Hash`, `Amount`. |
| `L2/multichain` | L2 | **Multi-Chain** — jednotná vrstva pro bridge, swap, DEX, wallet a Dharma Credits. |
| `cli` | CLI | `zion` operátorské CLI (thin wrapper nad L2/L1). |

## Filozofie

- **Úplně čistý kód:** žádný legacy, žádné duplikáty, žádné dead code.
- **Jeden zdroj pravdy:** `zion-l1-types` pro primitivy, `zion-multichain` pro value-moving operace.
- **Mimo `V3/`:** všechny nové změny v `V31/`; `V3/` běží na Edge.
- **Postupné napojení:** L1 core, pool, miner se přenesou až po All Green verifikaci coinů.

## Build

```bash
cd V31
cargo check
cargo check -p zion-multichain
```

## Další krok

Rozšiřovat `zion-multichain` o konkrétní adaptery (`BitcoinAdapter`, `EvmAdapter`, ...), wallet keyring a bridge/swap logiku.
