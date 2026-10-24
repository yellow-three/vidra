mod dependencies;
mod download;
mod events;

use events::ClipboardMonitor;
use serde_json::{json, Value};
use std::sync::Mutex;
use std::{fs, path::PathBuf};
use tauri::{AppHandle, Manager, State};

type CommandResult<T> = Result<T, String>;

struct AppState {
    clipboard_monitor: Mutex<ClipboardMonitor>,
    download_manager: download::DownloadManager,
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
            Ok(json!({ "success": true, "path": path_str }))
        }
        None => Ok(json!({ "success": false, "error": "Klasor secimi iptal edildi" })),
    }
}

#[tauri::command]
fn get_history(app: AppHandle) -> CommandResult<Vec<Value>> {
    let settings = read_settings_value(&app)?;
    Ok(settings
        .get("history")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default())
}

#[tauri::command]
fn clear_history(app: AppHandle) -> CommandResult<Value> {
    let mut settings = read_settings_value(&app)?;
    let settings_obj = settings
        .as_object_mut()
        .ok_or_else(|| "Ayar dosyasi nesne formatinda degil.".to_string())?;
    settings_obj.insert("history".to_string(), json!([]));
    write_settings_value(&app, &settings)?;
    Ok(ok())
}

#[tauri::command]
fn delete_history_item(app: AppHandle, id: String) -> CommandResult<Value> {
    let mut settings = read_settings_value(&app)?;
    let settings_obj = settings
        .as_object_mut()
        .ok_or_else(|| "Ayar dosyasi nesne formatinda degil.".to_string())?;

    let next_history = settings_obj
        .get("history")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default()
        .into_iter()
        .filter(|item| item.get("id").and_then(Value::as_str) != Some(id.as_str()))
        .collect::<Vec<_>>();

    settings_obj.insert("history".to_string(), Value::Array(next_history));
    write_settings_value(&app, &settings)?;
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

#[tauri::command]
async fn add_to_queue(
    app: AppHandle,
    id: String,
    url: String,
    state: State<'_, AppState>,
) -> CommandResult<Value> {
    state.download_manager.analyze_video(app, id, url);
    Ok(json!({ "success": true }))
}

#[tauri::command]
async fn start_download_task(
    app: AppHandle,
    id: String,
    url: String,
    format_id: String,
    state: State<'_, AppState>,
) -> CommandResult<Value> {
    state.download_manager.start_download(app, id, url, format_id);
    Ok(json!({ "success": true }))
}

#[tauri::command]
fn cancel_task(
    app: AppHandle,
    id: String,
    state: State<'_, AppState>,
) -> CommandResult<Value> {
    state.download_manager.cancel_download(&app, &id);
    Ok(ok())
}

#[tauri::command]
async fn start_convert(
    app: AppHandle,
    id: String,
    input_path: String,
    output_format: String,
    quality: String,
    state: State<'_, AppState>,
) -> CommandResult<Value> {
    state.download_manager.convert_file(app, id, input_path, output_format, quality);
    Ok(json!({ "success": true }))
}

#[tauri::command]
fn cancel_convert(
    id: String,
    state: State<'_, AppState>,
) -> CommandResult<Value> {
    state.download_manager.cancel_convert(&id);
    Ok(ok())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .manage(AppState {
            clipboard_monitor: Mutex::new(ClipboardMonitor::new()),
            download_manager: download::DownloadManager::new(),
        })
        .invoke_handler(tauri::generate_handler![
            get_settings,
            save_settings,
            get_download_folder,
            select_download_folder,
            get_history,
            clear_history,
            delete_history_item,
            open_file_location,
            start_clipboard_monitor,
            stop_clipboard_monitor,
            add_to_queue,
            start_download_task,
            cancel_task,
            start_convert,
            cancel_convert,
            dependencies::check_dependencies,
            dependencies::install_ytdlp,
            dependencies::install_ffmpeg,
            dependencies::update_ytdlp,
            dependencies::get_ytdlp_version,
            dependencies::get_platform,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
