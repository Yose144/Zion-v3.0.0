use super::types::GpuTelemetry;
use std::path::{Path, PathBuf};
use tracing::{debug, trace};

const SYSFS_DRM_PATH: &str = "/sys/class/drm";

/// Detekuje všechna AMD GPU přes sysfs a vrátí jejich telemetry.
pub async fn collect_amd_telemetry() -> anyhow::Result<Vec<GpuTelemetry>> {
    let mut gpus = Vec::new();

    let drm_path = Path::new(SYSFS_DRM_PATH);
    if !drm_path.exists() {
        trace!("sysfs /sys/class/drm neexistuje — neni Linux nebo nenalozeny drivery");
        return Ok(gpus);
    }

    let mut entries = tokio::fs::read_dir(drm_path).await?;
    let mut index = 0u32;

    while let Ok(Some(entry)) = entries.next_entry().await {
        let name = entry.file_name();
        let name_str = name.to_string_lossy();

        // card0, card1, ... (ne card0-DP-1, atd.)
        if !name_str.starts_with("card") || name_str.contains("-") {
            continue;
        }

        let device_path = drm_path.join(&*name_str).join("device");
        if !device_path.exists() {
            continue;
        }

        // Kontrola vendor ID — AMD = 0x1002
        let vendor = read_sysfs_string(&device_path.join("vendor")).await;
        if vendor.as_deref() != Some("0x1002") {
            continue;
        }

        trace!("AMD GPU detekovano: {} -> {:?}", name_str, device_path);

        let mut gpu = GpuTelemetry::stub(index, &detect_gpu_name(&device_path).await, "AMD");
        gpu.pci_id = read_sysfs_string(&device_path.join("device"))
            .await
            .unwrap_or_default();

        // Najdi hwmon — může být hwmon0, hwmon1, ...
        let hwmon = find_hwmon(&device_path).await;

        if let Some(ref h) = hwmon {
            // Teplota (m°C → °C)
            gpu.temperature_core = read_sysfs_millidegrees(&h.join("temp1_input")).await;
            gpu.temperature_hotspot = read_sysfs_millidegrees(&h.join("temp2_input")).await;
            gpu.temperature_memory = read_sysfs_millidegrees(&h.join("temp3_input")).await;

            // Power (μW → W)
            gpu.power_watts = read_sysfs_microwatts(&h.join("power1_average")).await;
            gpu.power_limit_watts = read_sysfs_microwatts(&h.join("power1_cap")).await;

            // Fan (RPM)
            gpu.fan_rpm = read_sysfs_u32(&h.join("fan1_input")).await;

            // Fan duty (0-255 → 0-100%)
            if let Some(pwm) = read_sysfs_u32(&h.join("pwm1")).await {
                gpu.fan_percent = Some((pwm * 100 / 255) as u32);
            }
        }

        // GPU busy percent
        gpu.core_utilization = read_sysfs_u32(&device_path.join("gpu_busy_percent")).await;

        // Memory utilization (vram used / total)
        let vram_used = read_sysfs_u64(&device_path.join("mem_info_vram_used")).await;
        let vram_total = read_sysfs_u64(&device_path.join("mem_info_vram_total")).await;
        gpu.memory_used_mb = vram_used.map(|v| v / 1024 / 1024);
        gpu.memory_total_mb = vram_total.map(|v| v / 1024 / 1024);
        if let (Some(used), Some(total)) = (vram_used, vram_total) {
            if total > 0 {
                gpu.memory_utilization = Some(((used * 100) / total) as u32);
            }
        }

        // Clocks — z pp_dpm_sclk vytáhneme aktivní frekvenci
        gpu.core_clock_mhz = parse_active_clock_mhz(
            &read_sysfs_string(&device_path.join("pp_dpm_sclk")).await.unwrap_or_default()
        );
        gpu.memory_clock_mhz = parse_active_clock_mhz(
            &read_sysfs_string(&device_path.join("pp_dpm_mclk")).await.unwrap_or_default()
        );

        debug!(
            "AMD GPU {}: {} | {}°C | {}W | {}MHz | {}RPM",
            index,
            gpu.name,
            gpu.temperature_core.map_or("N/A".to_string(), |t| format!("{:.0}", t)),
            gpu.power_watts.map_or("N/A".to_string(), |p| format!("{:.1}", p)),
            gpu.core_clock_mhz.map_or("N/A".to_string(), |c| c.to_string()),
            gpu.fan_rpm.map_or("N/A".to_string(), |f| f.to_string()),
        );

        gpus.push(gpu);
        index += 1;
    }

    Ok(gpus)
}

