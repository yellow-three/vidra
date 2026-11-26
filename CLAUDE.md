# Vidra

YouTube ve diğer sitelerden video/ses indiren masaüstü uygulaması: Tauri 2 (Rust) + React 19 + TypeScript.
İndirme işini harici yt-dlp / ffmpeg / deno sidecar'ları yapar; uygulama bunları ilk açılışta indirir (`src-tauri/src/tools.rs`).

## Komutlar

```bash
npm run typecheck   # tsc (uygulama + testler)
npm run lint        # ESLint (src-tauri hariç)
npm test            # Vitest: motor, store, SQLite deposu
npm run test:ui     # Playwright: UI akışları, sahte Tauri backend ile
npm run tauri dev   # uygulamayı çalıştır
npm run sidecars    # yt-dlp/ffmpeg ikililerini src-tauri/binaries'e indir
```

Rust tarafı (`src-tauri/`): `cargo fmt --check`, `cargo clippy`, `cargo test`. CI ikisini de Linux + Windows'ta çalıştırır.

## Yapı

- `src/engine/` — platformdan bağımsız yt-dlp/ffmpeg argüman üretimi ve çıktı ayrıştırma. Saf fonksiyonlar, `*.test.ts` yanında.
- `src/features/<özellik>/` — ekranlar, store'lar (Zustand), sorgular (TanStack Query).
- `src/lib/appApi.ts` + `src/types/app-api.ts` — Tauri `invoke` çağrılarının tek kapısı. Yeni bir `#[tauri::command]` eklenirse üçüne birden eklenir: `lib.rs` (`invoke_handler`), `appApi.ts`, `AppApi` tipi — ve `e2e/tauri-mock.ts`.
- `src/i18n/tr.ts` + `en.ts` — tüm kullanıcı metinleri; ikisi de güncellenir, UI'da sabit metin yazılmaz.
- `src/features/whatsNew/releases.ts` — "Yenilikler" penceresi; `CHANGELOG.md` ile aynı içerik, kullanıcı diliyle.

## Kurallar

- Kod yorumları Türkçe ve ASCII (ç/ş/ğ yerine c/s/g); kullanıcıya görünen metinler i18n'de tam Türkçe.
- Yeni yt-dlp seçenekleri için `/ytdlp-option` skill'ini izle; sürüm çıkarmak için `/release`.
- `package-lock.json`, `Cargo.lock`, `src-tauri/gen/`, `src-tauri/binaries/`, `dist/` elle düzenlenmez (hook engeller).
- UI E2E testleri gerçek Tauri'ye değil `e2e/tauri-mock.ts`'e karşı çalışır; yeni komut eklenince mock'a da eklenmeli, yoksa UI testi düşer.
- Rust satır genişliği 120 (`src-tauri/rustfmt.toml`); `.rs` düzenlemelerinden sonra hook rustfmt çalıştırır.
- Güvenlik açısından hassas yerler (`process.rs`, `cookies.rs`, `capabilities/`, deep-link, updater) değiştiğinde `tauri-security-reviewer` agent'ını çalıştır.
