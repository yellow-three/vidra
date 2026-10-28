// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // GTK/WebKit yuklenmeden once; bkz. appimage.rs
    #[cfg(target_os = "linux")]
    vidra_lib::appimage::prefer_system_wayland();
    // Tauri ayar/gecmis klasorlerini acmadan once; bkz. legacy.rs
    vidra_lib::legacy::migrate_old_identifier();
    vidra_lib::run()
}
