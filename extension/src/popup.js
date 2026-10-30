// Arac cubugu penceresi: acik sekmenin linkini Video ya da MP3 olarak Vidra'ya gonderir.

import { api, isSendable, RELEASES_URL, sendToVidra } from './vidra.js';

const t = (key) => api.i18n.getMessage(key);

for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
document.documentElement.lang = api.i18n.getUILanguage();
document.getElementById('install').href = RELEASES_URL;

const [tab] = await api.tabs.query({ active: true, currentWindow: true });
const url = tab?.url ?? '';
const status = document.getElementById('status');
document.getElementById('url').textContent = url;

const buttons = [document.getElementById('video'), document.getElementById('mp3')];
if (!isSendable(url)) {
  for (const b of buttons) b.disabled = true;
  status.textContent = t('notSendable');
}

for (const button of buttons) {
  button.addEventListener('click', async () => {
    const sent = await sendToVidra(url, button.id, tab.id);
    status.textContent = t(sent ? 'sent' : 'notSendable');
    if (sent) setTimeout(() => window.close(), 1200);
  });
}
