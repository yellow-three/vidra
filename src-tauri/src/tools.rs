//! Ilk acilista indirilen bilesenler: yt-dlp, deno, LGPL FFmpeg ve istege bagli ffprobe.
//!
//! Paket boyutunu dusurmek icin bu araclar kurulumla gelmez; kurulum ekrani bunlari
//! `scripts/fetch-sidecars.mjs` ile ayni kaynaklardan (surumler `tools.json`) indirir,
//! SHA-256'yi yayincinin listesiyle dogrular ve app data altindaki `bin/`e kurar:
//!
//! - `bin/yt-dlp` — haftalik `-U` guncellemesi de bu kopyada calisir,
//! - `bin/deno` — surumu `deno.version`da tutulur; uygulama yeni bir surum isterse yeniden indirilir,
//! - `bin/ffmpeg-tools/{ffmpeg,ffprobe}` — yt-dlp `--ffmpeg-location` ile bu klasoru alir.
//!
//! Sidecar'larla paketlenmis kurulumlarda (Flatpak) kurulum ekrani hic cikmaz. ffprobe
//! paketlenmis ffmpeg ile birlikte kullanilacaksa ffmpeg ayni klasore baglanir (Unix'te
//! symlink; AppImage her acilista baska yere baglandigi icin baglanti her seferinde dogrulanir).

use crate::dependencies::{override_dir, sidecar, EXE_SUFFIX};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;
use tauri::ipc::Channel;
use tauri::AppHandle;

const FFMPEG_BASE_URL: &str = "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest";
const DENO_VERSION_FILE: &str = "deno.version";
/// Indirilen ffmpeg'in isareti; paketlenmis ffmpeg'e giden baglantidan ayirt etmek icin.
const FFMPEG_STAMP: &str = "ffmpeg.sha256";

#[derive(Deserialize)]
struct Pins {
    ytdlp: String,
    deno: String,
    ffmpeg: FfmpegPin,
}

#[derive(Deserialize)]
struct FfmpegPin {
    tag: String,
    short: String,
}

fn pins() -> &'static Pins {
    static PINS: OnceLock<Pins> = OnceLock::new();
    PINS.get_or_init(|| serde_json::from_str(include_str!("../tools.json")).expect("tools.json gecersiz"))
}

/// Yayincilarin bu platform icin dosya adlari (scripts/fetch-sidecars.mjs TARGETS ile ayni).
struct Platform {
    ytdlp: &'static str,
    deno: &'static str,
    ffmpeg: Option<&'static str>,
}

fn platform() -> Option<Platform> {
    let p = |ytdlp, deno, ffmpeg| Some(Platform { ytdlp, deno, ffmpeg });
    match (std::env::consts::OS, std::env::consts::ARCH) {
        ("linux", "x86_64") => p("yt-dlp_linux", "x86_64-unknown-linux-gnu", Some("linux64")),
        ("linux", "aarch64") => p("yt-dlp_linux_aarch64", "aarch64-unknown-linux-gnu", Some("linuxarm64")),
        ("windows", "x86_64") => p("yt-dlp.exe", "x86_64-pc-windows-msvc", Some("win64")),
        ("windows", "aarch64") => p("yt-dlp_arm64.exe", "aarch64-pc-windows-msvc", Some("winarm64")),
        ("macos", "x86_64") => p("yt-dlp_macos", "x86_64-apple-darwin", None),
        ("macos", "aarch64") => p("yt-dlp_macos", "aarch64-apple-darwin", None),
        _ => None,
    }
}

fn ffmpeg_asset(platform: &str) -> String {
    let FfmpegPin { tag, short } = &pins().ffmpeg;
    let ext = if platform.starts_with("win") { "zip" } else { "tar.xz" };
    format!("ffmpeg-{tag}-latest-{platform}-lgpl-{short}.{ext}")
}

fn exe(name: &str) -> String {
    format!("{name}{EXE_SUFFIX}")
}

fn tools_dir_in(bin: &Path) -> PathBuf {
    bin.join("ffmpeg-tools")
}

