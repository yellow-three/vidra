# Vidra

YouTube ve yt-dlp'nin desteklediği yüzlerce siteden video ve ses indiren masaüstü uygulaması. Tauri 2 + React 19 + Tailwind/DaisyUI, indirme motoru yt-dlp + FFmpeg.

**[Son sürümü indir](https://github.com/yellow-three/vidra/releases/latest)**

- YouTube'un yanında yt-dlp'nin desteklediği diğer siteler (Vimeo, Dailymotion, SoundCloud, archive.org...)
- Video (4K'ya kadar, MP4) veya ses (MP3, M4A) indirme; kapak resmi, başlık, kanal ve bölümler dosyaya gömülür
- "Tüm formatlar": yt-dlp'nin listelediği her format (VP9/AV1, 60 fps, HDR, Opus...) çözünürlük, kodek ve boyutuyla seçilebilir
- Oynatma listeleri: listenin linkini yapıştırın, videolar kuyruğa gelir, "Hepsini indir" ile topluca inerler; dosyalar listenin adıyla bir klasöre kaydedilir
- Videonun yalnızca bir bölümünü indirme (başlangıç–bitiş)
- Birden fazla linki tek seferde yapıştırma; kuyrukta ya da geçmişte olan video tekrar eklenince uyarı
- Kuyruk: aynı anda kaç indirme yapılacağı ayarlanır, sıradakiler yukarı/aşağı taşınarak öne alınır; indirmeler duraklatılıp sürdürülebilir; uygulama kapansa da kuyruk kalır, yarıda kalan indirme kaldığı yerden sürer
- Pencere kapatılınca Vidra sistem tepsisinde çalışmaya devam eder (çıkış tepsi menüsünden; Ayarlar > Davranış'tan kapatılabilir)
- İndirmeden önce disk alanı kontrolü
- Pano izleme: kopyalanan YouTube linkleri (ya da istenirse tüm linkler) kutuya kendiliğinden gelir; Ayarlar > Davranış'tan kapatılabilir
- Geçmiş: arama, dosyayı oynatma, yeniden indirme; diskten silinen dosyalar işaretlenir
- Tarayıcı çerezleri, proxy, hız sınırı, dosya adı biçimi, altyazı dilleri
- SponsorBlock: sponsor bölümlerini işaretleme ya da kesme (gereken ffprobe istenirse kurulumda ya da sonradan Ayarlar'dan indirilir)
- Türkçe ve İngilizce arayüz (sistem diline göre; Ayarlar > Görünüm'den değiştirilir)
- yt-dlp haftada bir kendiliğinden güncellenir

*English:* Vidra is a desktop app for downloading video and audio from YouTube and the other sites yt-dlp supports, built on yt-dlp and FFmpeg. The interface follows your system language (Turkish or English) and can be switched in Settings > Appearance.

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

Paketi küçük tutmak için yt-dlp, FFmpeg ve deno pakete eklenmez. İlk açılışta bir kurulum ekranı bunları resmi kaynaklarından indirir ve doğrular (yaklaşık 220 MB; internet bağlantısı gerekir, kurumsal ağlar için ekranda proxy alanı vardır). Bileşenler kullanıcının veri klasörüne kurulur; Ayarlar > Sistem > Bileşenler'den yeniden indirilebilir. Bilgisayarda uygun bir FFmpeg (5 ve üstü) ya da deno (2 ve üstü) zaten kuruluysa onlar kullanılır ve indirilmez (Linux'ta FFmpeg çoğu zaman kuruludur; o durumda indirme ~85 MB'tır).

## Güncelleme

Uygulama yeni sürümü açılışta kendisi bulur; Ayarlar > Uygulama'dan da kontrol edilebilir. Otomatik güncelleme çalışmazsa yeni sürümü yukarıdaki gibi kurmanız yeterlidir: ayarlar ve indirme geçmişi korunur.

YouTube değiştikçe indirmeler bozulabilir; önce Ayarlar'dan yt-dlp'yi güncelleyin.

## Sorun giderme

- **"YouTube bot doğrulaması istedi"**, yaş kısıtlamalı veya üyelere özel videolar: Ayarlar > Ağ ve hesap > Tarayıcı çerezleri'nden YouTube'a giriş yaptığınız tarayıcıyı seçin. Linux'ta Flatpak ve Snap tarayıcıların profilleri de bulunur. Windows'ta Chrome ve Edge çerezleri okunamayabilir; Firefox'u seçin.
- **403 hatası** ya da beklenmedik indirme hataları: Ayarlar > Sistem'den yt-dlp'yi güncelleyin.
- Hata kartındaki **Ayrıntı** yt-dlp'nin özgün mesajını gösterir. **Hata bildir** düğmesi bu mesaj ve sürüm bilgileriyle dolu bir GitHub issue taslağı açar; göndermeden önce düzenleyebilirsiniz.
- Uygulama `vidra.log` adlı bir kayıt dosyası tutar (Ayarlar > Sistem > Kayıt dosyaları). Hata bildirirken eklemeniz sorunu bulmayı kolaylaştırır.
- **Sistem tepsisi simgesi görünmüyor** (GNOME): tepsi için "AppIndicator" uzantısı gerekir. Simge yoksa da Vidra'yı yeniden açmak pencereyi geri getirir.

## Kaldırma

- Windows: Ayarlar > Uygulamalar > Vidra > Kaldır
- `.deb`: `sudo apt remove vidra`
- `.rpm`: `sudo dnf remove vidra` (openSUSE: `sudo zypper remove vidra`)
- AppImage: dosyayı silin

v0.1.0'ın paket adı `you-tube-downloader`'dır; Vidra paketi kurulunca onun yerini alır.

Ayarlar, geçmiş ve indirilen bileşenler kaldırmadan sonra da kalır; tamamen silmek için Linux'ta `~/.config/io.github.yellow-three.vidra` ve `~/.local/share/io.github.yellow-three.vidra` (Windows: `%APPDATA%\io.github.yellow-three.vidra`) (v0.1.0: `com.abdurrahman.youtubedownloader`) klasörlerini silin.

İndirilen içeriklerin telif haklarına ve YouTube Hizmet Şartları'na uygun kullanılması kullanıcının sorumluluğundadır.

---

# Geliştirme

İlk hedef masaüstü; Android sonraya bırakıldı.

## Mimari kararlar ve yol haritası

- **Tauri 2 + React/TS**: tek kod tabanıyla Windows, macOS, Linux ve Android. Flutter (Dart deneyimi yok), Compose Multiplatform (tamamı Kotlin), Lynx (Linux yok, ekosistem genç), React Native/Expo (Linux masaüstü yok) ve Electron (ağır, mobil yok) elendi. Plan B: Android deneyimi yetersiz kalırsa Expo (mobil) + Tauri (masaüstü) + ortak TS paketleri (motor, kuyruk, tipler).
- yt-dlp'ye özgü her şey `src/engine/`'de TS'tir; Rust yalnızca genel süreç çalıştırıcı ve platform işleridir. Android'de aynı motor, `youtubedl-android`'i saran küçük bir Kotlin plugin'iyle çalışacak.
- **iOS kapsam dışı** (App Store izin vermiyor, alt süreç yok); gerekirse ileride self-hosted sunucu modu (FastAPI + yt-dlp) ile iOS/web istemcisi.
- **Google Play bu tür uygulamaları kabul etmiyor**; Android dağıtımı GitHub Releases / F-Droid (APK) üzerinden olacak.

Android (sıradaki faz):

- [ ] Tauri Android hedefi
- [ ] Kotlin plugin: `youtubedl-android` (init / getInfo / download / progress / update)
- [ ] Foreground service ve bildirimle arka planda indirme
- [ ] Paylaş menüsünden link alma (share intent)
- [ ] APK dağıtımı (GitHub Releases)

Tarayıcı eklentisi (linki Vidra'ya gönderir; `vidra://` deep link, sonra gerekirse native messaging): [docs/browser-extension.md](docs/browser-extension.md).

Referanslar: [youtubedl-android](https://github.com/yausername/youtubedl-android), [Seal](https://github.com/JunkFood02/Seal) (Android referans uygulama).

Uygulama v0.1.0'da "YouTube Downloader" (`com.abdurrahman.youtubedownloader`) adıyla, ayrı (artık silinmiş) `vidra-releases` reposunda yayınlandı. Kimlik `io.github.yellow-three.vidra` oldu; eski ayarlar, geçmiş ve yt-dlp kopyası ilk açılışta yeni klasöre taşınır (`src-tauri/src/legacy.rs`). `.deb`/`.rpm` paketleri eski `you-tube-downloader` paketinin yerini alır.

## Dağıtım notları

- Release notlarındaki kısa kurulum metni `.github/workflows/release.yml` içindeki `releaseBody`'dedir; yukarıdaki "Kurulum" bölümüyle birlikte güncellenmelidir.
- AppImage, AppImage'ın statik runtime'ıyla gelir: `libfuse2` istemez, yalnızca `fusermount` (`fuse3` paketi) gerekir.
- Windows kurulum dosyaları kod imzalı değildir; SmartScreen uyarı verir.
- Paketler araç içermez (`.deb` ~10 MB); araçlar ilk açılışta indirilir (aşağıda "Bileşenler").
- **AUR** (`packaging/aur/`): `vidra-bin`, release'deki `.deb`'i Arch'a aktarır. Yeni sürümde `pkgver`'i artırıp `updpkgsums` ve `makepkg --printsrcinfo > .SRCINFO` çalıştırın, sonra AUR'daki `vidra-bin` reposuna push edin (AUR hesabı ve SSH anahtarı gerekir).
- **Flatpak** (`packaging/flatpak/`): `.deb`'i GNOME runtime'ına aktaran tarif, `.desktop` ve metainfo. Flathub çalışırken çalıştırılabilir dosya indirmeye izin vermediği için tarif yt-dlp, deno ve FFmpeg'i sidecar adlarıyla pakete ekler; kurulum ekranı Flatpak'te çıkmaz. Sürümler `src-tauri/tools.json` ile aynı tutulmalı; BtbN eski autobuild'leri sildiği için FFmpeg kaynağı her sürümde yenilenmeli. SponsorBlock'un ffprobe indirmesi Flatpak'te de çalışır; Flathub bunu da sorun edebilir. Flatpak app ID'sinde tire kullanılamadığı için `io.github.yellow_three.vidra`'dır (Tauri kimliği ise alt çizgi kabul etmez). Flatpak'te uygulama içi güncelleyici kapalıdır (`is_flatpak`); yt-dlp güncellemesi uygulamanın kendi veri klasöründe çalıştığı için açık kalır. Flathub'a göndermek için tarifteki `sha256`'yı doldurun, metainfo'ya ekran görüntüsü ekleyin ve [flathub/flathub](https://github.com/flathub/flathub)'a PR açın; Flathub kaynaktan derlenmeyen ve kendi kendini güncelleyen (yt-dlp) uygulamaları reddedebilir.

## Gereksinimler

- Node.js 24+
- Rust (stable) ve [Tauri 2 sistem bağımlılıkları](https://v2.tauri.app/start/prerequisites/)

## Arayüz ve temalar

Arayüz daisyUI 5 bileşenleriyle yazılmıştır. `src/index.css` tüm yerleşik daisyUI temalarını açar ve iki özel tema tanımlar: `vidra-dark` (varsayılan) ve `vidra-light` (YouTube renklerinden esinlenir). Ayarlar > Görünüm'den herhangi bir tema seçilebilir; "Sistem" seçeneği işletim sistemine göre Vidra açık/koyu temasını kullanır. Kenar çubuğundaki düğme iki Vidra teması arasında geçer.

Uygulama ikonu `src-tauri/app-icon.svg`'den üretilir:

```bash
npx tauri icon src-tauri/app-icon.svg -o src-tauri/icons
```

## Bileşenler (yt-dlp, FFmpeg, deno)

Paketler araç içermez. İlk açılışta kurulum ekranı (`src/features/setup/`) eksik bileşenleri `src-tauri/src/tools.rs` ile indirir: dosyalar yayıncıların GitHub release'lerinden gelir, SHA-256'ları yayıncının listesiyle (`SHA2-256SUMS`, `.sha256sum`, `checksums.sha256`) doğrulanır ve app data altındaki `bin/`e kurulur:

| Bileşen | Zorunlu | Kaynak | Kurulduğu yer |
|---|---|---|---|
| yt-dlp | evet | yt-dlp release'i (`tools.json` sürümü) | `bin/yt-dlp` |
| deno | evet | deno release'i (`tools.json` sürümü) | `bin/deno` (+ `deno.version`) |
| FFmpeg | evet | BtbN `n9.0` LGPL build'i | `bin/ffmpeg-tools/ffmpeg` (+ lisans) |
| ffprobe | hayır (SponsorBlock) | FFmpeg ile aynı arşiv | `bin/ffmpeg-tools/ffprobe` |

- Sürümler tek yerde sabittir: `src-tauri/tools.json` (uygulama ve `scripts/fetch-sidecars.mjs` ortak okur). Uygulama yeni bir deno sürümü isterse kurulum ekranı yalnızca deno'yu yeniden indirir (atlanabilir; eski sürüm çalışmaya devam eder). yt-dlp'yi haftalık `-U` güncellemesi güncel tutar.
- FFmpeg, BtbN'in `n9.0` dalının en güncel LGPL build'idir; BtbN eski build'leri sildiği için sabitlenemez.
- Sistemde (`PATH`) kurulu ffmpeg / ffprobe / deno uygunsa kullanılır (`src-tauri/src/system_tools.rs`); öncelik sırası indirilen > paketlenmiş > sistemdeki. ffmpeg için sürüm 5+, `libmp3lame`, `aac`, `libvpx`, `libvorbis` ve bir H.264 encoder'ı (`libopenh264` ya da `libx264`) aranır; Dönüştür sayfası MP4 için bulunanı kullanır. Sistem ffprobe'u yalnızca sistem ffmpeg'iyle birlikte kullanılır (`--ffmpeg-location` ikisinin klasörü). deno için 2+ aranır. yt-dlp bilerek sistemden alınmaz: dağıtım paketleri çoğu zaman eskidir ve `/usr/bin` altındaki kopya güncellenemez. Ayarlar'daki "Yine de indir" uygulamanın kendi kopyasına geçirir.
- Sidecar'larla paketlenmiş kurulumda (Flatpak ya da `--config src-tauri/tauri.bundled.conf.json` ile derlenen paket) uygulamanın yanındaki `ytd-` önekli kopyalar kullanılır ve kurulum ekranı çıkmaz. İndirilen kopya varsa önceliklidir. `ytd-` öneki şart: Linux paketleri sidecar'ları `/usr/bin`'e kurar ve önek olmadan sistemdeki `ffmpeg` / `yt-dlp` paketleriyle çakışır.

```bash
npm run sidecars                                                 # src-tauri/binaries/ altına (host hedefi)
npm run tauri build -- --config src-tauri/tauri.bundled.conf.json # araçları içeren paket
FFMPEG_DIR=/yol/lgpl-ffmpeg npm run sidecars                      # macOS: hazır LGPL kaynağı yok
```

- `ffprobe` varsayılan olarak kurulmaz (~140 MB); yalnızca SponsorBlock için gerekir. Kurulum ekranındaki onay kutusuyla ya da Ayarlar > SponsorBlock'tan kurulur. Paketlenmiş ffmpeg ile kullanılırken ffmpeg aynı klasöre bağlanır ve yt-dlp'ye `--ffmpeg-location` olarak bu klasör verilir. yt-dlp birleştirme, MP3/M4A, altyazı/kapak/metadata gömme ve remux'u onsuz aynı çıktıyla yapar; yalnızca HLS (m3u8) indirmelerinde zararsız bir "ffprobe not found" uyarısı yazar. BtbN'in `lgpl-shared` build'i de denendi: ffmpeg + ffprobe + kütüphaneler ~170 MB ve Linux'ta kütüphanelerin `/usr/lib`'e kurulmasını gerektiriyor.
- Gerçek kaynaklardan uçtan uca kurulum testi (~220 MB): `cargo test --manifest-path src-tauri/Cargo.toml -- --ignored real_install`.
- FFmpeg LGPL olduğundan GPL'li `libx264` yoktur; Dönüştür sayfası MP4 için `libopenh264` kullanır. FFmpeg lisans metni FFmpeg ile birlikte `bin/ffmpeg-tools/FFmpeg-LICENSE.txt` olarak kurulur.
- yt-dlp sık bozulur: Ayarlar'daki güncelleme app data `bin/` altındaki kopyada `yt-dlp -U` çalıştırır (paketlenmiş kopya varsa önce oraya kopyalanır; uygulama dizini çoğu kurulumda salt okunurdur). Paketlenmiş kurulum daha yeni bir yt-dlp ile güncellenirse eski kopya açılışta silinir.
- yt-dlp YouTube için JS runtime ister; deno `--js-runtimes deno:<yol>` ile verilir.

## Komutlar

```bash
npm install
npm run tauri dev     # geliştirme
npm run tauri build   # paket üretimi
```

## Yapı

- `src/engine/` — platformdan bağımsız indirme motoru (`DownloadEngine`). yt-dlp argümanları, format seçenekleri, `%(progress)j` ayrıştırma ve yarım dosya seçimi saf TS'tir (`ytdlp.ts`, `ffmpeg.ts`); Android'de de aynı kod kullanılacak. `desktop.ts` bunları Rust süreç çalıştırıcısıyla çalıştırır.
- `src/engine/errors.ts` — yt-dlp hatalarını çözüm öneren mesajlara çevirir (ham metin "Ayrıntı"da kalır).
- `src/i18n/` — arayüz metinleri (`tr.ts`, `en.ts`); bileşenlerde `useT()`, React dışında `msg()`. Dil, ayardaki `language` ya da sistem dilidir; testler Türkçeye sabitlenir.
- `src/features/queue/` — kuyruk store'u, eşzamanlı indirme sınırlayıcı (sıradakiler listedeki sırayla başlar), kuyruğun localStorage'da saklanması (`persistence.ts`).
- `src/features/settings/ytdlpAutoUpdate.ts` — açılışta haftada bir `yt-dlp -U`.
- `src/` diğer — React arayüzü (Home, Downloads, Convert, Settings).
- `src-tauri/src/process.rs` — programdan bağımsız süreç çalıştırıcı: süreci kendi grubunda başlatır (Unix process group, Windows Job Object), stdout/stderr satırlarını `Channel` ile iletir, iptalde ve uygulama kapanırken tüm grubu öldürür. Webview yalnızca izin verilen programları (yt-dlp, ffmpeg) çalıştırabilir.
- `src-tauri/src/tools.rs` — ilk açılıştaki bileşen indirmesi, doğrulama ve arşivden çıkarma.
- `src-tauri/src/dependencies.rs` — araç yollarının çözümü ve yt-dlp güncellemesi.
- `src/features/setup/` — kurulum ekranı.
- `scripts/fetch-sidecars.mjs` — paketlenmiş kurulum için sidecar indirme ve checksum doğrulama.
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

[MIT](LICENSE). İndirilen bileşenlerin kendi lisansları vardır: yt-dlp (Unlicense), deno (MIT), FFmpeg (LGPL; lisans metni FFmpeg ile birlikte kurulur).
