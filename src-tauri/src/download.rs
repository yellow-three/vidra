use std::collections::{HashMap, HashSet};
use std::io::{BufRead, BufReader, Read};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager};
use serde_json::{json, Value};

use crate::dependencies;

const MAX_CONCURRENT: usize = 2;
const PROGRESS_PREFIX: &str = "[progress] ";
const FILE_PREFIX: &str = "FILE:";
const DEST_PREFIX: &str = "DEST:";

#[derive(Clone)]
pub struct VideoMeta {
    pub title: String,
    pub url: String,
    pub duration: Option<f64>,
    pub thumbnail: Option<String>,
}

/// Kullanicinin secebilecegi indirme secenekleri; UI'a `formatId` olarak gider.
#[derive(Debug, PartialEq)]
pub enum DownloadOption {
    Video(u64),
    BestVideo,
    Mp3,
    M4a,
}

impl DownloadOption {
    pub fn parse(id: &str) -> Option<Self> {
        match id {
            "audio-mp3" => Some(Self::Mp3),
            "audio-m4a" => Some(Self::M4a),
            "video-best" => Some(Self::BestVideo),
            _ => id.strip_prefix("video-")?.parse().ok().map(Self::Video),
        }
    }

    fn is_audio(&self) -> bool {
        matches!(self, Self::Mp3 | Self::M4a)
    }

    fn label(&self) -> String {
        match self {
            Self::Video(h) => format!("{h}p"),
            Self::BestVideo => "En iyi".to_string(),
            Self::Mp3 => "MP3".to_string(),
            Self::M4a => "M4A".to_string(),
        }
    }
}

#[derive(Clone, Default)]
struct Shared {
    active: Arc<Mutex<HashSet<String>>>,
    children: Arc<Mutex<HashMap<String, Child>>>,
    queue: Arc<Mutex<Vec<QueueItem>>>,
    meta: Arc<Mutex<HashMap<String, VideoMeta>>>,
}

pub struct DownloadManager {
    shared: Shared,
}

#[derive(Clone)]
pub struct QueueItem {
    pub id: String,
    pub url: String,
    pub format_id: String,
}

fn emit_progress(app: &AppHandle, payload: Value) {
    let _ = app.emit("queue-progress", payload);
}

fn emit_error(app: &AppHandle, id: &str, message: impl Into<String>) {
    emit_progress(app, json!({ "id": id, "status": "error", "message": message.into() }));
}

/// yt-dlp stderr'inden kullaniciya gosterilecek son anlamli satirlar.
fn last_error_lines(stderr: &str) -> String {
    let mut lines = stderr
        .lines()
        .filter(|l| !l.starts_with("[debug]") && !l.starts_with("WARNING:") && !l.trim().is_empty())
        .rev()
        .take(2)
        .collect::<Vec<_>>();
    lines.reverse();
    lines.join("\n")
}

impl DownloadManager {
    pub fn new() -> Self {
        Self { shared: Shared::default() }
    }

    pub fn analyze_video(&self, app: AppHandle, id: String, url: String) {
        let ytdlp = match dependencies::ytdlp_path(&app) {
            Ok(p) if p.exists() => p,
            Ok(_) => return emit_error(&app, &id, "yt-dlp henüz kurulmadı, kurulumun bitmesini bekleyin."),
            Err(e) => return emit_error(&app, &id, format!("yt-dlp bulunamadi: {e}")),
        };

        emit_progress(&app, json!({
            "id": id,
            "status": "analyzing",
            "title": "Video analiz ediliyor..."
        }));

        let meta = self.shared.meta.clone();

        std::thread::spawn(move || {
            let output = match Command::new(&ytdlp)
                .args([url.as_str(), "-J", "--no-playlist"])
                .args(dependencies::js_runtime_args())
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .output()
            {
                Ok(o) => o,
                Err(e) => return emit_error(&app, &id, format!("yt-dlp calistirilamadi: {e}")),
            };

            if !output.status.success() {
                let msg = last_error_lines(&String::from_utf8_lossy(&output.stderr));
                return emit_error(&app, &id, if msg.is_empty() { "Analiz hatasi".to_string() } else { msg });
            }

            let data: Value = match serde_json::from_slice(&output.stdout) {
                Ok(v) => v,
                Err(e) => return emit_error(&app, &id, format!("JSON cozumleme hatasi: {e}")),
            };

            let title = data["title"].as_str().unwrap_or("Bilinmeyen video").to_string();
            let duration = data["duration"].as_f64();
            let thumbnail = data["thumbnail"].as_str().map(|s| s.to_string());
            let formats = build_options(data["formats"].as_array().map(Vec::as_slice).unwrap_or_default());

            meta.lock().unwrap().insert(id.clone(), VideoMeta {
                title: title.clone(),
                url: url.clone(),
                duration,
                thumbnail: thumbnail.clone(),
            });

            emit_progress(&app, json!({
                "id": id,
                "status": "ready-to-select",
                "title": title,
                "duration": duration,
                "thumbnail": thumbnail,
                "formats": formats,
            }));
        });
    }

