//! Istege bagli ffprobe: SponsorBlock icin yt-dlp ffprobe ister, paketlenmez (~140 MB).
//!
//! Kullanici Ayarlar'dan isterse paketlenmis ffmpeg'in geldigi LGPL BtbN build'i indirilir,
//! SHA-256'si `checksums.sha256` ile dogrulanir ve yalnizca ffprobe app data altindaki
//! `bin/ffmpeg-tools/`e cikarilir. yt-dlp `--ffmpeg-location` ile bir klasor bekledigi icin
//! paketlenmis ffmpeg ayni klasore baglanir (Unix'te symlink; AppImage her acilista baska
//! yere baglandigi icin baglanti her seferinde dogrulanir).

use crate::dependencies::{override_dir, sidecar, EXE_SUFFIX};
use sha2::{Digest, Sha256};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use tauri::ipc::Channel;
use tauri::AppHandle;

const BASE_URL: &str = "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest";
/// scripts/fetch-sidecars.mjs FFMPEG_BRANCH ile ayni dal.
const BRANCH: (&str, &str) = ("n9.0", "9.0");

fn platform() -> Option<&'static str> {
    match (std::env::consts::OS, std::env::consts::ARCH) {
        ("linux", "x86_64") => Some("linux64"),
        ("linux", "aarch64") => Some("linuxarm64"),
        ("windows", "x86_64") => Some("win64"),
        ("windows", "aarch64") => Some("winarm64"),
        _ => None,
    }
}

fn asset_name(platform: &str) -> String {
    let (tag, short) = BRANCH;
    let ext = if platform.starts_with("win") { "zip" } else { "tar.xz" };
    format!("ffmpeg-{tag}-latest-{platform}-lgpl-{short}.{ext}")
}

fn tools_dir(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(override_dir(app)?.join("ffmpeg-tools"))
}

fn ffprobe_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(tools_dir(app)?.join(format!("ffprobe{EXE_SUFFIX}")))
}

pub fn is_installed(app: &AppHandle) -> bool {
    ffprobe_path(app).map(|p| p.is_file()).unwrap_or(false)
}

/// `--ffmpeg-location` degeri: ffprobe varsa ffmpeg + ffprobe klasoru, yoksa paketlenmis ffmpeg.
pub fn ffmpeg_location(app: &AppHandle) -> Option<PathBuf> {
    let bundled = sidecar("ffmpeg")?;
    if is_installed(app) {
        if let Ok(dir) = tools_dir(app) {
            if link_ffmpeg(&bundled, &dir.join(format!("ffmpeg{EXE_SUFFIX}"))).is_ok() {
                return Some(dir);
            }
        }
    }
    Some(bundled)
}

#[cfg(unix)]
fn link_ffmpeg(bundled: &Path, link: &Path) -> std::io::Result<()> {
    if fs::read_link(link).ok().as_deref() == Some(bundled) {
        return Ok(());
    }
    let _ = fs::remove_file(link);
    std::os::unix::fs::symlink(bundled, link)
}

/// Windows'ta symlink yonetici ister; ayni surucude hard link, degilse kopya.
#[cfg(windows)]
fn link_ffmpeg(bundled: &Path, link: &Path) -> std::io::Result<()> {
    let same = |a: &Path, b: &Path| -> bool {
        matches!((fs::metadata(a), fs::metadata(b)), (Ok(x), Ok(y)) if x.len() == y.len())
    };
    if link.is_file() && same(bundled, link) {
        return Ok(());
    }
    let _ = fs::remove_file(link);
    fs::hard_link(bundled, link).or_else(|_| fs::copy(bundled, link).map(|_| ()))
}

/// `<hash>  <ad>` satirlarindan dosyanin SHA-256'si.
fn hash_from_list(list: &str, file_name: &str) -> Option<String> {
    list.lines().find_map(|line| {
        let mut parts = line.split_whitespace();
        let hash = parts.next()?;
        let name = parts.next()?.trim_start_matches('*');
        (name == file_name && hash.len() == 64).then(|| hash.to_ascii_lowercase())
    })
}

fn client() -> Result<reqwest::Client, String> {
    if rustls::crypto::CryptoProvider::get_default().is_none() {
        let _ = rustls::crypto::ring::default_provider().install_default();
    }
    reqwest::Client::builder()
        .user_agent(concat!("Vidra/", env!("CARGO_PKG_VERSION")))
        .build()
        .map_err(|e| e.to_string())
}

