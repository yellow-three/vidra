#[cfg(target_os = "linux")]
pub mod appimage;
mod dependencies;
mod events;
mod process;

use events::ClipboardMonitor;
use serde_json::{json, Value};
use std::sync::Mutex;
use std::{fs, path::PathBuf};
use tauri::ipc::Channel;
use tauri::{AppHandle, Manager, State};
use tauri_plugin_fs::FsExt;

type CommandResult<T> = Result<T, String>;

struct AppState {
    clipboard_monitor: Mutex<ClipboardMonitor>,
    processes: process::ProcessManager,
}

fn app_data_dir(app: &AppHandle) -> CommandResult<PathBuf> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("App data dizini bulunamadi: {error}"))?;
    fs::create_dir_all(&dir).map_err(|error| format!("App data dizini olusturulamadi: {error}"))?;
    Ok(dir)
}

fn settings_path(app: &AppHandle) -> CommandResult<PathBuf> {
    Ok(app_data_dir(app)?.join("settings.json"))
}

fn read_settings_value(app: &AppHandle) -> CommandResult<Value> {
    let path = settings_path(app)?;
    if !path.exists() {
        return Ok(json!({}));
    }

    let raw = fs::read_to_string(&path).map_err(|error| format!("Ayarlar okunamadi: {error}"))?;
    serde_json::from_str(&raw).map_err(|error| format!("Ayarlar cozumlenemedi: {error}"))
}

fn write_settings_value(app: &AppHandle, settings: &Value) -> CommandResult<()> {
    let path = settings_path(app)?;
    let tmp = path.with_extension("json.tmp");
    let raw = serde_json::to_string_pretty(settings)
        .map_err(|error| format!("Ayarlar serilestirilemedi: {error}"))?;
    fs::write(&tmp, raw).map_err(|error| format!("Ayarlar yazilamadi: {error}"))?;
    fs::rename(&tmp, &path).map_err(|error| format!("Ayarlar kaydedilemedi: {error}"))?;
    Ok(())
}

/// Iptal edilen indirmelerin yarim dosyalarini frontend silebilsin diye
/// indirme klasoru calisma aninda fs kapsamina eklenir (sabit kapsam tum diski acardi).
fn allow_download_dir(app: &AppHandle) {
    let dir = read_settings_value(app)
        .ok()
        .and_then(|s| s.get("downloadDir").and_then(Value::as_str).map(PathBuf::from))
        .filter(|p| !p.as_os_str().is_empty())
        .or_else(|| app.path().download_dir().ok());
    if let Some(dir) = dir {
        let _ = app.fs_scope().allow_directory(&dir, true);
    }
}

/// Frontend `Database.load` ile ayni adi kullanir (src/features/history/db.ts).
const DB_URL: &str = "sqlite:youtube-downloader.db";

fn migrations() -> Vec<tauri_plugin_sql::Migration> {
    vec![tauri_plugin_sql::Migration {
        version: 1,
        description: "history",
        sql: include_str!("../migrations/001_history.sql"),
        kind: tauri_plugin_sql::MigrationKind::Up,
    }]
}

fn ok() -> Value {
    json!({ "success": true })
}

#[tauri::command]
fn get_settings(app: AppHandle) -> CommandResult<Value> {
    read_settings_value(&app)
}

#[tauri::command]
fn save_settings(app: AppHandle, settings: Value) -> CommandResult<Value> {
    let mut current = read_settings_value(&app)?;
    let current_obj = current
        .as_object_mut()
        .ok_or_else(|| "Ayar dosyasi nesne formatinda degil.".to_string())?;

    let next_obj = settings
        .as_object()
        .ok_or_else(|| "Kaydedilecek ayarlar nesne formatinda degil.".to_string())?;

    for (key, value) in next_obj {
        current_obj.insert(key.clone(), value.clone());
    }

    write_settings_value(&app, &current)?;
    allow_download_dir(&app);
    Ok(ok())
}

#[tauri::command]
fn get_download_folder(app: AppHandle) -> CommandResult<String> {
    let settings = read_settings_value(&app)?;
    if let Some(download_dir) = settings.get("downloadDir").and_then(Value::as_str) {
        return Ok(download_dir.to_string());
    }

    app.path()
        .download_dir()
        .map(|path| path.to_string_lossy().to_string())
        .map_err(|error| format!("Indirme dizini bulunamadi: {error}"))
}

