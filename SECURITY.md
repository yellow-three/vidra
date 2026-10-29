# Güvenlik / Security

## Desteklenen sürümler

Yalnızca [son sürüm](https://github.com/yellow-three/vidra/releases/latest) güvenlik düzeltmesi alır. Uygulama yeni sürümü kendisi bulur ve kurar (Ayarlar > Uygulama).

## Açık bildirme

Güvenlik açıklarını herkese açık bir issue olarak **açmayın**. Bunun yerine GitHub'ın gizli bildirim formunu kullanın: repoda **Security > Report a vulnerability**. Bildirimin birkaç gün içinde yanıtlanması hedeflenir; düzeltme yayınlanana kadar ayrıntılar paylaşılmaz.

Please do not open public issues for security problems; use **Security > Report a vulnerability** on this repository instead.

## Kapsam

- Vidra uygulaması ve bu repodaki paketleme (AUR, Flatpak).
- İlk açılışta indirilen yt-dlp, FFmpeg ve deno resmi kaynaklarından alınır ve SHA-256 ile doğrulanır; bu araçların kendi açıklarını kendi projelerine bildirin.
- Uygulama güncellemeleri minisign ile imzalıdır; imzası tutmayan güncelleme kurulmaz.
