//! Paketlenmis sidecar'lar (yt-dlp, ffmpeg, deno) ve yt-dlp guncellemesi.
//!
//! Sidecar'lar uygulama ile birlikte gelir (`scripts/fetch-sidecars.mjs`) ve calistirilabilir
//! dosyanin yanina kurulur; bu dizin cogu kurulumda salt okunurdur (AppImage, imzali macOS
//! uygulamasi, /usr/bin). Bu yuzden guncellenen yt-dlp app data altindaki `bin/`e yazilir ve
//! paketlenmis surumden yeniyse o kullanilir.

use std::path::{Path, PathBuf};
use std::process::Command;
use tauri::{AppHandle, Manager};

const EXE_SUFFIX: &str = if cfg!(target_os = "windows") { ".exe" } else { "" };
const YTDLP_VERSION_FILE: &str = "yt-dlp.version";

/// Linux paketleri sidecar'lari /usr/bin'e kurar; onek sistemdeki ffmpeg / yt-dlp ile cakismayi onler.
const SIDECAR_PREFIX: &str = "ytd-";

fn sidecar(name: &str) -> Option<PathBuf> {
    let exe = std::env::current_exe().ok()?;
    let path = exe.parent()?.join(format!("{SIDECAR_PREFIX}{name}{EXE_SUFFIX}"));
    path.is_file().then_some(path)
}

fn override_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("App data dizini bulunamadi: {e}"))?
        .join("bin");
    std::fs::create_dir_all(&dir).map_err(|e| format!("bin dizini olusturulamadi: {e}"))?;
    Ok(dir)
}

fn ytdlp_override(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(override_dir(app)?.join(format!("yt-dlp{EXE_SUFFIX}")))
}

pub fn ytdlp_path(app: &AppHandle) -> Option<PathBuf> {
    ytdlp_override(app)
        .ok()
        .filter(|p| p.is_file())
        .or_else(|| sidecar("yt-dlp"))
}

/// Surec calistiricinin izin verdigi programlar ve gercek yollari.
pub fn resolve_program(app: &AppHandle, name: &str) -> Option<PathBuf> {
    match name {
        "yt-dlp" => ytdlp_path(app),
        "ffmpeg" => sidecar(name),
        _ => None,
    }
}

fn version_of(binary: &Path) -> Option<String> {
    let mut cmd = Command::new(binary);
    cmd.arg("--version");
    #[cfg(windows)]
    std::os::windows::process::CommandExt::creation_flags(&mut cmd, 0x0800_0000);
    let out = cmd.output().ok()?;
    let version = String::from_utf8_lossy(&out.stdout).trim().to_string();
    (out.status.success() && !version.is_empty()).then_some(version)
}

/// Uygulama guncellenip daha yeni bir yt-dlp ile geldiyse eski app data kopyasini siler.
/// yt-dlp surumleri `YYYY.MM.DD[.N]` bicimindedir; metin karsilastirmasi yeterlidir.
pub fn prune_stale_ytdlp(app: &AppHandle) {
    let (Ok(path), Some(bundled)) = (ytdlp_override(app), sidecar("yt-dlp")) else {
        return;
    };
    if !path.is_file() {
        return;
    }
    let version_file = path.with_file_name(YTDLP_VERSION_FILE);
    let updated = std::fs::read_to_string(&version_file)
        .ok()
        .map(|v| v.trim().to_string())
        .or_else(|| version_of(&path));
    if let (Some(updated), Some(bundled)) = (updated, version_of(&bundled)) {
        if bundled >= updated {
            let _ = std::fs::remove_file(&path);
            let _ = std::fs::remove_file(&version_file);
        }
    }
}

#[tauri::command]
pub fn check_dependencies(app: AppHandle) -> serde_json::Value {
    let path_str = |p: Option<PathBuf>| p.map(|p| p.to_string_lossy().to_string());
    let ytdlp = ytdlp_path(&app);
    let ffmpeg = sidecar("ffmpeg");
    let deno = sidecar("deno");
    serde_json::json!({
        "ytdlp": ytdlp.is_some(),
        "ffmpeg": ffmpeg.is_some(),
        "deno": deno.is_some(),
        "ytdlpPath": path_str(ytdlp),
        "ffmpegPath": path_str(ffmpeg),
        "denoPath": path_str(deno),
    })
}

/// yt-dlp'nin kendi guncelleyicisini (`-U`, checksum dogrulamali) app data kopyasinda calistirir.
#[tauri::command]
pub async fn update_ytdlp(app: AppHandle) -> Result<serde_json::Value, String> {
    let app_clone = app.clone();
    let version = tauri::async_runtime::spawn_blocking(move || update_ytdlp_blocking(&app_clone))
        .await
        .map_err(|e| format!("Guncelleme gorevi basarisiz: {e}"))??;
    Ok(serde_json::json!({ "success": true, "version": version }))
}

fn update_ytdlp_blocking(app: &AppHandle) -> Result<String, String> {
    let path = ytdlp_override(app)?;
    if !path.is_file() {
        let bundled = sidecar("yt-dlp").ok_or("Paketlenmis yt-dlp bulunamadi.")?;
        let part = path.with_extension("part");
        std::fs::copy(&bundled, &part).map_err(|e| format!("yt-dlp kopyalanamadi: {e}"))?;
        std::fs::rename(&part, &path).map_err(|e| format!("yt-dlp kopyalanamadi: {e}"))?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o755))
                .map_err(|e| format!("Calistirma izni verilemedi: {e}"))?;
        }
    }

    let mut cmd = Command::new(&path);
    cmd.arg("-U");
    #[cfg(windows)]
    std::os::windows::process::CommandExt::creation_flags(&mut cmd, 0x0800_0000);
    let out = cmd.output().map_err(|e| format!("yt-dlp calistirilamadi: {e}"))?;
    if !out.status.success() {
        let stderr = String::from_utf8_lossy(&out.stderr);
        let msg = stderr.lines().filter(|l| !l.trim().is_empty()).last().unwrap_or("bilinmeyen hata");
        return Err(format!("yt-dlp guncellenemedi: {msg}"));
    }

    let version = version_of(&path).ok_or("Guncel yt-dlp surumu okunamadi.")?;
    let _ = std::fs::write(path.with_file_name(YTDLP_VERSION_FILE), &version);
    Ok(version)
}

#[tauri::command]
pub fn get_ytdlp_version(app: AppHandle) -> serde_json::Value {
    serde_json::json!({ "version": ytdlp_path(&app).and_then(|p| version_of(&p)) })
}

#[tauri::command]
pub fn get_platform() -> String {
    std::env::consts::OS.to_string()
}
