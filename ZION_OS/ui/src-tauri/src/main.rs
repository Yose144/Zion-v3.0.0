// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn start_service(service: String) -> Result<String, String> {
    Ok(format!("Starting {}", service))
}

#[tauri::command]
async fn stop_service(service: String) -> Result<String, String> {
    Ok(format!("Stopping {}", service))
}

#[tauri::command]
async fn restart_service(service: String) -> Result<String, String> {
    Ok(format!("Restarting {}", service))
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
            greet,
            start_service,
            stop_service,
            restart_service,
            get_system_info
        ])
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();
            window.set_title("Zion OS — RTX Spark").ok();
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
