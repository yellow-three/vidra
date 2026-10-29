# Değişiklikler / Changelog

Biçim [Keep a Changelog](https://keepachangelog.com/tr-TR/1.1.0/); sürümler [SemVer](https://semver.org/lang/tr/).

## [Yayınlanmamış]

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

[Yayınlanmamış]: https://github.com/yellow-three/vidra/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/yellow-three/vidra/compare/v0.2.2...v0.3.0
[0.2.2]: https://github.com/yellow-three/vidra/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/yellow-three/vidra/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/yellow-three/vidra/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/yellow-three/vidra/tree/v0.1.0
