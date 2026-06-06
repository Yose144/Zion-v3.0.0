use crate::{GpuInfo, OcProfile};
use tracing::{info, warn};

pub async fn list_amd_gpus() -> anyhow::Result<Vec<GpuInfo>> {
    // AMD GPU detekce pres lspci nebo /sys/class/drm
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
                        if vendor.trim() == "0x1002" { // AMD vendor ID
                            let model = tokio::fs::read_to_string(format!("{}/product_name", device_path)).await
                                .unwrap_or_else(|_| "AMD GPU".to_string());
                            let mem = tokio::fs::read_to_string(format!("{}/mem_info_vram_total", device_path)).await
                                .unwrap_or_else(|_| "0".to_string());
                            let mem_mb = mem.trim().parse::<u64>().unwrap_or(0) / 1024 / 1024;

                            gpus.push(GpuInfo {
                                index: idx,
                                name: model.trim().to_string(),
                                vendor: "AMD".to_string(),
                                memory_mb: mem_mb,
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

pub async fn apply_oc(profile: &OcProfile) -> anyhow::Result<()> {
    info!("AMD OC: Aplikuji profil '{}'", profile.name);

    // ROCm SMI nebo sysfs tuning
    if let Some(core) = profile.core_clock_mhz {
        info!("  Core clock: {} MHz", core);
        // echo "s 0 {}" > /sys/class/drm/card0/device/pp_od_clk_voltage
    }
    if let Some(mem) = profile.memory_clock_mhz {
        info!("  Memory clock: {} MHz", mem);
    }
    if let Some(pl) = profile.power_limit_watts {
        info!("  Power limit: {} W", pl);
        // echo {} > /sys/class/drm/card0/device/hwmon/hwmon*/power1_cap
    }

    // Commit changes
    // echo "c" > /sys/class/drm/card0/device/pp_od_clk_voltage

    Ok(())
}

pub async fn reset_oc() -> anyhow::Result<()> {
    info!("AMD OC: Reset na default");
    // echo "r" > /sys/class/drm/card0/device/pp_od_clk_voltage
    Ok(())
}
