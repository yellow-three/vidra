use std::path::{Path, PathBuf};
use std::process::Command;
use futures_util::StreamExt;
use tauri::{AppHandle, Emitter, Manager};

const EXE_SUFFIX: &str = if cfg!(target_os = "windows") { ".exe" } else { "" };

pub fn bin_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("App data dizini bulunamadi: {e}"))?;
    let bin = dir.join("bin");
    std::fs::create_dir_all(&bin)
        .map_err(|e| format!("bin dizini olusturulamadi: {e}"))?;
    Ok(bin)
}

pub fn ytdlp_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(bin_dir(app)?.join(format!("yt-dlp{EXE_SUFFIX}")))
}

pub fn ffmpeg_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(bin_dir(app)?.join(format!("ffmpeg{EXE_SUFFIX}")))
}

/// Uygulamanin kendi kopyasi yoksa sistemdeki (PATH) FFmpeg kullanilir.
pub fn resolve_ffmpeg(app: &AppHandle) -> Option<PathBuf> {
    ffmpeg_path(app)
        .ok()
        .filter(|p| p.exists())
        .or_else(|| find_in_path("ffmpeg"))
}

pub fn find_in_path(name: &str) -> Option<PathBuf> {
    let file = format!("{name}{EXE_SUFFIX}");
    std::env::split_paths(&std::env::var_os("PATH")?)
        .map(|dir| dir.join(&file))
        .find(|p| p.is_file())
}

/// YouTube imza cozumu icin yt-dlp'nin kullanabilecegi ilk JS runtime.
pub fn js_runtime() -> Option<&'static str> {
    ["deno", "node", "bun"].into_iter().find(|name| find_in_path(name).is_some())
}

/// Surec calistiricinin izin verdigi programlar ve gercek yollari.
pub fn resolve_program(app: &AppHandle, name: &str) -> Option<PathBuf> {
    match name {
        "yt-dlp" => ytdlp_path(app).ok().filter(|p| p.exists()),
        "ffmpeg" => resolve_ffmpeg(app),
        "ffprobe" => bin_dir(app)
            .ok()
            .map(|d| d.join(format!("ffprobe{EXE_SUFFIX}")))
            .filter(|p| p.exists())
            .or_else(|| find_in_path("ffprobe")),
        _ => None,
    }
}

fn ytdlp_url() -> String {
    let base = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp";
    if cfg!(target_os = "windows") {
        format!("{base}.exe")
    } else if cfg!(target_os = "macos") {
        format!("{base}_macos")
    } else if cfg!(target_arch = "aarch64") {
        // Duz `yt-dlp` asset'i Python ister; `_linux` surumleri tek basina calisir.
        format!("{base}_linux_aarch64")
    } else {
        format!("{base}_linux")
    }
}

fn ffmpeg_url() -> String {
    if cfg!(target_os = "windows") {
        "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip".to_string()
    } else if cfg!(target_os = "macos") {
        "https://evermeet.cx/ffmpeg/ffmpeg.zip".to_string()
    } else if cfg!(target_arch = "aarch64") {
        "https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-arm64-static.tar.xz".to_string()
    } else {
        "https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz".to_string()
    }
}

/// Yarim kalan indirme "kurulu" sanilmasin diye once `.part` dosyasina yazar, sonra tasir.
async fn download_file(url: &str, dest: &Path, app: &AppHandle, label: &str) -> Result<(), String> {
    let resp = reqwest::Client::new()
        .get(url)
        .send()
        .await
        .and_then(|r| r.error_for_status())
        .map_err(|e| format!("{label} indirilemedi: {e}"))?;

    let total = resp.content_length().unwrap_or(0);
    let mut stream = resp.bytes_stream();
    let part = dest.with_extension("part");
    let mut file = tokio::fs::File::create(&part)
        .await
        .map_err(|e| format!("{label} dosyasi olusturulamadi: {e}"))?;

    use tokio::io::AsyncWriteExt;
    let mut downloaded: u64 = 0;
    let mut last_percent = u32::MAX;

    while let Some(chunk) = stream
        .next()
        .await
        .transpose()
        .map_err(|e| format!("{label} indirme hatasi: {e}"))?
    {
        file.write_all(&chunk)
            .await
            .map_err(|e| format!("{label} yazma hatasi: {e}"))?;
        downloaded += chunk.len() as u64;

        if total > 0 {
            let percent = (downloaded as f64 / total as f64 * 100.0) as u32;
            if percent != last_percent {
                last_percent = percent;
                let _ = app.emit(
                    "dependency-status",
                    format!("{label} indiriliyor... %{percent}"),
                );
            }
        }
    }

    file.flush().await.map_err(|e| format!("{label} yazma hatasi: {e}"))?;
    drop(file);
    std::fs::rename(&part, dest).map_err(|e| format!("{label} kaydedilemedi: {e}"))
}

fn make_executable(path: &Path) -> Result<(), String> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o755))
            .map_err(|e| format!("Calistirma izni verilemedi: {e}"))?;
    }
    #[cfg(not(unix))]
    let _ = path;
    Ok(())
}

