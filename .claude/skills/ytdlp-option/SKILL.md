---
name: ytdlp-option
description: Vidra'ya yeni bir yt-dlp seçeneği (bayrak) ekler — motor tipi, argüman üretimi, test, ayar, store aktarımı, Ayarlar UI'ı ve tr/en metinleri. Yeni indirme/ağ/dosya/sonradan işleme seçeneği eklerken veya docs/roadmap.md'den bir madde uygularken kullan.
argument-hint: "<yt-dlp bayrağı veya roadmap maddesi>"
---

# Yeni yt-dlp seçeneği ekleme

Hedef: `$ARGUMENTS`. Örnek uygulama: commit `e9950b6` (`git show e9950b6`) — her adım orada var.

Önce bayrağın yt-dlp'deki tam davranışını doğrula (`yt-dlp --help` veya context7). Özellikle değerin
neye uygulandığına bak: `--trim-filenames` örneğinde sınır tüm `-o` yoluna uygulanıyordu, sadece dosya adına değil.

## Kontrol listesi (sırayla)

1. **Tip** — `src/engine/types.ts`: seçeneği uygun arayüze ekle
   (`NetworkOptions` → bilgi alma + indirme; `PostProcessing`; `FileOptions`). Türkçe-ASCII JSDoc, parantez içinde bayrak:
   `/** Bolge engeli icin ulke kodu (\`--xff\`), orn. \`US\`. */`
2. **Argüman** — `src/engine/ytdlp.ts`: ağ seçeneğiyse `networkArgs`, değilse `buildDownloadArgs`
   (destructure listesine ekle ki `...network`'e sızmasın). Kalıp: `if (x) args.push('--bayrak', String(x));`.
   Davranış açık değilse bir satırlık "neden" yorumu ekle.
3. **Test** — `src/engine/ytdlp.test.ts`: ilgili `describe` grubuna (yoksa yeni grup) argümanların tam sırasını
   doğrulayan bir test. Önce testi yaz, `npm test -- ytdlp` ile düştüğünü gör, sonra 2. adımı tamamla.
4. **Ayar** — `src/types/index.ts` `AppSettings` (arayüz zaten genişletiyorsa gerekmez).
5. **Aktarım** — `src/features/queue/store.ts`: ağ seçeneği `networkOptions(...)` içinde,
   diğerleri `buildDownloadArgs` çağrısındaki nesnede. Boş değerleri `|| undefined` ile gönderme.
6. **UI** — `src/features/settings/` altındaki ilgili sekme (`DownloadSettings`, `NetworkSettings`,
   `FileSettings`, `PostProcessingSettings`, `SponsorBlockSettings`); ortak bileşenler `SettingsParts.tsx`'te.
   Yeni sekme gerekiyorsa `SettingsForm.tsx`.
7. **Metin** — `src/i18n/tr.ts` ve `src/i18n/en.ts`: etiket + kısa açıklama, ikisinde aynı anahtar.
8. **Sistem aracı gerekiyorsa** (aria2c gibi): `src-tauri/src/lib.rs`'e `#[tauri::command]` + `invoke_handler`,
   `src/lib/appApi.ts`, `src/types/app-api.ts`, **ve `e2e/tauri-mock.ts`** (yoksa UI testleri düşer).
9. **Roadmap** — `docs/roadmap.md`'de maddeyi işaretle; `CHANGELOG.md` `[Yayınlanmamış]` altına kullanıcı diliyle bir satır.

## Doğrula

```bash
npm run typecheck && npm run lint && npm test && npm run test:ui
```

Mümkünse gerçek bir URL ile `tauri dev`'de bir kez indirip yt-dlp komut satırını logda kontrol et.
