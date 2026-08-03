use crate::types::ComputeBackend;

/// Pricing engine for NCL compute jobs.
pub struct PricingEngine {
    /// Base price per inference in ZION atomic units.
    pub base_price: u64,
    /// Multiplier per backend complexity.
    multipliers: Vec<(ComputeBackend, f64)>,
}

impl PricingEngine {
    pub fn new(base_price: u64) -> Self {
        Self {
            base_price,
            multipliers: vec![
                (ComputeBackend::Wasm, 0.5),
                (ComputeBackend::TfLite, 1.0),
                (ComputeBackend::OnnxRuntime, 1.5),
                (ComputeBackend::Custom, 2.0),
            ],
        }
    }

    pub fn with_defaults() -> Self {
        Self::new(10_000_000_000) // 0.01 ZION (V3: 12-decimal flowers)
    }

    /// Calculate price for a job based on backend and estimated compute units.
    pub fn calculate_price(&self, backend: ComputeBackend, compute_units: u64) -> u64 {
        let multiplier = self
            .multipliers
            .iter()
            .find(|(b, _)| *b == backend)
            .map(|(_, m)| *m)
            .unwrap_or(1.0);

        ((self.base_price as f64) * multiplier * (compute_units as f64)).max(1.0) as u64
    }

    /// NCL fee split: 10% protocol fee, 90% to worker.
    pub fn split_reward(&self, reward: u64) -> (u64, u64) {
        let protocol_fee = reward / 10; // 10%
        let worker_reward = reward - protocol_fee;
        (worker_reward, protocol_fee)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pricing_basic() {
        let engine = PricingEngine::with_defaults();
        let price = engine.calculate_price(ComputeBackend::OnnxRuntime, 1);
        assert_eq!(price, 15_000_000_000); // 10_000_000_000 * 1.5 * 1
    }

    #[test]
    fn test_pricing_wasm_cheaper() {
        let engine = PricingEngine::with_defaults();
        let wasm = engine.calculate_price(ComputeBackend::Wasm, 1);
        let onnx = engine.calculate_price(ComputeBackend::OnnxRuntime, 1);
        assert!(wasm < onnx);
    }

    #[test]
    fn test_pricing_scales_with_units() {
        let engine = PricingEngine::with_defaults();
        let p1 = engine.calculate_price(ComputeBackend::OnnxRuntime, 1);
        let p10 = engine.calculate_price(ComputeBackend::OnnxRuntime, 10);
        assert_eq!(p10, p1 * 10);
    }

    #[test]
    fn test_split_reward() {
        let engine = PricingEngine::with_defaults();
        let (worker, protocol) = engine.split_reward(1_000_000); // 1 ZION (6-decimal)
        assert_eq!(worker, 900_000);
        assert_eq!(protocol, 100_000);
    }

    #[test]
    fn test_split_reward_small() {
        let engine = PricingEngine::with_defaults();
        let (worker, protocol) = engine.split_reward(5);
        // 5 / 10 = 0 protocol, 5 worker
        assert_eq!(worker + protocol, 5);
    }
}
