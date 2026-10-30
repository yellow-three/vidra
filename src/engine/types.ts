// Platformdan bagimsiz indirme motoru sozlesmesi (DownloadEngine).

export type DownloadOption =
  | { kind: 'video'; height: number }
  | { kind: 'best-video' }
  /** En iyi video + en iyi ses, kodek ve kap degistirilmeden (MKV/WebM/MP4). */
  | { kind: 'best' }
  /** En iyi ses, donusturulmeden (Opus/WebM ya da M4A). */
  | { kind: 'best-audio' }
  | { kind: 'mp3' }
  | { kind: 'm4a' }
  /** Diger ses bicimlerine donusturme. */
  | { kind: 'audio'; codec: AudioCodec }
  /** yt-dlp'nin listeledigi bir format, oldugu gibi; yalnizca goruntu olanlara en iyi ses eklenir. */
  | { kind: 'format'; formatId: string; video: boolean; audio: boolean };

export type AudioCodec = 'opus' | 'flac' | 'wav';

/** UI'da secilebilen sade indirme secenegi. */
export interface FormatOption {
  formatId: string;
  resolution: string;
  ext: string;
  note: string;
  filesize: string;
  /** Bilinen ya da tahmini boyut (bayt); disk alani kontrolu icin. */
  bytes?: number;
}

/** Oynatma listesindeki bir video; formatlari indirirken secilir, onceden analiz edilmez. */
/** Dosya adi onizlemesi icin videonun bilinen alanlari (engine/filename.ts). */
export interface VideoMeta {
  id?: string;
  channel?: string;
  date?: string;
  site?: string;
  /** Videonun elle eklenmis altyazi dilleri (orn. `tr`, `en`). */
  subtitles?: string[];
  /** Otomatik altyazinin ozgun dili (YouTube); ceviriler sayilmaz. */
  autoSubtitles?: string[];
  /** Videodaki bolum sayisi (bolumlere ayirma icin). */
  chapters?: number;
  /** Canli yayin durumu: `is_live` suren yayin, `is_upcoming` henuz baslamamis. */
  live?: 'is_live' | 'is_upcoming';
}

/** Indirme sonrasi islemler (Ayarlar > Sonradan isleme ve video secenekleri). */
export interface PostProcessing {
  /** Her bolum ayri dosya olur (`--split-chapters`). */
  splitChapters?: boolean;
  /** Adi bu duzenli ifadeye uyan bolumler kesilir, orn. `(?i)intro|outro`. */
  removeChapters?: string;
  /** Video kabi kayipsiz degistirilir (`--remux-video`). */
  remux?: 'mp4' | 'mkv';
  /** "Sanatci - Sarki" basligi sanatci ve sarki etiketlerine ayrilir. */
  parseArtist?: boolean;
  writeThumbnail?: boolean;
  writeDescription?: boolean;
  writeInfoJson?: boolean;
  /** Yorumlar bilgi dosyasina (JSON) yazilir. */
  writeComments?: boolean;
  /** Dosya tarihi sunucudaki degistirilme tarihi olur (`--mtime`). */
  serverMtime?: boolean;
}

/** Dosya adi ve klasor davranisi (Ayarlar > Dosyalar). */
export interface FileOptions {
  /** `windows`: Windows'ta gecersiz karakterler degisir; `ascii`: yalnizca ASCII, bosluksuz. */
  filenameChars?: 'windows' | 'ascii';
  /** Dosya adi en fazla bu kadar karakter (`--trim-filenames`). */
  trimFilenames?: number;
  /** Ayni adli dosya varsa uzerine yaz (`--force-overwrites`); yoksa atlanir. */
  overwrite?: boolean;
  /** Dosyalar bu klasor duzenine gore ayrilir, orn. `{channel}/{year}`. */
  folderLayout?: string;
  /** aria2c ile indir (sistemde kuruluysa). */
  aria2?: boolean;
}

export interface PlaylistEntry {
  url: string;
  title: string;
  meta?: VideoMeta;
  duration?: number;
  thumbnail?: string;
}

export interface VideoInfo {
  title: string;
  url: string;
  duration?: number;
  thumbnail?: string;
  formats: FormatOption[];
  meta?: VideoMeta;
  /** Link bir oynatma listesiyse girdileri. */
  entries?: PlaylistEntry[];
}

/** Hem analizde hem indirmede kullanilan ag secenekleri. */
export interface NetworkOptions {
  /** `--cookies-from-browser` degeri, orn. `firefox` ya da `chrome:/profil/yolu`. */
  cookiesFromBrowser?: string;
  proxy?: string;
  /** Sifreli videolar (Vimeo vb.) icin `--video-password`. */
  videoPassword?: string;
  /** `.netrc` ile site girisi: `true` varsayilan dosya, metin ise dosya yolu. */
  netrc?: boolean | string;
  /** Bu yasin ustundeki icerik indirilmez (`--age-limit`). */
  ageLimit?: number;
  /** Tarayici taklidi (`--impersonate`): Cloudflare korumali sitelerde 403'u asar. */
  impersonate?: string;
  /** Bolge engeli icin ulke kodu (`--xff`), orn. `US`. */
  xff?: string;
  /** Yalnizca IPv4 ya da IPv6 kullan. */
  ipVersion?: 4 | 6;
}

