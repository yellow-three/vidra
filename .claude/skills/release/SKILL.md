---
name: release
description: Vidra için yeni sürüm hazırlar — sürüm numarasını tüm dosyalarda birlikte artırır, CHANGELOG, Yenilikler penceresi ve flatpak metainfo kayıtlarını ekler, doğrular ve `chore: release X.Y.Z` commit'i atar.
disable-model-invocation: true
argument-hint: "[major|minor|patch|X.Y.Z]"
---

# Sürüm çıkarma

Argüman: `$ARGUMENTS` (boşsa `minor`). Bugünün tarihini `date +%F` ile al.

## 1. Ön kontrol

- `git status` temiz olmalı; değilse dur ve kullanıcıya sor (başkasının değişikliklerini commit'leme).
- Mevcut sürüm: `package.json` içindeki `version`. Yeni sürümü SemVer'e göre hesapla.
- Son sürümden bu yana değişiklikler: `git log --no-merges --format='%s%n%b' <son-sürüm-commit'i>..HEAD`
  (son sürüm commit'i: `git log --grep '^chore: release' -1 --format=%h`).

## 2. Sürüm numarası — hepsi aynı anda

| Dosya | Alan |
|---|---|
| `package.json` | `"version"` |
| `package-lock.json` | `npm install --package-lock-only` ile güncelle (elle düzenleme) |
| `src-tauri/Cargo.toml` | `[package] version` |
| `src-tauri/Cargo.lock` | `cargo update -p vidra --manifest-path src-tauri/Cargo.toml --offline` ile güncelle |
| `src-tauri/tauri.conf.json` | `"version"` |

## 3. Notlar — dört yer, aynı içerik

1. **`CHANGELOG.md`** — `## [Yayınlanmamış]` altındakileri yeni `## [X.Y.Z] - YYYY-AA-GG` başlığına taşı; commit'lerden eksik kalanları ekle.
   Başlıklar: `### Eklenenler`, `### Değişenler`, `### Düzeltilenler`. Kullanıcının göreceği davranışı yaz, kod ayrıntısını değil.
   Sonraki sürüme kalanlar `[Yayınlanmamış]` altında kalır.
2. **`src/features/whatsNew/releases.ts`** — `RELEASES` dizisinin **en üstüne** yeni kayıt: `tr` ve `en` notları,
   konu başlıklarına gruplanmış, son kullanıcı diliyle (CHANGELOG'dan daha sade).
3. **`packaging/flatpak/io.github.yellow_three.vidra.metainfo.xml`** — `<releases>` içinde en üste
   `<release version="X.Y.Z" date="YYYY-AA-GG">` ve tek paragraflık İngilizce özet.
4. `README.md` sürüme özgü bir şey içeriyorsa (indirme linki vb.) güncelle.

## 4. Doğrula

```bash
npm run typecheck && npm run lint && npm test
cargo check --manifest-path src-tauri/Cargo.toml
grep -n '"version"' package.json src-tauri/tauri.conf.json; grep -n '^version' src-tauri/Cargo.toml
```

Üç sürüm numarası aynı olmalı. Herhangi bir adım düşerse commit atma, kullanıcıya bildir.

## 5. Commit

`chore: release X.Y.Z` — gövdede öne çıkan 2-4 değişiklik. Tag oluşturma ve push'u kullanıcıya bırak
(`.github/workflows/release.yml` tag ile tetiklenir); main'e merge etme.
