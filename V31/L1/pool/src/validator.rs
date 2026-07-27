use zion_cosmic_harmony::{EkamDeeksha, ExternalCoin, PowAlgorithm};
use zion_miner::auxpow::hasher::{hash_for_coin, meets_target};

#[derive(Clone, Copy, Debug, Default)]
pub struct ShareValidator {
    ekam: EkamDeeksha,
}

impl ShareValidator {
    pub fn new() -> Self {
        Self {
            ekam: EkamDeeksha::new(),
        }
    }

    pub fn validate_zion(&self, header: &[u8], nonce: u64, target: &[u8; 32]) -> bool {
        meets_target(self.zion_hash(header, nonce).as_bytes(), target)
    }

    pub fn zion_hash(&self, header: &[u8], nonce: u64) -> zion_l1_types::Hash {
        self.ekam.hash(header, nonce)
    }

    pub fn validate_auxpow(
        &self,
        coin: ExternalCoin,
        header: &[u8],
        nonce: u64,
        target: &[u8; 32],
    ) -> bool {
        meets_target(&self.auxpow_hash(coin, header, nonce), target)
    }

    pub fn auxpow_hash(&self, coin: ExternalCoin, header: &[u8], nonce: u64) -> [u8; 32] {
        hash_for_coin(coin, header, nonce)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn zion_valid_with_max_target() {
        let v = ShareValidator::new();
        let target = [0xFFu8; 32];
        assert!(v.validate_zion(b"test_header", 0, &target));
    }

    #[test]
    fn zion_invalid_with_zero_target() {
        let v = ShareValidator::new();
        let target = [0x00u8; 32];
        assert!(!v.validate_zion(b"test_header", 0, &target));
    }

    #[test]
    fn auxpow_valid_with_max_target() {
        let v = ShareValidator::new();
        let target = [0xFFu8; 32];
        assert!(v.validate_auxpow(ExternalCoin::Bitcoin, b"aux_header", 0, &target));
    }

    #[test]
    fn auxpow_invalid_with_zero_target() {
        let v = ShareValidator::new();
        let target = [0x00u8; 32];
        assert!(!v.validate_auxpow(ExternalCoin::Bitcoin, b"aux_header", 0, &target));
    }
}
