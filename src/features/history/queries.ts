import { useMutation, useQuery } from '@tanstack/react-query';
import { queryClient } from '../../app/queryClient';
import { appApi } from '../../lib/appApi';
import type { HistoryItem } from '../../types';

const historyKey = ['history'] as const;

export const useHistory = () => useQuery({ queryKey: historyKey, queryFn: () => appApi.getHistory() });

const invalidate = () => queryClient.invalidateQueries({ queryKey: historyKey });

/** Kuyruk store'u tamamlanan indirmeyi buradan kaydeder. */
export async function addHistory(item: HistoryItem): Promise<void> {
  await appApi.addHistoryItem(item);
  await invalidate();
}

export const useDeleteHistoryItem = () =>
  useMutation({ mutationFn: (id: string) => appApi.deleteHistoryItem(id), onSettled: invalidate });

export const useClearHistory = () =>
  useMutation({ mutationFn: () => appApi.clearHistory(), onSettled: invalidate });
