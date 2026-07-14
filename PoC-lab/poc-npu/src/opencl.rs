//! OpenCL GPU backend — INT8 VM forward pass na GPU přes OpenCL.
//!
//! Tento backend spouští stejný `RandomNpuProgram` jako `CpuReferenceBackend`,
//! ale výpočet probíhá na GPU (AMD RX 5600 XT / RDNA1 / gfx1010 přes ROCm OpenCL).
//!
//! ## Klíčový experiment
//!
//! Circuit breaker ověří bit-exact shodu s CPU referencí. OpenCL garantuje
//! determinismus pro integer operace (char/short/int), takže výsledek by měl
//! být identický. Pokud není, zjistíme proč a upravíme specifikaci.
//!
//! ## Kernel design
//!
//! Jeden work-item per output neuron. Každý work-item:
//! 1. Spočítá dot product: `acc = bias[o] + Σ weights[o*in_dim + j] * input[j]`
//! 2. Arithmetic right shift: `scaled = acc >> shift`
//! 3. Clamp to [-128, 127]
//! 4. Activation lookup: `output[o] = LUT[clamped as u8]`
//!
//! Multi-layer: host kód spouští kernel sekvenčně per layer s ping-pong buffery.

use crate::vm::{expand_input, ProgramConfig, RandomNpuProgram, IO_DIM};
use crate::{NpuAttestation, NpuBackend, NpuError};
use ocl::{flags, Buffer, ProQue};

/// OpenCL kernel source — INT8 dense layer forward pass.
///
/// Používá explicitní arithmetic right shift pro zaručení bit-exact shody
/// s Rust's `i32 >> n` (které je vždy arithmetic shift).
const KERNEL_SRC: &str = r#"
__kernel void dense_forward(
    __global const char *weights,
    __global const int  *bias,
    __global const char *input,
    __global       char *output,
    __global const char *lut,
    int in_dim,
    int out_dim,
    int shift
) {
    int o = get_global_id(0);
    if (o >= out_dim) return;

    int acc = bias[o];
    for (int j = 0; j < in_dim; j++) {
        acc += (int)weights[o * in_dim + j] * (int)input[j];
    }

    // Explicit arithmetic right shift (matches Rust's i32 >> n).
    // OpenCL's >> on signed int is implementation-defined for negatives,
    // so we emulate it via unsigned shift + sign extension.
    int scaled;
    if (acc >= 0) {
        scaled = acc >> shift;
    } else {
        unsigned int uacc = (unsigned int)acc;
        unsigned int ushifted = uacc >> shift;
        if (shift > 0) {
            unsigned int mask = 0xFFFFFFFFu << (32 - shift);
            ushifted |= mask;
        }
        scaled = (int)ushifted;
    }

    // Clamp to INT8 range.
    int clamped = clamp(scaled, -128, 127);

    // Activation LUT: index by unsigned reinterpretation of the clamped value.
    output[o] = lut[(uchar)clamped];
}
"#;

/// OpenCL GPU backend pro INT8 VM inference.
///
/// Vytvoří OpenCL context na prvním dostupném GPU deviceu a zkompiluje
/// kernel pro dense layer forward pass. Každé `infer()` volání:
///
/// 1. Vygeneruje `RandomNpuProgram` z `model_hash` (stejný jako CPU reference).
/// 2. Expanduje input na `IO_DIM` INT8 vector.
/// 3. Pro každou vrstvu: upload weights/bias/LUT → run kernel → ping-pong output.
/// 4. Vrátí finální output + attestation.
pub struct OpenClBackend {
    pro_que: ProQue,
    config: ProgramConfig,
}

impl OpenClBackend {
    /// Vytvoří backend na prvním dostupném GPU deviceu.
    ///
    /// Vrací `NpuError::UnsupportedBackend` pokud žádné OpenCL GPU device
    /// není k dispozici. Žádný silent fallback — caller musí explicitně
    /// zpracovat nedostupnost GPU.
    pub fn new() -> Result<Self, NpuError> {
        Self::with_config(ProgramConfig::default())
    }