/// Arsivi indirir, ilerlemeyi yuzde olarak bildirir ve SHA-256'sini dondurur.
async fn download(client: &reqwest::Client, url: &str, dest: &Path, progress: &(dyn Fn(u8) + Sync)) -> Result<String, String> {
    let mut res = client
        .get(url)
        .send()
        .await
        .and_then(|r| r.error_for_status())
        .map_err(|e| format!("İndirilemedi: {e}"))?;
    let total = res.content_length().unwrap_or(0);
    let mut file = fs::File::create(dest).map_err(|e| format!("Dosya oluşturulamadı: {e}"))?;
    let mut hasher = Sha256::new();
    let (mut done, mut last) = (0u64, u8::MAX);
    while let Some(chunk) = res.chunk().await.map_err(|e| format!("İndirme yarıda kaldı: {e}"))? {
        hasher.update(&chunk);
        file.write_all(&chunk).map_err(|e| format!("Diske yazılamadı: {e}"))?;
        done += chunk.len() as u64;
        if total > 0 {
            let percent = (done * 100 / total).min(100) as u8;
            if percent != last {
                last = percent;
                progress(percent);
            }
        }
    }
    file.flush().map_err(|e| e.to_string())?;
    Ok(format!("{:x}", hasher.finalize()))
}

/// Arsivdeki `*/bin/ffprobe` dosyasini `dest`e cikarir.
#[cfg(target_os = "linux")]
fn extract_ffprobe(archive: &Path, dest: &Path) -> Result<(), String> {
    // Akisla acilir; arsivin acilmis hali (~500 MB) bellege alinmaz.
    let file = std::io::BufReader::new(fs::File::open(archive).map_err(|e| e.to_string())?);
    let mut tar = tar::Archive::new(liblzma::read::XzDecoder::new(file));
    for entry in tar.entries().map_err(|e| e.to_string())? {
        let mut entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path().map_err(|e| e.to_string())?.into_owned();
        if path.ends_with("bin/ffprobe") {
            let mut out = fs::File::create(dest).map_err(|e| e.to_string())?;
            std::io::copy(&mut entry, &mut out).map_err(|e| e.to_string())?;
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(dest, fs::Permissions::from_mode(0o755)).map_err(|e| e.to_string())?;
            return Ok(());
        }
    }
    Err("Arşivde ffprobe yok.".into())
}

#[cfg(windows)]
fn extract_ffprobe(archive: &Path, dest: &Path) -> Result<(), String> {
    let file = fs::File::open(archive).map_err(|e| e.to_string())?;
    let mut zip = zip::ZipArchive::new(file).map_err(|e| format!("Arşiv açılamadı: {e}"))?;
    for i in 0..zip.len() {
        let mut entry = zip.by_index(i).map_err(|e| e.to_string())?;
        if entry.name().ends_with("bin/ffprobe.exe") {
            let mut out = fs::File::create(dest).map_err(|e| e.to_string())?;
            std::io::copy(&mut entry, &mut out).map_err(|e| e.to_string())?;
            return Ok(());
        }
    }
    Err("Arşivde ffprobe yok.".into())
}

#[cfg(not(any(target_os = "linux", windows)))]
fn extract_ffprobe(_archive: &Path, _dest: &Path) -> Result<(), String> {
    Err("Bu platform için hazır ffprobe yok.".into())
}

/// Indirir, dogrular ve ffprobe'u `dir`e kurar.
async fn install_into(dir: &Path, progress: &(dyn Fn(u8) + Sync)) -> Result<(), String> {
    let platform = platform().ok_or("Bu platform için hazır ffprobe yok.")?;
    let asset = asset_name(platform);
    fs::create_dir_all(dir).map_err(|e| e.to_string())?;

    let client = client()?;
    let list = client
        .get(format!("{BASE_URL}/checksums.sha256"))
        .send()
        .await
        .and_then(|r| r.error_for_status())
        .map_err(|e| format!("Doğrulama listesi indirilemedi: {e}"))?
        .text()
        .await
        .map_err(|e| e.to_string())?;
    let expected = hash_from_list(&list, &asset).ok_or_else(|| format!("{asset} için doğrulama bilgisi yok."))?;

    let archive = dir.join(format!("{asset}.part"));
    let result = async {
        let actual = download(&client, &format!("{BASE_URL}/{asset}"), &archive, progress).await?;
        if actual != expected {
            return Err("İndirilen dosya doğrulanamadı (SHA-256 uyuşmuyor).".to_string());
        }
        let target = dir.join(format!("ffprobe{EXE_SUFFIX}"));
        let part = target.with_extension("part");
        // Cikarma CPU'yu birkac saniye mesgul eder; async calisani bloklamasin.
        let (archive_path, part_path) = (archive.clone(), part.clone());
        tauri::async_runtime::spawn_blocking(move || extract_ffprobe(&archive_path, &part_path))
            .await
            .map_err(|e| e.to_string())??;
        fs::rename(&part, &target).map_err(|e| e.to_string())
    }
    .await;
    let _ = fs::remove_file(&archive);
    result
}

