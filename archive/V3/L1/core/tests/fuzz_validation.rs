//! Property-based fuzzing for transaction and block validation.
//!
//! These tests use `proptest` to generate arbitrary inputs and verify that
//! validation functions never panic and always return a correct Result.
//! Run with: `cargo test -p zion-core --test fuzz_validation`
//! For long runs: `cargo test -p zion-core --test fuzz_validation -- --ignored`

use proptest::prelude::*;

use zion_core::tx::{Transaction, TxInput, TxOutput};
use zion_core::validation::{
    merkle_root, validate_no_double_spend, validate_structure, validate_timestamp,
    validate_value_conservation, UtxoInfo,
};

// ── Strategies ─────────────────────────────────────────────────────────

prop_compose! {
    fn arb_tx_input()(prev_tx_hash in prop::array::uniform32(0u8..255u8), output_index in 0u32..=u32::MAX) -> TxInput {
        TxInput {
            prev_tx_hash,
            output_index,
            signature: vec![],
            public_key: vec![],
        }
    }
}

prop_compose! {
    fn arb_tx_output()(amount in 0u64..=u64::MAX, address in "[a-z0-9]{1,44}") -> TxOutput {
        TxOutput { amount, address, memo: None }
    }
}

prop_compose! {
    fn arb_transaction()(inputs in prop::collection::vec(arb_tx_input(), 0..8),
                         outputs in prop::collection::vec(arb_tx_output(), 0..8),
                         fee in 0u64..=u64::MAX,
                         timestamp in 0u64..=u64::MAX,
                         version in 0u32..=u32::MAX) -> Transaction {
        Transaction {
            id: [0u8; 32],
            version,
            inputs,
            outputs,
            fee,
            timestamp,
        }
    }
}

fn arb_tx_list() -> impl Strategy<Value = Vec<Transaction>> {
    prop::collection::vec(arb_transaction(), 0..16)
}

// ── merkle_root: never panics ──────────────────────────────────────────

proptest! {
    #![proptest_config(ProptestConfig::with_cases(10_000))]

    #[test]
    fn fuzz_merkle_root_never_panics(hashes in prop::collection::vec(prop::array::uniform32(0u8..255u8), 0..100)) {
        let _ = merkle_root(&hashes);
    }

    #[test]
    fn fuzz_merkle_root_deterministic(hashes in prop::collection::vec(prop::array::uniform32(0u8..255u8), 1..50)) {
        let r1 = merkle_root(&hashes);
        let r2 = merkle_root(&hashes);
        prop_assert_eq!(r1, r2);
    }
}

// ── validate_structure: never panics ───────────────────────────────────

proptest! {
    #![proptest_config(ProptestConfig::with_cases(10_000))]

    #[test]
    fn fuzz_validate_structure_never_panics(
        txs in arb_tx_list(),
        block_size in 0usize..=10_000_000
    ) {
        let _ = validate_structure(&txs, block_size);
    }
}

// ── validate_no_double_spend: never panics ─────────────────────────────

proptest! {
    #![proptest_config(ProptestConfig::with_cases(10_000))]

    #[test]
    fn fuzz_validate_no_double_spend_never_panics(txs in arb_tx_list()) {
        let _ = validate_no_double_spend(&txs);
    }
}

// ── validate_timestamp: never panics ───────────────────────────────────

proptest! {
    #![proptest_config(ProptestConfig::with_cases(10_000))]

    #[test]
    fn fuzz_validate_timestamp_never_panics(
        ts in 0u64..=u64::MAX,
        mtp in 0u64..=u64::MAX,
        now in 0u64..=u64::MAX
    ) {
        let _ = validate_timestamp(ts, mtp, now);
    }

    #[test]
    fn fuzz_validate_timestamp_rejects_far_future(
        now in 0u64..=u64::MAX - 7201,
    ) {
        let far_future = now + 7201;
        let result = validate_timestamp(far_future, now, now);
        prop_assert!(result.is_err(), "timestamp {} should be rejected as too far future (now={})", far_future, now);
    }
}

// ── validate_value_conservation: never panics ──────────────────────────

proptest! {
    #![proptest_config(ProptestConfig::with_cases(10_000))]

    #[test]
    fn fuzz_validate_value_conservation_never_panics(txs in arb_tx_list()) {
        let utxo_lookup = |_: &[u8; 32], _: u32| -> Option<UtxoInfo> {
            Some(UtxoInfo {
                amount: 1_000_000_000,
                address: "fuzz".into(),
                created_height: 0,
                is_coinbase: false,
            })
        };
        let is_bridge = |_: &Transaction| -> bool { false };
        let _ = validate_value_conservation(&txs, &utxo_lookup, &is_bridge);
    }
}

// ── Long-running fuzz mode (for 24h runs) ──────────────────────────────
//
// Run with: cargo test -p zion-core --test fuzz_validation -- --ignored
// This uses 100k cases per property instead of the default 256.

#[cfg(test)]
mod long_fuzz {
    use super::*;

    proptest! {
        #![proptest_config(ProptestConfig::with_cases(100_000))]

        #[test]
        #[ignore = "Long-running fuzz: use --ignored to enable"]
        fn long_fuzz_merkle_root(hashes in prop::collection::vec(prop::array::uniform32(0u8..255u8), 0..200)) {
            let _ = merkle_root(&hashes);
        }

        #[test]
        #[ignore = "Long-running fuzz: use --ignored to enable"]
        fn long_fuzz_validate_structure(
            txs in prop::collection::vec(arb_transaction(), 0..32),
            block_size in 0usize..=50_000_000
        ) {
            let _ = validate_structure(&txs, block_size);
        }

        #[test]
        #[ignore = "Long-running fuzz: use --ignored to enable"]
        fn long_fuzz_validate_no_double_spend(
            txs in prop::collection::vec(arb_transaction(), 0..32)
        ) {
            let _ = validate_no_double_spend(&txs);
        }

        #[test]
        #[ignore = "Long-running fuzz: use --ignored to enable"]
        fn long_fuzz_validate_timestamp(
            ts in 0u64..=u64::MAX,
            mtp in 0u64..=u64::MAX,
            now in 0u64..=u64::MAX
        ) {
            let _ = validate_timestamp(ts, mtp, now);
        }

        #[test]
        #[ignore = "Long-running fuzz: use --ignored to enable"]
        fn long_fuzz_validate_value_conservation(
            txs in prop::collection::vec(arb_transaction(), 0..32)
        ) {
            let utxo_lookup = |_: &[u8; 32], _: u32| -> Option<UtxoInfo> {
                Some(UtxoInfo {
                    amount: 1_000_000_000,
                    address: "fuzz".into(),
                    created_height: 0,
                    is_coinbase: false,
                })
            };
            let is_bridge = |_: &Transaction| -> bool { false };
            let _ = validate_value_conservation(&txs, &utxo_lookup, &is_bridge);
        }
    }
}
