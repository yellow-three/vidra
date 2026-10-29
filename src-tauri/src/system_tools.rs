//! Sistemde (PATH) zaten kurulu ffmpeg / ffprobe / deno.
//!
//! Uygunsa kurulum ekrani bunlari indirmez. yt-dlp bilerek sistemden alinmaz: dagitim paketleri
//! cogu zaman eskidir ve `/usr/bin` altindaki kopya uygulama tarafindan guncellenemez.
//! ffmpeg ancak indirmelerin ve Donustur sayfasinin kullandigi encoder'lar varsa kabul edilir.
//! Sonuclar uygulama boyunca bir kez hesaplanir (her biri kisa bir surec calistirir).

use crate::dependencies::EXE_SUFFIX;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::OnceLock;

const MIN_FFMPEG_MAJOR: u32 = 5;
const MIN_DENO_MAJOR: u32 = 2;
/// MP3 (yt-dlp -x ve Donustur), MP4 sesi, WebM; H.264 ayrica secilir.
const REQUIRED_ENCODERS: [&str; 4] = ["libmp3lame", "aac", "libvpx", "libvorbis"];
/// Tercih sirasiyla: LGPL build'lerde OpenH264, dagitim paketlerinde genelde libx264.
const H264_ENCODERS: [&str; 2] = ["libopenh264", "libx264"];

pub struct SystemFfmpeg {
    pub ffmpeg: PathBuf,
    pub ffprobe: Option<PathBuf>,
    pub h264_encoder: &'static str,
}

fn find_in_path(name: &str) -> Option<PathBuf> {
    let file = format!("{name}{EXE_SUFFIX}");
    std::env::split_paths(&std::env::var_os("PATH")?)
        .map(|dir| dir.join(&file))
        .find(|p| p.is_file())
}

fn output(program: &Path, args: &[&str]) -> Option<String> {
    let mut cmd = Command::new(program);
    cmd.args(args);
    #[cfg(windows)]
    std::os::windows::process::CommandExt::creation_flags(&mut cmd, 0x0800_0000);
    let out = cmd.output().ok()?;
    out.status
        .success()
        .then(|| String::from_utf8_lossy(&out.stdout).into_owned())
}

/// `ffmpeg version 8.0.1-3ubuntu2`, `n7.1`, git build'leri (`N-1180-g...`, `2024-10-27-git-...`).
fn ffmpeg_major(version_output: &str) -> Option<u32> {
    let version = version_output.lines().next()?.strip_prefix("ffmpeg version ")?;
    if version.starts_with("N-") {
        return Some(u32::MAX);
    }
    let digits: String = version
        .trim_start_matches('n')
        .chars()
        .take_while(char::is_ascii_digit)
        .collect();
    let number: u32 = digits.parse().ok()?;
    // Tarihli git build'i surum numarasi tasimaz; yenidir.
    Some(if number >= 1000 { u32::MAX } else { number })
}

/// `deno 2.9.8 (stable, ...)`
fn deno_major(version_output: &str) -> Option<u32> {
    let version = version_output.lines().next()?.strip_prefix("deno ")?;
    version.split('.').next()?.parse().ok()
}

/// `ffmpeg -encoders` ciktisindan gerekenler varsa kullanilacak H.264 encoder'i.
fn pick_h264(encoders_output: &str) -> Option<&'static str> {
    let names: Vec<&str> = encoders_output
        .lines()
        .filter_map(|line| {
            let mut parts = line.split_whitespace();
            let flags = parts.next()?;
            // Baslik satirlari ("V..... = Video") ve aciklamalar ayiklanir.
            (flags.len() == 6 && flags.starts_with(['V', 'A', 'S']))
                .then(|| parts.next())
                .flatten()
        })
        .collect();
    if !REQUIRED_ENCODERS.iter().all(|e| names.contains(e)) {
        return None;
    }
    H264_ENCODERS.into_iter().find(|e| names.contains(e))
}

fn detect_ffmpeg() -> Option<SystemFfmpeg> {
    let ffmpeg = find_in_path("ffmpeg")?;
    if ffmpeg_major(&output(&ffmpeg, &["-version"])?)? < MIN_FFMPEG_MAJOR {
        return None;
    }
    let h264_encoder = pick_h264(&output(&ffmpeg, &["-hide_banner", "-encoders"])?)?;
    // yt-dlp `--ffmpeg-location` ile tek klasor alir; ffprobe ayni klasorde olmali.
    let ffprobe = ffmpeg.with_file_name(format!("ffprobe{EXE_SUFFIX}"));
    let ffprobe = (ffprobe.is_file() && output(&ffprobe, &["-version"]).is_some()).then_some(ffprobe);
    Some(SystemFfmpeg {
        ffmpeg,
        ffprobe,
        h264_encoder,
    })
}

fn detect_deno() -> Option<PathBuf> {
    let deno = find_in_path("deno")?;
    (deno_major(&output(&deno, &["--version"])?)? >= MIN_DENO_MAJOR).then_some(deno)
}

pub fn ffmpeg() -> Option<&'static SystemFfmpeg> {
    static FFMPEG: OnceLock<Option<SystemFfmpeg>> = OnceLock::new();
    FFMPEG.get_or_init(detect_ffmpeg).as_ref()
}

pub fn deno() -> Option<&'static PathBuf> {
    static DENO: OnceLock<Option<PathBuf>> = OnceLock::new();
    DENO.get_or_init(detect_deno).as_ref()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_ffmpeg_versions() {
        assert_eq!(
            ffmpeg_major("ffmpeg version 8.0.1-3ubuntu2+esm5 Copyright (c) 2000-2025"),
            Some(8)
        );
        assert_eq!(
            ffmpeg_major("ffmpeg version n9.0.2-36-g6882969ce9-20261027 Copyright"),
            Some(9)
        );
        assert_eq!(ffmpeg_major("ffmpeg version 4.4.2-0ubuntu0.22.04.1"), Some(4));
        assert_eq!(ffmpeg_major("ffmpeg version N-118000-g1234 Copyright"), Some(u32::MAX));
        assert_eq!(
            ffmpeg_major("ffmpeg version 2024-10-27-git-bdc76f467f-full_build"),
            Some(u32::MAX)
        );
        assert_eq!(ffmpeg_major("avconv version 12"), None);
    }

    #[test]
    fn parses_deno_versions() {
        assert_eq!(
            deno_major("deno 2.9.8 (stable, release, x86_64-unknown-linux-gnu)\nv8 14.0"),
            Some(2)
        );
        assert_eq!(deno_major("deno 1.46.3 (stable)"), Some(1));
        assert_eq!(deno_major("node v24"), None);
    }

    const ENCODERS: &str = "Encoders:\n V..... = Video\n A..... = Audio\n ------\n \
        V....D libx264              libx264 H.264\n V....D libvpx               libvpx VP8\n \
        A....D aac                  AAC\n A....D libmp3lame           libmp3lame MP3\n A....D libvorbis            libvorbis\n";

    #[test]
    fn picks_h264_encoder_when_required_encoders_exist() {
        assert_eq!(pick_h264(ENCODERS), Some("libx264"));
        let both = format!("{ENCODERS} V....D libopenh264          OpenH264\n");
        assert_eq!(pick_h264(&both), Some("libopenh264"));
        assert_eq!(pick_h264(&ENCODERS.replace("libmp3lame", "mp3_fake")), None);
        assert_eq!(pick_h264(&ENCODERS.replace("libx264", "h264_vaapi")), None);
    }
}
