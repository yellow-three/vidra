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

- [ ] **6. İndirme arşivi ve abonelik** (`--download-archive`): İndirilenler atlanır; kanal/liste "yalnız yenileri indir".
- [ ] **7. Tarihe göre süzme** (`--dateafter`, `--datebefore`).
- [ ] **8. Kural ile süzme** (`--match-filters`): Shorts'ları ya da canlı yayınları atlama.
- [ ] **9. Liste sırası** (`--playlist-items`, ters sıra).
- [ ] **10. Liste numarası dosya adında** (`%(playlist_index)s`).

## Grup 3: sonradan işleme

- [ ] **14. Bölümlere ayırma** (`--split-chapters`): Albüm videosunu şarkı şarkı ayırma.
- [ ] **15. Bölüm silme** (`--remove-chapters`): Adı kalıba uyan bölümleri kesme.
- [ ] **17. Video dönüştürme / kap değiştirme** (`--recode-video`, `--remux-video`).
- [ ] **18. Etiket düzenleme** (`--parse-metadata`, `--replace-in-metadata`): "Sanatçı - Şarkı" başlığını etiketlere ayırma.
- [ ] **19. Ek dosyalar** (`--write-thumbnail`, `--write-description`, `--write-info-json`, `--write-comments`).
- [ ] **20. Dosya tarihi** (`--no-mtime`): Yüklenme tarihi mi indirme tarihi mi.

## Grup 4: canlı yayın, giriş, özel durumlar

- [ ] **21. Canlı yayın** (`--live-from-start`, `--wait-for-video`): Baştan indirme, planlanmış yayını bekleme.
- [ ] **22. Şifreli videolar** (`--video-password`).
- [ ] **23. Kullanıcı adı ve parolayla giriş** (`--username`, `--password`, `--netrc`).
- [ ] **24. Yaş sınırı** (`--age-limit`).

## Grup 5: ağ ve dosya sistemi

- [ ] **5. Harici indirici** (`--downloader aria2c`): aria2 kuruluysa.
- [ ] **25. Tarayıcı taklidi** (`--impersonate`): Cloudflare korumalı sitelerde 403 hataları.
- [ ] **26. Bölge engeli** (`--geo-verification-proxy`, `--xff`).
- [ ] **27. Ağ çıkışı** (`--source-address`, `--force-ipv4`/`--force-ipv6`).
- [ ] **28. Güvenli dosya adı** (`--restrict-filenames`, `--windows-filenames`, `--trim-filenames`).
- [ ] **29. Üzerine yazma davranışı** (`--no-overwrites`, `--force-overwrites`).
- [ ] **30. Klasör düzeni** (`-P`, kalıpta klasör): Örneğin Kanal/Yıl/Başlık.

## Grup 6: toplu işler ve otomasyon

- [ ] **31. Dosyadan link listesi** (`-a`): `.txt` dosyasındaki linkleri içe aktarma.
- [ ] **32. İzlendi olarak işaretleme** (`--mark-watched`).
- [ ] **33. İndirme sonrası komut** (`--exec`): İleri düzey; kullanıcının belirlediği komut.
