//! Print `.env`-style lines for repo-pinned mainnet subsidy addresses and pool payout signer.
//!
//! Addresses use `crypto::canonical_address_for_label` with UTF-8 labels in `genesis.rs`.
//! The pool payout signing key (`ZION_POOL_PAYOUT_SK_HEX`) is reproducible from the same label.

fn main() {
    use zion_core::crypto;
    use zion_core::genesis::{
        MAINNET_CANONICAL_DEFAULT_MINER_LABEL, MAINNET_CANONICAL_DEFAULT_MINER_WALLET,
        MAINNET_CANONICAL_HUMANITARIAN_SUBSIDY_WALLET, MAINNET_CANONICAL_ISSOBELLA_SUBSIDY_LABEL,
        MAINNET_CANONICAL_ISSOBELLA_SUBSIDY_WALLET, MAINNET_CANONICAL_POOL_FEE_SUBSIDY_LABEL,
        MAINNET_CANONICAL_POOL_FEE_SUBSIDY_WALLET, MAINNET_CANONICAL_POOL_PAYOUT_LABEL,
        MAINNET_CANONICAL_POOL_PAYOUT_WALLET,
    };

    debug_assert_eq!(
        crypto::canonical_address_for_label(MAINNET_CANONICAL_ISSOBELLA_SUBSIDY_LABEL),
        MAINNET_CANONICAL_ISSOBELLA_SUBSIDY_WALLET
    );
    debug_assert_eq!(
        crypto::canonical_address_for_label(MAINNET_CANONICAL_POOL_FEE_SUBSIDY_LABEL),
        MAINNET_CANONICAL_POOL_FEE_SUBSIDY_WALLET
    );
    debug_assert_eq!(
        crypto::canonical_address_for_label(MAINNET_CANONICAL_DEFAULT_MINER_LABEL),
        MAINNET_CANONICAL_DEFAULT_MINER_WALLET
    );
    debug_assert_eq!(
        crypto::canonical_address_for_label(MAINNET_CANONICAL_POOL_PAYOUT_LABEL),
        MAINNET_CANONICAL_POOL_PAYOUT_WALLET
    );

    let (sk_pool, _) = crypto::keypair_from_canonical_label(MAINNET_CANONICAL_POOL_PAYOUT_LABEL);

    println!(
        "# Reproducible from zion_core::genesis labels — replace if you need exclusive custody"
    );
    println!("ZION_MINER_ADDRESS={MAINNET_CANONICAL_DEFAULT_MINER_WALLET}");
    println!("ZION_HUMANITARIAN_WALLET={MAINNET_CANONICAL_HUMANITARIAN_SUBSIDY_WALLET}");
    println!("ZION_ISSOBELLA_WALLET={MAINNET_CANONICAL_ISSOBELLA_SUBSIDY_WALLET}");
    println!("ZION_POOL_FEE_WALLET={MAINNET_CANONICAL_POOL_FEE_SUBSIDY_WALLET}");
    println!("ZION_POOL_WALLET={MAINNET_CANONICAL_POOL_PAYOUT_WALLET}");
    println!(
        "ZION_POOL_PAYOUT_SK_HEX={}",
        crypto::to_hex(sk_pool.as_bytes())
    );
}
