use std::path::PathBuf;
use std::process::Command;
use futures_util::StreamExt;
use tauri::{AppHandle, Emitter, Manager};

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
    let name = if cfg!(target_os = "windows") {
        "yt-dlp.exe"
    } else {
        "yt-dlp"
    };
    Ok(bin_dir(app)?.join(name))
}

pub fn ffmpeg_path(app: &AppHandle) -> Result<PathBuf, String> {
    let name = if cfg!(target_os = "windows") {
        "ffmpeg.exe"
    } else {
        "ffmpeg"
    };
    Ok(bin_dir(app)?.join(name))
}

fn ytdlp_url() -> String {
    let base = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp";
    if cfg!(target_os = "windows") {
        format!("{base}.exe")
    } else if cfg!(target_os = "macos") {
        format!("{base}_macos")
    } else {
        base.to_string()
    }
}

fn ffmpeg_url() -> String {
    if cfg!(target_os = "windows") {
        "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip".to_string()
    } else if cfg!(target_os = "macos") {
        "https://evermeet.cx/ffmpeg/ffmpeg.zip".to_string()
    } else {
        "https://johnvansickle.com/ffmpeg/builds/ffmpeg-git-amd64-static.tar.xz".to_string()
    }
}

async fn download_file(url: &str, dest: &PathBuf, app: &AppHandle, label: &str) -> Result<(), String> {
    let client = reqwest::Client::new();
    let resp = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("{label} indirilemedi: {e}"))?;

    let total = resp.content_length().unwrap_or(0);
    let mut stream = resp.bytes_stream();
    let mut file = tokio::fs::File::create(dest)
        .await
        .map_err(|e| format!("{label} dosyasi olusturulamadi: {e}"))?;

    use tokio::io::AsyncWriteExt;
    let mut downloaded: u64 = 0;

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
            let _ = app.emit(
                "dependency-status",
                format!("{label} indiriliyor... %{}", percent),
            );
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn check_dependencies(app: AppHandle) -> Result<serde_json::Value, String> {
    let _ = app.emit("dependency-status", "Bağımlılıklar kontrol ediliyor...");

    let yt_dlp = ytdlp_path(&app)?;
    let ff_mpeg = ffmpeg_path(&app)?;

    let yt_dlp_ok = yt_dlp.exists();
    let ff_mpeg_ok = ff_mpeg.exists();

    Ok(serde_json::json!({
        "ytdlp": yt_dlp_ok,
        "ffmpeg": ff_mpeg_ok,
        "ytdlpPath": yt_dlp.to_string_lossy(),
        "ffmpegPath": ff_mpeg.to_string_lossy(),
    }))
}

#[tauri::command]
pub async fn install_ytdlp(app: AppHandle) -> Result<serde_json::Value, String> {
    let path = ytdlp_path(&app)?;
    if path.exists() {
        return Ok(serde_json::json!({ "success": true, "message": "yt-dlp zaten kurulu." }));
    }

    let _ = app.emit("dependency-status", "yt-dlp indiriliyor...");
    download_file(&ytdlp_url(), &path, &app, "yt-dlp").await?;

    #[cfg(not(target_os = "windows"))]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o755))
            .map_err(|e| format!("yt-dlp izin hatasi: {e}"))?;
    }

    let _ = app.emit("dependency-status", "yt-dlp başarıyla kuruldu.");
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
pub async fn install_ffmpeg(app: AppHandle) -> Result<serde_json::Value, String> {
    let path = ffmpeg_path(&app)?;
    if path.exists() {
        return Ok(serde_json::json!({ "success": true, "message": "FFmpeg zaten kurulu." }));
    }

    let _ = app.emit("dependency-status", "FFmpeg indiriliyor...");
    let url = ffmpeg_url();

    if cfg!(target_os = "windows") || cfg!(target_os = "macos") {
        let zip_path = bin_dir(&app)?.join("ffmpeg_archive.zip");
        download_file(&url, &zip_path, &app, "FFmpeg").await?;
        let _ = app.emit("dependency-status", "FFmpeg arsivi cozuluyor...");
        let _ = std::process::Command::new("unzip")
            .arg("-o")
            .arg(&zip_path)
            .arg("-d")
            .arg(bin_dir(&app)?)
            .output();
        let _ = std::fs::remove_file(&zip_path);
    } else {
        let tar_path = bin_dir(&app)?.join("ffmpeg_archive.tar.xz");
        download_file(&url, &tar_path, &app, "FFmpeg").await?;
        let _ = app.emit("dependency-status", "FFmpeg arsivi cozuluyor...");
        let _ = std::process::Command::new("tar")
            .arg("-xf")
            .arg(&tar_path)
            .arg("-C")
            .arg(bin_dir(&app)?)
            .output();
        let _ = std::fs::remove_file(&tar_path);

        #[cfg(not(target_os = "windows"))]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o755))
                .map_err(|e| format!("FFmpeg izin hatasi: {e}"))?;
        }
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
