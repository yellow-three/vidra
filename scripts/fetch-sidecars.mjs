#!/usr/bin/env node
// yt-dlp, LGPL FFmpeg ve deno'yu Tauri sidecar adlariyla
// (src-tauri/binaries/ytd-<ad>-<target-triple>[.exe]) indirir ve checksum dogrular.
// Normal paketler bunlari icermez (uygulama ilk acilista indirir, src-tauri/src/tools.rs);
// sidecar'lar yalnizca `--config src-tauri/tauri.bundled.conf.json` ile paketlenir.
//
//   node scripts/fetch-sidecars.mjs [--target <triple>] [--force]
//
// macOS icin guvenilir hazir bir LGPL FFmpeg kaynagi yok; FFMPEG_DIR ortam
// degiskeniyle icinde ffmpeg bulunan yerel bir klasor verilmelidir.
//
// ffprobe bilerek paketlenmez (kurulu boyutta ~140 MB): yt-dlp'nin kullandigimiz
// tum ozellikleri (birlestirme, MP3/M4A, altyazi/kapak/metadata gomme, remux)
// onsuz ayni ciktiyi verir; yalnizca HLS indirmelerinde zararsiz bir uyari yazar.

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { chmod, copyFile, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import AdmZip from 'adm-zip';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'src-tauri', 'binaries');

// Surumler uygulamanin ilk acilis indirmesiyle ortak: src-tauri/tools.json.
// BtbN yalnizca dallarin "latest" build'lerini tutar; eski build'ler silinir.
const PINS = JSON.parse(await readFile(join(ROOT, 'src-tauri', 'tools.json'), 'utf8'));
const YTDLP_VERSION = PINS.ytdlp;
const DENO_VERSION = PINS.deno;
const FFMPEG_BRANCH = PINS.ffmpeg;

const TARGETS = {
  'x86_64-unknown-linux-gnu': { ytdlp: 'yt-dlp_linux', deno: 'x86_64-unknown-linux-gnu', ffmpeg: 'linux64' },
  'aarch64-unknown-linux-gnu': { ytdlp: 'yt-dlp_linux_aarch64', deno: 'aarch64-unknown-linux-gnu', ffmpeg: 'linuxarm64' },
  'x86_64-pc-windows-msvc': { ytdlp: 'yt-dlp.exe', deno: 'x86_64-pc-windows-msvc', ffmpeg: 'win64' },
  'aarch64-pc-windows-msvc': { ytdlp: 'yt-dlp_arm64.exe', deno: 'aarch64-pc-windows-msvc', ffmpeg: 'winarm64' },
  'x86_64-apple-darwin': { ytdlp: 'yt-dlp_macos', deno: 'x86_64-apple-darwin', ffmpeg: null },
  'aarch64-apple-darwin': { ytdlp: 'yt-dlp_macos', deno: 'aarch64-apple-darwin', ffmpeg: null },
};

function parseArgs(argv) {
  const args = { target: null, force: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--target') args.target = argv[++i];
    else if (argv[i] === '--force') args.force = true;
    else throw new Error(`Bilinmeyen arguman: ${argv[i]}`);
  }
  return args;
}

function hostTriple() {
  const out = execFileSync('rustc', ['-vV'], { encoding: 'utf8' });
  const host = /^host: (.+)$/m.exec(out)?.[1];
  if (!host) throw new Error('rustc -vV ciktisinda host bulunamadi');
  return host;
}

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.text();
}

/** Dosyayi akisla indirir ve SHA-256'sini dondurur. */
async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`${url} -> HTTP ${res.status}`);
  const total = Number(res.headers.get('content-length')) || 0;
  const hash = createHash('sha256');
  let done = 0;
  let lastShown = -1;
  const meter = new Transform({
    transform(chunk, _enc, cb) {
      hash.update(chunk);
      done += chunk.length;
      const pct = total ? Math.floor((done / total) * 100) : -1;
      if (pct >= lastShown + 10) {
        lastShown = pct;
        process.stdout.write(`\r  ${url.split('/').pop()} %${pct}`);
      }
      cb(null, chunk);
    },
  });
  await pipeline(Readable.fromWeb(res.body), meter, createWriteStream(dest));
  process.stdout.write('\n');
  return hash.digest('hex');
}

/** `<hash>  <ad>` satirlarindan (sha256sum / checksums.sha256) dosyanin hash'i. */
function hashFromList(text, fileName) {
  for (const line of text.split(/\r?\n/)) {
    const m = /^([0-9a-f]{64})\s+\*?(.+)$/i.exec(line.trim());
    if (m && m[2].trim() === fileName) return m[1].toLowerCase();
  }
  // deno'nun Windows .sha256sum dosyalari PowerShell bicimindedir; tek hash icerir.
  const only = text.match(/\b[0-9a-f]{64}\b/gi);
  if (only?.length === 1) return only[0].toLowerCase();
  throw new Error(`${fileName} icin checksum bulunamadi`);
}

function verify(actual, expected, name) {
  if (actual !== expected) throw new Error(`${name} checksum uyusmuyor: ${actual} != ${expected}`);
  console.log(`  ${name}: sha256 dogrulandi`);
}

/** Zip icinden adi `names` icinde olan dosyalari `dir`e cikarir. */
async function extractFromZip(zipPath, names, dir) {
  const found = {};
  for (const entry of new AdmZip(zipPath).getEntries()) {
    const base = entry.entryName.split('/').pop();
    if (entry.isDirectory || !names.includes(base) || found[base]) continue;
    found[base] = join(dir, base);
    await writeFile(found[base], entry.getData());
  }
  return found;
}

async function findFiles(dir, names, found = {}) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await findFiles(path, names, found);
    else if (names.includes(entry.name) && !found[entry.name]) found[entry.name] = path;
  }
  return found;
}

