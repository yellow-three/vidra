// Uygulama guncellemesi (tauri-plugin-updater): GitHub Releases'taki imzali latest.json.

import { useMutation, useQuery } from '@tanstack/react-query';
import { getVersion } from '@tauri-apps/api/app';
import { relaunch } from '@tauri-apps/plugin-process';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { useState } from 'react';
import { queryClient } from '../../app/queryClient';

const updateKey = ['app-update'] as const;
const updateQuery = {
  queryKey: updateKey,
  queryFn: async (): Promise<Update | null> => check(),
  // Acik kalan uygulama gunde birkac kez tekrar bakar.
  staleTime: 6 * 60 * 60 * 1000,
};

export const useAppVersion = () => useQuery({ queryKey: ['app-version'], queryFn: getVersion });

export const useAppUpdate = () => useQuery(updateQuery);

/** Acilista sessiz kontrol; repo/ag hatasi kullaniciyi rahatsiz etmez (Ayarlar'da gorunur). */
export function checkForAppUpdateInBackground(): void {
  queryClient.prefetchQuery(updateQuery).catch(() => {});
}

/** Indirir, kurar ve yeniden baslatir; ilerleme 0-100. */
export function useInstallUpdate() {
  const [percent, setPercent] = useState<number | null>(null);
  const mutation = useMutation({
    mutationFn: async (update: Update) => {
      let total = 0;
      let received = 0;
      setPercent(0);
      await update.downloadAndInstall((event) => {
        if (event.event === 'Started') total = event.data.contentLength ?? 0;
        else if (event.event === 'Progress') {
          received += event.data.chunkLength;
          if (total) setPercent(Math.min(100, Math.floor((received / total) * 100)));
        } else setPercent(100);
      });
      await relaunch();
    },
    onError: () => setPercent(null),
  });
  return { ...mutation, percent };
}