fn tools_dir(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(tools_dir_in(&override_dir(app)?))
}

fn has_downloaded_ffmpeg(tools: &Path) -> bool {
    tools.join(FFMPEG_STAMP).is_file() && tools.join(exe("ffmpeg")).is_file()
}

pub fn is_ffprobe_installed(app: &AppHandle) -> bool {
    tools_dir(app).map(|d| d.join(exe("ffprobe")).is_file()).unwrap_or(false)
}

/// Calistirilacak ffmpeg (Donustur sayfasi): indirilen kopya, yoksa paketlenmis sidecar.
pub fn ffmpeg_program(app: &AppHandle) -> Option<PathBuf> {
    tools_dir(app)
        .ok()
        .filter(|d| has_downloaded_ffmpeg(d))
        .map(|d| d.join(exe("ffmpeg")))
        .or_else(|| sidecar("ffmpeg"))
}

/// `--ffmpeg-location` degeri: ffmpeg (+ varsa ffprobe) iceren klasor ya da paketlenmis ffmpeg.
pub fn ffmpeg_location(app: &AppHandle) -> Option<PathBuf> {
    let dir = tools_dir(app).ok();
    if let Some(dir) = dir.as_ref().filter(|d| has_downloaded_ffmpeg(d)) {
        return Some(dir.clone());
    }
    let bundled = sidecar("ffmpeg")?;
    if let Some(dir) = dir.filter(|d| d.join(exe("ffprobe")).is_file()) {
        if link_ffmpeg(&bundled, &dir.join(exe("ffmpeg"))).is_ok() {
            return Some(dir);
        }
    }
    Some(bundled)
}

pub fn deno_path(app: &AppHandle) -> Option<PathBuf> {
    override_dir(app)
        .ok()
        .map(|d| d.join(exe("deno")))
        .filter(|p| p.is_file())
        .or_else(|| sidecar("deno"))
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

#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ToolStatus {
    id: &'static str,
    /// Kullanilabilir bir kopya var (indirilmis ya da paketlenmis).
    installed: bool,
    /// Uygulamayla paketlenmis sidecar kullaniliyor; indirme gerekmez.
    bundled: bool,
    /// Indirilen kopya uygulamanin istedigi surumden farkli; calisir ama yenilenmeli.
    outdated: bool,
    /// Bu platform icin indirme kaynagi var.
    downloadable: bool,
    /// Yaklasik indirme boyutu (MB).
    download_mb: u32,
}

fn statuses(bin: &Path, bundled: &dyn Fn(&str) -> bool) -> Vec<ToolStatus> {
    let platform = platform();
    let windows = cfg!(windows);
    let tools = tools_dir_in(bin);
    let ffmpeg_downloadable = platform.as_ref().is_some_and(|p| p.ffmpeg.is_some());
    let deno_stamp = fs::read_to_string(bin.join(DENO_VERSION_FILE)).ok();
    let deno_downloaded = bin.join(exe("deno")).is_file();
    let status = |id, downloaded: bool, outdated, downloadable, download_mb| {
        let bundled = !downloaded && id != "ffprobe" && bundled(id);
        ToolStatus { id, installed: downloaded || bundled, bundled, outdated, downloadable, download_mb }
    };
    vec![
        status("yt-dlp", bin.join(exe("yt-dlp")).is_file(), false, platform.is_some(), if windows { 18 } else { 40 }),
        status(
            "deno",
            deno_downloaded,
            deno_downloaded && deno_stamp.as_deref().map(str::trim) != Some(pins().deno.as_str()),
            platform.is_some(),
            45,
        ),
        status("ffmpeg", has_downloaded_ffmpeg(&tools), false, ffmpeg_downloadable, 135),
        status("ffprobe", tools.join(exe("ffprobe")).is_file(), false, ffmpeg_downloadable, 135),
    ]
}