    pub fn start_download(&self, app: AppHandle, id: String, url: String, format_id: String) {
        {
            let mut active = self.shared.active.lock().unwrap();
            if active.len() >= MAX_CONCURRENT {
                self.shared.queue.lock().unwrap().push(QueueItem { id: id.clone(), url, format_id });
                emit_progress(&app, json!({
                    "id": id,
                    "status": "downloading",
                    "percent": 0,
                    "speed": "",
                    "eta": "",
                    "message": "Sirada bekliyor..."
                }));
                return;
            }
            active.insert(id.clone());
        }

        run_download(app, self.shared.clone(), QueueItem { id, url, format_id });
    }

    pub fn cancel_download(&self, app: &AppHandle, id: &str) {
        let was_queued = {
            let mut queue = self.shared.queue.lock().unwrap();
            let before = queue.len();
            queue.retain(|item| item.id != id);
            queue.len() != before
        };
        self.shared.active.lock().unwrap().remove(id);

        // Calisan surec varsa indirme thread'i "cancelled" bildirir.
        match self.shared.children.lock().unwrap().remove(id) {
            Some(child) => kill_tree(child),
            None if was_queued => {
                emit_progress(app, json!({ "id": id, "status": "cancelled", "message": "İptal edildi" }));
            }
            None => {}
        }
        try_dequeue(app, &self.shared);
    }

    pub fn convert_file(
        &self,
        app: AppHandle,
        id: String,
        input_path: String,
        output_format: String,
        quality: String,
    ) {
        let ffmpeg = match dependencies::resolve_ffmpeg(&app) {
            Some(p) => p,
            None => {
                let _ = app.emit("convert-progress", json!({
                    "id": id,
                    "percent": 0,
                    "status": "error",
                    "message": "FFmpeg bulunamadi"
                }));
                return;
            }
        };

        let input = std::path::Path::new(&input_path);
        let output_dir = input.parent().unwrap_or(std::path::Path::new("."));
        let stem = input.file_stem().and_then(|s| s.to_str()).unwrap_or("output");

        let (ext, args) = match output_format.as_str() {
            "mp3" => {
                let bitrate = match quality.as_str() {
                    "high" => "320k",
                    "medium" => "192k",
                    _ => "96k",
                };
                (".mp3", vec![
                    "-vn".to_string(),
                    "-acodec".to_string(),
                    "libmp3lame".to_string(),
                    "-ab".to_string(),
                    bitrate.to_string(),
                ])
            }
            "webm" => {
                let crf = match quality.as_str() {
                    "high" => "18",
                    "medium" => "28",
                    _ => "35",
                };
                (".webm", vec![
                    "-c:v".to_string(),
                    "libvpx".to_string(),
                    "-crf".to_string(),
                    crf.to_string(),
                    "-b:v".to_string(),
                    "0".to_string(),
                    "-c:a".to_string(),
                    "libvorbis".to_string(),
                ])
            }
            _ => {
                let crf = match quality.as_str() {
                    "high" => "18",
                    "medium" => "28",
                    _ => "35",
                };
                (".mp4", vec![
                    "-c:v".to_string(),
                    "libx264".to_string(),
                    "-preset".to_string(),
                    "medium".to_string(),
                    "-crf".to_string(),
                    crf.to_string(),
                    "-c:a".to_string(),
                    "aac".to_string(),
                ])
            }
        };

        let output_path = output_dir.join(format!("{stem}_converted{ext}"));
        let output_str = output_path.to_string_lossy().to_string();

        let mut cmd_args: Vec<String> = vec![
            "-i".to_string(),
            input_path.clone(),
            "-y".to_string(),
        ];
        cmd_args.extend(args);
        cmd_args.push(output_str.clone());

        let id_clone = id.clone();
        let app_clone = app.clone();
        let active = self.shared.active.clone();

        active.lock().unwrap().insert(format!("convert_{id}"));

        std::thread::spawn(move || {
            let output = Command::new(&ffmpeg)
                .args(&cmd_args)
                .stderr(Stdio::piped())
                .stdout(Stdio::null())
                .output();

            active.lock().unwrap().remove(&format!("convert_{id_clone}"));

            match output {
                Ok(out) => {
                    if out.status.success() {
                        let _ = app_clone.emit("convert-progress", json!({
                            "id": id_clone,
                            "percent": 100,
                            "status": "complete",
                            "outputPath": output_str,
                        }));
                    } else {
                        let _ = app_clone.emit("convert-progress", json!({
                            "id": id_clone,
                            "percent": 0,
                            "status": "error",
                        }));
                    }
                }
                Err(e) => {
                    let _ = app_clone.emit("convert-progress", json!({
                        "id": id_clone,
                        "percent": 0,
                        "status": "error",
                        "message": format!("FFmpeg calistirilamadi: {e}"),
                    }));
                }
            }
        });
    }

