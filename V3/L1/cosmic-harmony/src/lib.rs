pub mod algorithms_npu;
pub mod algorithms_opt;
pub mod deeksha;
pub mod deeksha_chv3;
pub mod deeksha_lite;
pub mod deeksha_lite_fire;
pub mod gpu;
pub mod hic;
pub mod hugepages;
pub mod ncl_integration;
pub mod profit_router;
pub mod revenue;
pub mod revenue_journal;
pub mod scratchpad_ekam;
pub mod sha3_fast;
pub mod stream_layers;
pub mod stream_profit;

pub use algorithms_npu::{
    epoch_from_height, epoch_seed, npu_mixing_step, npu_mixing_step_epoch, MlpTopology,
    NPU_EPOCH_LENGTH,
};
pub use algorithms_opt::{cosmic_harmony_with_height, meets_difficulty, Hash32, Hash64};
pub use deeksha::{
    account_tx_memo_v1_activation_height, account_tx_memo_v1_active,
    balance_check_activation_height, balance_check_active, body_root_v2_active,
    cosmic_harmony_ekam_deeksha, cosmic_harmony_ekam_deeksha_v2, cosmic_harmony_ekam_deeksha_v3,
    ekam_find_nonce, ekam_self_test, ekam_v2_find_nonce, ekam_v2_self_test, ekam_v3_find_nonce,
    ekam_v3_self_test, generate_ekam_test_vector, generate_ekam_v2_test_vector,
    generate_ekam_v3_test_vector, hash_bytes_with_npu, init_npu, max_tx_amount_activation_height,
    max_tx_amount_active, set_account_tx_memo_v1_activation_height, set_balance_check_height,
    set_max_tx_amount_height, tx_hash_v2_active, ACCOUNT_TX_MEMO_V1_ACTIVATION_HEIGHT,
    BODY_ROOT_V2_ACTIVATION_HEIGHT, CHV42_DUAL_SPIN_FORK_HEIGHT, CHV_EKAM_FORK_HEIGHT,
    CHV_EKAM_V2_FORK_HEIGHT, EKAM_CANONICAL_TEST_VECTOR_HEX, EKAM_FUSION_ROUNDS,
    EKAM_V2_CANONICAL_TEST_VECTOR_HEX, EKAM_V2_PASSES, EKAM_V2_RANDOM_READS,
    EKAM_V2_SCRATCHPAD_SIZE, TX_HASH_V2_ACTIVATION_HEIGHT,
};
pub use deeksha_lite::{deeksha_lite_find_nonce, deeksha_lite_self_test, deeksha_lite_with_height};
pub use deeksha_chv3::{
    deeksha_chv3_find_nonce, deeksha_chv3_find_nonce_with_streams, deeksha_chv3_hash,
    deeksha_chv3_self_test, deeksha_chv3_with_height, deeksha_chv3_with_streams,
    deeksha_chv3_with_streams_height, DEEKSHA_CHV3_PROFILE,
};
pub use deeksha_lite_fire::{
    deeksha_lite_fire, deeksha_lite_fire_find_nonce, deeksha_lite_fire_self_test,
    deeksha_lite_fire_with_height, DEEKSHA_LITE_FIRE_PROFILE,
};
pub use gpu::opencl_kernel::{
    get_deeksha_kernel_source, get_deeksha_lite_fire_kernel_source, get_deeksha_lite_kernel_source,
    has_ekam_deeksha_kernel, COSMIC_HARMONY_DEEKSHA_KERNEL, DEEKSHA_LITE_FIRE_KERNEL,
    DEEKSHA_LITE_KERNEL, EKAM_DEEKSHA_KERNEL_NAME,
};
pub use ncl_integration::{
    AITaskType, CH3RevenueModel, ConsciousnessLevel, NCLBonusCalculator, NCLIntegration,
    NCLScheduler, NPURuntime,
};
pub use profit_router::{
    fallback_estimates, fetch_live_profit_estimates, fetch_live_profit_estimates_with_nicehash,
    select_best_coin, CoinProfile, ExternalCoin,
    ProfitEntry, StratumProtocol,
};
pub use revenue::{
    NclStats, RevenueCollector, RevenueEvent, RevenueHealth, RevenueSource, RevenueStats,
    BLAKE3_EXTERNAL_FEE, CIRCUIT_BREAKER_RESET_SECS, CIRCUIT_BREAKER_THRESHOLD, MERGED_MINING_FEE,
    MIN_ZION_ALLOCATION, MULTI_ALGO_ALLOCATION, NCL_ALLOCATION, NCL_FEE, PROFIT_SWITCH_FEE,
    ZION_ALLOCATION, ZION_HUMANITARIAN_PCT, ZION_ISSOBELLA_PCT, ZION_MINER_PCT, ZION_POOL_PCT,
};
pub use revenue_journal::{
    JournalEntry, JournalPayload, ReplayedEvent, ReplayedZionBlock, RevenueJournal,
};
pub use scratchpad_ekam::memory_hard_transform_ekam_light_v2_sha3;
pub use stream_layers::{
    cosmic_harmony_ekam_deeksha_v2_with_streams, cosmic_harmony_ekam_deeksha_with_streams,
    deeksha_lite_fire_with_streams, deeksha_lite_v1_with_streams, DeekshaStep,
    DeekshaStreamTelemetry,
};

