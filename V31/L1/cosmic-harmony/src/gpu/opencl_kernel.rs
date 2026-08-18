// Canonical Ekam Deeksha v3.2 OpenCL kernel for V31 mainnet.
//
// Ekam Deeksha v3.2: 512 KiB scratchpad, 2 AES passes, 128 random reads,
// Keccak-256 final. Bit-identical to the CPU `EkamDeeksha::hash_bytes`.
pub const EKAM_DEEKSHA_KERNEL: &str = include_str!("kernels/ekam_deeksha.cl");

pub const EKAM_DEEKSHA_KERNEL_NAME: &str = "ekam_deeksha_mine";

pub fn get_ekam_deeksha_kernel_source() -> &'static str {
    EKAM_DEEKSHA_KERNEL
}

pub fn has_ekam_deeksha_kernel() -> bool {
    EKAM_DEEKSHA_KERNEL.contains(EKAM_DEEKSHA_KERNEL_NAME)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ekam_deeksha_kernel_is_present() {
        assert!(EKAM_DEEKSHA_KERNEL.contains("__kernel"));
        assert!(has_ekam_deeksha_kernel());
    }

    #[test]
    fn ekam_deeksha_kernel_has_v32_constants() {
        // Canonical Ekam Deeksha v3.2 parameters (ASIC-hardened, bit-identical to CPU).
        assert!(EKAM_DEEKSHA_KERNEL.contains("SCRATCHPAD_SIZE  524288"));
        assert!(EKAM_DEEKSHA_KERNEL.contains("BLOCK_COUNT      16384"));
        assert!(EKAM_DEEKSHA_KERNEL.contains("PASSES           2"));
        assert!(EKAM_DEEKSHA_KERNEL.contains("RANDOM_READS     128"));
    }
}
