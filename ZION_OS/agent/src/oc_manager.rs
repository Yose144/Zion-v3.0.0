//! OC Manager — zápis overclocking/undervolting parametrů do AMD sysfs.
//!
//! Podporuje:
//!   - power1_cap (power limit v μW)
//!   - pp_dpm_sclk / pp_dpm_mclk (DPM stavy)
//!   - fan1_target (target RPM) / pwm1 (duty %)
//!   - power_dpm_force_performance_level (auto / low / high / manual)
//!
//! Bezpecnost: kontroluje, ze zapisovany soubor existuje a patri do /sys/class/drm.

use std::path::{Path, PathBuf};
use tracing::{error, info, warn};

/// OC profil pro jednu GPU nebo globalni.
#[derive(Debug, Clone, Default)]
pub struct OcProfile {
    pub name: String,
    /// Power limit ve Wattech (None = nechat default)
    pub power_limit_watts: Option<f32>,
    /// Target fan duty % (0-100)
    pub fan_target_percent: Option<u32>,
    /// Target fan RPM (alternativa k percent)
    pub fan_target_rpm: Option<u32>,
    /// DPM performance level: auto, low, high, manual
    pub performance_level: Option<String>,
    /// Max sclk DPM state (napr. "5" nebo "7")
    pub max_sclk_state: Option<String>,
    /// Max mclk DPM state
    pub max_mclk_state: Option<String>,
}

/// Aplikuje OC profil na vsechna AMD GPU.
pub async fn apply_profile(profile: &OcProfile) -> anyhow::Result<()> {
    info!("OC: Aplikuji profil '{}'", profile.name);

    let drm_path = Path::new("/sys/class/drm");
    if !drm_path.exists() {
        warn!("OC: /sys/class/drm neexistuje — preskakuji");
        return Ok(());
    }

    let mut entries = tokio::fs::read_dir(drm_path).await?;
    let mut applied = 0usize;

    while let Ok(Some(entry)) = entries.next_entry().await {
        let name = entry.file_name();
        let name_str = name.to_string_lossy();
        if !name_str.starts_with("card") || name_str.contains("-") {
            continue;
        }

        let device_path = drm_path.join(&*name_str).join("device");
        let vendor = read_sysfs_string(&device_path.join("vendor")).await;
        if vendor.as_deref() != Some("0x1002") {
            continue; // Jen AMD
        }

        if let Err(e) = apply_to_device(&device_path, profile).await {
            warn!("OC: Selhalo pro {}: {}", name_str, e);
        } else {
            applied += 1;
        }
    }

    info!("OC: Profil aplikovan na {} GPU", applied);
    Ok(())
}

async fn apply_to_device(
    device_path: &Path,
    profile: &OcProfile,
) -> anyhow::Result<()> {
    // 1. Performance level (auto/low/high/manual)
    if let Some(ref level) = profile.performance_level {
        let path = device_path.join("power_dpm_force_performance_level");
        write_sysfs_string(&path, level).await?;
    }

    // 2. Power limit (W → μW)
    if let Some(watts) = profile.power_limit_watts {
        let microwatts = (watts * 1_000_000.0) as u64;
        let path = device_path.join("hwmon").join("hwmon0").join("power1_cap");
        // Pokud hwmon0 neexistuje, zkusime najit jakejkoliv hwmon
        let path = if path.exists() {
            path
        } else {
            find_hwmon(device_path)
                .await
                .map(|h| h.join("power1_cap"))
                .unwrap_or(path)
        };
        write_sysfs_string(&path, &microwatts.to_string()).await?;
    }

    // 3. Fan target (RPM nebo %)
    if let Some(rpm) = profile.fan_target_rpm {
        let path = find_hwmon_file(device_path, "fan1_target").await;
        if let Some(p) = path {
            write_sysfs_string(&p, &rpm.to_string()).await?;
        }
    }
    if let Some(pct) = profile.fan_target_percent {
        let pwm = (pct * 255 / 100).min(255);
        let path = find_hwmon_file(device_path, "pwm1").await;
        if let Some(p) = path {
            write_sysfs_string(&p, &pwm.to_string()).await?;
        }
        // Prepnout fan mode na manual (0 = manual, 2 = automatic)
        if let Some(p) = find_hwmon_file(device_path, "pwm1_enable").await {
            write_sysfs_string(&p, "1").await?; // 1 = manual
        }
    }

    // 4. Max sclk DPM state
    if let Some(ref state) = profile.max_sclk_state {
        let path = device_path.join("pp_dpm_sclk");
        if path.exists() {
            // Format: "s 0 1 2 3 4 5" = povolit stavy 0-5
            // nebo "5" pro jeden stav
            write_sysfs_string(&path, state).await?;
        }
    }

    // 5. Max mclk DPM state
    if let Some(ref state) = profile.max_mclk_state {
        let path = device_path.join("pp_dpm_mclk");
        if path.exists() {
            write_sysfs_string(&path, state).await?;
        }
    }

    Ok(())
}

async fn find_hwmon(device_path: &Path) -> Option<PathBuf> {
    let hwmon_dir = device_path.join("hwmon");
    if !hwmon_dir.exists() {
        return None;
    }
    let mut entries = tokio::fs::read_dir(&hwmon_dir).await.ok()?;
    while let Ok(Some(entry)) = entries.next_entry().await {
        let path = entry.path();
        if path.is_dir() {
            return Some(path);
        }
    }
    None
}

async fn find_hwmon_file(device_path: &Path, filename: &str) -> Option<PathBuf> {
    if let Some(hwmon) = find_hwmon(device_path).await {
        let p = hwmon.join(filename);
        if p.exists() {
            return Some(p);
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

async fn write_sysfs_string(path: &Path, value: &str) -> anyhow::Result<()> {
    if !path.starts_with("/sys/class/drm") {
        anyhow::bail!("Refused to write outside /sys/class/drm: {:?}", path);
    }
    if !path.exists() {
        anyhow::bail!("sysfs path does not exist: {:?}", path);
    }
    tokio::fs::write(path, value).await?;
    info!("OC: Zapsano {:?} = {}", path, value);
    Ok(())
}

// ── Preset profily ─────────────────────────────────────────

pub fn preset_conservative() -> OcProfile {
    OcProfile {
        name: "conservative".to_string(),
        power_limit_watts: Some(120.0),
        fan_target_percent: Some(50),
        performance_level: Some("low".to_string()),
        ..Default::default()
    }
}

pub fn preset_balanced() -> OcProfile {
    OcProfile {
        name: "balanced".to_string(),
        power_limit_watts: Some(180.0),
        fan_target_percent: Some(65),
        performance_level: Some("auto".to_string()),
        ..Default::default()
    }
}

pub fn preset_max_performance() -> OcProfile {
    OcProfile {
        name: "max_perf".to_string(),
        power_limit_watts: Some(250.0),
        fan_target_percent: Some(85),
        performance_level: Some("high".to_string()),
        ..Default::default()
    }
}
