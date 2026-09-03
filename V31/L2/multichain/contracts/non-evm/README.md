# Non-EVM Token Contracts — DEPRECATED

> **⚠️ DEPRECATED (2026-09-03):** Custom non-EVM bridge contracts are no longer needed.
> The L2 multichain service handles bridge logic **off-chain** via chain adapters.
> On-chain, use **existing token standards** (SPL, native asset, TRC-20, etc.).
>
> These contracts are kept for historical reference only.
> See [`L2contracts.md`](../../../L2contracts.md) §7 and
> [`ZIS_WALLET_PLAN.md`](../../../ZIS_WALLET_PLAN.md).

## What was here

| Chain | File | Standard | Status |
|-------|------|----------|--------|
| Solana | `solana/zion_spl_token.rs` | SPL Token | ✅ Deployed — use existing SPL |
| Stellar | `stellar/setup_zion_asset.py` | Native Asset | ✅ Deployed — use existing asset |
| Cosmos | `cosmos/zion_cw20.rs` | CW-20 | ⏳ Not deployed — use existing CW-20 |
| NEAR | `near/zion_token.rs` | NEP-141 | ⏳ Not deployed — use existing NEP-141 |
| Aptos | `aptos/sources/` | Coin | ⏳ Not deployed — use existing Coin standard |
| Sui | `sui/sources/` | Coin | ⏳ Not deployed — use existing Coin standard |
| Tron | `tron/ZionToken.sol` | TRC-20 | ⏳ Not deployed — deploy simple TRC-20 if needed |
| Cardano | `cardano/mint_zion_token.hs` | Native Token | ⏳ Not deployed — use existing native token |
| Ton | `ton/` | Jetton | ⏳ Not deployed — use existing Jetton standard |

## New approach

**No custom bridge contracts per chain.** The L2 multichain service (`V31/L2/multichain/src/chain/adapters/`)
handles:
- Balance checking
- Deposit watching
- Withdrawal / transfer

On-chain, we only need the token itself using the chain's native standard.
