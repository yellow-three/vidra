// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // GTK/WebKit yuklenmeden once; bkz. appimage.rs
    #[cfg(target_os = "linux")]
    youtube_downloader_lib::appimage::prefer_system_wayland();
    youtube_downloader_lib::run()
}
