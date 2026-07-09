//! Deterministic INT8 Virtual Machine + RandomNPU program generator.
//!
//! This implements the "ZION NPU VM Spec" sketch from
//! `docs/NPU_HARDWARE_MINING_THEORY.md` §4.2, at prototype scale:
//!
//! - INT8 signed weights and activations.
//! - INT32 accumulator (no overflow for the small dims used here).
//! - Deterministic integer scale-down (arithmetic shift).
//! - Activation via 256-entry lookup table (per-epoch, seed-derived).
//! - `RandomNpuProgram`: random layer count / dims / activations per epoch,
//!   generated from a seed — the "RandomNPU" ASIC-resistance concept from
//!   §3 of the theory doc.
//!
//! **Scale note:** the theory doc targets ~2M MAC/hash for meaningful NPU
//! workload amortization. This prototype defaults to a much smaller scale
//! (~1-10K MAC) so that unit tests and CI run fast. The dimensions are
//! configurable via [`ProgramConfig`] for future scale-up experiments.

use blake3::Hasher;
use serde::{Deserialize, Serialize};

/// Fixed input/output width, matching the "64 bytes -> 64 bytes" NPU Mix
/// shape described in the theory doc.
pub const IO_DIM: usize = 64;

/// Deterministic xorshift64* PRNG seeded from a Blake3 digest.
/// Not cryptographically secure — only used to derive reproducible
/// "random" topology and weights from a canonical seed.
pub struct DeterministicRng {
    state: u64,
}

impl DeterministicRng {
    pub fn from_seed(seed: &[u8]) -> Self {
        let hash = blake3::hash(seed);
        let bytes = hash.as_bytes();
        let mut state = u64::from_le_bytes(bytes[0..8].try_into().unwrap());
        if state == 0 {
            state = 0x9E3779B97F4A7C15; // avoid degenerate all-zero state
        }
        Self { state }
    }

    pub fn next_u64(&mut self) -> u64 {
        // xorshift64*
        let mut x = self.state;
        x ^= x >> 12;
        x ^= x << 25;
        x ^= x >> 27;
        self.state = x;
        x.wrapping_mul(0x2545F4914F6CDD1D)
    }

    /// Uniform value in `[lo, hi)`.
    pub fn next_range(&mut self, lo: u32, hi: u32) -> u32 {
        debug_assert!(hi > lo);
        lo + (self.next_u64() % (hi - lo) as u64) as u32
    }

    pub fn next_i8(&mut self) -> i8 {
        (self.next_u64() % 256) as u8 as i8
    }
}

/// Supported activation kinds. Each is materialized into a 256-entry
/// INT8 -> INT8 lookup table so that execution never depends on
/// floating-point rounding.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Activation {
    Relu,
    Gelu,
    SiLU,
    HardSwish,
}

impl Activation {
    pub const ALL: [Activation; 4] = [
        Activation::Relu,
        Activation::Gelu,
        Activation::SiLU,
        Activation::HardSwish,
    ];

    pub fn from_index(idx: u32) -> Self {
        Self::ALL[idx as usize % Self::ALL.len()]
    }

    /// Build the canonical 256-entry lookup table for this activation.
    /// Uses simple integer approximations (see theory doc §4.2) so the
    /// same table is produced bit-exactly on any platform.
    pub fn build_table(&self) -> [i8; 256] {
        let mut table = [0i8; 256];
        for (i, slot) in table.iter_mut().enumerate() {
            let x = i as u8 as i8 as i32; // reinterpret 0..255 as -128..127
            let y = match self {
                Activation::Relu => x.max(0),
                // GELU/SiLU approximation: x * sigmoid(x) ~= x * (128 + x) >> 8
                // (matches the "2 instructions" approximation cited in the theory doc).
                Activation::Gelu | Activation::SiLU => (x * (128 + x)) >> 8,
                Activation::HardSwish => {
                    let relu6 = (x + 3).clamp(0, 6);
                    (x * relu6) / 6
                }
            };
            *slot = y.clamp(-128, 127) as i8;
        }
        table
    }
}