    pub fn cancel_convert(&self, id: &str) {
        self.shared.active.lock().unwrap().remove(&format!("convert_{id}"));
    }
}

/// Ham yt-dlp format listesini sade seceneklere indirger: her cozunurluk icin bir video, arti MP3/M4A.
pub fn build_options(formats: &[Value]) -> Vec<Value> {
    let size_of = |f: &Value| f["filesize"].as_u64().or(f["filesize_approx"].as_u64());
    let is_video = |f: &Value| f["vcodec"].as_str().is_some_and(|c| c != "none");
    let is_audio_only = |f: &Value| {
        f["vcodec"].as_str() == Some("none") && f["acodec"].as_str().is_some_and(|c| c != "none")
    };

    let best_audio_size = formats
        .iter()
        .filter(|f| is_audio_only(f) && f["ext"].as_str() == Some("m4a"))
        .filter_map(size_of)
        .max();

    let mut heights: Vec<u64> = formats
        .iter()
        .filter(|f| is_video(f))
        .filter_map(|f| f["height"].as_u64())
        .collect();
    heights.sort_unstable_by(|a, b| b.cmp(a));
    heights.dedup();

    let mut options: Vec<Value> = heights
        .iter()
        .map(|&h| {
            let video_size = formats
                .iter()
                .filter(|f| is_video(f) && f["height"].as_u64() == Some(h))
                .filter_map(size_of)
                .max();
            let total = video_size.map(|v| v + best_audio_size.unwrap_or(0));
            json!({
                "formatId": format!("video-{h}"),
                "resolution": format!("{h}p"),
                "ext": "mp4",
                "note": "Video + ses",
                "filesize": format_filesize(total),
            })
        })
        .collect();

    if options.is_empty() {
        options.push(json!({
            "formatId": "video-best",
            "resolution": "En iyi",
            "ext": "mp4",
            "note": "Video + ses",
            "filesize": format_filesize(None),
        }));
    }

    options.push(json!({
        "formatId": "audio-mp3",
        "resolution": "Ses",
        "ext": "mp3",
        "note": "En iyi kalite",
        "filesize": format_filesize(best_audio_size),
    }));
    options.push(json!({
        "formatId": "audio-m4a",
        "resolution": "Ses",
        "ext": "m4a",
        "note": "Dönüştürmesiz",
        "filesize": format_filesize(best_audio_size),
    }));

    options
}