#[tauri::command]
pub async fn install_ffprobe(app: AppHandle, on_progress: Channel<u8>) -> Result<(), String> {
    let dir = tools_dir(&app)?;
    let result = install_into(&dir, &|percent| {
        let _ = on_progress.send(percent);
    })
    .await;
    if result.is_err() {
        let _ = fs::remove_dir_all(&dir);
    }
    result
}

#[tauri::command]
pub fn remove_ffprobe(app: AppHandle) -> Result<(), String> {
    let dir = tools_dir(&app)?;
    if dir.exists() {
        fs::remove_dir_all(&dir).map_err(|e| format!("ffprobe silinemedi: {e}"))?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn finds_hash_for_asset() {
        let list = "aaaa  other.zip\n\
            7709b4c1cd28d4da7cc9398c270eecc3836530bf9a0238ceb54b679abb06eac9  ffmpeg-n9.0-latest-linux64-lgpl-9.0.tar.xz\n";
        assert_eq!(
            hash_from_list(list, "ffmpeg-n9.0-latest-linux64-lgpl-9.0.tar.xz").as_deref(),
            Some("7709b4c1cd28d4da7cc9398c270eecc3836530bf9a0238ceb54b679abb06eac9")
        );
        assert_eq!(hash_from_list(list, "ffmpeg-n9.0-latest-linux64-lgpl-shared-9.0.tar.xz"), None);
    }

    #[test]
    fn asset_names_match_btbn() {
        assert_eq!(asset_name("linux64"), "ffmpeg-n9.0-latest-linux64-lgpl-9.0.tar.xz");
        assert_eq!(asset_name("win64"), "ffmpeg-n9.0-latest-win64-lgpl-9.0.zip");
    }

    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("vidra-ffprobe-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn extracts_only_ffprobe_from_tar_xz() {
        let dir = temp_dir("tar");
        let mut tar_bytes = Vec::new();
        {
            let mut builder = tar::Builder::new(&mut tar_bytes);
            for (name, body) in [("ffmpeg-x/bin/ffmpeg", "ff"), ("ffmpeg-x/bin/ffprobe", "probe")] {
                let mut header = tar::Header::new_gnu();
                header.set_size(body.len() as u64);
                header.set_mode(0o644);
                header.set_cksum();
                builder.append_data(&mut header, name, body.as_bytes()).unwrap();
            }
            builder.finish().unwrap();
        }
        let mut xz = Vec::new();
        std::io::copy(&mut liblzma::read::XzEncoder::new(tar_bytes.as_slice(), 6), &mut xz).unwrap();
        let archive = dir.join("a.tar.xz");
        fs::write(&archive, xz).unwrap();

        let dest = dir.join("ffprobe");
        extract_ffprobe(&archive, &dest).unwrap();
        assert_eq!(fs::read_to_string(&dest).unwrap(), "probe");
        use std::os::unix::fs::PermissionsExt;
        assert_eq!(fs::metadata(&dest).unwrap().permissions().mode() & 0o777, 0o755);
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn links_bundled_ffmpeg_and_relinks_when_it_moves() {
        let dir = temp_dir("link");
        let (a, b) = (dir.join("a-ffmpeg"), dir.join("b-ffmpeg"));
        fs::write(&a, "old").unwrap();
        fs::write(&b, "new!").unwrap();
        let link = dir.join("ffmpeg");
        link_ffmpeg(&a, &link).unwrap();
        assert_eq!(fs::read_to_string(&link).unwrap(), "old");
        link_ffmpeg(&b, &link).unwrap();
        assert_eq!(fs::read_to_string(&link).unwrap(), "new!");
        fs::remove_dir_all(&dir).unwrap();
    }

    /// Gercek BtbN arsivini indirir (~135 MB): `cargo test -- --ignored real_download`
    #[test]
    #[ignore]
    fn real_download_installs_working_ffprobe() {
        let dir = temp_dir("real");
        tauri::async_runtime::block_on(install_into(&dir, &|_| {})).unwrap();
        let ffprobe = dir.join(format!("ffprobe{EXE_SUFFIX}"));
        let out = std::process::Command::new(&ffprobe).arg("-version").output().unwrap();
        assert!(String::from_utf8_lossy(&out.stdout).starts_with("ffprobe version"));
        fs::remove_dir_all(&dir).unwrap();
    }
}
