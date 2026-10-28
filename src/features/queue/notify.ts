import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';

let permission: Promise<boolean> | null = null;

/** Indirme bitince sistem bildirimi; pencere odaktaysa kullanici zaten goruyor. */
export function notifyComplete(title: string): void {
  if (document.hasFocus()) return;
  permission ??= isPermissionGranted().then((granted) => granted || requestPermission().then((p) => p === 'granted'));
  void permission
    .then((granted) => granted && sendNotification({ title: 'İndirme tamamlandı', body: title }))
    .catch((error) => console.warn('Bildirim gönderilemedi:', error));
}
