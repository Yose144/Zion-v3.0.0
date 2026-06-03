// Prevents additional console window on Windows in release builds
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::Manager;
use std::time::Duration;

// ── Commands ──────────────────────────────────────────────

#[tauri::command]
fn probe_tcp(host: String, port: u16, timeout_ms: u64) -> Result<bool, String> {
    let addr = format!("{}:{}", host, port);
    let timeout = Duration::from_millis(timeout_ms);
    match std::net::TcpStream::connect_timeout(
        &addr.parse().map_err(|e| format!("{}", e))?,
        timeout,
    ) {
        Ok(_) => Ok(true),
        Err(_) => Ok(false),
    }
}

#[tauri::command]
fn rpc_call(
    url: String,
    method: String,
    params: Option<serde_json::Value>,
) -> Result<serde_json::Value, String> {
    let body = serde_json::json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": method,
        "params": params.unwrap_or(serde_json::Value::Null)
    });

    let response = ureq::post(&url)
        .set("Content-Type", "application/json")
        .timeout(Duration::from_secs(5))
        .send_json(body)
        .map_err(|e| format!("HTTP error: {}", e))?;

    let json: serde_json::Value = response.into_json().map_err(|e| format!("JSON error: {}", e))?;
    Ok(json)
}

#[tauri::command]
fn tail_log(path: String, lines: usize) -> Result<Vec<String>, String> {
    use std::fs::File;
    use std::io::{BufRead, BufReader};

    let file = File::open(&path).map_err(|e| format!("{}", e))?;
    let reader = BufReader::new(file);
    let all_lines: Vec<String> = reader.lines().filter_map(|l| l.ok()).collect();
    let start = all_lines.len().saturating_sub(lines);
    Ok(all_lines[start..].to_vec())
}

#[tauri::command]
fn run_command(cmd: String, args: Vec<String>) -> Result<String, String> {
    let output = std::process::Command::new(&cmd)
        .args(&args)
        .output()
        .map_err(|e| format!("{}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);

    if !output.status.success() {
        return Err(format!("exit {}: {}", output.status, stderr));
    }

    Ok(stdout.to_string())
}

// ── Service management ────────────────────────────────────

const DEFAULT_REPO_ROOT: &str = r"C:\Users\yosef\Desktop\Zion\2.9.6-main";

#[tauri::command]
fn start_local_backup(repo_root: Option<String>) -> Result<String, String> {
    let root = repo_root.unwrap_or_else(|| DEFAULT_REPO_ROOT.to_string());
    let script = format!(r"{}\scripts\launch-local-backup.ps1", root);

    let output = std::process::Command::new("powershell")
        .args(&["-ExecutionPolicy", "Bypass", "-File", &script])
        .output()
        .map_err(|e| format!("Failed to start: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);

    if !output.status.success() {
        return Err(format!("PowerShell exit {}: {} {}", output.status, stderr, stdout));
    }

    Ok(stdout.to_string())
}

#[tauri::command]
fn stop_local_backup(repo_root: Option<String>) -> Result<String, String> {
    let root = repo_root.unwrap_or_else(|| DEFAULT_REPO_ROOT.to_string());
    let script = format!(r"{}\scripts\stop-local-backup.ps1", root);

    let output = std::process::Command::new("powershell")
        .args(&["-ExecutionPolicy", "Bypass", "-File", &script])
        .output()
        .map_err(|e| format!("Failed to stop: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);

    if !output.status.success() {
        return Err(format!("PowerShell exit {}: {} {}", output.status, stderr, stdout));
    }

    Ok(stdout.to_string())
}

fn check_pid_file(path: &str) -> bool {
    let Ok(pid_str) = std::fs::read_to_string(path) else { return false };
    let Ok(pid) = pid_str.trim().parse::<u32>() else { return false };

    let output = std::process::Command::new("tasklist")
        .args(&["/FI", &format!("PID eq {}", pid), "/NH", "/FO", "CSV"])
        .output();

    match output {
        Ok(o) => {
            let out = String::from_utf8_lossy(&o.stdout);
            out.contains(&pid.to_string())
        }
        Err(_) => false,
    }
}

#[tauri::command]
fn get_local_backup_status(repo_root: Option<String>) -> Result<serde_json::Value, String> {
    let root = repo_root.unwrap_or_else(|| DEFAULT_REPO_ROOT.to_string());
    let pid_dir = format!(r"{}\.pids", root);

    let node_running = check_pid_file(&format!(r"{}\node1.pid", pid_dir));
    let miner_running = check_pid_file(&format!(r"{}\miner.pid", pid_dir));

    Ok(serde_json::json!({
        "node_running": node_running,
        "miner_running": miner_running,
    }))
}

// ── Main ──────────────────────────────────────────────────

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            probe_tcp,
            rpc_call,
            tail_log,
            run_command,
            start_local_backup,
            stop_local_backup,
            get_local_backup_status
        ])
        .setup(|app| {
            // Tray menu
            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let show_i = MenuItem::with_id(app, "show", "Show Dashboard", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .tooltip("ZION V3 Dashboard")
                .on_menu_event(|app, event| {
                    match event.id.as_ref() {
                        "quit" => {
                            app.exit(0);
                        }
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            // Hide on close instead of quitting
            let window = app.get_webview_window("main").unwrap();
            let window_clone = window.clone();
            window.on_window_event(move |event| {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = window_clone.hide();
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
