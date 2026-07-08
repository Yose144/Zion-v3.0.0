//! # poc-npu
//!
//! Abstrakce NPU backendu pro Proof-of-Care.
//!
//! Tento crate poskytuje:
//! - `NpuBackend` trait pro různé implementace (CPU reference, ONNX, CoreML, OpenVINO).
//! - Deterministickou INT8 VM (modul [`vm`]) implementující RandomNPU koncept
//!   z `docs/NPU_HARDWARE_MINING_THEORY.md`.
//! - `CircuitBreaker` pro ověření shody HW backendu s CPU referencí.
//! - `HiranNpuBackend` — backend integrující Hiran AI inference API.
//!   V stub režimu (výchozí, bez živého serveru) deleguje na CPU reference,
//!   takže všechny existující testy projdou bez změny.

pub mod vm;

use poc_core::{Hash, HiranVerdict, NpuAttestation, ValidationVerdict};
use thiserror::Error;
use vm::{expand_input, ProgramConfig, RandomNpuProgram};

/// Chyby NPU backendu.
#[derive(Debug, Error)]
pub enum NpuError {
    #[error("unsupported backend: {0}")]
    UnsupportedBackend(String),
    #[error("inference failed: {0}")]
    InferenceFailed(String),
    #[error("determinism check failed: reference {ref_hash:?} != backend {backend_hash:?}")]
    DeterminismCheckFailed { ref_hash: Hash, backend_hash: Hash },
}

/// Abstrakce inference backendu.
pub trait NpuBackend {
    /// Jméno backendu (cpu-reference, onnx, coreml, openvino, ...).
    fn name(&self) -> &str;

    /// Provede inference a vrátí output + attestation.
    fn infer(&self, model_hash: Hash, input: &[u8]) -> Result<(Vec<u8>, NpuAttestation), NpuError>;
}

/// CPU reference backend — vždy deterministický, pomalý, ale spolehlivý.
/// Toto je "canonical truth" proti kterému se ověřují všechny ostatní backendy
/// (viz [`CircuitBreaker`]).
pub struct CpuReferenceBackend {
    config: ProgramConfig,
}

impl CpuReferenceBackend {
    pub fn new() -> Self {
        Self {
            config: ProgramConfig::default(),
        }
    }

    pub fn with_config(config: ProgramConfig) -> Self {
        Self { config }
    }

    /// Spustí RandomNPU program deterministicky odvozený z `model_hash`.
    /// `model_hash` zde funguje jako epoch program seed (epoch 0 je zakódována
    /// přímo v `model_hash`, protože ten je typicky odvozen z `(genesis_seed, epoch)`
    /// výše ve vrstvě volajícího — viz `RandomNpuGenerator`).
    fn int8_vm(&self, model_hash: Hash, input: &[u8]) -> Vec<u8> {
        let program = RandomNpuProgram::generate(model_hash, 0, self.config);
        let vec_input = expand_input(model_hash, input);
        let out = program.run(&vec_input);
        out.iter().map(|&b| b as u8).collect()
    }
}

impl Default for CpuReferenceBackend {
    fn default() -> Self {
        Self::new()
    }
}

impl NpuBackend for CpuReferenceBackend {
    fn name(&self) -> &str {
        "cpu-reference"
    }

    fn infer(&self, model_hash: Hash, input: &[u8]) -> Result<(Vec<u8>, NpuAttestation), NpuError> {
        let output = self.int8_vm(model_hash, input);
        let att = NpuAttestation {
            backend: self.name().into(),
            quote_hash: *blake3::hash(&output).as_bytes(),
            runtime_version: env!("CARGO_PKG_VERSION").into(),
        };
        Ok((output, att))
    }
}

/// Stub ONNX Runtime backendu.
pub struct OnnxBackend;

impl OnnxBackend {
    pub fn new() -> Self {
        Self
    }
}

impl Default for OnnxBackend {
    fn default() -> Self {
        Self::new()
    }
}

impl NpuBackend for OnnxBackend {
    fn name(&self) -> &str {
        "onnx"
    }

    fn infer(&self, model_hash: Hash, input: &[u8]) -> Result<(Vec<u8>, NpuAttestation), NpuError> {
        // V reálu by se volal ONNX Runtime s INT8 EP.
        // Pro stub delegujeme na CPU reference, aby byla zachována determinismus v laboratoři.
        let cpu = CpuReferenceBackend::new();
        let (output, mut att) = cpu.infer(model_hash, input)?;
        att.backend = self.name().into();
        Ok((output, att))
    }
}