pub fn build_download_args(
    url: &str,
    option: &DownloadOption,
    out_dir: &Path,
    ffmpeg: Option<&Path>,
    subtitles: bool,
) -> Vec<String> {
    let mut args: Vec<String> = vec![
        url.to_string(),
        "-o".to_string(),
        out_dir.join("%(title)s.%(ext)s").to_string_lossy().to_string(),
        "--no-playlist".to_string(),
        "--newline".to_string(),
        "--progress".to_string(),
        "--progress-template".to_string(),
        format!("download:{PROGRESS_PREFIX}%(progress._percent_str)s|%(progress._speed_str)s|%(progress._eta_str)s"),
        "--print".to_string(),
        format!("before_dl:{DEST_PREFIX}%(filename)s"),
        "--print".to_string(),
        format!("after_move:{FILE_PREFIX}%(filepath)s"),
    ];

    let format_args: Vec<String> = match option {
        DownloadOption::Video(h) => vec![
            "-f".into(),
            format!("bv*[height<={h}]+ba/b[height<={h}]/bv*+ba/b"),
            // Once cozunurluk, ayni cozunurlukte MP4 uyumlu kodekler (H.264 + AAC).
            // `res` basta olmazsa H.264'lu 360p birlesik format 4K'nin onune gecer.
            "-S".into(),
            "res,vcodec:h264,acodec:m4a".into(),
            "--merge-output-format".into(),
            "mp4".into(),
        ],
        DownloadOption::BestVideo => vec![
            "-f".into(),
            "bv*+ba/b".into(),
            "--merge-output-format".into(),
            "mp4".into(),
        ],
        DownloadOption::Mp3 => vec![
            "-f".into(),
            "ba/b".into(),
            "-x".into(),
            "--audio-format".into(),
            "mp3".into(),
            "--audio-quality".into(),
            "0".into(),
        ],
        DownloadOption::M4a => vec![
            "-f".into(),
            "ba[ext=m4a]/ba/b".into(),
            "-x".into(),
            "--audio-format".into(),
            "m4a".into(),
        ],
    };
    args.extend(format_args);

    if subtitles && !option.is_audio() {
        // `--write-subs` eklenirse gomulduktan sonra .vtt dosyasi da diskte kalir.
        args.extend(["--embed-subs", "--sub-langs", "tr,en"].map(String::from));
    }

    if let Some(ff) = ffmpeg {
        args.push("--ffmpeg-location".to_string());
        args.push(ff.to_string_lossy().to_string());
    }

    args.extend(dependencies::js_runtime_args());
    args
}

#[derive(Debug, PartialEq)]
pub struct Progress {
    pub percent: f64,
    pub speed: String,
    pub eta: String,
}

pub fn parse_progress(line: &str) -> Option<Progress> {
    let mut parts = line.strip_prefix(PROGRESS_PREFIX)?.split('|').map(str::trim);
    let percent = parts.next()?.trim_end_matches('%').trim().parse().ok()?;
    let clean = |s: Option<&str>| {
        s.filter(|v| !matches!(*v, "N/A" | "Unknown" | "NA")).unwrap_or("").to_string()
    };
    Some(Progress { percent, speed: clean(parts.next()), eta: clean(parts.next()) })
}

fn download_dir(app: &AppHandle, settings: &Value) -> PathBuf {
    settings
        .get("downloadDir")
        .and_then(Value::as_str)
        .filter(|s| !s.is_empty())
        .map(PathBuf::from)
        .unwrap_or_else(|| app.path().download_dir().unwrap_or_default())
}