pub const POW_PROFILE: &str = "deeksha_lite_v1";
pub const CHV3_PROFILE: &str = "deeksha_chv3";
pub const FIRE_PROFILE: &str = "deeksha_lite_fire";

/// Block height at which `deeksha_chv3` becomes the canonical profile.
///
/// Phase A: `deeksha_chv3` is a bit-identical alias over `deeksha_lite_v1`,
/// so this is a soft fork — no consensus change, no chain disruption.
/// Miners advertising `deeksha_lite_v1` continue to work; the node accepts
/// both names because `hash_with_algorithm` maps them to the same function.
pub const CHV3_FORK_HEIGHT: u64 = 4500;

/// Block height at which `deeksha_lite_fire` becomes the canonical profile.
pub const FIRE_FORK_HEIGHT: u64 = 5000;

/// Static canonical profile name (used for status/banner display).
/// For height-aware dispatch use [`profile_name_for_height`].
pub fn profile_name() -> &'static str {
    POW_PROFILE
}

/// Height-aware canonical profile name.
///
/// - height < 4500  → `deeksha_lite_v1` (current mainnet canonical)
/// - 4500 ≤ h < 5000 → `deeksha_chv3` (unified alias, Phase A)
/// - height ≥ 5000  → `deeksha_lite_fire` (Fire hard fork)
///
/// NOTE: The pool (`V3/L1/pool/src/lib.rs`) intentionally always advertises
/// `deeksha_lite_v1` to miners after the 2026-07-13 chain-stall fix. The alias
/// is bit-identical, so this internal name change is safe, but the pool override
/// prevents older miner/CLI versions from seeing an unexpected algorithm name.
pub fn profile_name_for_height(height: u64) -> &'static str {
    if height >= FIRE_FORK_HEIGHT {
        FIRE_PROFILE
    } else if height >= CHV3_FORK_HEIGHT {
        CHV3_PROFILE
    } else {
        POW_PROFILE
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn profile_is_set() {
        assert_eq!(profile_name(), "deeksha_lite_v1");
    }

    #[test]
    fn profile_for_height_pre_chv3() {
        assert_eq!(profile_name_for_height(0), "deeksha_lite_v1");
        assert_eq!(profile_name_for_height(4499), "deeksha_lite_v1");
    }

    #[test]
    fn profile_for_height_chv3_active() {
        assert_eq!(profile_name_for_height(4500), "deeksha_chv3");
        assert_eq!(profile_name_for_height(4999), "deeksha_chv3");
    }

    #[test]
    fn profile_for_height_fire_active() {
        assert_eq!(profile_name_for_height(5000), "deeksha_lite_fire");
        assert_eq!(profile_name_for_height(9999), "deeksha_lite_fire");
    }

    #[test]
    fn chv3_fork_height_is_4500() {
        assert_eq!(CHV3_FORK_HEIGHT, 4500);
    }

    // ── Phase D: Name unification tests ──────────────────────────────

    /// Phase D: chv3 is the canonical name for height >= 4500.
    /// Old name (deeksha_lite_v1) is used below 4500 for backward compat.
    #[test]
    fn chv3_is_canonical_at_fork_height() {
        assert_eq!(profile_name_for_height(4500), CHV3_PROFILE);
        assert_eq!(profile_name_for_height(4999), CHV3_PROFILE);
    }

    /// Phase D: Below CHV3_FORK_HEIGHT, the old name is still used.
    #[test]
    fn lite_v1_still_used_below_chv3_fork() {
        assert_eq!(profile_name_for_height(0), POW_PROFILE);
        assert_eq!(profile_name_for_height(4499), POW_PROFILE);
    }

    /// Phase D: CHV3_PROFILE and POW_PROFILE are distinct strings.
    #[test]
    fn chv3_and_lite_are_distinct_names() {
        assert_ne!(CHV3_PROFILE, POW_PROFILE);
        assert_eq!(CHV3_PROFILE, "deeksha_chv3");
        assert_eq!(POW_PROFILE, "deeksha_lite_v1");
    }
}
