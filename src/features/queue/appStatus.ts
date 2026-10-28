// Durum cubugu: metin dil degisince yeniden uretilsin diye fonksiyon olarak tutulur.

import { create } from 'zustand';
import type { Messages } from '../../i18n';

export type StatusText = (m: Messages) => string;

interface AppStatus {
  status: StatusText;
  depsReady: boolean;
}

export const useAppStatus = create<AppStatus>()(() => ({
  status: (m) => m.status.checking,
  depsReady: false,
}));

export const setStatus = (status: StatusText) => useAppStatus.setState({ status });
