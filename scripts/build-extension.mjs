// Tarayici eklentisini Chrome/Edge ve Firefox icin paketler: extension/dist/{chrome,firefox} ve .zip.
// Derleme araci yok: kaynaklar kopyalanir, yalnizca manifest tarayiciya gore uretilir.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const src = join(root, 'extension/src');
const dist = join(root, 'extension/dist');
const { version } = JSON.parse(readFileSync(join(root, 'extension/package.json'), 'utf8'));

const base = {
  manifest_version: 3,
  name: '__MSG_extName__',
  description: '__MSG_extDescription__',
  version,
  default_locale: 'en',
  homepage_url: 'https://github.com/yellow-three/vidra',
  icons: { 32: 'icons/32.png', 64: 'icons/64.png', 128: 'icons/128.png' },
  // Site izni ve icerik betigi yok: yalnizca sag tik menusu ve acik sekmenin linki.
  permissions: ['contextMenus', 'activeTab'],
  action: { default_popup: 'popup.html', default_icon: { 32: 'icons/32.png', 64: 'icons/64.png' } },
};

const targets = {
  chrome: { ...base, background: { service_worker: 'background.js', type: 'module' } },
  firefox: {
    ...base,
    background: { scripts: ['background.js'], type: 'module' },
    browser_specific_settings: {
      gecko: {
        id: 'vidra@yellow-three.github.io',
        strict_min_version: '115.0',
        // Eklenti hicbir veri toplamaz; link yalnizca yerel uygulamaya gider.
        data_collection_permissions: { required: ['none'] },
      },
    },
  },
};

rmSync(dist, { recursive: true, force: true });
for (const [name, manifest] of Object.entries(targets)) {
  const out = join(dist, name);
  mkdirSync(out, { recursive: true });
  cpSync(src, out, { recursive: true });
  writeFileSync(join(out, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  const zip = join(dist, `vidra-extension-${name}-${version}.zip`);
  execFileSync('zip', ['-qr', zip, '.'], { cwd: out });
  console.log(zip);
}
