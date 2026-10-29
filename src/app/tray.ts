// Sistem tepsisi: indirme surerken pencere kapatilinca uygulama tepside calismaya devam eder.

import { defaultWindowIcon, exit } from '@tauri-apps/api/app';
import { Menu } from '@tauri-apps/api/menu';
import { TrayIcon } from '@tauri-apps/api/tray';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { sendNotification } from '@tauri-apps/plugin-notification';
import { msg } from '../i18n';

let tray: Promise<TrayIcon> | null = null;

export async function showWindow(): Promise<void> {
  const window = getCurrentWindow();
  await window.unminimize();
  await window.show();
  await window.setFocus();
}

function createTray(): Promise<TrayIcon> {
  const m = msg().tray;
  return (async () => {
    const menu = await Menu.new({
      items: [
        { id: 'show', text: m.show, action: () => void showWindow() },
        // Cikista suren indirmeler durur (process.rs kill_all); kuyruk bir sonraki acilista surer.
        { id: 'quit', text: m.quit, action: () => void exit(0) },
      ],
    });
    return TrayIcon.new({
      icon: (await defaultWindowIcon()) ?? undefined,
      tooltip: 'Vidra',
      menu,
      showMenuOnLeftClick: false,
      action: (event) => {
        if (event.type === 'Click' && event.button === 'Left' && event.buttonState === 'Up') void showWindow();
      },
    });
  })();
}

/**
 * Pencereyi gizleyip tepsiye alir. Tepsi simgesi olusturulamazsa (masaustu desteklemiyor)
 * pencere kucultulur; boylece uygulama hicbir zaman ulasilamaz hale gelmez.
 */
export async function hideToTray(): Promise<void> {
  const window = getCurrentWindow();
  try {
    if (!(await invoke<boolean>('tray_available'))) throw new Error('AppIndicator kütüphanesi yok');
    tray ??= createTray();
    await tray;
  } catch (error) {
    tray = null;
    console.warn('Tepsi simgesi oluşturulamadı:', error);
    await window.minimize();
    return;
  }
  await window.hide();
  const m = msg().tray;
  sendNotification({ title: m.backgroundTitle, body: m.backgroundBody });
}
