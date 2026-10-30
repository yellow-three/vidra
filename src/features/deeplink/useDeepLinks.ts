import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrent, onOpenUrl } from '@tauri-apps/plugin-deep-link';
import { createLinkHandler } from './deepLink';

/** Uygulamayi baslatan link yalnizca bir kez islenir (getCurrent her cagrida ayni linki dondurur). */
let startupHandled = false;

/** Uygulama `vidra://` ile acildiysa ya da acikken link geldiyse isler (MainLayout'ta bir kez). */
export function useDeepLinks(): void {
  const navigate = useNavigate();
  // Sayfa degisince navigate degisebilir; dinleyici yeniden kurulmasin diye ref'te tutulur.
  const navigateRef = useRef(navigate);
  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);

  useEffect(() => {
    const handle = createLinkHandler(() => navigateRef.current('/'));
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    if (!startupHandled) {
      startupHandled = true;
      void getCurrent().then((urls) => {
        if (urls) void handle(urls);
      }).catch(() => {});
    }
    void onOpenUrl((urls) => void handle(urls)).then((fn) => {
      if (cancelled) fn();
      else unlisten = fn;
    }).catch(() => {});
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);
}
