import type { FileOptions, PostProcessing, SponsorBlockMode, TimeRange, VideoMeta } from '../engine/types';

export interface VideoFormat {
  formatId: string;
  resolution: string;
  ext: string;
  note: string;
  filesize: string;
  /** Bilinen ya da tahmini boyut (bayt); disk alani kontrolu icin. */
  bytes?: number;
}

export interface Task {
  id: string;
  url: string;
  title: string;
  thumbnail?: string;
  /** Oynatma listesinden geldiyse listenin adi. */
  playlist?: string;
  formats?: VideoFormat[];
  selectedFormatId?: string;
  percent: number;
  speed: string;
  eta: string;
  status: TaskStatus;
  message?: string;
  /** Hata mesajinin cevrilmeden onceki ham hali. */
  detail?: string;
  /** Yalnizca bu aralik indirilir. */
  section?: TimeRange;
  /** Dosya adi onizlemesi icin kanal, kimlik, tarih. */
  meta?: VideoMeta;
  /** Bu video icin altyazi gomme; bos ise ayardaki varsayilan. */
  subtitles?: boolean;
  /** Canli yayini en bastan kaydet. */
  liveFromStart?: boolean;
  /** Henuz baslamamis yayini bekle. */
  waitForVideo?: boolean;
  /** Sifreli video icin sifre; diske (kuyruk kaydina) yazilmaz. */
  videoPassword?: string;
  /** Canli yayinda inen miktar. */
  downloaded?: string;
  /** Bu video bolumlere ayrilsin mi; bos ise ayardaki varsayilan. */
  splitChapters?: boolean;
  /** Listedeki sira, orn. `03` (dosya adindaki Sira no). */
  playlistIndex?: string;
  /** YYYYMMDD: bu tarihten once yuklenmisse indirilmez. */
  dateAfter?: string;
  /** Bu video icin altyazi dilleri (`tr,en`); bos ise ayardaki diller. */
  subtitleLangs?: string;
  /** Bu video icin dosya adi kalibi; bos ise ayardaki varsayilan (engine/filename.ts). */
  filenamePattern?: string;
  /** Inen dosyanin yolu (tamamlaninca). */
  filePath?: string;
  /** Duraklatilan indirmenin yarim dosyasi; iptal edilirse silinir, surdurulunce yt-dlp devam eder. */
  partial?: { destination: string; since: number };
  /** Uygulama kapanirken indiriliyordu ya da siradaydi; acilista kendiliginden surer. */
  resume?: boolean;
}

export type TaskStatus = 'analyzing' | 'ready-to-select' | 'queued' | 'downloading' | 'paused' | 'complete' | 'cancelled' | 'error';

export interface AppSettings extends PostProcessing, FileOptions {
  /** Tarayici taklidi (`--impersonate`), orn. `chrome`. */
  impersonate?: string;
  /** Bolge engeli icin ulke kodu (`--xff`). */
  xff?: string;
  /** Yalnizca IPv4 (4) ya da IPv6 (6). */
  ipVersion?: 4 | 6;
  /** Indirilen video hesapta izlendi olarak isaretlenir (`--mark-watched`). */
  markWatched?: boolean;
  downloadDir?: string;
  defaultQuality?: string;
  defaultFormat?: string;
  /** 'system', 'vidra-dark' | 'vidra-light' ya da bir daisyUI tema adi. */
  theme?: string;
  /** Tema "Sistem" iken acik modda kullanilan tema (varsayilan vidra-light). */
  themeLight?: string;
  /** Tema "Sistem" iken koyu modda kullanilan tema (varsayilan vidra-dark). */
  themeDark?: string;
  /** Yenilikler penceresinin en son gosterildigi surum. */
  lastSeenVersion?: string;
  downloadSubtitles?: boolean;
  /** `--sub-langs` degeri (varsayilan `tr,en`). */
  subtitleLangs?: string;
  /** Otomatik (konusmadan uretilen) altyazilari da kullan. */
  autoSubtitles?: boolean;
  /** Altyaziyi ayrica .srt dosyasi olarak da kaydet. */
  subtitleFile?: boolean;
  /** `-N`: ayni anda indirilen parca sayisi (varsayilan 1). */
  concurrentFragments?: number;
  /** Indirmeler arasi bekleme, saniye (varsayilan 0). */
  sleepInterval?: number;
  /** En buyuk dosya, orn. `2G`; bos ise sinirsiz. */
  maxFilesize?: string;
  /** MP3 kalitesi: `0` (en iyi VBR) ya da `320K`, `192K`, `128K`. */
  mp3Quality?: string;
  /** Oynatma listesi videolari liste adiyla bir alt klasore iner (varsayilan acik). */
  playlistSubfolder?: boolean;
  /** ffprobe kurulu degilse uygulanmaz. */
  sponsorBlock?: SponsorBlockMode;
  /** Kapak resmi ve baslik/kanal bilgilerini dosyaya gomer (varsayilan acik). */
  embedMetadata?: boolean;
  /** Ayni anda calisan indirme sayisi (varsayilan 2). */
  maxConcurrentDownloads?: number;
  /** Varsayilan dosya adi: engine/filename.ts FILENAME_PRESETS anahtari ya da `custom`. */
  filenameTemplate?: string;
  /** `filenameTemplate` `custom` iken kullanilan kalip, orn. `{channel} - {title}`. */
  filenameCustom?: string;
  /** yt-dlp `--limit-rate` degeri; bos ise sinirsiz. */
  rateLimit?: string;
  /** `--cookies-from-browser` icin tarayici adi (firefox, chrome...); bos ise kapali. */
  cookiesFromBrowser?: string;
  proxy?: string;
  /** Acilista haftada bir yt-dlp -U (varsayilan acik). */
  autoUpdateYtdlp?: boolean;
  /** Son basarili otomatik yt-dlp guncellemesi, Unix ms. */
  ytdlpCheckedAt?: number;
  legalAccepted?: boolean;
  /** Indirme surerken pencere kapatilinca tepside calismaya devam et (varsayilan acik). */
  closeToTray?: boolean;
  /** Kopyalanan linklerin kutuya gelmesi (varsayilan `youtube`). */
  clipboardMode?: 'off' | 'youtube' | 'all';
  /** `.netrc` dosyasindaki kullanici adi/sifre ile site girisi. */
  useNetrc?: boolean;
  /** Bos ise varsayilan `~/.netrc`. */
  netrcPath?: string;
  /** Bu yasin ustundeki icerik indirilmez; 0/bos sinirsiz. */
  ageLimit?: number;
  subscriptions?: Subscription[];
  /** Acilista abonelikleri kontrol et (varsayilan acik). */
  checkSubscriptionsOnStart?: boolean;
  /** Arayuz dili; bos ise sistem dili. */
  language?: 'tr' | 'en';
}

/** Takip edilen kanal ya da oynatma listesi (features/subscriptions). */
export interface Subscription {
  id: string;
  url: string;
  title: string;
  addedAt: number;
  checkedAt?: number;
  /** Daha once gosterilmis videolarin anahtarlari (videoKey); bunlar yeni sayilmaz. */
  seen: string[];
}

export interface HistoryItem {
  id: string;
  title: string;
  url: string;
  duration?: number;
  thumbnail?: string;
  formatId: string;
  quality: string;
  ext: string;
  fileSize: string;
  filePath: string;
  completedAt: string;
}

export type { AppApi, IpcResult } from './app-api';

