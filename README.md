# YouTube Downloader

YouTube video ve ses indirme masaüstü uygulaması. Tauri 2 + React 19 + Tailwind/DaisyUI, indirme motoru yt-dlp + FFmpeg.

`~/Projects/yt-downloader` projesinin (`tauri-android-migration`, commit `2554e85`) arayüzü ve Rust backend'i temel alınarak kuruldu. İlk hedef masaüstü; Android sonraya bırakıldı.

## Gereksinimler

- Node.js 24+
- Rust (stable) ve [Tauri 2 sistem bağımlılıkları](https://v2.tauri.app/start/prerequisites/)

yt-dlp ve FFmpeg uygulama tarafından ilk açılışta app data dizinindeki `bin/` altına indirilir.

## Komutlar

```bash
npm install
npm run tauri dev     # geliştirme
npm run tauri build   # paket üretimi
```

## Yapı

- `src/engine/` — platformdan bağımsız indirme motoru (PLAN.md: `DownloadEngine`). yt-dlp argümanları, format seçenekleri, `%(progress)j` ayrıştırma ve yarım dosya seçimi saf TS'tir (`ytdlp.ts`, `ffmpeg.ts`); Android'de de aynı kod kullanılacak. `desktop.ts` bunları Rust süreç çalıştırıcısıyla çalıştırır.
- `src/features/queue/` — eşzamanlı indirme sınırlayıcı.
- `src/` diğer — React arayüzü (Home, Downloads, Convert, Settings).
- `src-tauri/src/process.rs` — programdan bağımsız süreç çalıştırıcı: süreci kendi grubunda başlatır (Unix process group, Windows Job Object), stdout/stderr satırlarını `Channel` ile iletir, iptalde tüm grubu öldürür. Webview yalnızca izin verilen programları (yt-dlp, ffmpeg, ffprobe) çalıştırabilir.
- `src-tauri/src/dependencies.rs` — yt-dlp / FFmpeg kurulum ve güncelleme.
- `src-tauri/src/lib.rs` — ayarlar, geçmiş, klasör seçimi, fs kapsamı.
- `src-tauri/src/events.rs` — pano (clipboard) izleme.

## Testler

```bash
npm test                         # Vitest: src/engine, src/features
cargo test --manifest-path src-tauri/Cargo.toml   # süreç çalıştırıcı
```