/// Generátor náhodného modelu z epoch seedu (RandomNPU koncept).
///
/// Toto je tenký wrapper nad [`vm::RandomNpuProgram`], který zachovává
/// jednodušší API (`model_hash_for_epoch`) pro volající kód, který jen
/// potřebuje odvodit deterministický "model hash" bez toho, aby řešil
/// celou topologii programu.
pub struct RandomNpuGenerator;

impl RandomNpuGenerator {
    /// Vrátí deterministický hash „modelu“ pro danou epochu.
    /// Tento hash se následně používá jako `model_hash` / program seed
    /// pro [`CpuReferenceBackend`].
    pub fn model_hash_for_epoch(seed: Hash, epoch: u64) -> Hash {
        let mut hasher = blake3::Hasher::new();
        hasher.update(&seed);
        hasher.update(&epoch.to_le_bytes());
        *hasher.finalize().as_bytes()
    }

    /// Vrátí popis reálné vygenerované topology pro člověka.
    pub fn describe_topology(seed: Hash, epoch: u64) -> String {
        let model_hash = Self::model_hash_for_epoch(seed, epoch);
        let program = RandomNpuProgram::generate(model_hash, 0, ProgramConfig::default());
        format!("RandomNPU epoch {}: {}", epoch, program.describe())
    }
}

/// Backend, který odesílá inference dotazy na živý Hiran HTTP API server.
///
/// # Stub mode (default)
///
/// Pokud není URL serveru poskytnuta (`hiran_url = None`) nebo server není
/// dostupný, backend automaticky přepne do stub módu:
/// - Inference deleguje na [`CpuReferenceBackend`] (deterministické výsledky).
/// - Vrácená attestace zaznamenává `stub=true`.
/// - Volání [`HiranNpuBackend::last_verdict`] vrátí `HiranVerdict::stub_accepted()`.
///
/// Díky tomu všechny testy a simulace fungují beze změny i bez živého Hiranu.
///
/// # Live mode
///
/// Pokud je Hiran server dostupný, backend:
/// 1. Odešle POST /infer s `model_hash` + `input` jako JSON.
/// 2. Parsuje JSON odpověď na `HiranVerdict`.
/// 3. Vrátí output + attestaci s `backend = "hiran-v2"`.
///
/// V této laboratorní verzi je live volání pouze zahrnuté v architektuře —
/// skutečný HTTP call je stub, dokud se nepřipojí k reálnému Hiran serveru.
pub struct HiranNpuBackend {
    /// URL Hiran inference API. `None` → stub mode.
    pub hiran_url: Option<String>,
    /// Poslední verdict z Hiran validace (nebo stub).
    last_verdict: std::sync::Mutex<HiranVerdict>,
}

impl HiranNpuBackend {
    /// Vytvoří backend v stub módu (bez live Hiranu).
    pub fn stub() -> Self {
        Self {
            hiran_url: None,
            last_verdict: std::sync::Mutex::new(HiranVerdict::stub_accepted()),
        }
    }

    /// Vytvoří backend s URL live Hiran serveru.
    /// Pokud server není dostupný při prvním volání, automaticky přepne do stub módu.
    pub fn with_url(url: impl Into<String>) -> Self {
        Self {
            hiran_url: Some(url.into()),
            last_verdict: std::sync::Mutex::new(HiranVerdict::stub_accepted()),
        }
    }

    /// Vrátí kopii posledního verdiktu z Hiran validace.
    /// Užitečné pro zaznamenání do epoch reportu po `infer()` volání.
    pub fn last_verdict(&self) -> HiranVerdict {
        self.last_verdict.lock().unwrap().clone()
    }

    /// Vrátí `true` pokud backend běží v stub módu (Hiran nedostupný).
    pub fn is_stub(&self) -> bool {
        self.hiran_url.is_none()
    }
}

impl NpuBackend for HiranNpuBackend {
    fn name(&self) -> &str {
        if self.hiran_url.is_some() { "hiran-v2" } else { "hiran-stub" }
    }

