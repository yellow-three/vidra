use std::collections::HashMap;
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager};
use serde_json::{json, Value};

use crate::dependencies;

const MAX_CONCURRENT: usize = 2;

#[derive(Clone)]
pub struct VideoMeta {
    pub title: String,
    pub url: String,
    pub duration: Option<f64>,
    pub thumbnail: Option<String>,
}

pub struct DownloadManager {
    active: Arc<Mutex<HashMap<String, ()>>>,
    queue: Arc<Mutex<Vec<QueueItem>>>,
    meta: Arc<Mutex<HashMap<String, VideoMeta>>>,
}

#[derive(Clone)]
pub struct QueueItem {
    pub id: String,
    pub url: String,
    pub format_id: Option<String>,
}

impl DownloadManager {
    pub fn new() -> Self {
        Self {
            active: Arc::new(Mutex::new(HashMap::new())),
            queue: Arc::new(Mutex::new(Vec::new())),
            meta: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn analyze_video(&self, app: AppHandle, id: String, url: String) {
        let ytdlp = match dependencies::ytdlp_path(&app) {
            Ok(p) => p,
            Err(e) => {
                let _ = app.emit("queue-progress", json!({
                    "id": id,
                    "status": "error",
                    "message": format!("yt-dlp bulunamadi: {e}")
                }));
                return;
            }
        };

        let _ = app.emit("queue-progress", json!({
            "id": id,
            "status": "analyzing",
            "title": "Video analiz ediliyor..."
        }));

        let meta = self.meta.clone();
        let id_clone = id.clone();

        std::thread::spawn(move || {
            let output = match Command::new(&ytdlp)
                .args([&url, "-J", "--no-playlist"])
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .output()
            {
                Ok(o) => o,
                Err(e) => {
                    let _ = app.emit("queue-progress", json!({
                        "id": id_clone,
                        "status": "error",
                        "message": format!("yt-dlp calistirilamadi: {e}")
                    }));
                    return;
                }
            };

            if !output.status.success() {
                let stderr = String::from_utf8_lossy(&output.stderr);
                let msg = stderr.lines()
                    .filter(|l| !l.starts_with("[debug]") && !l.trim().is_empty())
                    .rev()
                    .take(2)
                    .collect::<Vec<_>>()
                    .join("\n");
                let _ = app.emit("queue-progress", json!({
                    "id": id_clone,
                    "status": "error",
                    "message": if msg.is_empty() { "Analiz hatasi".to_string() } else { msg }
                }));
                return;
            }

            let json_str = String::from_utf8_lossy(&output.stdout);
            let data: Value = match serde_json::from_str(&json_str) {
                Ok(v) => v,
                Err(e) => {
                    let _ = app.emit("queue-progress", json!({
                        "id": id_clone,
                        "status": "error",
                        "message": format!("JSON cozumleme hatasi: {e}")
                    }));
                    return;
                }
            };

            let title = data["title"].as_str().unwrap_or("Bilinmeyen video").to_string();
            let duration = data["duration"].as_f64();
            let thumbnail = data["thumbnail"].as_str().map(|s| s.to_string());

            let formats: Vec<Value> = data["formats"]
                .as_array()
                .map(|arr| {
                    arr.iter()
                        .filter(|f| {
                            f["vcodec"].as_str() != Some("none")
                                || f["acodec"].as_str() != Some("none")
                        })
                        .map(|f| {
                            let res = f["resolution"].as_str().unwrap_or("");
                            let height = f["height"].as_u64();
                            let resolution = if res.is_empty() {
                                match height {
                                    Some(2160) => "2160p".to_string(),
                                    Some(1440) => "1440p".to_string(),
                                    Some(1080) => "1080p".to_string(),
                                    Some(720) => "720p".to_string(),
                                    Some(480) => "480p".to_string(),
                                    Some(360) => "360p".to_string(),
                                    Some(240) => "240p".to_string(),
                                    Some(144) => "144p".to_string(),
                                    _ => format!("{}p", height.unwrap_or(0)),
                                }
                            } else {
                                res.to_string()
                            };
                            json!({
                                "formatId": f["format_id"].as_str().unwrap_or(""),
                                "resolution": resolution,
                                "ext": f["ext"].as_str().unwrap_or("mp4"),
                                "note": f["format_note"].as_str().unwrap_or(""),
                                "filesize": format_filesize(f["filesize"].as_u64().or(f["filesize_approx"].as_u64())),
                            })
                        })
                        .collect::<Vec<_>>()
                })
                .unwrap_or_default();

            meta.lock().unwrap().insert(id_clone.clone(), VideoMeta {
                title: title.clone(),
                url: url.clone(),
                duration,
                thumbnail: thumbnail.clone(),
            });

            let _ = app.emit("queue-progress", json!({
                "id": id_clone,
                "status": "ready-to-select",
                "title": title,
                "duration": duration,
                "thumbnail": thumbnail,
                "formats": formats,
            }));
        });
    }

    pub fn start_download(&self, app: AppHandle, id: String, url: String, format_id: String) {
        let active = self.active.clone();
        let queue = self.queue.clone();
        let meta = self.meta.clone();

        {
            let mut active_lock = active.lock().unwrap();
            if active_lock.len() >= MAX_CONCURRENT {
                queue.lock().unwrap().push(QueueItem {
                    id: id.clone(),
                    url: url.clone(),
                    format_id: Some(format_id),
                });
                let _ = app.emit("queue-progress", json!({
                    "id": id,
                    "status": "downloading",
                    "percent": 0,
                    "speed": "",
                    "eta": "",
                    "message": "Sirada bekliyor..."
                }));
                return;
            }
            active_lock.insert(id.clone(), ());
        }

        self._run_download(app, id, url, format_id, active, queue, meta);
    }

    fn _run_download(
        &self,
        app: AppHandle,
        id: String,
        url: String,
        format_id: String,
        active: Arc<Mutex<HashMap<String, ()>>>,
        queue: Arc<Mutex<Vec<QueueItem>>>,
        meta: Arc<Mutex<HashMap<String, VideoMeta>>>,
    ) {
        let ytdlp = match dependencies::ytdlp_path(&app) {
            Ok(p) => p,
            Err(e) => {
                let _ = app.emit("queue-progress", json!({
                    "id": id,
                    "status": "error",
                    "message": format!("yt-dlp bulunamadi: {e}")
                }));
                active.lock().unwrap().remove(&id);
                return;
            }
        };

        let download_dir = {
            let settings_path = app.path().app_data_dir().ok().map(|d| d.join("settings.json"));
            if let Some(path) = settings_path {
                if let Ok(raw) = std::fs::read_to_string(&path) {
                    if let Ok(val) = serde_json::from_str::<Value>(&raw) {
                        val.get("downloadDir").and_then(|v| v.as_str()).unwrap_or("").to_string()
                    } else {
                        String::new()
                    }
                } else {
                    String::new()
                }
            } else {
                String::new()
            }
        };

        let out_dir = if download_dir.is_empty() {
            app.path().download_dir().unwrap_or_default()
        } else {
            std::path::PathBuf::from(&download_dir)
        };

        let ffmpeg_loc = dependencies::ffmpeg_path(&app).ok();

        let meta_data = meta.lock().unwrap().get(&id).cloned();
        let title = meta_data.as_ref().map(|m| m.title.as_str()).unwrap_or("video");

        let mut args: Vec<String> = vec![
            url.clone(),
            "-f".to_string(),
            format!("{format_id}+ba/b"),
            "-o".to_string(),
            out_dir.join(format!("{title}.%(ext)s")).to_string_lossy().to_string(),
            "--progress".to_string(),
            "--newline".to_string(),
            "--no-playlist".to_string(),
        ];

        if let Some(ref ff) = ffmpeg_loc {
            args.push("--ffmpeg-location".to_string());
            args.push(ff.to_string_lossy().to_string());
        }

        let id_clone = id.clone();
        let app_clone = app.clone();
        let active_clone = active.clone();
        let queue_clone = queue.clone();
        let meta_clone = meta.clone();

        std::thread::spawn(move || {
            let output = Command::new(&ytdlp)
                .args(&args)
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .output();

            match output {
                Ok(out) => {
                    let stdout = String::from_utf8_lossy(&out.stdout);
                    let mut last_percent = 0.0_f64;
                    let mut last_speed = String::new();
                    let mut last_eta = String::new();
                    let mut file_path = String::new();

                    for line in stdout.lines() {
                        if line.contains("[download] Destination:") {
                            file_path = line.replace("[download] Destination:", "").trim().to_string();
                        }

                        if let Some(pct_str) = extract_between(line, "[download] ", "%") {
                            if let Ok(pct) = pct_str.trim().parse::<f64>() {
                                last_percent = pct;
                            }
                        }

                        if let Some(speed) = extract_after(line, "at ") {
                            let speed_clean = speed.split("ETA").next().unwrap_or("").trim().to_string();
                            if !speed_clean.is_empty() {
                                last_speed = speed_clean;
                            }
                        }

                        if let Some(eta) = extract_after(line, "ETA ") {
                            last_eta = eta.trim().to_string();
                        }

                        if last_percent > 0.0 {
                            let _ = app_clone.emit("queue-progress", json!({
                                "id": id_clone,
                                "status": "downloading",
                                "percent": last_percent as u64,
                                "speed": last_speed,
                                "eta": last_eta,
                            }));
                        }
                    }

                    let mut active_lock = active_clone.lock().unwrap();
                    active_lock.remove(&id_clone);

                    if out.status.success() {
                        let _ = app_clone.emit("queue-progress", json!({
                            "id": id_clone,
                            "status": "complete",
                            "percent": 100,
                        }));

                        if !file_path.is_empty() {
                            save_history(&app_clone, &meta_clone, &id_clone, &file_path, &format_id);
                        }
                    } else {
                        let stderr = String::from_utf8_lossy(&out.stderr);
                        let msg = stderr.lines()
                            .filter(|l| !l.starts_with("[debug]") && !l.trim().is_empty())
                            .rev()
                            .take(2)
                            .collect::<Vec<_>>()
                            .join("\n");
                        let _ = app_clone.emit("queue-progress", json!({
                            "id": id_clone,
                            "status": "error",
                            "message": if msg.is_empty() { "Indirme hatasi".to_string() } else { msg }
                        }));
                    }

                    try_dequeue(&app_clone, &active_clone, &queue_clone, &meta_clone);
                }
                Err(e) => {
                    active.lock().unwrap().remove(&id);
                    let _ = app.emit("queue-progress", json!({
                        "id": id,
                        "status": "error",
                        "message": format!("yt-dlp calistirilamadi: {e}")
                    }));
                    try_dequeue(&app, &active, &queue, &meta);
                }
            }
        });
    }

    pub fn cancel_download(&self, id: &str) {
        self.active.lock().unwrap().remove(id);
        self.queue.lock().unwrap().retain(|item| item.id != id);
    }

    pub fn convert_file(
        &self,
        app: AppHandle,
        id: String,
        input_path: String,
        output_format: String,
        quality: String,
    ) {
        let ffmpeg = match dependencies::ffmpeg_path(&app) {
            Ok(p) => p,
            Err(e) => {
                let _ = app.emit("convert-progress", json!({
                    "id": id,
                    "percent": 0,
                    "status": "error",
                    "message": format!("FFmpeg bulunamadi: {e}")
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

        let _total_duration = get_duration(&ffmpeg, &input_path);

        let mut cmd_args: Vec<String> = vec![
            "-i".to_string(),
            input_path.clone(),
            "-y".to_string(),
        ];
        cmd_args.extend(args);
        cmd_args.push(output_str.clone());

        let id_clone = id.clone();
        let app_clone = app.clone();
        let active = self.active.clone();

        active.lock().unwrap().insert(format!("convert_{id}"), ());

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
        self.active.lock().unwrap().remove(&format!("convert_{id}"));
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

fn extract_between<'a>(text: &'a str, start: &str, end: &str) -> Option<&'a str> {
    let after_start = text.find(start)? + start.len();
    let rest = &text[after_start..];
    let before_end = rest.find(end)?;
    Some(&rest[..before_end])
}

fn extract_after<'a>(text: &'a str, marker: &str) -> Option<&'a str> {
    let idx = text.find(marker)?;
    Some(&text[idx + marker.len()..])
}

fn try_dequeue(
    app: &AppHandle,
    active: &Arc<Mutex<HashMap<String, ()>>>,
    queue: &Arc<Mutex<Vec<QueueItem>>>,
    meta: &Arc<Mutex<HashMap<String, VideoMeta>>>,
) {
    let item = {
        let mut q = queue.lock().unwrap();
        let mut active_lock = active.lock().unwrap();
        if q.is_empty() || active_lock.len() >= MAX_CONCURRENT {
            return;
        }
        let item = q.remove(0);
        active_lock.insert(item.id.clone(), ());
        item
    };

    let dm = DownloadManager {
        active: active.clone(),
        queue: queue.clone(),
        meta: meta.clone(),
    };
    dm._run_download(
        app.clone(),
        item.id,
        item.url,
        item.format_id.unwrap_or_default(),
        active.clone(),
        queue.clone(),
        meta.clone(),
    );
}

fn save_history(
    app: &AppHandle,
    meta: &Arc<Mutex<HashMap<String, VideoMeta>>>,
    id: &str,
    file_path: &str,
    format_id: &str,
) {
    let meta_data = match meta.lock().unwrap().remove(id) {
        Some(m) => m,
        None => return,
    };

    let settings_path = match app.path().app_data_dir() {
        Ok(d) => d.join("settings.json"),
        Err(_) => return,
    };

    let mut settings: Value = if settings_path.exists() {
        std::fs::read_to_string(&settings_path)
            .ok()
            .and_then(|raw| serde_json::from_str(&raw).ok())
            .unwrap_or(json!({}))
    } else {
        json!({})
    };

    let ext = std::path::Path::new(file_path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("mp4");

    let entry = json!({
        "id": id,
        "title": meta_data.title,
        "url": meta_data.url,
        "duration": meta_data.duration,
        "thumbnail": meta_data.thumbnail,
        "formatId": format_id,
        "quality": "",
        "ext": ext,
        "fileSize": "",
        "filePath": file_path,
        "completedAt": chrono_now(),
    });

    let history = settings
        .as_object_mut()
        .and_then(|o| o.get_mut("history"))
        .and_then(|h| h.as_array_mut());

    if let Some(arr) = history {
        arr.insert(0, entry);
        if arr.len() > 200 {
            arr.truncate(200);
        }
    } else {
        if let Some(obj) = settings.as_object_mut() {
            obj.insert("history".to_string(), json!([entry]));
        }
    }

    let tmp = settings_path.with_extension("json.tmp");
    if let Ok(raw) = serde_json::to_string_pretty(&settings) {
        let _ = std::fs::write(&tmp, raw);
        let _ = std::fs::rename(&tmp, &settings_path);
    }
}

fn chrono_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    format!("{secs}")
}

fn get_duration(ffmpeg: &std::path::Path, input: &str) -> Option<f64> {
    let ffprobe = ffmpeg.with_file_name("ffprobe");
    let output = Command::new(&ffprobe)
        .args([
            "-v", "error",
            "-show_entries", "format=duration",
            "-of", "csv=p=0",
            input,
        ])
        .output()
        .ok()?;
    let raw = String::from_utf8_lossy(&output.stdout);
    raw.trim().parse::<f64>().ok()
}
