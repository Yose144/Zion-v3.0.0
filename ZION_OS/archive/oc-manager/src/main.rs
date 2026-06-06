use serde::{Deserialize, Serialize};
use std::path::Path;
use tracing::{error, info, warn};

mod amd;
mod intel;
#[cfg(feature = "nvidia")]
mod nvidia;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OcProfile {
    pub name: String,
    pub description: String,
    pub gpu_vendor: String, // "amd" | "nvidia" | "intel"
    pub core_clock_mhz: Option<i32>,
    pub memory_clock_mhz: Option<i32>,
    pub power_limit_watts: Option<i32>,
    pub voltage_mv: Option<i32>,
    pub fan_percent: Option<u32>,
    pub temp_target: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GpuInfo {
    pub index: u32,
    pub name: String,
    pub vendor: String,
    pub memory_mb: u64,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::new("zion_oc=info"))
        .init();

    info!("=== ZION OC Manager v1.0.0 ===");

    let args: Vec<String> = std::env::args().collect();
    if args.len() < 2 {
        println!("Pouziti:");
        println!("  zion-oc-manager list                  — Vypise GPU");
        println!("  zion-oc-manager apply <profile.toml>  — Aplikuje OC profil");
        println!("  zion-oc-manager reset                 — Reset OC na default");
        println!("  zion-oc-manager auto                    — Auto-detect + apply balanced");
        return Ok(());
    }

    match args[1].as_str() {
        "list" => list_gpus().await?,
        "apply" => {
            if args.len() < 3 {
                eprintln!("Chybi cesta k profilu: zion-oc-manager apply <profile.toml>");
                std::process::exit(1);
            }
            apply_profile(&args[2]).await?;
        }
        "reset" => reset_all().await?,
        "auto" => auto_apply().await?,
        _ => {
            eprintln!("Neznamy prikaz: {}", args[1]);
            std::process::exit(1);
        }
    }

    Ok(())
}

async fn list_gpus() -> anyhow::Result<()> {
    info!("Detekuji GPU...");

    let mut gpus = vec![];

    // AMD
    match amd::list_amd_gpus().await {
        Ok(amd_gpus) => gpus.extend(amd_gpus),
        Err(e) => warn!("AMD GPU detekce selhala: {}", e),
    }

    // NVIDIA
    #[cfg(feature = "nvidia")]
    match nvidia::list_nvidia_gpus().await {
        Ok(nv_gpus) => gpus.extend(nv_gpus),
        Err(e) => warn!("NVIDIA GPU detekce selhala: {}", e),
    }

    // Intel
    match intel::list_intel_gpus().await {
        Ok(intel_gpus) => gpus.extend(intel_gpus),
        Err(e) => warn!("Intel GPU detekce selhala: {}", e),
    }

    if gpus.is_empty() {
        warn!("Zadne GPU nenalezeno!");
    } else {
        for gpu in &gpus {
            info!("  GPU {}: {} ({}, {} MB)", gpu.index, gpu.name, gpu.vendor, gpu.memory_mb);
        }
    }

    Ok(())
}

async fn apply_profile(path: &str) -> anyhow::Result<()> {
    info!("Nacitam OC profil z {}...", path);
    let content = tokio::fs::read_to_string(path).await?;
    let profile: OcProfile = toml::from_str(&content)?;

    info!("Aplikuji profil '{}' ({})...", profile.name, profile.gpu_vendor);

    match profile.gpu_vendor.as_str() {
        "amd" => amd::apply_oc(&profile).await?,
        #[cfg(feature = "nvidia")]
        "nvidia" => nvidia::apply_oc(&profile).await?,
        "intel" => intel::apply_oc(&profile).await?,
        _ => {
            error!("Nepodporovany vendor: {}", profile.gpu_vendor);
        }
    }

    info!("OC profil aplikovan.");
    Ok(())
}

async fn reset_all() -> anyhow::Result<()> {
    info!("Resetuji vsechna OC nastaveni...");
    amd::reset_oc().await.ok();
    #[cfg(feature = "nvidia")]
    nvidia::reset_oc().await.ok();
    intel::reset_oc().await.ok();
    info!("OC reset hotovo.");
    Ok(())
}

async fn auto_apply() -> anyhow::Result<()> {
    info!("Auto-detect + apply balanced OC...");

    let mut gpus = vec![];
    amd::list_amd_gpus().await.ok().map(|g| gpus.extend(g));
    #[cfg(feature = "nvidia")]
    nvidia::list_nvidia_gpus().await.ok().map(|g| gpus.extend(g));

    for gpu in &gpus {
        let profile = match gpu.vendor.as_str() {
            "AMD" => OcProfile {
                name: "AMD Balanced".to_string(),
                description: "Safe OC for AMD cards".to_string(),
                gpu_vendor: "amd".to_string(),
                core_clock_mhz: Some(1200),
                memory_clock_mhz: Some(900),
                power_limit_watts: Some(150),
                voltage_mv: Some(950),
                fan_percent: Some(50),
                temp_target: Some(70),
            },
            #[cfg(feature = "nvidia")]
            "NVIDIA" => OcProfile {
                name: "NVIDIA Balanced".to_string(),
                description: "Safe OC for NVIDIA cards".to_string(),
                gpu_vendor: "nvidia".to_string(),
                core_clock_mhz: Some(1500),
                memory_clock_mhz: Some(5000),
                power_limit_watts: Some(170),
                voltage_mv: None,
                fan_percent: Some(50),
                temp_target: Some(70),
            },
            _ => continue,
        };

        info!("Applying balanced to GPU {}: {}", gpu.index, gpu.name);
        // Apply per GPU
    }

    Ok(())
}