fn run_download(app: AppHandle, shared: Shared, item: QueueItem) {
    let QueueItem { id, url, format_id } = item;
    let fail = |app: &AppHandle, shared: &Shared, msg: String| {
        shared.active.lock().unwrap().remove(&id);
        emit_error(app, &id, msg);
        try_dequeue(app, shared);
    };

    let Some(option) = DownloadOption::parse(&format_id) else {
        return fail(&app, &shared, format!("Bilinmeyen format: {format_id}"));
    };
    let ytdlp = match dependencies::ytdlp_path(&app) {
        Ok(p) if p.exists() => p,
        _ => return fail(&app, &shared, "yt-dlp kurulu değil.".to_string()),
    };
    let ffmpeg = dependencies::resolve_ffmpeg(&app);
    if ffmpeg.is_none() {
        return fail(&app, &shared, "FFmpeg kurulu değil; video birleştirme ve MP3 için gerekli.".to_string());
    }

    let settings = crate::read_settings_value(&app).unwrap_or_else(|_| json!({}));
    let subtitles = settings.get("downloadSubtitles").and_then(Value::as_bool).unwrap_or(false);
    let auto_open = settings.get("autoOpenFolder").and_then(Value::as_bool).unwrap_or(true);
    let args = build_download_args(&url, &option, &download_dir(&app, &settings), ffmpeg.as_deref(), subtitles);

    let mut cmd = Command::new(&ytdlp);
    cmd.args(&args).stdout(Stdio::piped()).stderr(Stdio::piped());
    // yt-dlp'nin baslattigi ffmpeg'ler de iptalde olsun diye ayri surec grubu.
    #[cfg(unix)]
    std::os::unix::process::CommandExt::process_group(&mut cmd, 0);
    let started = std::time::SystemTime::now();

    let mut child = match cmd.spawn() {
        Ok(c) => c,
        Err(e) => return fail(&app, &shared, format!("yt-dlp calistirilamadi: {e}")),
    };

    let stdout = child.stdout.take().expect("stdout piped");
    let mut stderr = child.stderr.take().expect("stderr piped");
    shared.children.lock().unwrap().insert(id.clone(), child);

    // Surec baslatilirken iptal geldiyse hemen sonlandir.
    if !shared.active.lock().unwrap().contains(&id) {
        if let Some(c) = shared.children.lock().unwrap().remove(&id) {
            kill_tree(c);
        }
    }

    std::thread::spawn(move || {
        // stderr ayri okunmazsa tampon dolunca yt-dlp kilitlenir.
        let stderr_reader = std::thread::spawn(move || {
            let mut buf = String::new();
            let _ = stderr.read_to_string(&mut buf);
            buf
        });

        let mut file_path = String::new();
        let mut dest = String::new();
        let mut last_percent = -1_i64;

        for line in BufReader::new(stdout).lines().map_while(Result::ok) {
            if let Some(path) = line.strip_prefix(DEST_PREFIX) {
                dest = path.trim().to_string();
            } else if let Some(path) = line.strip_prefix(FILE_PREFIX) {
                file_path = path.trim().to_string();
            } else if let Some(p) = parse_progress(&line) {
                let percent = p.percent as i64;
                if percent != last_percent {
                    last_percent = percent;
                    emit_progress(&app, json!({
                        "id": id,
                        "status": "downloading",
                        "percent": percent,
                        "speed": p.speed,
                        "eta": p.eta,
                        "message": null,
                    }));
                }
            }
        }

        let stderr_text = stderr_reader.join().unwrap_or_default();
        let child = shared.children.lock().unwrap().remove(&id);
        shared.active.lock().unwrap().remove(&id);

        let status = match child {
            Some(mut c) => c.wait().ok(),
            None => {
                remove_partial_files(Path::new(&dest), started);
                emit_progress(&app, json!({ "id": id, "status": "cancelled", "message": "İptal edildi" }));
                return try_dequeue(&app, &shared);
            }
        };

        if status.is_some_and(|s| s.success()) {
            emit_progress(&app, json!({ "id": id, "status": "complete", "percent": 100, "filePath": file_path }));
            if !file_path.is_empty() {
                save_history(&app, &shared.meta, &id, &file_path, &format_id, &option.label());
                if auto_open {
                    crate::reveal_file(&file_path);
                }
            }
        } else {
            let msg = last_error_lines(&stderr_text);
            emit_error(&app, &id, if msg.is_empty() { "Indirme hatasi".to_string() } else { msg });
        }

        try_dequeue(&app, &shared);
    });
}

fn kill_tree(mut child: Child) {
    #[cfg(unix)]
    unsafe {
        libc::kill(-(child.id() as i32), libc::SIGKILL);
    }
    #[cfg(windows)]
    let _ = Command::new("taskkill")
        .args(["/PID", &child.id().to_string(), "/T", "/F"])
        .output();
    let _ = child.kill();
    let _ = child.wait();
}