/// Arsivler binary'leri alt klasorlere koyar (orn. `ffmpeg-7.0.2-amd64-static/ffmpeg`).
fn find_file(dir: &Path, name: &str) -> Option<PathBuf> {
    for entry in std::fs::read_dir(dir).ok()?.flatten() {
        let path = entry.path();
        if path.is_dir() {
            if let Some(found) = find_file(&path, name) {
                return Some(found);
            }
        } else if path.file_name().and_then(|n| n.to_str()) == Some(name) {
            return Some(path);
        }
    }
    None
}

#[tauri::command]
pub async fn check_dependencies(app: AppHandle) -> Result<serde_json::Value, String> {
    let yt_dlp = ytdlp_path(&app)?;
    let ff_mpeg = resolve_ffmpeg(&app);

    Ok(serde_json::json!({
        "ytdlp": yt_dlp.exists(),
        "ffmpeg": ff_mpeg.is_some(),
        "ytdlpPath": yt_dlp.to_string_lossy(),
        "ffmpegPath": ff_mpeg.map(|p| p.to_string_lossy().to_string()),
        "jsRuntime": js_runtime(),
    }))
}

#[tauri::command]
pub async fn install_ytdlp(app: AppHandle) -> Result<serde_json::Value, String> {
    let path = ytdlp_path(&app)?;
    if path.exists() {
        return Ok(serde_json::json!({ "success": true, "message": "yt-dlp zaten kurulu." }));
    }
    download_ytdlp(&app, &path).await?;
    let _ = app.emit("dependency-status", "yt-dlp başarıyla kuruldu.");
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
pub async fn update_ytdlp(app: AppHandle) -> Result<serde_json::Value, String> {
    let path = ytdlp_path(&app)?;
    download_ytdlp(&app, &path).await?;
    let _ = app.emit("dependency-status", "yt-dlp güncellendi.");
    let version = get_ytdlp_version(app)?["version"].clone();
    Ok(serde_json::json!({ "success": true, "version": version }))
}

async fn download_ytdlp(app: &AppHandle, path: &Path) -> Result<(), String> {
    let _ = app.emit("dependency-status", "yt-dlp indiriliyor...");
    download_file(&ytdlp_url(), path, app, "yt-dlp").await?;
    make_executable(path)
}

#[tauri::command]
pub async fn install_ffmpeg(app: AppHandle) -> Result<serde_json::Value, String> {
    if resolve_ffmpeg(&app).is_some() {
        return Ok(serde_json::json!({ "success": true, "message": "FFmpeg zaten kurulu." }));
    }

    let bin = bin_dir(&app)?;
    let url = ffmpeg_url();
    let archive = bin.join(if url.ends_with(".zip") { "ffmpeg_archive.zip" } else { "ffmpeg_archive.tar.xz" });
    let extract_dir = bin.join("ffmpeg_extract");

    let _ = app.emit("dependency-status", "FFmpeg indiriliyor...");
    download_file(&url, &archive, &app, "FFmpeg").await?;

    let _ = app.emit("dependency-status", "FFmpeg arşivi çözülüyor...");
    let _ = std::fs::remove_dir_all(&extract_dir);
    std::fs::create_dir_all(&extract_dir).map_err(|e| format!("FFmpeg klasoru olusturulamadi: {e}"))?;

    // macOS'ta tar zip acamaz; Windows 10+ ve Linux tar'i ikisini de acar.
    let mut cmd = if cfg!(target_os = "macos") {
        let mut c = Command::new("unzip");
        c.arg("-o").arg(&archive).arg("-d").arg(&extract_dir);
        c
    } else {
        let mut c = Command::new("tar");
        c.arg("-xf").arg(&archive).arg("-C").arg(&extract_dir);
        c
    };
    let status = cmd.status().map_err(|e| format!("FFmpeg arsivi acilamadi: {e}"));
    let _ = std::fs::remove_file(&archive);
    if !status?.success() {
        let _ = std::fs::remove_dir_all(&extract_dir);
        return Err("FFmpeg arsivi acilamadi.".to_string());
    }

    for name in ["ffmpeg", "ffprobe"] {
        let file = format!("{name}{EXE_SUFFIX}");
        if let Some(found) = find_file(&extract_dir, &file) {
            let dest = bin.join(&file);
            std::fs::rename(&found, &dest).map_err(|e| format!("{name} tasinamadi: {e}"))?;
            make_executable(&dest)?;
        }
    }
    let _ = std::fs::remove_dir_all(&extract_dir);

    if !ffmpeg_path(&app)?.exists() {
        return Err("FFmpeg arsivinde ffmpeg bulunamadi.".to_string());
    }

    let _ = app.emit("dependency-status", "FFmpeg başarıyla kuruldu.");
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
pub fn get_ytdlp_version(app: AppHandle) -> Result<serde_json::Value, String> {
    let path = ytdlp_path(&app)?;
    if !path.exists() {
        return Ok(serde_json::json!({ "version": null }));
    }

    let output = Command::new(&path)
        .arg("--version")
        .output()
        .map_err(|e| format!("yt-dlp versiyon sorgulanamadi: {e}"))?;

    let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
    Ok(serde_json::json!({ "version": if version.is_empty() { None } else { Some(version) } }))
}

#[tauri::command]
pub fn get_platform() -> String {
    std::env::consts::OS.to_string()
}
