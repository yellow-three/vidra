//! Uygulama "YouTube Downloader" (`com.abdurrahman.youtubedownloader`) adiyla yayinlanmisti.
//! Kimlik `io.github.yellow-three.vidra` olunca Tauri ayarlari ve gecmisi yeni klasorde arar;
//! eski klasordeki dosyalar burada, Tauri baslamadan once yeni klasore tasinir.

use std::fs;
use std::path::Path;

const OLD_IDENTIFIER: &str = "com.abdurrahman.youtubedownloader";
const NEW_IDENTIFIER: &str = "io.github.yellow-three.vidra";
const OLD_DB: &str = "youtube-downloader.db";
const NEW_DB: &str = "vidra.db";

/// `old` icindeki her girdiyi, `new`'de ayni adla yoksa tasir; eski veritabani adini da degistirir.
/// Bos kalan eski klasor silinir.
fn migrate_dir(old: &Path, new: &Path) -> std::io::Result<()> {
    if !old.is_dir() {
        return Ok(());
    }
    fs::create_dir_all(new)?;
    for entry in fs::read_dir(old)? {
        let entry = entry?;
        let name = entry.file_name();
        let target_name = name.to_string_lossy().replacen(OLD_DB, NEW_DB, 1);
        let target = new.join(target_name);
        if !target.exists() {
            fs::rename(entry.path(), target)?;
        }
    }
    let _ = fs::remove_dir(old);
    Ok(())
}

/// `main` en basinda cagrilir; tasinacak bir sey yoksa hicbir sey yapmaz.
pub fn migrate_old_identifier() {
    let mut roots = vec![dirs::data_dir(), dirs::config_dir()];
    roots.dedup();
    for root in roots.into_iter().flatten() {
        if let Err(error) = migrate_dir(&root.join(OLD_IDENTIFIER), &root.join(NEW_IDENTIFIER)) {
            eprintln!("Eski uygulama verisi tasinamadi ({}): {error}", root.display());
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn temp_root(name: &str) -> PathBuf {
        let root = std::env::temp_dir().join(format!("vidra-legacy-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).unwrap();
        root
    }

    #[test]
    fn eski_klasoru_tasir_ve_veritabanini_yeniden_adlandirir() {
        let root = temp_root("move");
        let (old, new) = (root.join("old"), root.join("new"));
        fs::create_dir_all(old.join("bin")).unwrap();
        fs::write(old.join("settings.json"), "{}").unwrap();
        fs::write(old.join("bin/yt-dlp"), "x").unwrap();
        fs::write(old.join(OLD_DB), "db").unwrap();
        fs::write(old.join(format!("{OLD_DB}-wal")), "wal").unwrap();

        migrate_dir(&old, &new).unwrap();

        assert!(!old.exists());
        assert_eq!(fs::read_to_string(new.join("settings.json")).unwrap(), "{}");
        assert!(new.join("bin/yt-dlp").exists());
        assert_eq!(fs::read_to_string(new.join(NEW_DB)).unwrap(), "db");
        assert_eq!(fs::read_to_string(new.join(format!("{NEW_DB}-wal"))).unwrap(), "wal");
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn yeni_klasordeki_dosyalarin_ustune_yazmaz() {
        let root = temp_root("keep");
        let (old, new) = (root.join("old"), root.join("new"));
        fs::create_dir_all(&old).unwrap();
        fs::create_dir_all(&new).unwrap();
        fs::write(old.join("settings.json"), "old").unwrap();
        fs::write(new.join("settings.json"), "new").unwrap();

        migrate_dir(&old, &new).unwrap();

        assert_eq!(fs::read_to_string(new.join("settings.json")).unwrap(), "new");
        assert!(old.join("settings.json").exists());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn eski_klasor_yoksa_hicbir_sey_yapmaz() {
        let root = temp_root("none");
        migrate_dir(&root.join("old"), &root.join("new")).unwrap();
        assert!(!root.join("new").exists());
        fs::remove_dir_all(root).unwrap();
    }
}