/// A single dense layer: `out = activation((W . x + b) >> shift)`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DenseLayer {
    pub in_dim: usize,
    pub out_dim: usize,
    /// Row-major weights: `out_dim` rows of `in_dim` INT8 values.
    pub weights: Vec<i8>,
    pub bias: Vec<i32>,
    pub shift: u8,
    pub activation: Activation,
}

impl DenseLayer {
    pub fn generate(rng: &mut DeterministicRng, in_dim: usize, out_dim: usize) -> Self {
        let mut weights = Vec::with_capacity(in_dim * out_dim);
        for _ in 0..(in_dim * out_dim) {
            weights.push(rng.next_i8());
        }
        let bias = (0..out_dim)
            .map(|_| rng.next_range(0, 16) as i32 - 8)
            .collect();
        let activation = Activation::from_index(rng.next_range(0, Activation::ALL.len() as u32));
        Self {
            in_dim,
            out_dim,
            weights,
            bias,
            shift: 6,
            activation,
        }
    }

    /// Number of multiply-accumulate operations in this layer.
    pub fn mac_ops(&self) -> u64 {
        (self.in_dim * self.out_dim) as u64
    }

    /// Deterministic forward pass.
    pub fn forward(&self, input: &[i8]) -> Vec<i8> {
        assert_eq!(input.len(), self.in_dim, "input dim mismatch");
        let table = self.activation.build_table();
        let mut out = Vec::with_capacity(self.out_dim);
        for o in 0..self.out_dim {
            let row = &self.weights[o * self.in_dim..(o + 1) * self.in_dim];
            let mut acc: i32 = self.bias[o];
            for (w, x) in row.iter().zip(input.iter()) {
                acc += (*w as i32) * (*x as i32);
            }
            // Arithmetic shift, round toward -infinity (matches theory doc spec).
            let scaled = acc >> self.shift;
            let clamped = scaled.clamp(-128, 127) as i8;
            let activated = table[clamped as u8 as usize];
            out.push(activated);
        }
        out
    }
}

/// A full RandomNPU program: a chain of dense layers whose shape and
/// weights are deterministically derived from `(seed, epoch)`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RandomNpuProgram {
    pub layers: Vec<DenseLayer>,
}

/// Configuration for program generation (dimension bounds, layer count).
/// Defaults are intentionally small for fast CI; see module docs.
#[derive(Debug, Clone, Copy)]
pub struct ProgramConfig {
    pub min_layers: u32,
    pub max_layers: u32,
    pub min_hidden_dim: u32,
    pub max_hidden_dim: u32,
}

impl Default for ProgramConfig {
    fn default() -> Self {
        Self {
            min_layers: 2,
            max_layers: 4,
            min_hidden_dim: 16,
            max_hidden_dim: 64,
        }
    }
}

impl RandomNpuProgram {
    /// Generate a deterministic program from `(seed, epoch)`.
    /// First layer's `in_dim` and last layer's `out_dim` are both
    /// [`IO_DIM`], matching the "64 bytes in, 64 bytes out" NPU Mix shape.
    pub fn generate(seed: [u8; 32], epoch: u64, config: ProgramConfig) -> Self {
        let mut hasher = Hasher::new();
        hasher.update(&seed);
        hasher.update(&epoch.to_le_bytes());
        let program_seed = *hasher.finalize().as_bytes();
        let mut rng = DeterministicRng::from_seed(&program_seed);

        let layer_count = rng.next_range(config.min_layers, config.max_layers + 1) as usize;
        let mut dims = Vec::with_capacity(layer_count + 1);
        dims.push(IO_DIM);
        for _ in 0..layer_count.saturating_sub(1) {
            dims.push(rng.next_range(config.min_hidden_dim, config.max_hidden_dim + 1) as usize);
        }
        dims.push(IO_DIM);

        let mut layers = Vec::with_capacity(layer_count);
        for i in 0..layer_count {
            layers.push(DenseLayer::generate(&mut rng, dims[i], dims[i + 1]));
        }

        Self { layers }
    }

