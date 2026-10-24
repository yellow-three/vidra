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

- `src/` — React arayüzü (Home, Downloads, Convert, Settings sayfaları); backend'e yalnızca `src/lib/appApi.ts` üzerinden erişir.
- `src-tauri/src/lib.rs` — Tauri command'ları, ayarlar ve geçmiş (`settings.json`).
- `src-tauri/src/dependencies.rs` — yt-dlp / FFmpeg indirme ve sürüm kontrolü.
- `src-tauri/src/download.rs` — video analizi, indirme kuyruğu, ilerleme, FFmpeg dönüştürme.
- `src-tauri/src/events.rs` — pano (clipboard) izleme.
