mod hook;
mod programs;

use tauri::{AppHandle, Manager, Size, LogicalSize};
use std::process::Command;
use programs::ProgramItem;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn set_window_size(app: AppHandle, width: f64, height: f64) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_size(Size::Logical(LogicalSize { width, height }));
    }
}

#[tauri::command]
fn get_programs_list() -> Vec<ProgramItem> {
    programs::get_all_programs()
}

#[tauri::command]
fn launch_action(id: &str) {
    match id {
        "update" => {
            let _ = Command::new("explorer").arg("ms-settings:windowsupdate").spawn();
        }
        "programs" => {
            let _ = Command::new("explorer").arg("shell:AppsFolder").spawn();
        }
        "documents" => {
            let _ = Command::new("explorer").spawn();
        }
        "settings" => {
            let _ = Command::new("explorer").arg("ms-settings:").spawn();
        }
        "find" => {
             let _ = Command::new("explorer").arg("search-ms:").spawn();
        }
        "help" => {
            let _ = Command::new("explorer").arg("ms-contact-support:").spawn();
        }
        "run" => {
            let _ = Command::new("powershell")
                .args(["-c", "(New-Object -ComObject Shell.Application).FileRun()"])
                .spawn();
        }
        "logoff" => {
             let _ = Command::new("shutdown").arg("/l").spawn();
        }
        "shutdown" => {
             let _ = Command::new("powershell")
                .args(["-c", "(New-Object -ComObject Shell.Application).ShutdownWindows()"])
                .spawn();
        }
        // Handle direct path launching
        path => {
             let _ = Command::new("explorer").arg(path).spawn();
        }
    }
}

#[tauri::command]
fn exit_app(app: AppHandle) {
    app.exit(0);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            #[cfg(desktop)]
            hook::setup_hook(app.handle());
            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet, exit_app, launch_action, get_programs_list, set_window_size])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