/// `<hash>  <ad>` satirlarindan dosyanin SHA-256'si. deno'nun Windows `.sha256sum`
/// dosyalari PowerShell tablosudur ve yalnizca tek bir hash icerir.
fn hash_from_list(list: &str, file_name: &str) -> Option<String> {
    let is_hash = |s: &str| s.len() == 64 && s.bytes().all(|b| b.is_ascii_hexdigit());
    let named = list.lines().find_map(|line| {
        let mut parts = line.split_whitespace();
        let hash = parts.next()?;
        let name = parts.next()?.trim_start_matches('*');
        (name == file_name && is_hash(hash)).then(|| hash.to_ascii_lowercase())
    });
    named.or_else(|| {
        let mut hashes = list.split(|c: char| !c.is_ascii_hexdigit()).filter(|s| is_hash(s));
        match (hashes.next(), hashes.next()) {
            (Some(only), None) if list.contains(file_name) => Some(only.to_ascii_lowercase()),
            _ => None,
        }
    })
}

fn client(proxy: Option<&str>) -> Result<reqwest::Client, String> {
    if rustls::crypto::CryptoProvider::get_default().is_none() {
        let _ = rustls::crypto::ring::default_provider().install_default();
    }
    let mut builder = reqwest::Client::builder().user_agent(concat!("Vidra/", env!("CARGO_PKG_VERSION")));
    if let Some(proxy) = proxy.map(str::trim).filter(|p| !p.is_empty()) {
        builder = builder.proxy(reqwest::Proxy::all(proxy).map_err(|e| format!("Proxy adresi geçersiz: {e}"))?);
    }
    builder.build().map_err(|e| e.to_string())
}

async fn fetch_text(client: &reqwest::Client, url: &str) -> Result<String, String> {
    client
        .get(url)
        .send()
        .await
        .and_then(|r| r.error_for_status())
        .map_err(|e| format!("Doğrulama listesi indirilemedi: {e}"))?
        .text()
        .await
        .map_err(|e| e.to_string())
}

type Progress<'a> = &'a (dyn Fn(u8) + Sync);

/// Dosyayi indirir, ilerlemeyi yuzde olarak bildirir ve SHA-256'yi `expected` ile karsilastirir.
async fn download_verified(client: &reqwest::Client, url: &str, expected: &str, dest: &Path, progress: Progress<'_>) -> Result<(), String> {
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
    if format!("{:x}", hasher.finalize()) != expected {
        return Err("İndirilen dosya doğrulanamadı (SHA-256 uyuşmuyor).".into());
    }
    Ok(())
}

#[cfg(unix)]
fn make_executable(path: &Path) -> Result<(), String> {
    use std::os::unix::fs::PermissionsExt;
    fs::set_permissions(path, fs::Permissions::from_mode(0o755)).map_err(|e| format!("Çalıştırma izni verilemedi: {e}"))
}

#[cfg(not(unix))]
fn make_executable(_path: &Path) -> Result<(), String> {
    Ok(())
}

