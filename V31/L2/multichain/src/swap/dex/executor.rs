//! Cross-chain swap executor (ported from archive/ZionDex/router/src/executor.rs).
//!
//! The archive executor submitted transactions to external DEX contracts on
//! each chain.  In the unified V31 architecture the executor instead runs a
//! solver's `PathHop` sequence against the local `DexRouter` (same-chain AMM
//! hops) and the `Bridge` module (cross-chain bridge hops), which is exactly
//! what is needed to settle a winning ZionDex bid.

use zion_l1_types::{Address, Amount, Asset, ChainId};

use crate::bridge::Bridge;
use crate::contracts::token_decimals;
use crate::error::{MultichainError, MultichainResult};
use crate::swap::dex::DexRouter;
use crate::swap::dex::intent::{SolverBid, SwapIntent};
use crate::types::{Transfer, TransferDirection, TransferEndpoint};
use crate::wallet::Keyring;

/// Executes a winning solver path against the on-chain runtime.
#[derive(Debug, Clone)]
pub struct Executor {
    keyring: Keyring,
}

impl Executor {
    pub fn new(keyring: Keyring) -> Self {
        Self { keyring }
    }

    /// Execute `bid.path` for `intent` on `router`, using `bridge` for
    /// cross-chain hops and `router.execute` for same-chain AMM hops.
    ///
    /// The bid must satisfy `intent.min_amount_out`.  The path is validated
    /// for continuity (each `from_token` equals the previous output token).
    pub async fn execute(
        &self,
        intent: &SwapIntent,
        bid: &SolverBid,
        bridge: &Bridge,
        router: &mut DexRouter,
    ) -> MultichainResult<Amount> {
        if bid.path.is_empty() {
            return Err(MultichainError::Validation(
                "winning bid has empty execution path".to_string(),
            ));
        }

        if !intent.bid_meets_min(bid) {
            return Err(MultichainError::Validation(
                "winning bid does not meet minimum output".to_string(),
            ));
        }

        let mut amount = intent.amount_in;
        let mut previous_asset = intent.from_asset.clone();

        for hop in &bid.path {
            if hop.from_token != previous_asset {
                return Err(MultichainError::Validation(
                    "solver path is not continuous".to_string(),
                ));
            }

            if hop.is_bridge {
                let direction = bridge_direction(hop.from_token.chain, hop.to_token.chain)?;
                let source_addr = self.derive_address(hop.from_token.chain)?;
                let target_addr = self.derive_address(hop.to_token.chain)?;
                let source_asset = asset_from_id(&hop.from_token);
                let target_asset = asset_from_id(&hop.to_token);
                let mut transfer = Transfer::new(
                    format!("intent-{}", intent.id),
                    direction,
                    TransferEndpoint {
                        address: source_addr,
                        asset: source_asset,
                        amount,
                    },
                    TransferEndpoint {
                        address: target_addr,
                        asset: target_asset,
                        amount,
                    },
                );
                bridge.submit(&mut transfer).await?;
                amount = transfer.target.amount;
            } else {
                let from = asset_from_id(&hop.from_token);
                let to = asset_from_id(&hop.to_token);
                amount = router.execute(&from, &to, amount)?;
            }

            previous_asset = hop.to_token.clone();
        }

        if amount < intent.min_amount_out {
            return Err(MultichainError::Validation(
                "executed amount is below the user's minimum".to_string(),
            ));
        }

        Ok(amount)
    }

    fn derive_address(&self, chain: ChainId) -> MultichainResult<Address> {
        self.keyring.address(chain, 0, 0)
    }
}

fn bridge_direction(from: ChainId, to: ChainId) -> MultichainResult<TransferDirection> {
    match (from, to) {
        (ChainId::ZionL1, _) => Ok(TransferDirection::LockMint),
        (_, ChainId::ZionL1) => Ok(TransferDirection::BurnRelease),
        _ => Err(MultichainError::Unsupported(
            "direct bridge between two external chains is not supported".to_string(),
        )),
    }
}

fn asset_from_id(id: &zion_l1_types::AssetId) -> Asset {
    let decimals = if let Some(c) = id.contract.as_deref() {
        token_decimals(id.chain.as_str(), &id.ticker, Some(c))
    } else {
        id.chain.decimals()
    };
    Asset {
        id: id.clone(),
        decimals,
        name: id.ticker.clone(),
    }
}
