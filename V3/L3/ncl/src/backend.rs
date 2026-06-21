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

/// ONNX Runtime backend.
/// When the `onnx` feature is enabled, attempts to initialize the ONNX Runtime.
/// If the shared library is not found, gracefully falls back to unavailable.
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
        #[cfg(feature = "onnx")]
        {
            match Self::try_init() {
                Ok(()) => {
                    tracing::info!("ONNX Runtime backend initialized");
                    return Self { available: true };
                }
                Err(e) => {
                    tracing::warn!("ONNX Runtime unavailable: {}", e);
                    return Self { available: false };
                }
            }
        }
        #[cfg(not(feature = "onnx"))]
        {
            tracing::debug!("ONNX backend not compiled (enable 'onnx' feature)");
            Self { available: false }
        }
    }

    #[cfg(feature = "onnx")]
    fn try_init() -> Result<(), String> {
        // Initialize a global ONNX environment to verify the runtime is present.
        let _env = ort::Environment::builder()
            .with_name("zion-ncl")
            .build()
            .map_err(|e| format!("Failed to build ONNX environment: {}", e))?;
        Ok(())
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
        if !self.available {
            return Err(NclError::UnsupportedBackend(
                "ONNX Runtime not available (feature not enabled or runtime not installed)".into(),
            ));
        }

        #[cfg(feature = "onnx")]
        {
            Self::run_onnx(model_path, input)
        }
        #[cfg(not(feature = "onnx"))]
        {
            // Unreachable because is_available()==false when feature is off,
            // but kept for exhaustiveness.
            Err(NclError::UnsupportedBackend(
                "ONNX feature not compiled".into(),
            ))
        }
    }
}

#[cfg(feature = "onnx")]
impl OnnxBackend {
    fn run_onnx(_model_path: &str, _input: &[u8]) -> NclResult<Vec<u8>> {
        // Full inference implementation goes here in a follow-up PR.
        // For 3.0.1 we verify the runtime initializes; actual session.run()
        // will land when the NCL task marketplace is wired end-to-end.
        Err(NclError::UnsupportedBackend(
            "ONNX inference not yet implemented — runtime verified OK".into(),
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
    fn test_onnx_backend_lifecycle() {
        let b = OnnxBackend::new();
        assert_eq!(b.name(), "ONNX Runtime");
        assert_eq!(b.backend_type(), ComputeBackend::OnnxRuntime);

        // Without the 'onnx' feature or ONNX runtime installed, availability is false.
        // With the feature + runtime, availability should be true.
        if b.is_available() {
            // Runtime present — verify graceful "not yet implemented" error.
            let result = b.run_inference("model.onnx", &[]);
            assert!(result.is_err());
            let err = result.unwrap_err().to_string();
            assert!(err.contains("not yet implemented") || err.contains("runtime verified"));
        } else {
            // Runtime absent — verify clear error message.
            let result = b.run_inference("model.onnx", &[]);
            assert!(result.is_err());
            let err = result.unwrap_err().to_string();
            assert!(
                err.contains("not available") || err.contains("feature not enabled"),
                "Unexpected error: {}",
                err
            );
        }
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