    pub fn with_config(config: ProgramConfig) -> Result<Self, NpuError> {
        let pro_que = ProQue::builder()
            .src(KERNEL_SRC)
            .device(flags::DEVICE_TYPE_GPU)
            .dims(1) // placeholder — actual dims set per-kernel via gws()
            .build()
            .map_err(|e| NpuError::UnsupportedBackend(format!("OpenCL init failed: {e}")))?;

        Ok(Self { pro_que, config })
    }

    /// Spustí RandomNPU program na GPU, vrací raw INT8 output.
    fn run_program(&self, program: &RandomNpuProgram, input: &[i8; IO_DIM]) -> Vec<u8> {
        let queue = self.pro_que.queue();

        // Allocate ping-pong buffers for intermediate activations.
        // Max layer dim determines buffer size.
        let max_dim = program
            .layers
            .iter()
            .map(|l| l.in_dim.max(l.out_dim))
            .max()
            .unwrap_or(IO_DIM)
            .max(IO_DIM);

        // Input/output buffers (ping-pong).
        let buf_a = Buffer::<i8>::builder()
            .queue(queue.clone())
            .flags(flags::MEM_READ_WRITE)
            .len(max_dim)
            .build()
            .expect("failed to create buf_a");

        let buf_b = Buffer::<i8>::builder()
            .queue(queue.clone())
            .flags(flags::MEM_READ_WRITE)
            .len(max_dim)
            .build()
            .expect("failed to create buf_b");

        // Write initial input to buf_a (padded with zeros).
        let mut input_padded = vec![0i8; max_dim];
        input_padded[..IO_DIM].copy_from_slice(input);
        buf_a.write(&input_padded).enq().expect("failed to write input");

        let mut current_in = &buf_a;
        let mut current_out = &buf_b;

        for layer in &program.layers {
            // Upload weights, bias, and LUT for this layer.
            let buf_weights = Buffer::<i8>::builder()
                .queue(queue.clone())
                .flags(flags::MEM_READ_ONLY)
                .len(layer.weights.len())
                .build()
                .expect("failed to create weights buffer");

            let buf_bias = Buffer::<i32>::builder()
                .queue(queue.clone())
                .flags(flags::MEM_READ_ONLY)
                .len(layer.bias.len())
                .build()
                .expect("failed to create bias buffer");

            let lut = layer.activation.build_table();
            let lut_vec: Vec<i8> = lut.to_vec();
            let buf_lut = Buffer::<i8>::builder()
                .queue(queue.clone())
                .flags(flags::MEM_READ_ONLY)
                .len(256)
                .build()
                .expect("failed to create LUT buffer");

            buf_weights.write(&layer.weights).enq().expect("failed to write weights");
            buf_bias.write(&layer.bias).enq().expect("failed to write bias");
            buf_lut.write(&lut_vec).enq().expect("failed to write LUT");

            // Create and enqueue kernel with out_dim work-items.
            let kernel = self
                .pro_que
                .kernel_builder("dense_forward")
                .arg(&buf_weights)
                .arg(&buf_bias)
                .arg(current_in)
                .arg(current_out)
                .arg(&buf_lut)
                .arg(layer.in_dim as i32)
                .arg(layer.out_dim as i32)
                .arg(layer.shift as i32)
                .gws(layer.out_dim)
                .build()
                .expect("failed to build kernel");

            unsafe {
                kernel.enq().expect("failed to enqueue kernel");
            }

            // Swap ping-pong buffers.
            let tmp = current_in;
            current_in = current_out;
            current_out = tmp;
        }

        // Read result from current_in (which holds the last layer's output).
        let mut output_padded = vec![0i8; max_dim];
        current_in.read(&mut output_padded).enq().expect("failed to read output");

        // Extract first IO_DIM bytes.
        output_padded[..IO_DIM]
            .iter()
            .map(|&b| b as u8)
            .collect()
    }
}

impl NpuBackend for OpenClBackend {
    fn name(&self) -> &str {
        "opencl-gpu"
    }

    fn infer(&self, model_hash: crate::Hash, input: &[u8]) -> Result<(Vec<u8>, NpuAttestation), NpuError> {
        let program = RandomNpuProgram::generate(model_hash, 0, self.config);
        let vec_input = expand_input(model_hash, input);
        let output = self.run_program(&program, &vec_input);

        let att = NpuAttestation {
            backend: self.name().into(),
            quote_hash: *blake3::hash(&output).as_bytes(),
            runtime_version: env!("CARGO_PKG_VERSION").into(),
        };

        Ok((output, att))
    }