#[tauri::command]
async fn select_download_folder(app: AppHandle) -> CommandResult<Value> {
    use tauri_plugin_dialog::DialogExt;

    let folder = app
        .dialog()
        .file()
        .blocking_pick_folder();

    match folder {
        Some(path) => {
            let path_str = path.to_string();
            let mut current = read_settings_value(&app)?;
            if let Some(obj) = current.as_object_mut() {
                obj.insert("downloadDir".to_string(), json!(path_str));
            }
            write_settings_value(&app, &current)?;
            allow_download_dir(&app);
            Ok(json!({ "success": true, "path": path_str }))
        }
        None => Ok(json!({ "success": false, "error": "Klasor secimi iptal edildi" })),
    }
}

/// Gecmis artik SQLite'ta (plugin-sql); settings.json'daki eski kayitlari frontend bir kez tasir.
#[tauri::command]
fn get_legacy_history(app: AppHandle) -> CommandResult<Vec<Value>> {
    let settings = read_settings_value(&app)?;
    Ok(settings
        .get("history")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default())
}

#[tauri::command]
fn clear_legacy_history(app: AppHandle) -> CommandResult<Value> {
    let mut settings = read_settings_value(&app)?;
    if let Some(obj) = settings.as_object_mut() {
        if obj.remove("history").is_some() {
            write_settings_value(&app, &settings)?;
        }
    }
    Ok(ok())
}

/// Dosyanin bulundugu klasoru sistemin dosya yoneticisinde acar.
fn reveal_file(file_path: &str) {
    #[cfg(target_os = "linux")]
    {
        let _ = std::process::Command::new("xdg-open")
            .arg(std::path::Path::new(file_path).parent().unwrap_or(std::path::Path::new(".")))
            .spawn();
    }
    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("open")
            .arg("-R")
            .arg(file_path)
            .spawn();
    }
    #[cfg(target_os = "windows")]
    {
        let _ = std::process::Command::new("explorer")
            .arg(format!("/select,{}", file_path))
            .spawn();
    }
}

#[tauri::command]
fn open_file_location(file_path: String) -> Value {
    reveal_file(&file_path);
    ok()
}

#[tauri::command]
fn start_clipboard_monitor(app: AppHandle, state: State<'_, AppState>) -> CommandResult<Value> {
    let mut monitor = state.clipboard_monitor.lock().map_err(|e| e.to_string())?;
    monitor.start(app);
    Ok(ok())
}

#[tauri::command]
fn stop_clipboard_monitor(state: State<'_, AppState>) -> CommandResult<Value> {
    let mut monitor = state.clipboard_monitor.lock().map_err(|e| e.to_string())?;
    monitor.stop();
    Ok(ok())
}

/// `program` mantiksal bir addir (yt-dlp, ffmpeg); webview'e keyfi
/// komut calistirma yetkisi vermemek icin yol Rust tarafinda cozulur.
#[tauri::command]
fn process_spawn(
    app: AppHandle,
    program: String,
    args: Vec<String>,
    on_event: Channel<process::ProcessEvent>,
    state: State<'_, AppState>,
) -> CommandResult<u32> {
    let path = dependencies::resolve_program(&app, &program)
        .ok_or_else(|| format!("{program} bulunamadi veya izin verilmiyor."))?;
    state.processes.spawn(&path, &args, move |event| {
        let _ = on_event.send(event);
    })
}

#[tauri::command]
fn process_kill(id: u32, state: State<'_, AppState>) -> bool {
    state.processes.kill(id)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(DB_URL, migrations())
                .build(),
        )
        .setup(|app| {
            allow_download_dir(app.handle());
            let handle = app.handle().clone();
            std::thread::spawn(move || dependencies::prune_stale_ytdlp(&handle));
            // Uygulama guncellemesi yalnizca masaustunde (Android APK'lari GitHub Releases'tan elle).
            #[cfg(desktop)]
            {
                app.handle().plugin(tauri_plugin_updater::Builder::new().build())?;
                app.handle().plugin(tauri_plugin_process::init())?;
            }
            Ok(())
        })
        .manage(AppState {
            clipboard_monitor: Mutex::new(ClipboardMonitor::new()),
            processes: process::ProcessManager::new(),
        })
        .invoke_handler(tauri::generate_handler![
            get_settings,
            save_settings,
            get_download_folder,
            select_download_folder,
            get_legacy_history,
            clear_legacy_history,
            open_file_location,
            start_clipboard_monitor,
            stop_clipboard_monitor,
            process_spawn,
            process_kill,
            dependencies::check_dependencies,
            dependencies::update_ytdlp,
            dependencies::get_ytdlp_version,
            dependencies::get_platform,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