export interface InfoOptions extends NetworkOptions {
  /** `watch?v=..&list=..` linkinde videonun yerine listenin tamamini getirir. */
  playlist?: boolean;
}

export interface DownloadProgress {
  percent: number;
  speed: string;
  eta: string;
  /** Inen miktar; toplam bilinmeyen canli yayinlarda yuzde yerine gosterilir. */
  downloaded?: string;
}

export interface DownloadRequest extends NetworkOptions, PostProcessing, FileOptions {
  id: string;
  url: string;
  formatId: string;
  outDir: string;
  subtitles: boolean;
  /** Kapak resmi, baslik, kanal, tarih ve bolumleri dosyaya gomer. */
  embedMetadata: boolean;
  /** Dosya adi kalibi, orn. `{channel} - {title}` (engine/filename.ts). */
  filenamePattern?: string;
  /** yt-dlp `--limit-rate` degeri, orn. `5M`. */
  rateLimit?: string;
  /** `--sub-langs` degeri, orn. `tr,en`; bos ise `tr,en`. */
  subtitleLangs?: string;
  /** Dosyanin indirme klasoru icindeki alt klasoru (orn. oynatma listesinin adi). */
  subfolder?: string;
  /** Yalnizca bu araligi indirir (saniye); `end` yoksa videonun sonuna kadar. */
  section?: TimeRange;
  /** ffprobe kurulu degilse motor yok sayar (src-tauri/src/ffprobe.rs). */
  sponsorBlock?: SponsorBlockMode;
  /** Duraklatilip surdurulen indirmenin ilk basladigi an (Unix ms); iptalde o andan beri yazilanlar silinir. */
  partialSince?: number;
  /** Altyaziyi ayrica .srt dosyasi olarak da kaydeder. */
  subtitleFile?: boolean;
  /** Otomatik (konusmadan uretilen) altyazilari da kullanir. */
  autoSubtitles?: boolean;
  /** Ayni anda indirilen parca sayisi (`-N`); HLS/DASH videolarda hizlandirir. */
  concurrentFragments?: number;
  /** Indirmeden once bekleme, saniye (`--sleep-interval`); uzun listelerde engellenmeyi azaltir. */
  sleepInterval?: number;
  /** Bundan buyuk dosyalar indirilmez, orn. `1G` (`--max-filesize`). */
  maxFilesize?: string;
  /** MP3 kalitesi: `0` en iyi VBR ya da `320K` gibi sabit bit hizi. */
  mp3Quality?: string;
  /** Videonun listedeki sirasi, orn. `03` (dosya adindaki `{index}`). */
  playlistIndex?: string;
  /** YYYYMMDD: bu tarihten once yuklenen video indirilmez (`--dateafter`). */
  dateAfter?: string;
  /** Canli yayini baslangicindan itibaren kaydeder (`--live-from-start`). */
  liveFromStart?: boolean;
  /** Henuz baslamamis yayini bekler, baslayinca indirir (`--wait-for-video`). */
  waitForVideo?: boolean;
}

/** `mark`: sponsor bolumleri dosyaya bolum olarak eklenir; `remove`: dosyadan kesilir. */
export type SponsorBlockMode = 'off' | 'mark' | 'remove';

export interface TimeRange {
  start: number;
  end?: number;
}

export type DownloadResult =
  | { status: 'complete'; filePath: string; fileSize?: number }
  | { status: 'cancelled' }
  /** Yarim dosyalar diskte kalir; ayni istekle yeniden indirilince yt-dlp kaldigi yerden surer. */
  | { status: 'paused'; destination: string; startedMs: number }
  | { status: 'error'; message: string; detail?: string };

export interface DownloadEngine {
  getInfo(url: string, options?: InfoOptions): Promise<VideoInfo>;
  download(request: DownloadRequest, onProgress: (p: DownloadProgress) => void): Promise<DownloadResult>;
  cancel(id: string): Promise<void>;
  /** Indirmeyi durdurur ama yarim dosyalari silmez; `download` sonucu `paused` olur. */
  pause(id: string): Promise<void>;
  /** Duraklatilmis indirmenin yarim dosyalarini siler (duraklatilmisken iptal). */
  discardPartial(destination: string, sinceMs: number): Promise<void>;
  updateEngine(): Promise<string | null>;
  engineVersion(): Promise<string | null>;
}
