//! AppImage'in paketledigi eski `libwayland-client` ile sistemin yeni NVIDIA EGL/Wayland
//! surucusu catisinca WebKitGTK pencere acilirken cokuyor (`wl_proxy_create_wrapper` icinde
//! SIGSEGV). Tauri'nin paketleyicisi linuxdeploy'a kutuphane dislama gecirmedigi icin,
//! AppImage icinde calisirken sistemdeki libwayland-client `LD_PRELOAD` ile one alinip
//! surec bir kez yeniden baslatilir. Sistemde yoksa paketlenmis kopya kullanilir.

use std::ffi::OsString;
use std::path::Path;

const MARKER: &str = "YTD_SYSTEM_WAYLAND_PRELOADED";

const SYSTEM_LIBWAYLAND: &[&str] = &[
    "/usr/lib/x86_64-linux-gnu/libwayland-client.so.0",
    "/usr/lib/aarch64-linux-gnu/libwayland-client.so.0",
    "/usr/lib64/libwayland-client.so.0",
    "/usr/lib/libwayland-client.so.0",
];

/// Yeniden baslatmak gerekiyorsa yeni `LD_PRELOAD` degerini dondurur.
fn preload_value(
    appimage: Option<OsString>,
    already_preloaded: bool,
    current_preload: Option<OsString>,
    exists: impl Fn(&str) -> bool,
) -> Option<OsString> {
    if appimage.is_none() || already_preloaded {
        return None;
    }
    let lib = SYSTEM_LIBWAYLAND.iter().find(|p| exists(p))?;
    let mut value = OsString::from(lib);
    if let Some(current) = current_preload.filter(|c| !c.is_empty()) {
        value.push(":");
        value.push(current);
    }
    Some(value)
}

/// `main` en basinda, GTK yuklenmeden once cagrilir; gerekmiyorsa hicbir sey yapmaz.
pub fn prefer_system_wayland() {
    use std::os::unix::process::CommandExt;

    let Some(preload) = preload_value(
        std::env::var_os("APPIMAGE"),
        std::env::var_os(MARKER).is_some(),
        std::env::var_os("LD_PRELOAD"),
        |p| Path::new(p).exists(),
    ) else {
        return;
    };
    let Ok(exe) = std::env::current_exe() else { return };

    // Basarili olursa donmez; olmazsa paketlenmis kutuphaneyle devam edilir.
    let error = std::process::Command::new(exe)
        .args(std::env::args_os().skip(1))
        .env("LD_PRELOAD", preload)
        .env(MARKER, "1")
        .exec();
    eprintln!("Sistem libwayland-client ile yeniden baslatilamadi: {error}");
}

#[cfg(test)]
mod tests {
    use super::*;

    const LIB: &str = "/usr/lib/x86_64-linux-gnu/libwayland-client.so.0";

    fn only(lib: &'static str) -> impl Fn(&str) -> bool {
        move |p| p == lib
    }

    #[test]
    fn appimage_disinda_hicbir_sey_yapmaz() {
        assert_eq!(preload_value(None, false, None, only(LIB)), None);
    }

    #[test]
    fn appimage_icinde_sistem_kutuphanesini_one_alir() {
        assert_eq!(preload_value(Some("/x.AppImage".into()), false, None, only(LIB)), Some(LIB.into()));
    }

    #[test]
    fn mevcut_ld_preload_korunur() {
        assert_eq!(
            preload_value(Some("/x.AppImage".into()), false, Some("/opt/hook.so".into()), only(LIB)),
            Some(format!("{LIB}:/opt/hook.so").into())
        );
    }

    #[test]
    fn yeniden_baslatilmis_surec_tekrar_baslatmaz() {
        assert_eq!(preload_value(Some("/x.AppImage".into()), true, None, only(LIB)), None);
    }

    #[test]
    fn sistemde_libwayland_yoksa_paketlenmis_kopya_kalir() {
        assert_eq!(preload_value(Some("/x.AppImage".into()), false, None, |_| false), None);
    }

    #[test]
    fn diger_mimari_yollarini_da_bulur() {
        let arm = "/usr/lib/aarch64-linux-gnu/libwayland-client.so.0";
        assert_eq!(preload_value(Some("/x.AppImage".into()), false, None, only(arm)), Some(arm.into()));
    }
}
