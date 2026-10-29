//! Arac yollari (yt-dlp, ffmpeg, deno) ve yt-dlp guncellemesi.
//!
//! Araclar ilk acilista app data altindaki `bin/`e indirilir (`tools.rs`). Sidecar'larla
//! paketlenmis kurulumlarda (`tauri.bundled.conf.json`, ornegin Flatpak) calistirilabilir
//! dosyanin yanindaki kopyalar kullanilir; bu dizin cogu kurulumda salt okunurdur. Her iki
//! durumda yt-dlp `bin/` altindaki kopyada guncellenir ve varsa o kullanilir.

use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

pub(crate) const EXE_SUFFIX: &str = if cfg!(target_os = "windows") { ".exe" } else { "" };
pub(crate) const YTDLP_VERSION_FILE: &str = "yt-dlp.version";

/// Linux paketleri sidecar'lari /usr/bin'e kurar; onek sistemdeki ffmpeg / yt-dlp ile cakismayi onler.
const SIDECAR_PREFIX: &str = "ytd-";

pub(crate) fn sidecar(name: &str) -> Option<PathBuf> {
    let exe = std::env::current_exe().ok()?;
    let path = exe.parent()?.join(format!("{SIDECAR_PREFIX}{name}{EXE_SUFFIX}"));
    path.is_file().then_some(path)
}

