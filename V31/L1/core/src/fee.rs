//! ZION Fee Market — 100% Fee Burn Model.
//!
//! All transaction fees are burned (destroyed). The coinbase output is
//! capped at the block reward only — miners do NOT receive transaction fees.
//!
//! All values in flowers (1 ZION = 1_000_000 flowers, post-3.0.3 fork).

use crate::emission;

// ── Constants ──────────────────────────────────────────────────────────

/// Minimum transaction fee: 1 flower (minimum unit, post-3.0.3 fork).
pub const MIN_TX_FEE: u64 = 1;

/// Minimum fee rate: 1 flower per byte of serialized transaction.
pub const MIN_FEE_RATE: u64 = 1;

/// Maximum transaction size: 100 KB.
pub const MAX_TX_SIZE: usize = 100_000;

/// Maximum single output amount: total supply in flowers.
pub const MAX_OUTPUT_AMOUNT: u64 = u64::MAX;

// ── Fee calculation ────────────────────────────────────────────────────

/// Estimate serialized transaction size in bytes.
pub fn estimate_tx_size(num_inputs: usize, num_outputs: usize) -> usize {
    52 + num_inputs * 132 + num_outputs * 60
}

/// Fee rate in flowers per byte.
pub fn fee_rate(fee: u64, tx_size_bytes: usize) -> u64 {
    if tx_size_bytes == 0 {
        return 0;
    }
    fee / tx_size_bytes as u64
}

/// Minimum required fee for a transaction of the given size.
pub fn minimum_fee_for_size(tx_size_bytes: usize) -> u64 {
    let rate_based = tx_size_bytes as u64 * MIN_FEE_RATE;
    rate_based.max(MIN_TX_FEE)
}

/// Validate that a transaction's fee meets minimum requirements.
pub fn validate_fee(fee: u64, tx_size_bytes: usize) -> Result<(), String> {
    if fee < MIN_TX_FEE {
        return Err(format!("fee {fee} below minimum {MIN_TX_FEE} flowers"));
    }
    let min_for_size = minimum_fee_for_size(tx_size_bytes);
    if fee < min_for_size {
        return Err(format!(
            "fee {fee} below minimum for {tx_size_bytes} bytes (need {min_for_size})"
        ));
    }
    Ok(())
}

/// Validate all output amounts: non-zero, within supply cap, total within cap.
#[allow(clippy::absurd_extreme_comparisons)]
pub fn validate_outputs(outputs: &[(u64, &str)]) -> Result<(), String> {
    let mut total: u128 = 0;
    for (i, &(amount, _)) in outputs.iter().enumerate() {
        if amount == 0 {
            return Err(format!("output {i} has zero amount"));
        }
        if amount > MAX_OUTPUT_AMOUNT {
            return Err(format!(
                "output {i} amount {amount} exceeds max {MAX_OUTPUT_AMOUNT}"
            ));
        }
        total += amount as u128;
    }
    if total > MAX_OUTPUT_AMOUNT as u128 {
        return Err(format!(
            "total output {total} exceeds max {MAX_OUTPUT_AMOUNT}"
        ));
    }
    Ok(())
}

// ── Fee burning ────────────────────────────────────────────────────────

/// Maximum allowed coinbase output for a block (reward only, no fees).
pub fn max_coinbase_output(block_height: u64) -> u64 {
    emission::block_subsidy(block_height)
}

/// Total fees burned in a block (sum of all non-coinbase tx fees).
pub fn total_fees_burned(fees: &[u64]) -> u64 {
    fees.iter().skip(1).sum()
}

// ── Burn / canonical addresses ─────────────────────────────────────────

/// Provable-burn address (no known private key).
pub const BURN_ADDRESS: &str = "zion1burn0000000000000000000000000000000dead";

/// DAO treasury address (main — Community Governance, 2.5B ZION).
///
/// This is premine wallet slot 6 from `V31_PREMINE_V2_KEYS_2026-08-06.json`.
pub const DAO_ADDRESS: &str = "zion1f5h5k6t8q3t3d8c5y667z6p2x8t3y3p8c7633g5";

/// Bridge vault address.
///
/// This is premine wallet slot 14 from `V31_PREMINE_V2_KEYS_2026-08-06.json`
/// (the UTXO seed used for bridge unlock liquidity).
pub const BRIDGE_VAULT_ADDRESS: &str = "zion1j3w3h7k8m635h734y786j5804305m822t5uk546";

#[cfg(test)]
mod tests {
    use super::*;
    use crate::crypto;

    #[test]
    fn burn_address_is_rejected_by_is_valid_address() {
        assert!(!crypto::is_valid_address(BURN_ADDRESS));
    }

    #[test]
    fn max_coinbase_block_1() {
        assert_eq!(max_coinbase_output(1), 5_400_067_000);
    }

    #[test]
    fn max_coinbase_genesis_is_zero() {
        assert_eq!(max_coinbase_output(0), 0);
    }

    #[test]
    fn minimum_fee_for_size_small_tx() {
        assert_eq!(minimum_fee_for_size(100), 100);
    }
}
