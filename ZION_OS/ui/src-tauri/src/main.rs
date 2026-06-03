// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod hardware;
mod tray;

use std::process::Command;
use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use hardware::HardwareMetrics;

#[derive(Debug, Serialize, Deserialize, Clone)]
struct ServiceStatus {
    name: String,
    layer: String,
    state: String,
    pid: Option<u32>,
    auto_restart: bool,
    ports: HashMap<String, u32>,
    description: String,
}

#[derive(Debug, Serialize)]
struct OrchestratorStatus {
    timestamp: String,
    services: Vec<ServiceStatus>,
}

/// Load manifest.yaml and parse service definitions
fn load_manifest_services() -> Vec<ServiceStatus> {
    let manifest_path = std::env::current_dir()
        .unwrap_or_default()
        .join("../../../ZION_OS/orchestrator/manifest.yaml");

    let content = match std::fs::read_to_string(&manifest_path) {
        Ok(c) => c,
        Err(_) => return vec![],
    };

    let yaml: serde_yaml::Value = match serde_yaml::from_str(&content) {
        Ok(y) => y,
        Err(_) => return vec![],
    };

    let services = yaml.get("services").and_then(|s| s.as_mapping()).unwrap_or(&serde_yaml::Mapping::new()).clone();

    services
        .iter()
        .filter_map(|(name, cfg)| {
            let name_str = name.as_str()?.to_string();
            let layer = cfg.get("layer")?.as_str()?.to_string();
            let description = cfg.get("description")?.as_str()?.to_string();
            let auto_restart = cfg.get("auto_restart")?.as_bool().unwrap_or(false);

            let ports: HashMap<String, u32> = cfg
                .get("ports")
                .and_then(|p| p.as_mapping())
                .map(|m| {
                    m.iter()
                        .filter_map(|(k, v)| {
                            Some((k.as_str()?.to_string(), v.as_u64()? as u32))
                        })
                        .collect()
                })
                .unwrap_or_default();

            let binary = cfg.get("binary")?.as_str()?;
            let pid = find_pid(binary);
            let state = if pid.is_some() { "running".to_string() } else { "stopped".to_string() };

            Some(ServiceStatus {
                name: name_str,
                layer,
                state,
                pid,
                auto_restart,
                ports,
                description,
            })
        })
        .collect()
}

fn find_pid(pattern: &str) -> Option<u32> {
    if pattern.is_empty() || pattern == "python3" || pattern.starts_with("cargo") || pattern.starts_with("npm") {
        return None;
    }
    let output = Command::new("pgrep")
        .args(["-f", pattern])
        .output()
        .ok()?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        stdout.lines().next()?.trim().parse::<u32>().ok()
    } else {
        None
    }
}

#[tauri::command]
fn get_services() -> Vec<ServiceStatus> {
    load_manifest_services()
}

#[tauri::command]
fn get_orchestrator_status() -> OrchestratorStatus {
    let services = load_manifest_services();
    OrchestratorStatus {
        timestamp: chrono::Utc::now().to_rfc3339(),
        services,
    }
}

#[tauri::command]
async fn start_service(service: String) -> Result<String, String> {
    let manifest_path = std::env::current_dir()
        .unwrap_or_default()
        .join("../../../ZION_OS/orchestrator/manifest.yaml");

    let content = std::fs::read_to_string(&manifest_path).map_err(|e| e.to_string())?;
    let yaml: serde_yaml::Value = serde_yaml::from_str(&content).map_err(|e| e.to_string())?;

    let services = yaml.get("services").and_then(|s| s.as_mapping()).ok_or("No services")?;
    let cfg = services
        .get(&serde_yaml::Value::String(service.clone()))
        .and_then(|c| c.as_mapping())
        .ok_or("Service not found")?;

    let binary = cfg
        .get(&serde_yaml::Value::String("binary".to_string()))
        .and_then(|b| b.as_str())
        .unwrap_or("");

    if binary.is_empty() {
        return Err("No binary defined".to_string());
    }

    // Check if already running
    if find_pid(binary).is_some() {
        return Ok(format!("{} is already running", service));
    }

    // Start service (simplified - in production would use proper env/args)
    std::process::Command::new("sh")
        .arg("-c")
        .arg(&format!("{} > /tmp/{}.log 2>&1 &", binary, service))
        .spawn()
        .map_err(|e| e.to_string())?;

    Ok(format!("Started {}", service))
}

#[tauri::command]
async fn stop_service(service: String) -> Result<String, String> {
    let manifest_path = std::env::current_dir()
        .unwrap_or_default()
        .join("../../../ZION_OS/orchestrator/manifest.yaml");

    let content = std::fs::read_to_string(&manifest_path).map_err(|e| e.to_string())?;
    let yaml: serde_yaml::Value = serde_yaml::from_str(&content).map_err(|e| e.to_string())?;

    let services = yaml.get("services").and_then(|s| s.as_mapping()).ok_or("No services")?;
    let cfg = services
        .get(&serde_yaml::Value::String(service.clone()))
        .and_then(|c| c.as_mapping())
        .ok_or("Service not found")?;

    let binary = cfg
        .get(&serde_yaml::Value::String("binary".to_string()))
        .and_then(|b| b.as_str())
        .unwrap_or("");

    if binary.is_empty() {
        return Err("No binary defined".to_string());
    }

    Command::new("pkill")
        .args(["-f", binary])
        .output()
        .map_err(|e| e.to_string())?;

    Ok(format!("Stopped {}", service))
}

#[tauri::command]
async fn restart_service(service: String) -> Result<String, String> {
    stop_service(service.clone()).await.ok();
    std::thread::sleep(std::time::Duration::from_secs(2));
    start_service(service).await
}

#[tauri::command]
fn get_hardware_metrics_cmd() -> Option<HardwareMetrics> {
    hardware::get_hardware_metrics()
}

#[tauri::command]
fn get_system_info() -> serde_json::Value {
    serde_json::json!({
        "os": std::env::consts::OS,
        "arch": std::env::consts::ARCH,
        "version": "3.0.0"
    })
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            get_services,
            get_orchestrator_status,
            start_service,
            stop_service,
            restart_service,
            get_hardware_metrics_cmd,
            get_system_info
        ])
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();
            window.set_title("Zion OS — RTX Spark").ok();
            tray::setup_tray(app).ok();
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
