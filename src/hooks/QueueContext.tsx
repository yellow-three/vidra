import { createContext, useContext, type ReactNode } from 'react';
import { useQueueState } from './useQueue';

type QueueContextValue = ReturnType<typeof useQueueState>;

const QueueContext = createContext<QueueContextValue | null>(null);

/** Kuyruk sayfa degisince kaybolmasin diye router'in ustunde tutulur. */
export function QueueProvider({ children }: { children: ReactNode }) {
  const value = useQueueState();
  return <QueueContext.Provider value={value}>{children}</QueueContext.Provider>;
}

export function useQueue(): QueueContextValue {
  const value = useContext(QueueContext);
  if (!value) throw new Error('useQueue, QueueProvider icinde kullanilmali.');
  return value;
}