/// Iptal edilen indirmenin bu oturumda yazdigi dosyalari siler
/// (`Ad.f137.mp4.part`, `Ad.temp.mp4`, `Ad.en.vtt`, birlesmis `Ad.mp4` ...).
/// Daha once indirilmis ayni adli dosyalara degistirilme zamani sayesinde dokunmaz.
fn remove_partial_files(dest: &Path, started: std::time::SystemTime) {
    let (Some(dir), Some(stem)) = (dest.parent(), dest.file_stem().and_then(|s| s.to_str())) else {
        return;
    };
    let prefix = format!("{stem}.");
    // Dosya sistemi mtime'i kaba saatle yazar; yeni dosyalar `started`dan biraz once gorunebilir.
    let since = started - std::time::Duration::from_secs(2);
    let Ok(entries) = std::fs::read_dir(dir) else { return };
    for entry in entries.flatten() {
        let name = entry.file_name();
        let is_ours = name.to_str().is_some_and(|n| n.starts_with(&prefix));
        let is_new = entry.metadata().and_then(|m| m.modified()).is_ok_and(|t| t >= since);
        if is_ours && is_new {
            let _ = std::fs::remove_file(entry.path());
        }
    }
}

fn format_filesize(bytes: Option<u64>) -> String {
    match bytes {
        Some(b) if b >= 1_073_741_824 => format!("{:.1} GB", b as f64 / 1_073_741_824.0),
        Some(b) if b >= 1_048_576 => format!("{:.1} MB", b as f64 / 1_048_576.0),
        Some(b) if b >= 1024 => format!("{:.1} KB", b as f64 / 1024.0),
        Some(b) => format!("{b} B"),
        None => "Bilinmiyor".to_string(),
    }
}

fn try_dequeue(app: &AppHandle, shared: &Shared) {
    let item = {
        let mut q = shared.queue.lock().unwrap();
        let mut active = shared.active.lock().unwrap();
        if q.is_empty() || active.len() >= MAX_CONCURRENT {
            return;
        }
        let item = q.remove(0);
        active.insert(item.id.clone());
        item
    };

    run_download(app.clone(), shared.clone(), item);
}

