pub mod amd;
pub mod nvidia;
pub mod types;

use types::GpuTelemetry;
use tracing::info;

/// Sběr telemetry ze všech dostupných GPU (AMD + NVIDIA).
/// Pokusí se detekovat všechny vendor a sloučit výsledky.
pub async fn collect_all() -> Vec<GpuTelemetry> {
    let mut all = Vec::new();

    // AMD — sysfs (Linux only, ale safe na Windows)
    match amd::collect_amd_telemetry().await {
        Ok(mut amd_gpus) => {
            info!("AMD GPU detekovano: {} karet", amd_gpus.len());
            all.append(&mut amd_gpus);
        }
        Err(e) => {
            tracing::debug!("AMD telemetry selhal: {}", e);
        }
    }

    // NVIDIA — NVML (pouze pokud je zkompilováno s feature "nvidia")
    #[cfg(feature = "nvidia")]
    {
        match nvidia::collect_nvidia_telemetry().await {
            Ok(mut nv_gpus) => {
                info!("NVIDIA GPU detekovano: {} karet", nv_gpus.len());
                all.append(&mut nv_gpus);
            }
            Err(e) => {
                tracing::debug!("NVIDIA telemetry selhal: {}", e);
            }
        }
    }

    all
}
