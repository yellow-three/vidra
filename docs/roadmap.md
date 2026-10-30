# Yol haritası: yt-dlp özellikleri

yt-dlp'nin (2026.10.26, 246 seçenek) Vidra'da henüz kullanılmayan özellikleri. Sıra, kullanıcıya en çok fark yaratacak olandan başlar; işler aşağıdaki gruplar halinde ayrı PR'larla yapılır. Tamamlanan madde işaretlenir ve hangi PR'da yapıldığı yazılır.

Zaten kullanılanlar: format seçimi ve sıralama (`-f`, `-S`), birleştirme, MP3/M4A, bölüm indirme, altyazı gömme, kapak ve bilgileri gömme, SponsorBlock, çerezler, proxy, hız sınırı, dosya adı kalıbı, yt-dlp güncelleme.

## Grup 1: hız, altyazı, ses

- [x] **1. Parçaları paralel indirme** (`-N`): HLS/DASH videolarda bir videonun parçaları aynı anda iner. Ayarlar'da "parça başına bağlantı" (1–8).
- [x] **2. Yeniden deneme** (`--retries`, `--fragment-retries`, `--retry-sleep`): Kopan bağlantıda indirme yarıda kalmaz.
- [x] **3. İstekler arası bekleme** (`--sleep-requests`, `--sleep-interval`): Uzun listelerde "çok fazla istek" engelini azaltır.
- [x] **4. Dosya boyutu sınırı** (`--max-filesize`, `--min-filesize`).
- [x] **11. Otomatik altyazılar** (`--write-auto-subs`): YouTube'un ürettiği ve çevirdiği altyazılar.
- [x] **12. Altyazıyı ayrı dosya olarak kaydetme** (`--write-subs`, `--convert-subs srt`).
- [x] **13. Videodaki altyazı dillerini gösterme** (`--list-subs` / analiz verisi): Kartta mevcut dillerden seçim.
- [x] **16. Ses kalitesi ve biçimleri** (`--audio-quality`, `--audio-format` opus/flac/wav/aac).

## Grup 2: liste ve kanal

- [x] **6. Abonelik** : Kanal/liste takip edilir, yeni videolar seçim penceresinde "Yeni" olarak gelir. `--download-archive` yerine uygulamanın geçmişi ve görülenler listesi kullanılır: arşiv, aynı videonun başka kalitesini indirmeyi engellerdi.
- [x] **7. Tarihe göre süzme** (`--dateafter`): Liste penceresinde "şu tarihten sonra yüklenenler". Kanal listeleri tarih vermediği için süzgeç indirme sırasında uygulanır.
- [x] **8. Kısa videoları atlama**: Liste penceresinde süresi 1 dakikayı geçmeyenleri çıkarma. (Canlı yayınlar Grup 4'te.)
- [x] **9. Liste sırası**: İlk 10/25/50/100 videoyu seçme, ters sırada ekleme.
- [x] **10. Liste numarası dosya adında**: "Sıra no" alanı ve "Sıra no - Başlık" kalıbı.

## Grup 3: sonradan işleme

- [x] **14. Bölümlere ayırma** (`--split-chapters`): Albüm videosunu şarkı şarkı ayırma.
- [x] **15. Bölüm silme** (`--remove-chapters`): Adı kalıba uyan bölümleri kesme.
- [x] **17. Kap değiştirme** (`--remux-video` MP4/MKV). Yeniden kodlama (`--recode-video`) sunulmuyor: indirilen LGPL FFmpeg'de H.264 kodlayıcısı yok.
- [x] **18. Etiket düzenleme** (`--parse-metadata`, `--replace-in-metadata`): "Sanatçı - Şarkı" başlığını etiketlere ayırma.
- [x] **19. Ek dosyalar** (`--write-thumbnail`, `--write-description`, `--write-info-json`, `--write-comments`).
- [x] **20. Dosya tarihi** (`--no-mtime`): Yüklenme tarihi mi indirme tarihi mi.

## Grup 4: canlı yayın, giriş, özel durumlar

- [x] **21. Canlı yayın** (`--live-from-start`, `--wait-for-video`): Baştan indirme, planlanmış yayını bekleme.
- [x] **22. Şifreli videolar** (`--video-password`).
- [x] **23. Site girişi** (`--netrc`): Şifreler uygulamada saklanmasın diye kullanıcı adı/parola alanı yerine .netrc dosyası kullanılır.
- [x] **24. Yaş sınırı** (`--age-limit`).

## Grup 5: ağ ve dosya sistemi

- [x] **5. Harici indirici** (`--downloader aria2c`): aria2 kuruluysa.
- [x] **25. Tarayıcı taklidi** (`--impersonate`): Cloudflare korumalı sitelerde 403 hataları.
- [x] **26. Bölge engeli** (`--xff`).
- [x] **27. IP sürümü** (`--force-ipv4`/`--force-ipv6`).
- [x] **28. Güvenli dosya adı** (`--restrict-filenames`, `--windows-filenames`, `--trim-filenames`).
- [x] **29. Üzerine yazma davranışı** (`--no-overwrites`, `--force-overwrites`).
- [x] **30. Klasör düzeni** (`-P`, kalıpta klasör): Örneğin Kanal/Yıl/Başlık.

## Grup 6: toplu işler ve otomasyon

- [x] **31. Dosyadan link listesi** (`-a`): `.txt` dosyasındaki linkleri içe aktarma.
- [x] **32. İzlendi olarak işaretleme** (`--mark-watched`).
- [x] **33. İndirme sonrası komut** (`--exec`): İleri düzey; kullanıcının belirlediği komut.
