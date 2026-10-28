import { useMutation, useQuery } from '@tanstack/react-query';
import { queryClient } from '../../app/queryClient';
import type { HistoryItem } from '../../types';
import { getHistoryRepo } from './db';

const historyKey = ['history'] as const;

export const useHistory = () =>
  useQuery({ queryKey: historyKey, queryFn: async () => (await getHistoryRepo()).findAll() });

const invalidate = () => queryClient.invalidateQueries({ queryKey: historyKey });

/** Kuyruk store'u tamamlanan indirmeyi buradan kaydeder. */
export async function addHistory(item: HistoryItem): Promise<void> {
  await (await getHistoryRepo()).create(item);
  await invalidate();
}

export const useDeleteHistoryItem = () =>
  useMutation({ mutationFn: async (id: string) => (await getHistoryRepo()).delete(id), onSettled: invalidate });

export const useClearHistory = () =>
  useMutation({ mutationFn: async () => (await getHistoryRepo()).clear(), onSettled: invalidate });
