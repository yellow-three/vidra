//! `--cookies-from-browser` icin tarayici profil klasoru.
//!
//! yt-dlp tarayicilarin yalnizca klasik yerlerine bakar; Linux'ta Flatpak/Snap ile kurulan
//! tarayicilarin profili `~/.var/app/...` ya da `~/snap/...` altindadir. Birden fazla yer
//! varsa (orn. eskiden kalan ~/.config/google-chrome) en son kullanilan cerez dosyasi secilir.
//! Klasor verilince yt-dlp icindeki en yeni profili kendisi bulur.

use std::path::{Path, PathBuf};
use std::time::SystemTime;

/// Ayarlarda secilebilen tarayicilar; baska deger yt-dlp'ye gecmez.
const BROWSERS: &[&str] = &[
    "firefox", "chrome", "chromium", "edge", "brave", "opera", "vivaldi", "safari",
];

#[cfg(target_os = "linux")]
fn candidates(browser: &str, home: &Path) -> Vec<PathBuf> {
    let config = |p: &str| home.join(".config").join(p);
    let flatpak = |app: &str, p: &str| home.join(".var/app").join(app).join(p);
    match browser {
        "chrome" => vec![
            config("google-chrome"),
            flatpak("com.google.Chrome", "config/google-chrome"),
        ],
        "chromium" => vec![
            config("chromium"),
            flatpak("org.chromium.Chromium", "config/chromium"),
            home.join("snap/chromium/common/chromium"),
        ],
        "brave" => vec![
            config("BraveSoftware/Brave-Browser"),
            flatpak("com.brave.Browser", "config/BraveSoftware/Brave-Browser"),
        ],
        "edge" => vec![
            config("microsoft-edge"),
            flatpak("com.microsoft.Edge", "config/microsoft-edge"),
        ],
        "vivaldi" => vec![config("vivaldi"), flatpak("com.vivaldi.Vivaldi", "config/vivaldi")],
        "opera" => vec![config("opera"), flatpak("com.opera.Opera", "config/opera")],
        "firefox" => vec![
            home.join(".mozilla/firefox"),
            config("mozilla/firefox"),
            flatpak("org.mozilla.firefox", ".mozilla/firefox"),
            flatpak("org.mozilla.firefox", "config/mozilla/firefox"),
            home.join("snap/firefox/common/.mozilla/firefox"),
        ],
        _ => vec![],
    }
}

#[cfg(not(target_os = "linux"))]
fn candidates(_browser: &str, _home: &Path) -> Vec<PathBuf> {
    vec![]
}

/// Klasordeki (profil alt klasorleri dahil) en yeni cerez veritabaninin zamani.
fn newest_cookie_db(dir: &Path, depth: u8) -> Option<SystemTime> {
    let mut newest = None;
    for entry in std::fs::read_dir(dir).ok()?.flatten() {
        let path = entry.path();
        let found = if path.is_dir() {
            if depth == 0 {
                None
            } else {
                newest_cookie_db(&path, depth - 1)
            }
        } else if matches!(entry.file_name().to_str(), Some("Cookies" | "cookies.sqlite")) {
            entry.metadata().and_then(|m| m.modified()).ok()
        } else {
            None
        };
        newest = newest.max(found);
    }
    newest
}

pub fn resolve(browser: &str, home: Option<PathBuf>) -> Option<String> {
    if !BROWSERS.contains(&browser) {
        return None;
    }
    let best = home
        .map(|home| candidates(browser, &home))
        .unwrap_or_default()
        .into_iter()
        // Chromium: <profil>/Network/Cookies; Firefox: <profil>/cookies.sqlite
        .filter_map(|dir| newest_cookie_db(&dir, 3).map(|t| (t, dir)))
        .max_by_key(|(t, _)| *t);
    Some(match best {
        Some((_, dir)) => format!("{browser}:{}", dir.display()),
        None => browser.to_string(),
    })
}

#[tauri::command]
pub fn cookie_source(browser: String) -> Result<String, String> {
    resolve(&browser, dirs::home_dir()).ok_or_else(|| format!("Desteklenmeyen tarayici: {browser}"))
}

#[cfg(all(test, target_os = "linux"))]
mod tests {
    use super::*;
    use std::fs;
    use std::time::Duration;

    fn temp_home(name: &str) -> PathBuf {
        let root = std::env::temp_dir().join(format!("vidra-cookies-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).unwrap();
        root
    }

    fn touch(path: &Path, age_secs: u64) {
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, b"").unwrap();
        let time = SystemTime::now() - Duration::from_secs(age_secs);
        fs::File::options()
            .write(true)
            .open(path)
            .unwrap()
            .set_modified(time)
            .unwrap();
    }

    #[test]
    fn en_son_kullanilan_profili_secer() {
        let home = temp_home("newest");
        touch(&home.join(".config/google-chrome/Default/Cookies"), 3600);
        let flatpak = home.join(".var/app/com.google.Chrome/config/google-chrome");
        touch(&flatpak.join("Default/Network/Cookies"), 10);

        let resolved = resolve("chrome", Some(home.clone())).unwrap();
        assert_eq!(resolved, format!("chrome:{}", flatpak.display()));
        fs::remove_dir_all(home).unwrap();
    }

    #[test]
    fn profil_bulunamazsa_yalnizca_tarayici_adini_verir() {
        let home = temp_home("empty");
        assert_eq!(resolve("firefox", Some(home.clone())).unwrap(), "firefox");
        fs::remove_dir_all(home).unwrap();
    }

    #[test]
    fn listede_olmayan_degeri_reddeder() {
        assert_eq!(resolve("chrome --exec x", None), None);
    }
}