// ── Helpers ───────────────────────────────────────────────

async fn detect_gpu_name(device_path: &Path) -> String {
    // Zkusit product_name (linux 5.15+)
    if let Some(name) = read_sysfs_string(&device_path.join("product_name")).await {
        return name.trim().to_string();
    }
    // Fallback: z /sys/class/drm/cardN/device/label
    if let Some(name) = read_sysfs_string(&device_path.join("label")).await {
        return name.trim().to_string();
    }
    // Fallback: z lspci (pokud běžíme s právy)
    if let Ok(output) = tokio::process::Command::new("lspci")
        .args(["-s", &format!("{}:0", device_path.file_name().unwrap_or_default().to_string_lossy()), "-nn"])
        .output()
        .await
    {
        let stdout = String::from_utf8_lossy(&output.stdout);
        if let Some(idx) = stdout.find(':') {
            return stdout[idx + 1..].trim().to_string();
        }
    }
    "AMD GPU".to_string()
}

async fn find_hwmon(device_path: &Path) -> Option<PathBuf> {
    let hwmon_dir = device_path.join("hwmon");
    if !hwmon_dir.exists() {
        return None;
    }
    let mut entries = match tokio::fs::read_dir(&hwmon_dir).await {
        Ok(e) => e,
        Err(_) => return None,
    };
    while let Ok(Some(entry)) = entries.next_entry().await {
        let path = entry.path();
        if path.is_dir() {
            return Some(path);
        }
    }
    None
}

async fn read_sysfs_string(path: &Path) -> Option<String> {
    match tokio::fs::read_to_string(path).await {
        Ok(s) => Some(s.trim().to_string()),
        Err(_) => None,
    }
}

async fn read_sysfs_u32(path: &Path) -> Option<u32> {
    read_sysfs_string(path).await?.parse().ok()
}

async fn read_sysfs_u64(path: &Path) -> Option<u64> {
    read_sysfs_string(path).await?.parse().ok()
}

async fn read_sysfs_millidegrees(path: &Path) -> Option<f32> {
    let raw = read_sysfs_string(path).await?;
    raw.parse::<u64>().ok().map(|v| v as f32 / 1000.0)
}

async fn read_sysfs_microwatts(path: &Path) -> Option<f32> {
    let raw = read_sysfs_string(path).await?;
    raw.parse::<u64>().ok().map(|v| v as f32 / 1_000_000.0)
}

fn parse_active_clock_mhz(dpm_output: &str) -> Option<u32> {
    // pp_dpm_sclk vypadá:
    // 0: 300Mhz *
    // 1: 600Mhz
    // ...
    // Najít řádek s '*' (aktivní stav) a extrahovat frekvenci
    for line in dpm_output.lines() {
        if line.contains('*') {
            // Extract number before 'Mhz' or 'MHz'
            if let Some(mhz_pos) = line.to_lowercase().find("mhz") {
                let prefix = &line[..mhz_pos];
                // Najít poslední číslo
                let num_str: String = prefix.chars().rev().take_while(|c| c.is_digit(10)).collect::<String>().chars().rev().collect();
                if let Ok(val) = num_str.parse::<u32>() {
                    return Some(val);
                }
            }
        }
    }
    None
}