    /// Total MAC operations for the whole program (workload sizing metric,
    /// see theory doc §3.4).
    pub fn total_mac_ops(&self) -> u64 {
        self.layers.iter().map(|l| l.mac_ops()).sum()
    }

    /// Run the program on a fixed-size input, returning a fixed-size output.
    pub fn run(&self, input: &[i8; IO_DIM]) -> [i8; IO_DIM] {
        let mut state: Vec<i8> = input.to_vec();
        for layer in &self.layers {
            state = layer.forward(&state);
        }
        let mut out = [0i8; IO_DIM];
        out.copy_from_slice(&state);
        out
    }

    /// Human-readable topology summary.
    pub fn describe(&self) -> String {
        let dims: Vec<String> = std::iter::once(self.layers[0].in_dim.to_string())
            .chain(self.layers.iter().map(|l| l.out_dim.to_string()))
            .collect();
        format!(
            "layers={} dims=[{}] mac_ops={}",
            self.layers.len(),
            dims.join("->"),
            self.total_mac_ops()
        )
    }
}

/// Expand arbitrary-length input bytes into a fixed [`IO_DIM`] INT8 vector
/// via a Blake3-based mixing step (keeps the VM's input width constant
/// regardless of upstream data size).
pub fn expand_input(model_hash: [u8; 32], data: &[u8]) -> [i8; IO_DIM] {
    let mut hasher = Hasher::new();
    hasher.update(&model_hash);
    hasher.update(data);
    let mut xof = hasher.finalize_xof();
    let mut buf = [0u8; IO_DIM];
    xof.fill(&mut buf);
    let mut out = [0i8; IO_DIM];
    for i in 0..IO_DIM {
        out[i] = buf[i] as i8;
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rng_is_deterministic() {
        let mut a = DeterministicRng::from_seed(b"hello");
        let mut b = DeterministicRng::from_seed(b"hello");
        for _ in 0..10 {
            assert_eq!(a.next_u64(), b.next_u64());
        }
    }

    #[test]
    fn program_generation_is_deterministic() {
        let seed = [1u8; 32];
        let p1 = RandomNpuProgram::generate(seed, 5, ProgramConfig::default());
        let p2 = RandomNpuProgram::generate(seed, 5, ProgramConfig::default());
        assert_eq!(p1, p2);
    }

    #[test]
    fn program_differs_across_epochs() {
        let seed = [1u8; 32];
        let p1 = RandomNpuProgram::generate(seed, 5, ProgramConfig::default());
        let p2 = RandomNpuProgram::generate(seed, 6, ProgramConfig::default());
        assert_ne!(p1, p2);
    }

    #[test]
    fn program_io_shape_is_fixed() {
        let seed = [2u8; 32];
        let program = RandomNpuProgram::generate(seed, 1, ProgramConfig::default());
        assert_eq!(program.layers.first().unwrap().in_dim, IO_DIM);
        assert_eq!(program.layers.last().unwrap().out_dim, IO_DIM);
    }

    #[test]
    fn run_is_deterministic() {
        let seed = [3u8; 32];
        let program = RandomNpuProgram::generate(seed, 9, ProgramConfig::default());
        let input = expand_input(seed, b"care-task-input");
        let out1 = program.run(&input);
        let out2 = program.run(&input);
        assert_eq!(out1, out2);
    }

    #[test]
    fn activation_tables_are_bounded() {
        for act in Activation::ALL {
            let table = act.build_table();
            for v in table {
                assert!((-128..=127).contains(&(v as i32)));
            }
        }
    }

    #[test]
    fn mac_ops_reported_for_prototype_scale() {
        let seed = [4u8; 32];
        let program = RandomNpuProgram::generate(seed, 1, ProgramConfig::default());
        // Prototype scale: expect somewhere in the low thousands to tens
        // of thousands of MAC ops (see module docs re: scale-down for CI).
        assert!(program.total_mac_ops() > 0);
        assert!(program.total_mac_ops() < 200_000);
    }
}
