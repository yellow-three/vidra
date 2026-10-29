//! Indirme klasorunun bulundugu diskteki bos alan (indirmeden once kontrol icin).

use std::path::Path;

/// Klasor henuz yoksa (ilk indirmede alt klasor) var olan ilk ust klasorun diski olculur.
pub fn free_space(path: &Path) -> Option<u64> {
    let existing = path.ancestors().find(|p| p.is_dir())?;
    platform_free_space(existing)
}

#[cfg(unix)]
fn platform_free_space(path: &Path) -> Option<u64> {
    use std::os::unix::ffi::OsStrExt;
    let c_path = std::ffi::CString::new(path.as_os_str().as_bytes()).ok()?;
    let mut stat: libc::statvfs = unsafe { std::mem::zeroed() };
    // SAFETY: c_path NUL ile biten gecerli bir yol, stat yazilabilir bir yapi.
    if unsafe { libc::statvfs(c_path.as_ptr(), &mut stat) } != 0 {
        return None;
    }
    // Root'a ayrilan bloklar sayilmaz (f_bavail).
    Some(stat.f_bavail as u64 * stat.f_frsize as u64)
}

#[cfg(windows)]
fn platform_free_space(path: &Path) -> Option<u64> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Storage::FileSystem::GetDiskFreeSpaceExW;
    let wide: Vec<u16> = path.as_os_str().encode_wide().chain(std::iter::once(0)).collect();
    let mut available = 0u64;
    // SAFETY: wide NUL ile biten UTF-16 yol; diger cikislar istenmedigi icin null.
    let ok = unsafe {
        GetDiskFreeSpaceExW(
            wide.as_ptr(),
            &mut available,
            std::ptr::null_mut(),
            std::ptr::null_mut(),
        )
    };
    (ok != 0).then_some(available)
}

#[cfg(not(any(unix, windows)))]
fn platform_free_space(_path: &Path) -> Option<u64> {
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn measures_existing_ancestor_of_missing_folder() {
        let tmp = std::env::temp_dir();
        let free = free_space(&tmp).expect("temp dizininin bos alani");
        assert!(free > 0);
        assert_eq!(free_space(&tmp.join("vidra-yok/alt/klasor")).map(|f| f > 0), Some(true));
    }
}