/// Arsiv icindeki yolu `wanted` sonekiyle (ornegin `bin/ffprobe`) eslesen dosyalari cikarir.
/// Her hedef once `.part` olarak yazilir; hepsi bulunursa yerine tasinir.
fn extract(archive: &Path, wanted: &[(String, PathBuf)]) -> Result<(), String> {
    let matches = |name: &str, suffix: &str| name == suffix || name.ends_with(&format!("/{suffix}"));
    let part = |dest: &Path| dest.with_extension("part");
    let mut found = vec![false; wanted.len()];
    let mut write = |index: usize, reader: &mut dyn std::io::Read| -> Result<(), String> {
        let dest = part(&wanted[index].1);
        let mut out = fs::File::create(&dest).map_err(|e| e.to_string())?;
        std::io::copy(reader, &mut out).map_err(|e| format!("Arşiv açılamadı: {e}"))?;
        found[index] = true;
        Ok(())
    };

    let name = archive.to_string_lossy();
    if name.ends_with(".zip") {
        let file = fs::File::open(archive).map_err(|e| e.to_string())?;
        let mut zip = zip::ZipArchive::new(file).map_err(|e| format!("Arşiv açılamadı: {e}"))?;
        for i in 0..zip.len() {
            let mut entry = zip.by_index(i).map_err(|e| e.to_string())?;
            let entry_name = entry.name().replace('\\', "/");
            if let Some(index) = wanted.iter().position(|(suffix, _)| matches(&entry_name, suffix)) {
                write(index, &mut entry)?;
            }
        }
    } else {
        extract_tar_xz(archive, &mut |entry_name, reader| {
            match wanted.iter().position(|(suffix, _)| matches(entry_name, suffix)) {
                Some(index) => write(index, reader),
                None => Ok(()),
            }
        })?;
    }

    if let Some(missing) = wanted.iter().zip(&found).find(|(_, f)| !**f) {
        return Err(format!("Arşivde {} yok.", missing.0 .0));
    }
    for (_, dest) in wanted {
        if dest.extension().is_none_or(|ext| ext != "txt") {
            make_executable(&part(dest))?;
        }
        fs::rename(part(dest), dest).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg(target_os = "linux")]
fn extract_tar_xz(archive: &Path, visit: &mut dyn FnMut(&str, &mut dyn std::io::Read) -> Result<(), String>) -> Result<(), String> {
    // Akisla acilir; arsivin acilmis hali (~500 MB) bellege alinmaz.
    let file = std::io::BufReader::new(fs::File::open(archive).map_err(|e| e.to_string())?);
    let mut tar = tar::Archive::new(liblzma::read::XzDecoder::new(file));
    for entry in tar.entries().map_err(|e| e.to_string())? {
        let mut entry = entry.map_err(|e| format!("Arşiv açılamadı: {e}"))?;
        let path = entry.path().map_err(|e| e.to_string())?.to_string_lossy().into_owned();
        visit(&path, &mut entry)?;
    }
    Ok(())
}

#[cfg(not(target_os = "linux"))]
fn extract_tar_xz(_archive: &Path, _visit: &mut dyn FnMut(&str, &mut dyn std::io::Read) -> Result<(), String>) -> Result<(), String> {
    Err("Bu platformda .tar.xz açılamıyor.".into())
}

/// Indirmeyi `dir`deki gecici bir dosyaya yapar; is bitince (hata olsa da) siler.
async fn with_download<T>(
    client: &reqwest::Client,
    dir: &Path,
    url: &str,
    expected: &str,
    progress: Progress<'_>,
    then: impl FnOnce(PathBuf) -> Result<T, String> + Send + 'static,
) -> Result<T, String>
where
    T: Send + 'static,
{
    fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    let file_name = url.rsplit('/').next().unwrap_or("download");
    // Uzanti korunur: extract() arsiv turunu ondan anlar.
    let temp = dir.join(format!("indiriliyor-{file_name}"));
    let result = match download_verified(client, url, expected, &temp, progress).await {
        // Arsiv acmak CPU'yu birkac saniye mesgul eder; async calisani bloklamasin.
        Ok(()) => {
            let path = temp.clone();
            tauri::async_runtime::spawn_blocking(move || then(path)).await.map_err(|e| e.to_string())?
        }
        Err(e) => Err(e),
    };
    let _ = fs::remove_file(&temp);
    result
}

async fn install_ytdlp(client: &reqwest::Client, bin: &Path, progress: Progress<'_>) -> Result<(), String> {
    let asset = platform().ok_or("Bu platform için hazır yt-dlp yok.")?.ytdlp;
    let base = format!("https://github.com/yt-dlp/yt-dlp/releases/download/{}", pins().ytdlp);
    let sums = fetch_text(client, &format!("{base}/SHA2-256SUMS")).await?;
    let expected = hash_from_list(&sums, asset).ok_or_else(|| format!("{asset} için doğrulama bilgisi yok."))?;
    let target = bin.join(exe("yt-dlp"));
    let version = pins().ytdlp.clone();
    with_download(client, bin, &format!("{base}/{asset}"), &expected, progress, move |file| {
        make_executable(&file)?;
        // Calisan bir indirme eski dosyayi kullaniyor olabilir; bos olunca yerine konur.
        fs::rename(&file, crate::dependencies::staged_ytdlp(&target)).map_err(|e| e.to_string())?;
        crate::dependencies::YTDLP_GATE.swap_if_idle(&target);
        // dependencies::prune_stale_ytdlp paketlenmis surumle bu dosyayi karsilastirir.
        let _ = fs::write(target.with_file_name(crate::dependencies::YTDLP_VERSION_FILE), version);
        Ok(())
    })
    .await
}

async fn install_deno(client: &reqwest::Client, bin: &Path, progress: Progress<'_>) -> Result<(), String> {
    let triple = platform().ok_or("Bu platform için hazır deno yok.")?.deno;
    let version = pins().deno.clone();
    let asset = format!("deno-{triple}.zip");
    let base = format!("https://github.com/denoland/deno/releases/download/{version}");
    let expected = hash_from_list(&fetch_text(client, &format!("{base}/{asset}.sha256sum")).await?, &asset)
        .ok_or_else(|| format!("{asset} için doğrulama bilgisi yok."))?;
    let bin_owned = bin.to_path_buf();
    with_download(client, bin, &format!("{base}/{asset}"), &expected, progress, move |zip| {
        extract(&zip, &[(exe("deno"), bin_owned.join(exe("deno")))])?;
        fs::write(bin_owned.join(DENO_VERSION_FILE), version).map_err(|e| e.to_string())
    })
    .await
}

/// BtbN arsivinden istenen araclari (ve ffmpeg ile birlikte lisans metnini) cikarir.
async fn install_ffmpeg_tools(
    client: &reqwest::Client,
    bin: &Path,
    with_ffmpeg: bool,
    with_ffprobe: bool,
    progress: Progress<'_>,
) -> Result<(), String> {
    let platform = platform().and_then(|p| p.ffmpeg).ok_or("Bu platform için hazır FFmpeg yok.")?;
    let asset = ffmpeg_asset(platform);
    let sums = fetch_text(client, &format!("{FFMPEG_BASE_URL}/checksums.sha256")).await?;
    let expected = hash_from_list(&sums, &asset).ok_or_else(|| format!("{asset} için doğrulama bilgisi yok."))?;
    let tools = tools_dir_in(bin);
    let mut wanted = Vec::new();
    if with_ffmpeg {
        wanted.push((format!("bin/{}", exe("ffmpeg")), tools.join(exe("ffmpeg"))));
        wanted.push(("LICENSE.txt".to_string(), tools.join("FFmpeg-LICENSE.txt")));
    }
    if with_ffprobe {
        wanted.push((format!("bin/{}", exe("ffprobe")), tools.join(exe("ffprobe"))));
    }
    let stamp = with_ffmpeg.then(|| (tools.join(FFMPEG_STAMP), expected.clone()));
    let tools_owned = tools.clone();
    with_download(client, &tools, &format!("{FFMPEG_BASE_URL}/{asset}"), &expected, progress, move |archive| {
        // Paketlenmis ffmpeg'e giden eski baglanti yerine gercek dosya yazilacak.
        if with_ffmpeg {
            let _ = fs::remove_file(tools_owned.join(exe("ffmpeg")));
        }
        extract(&archive, &wanted)?;
        if let Some((path, hash)) = stamp {
            fs::write(path, hash).map_err(|e| e.to_string())?;
        }
        Ok(())
    })
    .await
}

async fn install(bin: &Path, tool: &str, with_ffprobe: bool, proxy: Option<&str>, progress: Progress<'_>) -> Result<(), String> {
    let client = client(proxy)?;
    match tool {
        "yt-dlp" => install_ytdlp(&client, bin, progress).await,
        "deno" => install_deno(&client, bin, progress).await,
        "ffmpeg" => install_ffmpeg_tools(&client, bin, true, with_ffprobe, progress).await,
        "ffprobe" => install_ffmpeg_tools(&client, bin, false, true, progress).await,
        _ => Err(format!("Bilinmeyen bileşen: {tool}")),
    }
}

#[tauri::command]
pub fn tools_status(app: AppHandle) -> Result<Vec<ToolStatus>, String> {
    let bin = override_dir(&app)?;
    Ok(statuses(&bin, &|id| sidecar(id).is_some()))
}

/// Bileseni indirip kurar. `ffmpeg` icin `with_ffprobe` ayni arsivden ffprobe'u da cikarir.
#[tauri::command]
pub async fn install_tool(
    app: AppHandle,
    tool: String,
    with_ffprobe: Option<bool>,
    proxy: Option<String>,
    on_progress: Channel<u8>,
) -> Result<(), String> {
    let bin = override_dir(&app)?;
    install(&bin, &tool, with_ffprobe.unwrap_or(false), proxy.as_deref(), &|percent| {
        let _ = on_progress.send(percent);
    })
    .await
}

#[tauri::command]
pub fn remove_ffprobe(app: AppHandle) -> Result<(), String> {
    let path = tools_dir(&app)?.join(exe("ffprobe"));
    if path.exists() {
        fs::remove_file(&path).map_err(|e| format!("ffprobe silinemedi: {e}"))?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn finds_hash_for_asset() {
        let list = "aaaa  other.zip\n\
            7709b4c1cd28d4da7cc9398c270eecc3836530bf9a0238ceb54b679abb06eac9  ffmpeg-n9.0-latest-linux64-lgpl-9.0.tar.xz\n\
            1111111111111111111111111111111111111111111111111111111111111111  ffmpeg-n9.0-latest-linux64-lgpl-shared-9.0.tar.xz\n";
        assert_eq!(
            hash_from_list(list, "ffmpeg-n9.0-latest-linux64-lgpl-9.0.tar.xz").as_deref(),
            Some("7709b4c1cd28d4da7cc9398c270eecc3836530bf9a0238ceb54b679abb06eac9")
        );
        assert_eq!(hash_from_list(list, "missing.tar.xz"), None);
    }

    #[test]
    fn reads_single_hash_from_powershell_table() {
        let list = "\r\nAlgorithm       Hash                                                                   Path\r\n\
            ---------       ----                                                                   ----\r\n\
            SHA256          ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789       C:\\a\\deno-x86_64-pc-windows-msvc.zip\r\n";
        assert_eq!(
            hash_from_list(list, "deno-x86_64-pc-windows-msvc.zip").as_deref(),
            Some("abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789")
        );
    }

    #[test]
    fn pins_and_asset_names_match_upstream() {
        assert!(pins().deno.starts_with('v'));
        assert_eq!(ffmpeg_asset("linux64"), "ffmpeg-n9.0-latest-linux64-lgpl-9.0.tar.xz");
        assert_eq!(ffmpeg_asset("win64"), "ffmpeg-n9.0-latest-win64-lgpl-9.0.zip");
    }

    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("vidra-tools-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn status_prefers_downloads_and_flags_old_deno() {
        let bin = temp_dir("status");
        let get = |list: &[ToolStatus], id: &str| list.iter().find(|s| s.id == id).map(|s| (s.installed, s.bundled, s.outdated)).unwrap();

        let empty = statuses(&bin, &|_| false);
        assert!(empty.iter().all(|s| !s.installed));
        let bundled = statuses(&bin, &|id| id != "ffmpeg");
        assert_eq!(get(&bundled, "yt-dlp"), (true, true, false));
        assert_eq!(get(&bundled, "ffmpeg"), (false, false, false));

        fs::write(bin.join(exe("deno")), "").unwrap();
        fs::write(bin.join(DENO_VERSION_FILE), "v1.0.0").unwrap();
        assert_eq!(get(&statuses(&bin, &|_| true), "deno"), (true, false, true));
        fs::write(bin.join(DENO_VERSION_FILE), &pins().deno).unwrap();
        assert_eq!(get(&statuses(&bin, &|_| false), "deno"), (true, false, false));

        // Paketlenmis ffmpeg'e baglanti indirilmis ffmpeg sayilmaz.
        let tools = tools_dir_in(&bin);
        fs::create_dir_all(&tools).unwrap();
        fs::write(tools.join(exe("ffmpeg")), "").unwrap();
        assert!(!has_downloaded_ffmpeg(&tools));
        fs::write(tools.join(FFMPEG_STAMP), "x").unwrap();
        assert!(has_downloaded_ffmpeg(&tools));
        fs::remove_dir_all(&bin).unwrap();
    }

    #[test]
    fn extracts_only_wanted_files_from_zip() {
        let dir = temp_dir("zip");
        let archive = dir.join("a.zip");
        {
            let mut zip = zip::ZipWriter::new(fs::File::create(&archive).unwrap());
            let options = zip::write::SimpleFileOptions::default();
            for (name, body) in [("deno", "deno!"), ("other/deno-docs.txt", "no")] {
                zip.start_file(name, options).unwrap();
                zip.write_all(body.as_bytes()).unwrap();
            }
            zip.finish().unwrap();
        }
        let dest = dir.join("out-deno");
        extract(&archive, &[("deno".into(), dest.clone())]).unwrap();
        assert_eq!(fs::read_to_string(&dest).unwrap(), "deno!");
        assert!(extract(&archive, &[("bin/ffprobe".into(), dir.join("x"))]).unwrap_err().contains("bin/ffprobe"));
        fs::remove_dir_all(&dir).unwrap();
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn extracts_ffmpeg_tools_from_tar_xz() {
        let dir = temp_dir("tar");
        let mut tar_bytes = Vec::new();
        {
            let mut builder = tar::Builder::new(&mut tar_bytes);
            for (name, body) in [("ffmpeg-x/LICENSE.txt", "lgpl"), ("ffmpeg-x/bin/ffmpeg", "ff"), ("ffmpeg-x/bin/ffprobe", "probe")] {
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

        let (probe, license) = (dir.join("ffprobe"), dir.join("LICENSE.txt"));
        extract(&archive, &[("bin/ffprobe".into(), probe.clone()), ("LICENSE.txt".into(), license.clone())]).unwrap();
        assert_eq!(fs::read_to_string(&probe).unwrap(), "probe");
        assert_eq!(fs::read_to_string(&license).unwrap(), "lgpl");
        assert!(!dir.join("ffmpeg").exists());
        use std::os::unix::fs::PermissionsExt;
        assert_eq!(fs::metadata(&probe).unwrap().permissions().mode() & 0o777, 0o755);
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

    fn run_version(path: &Path, arg: &str) -> String {
        let out = std::process::Command::new(path).arg(arg).output().unwrap();
        String::from_utf8_lossy(&out.stdout).into_owned()
    }

    /// Gercek kaynaklardan indirir (~220 MB): `cargo test -- --ignored real_install`
    #[test]
    #[ignore]
    fn real_install_of_all_tools() {
        let bin = temp_dir("real");
        tauri::async_runtime::block_on(async {
            for tool in ["yt-dlp", "deno", "ffmpeg"] {
                install(&bin, tool, true, None, &|_| {}).await.unwrap();
            }
        });
        assert_eq!(run_version(&bin.join(exe("yt-dlp")), "--version").trim(), pins().ytdlp);
        assert!(run_version(&bin.join(exe("deno")), "--version").starts_with("deno "));
        let tools = tools_dir_in(&bin);
        assert!(run_version(&tools.join(exe("ffmpeg")), "-version").starts_with("ffmpeg version"));
        assert!(run_version(&tools.join(exe("ffprobe")), "-version").starts_with("ffprobe version"));
        assert!(tools.join("FFmpeg-LICENSE.txt").is_file());
        let status = statuses(&bin, &|_| false);
        assert!(status.iter().all(|s| s.installed && !s.outdated), "{status:?}");
        fs::remove_dir_all(&bin).unwrap();
    }
}