fn save_history(
    app: &AppHandle,
    meta: &Arc<Mutex<HashMap<String, VideoMeta>>>,
    id: &str,
    file_path: &str,
    format_id: &str,
    quality: &str,
) {
    let meta_data = match meta.lock().unwrap().remove(id) {
        Some(m) => m,
        None => return,
    };

    let Ok(mut settings) = crate::read_settings_value(app) else {
        return;
    };

    let ext = std::path::Path::new(file_path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("mp4");
    let file_size = std::fs::metadata(file_path).ok().map(|m| m.len());

    let entry = json!({
        "id": id,
        "title": meta_data.title,
        "url": meta_data.url,
        "duration": meta_data.duration,
        "thumbnail": meta_data.thumbnail,
        "formatId": format_id,
        "quality": quality,
        "ext": ext,
        "fileSize": format_filesize(file_size),
        "filePath": file_path,
        "completedAt": chrono_now(),
    });

    let history = settings
        .as_object_mut()
        .and_then(|o| o.get_mut("history"))
        .and_then(|h| h.as_array_mut());

    if let Some(arr) = history {
        arr.insert(0, entry);
        arr.truncate(200);
    } else if let Some(obj) = settings.as_object_mut() {
        obj.insert("history".to_string(), json!([entry]));
    }

    let _ = crate::write_settings_value(app, &settings);
}

fn chrono_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    format!("{secs}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_download_options() {
        assert_eq!(DownloadOption::parse("video-1080"), Some(DownloadOption::Video(1080)));
        assert_eq!(DownloadOption::parse("video-best"), Some(DownloadOption::BestVideo));
        assert_eq!(DownloadOption::parse("audio-mp3"), Some(DownloadOption::Mp3));
        assert_eq!(DownloadOption::parse("audio-m4a"), Some(DownloadOption::M4a));
        assert_eq!(DownloadOption::parse("137"), None);
        assert_eq!(DownloadOption::parse("video-abc"), None);
    }

    #[test]
    fn parses_progress_lines() {
        assert_eq!(
            parse_progress("[progress]  45.3%|   1.20MiB/s|00:12"),
            Some(Progress { percent: 45.3, speed: "1.20MiB/s".into(), eta: "00:12".into() })
        );
        assert_eq!(
            parse_progress("[progress] 100.0%|N/A|Unknown"),
            Some(Progress { percent: 100.0, speed: "".into(), eta: "".into() })
        );
        assert_eq!(parse_progress("[download] 45.3% of 10MiB"), None);
        assert_eq!(parse_progress("FILE:/tmp/a.mp4"), None);
    }

    #[test]
    fn builds_options_per_height_plus_audio() {
        let formats = vec![
            json!({ "format_id": "140", "ext": "m4a", "vcodec": "none", "acodec": "mp4a.40.2", "filesize": 1_000_000 }),
            json!({ "format_id": "137", "ext": "mp4", "vcodec": "avc1", "acodec": "none", "height": 1080, "filesize": 9_000_000 }),
            json!({ "format_id": "248", "ext": "webm", "vcodec": "vp9", "acodec": "none", "height": 1080 }),
            json!({ "format_id": "136", "ext": "mp4", "vcodec": "avc1", "acodec": "none", "height": 720 }),
            json!({ "format_id": "sb0", "ext": "mhtml", "vcodec": "none", "acodec": "none" }),
        ];
        let ids: Vec<String> = build_options(&formats)
            .iter()
            .map(|o| o["formatId"].as_str().unwrap().to_string())
            .collect();
        assert_eq!(ids, ["video-1080", "video-720", "audio-mp3", "audio-m4a"]);
        assert_eq!(build_options(&formats)[0]["filesize"], "9.5 MB");
    }

    #[test]
    fn falls_back_to_best_video_without_heights() {
        let ids: Vec<String> = build_options(&[])
            .iter()
            .map(|o| o["formatId"].as_str().unwrap().to_string())
            .collect();
        assert_eq!(ids, ["video-best", "audio-mp3", "audio-m4a"]);
    }

    #[test]
    fn mp3_args_extract_audio_and_skip_subtitles() {
        let args = build_download_args("U", &DownloadOption::Mp3, Path::new("/out"), Some(Path::new("/ff")), true);
        let joined = args.join(" ");
        assert!(joined.contains("-x --audio-format mp3"));
        assert!(joined.contains("--ffmpeg-location /ff"));
        assert!(!joined.contains("--write-subs"));
        assert!(args.contains(&"/out/%(title)s.%(ext)s".to_string()));
    }

    #[test]
    fn removes_only_new_files_of_cancelled_download() {
        let dir = std::env::temp_dir().join(format!("ytd-test-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let old = dir.join("Video.mp3");
        std::fs::write(&old, "eski").unwrap();
        let started = std::time::SystemTime::now();
        std::fs::File::options().write(true).open(&old).unwrap()
            .set_modified(started - std::time::Duration::from_secs(60)).unwrap();
        for name in ["Video.f137.mp4.part", "Video.en.vtt", "Video 2.mp4"] {
            std::fs::write(dir.join(name), "x").unwrap();
        }

        remove_partial_files(&dir.join("Video.mp4"), started);

        let mut left: Vec<String> = std::fs::read_dir(&dir).unwrap()
            .map(|e| e.unwrap().file_name().into_string().unwrap())
            .collect();
        left.sort();
        std::fs::remove_dir_all(&dir).unwrap();
        assert_eq!(left, ["Video 2.mp4", "Video.mp3"]);
    }

    #[test]
    fn video_args_limit_height_and_merge_to_mp4() {
        let args = build_download_args("U", &DownloadOption::Video(720), Path::new("/out"), None, true);
        let joined = args.join(" ");
        assert!(joined.contains("-f bv*[height<=720]+ba/b[height<=720]/bv*+ba/b"));
        assert!(joined.contains("--merge-output-format mp4"));
        assert!(joined.contains("-S res,vcodec:h264,acodec:m4a"));
        assert!(joined.contains("--embed-subs"));
        assert!(!joined.contains("--ffmpeg-location"));
    }
}
