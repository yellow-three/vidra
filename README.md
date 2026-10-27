# YouTube Downloader

YouTube video ve ses indirme masaüstü uygulaması. Tauri 2 + React 19 + Tailwind/DaisyUI, indirme motoru yt-dlp + FFmpeg.

`~/Projects/yt-downloader` projesinin (`tauri-android-migration`, commit `2554e85`) arayüzü ve Rust backend'i temel alınarak kuruldu. İlk hedef masaüstü; Android sonraya bırakıldı.

## Kullanıcı kurulumu

Kullanıcılar uygulamayı [`youtube-downloader-releases`](https://github.com/yellow-three/youtube-downloader-releases/releases/latest) reposundan indirir; dağıtıma göre kurulum, güncelleme ve kaldırma talimatları o reponun README'sindedir. Release notlarındaki kısa kurulum metni `.github/workflows/release.yml` içindeki `releaseBody`'dedir; ikisi birlikte güncellenmelidir.

- Linux'ta `.deb` / `.rpm` önerilir (menüye eklenir, paket yöneticisiyle kaldırılır). Paket adı Tauri'nin `productName`'den ürettiği `you-tube-downloader`'dır.
- AppImage, AppImage'ın statik runtime'ıyla gelir: `libfuse2` istemez, yalnızca `fusermount` (`fuse3` paketi) gerekir.
- Windows kurulum dosyaları kod imzalı değildir; SmartScreen uyarı verir.
- Flathub'a şimdilik gönderilmiyor: kaynağın public olması, marka içermeyen bir ad/ikon/app ID ve Flatpak içinde uygulama ile yt-dlp güncelleyicisinin kapatılması gerekir.

## Gereksinimler

- Node.js 24+
- Rust (stable) ve [Tauri 2 sistem bağımlılıkları](https://v2.tauri.app/start/prerequisites/)

## Arayüz ve temalar

Arayüz daisyUI 5 bileşenleriyle yazılmıştır. `src/index.css` tüm yerleşik daisyUI temalarını açar ve iki özel tema tanımlar: `youtube-dark` (varsayılan) ve `youtube-light`. Ayarlar > Görünüm'den herhangi bir tema seçilebilir; "Sistem" seçeneği işletim sistemine göre YouTube açık/koyu temasını kullanır. Kenar çubuğundaki düğme iki YouTube teması arasında geçer.

Uygulama ikonu `src-tauri/app-icon.svg`'den üretilir:

```bash
npx tauri icon src-tauri/app-icon.svg -o src-tauri/icons
```

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

## Uygulama güncellemeleri ve sürüm yayınlama

Uygulama açılışta ve Ayarlar > Uygulama'dan `https://github.com/yellow-three/youtube-downloader-releases/releases/latest/download/latest.json` adresini kontrol eder (tauri-plugin-updater). Kaynak kod bu private repoda kalır; kurulu uygulamalar `latest.json`'ı kimlik doğrulamasız indirebilsin diye sürümler ayrı, public [`youtube-downloader-releases`](https://github.com/yellow-three/youtube-downloader-releases) reposunda yayınlanır. Güncellemeler minisign ile imzalıdır; açık anahtar `tauri.conf.json`'dadır.

- Özel anahtar repo dışında: `~/.tauri/youtube-downloader.key` (parolalı). **Kaybolursa kurulu uygulamalara bir daha güncelleme gönderilemez — yedekleyin.**
- Bu reponun Settings > Secrets and variables > Actions > **Repository secrets**:
  - `TAURI_SIGNING_PRIVATE_KEY` (anahtar dosyasının içeriği), `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
  - `RELEASES_TOKEN`: yalnızca `youtube-downloader-releases` reposuna **Contents: Read and write** yetkili fine-grained token (`GITHUB_TOKEN` başka repoya yazamaz).
- Yayın: `tauri.conf.json` ve `package.json` sürümünü artırın, `vX.Y.Z` etiketi push edin. `.github/workflows/release.yml` imzalı paketleri ve `latest.json`'ı releases reposunda **taslak** bir release'e yükler (etiket o reponun `dev` branch'inden oluşturulur); taslağı yayınlayınca kurulu uygulamalar güncellemeyi görür.
- Linux'ta `latest.json`'daki `linux-x86_64` girdisi AppImage'ı gösterir; `.deb`/`.rpm` kurulumlarının kendini güncellemesi denenmedi.
- Yerel `tauri build` imza anahtarı istemez; updater dosyaları yalnızca release workflow'unda üretilir.

## Testler

```bash
npm test                         # Vitest: src/engine, src/features
npm run test:ui                  # Playwright: UI akışları, sahte Tauri backend'i (e2e/)
npm run typecheck                # uygulama + testler
cargo test --manifest-path src-tauri/Cargo.toml   # süreç çalıştırıcı (Unix; Windows testleri CI'da)
```
