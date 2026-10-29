# yt-down — Proje Planı

yt-dlp tabanlı, masaüstü (Windows / macOS / Linux) ve Android'de çalışan video/müzik indirme uygulaması.

## Karar: Tauri 2 + React/TypeScript

**Neden:**
- UI tamamen React + TS (Vite, Tailwind) — mevcut bilgiyle hızlı ilerleme.
- Tek kod tabanı: Windows, macOS, Linux, Android.
- Masaüstünde yt-dlp / ffmpeg / deno **sidecar** olarak paketlenir, `tauri-plugin-shell` ile TS'ten çalıştırılır.
- Android'de Kotlin ihtiyacı tek küçük plugin'le sınırlı (~100–200 satır, `youtubedl-android` sarmalayıcı).
- Rust tarafı minimumda (şablon + plugin kaydı).

**Değerlendirilen alternatifler:**

| Seçenek | Neden seçilmedi |
|---|---|
| Flutter | Dart/Flutter deneyimi yok |
| Compose Multiplatform | Teknik olarak en uygun, ama tüm uygulamayı Kotlin+Compose'la yazmak gerekir |
| Lynx | Masaüstü yeni (3.7, Nisan 2026), Linux yok, native modül ekosistemi genç |
| React Native / Expo | Linux masaüstü yok; Plan B olarak saklı |
| Electron | Ağır, mobil yok |

**Plan B:** Mobil deneyim yetersiz kalırsa → monorepo: Expo (mobil) + Tauri (masaüstü) + ortak TS paketleri (engine, kuyruk, tipler).

## Kritik teknik gerçekler

1. **yt-dlp sık bozulur** → uygulama içinden yt-dlp güncelleme şart (`yt-dlp -U` veya GitHub Releases'tan binary indirme).
2. **YouTube için JS runtime (Deno) gerekli** (yt-dlp 2025 sonundan itibaren) → masaüstünde deno sidecar.
3. **ffmpeg gerekli** (video+ses birleştirme, mp3/m4a dönüştürme, kapak gömme). Lisans: LGPL build tercih et.
4. **iOS kapsam dışı** — App Store yasaklıyor, subprocess yok. İleride gerekirse self-hosted sunucu modu.
5. **Google Play yasaklıyor** → Android dağıtımı GitHub Releases / F-Droid (APK).
6. Hukuki: telif / YouTube ToS — "kullanıcı sorumluluğunda" ibaresi.

## Mimari

```
┌──────────── React + TS UI ────────────┐
│ Link → bilgi/format seç → kuyruk → ilerleme │
└──────────────┬────────────────────────┘
               │ DownloadEngine (soyut arayüz)
       ┌───────┴────────┐
       ▼                ▼
   Masaüstü          Android
   sidecar:          Tauri Kotlin plugin
   yt-dlp+ffmpeg     → youtubedl-android
   +deno             (Python+ffmpeg gömülü)
```

**DownloadEngine arayüzü (taslak):**
- `getInfo(url)` → `yt-dlp -J` JSON (başlık, thumbnail, formatlar, playlist girdileri)
- `download(url, options, onProgress)` → `--newline --progress-template "%(progress)j"` ile JSON ilerleme
- `cancel(id)`
- `updateEngine()` / `engineVersion()`

## Klasör yapısı

```
yt-down/
├─ src/                       # React + TS UI
│  ├─ engine/                 # DownloadEngine
│  │  ├─ types.ts
│  │  ├─ desktop.ts           # sidecar ile yt-dlp
│  │  └─ android.ts           # Kotlin plugin çağrıları
│  └─ features/               # add, queue, history, settings
├─ src-tauri/
│  ├─ binaries/               # yt-dlp, ffmpeg, deno (platform başına, target-triple adlı)
│  └─ plugins/ytdlp-android/  # Kotlin plugin
└─ PLAN.md
```

## Paketler

- UI: React, Vite, TypeScript, Tailwind
- State: TanStack Query, Zustand
- Tauri plugin'leri: `shell`, `sql` (SQLite — kuyruk/geçmiş), `dialog`, `notification`, `updater`, `fs`
- Android: `io.github.junkfood02.youtubedl-android` (library + ffmpeg)
- Test: Vitest (TS mantığı), Playwright (UI akışları)

## Yol haritası

### Faz 1 — Masaüstü MVP
- [x] `git init`, `feature/desktop-mvp` branch
- [x] Tauri 2 + React + TS + Tailwind iskeleti
- [x] Sidecar binary'leri indiren script (yt-dlp, ffmpeg, deno)
- [x] `DownloadEngine` arayüzü + desktop implementasyonu
- [x] Link yapıştır → bilgi ve formatları göster
- [x] Video (en iyi / çözünürlük seç) ve ses (mp3/m4a) indirme
- [x] İlerleme çubuğu, iptal
- [x] İndirme klasörü seçimi

### Faz 2 — Kullanılabilirlik
- [x] Kuyruk (eşzamanlı indirme limiti) + SQLite geçmiş
- [x] Playlist desteği
- [x] yt-dlp otomatik güncelleme
- [x] Ayarlar: varsayılan format, dosya adı şablonu, cookies (`--cookies-from-browser`), proxy
- [x] Kapak resmi ve metadata gömme, altyazı

### Faz 3 — Android
- [ ] Tauri Android hedefi
- [ ] Kotlin plugin: youtubedl-android init / getInfo / download / progress / update
- [ ] Foreground service + bildirimle arka plan indirme
- [ ] Paylaş menüsünden link alma (share intent)
- [ ] APK dağıtımı (GitHub Releases)

### Faz 4 — Opsiyonel
- [ ] Self-hosted sunucu modu (FastAPI + yt-dlp) → iOS/web istemcisi
- [ ] Masaüstü paketleme: msix/nsis (Windows), dmg (macOS), AppImage/Flatpak (Linux)

## Referanslar

- yt-dlp: https://github.com/yt-dlp/yt-dlp
- youtubedl-android: https://github.com/yausername/youtubedl-android
- Seal (Android referans uygulama): https://github.com/JunkFood02/Seal
- Tauri 2: https://v2.tauri.app/
- Lynx (izlenecek, Lynxtron çıkınca tekrar değerlendir): https://lynxjs.org/blog/lynx-3-7
