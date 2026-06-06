use crate::{GpuInfo, OcProfile};
use tracing::{info, warn};

pub async fn list_intel_gpus() -> anyhow::Result<Vec<GpuInfo>> {
    let mut gpus = vec![];

    match tokio::fs::read_dir("/sys/class/drm").await {
        Ok(mut entries) => {
            let mut idx = 0u32;
            while let Ok(Some(entry)) = entries.next_entry().await {
                let name = entry.file_name();
                let name_str = name.to_string_lossy();
                if name_str.starts_with("card") && !name_str.contains("-") {
                    let device_path = format!("/sys/class/drm/{}/device", name_str);
                    if let Ok(vendor) = tokio::fs::read_to_string(format!("{}/vendor", device_path)).await {
                        if vendor.trim() == "0x8086" { // Intel vendor ID
                            let model = tokio::fs::read_to_string(format!("{}/product_name", device_path)).await
                                .unwrap_or_else(|_| "Intel GPU".to_string());
                            gpus.push(GpuInfo {
                                index: idx,
                                name: model.trim().to_string(),
                                vendor: "Intel".to_string(),
                                memory_mb: 0, // TODO
                            });
                            idx += 1;
                        }
                    }
                }
            }
        }
        Err(e) => warn!("Nemohu cist /sys/class/drm: {}", e),
    }

    Ok(gpus)
}

pub async fn apply_oc(_profile: &OcProfile) -> anyhow::Result<()> {
    info!("Intel OC: Zatim neimplementovano");
    // Intel Arc OC je omezene, zatim placeholder
    Ok(())
}

pub async fn reset_oc() -> anyhow::Result<()> {
    info!("Intel OC: Reset (no-op)");
    Ok(())
}
