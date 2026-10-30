// Sag tik menusu: link, video/ses ogesi ya da sayfa icin "Vidra ile indir".

import { api, sendToVidra } from './vidra.js';

const t = (key) => api.i18n.getMessage(key);

api.runtime.onInstalled.addListener(() => {
  const contexts = ['link', 'video', 'audio', 'page'];
  api.contextMenus.create({ id: 'vidra-video', title: t('menuVideo'), contexts });
  api.contextMenus.create({ id: 'vidra-mp3', title: t('menuMp3'), contexts });
});

api.contextMenus.onClicked.addListener((info, tab) => {
  const url = info.linkUrl || info.srcUrl || info.pageUrl || tab?.url;
  if (!url || !tab?.id) return;
  void sendToVidra(url, info.menuItemId === 'vidra-mp3' ? 'mp3' : 'video', tab.id);
});