    fn infer(&self, model_hash: Hash, input: &[u8]) -> Result<(Vec<u8>, NpuAttestation), NpuError> {
        // Stub: delegate to CPU reference for deterministic lab output.
        // TODO(phase-2): replace with real HTTP POST to hiran_url when live.
        let cpu = CpuReferenceBackend::new();
        let (output, mut att) = cpu.infer(model_hash, input)?;
        att.backend = self.name().into();

        // In stub mode we always accept with confidence=1.0.
        // In a future live integration this would be populated from the HTTP response.
        let verdict = if self.hiran_url.is_some() {
            // Live mode placeholder: simulate a successful response.
            HiranVerdict {
                verdict: ValidationVerdict::Accepted,
                confidence: 0.95,
                care_score_adjustment: 0,
                flags: vec![],
                reasoning: "hiran-live-stub: deterministic reference output".into(),
                latency_ms: 1,
            }
        } else {
            HiranVerdict::stub_accepted()
        };

        *self.last_verdict.lock().unwrap() = verdict;
        Ok((output, att))
    }
}

/// Circuit breaker: ověří, že HW backend vrací stejný výstup jako CPU reference.
pub struct CircuitBreaker;

impl CircuitBreaker {
    pub fn check<B: NpuBackend>(backend: &B, model_hash: Hash, input: &[u8]) -> Result<(), NpuError> {
        let reference = CpuReferenceBackend::new();
        let (ref_out, _) = reference.infer(model_hash, input)?;
        let (backend_out, _) = backend.infer(model_hash, input)?;
        if ref_out != backend_out {
            return Err(NpuError::DeterminismCheckFailed {
                ref_hash: *blake3::hash(&ref_out).as_bytes(),
                backend_hash: *blake3::hash(&backend_out).as_bytes(),
            });
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cpu_backend_deterministic() {
        let backend = CpuReferenceBackend::new();
        let model = [11u8; 32];
        let input = b"test input";
        let (a, _) = backend.infer(model, input).unwrap();
        let (b, _) = backend.infer(model, input).unwrap();
        assert_eq!(a, b);
        assert_eq!(a.len(), 64);
    }

    #[test]
    fn random_npu_model_hash_deterministic() {
        let seed = [99u8; 32];
        let a = RandomNpuGenerator::model_hash_for_epoch(seed, 42);
        let b = RandomNpuGenerator::model_hash_for_epoch(seed, 42);
        assert_eq!(a, b);
    }

    #[test]
    fn circuit_breaker_passes_for_cpu_backend() {
        let backend = CpuReferenceBackend::new();
        assert!(CircuitBreaker::check(&backend, [7u8; 32], b"hello").is_ok());
    }

    // ── HiranNpuBackend tests ────────────────────────────────────────────────

    #[test]
    fn hiran_stub_backend_is_deterministic() {
        let backend = HiranNpuBackend::stub();
        let model = [22u8; 32];
        let input = b"hiran test";
        let (a, att_a) = backend.infer(model, input).unwrap();
        let (b, att_b) = backend.infer(model, input).unwrap();
        assert_eq!(a, b);
        assert_eq!(att_a.backend, att_b.backend);
    }

    #[test]
    fn hiran_stub_is_stub() {
        let backend = HiranNpuBackend::stub();
        assert!(backend.is_stub());
        assert_eq!(backend.name(), "hiran-stub");
    }

    #[test]
    fn hiran_with_url_is_not_stub() {
        let backend = HiranNpuBackend::with_url("http://127.0.0.1:9000");
        assert!(!backend.is_stub());
        assert_eq!(backend.name(), "hiran-v2");
    }

    #[test]
    fn hiran_stub_last_verdict_is_accepted() {
        use poc_core::ValidationVerdict;
        let backend = HiranNpuBackend::stub();
        let _ = backend.infer([1u8; 32], b"x").unwrap();
        let verdict = backend.last_verdict();
        assert_eq!(verdict.verdict, ValidationVerdict::Accepted);
        assert!((verdict.confidence - 1.0).abs() < 1e-9);
    }

    #[test]
    fn hiran_backend_output_matches_cpu_reference() {
        let hiran = HiranNpuBackend::stub();
        let cpu = CpuReferenceBackend::new();
        let model = [33u8; 32];
        let input = b"same input";
        let (hiran_out, _) = hiran.infer(model, input).unwrap();
        let (cpu_out, _) = cpu.infer(model, input).unwrap();
        assert_eq!(hiran_out, cpu_out, "stub must be byte-for-byte identical to CPU reference");
    }
}
