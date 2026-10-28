import { useMutation, useQuery } from '@tanstack/react-query';
import { queryClient } from '../../app/queryClient';
import { appApi } from '../../lib/appApi';
import type { AppSettings } from '../../types';

const settingsKey = ['settings'] as const;

const settingsQuery = { queryKey: settingsKey, queryFn: () => appApi.getSettings() };

/** React disindan (kuyruk store'u) ayarlari okumak icin; onbellekten gelir. */
export const fetchSettings = (): Promise<AppSettings> => queryClient.fetchQuery(settingsQuery);

export const useSettings = () => useQuery(settingsQuery);

export function useSaveSettings() {
  return useMutation({
    mutationFn: async (patch: Partial<AppSettings>) => {
      const res = await appApi.saveSettings(patch);
      if (!res.success) throw new Error(res.error);
    },
    // Iyimser guncelleme: form aninda tepki versin, hata olursa sunucudan yeniden okunur.
    onMutate: (patch) => {
      queryClient.setQueryData<AppSettings>(settingsKey, (prev) => ({ ...prev, ...patch }));
    },
    onError: () => queryClient.invalidateQueries({ queryKey: settingsKey }),
  });
}

export const invalidateSettings = () => queryClient.invalidateQueries({ queryKey: settingsKey });
