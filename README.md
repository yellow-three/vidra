# Vidra

YouTube video ve ses indirme masaüstü uygulaması. Tauri 2 + React 19 + Tailwind/DaisyUI, indirme motoru yt-dlp + FFmpeg.

**[Son sürümü indir](https://github.com/yellow-three/vidra/releases/latest)**

- Video (4K'ya kadar, MP4) veya ses (MP3, M4A) indirme; kapak resmi, başlık, kanal ve bölümler dosyaya gömülür
- Oynatma listeleri: listenin linkini yapıştırın, videolar kuyruğa gelir, "Hepsini indir" ile topluca inerler
- Kuyruk: aynı anda kaç indirme yapılacağı ayarlanır, sıradakiler yukarı/aşağı taşınarak öne alınır; uygulama kapansa da kuyruk kalır, yarıda kalan indirme kaldığı yerden sürer
- Tarayıcı çerezleri, proxy, hız sınırı, dosya adı biçimi, altyazı
- yt-dlp haftada bir kendiliğinden güncellenir

## Kurulum

### Windows

`Vidra_<sürüm>_x64-setup.exe` dosyasını indirip çalıştırın (`.msi`, toplu/kurumsal kurulum içindir).

Kurulum dosyası kod imzalı olmadığından Windows SmartScreen "Windows bilgisayarınızı korudu" uyarısı gösterebilir: **Ek bilgi > Yine de çalıştır**.

### Linux

| Dağıtım | Dosya | Kurulum |
|---|---|---|
| Ubuntu, Debian, Linux Mint | `.deb` | `sudo apt install ./Vidra_<sürüm>_amd64.deb` |
| Fedora | `.rpm` | `sudo dnf install ./Vidra-<sürüm>-1.x86_64.rpm` |
| openSUSE | `.rpm` | `sudo zypper install ./Vidra-<sürüm>-1.x86_64.rpm` |
| Diğerleri (Arch vb.) | `.AppImage` | `chmod +x Vidra_<sürüm>_amd64.AppImage` ve çalıştırın |

Dağıtımınızın paketi varsa (`.deb` / `.rpm`) onu tercih edin: uygulama menüye eklenir ve paket yöneticisiyle kaldırılabilir.

AppImage `libfuse2` istemez, yalnızca sistemde `fusermount` olmalıdır; masaüstü dağıtımlarının çoğunda kurulu gelir. "No suitable fusermount binary found" hatası alırsanız:

- Ubuntu, Debian: `sudo apt install fuse3`
- Fedora: `sudo dnf install fuse3`
- Arch: `sudo pacman -S fuse3`

yt-dlp, FFmpeg ve deno uygulamayla birlikte gelir; ayrıca kurmanız gerekmez.

## Güncelleme

Uygulama yeni sürümü açılışta kendisi bulur; Ayarlar > Uygulama'dan da kontrol edilebilir. Otomatik güncelleme çalışmazsa yeni sürümü yukarıdaki gibi kurmanız yeterlidir: ayarlar ve indirme geçmişi korunur.

YouTube değiştikçe indirmeler bozulabilir; önce Ayarlar'dan yt-dlp'yi güncelleyin.

## Sorun giderme

- **"YouTube bot doğrulaması istedi"**, yaş kısıtlamalı veya üyelere özel videolar: Ayarlar > Ağ ve hesap > Tarayıcı çerezleri'nden YouTube'a giriş yaptığınız tarayıcıyı seçin. Linux'ta Flatpak ve Snap tarayıcıların profilleri de bulunur. Windows'ta Chrome ve Edge çerezleri okunamayabilir; Firefox'u seçin.
- **403 hatası** ya da beklenmedik indirme hataları: Ayarlar > Sistem'den yt-dlp'yi güncelleyin.
- Hata kartındaki **Ayrıntı** yt-dlp'nin özgün mesajını gösterir; hata bildirirken onu ekleyin.

## Kaldırma

- Windows: Ayarlar > Uygulamalar > Vidra > Kaldır
- `.deb`: `sudo apt remove vidra`
- `.rpm`: `sudo dnf remove vidra` (openSUSE: `sudo zypper remove vidra`)
- AppImage: dosyayı silin

v0.1.0'ın paket adı `you-tube-downloader`'dır; Vidra paketi kurulunca onun yerini alır.

Ayarlar ve geçmiş kaldırmadan sonra da kalır; tamamen silmek için Linux'ta `~/.config/io.github.yellow-three.vidra` ve `~/.local/share/io.github.yellow-three.vidra` (v0.1.0: `com.abdurrahman.youtubedownloader`) klasörlerini silin.

İndirilen içeriklerin telif haklarına ve YouTube Hizmet Şartları'na uygun kullanılması kullanıcının sorumluluğundadır.

---

# Geliştirme

İlk hedef masaüstü; Android sonraya bırakıldı.

Uygulama v0.1.0'da "YouTube Downloader" (`com.abdurrahman.youtubedownloader`) adıyla, ayrı (artık silinmiş) `vidra-releases` reposunda yayınlandı. Kimlik `io.github.yellow-three.vidra` oldu; eski ayarlar, geçmiş ve yt-dlp kopyası ilk açılışta yeni klasöre taşınır (`src-tauri/src/legacy.rs`). `.deb`/`.rpm` paketleri eski `you-tube-downloader` paketinin yerini alır.

## Dağıtım notları

- Release notlarındaki kısa kurulum metni `.github/workflows/release.yml` içindeki `releaseBody`'dedir; yukarıdaki "Kurulum" bölümüyle birlikte güncellenmelidir.
- AppImage, AppImage'ın statik runtime'ıyla gelir: `libfuse2` istemez, yalnızca `fusermount` (`fuse3` paketi) gerekir.
- Windows kurulum dosyaları kod imzalı değildir; SmartScreen uyarı verir.
- Flathub'a şimdilik gönderilmiyor: Flatpak içinde uygulama ve yt-dlp güncelleyicilerinin kapatılması gerekir. Flatpak app ID'sinde tire kullanılamadığı için orada `io.github.yellow_three.vidra` olur (Tauri kimliği ise alt çizgi kabul etmez).

## Gereksinimler

- Node.js 24+
- Rust (stable) ve [Tauri 2 sistem bağımlılıkları](https://v2.tauri.app/start/prerequisites/)

## Arayüz ve temalar

Arayüz daisyUI 5 bileşenleriyle yazılmıştır. `src/index.css` tüm yerleşik daisyUI temalarını açar ve iki özel tema tanımlar: `vidra-dark` (varsayılan) ve `vidra-light` (YouTube renklerinden esinlenir). Ayarlar > Görünüm'den herhangi bir tema seçilebilir; "Sistem" seçeneği işletim sistemine göre Vidra açık/koyu temasını kullanır. Kenar çubuğundaki düğme iki Vidra teması arasında geçer.

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
- `src/engine/errors.ts` — yt-dlp hatalarını Türkçe, çözüm öneren mesajlara çevirir (ham metin "Ayrıntı"da kalır).
- `src/features/queue/` — kuyruk store'u, eşzamanlı indirme sınırlayıcı (sıradakiler listedeki sırayla başlar), kuyruğun localStorage'da saklanması (`persistence.ts`).
- `src/features/settings/ytdlpAutoUpdate.ts` — açılışta haftada bir `yt-dlp -U`.
- `src/` diğer — React arayüzü (Home, Downloads, Convert, Settings).
- `src-tauri/src/process.rs` — programdan bağımsız süreç çalıştırıcı: süreci kendi grubunda başlatır (Unix process group, Windows Job Object), stdout/stderr satırlarını `Channel` ile iletir, iptalde ve uygulama kapanırken tüm grubu öldürür. Webview yalnızca izin verilen programları (yt-dlp, ffmpeg) çalıştırabilir.
- `src-tauri/src/dependencies.rs` — sidecar yollarının çözümü ve yt-dlp güncellemesi.
- `scripts/fetch-sidecars.mjs` — sidecar indirme ve checksum doğrulama.
- `src-tauri/src/lib.rs` — ayarlar (`<app data>/settings.json`), SQLite migration'ları, klasör seçimi, fs kapsamı.
- İndirme geçmişi SQLite'tadır: `<app config>/vidra.db` (Linux: `~/.config/io.github.yellow-three.vidra/`).
- `src-tauri/src/events.rs` — pano (clipboard) izleme.
- `src-tauri/src/cookies.rs` — `--cookies-from-browser` için tarayıcı profili; Linux'ta Flatpak/Snap profillerinden en son kullanılanı seçer.
- Video dosya adlarına çözünürlük eklenir (`Başlık [1080p].mp4`): yt-dlp aynı adlı dosyayı "already downloaded" diyerek atladığı için aksi halde aynı videonun ikinci kalitesi indirilemezdi.

## Uygulama güncellemeleri ve sürüm yayınlama

Uygulama açılışta ve Ayarlar > Uygulama'dan `https://github.com/yellow-three/vidra/releases/latest/download/latest.json` adresini kontrol eder (tauri-plugin-updater). Güncellemeler minisign ile imzalıdır; açık anahtar `tauri.conf.json`'dadır.

- Özel anahtar repo dışında: `~/.tauri/youtube-downloader.key` (parolalı). **Kaybolursa kurulu uygulamalara bir daha güncelleme gönderilemez — yedekleyin.**
- Repo Settings > Secrets and variables > Actions > **Repository secrets**: `TAURI_SIGNING_PRIVATE_KEY` (anahtar dosyasının içeriği), `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.
- Yayın: `tauri.conf.json` ve `package.json` sürümünü artırın, `vX.Y.Z` etiketi push edin. `.github/workflows/release.yml` imzalı paketleri ve `latest.json`'ı bu repoda **taslak** bir release'e yükler; taslağı yayınlayınca kurulu uygulamalar güncellemeyi görür.
- v0.1.0 kurulumları güncellemeyi silinmiş `vidra-releases` reposunda aradığı için kendiliğinden güncellenmez; yeni sürümü elle kurmaları gerekir (ayarlar ve geçmiş taşınır). v0.1.0'ın dosyaları bu reponun release'lerine taşındı.
- Linux'ta `latest.json`'daki `linux-x86_64` girdisi AppImage'ı gösterir; `.deb`/`.rpm` kurulumlarının kendini güncellemesi denenmedi.
- Yerel `tauri build` imza anahtarı istemez; updater dosyaları yalnızca release workflow'unda üretilir.

## Testler

```bash
npm test                         # Vitest: src/engine, src/features
npm run test:ui                  # Playwright: UI akışları, sahte Tauri backend'i (e2e/)
npm run typecheck                # uygulama + testler
cargo test --manifest-path src-tauri/Cargo.toml   # süreç çalıştırıcı (Unix; Windows testleri CI'da)
```

## Lisans

[MIT](LICENSE). Paketlenen bileşenlerin kendi lisansları vardır: yt-dlp (Unlicense), deno (MIT), FFmpeg (LGPL; lisans metni pakette `licenses/` altında).
