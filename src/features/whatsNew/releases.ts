// Uygulamadaki "Yenilikler" penceresinin icerigi: her surumde kullaniciya ne degisti.
// Yeni surumde en uste bir kayit eklenir (CHANGELOG.md ile ayni icerik, kullanici diliyle).

import type { Language } from '../../i18n';

export interface ReleaseNotes {
  version: string;
  date: string;
  notes: Record<Language, { title: string; items: string[] }[]>;
}

export const RELEASES: ReleaseNotes[] = [
  {
    version: '0.5.0',
    date: '2026-10-30',
    notes: {
      tr: [
        {
          title: 'Her video için ayrı seçenekler',
          items: [
            'Kartlardaki "Seçenekler" ile her videoya ayrı altyazı, altyazı dili, dosya adı ve bölümlere ayırma seçilebilir.',
            'Dosya adı kalıpları: kanal, başlık, video kimliği, tarih, site ve sıra no; hazır kalıplar ya da kendi kalıbınız.',
          ],
        },
        {
          title: 'Abonelikler ve listeler',
          items: [
            'Yeni Abonelikler sayfası: kanal ya da listeleri takip edin, yeni videolar "Yeni" olarak gelsin.',
            'Liste penceresinde ilk N video, kısa videoları çıkarma, ters sıra ve tarihten sonrakiler.',
          ],
        },
        {
          title: 'Altyazı ve ses',
          items: [
            'Otomatik altyazılar, altyazıyı .srt olarak kaydetme, videodaki altyazı dillerinden seçim.',
            'Opus, FLAC ve WAV; MP3 kalitesi ayarı.',
          ],
        },
        {
          title: 'Daha hızlı ve sağlam indirme',
          items: [
            'Parçaları paralel indirme, indirmeler arası bekleme, en büyük dosya sınırı.',
            'Kopan bağlantıda otomatik yeniden deneme; alınamayan bir altyazı artık indirmeyi durdurmuyor.',
          ],
        },
        {
          title: 'Sonradan işleme ve dosyalar',
          items: [
            'Bölümlere ayırma, adı kalıba uyan bölümleri kesme, MP4/MKV kap değiştirme, sanatçı/şarkı etiketleri.',
            'Kapak, açıklama, bilgi ve yorumları ayrıca kaydetme; klasör düzeni (Kanal/Yıl…), sade dosya adları.',
          ],
        },
        {
          title: 'Canlı yayın, giriş, ağ',
          items: [
            'Canlı yayını baştan kaydetme, başlamamış yayını bekleyip indirme, şifreli videolar.',
            '.netrc ile giriş, yaş sınırı, tarayıcı taklidi, bölge ve IPv4/IPv6 seçimi.',
          ],
        },
        {
          title: 'Görünüm',
          items: [
            'Ayarlar sekmelere ayrıldı; temalar ayrı pencerede seçiliyor.',
            '"Sistem" teması seçiliyken açık ve koyu mod için istediğiniz temaları seçebilirsiniz.',
          ],
        },
      ],
      en: [
        {
          title: 'Options for each video',
          items: [
            '"Options" on a card picks subtitles, subtitle languages, file name and chapter splitting for that video.',
            'File name patterns: channel, title, video ID, date, site and number; presets or your own pattern.',
          ],
        },
        {
          title: 'Subscriptions and playlists',
          items: [
            'New Subscriptions page: follow channels or playlists and get their new videos marked "New".',
            'The playlist dialog can select the first N videos, leave out short ones, reverse the order and filter by date.',
          ],
        },
        {
          title: 'Subtitles and audio',
          items: [
            'Automatic subtitles, saving subtitles as .srt, picking from the languages a video has.',
            'Opus, FLAC and WAV; MP3 quality setting.',
          ],
        },
        {
          title: 'Faster, sturdier downloads',
          items: [
            'Parallel fragments, a wait between downloads, a largest file size.',
            'Automatic retries on dropped connections; a subtitle that cannot be fetched no longer stops the download.',
          ],
        },
        {
          title: 'Post-processing and files',
          items: [
            'Split into chapters, cut chapters by name, change the container to MP4/MKV, artist/song tags.',
            'Also save cover, description, details and comments; folder layouts (Channel/Year…), plain file names.',
          ],
        },
        {
          title: 'Live streams, login, network',
          items: [
            'Record live streams from the start, wait for a stream to begin, password-protected videos.',
            '.netrc login, age limit, browser impersonation, region and IPv4/IPv6.',
          ],
        },
        {
          title: 'Look',
          items: [
            'Settings are split into tabs; themes are chosen in their own dialog.',
            'With the "System" theme you choose which themes to use in light and dark mode.',
          ],
        },
      ],
    },
  },
];
