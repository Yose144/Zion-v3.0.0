// ZION Desktop Dashboard — Tauri shell with embedded Python dashboard server
// The frontend is React; the Python dashboard (ZION_OS/dashboard/app.py) is
// bundled as a resource and started automatically so users do not need to
// run `python ZION_OS/dashboard/app.py` manually.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::path::PathBuf;
use tauri::Manager;
use tauri::path::BaseDirectory;
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;

/// Resolve the Python launcher that wraps app.py.
/// In a bundled app the dashboard directory is a Tauri resource; in dev it
/// is resolved relative to the project source tree.
fn resolve_dashboard_launcher(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    // 1. Bundled release build: $RESOURCE/dashboard/desktop_launcher.py
    if let Ok(resource_path) = app.path().resolve("dashboard/desktop_launcher.py", BaseDirectory::Resource) {
        if resource_path.exists() {
            return Ok(resource_path);
        }
    }

    // 2. Development fallback: src-tauri/../dashboard/desktop_launcher.py
    let src_tauri = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let fallback = src_tauri.join("../dashboard/desktop_launcher.py");
    fallback
        .canonicalize()
        .map_err(|e| format!("could not resolve dashboard launcher at {}: {}", fallback.display(), e))
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // ── Spawn embedded Python dashboard server ────────────────────────
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let launcher = match resolve_dashboard_launcher(&app_handle) {
                    Ok(p) => p,
                    Err(e) => {
                        eprintln!("[zion-desktop] {}", e);
                        return;
                    }
                };

                let runtime_dir = match app_handle.path().app_local_data_dir() {
                    Ok(dir) => dir,
                    Err(e) => {
                        eprintln!("[zion-desktop] could not resolve app data dir: {}", e);
                        return;
                    }
                };

                let runtime_dir_str = runtime_dir.to_string_lossy().into_owned();
                let launcher_str = launcher.to_string_lossy().into_owned();

                println!(
                    "[zion-desktop] starting embedded dashboard server: {} --runtime-dir {}",
                    launcher_str, runtime_dir_str
                );

                let (mut rx, child) = match app_handle
                    .shell()
                    .command("python3")
                    .args([&launcher_str, "--runtime-dir", &runtime_dir_str])
                    .env("PYTHONUNBUFFERED", "1")
                    .env("ZION_DESKTOP_EMBEDDED", "1")
                    .spawn()
                {
                    Ok(res) => res,
                    Err(e) => {
                        eprintln!("[zion-desktop] failed to spawn python3 dashboard: {}", e);
                        return;
                    }
                };

                while let Some(event) = rx.recv().await {
                    match event {
                        CommandEvent::Stdout(line) => {
                            println!("[dashboard] {}", String::from_utf8_lossy(&line));
                        }
                        CommandEvent::Stderr(line) => {
                            eprintln!("[dashboard] {}", String::from_utf8_lossy(&line));
                        }
                        CommandEvent::Terminated(payload) => {
                            println!("[zion-desktop] dashboard server terminated: {:?}", payload);
                            break;
                        }
                        _ => {}
                    }
                }

                let _ = child.kill();
            });

            // ── Tray menu ─────────────────────────────────────────────────────
            let quit_i = tauri::menu::MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let show_i = tauri::menu::MenuItem::with_id(app, "show", "Show Dashboard", true, None::<&str>)?;
            let menu = tauri::menu::Menu::with_items(app, &[&show_i, &quit_i])?;

            tauri::tray::TrayIconBuilder::new()
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
                    if let tauri::tray::TrayIconEvent::Click {
                        button: tauri::tray::MouseButton::Left,
                        button_state: tauri::tray::MouseButtonState::Up,
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
