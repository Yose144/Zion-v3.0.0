use crate::error::{NclError, NclResult};
use crate::types::ComputeBackend;

/// Backend execution interface.
/// Each backend handles model loading and inference differently.
pub trait BackendRunner: Send + Sync {
    fn name(&self) -> &str;
    fn backend_type(&self) -> ComputeBackend;
    fn is_available(&self) -> bool;

    /// Execute inference on a model with given input.
    fn run_inference(&self, model_path: &str, input: &[u8]) -> NclResult<Vec<u8>>;
}

/// ONNX Runtime backend (stub — requires onnxruntime crate).
pub struct OnnxBackend {
    available: bool,
}

impl Default for OnnxBackend {
    fn default() -> Self {
        Self::new()
    }
}

impl OnnxBackend {
    pub fn new() -> Self {
        // TODO: N-01 — Initialize ONNX Runtime
        Self { available: false }
    }
}

impl BackendRunner for OnnxBackend {
    fn name(&self) -> &str {
        "ONNX Runtime"
    }
    fn backend_type(&self) -> ComputeBackend {
        ComputeBackend::OnnxRuntime
    }
    fn is_available(&self) -> bool {
        self.available
    }

    fn run_inference(&self, _model_path: &str, _input: &[u8]) -> NclResult<Vec<u8>> {
        Err(NclError::UnsupportedBackend(
            "ONNX Runtime not initialized".into(),
        ))
    }
}

/// WASM sandbox backend.
pub struct WasmBackend {
    available: bool,
}

impl Default for WasmBackend {
    fn default() -> Self {
        Self::new()
    }
}

impl WasmBackend {
    pub fn new() -> Self {
        Self { available: false }
    }
}

impl BackendRunner for WasmBackend {
    fn name(&self) -> &str {
        "WASM Sandbox"
    }
    fn backend_type(&self) -> ComputeBackend {
        ComputeBackend::Wasm
    }
    fn is_available(&self) -> bool {
        self.available
    }

    fn run_inference(&self, _model_path: &str, _input: &[u8]) -> NclResult<Vec<u8>> {
        Err(NclError::UnsupportedBackend(
            "WASM backend not initialized".into(),
        ))
    }
}

/// TensorFlow Lite backend.
pub struct TfLiteBackend {
    available: bool,
}

impl Default for TfLiteBackend {
    fn default() -> Self {
        Self::new()
    }
}

impl TfLiteBackend {
    pub fn new() -> Self {
        Self { available: false }
    }
}

impl BackendRunner for TfLiteBackend {
    fn name(&self) -> &str {
        "TF Lite"
    }
    fn backend_type(&self) -> ComputeBackend {
        ComputeBackend::TfLite
    }
    fn is_available(&self) -> bool {
        self.available
    }

    fn run_inference(&self, _model_path: &str, _input: &[u8]) -> NclResult<Vec<u8>> {
        Err(NclError::UnsupportedBackend(
            "TF Lite backend not initialized".into(),
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_onnx_backend_stub() {
        let b = OnnxBackend::new();
        assert_eq!(b.name(), "ONNX Runtime");
        assert!(!b.is_available());
        assert!(b.run_inference("model.onnx", &[]).is_err());
    }

    #[test]
    fn test_wasm_backend_stub() {
        let b = WasmBackend::new();
        assert_eq!(b.backend_type(), ComputeBackend::Wasm);
        assert!(!b.is_available());
    }

    #[test]
    fn test_tflite_backend_stub() {
        let b = TfLiteBackend::new();
        assert_eq!(b.backend_type(), ComputeBackend::TfLite);
        assert!(!b.is_available());
    }
}
