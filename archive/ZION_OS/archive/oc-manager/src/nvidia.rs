use crate::{GpuInfo, OcProfile};
use tracing::{info, warn};

#[cfg(feature = "nvidia")]
use nvml_wrapper::Nvml;

pub async fn list_nvidia_gpus() -> anyhow::Result<Vec<GpuInfo>> {
    let mut gpus = vec![];

    #[cfg(feature = "nvidia")]
    {
        match Nvml::init() {
            Ok(nvml) => {
                let count = nvml.device_count()?;
                for i in 0..count {
                    match nvml.device_by_index(i) {
                        Ok(device) => {
                            let name = device.name().unwrap_or_else(|_| "NVIDIA GPU".to_string());
                            let mem = device.memory_info().map(|m| m.total / 1024 / 1024).unwrap_or(0);
                            gpus.push(GpuInfo {
                                index: i,
                                name,
                                vendor: "NVIDIA".to_string(),
                                memory_mb: mem,
                            });
                        }
                        Err(e) => warn!("NVIDIA device {} error: {}", i, e),
                    }
                }
            }
            Err(e) => warn!("NVML init selhal: {}", e),
        }
    }

    Ok(gpus)
}

#[cfg(feature = "nvidia")]
pub async fn apply_oc(profile: &OcProfile) -> anyhow::Result<()> {
    info!("NVIDIA OC: Aplikuji profil '{}'", profile.name);

    let nvml = Nvml::init()?;
    let count = nvml.device_count()?;

    for i in 0..count {
        let device = nvml.device_by_index(i)?;

        if let Some(pl) = profile.power_limit_watts {
            let limit = (pl as u64) * 1000; // mW
            device.set_power_management_limit(limit)?;
            info!("  GPU {}: Power limit {} mW", i, limit);
        }

        // NVML nepodporuje primo core/memory clock via Rust wrapper jednoduse
        // Nutno pouzit nvidia-smi CLI
    }

    Ok(())
}

#[cfg(not(feature = "nvidia"))]
pub async fn apply_oc(_profile: &OcProfile) -> anyhow::Result<()> {
    warn!("NVIDIA podpora neni zkompilovana (feature 'nvidia')");
    Ok(())
}

#[cfg(feature = "nvidia")]
pub async fn reset_oc() -> anyhow::Result<()> {
    info!("NVIDIA OC: Reset na default");
    let nvml = Nvml::init()?;
    let count = nvml.device_count()?;
    for i in 0..count {
        let device = nvml.device_by_index(i)?;
        let default = device.power_management_limit_constraints()?.min;
        device.set_power_management_limit(default)?;
    }
    Ok(())
}

#[cfg(not(feature = "nvidia"))]
pub async fn reset_oc() -> anyhow::Result<()> {
    warn!("NVIDIA podpora neni zkompilovana");
    Ok(())
}
