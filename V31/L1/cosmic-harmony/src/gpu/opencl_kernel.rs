// Canonical PoW kernels for V3 mainnet.
// Four algorithms: Deeksha (full Ekam), Lite v1, Fire, Chv3 (unified canonical).
// Chv3 is a bit-identical alias of Lite v1 (Phase A/C unification).
pub const COSMIC_HARMONY_DEEKSHA_KERNEL: &str = include_str!("kernels/cosmic_harmony_deeksha.cl");
pub const DEEKSHA_LITE_KERNEL: &str = include_str!("kernels/deeksha_lite.cl");
pub const DEEKSHA_LITE_FIRE_KERNEL: &str = include_str!("kernels/deeksha_lite_fire.cl");
pub const DEEKSHA_CHV3_KERNEL: &str = include_str!("kernels/deeksha_chv3.cl");

pub const EKAM_DEEKSHA_KERNEL_NAME: &str = "ekam_deeksha_mine";
pub const EKAM_DEEKSHA_S4_KERNEL_NAME: &str = "ekam_deeksha_mine_s4";
pub const DEEKSHA_LITE_KERNEL_NAME: &str = "deeksha_lite_mine";
pub const DEEKSHA_LITE_FIRE_KERNEL_NAME: &str = "deeksha_lite_fire_mine";
pub const DEEKSHA_CHV3_KERNEL_NAME: &str = "deeksha_chv3_mine";

pub fn get_deeksha_kernel_source() -> &'static str {
    COSMIC_HARMONY_DEEKSHA_KERNEL
}

pub fn get_deeksha_lite_kernel_source() -> &'static str {
    DEEKSHA_LITE_KERNEL
}

pub fn get_deeksha_lite_fire_kernel_source() -> &'static str {
    DEEKSHA_LITE_FIRE_KERNEL
}

pub fn get_deeksha_chv3_kernel_source() -> &'static str {
    DEEKSHA_CHV3_KERNEL
}

pub fn has_ekam_deeksha_kernel() -> bool {
    COSMIC_HARMONY_DEEKSHA_KERNEL.contains(EKAM_DEEKSHA_KERNEL_NAME)
}

pub fn has_deeksha_chv3_kernel() -> bool {
    DEEKSHA_CHV3_KERNEL.contains(DEEKSHA_CHV3_KERNEL_NAME)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn deeksha_kernel_is_present() {
        assert!(COSMIC_HARMONY_DEEKSHA_KERNEL.contains("__kernel"));
        assert!(has_ekam_deeksha_kernel());
    }

    #[test]
    fn chv3_kernel_is_present() {
        assert!(DEEKSHA_CHV3_KERNEL.contains("__kernel"));
        assert!(has_deeksha_chv3_kernel());
    }

    #[test]
    fn chv3_kernel_name_matches() {
        assert!(DEEKSHA_CHV3_KERNEL.contains("deeksha_chv3_mine"));
    }

    #[test]
    fn chv3_kernel_has_same_constants_as_lite() {
        // Both kernels must have identical Ekam v2 scratchpad parameters for parity.
        assert!(DEEKSHA_CHV3_KERNEL.contains("SCRATCHPAD_SIZE  131072"));
        assert!(DEEKSHA_CHV3_KERNEL.contains("BLOCK_COUNT      4096"));
        assert!(DEEKSHA_CHV3_KERNEL.contains("PASSES           1"));
        assert!(DEEKSHA_CHV3_KERNEL.contains("RANDOM_READS     32"));
    }
}
