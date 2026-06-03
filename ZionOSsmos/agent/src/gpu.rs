//! GPU sensor collector — reads temperature, power, fan speed from system interfaces.
//!
//! Linux:  AMD → /sys/class/drm/card*/device/hwmon/hwmon*
//!         NVIDIA → nvidia-smi --query-gpu=...
//! Windows: NVIDIA → nvidia-smi, AMD → limited (needs ADL SDK)

use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct GpuSensors {
    pub name: String,
    pub vendor: String,
    pub vram_mb: u32,
    pub driver: String,
    pub temp_c: Option<f64>,
    pub power_w: Option<f64>,
    pub fan_pct: Option<u32>,
    pub core_mhz: Option<u32>,
    pub mem_mhz: Option<u32>,
}

/// Detect and read GPU sensors. Returns a list of GPUs found.
pub fn read_gpu_sensors() -> Vec<GpuSensors> {
    let mut gpus = Vec::new();

    // Try NVIDIA first (nvidia-smi works on both Linux and Windows)
    if let Some(nvidia) = read_nvidia_smi() {
        gpus.extend(nvidia);
    }

    // Try AMD sysfs (Linux only)
    #[cfg(target_os = "linux")]
    {
        if let Some(amd) = read_amd_sysfs() {
            gpus.extend(amd);
        }
    }

    gpus
}

fn read_nvidia_smi() -> Option<Vec<GpuSensors>> {
    let output = std::process::Command::new("nvidia-smi")
        .args([
            "--query-gpu=name,memory.total,temperature.gpu,power.draw,fan.speed,clocks.current.graphics,clocks.current.memory,driver_version",
            "--format=csv,noheader,nounits",
        ])
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let gpus: Vec<GpuSensors> = stdout
        .lines()
        .filter(|line| !line.trim().is_empty())
        .map(|line| {
            let parts: Vec<&str> = line.split(", ").collect();
            GpuSensors {
                name: parts.first().unwrap_or(&"NVIDIA GPU").trim().to_string(),
                vendor: "NVIDIA".into(),
                vram_mb: parts.get(1).and_then(|s| s.trim().parse().ok()).unwrap_or(0),
                driver: parts.get(7).unwrap_or(&"").trim().to_string(),
                temp_c: parts.get(2).and_then(|s| s.trim().parse().ok()),
                power_w: parts.get(3).and_then(|s| s.trim().parse().ok()),
                fan_pct: parts.get(4).and_then(|s| s.trim().parse().ok()),
                core_mhz: parts.get(5).and_then(|s| s.trim().parse().ok()),
                mem_mhz: parts.get(6).and_then(|s| s.trim().parse().ok()),
            }
        })
        .collect();

    if gpus.is_empty() { None } else { Some(gpus) }
}

#[cfg(target_os = "linux")]
fn read_amd_sysfs() -> Option<Vec<GpuSensors>> {
    use std::fs;
    use std::path::Path;

    let drm = Path::new("/sys/class/drm");
    if !drm.exists() {
        return None;
    }

    let mut gpus = Vec::new();

    for entry in fs::read_dir(drm).ok()? {
        let entry = entry.ok()?;
        let name = entry.file_name().to_string_lossy().to_string();
        if !name.starts_with("card") || name.contains('-') {
            continue;
        }

        let device = entry.path().join("device");
        let vendor_path = device.join("vendor");
        if let Ok(vendor) = fs::read_to_string(&vendor_path) {
            if vendor.trim() != "0x1002" {
                continue; // Not AMD
            }
        } else {
            continue;
        }

        // Find hwmon directory
        let hwmon_dir = device.join("hwmon");
        let hwmon = fs::read_dir(&hwmon_dir)
            .ok()?
            .filter_map(|e| e.ok())
            .next()?
            .path();

        let temp_c = read_sysfs_f64(&hwmon.join("temp1_input")).map(|v| v / 1000.0);
        let power_w = read_sysfs_f64(&hwmon.join("power1_average")).map(|v| v / 1_000_000.0);
        let fan_pct = {
            let pwm = read_sysfs_f64(&hwmon.join("pwm1"));
            pwm.map(|v| ((v / 255.0) * 100.0) as u32)
        };
        let core_mhz = read_sysfs_f64(&device.join("pp_dpm_sclk"))
            .or_else(|| read_current_clock(&device.join("pp_dpm_sclk")))
            .map(|v| v as u32);
        let mem_mhz = read_sysfs_f64(&device.join("pp_dpm_mclk"))
            .or_else(|| read_current_clock(&device.join("pp_dpm_mclk")))
            .map(|v| v as u32);

        // Try to get GPU name from marketing name or PCI product
        let gpu_name = fs::read_to_string(device.join("product_name"))
            .or_else(|_| fs::read_to_string(device.join("pp_features")))
            .unwrap_or_else(|_| format!("AMD GPU ({})", name));

        let vram_mb = read_sysfs_f64(&device.join("mem_info_vram_total"))
            .map(|v| (v / 1_048_576.0) as u32)
            .unwrap_or(0);

        gpus.push(GpuSensors {
            name: gpu_name.trim().to_string(),
            vendor: "AMD".into(),
            vram_mb,
            driver: "amdgpu".into(),
            temp_c,
            power_w,
            fan_pct,
            core_mhz,
            mem_mhz,
        });
    }

    if gpus.is_empty() { None } else { Some(gpus) }
}

#[cfg(target_os = "linux")]
fn read_sysfs_f64(path: &std::path::Path) -> Option<f64> {
    std::fs::read_to_string(path)
        .ok()?
        .trim()
        .parse()
        .ok()
}

#[cfg(target_os = "linux")]
fn read_current_clock(path: &std::path::Path) -> Option<f64> {
    // pp_dpm_sclk format: "0: 300Mhz\n1: 600Mhz *\n..."
    // The active clock has "*"
    let content = std::fs::read_to_string(path).ok()?;
    for line in content.lines() {
        if line.contains('*') {
            // Extract MHz value
            let mhz: Option<f64> = line
                .split_whitespace()
                .find(|s| s.ends_with("Mhz") || s.ends_with("MHz"))
                .and_then(|s| s.trim_end_matches(|c: char| !c.is_ascii_digit()).parse().ok());
            if let Some(v) = mhz {
                return Some(v);
            }
        }
    }
    None
}