pub(crate) fn override_dir(app: &AppHandle) -> Result<PathBuf, String> {
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

/// Yerine konmayi bekleyen yeni yt-dlp (guncelleme ya da yeniden indirme).
pub(crate) fn staged_ytdlp(target: &Path) -> PathBuf {
    target.with_file_name(format!("yt-dlp-update{EXE_SUFFIX}"))
}

/// yt-dlp (PyInstaller onefile) calisirken kendi dosyasindan okumaya devam eder; dosya
/// degistirilirse surec "Error -3 while decompressing data" ile duser. Bu yuzden yeni surum
/// once `yt-dlp-update`e yazilir ve yalnizca calisan yt-dlp sureci yokken yerine tasinir:
/// guncelleme bittiginde bos ise hemen, degilse son yt-dlp sureci bitince.
/// `-U` kopya uzerinde calisirken kopya tasinmaz.
pub(crate) struct YtdlpGate {
    state: Mutex<GateState>,
}

struct GateState {
    running: usize,
    updating: bool,
}

impl YtdlpGate {
    pub(crate) const fn new() -> Self {
        Self {
            state: Mutex::new(GateState {
                running: 0,
                updating: false,
            }),
        }
    }
}

pub(crate) static YTDLP_GATE: YtdlpGate = YtdlpGate::new();

/// Calisan bir yt-dlp sureci; birakilinca sayactan dusulur, son surecse bekleyen surum tasinir.
pub(crate) struct YtdlpRun {
    gate: &'static YtdlpGate,
    target: PathBuf,
}

impl Drop for YtdlpRun {
    fn drop(&mut self) {
        let mut state = self.gate.state.lock().unwrap();
        state.running -= 1;
        if state.running == 0 && !state.updating {
            swap_staged(&self.target);
        }
    }
}

impl YtdlpGate {
    /// Bekleyen yeni surumu (varsa) yerine koyar ve yeni bir calismayi sayar.
    pub(crate) fn enter(&'static self, target: &Path) -> YtdlpRun {
        let mut state = self.state.lock().unwrap();
        if state.running == 0 && !state.updating {
            swap_staged(target);
        }
        state.running += 1;
        YtdlpRun {
            gate: self,
            target: target.to_path_buf(),
        }
    }

    /// Calisan yt-dlp yoksa bekleyen yeni surumu hemen yerine koyar.
    pub(crate) fn swap_if_idle(&self, target: &Path) -> bool {
        let state = self.state.lock().unwrap();
        state.running == 0 && !state.updating && swap_staged(target)
    }

    /// `f` calisirken (kopyada `-U`) bekleyen surum tasinmaz; bitince bossa tasinir.
    fn while_updating<T>(&self, target: &Path, f: impl FnOnce() -> T) -> T {
        self.state.lock().unwrap().updating = true;
        let result = f();
        self.state.lock().unwrap().updating = false;
        self.swap_if_idle(target);
        result
    }
}

fn swap_staged(target: &Path) -> bool {
    let staged = staged_ytdlp(target);
    staged.is_file() && std::fs::rename(&staged, target).is_ok()
}

pub fn ytdlp_path(app: &AppHandle) -> Option<PathBuf> {
    ytdlp_override(app)
        .ok()
        .filter(|p| p.is_file() || staged_ytdlp(p).is_file())
        .or_else(|| sidecar("yt-dlp"))
}

/// Surec calistiricinin izin verdigi programlar ve gercek yollari.
pub fn resolve_program(app: &AppHandle, name: &str) -> Option<PathBuf> {
    match name {
        "yt-dlp" => ytdlp_path(app),
        "ffmpeg" => crate::tools::ffmpeg_program(app),
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
    // ffprobe kuruluysa yt-dlp'ye ffmpeg + ffprobe iceren klasor verilir (SponsorBlock).
    let ffmpeg = crate::tools::ffmpeg_location(&app);
    let deno = crate::tools::deno_path(&app);
    serde_json::json!({
        "ytdlp": ytdlp.is_some(),
        "ffmpeg": ffmpeg.is_some(),
        "deno": deno.is_some(),
        "ffprobe": crate::tools::is_ffprobe_installed(&app),
        "h264Encoder": crate::tools::h264_encoder(&app),
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
    // Calisan indirmelerin kullandigi dosyaya dokunulmaz; kopyasi guncellenir (YtdlpGate).
    let staged = staged_ytdlp(&path);
    let source = if staged.is_file() {
        staged.clone()
    } else if path.is_file() {
        path.clone()
    } else {
        sidecar("yt-dlp").ok_or("yt-dlp kurulu değil; Ayarlar > Sistem'den indirin.")?
    };
    if source != staged {
        let part = staged.with_extension("part");
        std::fs::copy(&source, &part).map_err(|e| format!("yt-dlp kopyalanamadi: {e}"))?;
        std::fs::rename(&part, &staged).map_err(|e| format!("yt-dlp kopyalanamadi: {e}"))?;
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&staged, std::fs::Permissions::from_mode(0o755))
            .map_err(|e| format!("Calistirma izni verilemedi: {e}"))?;
    }
    let version = YTDLP_GATE.while_updating(&path, || run_self_update(&staged))?;
    let _ = std::fs::write(path.with_file_name(YTDLP_VERSION_FILE), &version);
    Ok(version)
}

fn run_self_update(path: &Path) -> Result<String, String> {
    let mut cmd = Command::new(path);
    cmd.arg("-U");
    #[cfg(windows)]
    std::os::windows::process::CommandExt::creation_flags(&mut cmd, 0x0800_0000);
    let out = cmd.output().map_err(|e| format!("yt-dlp calistirilamadi: {e}"))?;
    if !out.status.success() {
        let stderr = String::from_utf8_lossy(&out.stderr);
        let msg = stderr
            .lines()
            .rfind(|l| !l.trim().is_empty())
            .unwrap_or("bilinmeyen hata");
        return Err(format!("yt-dlp guncellenemedi: {msg}"));
    }

    version_of(path).ok_or_else(|| "Guncel yt-dlp surumu okunamadi.".to_string())
}

#[tauri::command]
pub fn get_ytdlp_version(app: AppHandle) -> serde_json::Value {
    let version = ytdlp_path(&app).and_then(|p| {
        let _run = YTDLP_GATE.enter(&p);
        version_of(&p)
    });
    serde_json::json!({ "version": version })
}

#[tauri::command]
pub fn get_platform() -> String {
    std::env::consts::OS.to_string()
}

/// Flatpak'te uygulamayi Flathub gunceller; uygulama ici guncelleyici kapatilir.
#[tauri::command]
pub fn is_flatpak() -> bool {
    std::env::var_os("FLATPAK_ID").is_some() || std::path::Path::new("/.flatpak-info").exists()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn staged_ytdlp_replaces_only_when_no_run_is_active() {
        static GATE: YtdlpGate = YtdlpGate::new();
        let dir = std::env::temp_dir().join(format!("vidra-gate-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        let target = dir.join(format!("yt-dlp{EXE_SUFFIX}"));
        std::fs::write(&target, "old").unwrap();

        let (first, second) = (GATE.enter(&target), GATE.enter(&target));
        std::fs::write(staged_ytdlp(&target), "new").unwrap();
        assert!(!GATE.swap_if_idle(&target));
        drop(first);
        assert_eq!(std::fs::read_to_string(&target).unwrap(), "old");
        // Son calisma bitince yeni surum yerine konur.
        drop(second);
        assert_eq!(std::fs::read_to_string(&target).unwrap(), "new");
        assert!(!staged_ytdlp(&target).exists());

        // Calisma baslarken bekleyen surum de once yerine konur.
        std::fs::write(staged_ytdlp(&target), "new2").unwrap();
        drop(GATE.enter(&target));
        assert_eq!(std::fs::read_to_string(&target).unwrap(), "new2");
        // Kopya guncellenirken baslayan calisma onu yerine tasimaz.
        std::fs::write(staged_ytdlp(&target), "newer").unwrap();
        GATE.while_updating(&target, || {
            drop(GATE.enter(&target));
            assert_eq!(std::fs::read_to_string(&target).unwrap(), "new2");
        });
        assert_eq!(std::fs::read_to_string(&target).unwrap(), "newer");
        std::fs::remove_dir_all(&dir).unwrap();
    }
}
