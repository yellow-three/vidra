# Tarayıcı eklentisi — plan

> **Durum (v0.6.0):** Faz 1 (deep link) ve Faz 2 (eklenti MVP) yapıldı. WXT yerine derleme aracı gerektirmeyen sade Manifest V3 kullanıldı (`extension/src`, paketleme `scripts/build-extension.mjs`). Faz 3 (mağazalarda yayın) hesaplarla yapılmalı; Faz 4 ve native messaging sonraya.

Amaç: tarayıcıda açık olan ya da sağ tıklanan bir linki tek tıkla Vidra'ya göndermek. Eklenti indirme yapmaz; linki masaüstü uygulamasına iletir, indirme her zamanki gibi uygulamada yt-dlp ile yapılır.

## Kararlar

- **Kapsam:** yt-dlp'nin desteklediği tüm siteler, yalnızca YouTube değil. Eklenti hangi sitelerin desteklendiğini bilmeye çalışmaz; her sayfada kullanılabilir, linkin desteklenip desteklenmediğine uygulama yt-dlp ile karar verir.
- **Mağazalar:** Firefox Add-ons (AMO) ve Chrome Web Store'un ikisi de hedef (Edge Add-ons da denenebilir).
- **Uygulamaya ulaşma yolu:** önce deep link (`vidra://`), sonra gerekirse native messaging (aşağıda "Sonraya not").
- Yerel HTTP sunucusu (`127.0.0.1:port`) **kullanılmayacak**: herhangi bir web sitesi de o porta istek atabilir, token/CORS korumasıyla uğraşmak ve güvenlik duvarı uyarıları gerekir.

## Faz 1 — Uygulama: `vidra://` deep link

- `tauri-plugin-deep-link` ile `vidra` şeması: `vidra://download?url=<encodeURIComponent>&mode=video|mp3`.
- Uygulama açıkken gelen link `tauri-plugin-single-instance` ile açık pencereye iletilir; kapalıyken başlatma argümanı olarak gelir.
- Gelen link doğrulanır: yalnızca `http`/`https`, uzunluk sınırı, `mode` bilinen değerlerden biri. Geçersizse yok sayılır ve kayıt dosyasına yazılır.
- **Otomatik indirme yok:** link, "link yapıştır" akışına düşer (bilgi + formatlar gösterilir, kullanıcı onaylar). Böylece kötü niyetli bir site `vidra://` linkiyle istenmeyen indirme başlatamaz. Pano izlemenin kullandığı yol yeniden kullanılır.
- Şema kaydı her paket türünde:
  - Windows (NSIS/MSI): kurulum kayıt defterine yazar (deep-link plugin).
  - `.deb`/`.rpm`: `.desktop` dosyasına `MimeType=x-scheme-handler/vidra;`.
  - AppImage: sistem kurulumu yok; uygulama ilk açılışta şemayı kullanıcı için kaydeder (`register` + `xdg-mime`).
  - Flatpak: `packaging/flatpak/io.github.yellow_three.vidra.desktop`'a aynı `MimeType` satırı.
  - AUR: `.deb`'ten geldiği için `.deb` ile aynı.
- Test: link ayrıştırma/doğrulama için Vitest; elle `xdg-open 'vidra://download?url=…'` (Windows: `start`).

## Faz 2 — Eklenti MVP

- **Teknoloji:** Manifest V3 + [WXT](https://wxt.dev) (Chrome, Edge ve Firefox'a tek kod tabanından build), TypeScript + React.
- **Yer:** bu repoda `extension/`; ortak tipler ve URL doğrulama paylaşılır. Eklenti sürümü uygulamadan bağımsızdır.
- **İzinler en az düzeyde:** `contextMenus`, `activeTab`. Site izni (`host_permissions`, `<all_urls>`) ve içerik betiği yok; mağaza incelemesi ve kullanıcı güveni için önemli.
- **Özellikler (öncelik sırasıyla):**
  1. Araç çubuğu düğmesi: açık sekmenin linkini gönderir; açılır pencerede "Video" / "MP3".
  2. Sağ tık menüsü: link, video/ses öğesi ya da sayfa için "Vidra ile indir".
  3. Açılır pencerede "Vidra kurulu değil mi? İndir" bağlantısı (deep link'te kurulu olup olmadığını anlamanın güvenilir yolu yok).
- Metinler Türkçe ve İngilizce (`_locales`).

## Faz 3 — Yayın

- **Firefox AMO:** ilk hedef; YouTube indiricilerine karşı daha esnek.
- **Chrome Web Store:** politikası YouTube'dan indirmeyi sağlayan eklentileri kabul etmiyor. Reddedilme riskini azaltmak için:
  - açıklama ve ekran görüntüleri "linki Vidra masaüstü uygulamasına gönder" ve "yt-dlp destekli siteler" üzerine kurulur; YouTube öne çıkarılmaz, YouTube'a özel arayüz yoktur;
  - reddedilirse yedek: GitHub Releases'ta `.zip` + "geliştirici modunda yükle" talimatı.
- **Edge Add-ons:** Chrome paketiyle denenir.
- README'ye kurulum bölümü; CI'a eklenti build'i ve lint.

## Faz 4 — İsteğe bağlı

- YouTube sayfasına düğme eklemek: YouTube arayüzü sık değiştiği için kırılgan; içerik betiği ve site izni gerektirir (Chrome mağazası riskini de artırır). En sona.

## Sonraya not: native messaging

Deep link tek yönlüdür; eklenti indirmenin durumunu ve uygulamanın kurulu olup olmadığını göremez, tarayıcı da her seferinde "Vidra açılsın mı?" diye sorar. Bunlar gerekirse native messaging eklenir:

- Tarayıcı küçük bir köprü programını (ör. `vidra --native-messaging` ya da ayrı bir ikili) başlatır, eklentiyle stdin/stdout üzerinden JSON alışverişi yapılır.
- Kazanılan: çift yönlü iletişim (ilerleme, bitti/hata, "kurulu mu?"), onay penceresi yok.
- Maliyet: her tarayıcı için ayrı host manifesti kurulmalı (Chrome, Chromium, Brave, Edge, Firefox; Linux'ta `~/.config/<tarayıcı>/NativeMessagingHosts/`, Windows'ta kayıt defteri). Flatpak'te tarayıcı da uygulama da sandbox'ta olduğu için çok zor; AppImage'da ikili yolu değişebildiği için manifest güncel tutulmalı.
- Eklenti tarafında gönderme yöntemi değişir, arayüz aynı kalır; bu yüzden Faz 2'de gönderme işi tek bir fonksiyonda toplanmalı.