    /// Batch inference — GPU zpracuje všechny vstupy sekvenčně přes stejný
    /// program. V budoucnu lze optimalizovat na paralelní batch kernel
    /// (global_id(1) = batch index), ale pro laboratoř stačí sekvenční
    /// protože program se generuje jen jednou a reuseuje se.
    fn infer_batch(
        &self,
        model_hash: crate::Hash,
        inputs: &[Vec<u8>],
    ) -> Result<Vec<(Vec<u8>, NpuAttestation)>, NpuError> {
        // Generate program once, reuse for all inputs.
        let program = RandomNpuProgram::generate(model_hash, 0, self.config);

        let mut results = Vec::with_capacity(inputs.len());
        for input in inputs {
            let vec_input = expand_input(model_hash, input);
            let output = self.run_program(&program, &vec_input);
            let att = NpuAttestation {
                backend: self.name().into(),
                quote_hash: *blake3::hash(&output).as_bytes(),
                runtime_version: env!("CARGO_PKG_VERSION").into(),
            };
            results.push((output, att));
        }
        Ok(results)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{CircuitBreaker, CpuReferenceBackend, NpuBackend, RandomNpuGenerator};

    /// Helper: skip test if no OpenCL GPU is available.
    fn opencl_backend() -> Option<OpenClBackend> {
        OpenClBackend::new().ok()
    }

    #[test]
    fn opencl_device_available() {
        if opencl_backend().is_none() {
            eprintln!("SKIP: no OpenCL GPU device available");
            return;
        }
        // If we get here, a GPU was found.
    }

    #[test]
    fn opencl_output_matches_cpu_reference() {
        let gpu = match opencl_backend() {
            Some(g) => g,
            None => {
                eprintln!("SKIP: no OpenCL GPU device available");
                return;
            }
        };

        let model = RandomNpuGenerator::model_hash_for_epoch([42u8; 32], 0);
        let input = b"circuit-breaker-test";
        assert!(
            CircuitBreaker::check(&gpu, model, input).is_ok(),
            "GPU output must be bit-exact with CPU reference"
        );
    }

    #[test]
    fn opencl_deterministic_across_runs() {
        let gpu = match opencl_backend() {
            Some(g) => g,
            None => {
                eprintln!("SKIP: no OpenCL GPU device available");
                return;
            }
        };

        let model = [11u8; 32];
        let input = b"determinism-test";
        let (a, _) = gpu.infer(model, input).unwrap();
        let (b, _) = gpu.infer(model, input).unwrap();
        assert_eq!(a, b, "GPU output must be deterministic across runs");
        assert_eq!(a.len(), IO_DIM);
    }

    #[test]
    fn opencl_multi_layer_program() {
        let gpu = match opencl_backend() {
            Some(g) => g,
            None => {
                eprintln!("SKIP: no OpenCL GPU device available");
                return;
            }
        };

        // Use a config that guarantees multiple layers with larger dims.
        let config = ProgramConfig {
            min_layers: 3,
            max_layers: 5,
            min_hidden_dim: 32,
            max_hidden_dim: 128,
        };
        let gpu = match OpenClBackend::with_config(config) {
            Ok(g) => g,
            Err(e) => {
                eprintln!("SKIP: OpenClBackend::with_config failed: {e}");
                return;
            }
        };

        // Use CPU reference with the SAME config — CircuitBreaker::check uses
        // default config internally, so we compare manually here.
        let cpu = CpuReferenceBackend::with_config(config);
        let model = [22u8; 32];
        let input = b"multi-layer-test";
        let (gpu_out, _) = gpu.infer(model, input).unwrap();
        let (cpu_out, _) = cpu.infer(model, input).unwrap();
        assert_eq!(
            gpu_out, cpu_out,
            "Multi-layer program (larger dims) must match CPU reference (bit-exact)"
        );
    }

    #[test]
    fn opencl_all_activations() {
        let gpu = match opencl_backend() {
            Some(g) => g,
            None => {
                eprintln!("SKIP: no OpenCL GPU device available");
                return;
            }
        };

        // Test multiple epochs — each epoch generates a different program
        // with random activations, so testing several epochs covers all types.
        let seed = [33u8; 32];
        for epoch in 0..20u64 {
            let model = RandomNpuGenerator::model_hash_for_epoch(seed, epoch);
            let input = b"activation-test";
            assert!(
                CircuitBreaker::check(&gpu, model, input).is_ok(),
                "Epoch {} (activation variant) must match CPU reference",
                epoch
            );
        }
    }

    #[test]
    fn opencl_attestation_has_correct_backend_name() {
        let gpu = match opencl_backend() {
            Some(g) => g,
            None => {
                eprintln!("SKIP: no OpenCL GPU device available");
                return;
            }
        };

        let (_, att) = gpu.infer([44u8; 32], b"attestation-test").unwrap();
        assert_eq!(att.backend, "opencl-gpu");
    }

    #[test]
    fn opencl_output_length_is_io_dim() {
        let gpu = match opencl_backend() {
            Some(g) => g,
            None => {
                eprintln!("SKIP: no OpenCL GPU device available");
                return;
            }
        };

        let (output, _) = gpu.infer([55u8; 32], b"length-test").unwrap();
        assert_eq!(output.len(), IO_DIM);
    }

    #[test]
    fn opencl_matches_cpu_for_many_random_inputs() {
        let gpu = match opencl_backend() {
            Some(g) => g,
            None => {
                eprintln!("SKIP: no OpenCL GPU device available");
                return;
            }
        };

        let cpu = CpuReferenceBackend::new();
        let model = [66u8; 32];

        // Test 50 different inputs to stress-test bit-exactness.
        for i in 0..50u64 {
            let input = format!("stress-test-input-{i}");
            let (gpu_out, _) = gpu.infer(model, input.as_bytes()).unwrap();
            let (cpu_out, _) = cpu.infer(model, input.as_bytes()).unwrap();
            assert_eq!(
                gpu_out, cpu_out,
                "Input {i}: GPU output must match CPU reference (bit-exact)"
            );
        }
    }

    // ── Batch inference tests ──────────────────────────────────────────────

    #[test]
    fn opencl_batch_matches_cpu_batch() {
        let gpu = match opencl_backend() {
            Some(g) => g,
            None => {
                eprintln!("SKIP: no OpenCL GPU device available");
                return;
            }
        };

        let cpu = CpuReferenceBackend::new();
        let model = [70u8; 32];
        let inputs: Vec<Vec<u8>> = (0..20).map(|i| format!("gpu-batch-{i}").into_bytes()).collect();

        let gpu_results = gpu.infer_batch(model, &inputs).unwrap();
        let cpu_results = cpu.infer_batch(model, &inputs).unwrap();

        assert_eq!(gpu_results.len(), cpu_results.len());
        for (i, ((gpu_out, _), (cpu_out, _))) in gpu_results.iter().zip(cpu_results.iter()).enumerate() {
            assert_eq!(
                gpu_out, cpu_out,
                "batch[{i}]: GPU must match CPU reference (bit-exact)"
            );
        }
    }

    #[test]
    fn opencl_batch_empty_inputs() {
        let gpu = match opencl_backend() {
            Some(g) => g,
            None => {
                eprintln!("SKIP: no OpenCL GPU device available");
                return;
            }
        };

        let results = gpu.infer_batch([71u8; 32], &[]).unwrap();
        assert!(results.is_empty());
    }

    #[test]
    fn opencl_batch_deterministic() {
        let gpu = match opencl_backend() {
            Some(g) => g,
            None => {
                eprintln!("SKIP: no OpenCL GPU device available");
                return;
            }
        };

        let model = [72u8; 32];
        let inputs: Vec<Vec<u8>> = (0..10).map(|i| format!("det-gpu-batch-{i}").into_bytes()).collect();

        let results1 = gpu.infer_batch(model, &inputs).unwrap();
        let results2 = gpu.infer_batch(model, &inputs).unwrap();

        for (i, ((o1, _), (o2, _))) in results1.iter().zip(results2.iter()).enumerate() {
            assert_eq!(o1, o2, "batch[{i}] must be deterministic across runs");
        }
    }
}
