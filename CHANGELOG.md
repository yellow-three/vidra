# Değişiklikler / Changelog

Biçim [Keep a Changelog](https://keepachangelog.com/tr-TR/1.1.0/); sürümler [SemVer](https://semver.org/lang/tr/).

## [Yayınlanmamış]

### Sonraki sürüme kalanlar
- Dosyadan link listesi içe aktarma, izlendi olarak işaretleme, indirme sonrası komut (docs/roadmap.md, Grup 6).

## [0.5.0] - 2026-10-30

### Eklenenler
- Her video için altyazı, altyazı dili, dosya adı ve bölümlere ayırma seçimi (kartta "Seçenekler").
- Dosya adı kalıpları: kanal, başlık, video kimliği, tarih, site, sıra no; hazır kalıplar ve özel kalıp.
- Abonelikler: kanal ya da liste takibi, yeni videolar seçim penceresinde "Yeni" olarak gelir.
- Liste penceresinde ilk N video, kısa videoları çıkarma, ters sıra, tarihten sonrakiler.
- Otomatik altyazılar, .srt olarak kaydetme, videodaki altyazı dilleri.
- Opus, FLAC, WAV; MP3 kalitesi.
- Paralel parça indirme, indirmeler arası bekleme, en büyük dosya sınırı; kopan bağlantıda otomatik yeniden deneme.
- Sonradan işleme: bölümlere ayırma, bölüm kesme, MP4/MKV kap değiştirme, sanatçı/şarkı etiketleri, kapak/açıklama/bilgi/yorum dosyaları, dosya tarihi.
- Canlı yayınları baştan kaydetme, başlamamış yayını bekleyip indirme, şifreli videolar, .netrc ile giriş, yaş sınırı.
- Tarayıcı taklidi, bölge, IPv4/IPv6; klasör düzeni, sade/Windows uyumlu dosya adları, en uzun ad, üzerine yazma, aria2.

### Düzeltilenler
- Bir altyazı dili alınamadığında (YouTube 429) indirmenin tamamı başarısız oluyordu.
- Dosya boyutu sınırına ya da tarih süzgecine takılan indirme tamamlanmış gibi görünüyordu.

## [0.4.0] - 2026-10-30

### Eklenenler
- İndirme sayfasında arama; durum kutuları listeyi süzüyor.
- Toplu işlemler: seçilenleri indir, duraklat, sürdür, yeniden dene, iptal et; tümünü duraklat ve sürdür.
- Oynatma listesi linki verilince videolar bir pencerede listeleniyor, yalnızca seçilenler kuyruğa ekleniyor.
- Format menüsünde "En iyi kombinasyonlar": en iyi kalite (en iyi video + en iyi ses) ve en iyi ses, dönüştürmeden; tüm formatlarda en iyiler ★ ile işaretli.

### Değişenler
- Durum çubuğu liste uzasa da pencerenin altında görünür kalıyor.

## [0.3.1] - 2026-10-30

### Düzeltilenler
- "Kapatınca tepside çalış" açıkken pencere, indirme olmasa da tepsiye geçiyor (önceden yalnızca indirme sürerken geçiyor, aksi halde uygulama kapanıyordu). "Arka planda çalışıyor" bildirimi oturumda bir kez gösteriliyor.

## [0.3.0] - 2026-10-29

### Eklenenler
- yt-dlp'nin desteklediği tüm siteler (Vimeo, Dailymotion, SoundCloud...).
- "Tüm formatlar": yt-dlp'nin listelediği her format (VP9/AV1, 60 fps, HDR, Opus) kodek ve boyutuyla.
- İndirmeleri duraklatma ve kaldığı yerden sürdürme.
- İndirme sürerken pencere kapatılınca sistem tepsisinde çalışmaya devam etme.
- İndirmeden önce disk alanı kontrolü.
- Pano izleme ayarı: yalnızca YouTube, tüm linkler ya da kapalı.
- Kayıt dosyası (`vidra.log`) ve hata kartında "Hata bildir" düğmesi.

### Düzeltilenler
- zip kütüphanesindeki arşiv açma güvenlik kayıtları (RUSTSEC-2026-0367/0368/0369).

## [0.2.2] - 2026-10-29

### Değişenler
- Klasör indirme bitince kendiliğinden açılmıyor; biten indirme kartında "Klasörü aç" düğmesi var.

### Düzeltilenler
- Windows'ta klasör açılınca Belgelerim yerine indirme klasörü açılıyor.

## [0.2.1] - 2026-10-28

### Düzeltilenler
- Kopyalanan linkler kutuda yazılanı silmiyor.
- Link olmayan metin yt-dlp'ye gönderilmiyor.
- Uygulama kapanırken yarıda kalan indirmeler kendiliğinden sürüyor.
- Dönüştürme önceki çıktının üzerine yazmıyor.
- Uygulama ikinci kez açılınca mevcut pencere öne geliyor.

## [0.2.0] - 2026-10-28

### Eklenenler
- yt-dlp, FFmpeg ve deno pakete eklenmek yerine ilk açılışta indiriliyor (paketler ~150 MB'tan 8 MB'a indi); sistemde uygun FFmpeg/deno varsa onlar kullanılıyor.
- Video bölümü indirme, oynatma listesi klasörleri, geçmişte arama, tekrar uyarısı, İngilizce arayüz, SponsorBlock, AUR ve Flatpak tarifleri.

## [0.1.0] - 2026-10-26

- İlk sürüm ("YouTube Downloader" adıyla).

[Yayınlanmamış]: https://github.com/yellow-three/vidra/compare/v0.5.0...HEAD
[0.5.0]: https://github.com/yellow-three/vidra/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/yellow-three/vidra/compare/v0.3.1...v0.4.0
[0.3.1]: https://github.com/yellow-three/vidra/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/yellow-three/vidra/compare/v0.2.2...v0.3.0
[0.2.2]: https://github.com/yellow-three/vidra/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/yellow-three/vidra/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/yellow-three/vidra/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/yellow-three/vidra/tree/v0.1.0
