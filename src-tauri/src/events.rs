use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tauri_plugin_clipboard_manager::ClipboardExt;

pub struct ClipboardMonitor {
    handle: Option<std::thread::JoinHandle<()>>,
    stop: Arc<Mutex<bool>>,
}

impl ClipboardMonitor {
    pub fn new() -> Self {
        Self {
            handle: None,
            stop: Arc::new(Mutex::new(false)),
        }
    }

    pub fn start(&mut self, app: AppHandle) {
        if self.handle.is_some() {
            return;
        }

        *self.stop.lock().unwrap() = false;
        let stop = self.stop.clone();

        let handle = std::thread::spawn(move || {
            let mut last_text = String::new();

            loop {
                if *stop.lock().unwrap() {
                    break;
                }

                std::thread::sleep(Duration::from_millis(1500));

                let current_text = match app.clipboard().read_text() {
                    Ok(text) => text.to_string(),
                    Err(_) => continue,
                };

                if current_text != last_text
                    && (current_text.contains("youtube.com/")
                        || current_text.contains("youtu.be/")
                        || current_text.contains("youtube.com/shorts/"))
                {
                    last_text = current_text.clone();
                    let _ = app.emit("clipboard-link-detected", current_text);
                }
            }

            let _ = app.emit("clipboard-monitor-stopped", ());
        });

        self.handle = Some(handle);
    }

    pub fn stop(&mut self) {
        *self.stop.lock().unwrap() = true;
        if let Some(handle) = self.handle.take() {
            let _ = handle.join();
        }
    }
}

impl Drop for ClipboardMonitor {
    fn drop(&mut self) {
        self.stop();
    }
}