// Linux paketleri sidecar'lari /usr/bin'e koyar; onek olmadan sistemdeki
// ffmpeg / yt-dlp paketleriyle cakisirlar.
const PREFIX = 'ytd-';

async function install(src, name, triple, exe) {
  const dest = join(OUT_DIR, `${PREFIX}${name}-${triple}${exe}`);
  await copyFile(src, dest);
  await chmod(dest, 0o755);
  console.log(`  -> ${dest}`);
}

async function fetchYtdlp(asset, triple, exe, work) {
  console.log(`yt-dlp ${YTDLP_VERSION}`);
  const base = `https://github.com/yt-dlp/yt-dlp/releases/download/${YTDLP_VERSION}`;
  const sums = await fetchText(`${base}/SHA2-256SUMS`);
  const file = join(work, asset);
  verify(await download(`${base}/${asset}`, file), hashFromList(sums, asset), asset);
  await install(file, 'yt-dlp', triple, exe);
}

async function fetchDeno(denoTriple, triple, exe, work) {
  console.log(`deno ${DENO_VERSION}`);
  const asset = `deno-${denoTriple}.zip`;
  const base = `https://github.com/denoland/deno/releases/download/${DENO_VERSION}`;
  const zip = join(work, asset);
  verify(await download(`${base}/${asset}`, zip), hashFromList(await fetchText(`${base}/${asset}.sha256sum`), asset), asset);
  const found = await extractFromZip(zip, [`deno${exe}`], work);
  if (!found[`deno${exe}`]) throw new Error(`${asset} icinde deno${exe} yok`);
  await install(found[`deno${exe}`], 'deno', triple, exe);
}

async function fetchFfmpeg(platform, triple, exe, work) {
  const names = [`ffmpeg${exe}`];
  let found;
  let licenseFile;

  if (process.env.FFMPEG_DIR) {
    console.log(`ffmpeg: FFMPEG_DIR=${process.env.FFMPEG_DIR}`);
    found = await findFiles(resolve(process.env.FFMPEG_DIR), names);
  } else if (!platform) {
    throw new Error(
      `${triple} icin hazir LGPL FFmpeg kaynagi tanimli degil. ` +
      'ffmpeg iceren bir klasoru FFMPEG_DIR ile verin (LGPL build oldugunu dogrulayin).',
    );
  } else {
    const { tag, short } = FFMPEG_BRANCH;
    const zip = platform.startsWith('win');
    const asset = `ffmpeg-${tag}-latest-${platform}-lgpl-${short}.${zip ? 'zip' : 'tar.xz'}`;
    console.log(`ffmpeg ${tag} LGPL (${asset})`);
    const base = 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest';
    const sums = await fetchText(`${base}/checksums.sha256`);
    const archive = join(work, asset);
    // "latest" surekli yenilenir; indirme sirasinda degistiyse checksum tutmaz, tekrar deneyin.
    verify(await download(`${base}/${asset}`, archive), hashFromList(sums, asset), asset);

    const extractDir = join(work, 'ffmpeg');
    await mkdir(extractDir);
    if (zip) found = await extractFromZip(archive, [...names, 'LICENSE.txt'], extractDir);
    else {
      execFileSync('tar', ['-xJf', archive, '-C', extractDir]);
      found = await findFiles(extractDir, [...names, 'LICENSE.txt']);
    }
    licenseFile = found['LICENSE.txt'];
  }

  for (const name of names) {
    if (!found[name]) throw new Error(`FFmpeg kaynaginda ${name} bulunamadi`);
    await install(found[name], name.replace(exe, ''), triple, exe);
  }
  if (licenseFile) {
    const licenses = join(OUT_DIR, 'licenses');
    await mkdir(licenses, { recursive: true });
    await copyFile(licenseFile, join(licenses, 'FFmpeg-LICENSE.txt'));
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const triple = args.target ?? hostTriple();
  const target = TARGETS[triple];
  if (!target) throw new Error(`Desteklenmeyen hedef: ${triple}`);
  const exe = triple.includes('windows') ? '.exe' : '';

  await mkdir(OUT_DIR, { recursive: true });
  const stampPath = join(OUT_DIR, `.versions-${triple}.json`);
  const wanted = { YTDLP_VERSION, DENO_VERSION, FFMPEG_BRANCH: FFMPEG_BRANCH.tag, FFMPEG_DIR: process.env.FFMPEG_DIR ?? null };
  // Eski surumlerin indirdigi ffprobe artik paketlenmiyor.
  await rm(join(OUT_DIR, `${PREFIX}ffprobe-${triple}${exe}`), { force: true });
  const expected = ['yt-dlp', 'ffmpeg', 'deno'].map((n) => join(OUT_DIR, `${PREFIX}${n}-${triple}${exe}`));

  if (!args.force) {
    const stamp = await readFile(stampPath, 'utf8').then(JSON.parse, () => null);
    const allPresent = (await Promise.all(expected.map((p) => stat(p).then(() => true, () => false)))).every(Boolean);
    if (allPresent && JSON.stringify(stamp) === JSON.stringify(wanted)) {
      console.log(`Sidecar'lar guncel (${triple}).`);
      return;
    }
  }

  const work = await mkdtemp(join(tmpdir(), 'sidecars-'));
  try {
    await fetchYtdlp(target.ytdlp, triple, exe, work);
    await fetchDeno(target.deno, triple, exe, work);
    await fetchFfmpeg(target.ffmpeg, triple, exe, work);
    await writeFile(stampPath, JSON.stringify(wanted) + '\n');
    console.log(`Tamamlandi: ${triple}`);
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`\nHata: ${error.message}`);
  process.exit(1);
});
