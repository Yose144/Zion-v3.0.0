pub mod algorithms_npu;
pub mod algorithms_opt;
pub mod deeksha;
pub mod gpu;
pub mod hic;
pub mod hugepages;
pub mod ncl_integration;
pub mod profit_router;
pub mod revenue;
pub mod scratchpad_ekam;
pub mod sha3_fast;

pub use algorithms_opt::{Hash32, Hash64, cosmic_harmony_with_height, meets_difficulty};
pub use deeksha::{
    cosmic_harmony_ekam_deeksha, cosmic_harmony_ekam_deeksha_v2,
    ekam_find_nonce, ekam_v2_find_nonce,
    ekam_self_test, ekam_v2_self_test,
    generate_ekam_test_vector, generate_ekam_v2_test_vector,
    init_npu, hash_bytes_with_npu,
    CHV_EKAM_FORK_HEIGHT, CHV_EKAM_V2_FORK_HEIGHT,
    EKAM_CANONICAL_TEST_VECTOR_HEX, EKAM_V2_CANONICAL_TEST_VECTOR_HEX,
    EKAM_FUSION_ROUNDS,
    EKAM_V2_SCRATCHPAD_SIZE, EKAM_V2_PASSES, EKAM_V2_RANDOM_READS,
};
pub use algorithms_npu::{
    npu_mixing_step, npu_mixing_step_epoch,
    epoch_from_height, epoch_seed, MlpTopology, NPU_EPOCH_LENGTH,
};
pub use gpu::opencl_kernel::{
    get_deeksha_kernel_source, has_ekam_deeksha_kernel, COSMIC_HARMONY_DEEKSHA_KERNEL,
    EKAM_DEEKSHA_KERNEL_NAME,
};
pub use ncl_integration::{
    AITaskType, CH3RevenueModel, ConsciousnessLevel, NCLBonusCalculator, NCLIntegration,
    NCLScheduler, NPURuntime,
};
pub use profit_router::{
    fallback_estimates, select_best_coin, CoinProfile, ExternalCoin, ProfitEntry,
    StratumProtocol,
};
pub use revenue::{
    RevenueCollector, RevenueEvent, RevenueSource, RevenueStats, BLAKE3_EXTERNAL_FEE,
    MERGED_MINING_FEE, MIN_ZION_ALLOCATION, MULTI_ALGO_ALLOCATION, NCL_ALLOCATION, NCL_FEE,
    PROFIT_SWITCH_FEE, ZION_ALLOCATION,
};

pub const POW_PROFILE: &str = "cosmic_harmony_ekam_deeksha_v2";

pub fn profile_name() -> &'static str {
    POW_PROFILE
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn profile_is_set() {
        assert_eq!(profile_name(), "cosmic_harmony_ekam_deeksha_v2");
    }
}
