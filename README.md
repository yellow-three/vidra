# YouTube Downloader

YouTube video ve ses indirme masaüstü uygulaması. Tauri 2 + React 19 + Tailwind/DaisyUI, indirme motoru yt-dlp + FFmpeg.

`~/Projects/yt-downloader` projesinin (`tauri-android-migration`, commit `2554e85`) arayüzü ve Rust backend'i temel alınarak kuruldu. İlk hedef masaüstü; Android sonraya bırakıldı.

## Gereksinimler

- Node.js 24+
- Rust (stable) ve [Tauri 2 sistem bağımlılıkları](https://v2.tauri.app/start/prerequisites/)

## Sidecar'lar (yt-dlp, FFmpeg, deno)

yt-dlp, LGPL FFmpeg ve deno uygulamayla birlikte paketlenir (`bundle.externalBin`). `npm run sidecars` bunları `src-tauri/binaries/ytd-<ad>-<target-triple>` olarak indirir ve SHA-256 doğrular; `tauri dev` / `tauri build` bunu kendiliğinden çalıştırır, sürümler değişmedikçe tekrar indirmez. `cargo test` / `cargo check` de bu dosyalar olmadan derlenmez.

```bash
npm run sidecars                                   # host hedefi
node scripts/fetch-sidecars.mjs --target x86_64-pc-windows-msvc
FFMPEG_DIR=/yol/lgpl-ffmpeg npm run sidecars        # macOS: hazır LGPL kaynağı yok
```

- `ytd-` öneki şart: Linux paketleri sidecar'ları `/usr/bin`'e kurar ve önek olmadan sistemdeki `ffmpeg` / `yt-dlp` paketleriyle çakışır.
- Sürümler `scripts/fetch-sidecars.mjs` başında sabittir (yt-dlp, deno). FFmpeg, BtbN'in `n9.0` dalının en güncel LGPL build'idir; BtbN eski build'leri silmediği için sabitlenemez.
- `ffprobe` bilerek paketlenmez (kurulu boyutta ~140 MB). yt-dlp birleştirme, MP3/M4A, altyazı/kapak/metadata gömme ve remux'u onsuz aynı çıktıyla yapar; yalnızca HLS (m3u8) indirmelerinde zararsız bir "ffprobe not found" uyarısı yazar. BtbN'in `lgpl-shared` build'i de denendi: ffmpeg + ffprobe + kütüphaneler ~170 MB ve Linux'ta kütüphanelerin `/usr/lib`'e kurulmasını gerektiriyor.
- FFmpeg LGPL olduğundan GPL'li `libx264` yoktur; Dönüştür sayfası MP4 için `libopenh264` kullanır. FFmpeg lisans metni pakete `licenses/` altında eklenir.
- yt-dlp sık bozulur: Ayarlar'daki güncelleme, paketlenmiş kopyayı app data `bin/` altına kopyalayıp `yt-dlp -U` çalıştırır (uygulama dizini çoğu kurulumda salt okunurdur). Uygulama daha yeni bir yt-dlp ile güncellenirse eski kopya açılışta silinir.
- yt-dlp YouTube için JS runtime ister; paketlenmiş deno `--js-runtimes deno:<yol>` ile verilir.

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
- `src-tauri/src/process.rs` — programdan bağımsız süreç çalıştırıcı: süreci kendi grubunda başlatır (Unix process group, Windows Job Object), stdout/stderr satırlarını `Channel` ile iletir, iptalde tüm grubu öldürür. Webview yalnızca izin verilen programları (yt-dlp, ffmpeg) çalıştırabilir.
- `src-tauri/src/dependencies.rs` — sidecar yollarının çözümü ve yt-dlp güncellemesi.
- `scripts/fetch-sidecars.mjs` — sidecar indirme ve checksum doğrulama.
- `src-tauri/src/lib.rs` — ayarlar (`<app data>/settings.json`), SQLite migration'ları, klasör seçimi, fs kapsamı.
- İndirme geçmişi SQLite'tadır: `<app config>/youtube-downloader.db` (Linux: `~/.config/com.abdurrahman.youtubedownloader/`).
- `src-tauri/src/events.rs` — pano (clipboard) izleme.

## Testler

```bash
npm test                         # Vitest: src/engine, src/features
cargo test --manifest-path src-tauri/Cargo.toml   # süreç çalıştırıcı
```
