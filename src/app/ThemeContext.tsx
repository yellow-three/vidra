import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useSaveSettings, useSettings } from '../features/settings/queries';

export const APP_THEMES = { dark: 'vidra-dark', light: 'vidra-light' } as const;

/** Yerlesik daisyUI temalari (src/index.css: `themes: all`). */
export const DAISY_THEMES = [
  'light', 'dark', 'cupcake', 'bumblebee', 'emerald', 'corporate', 'synthwave', 'retro', 'cyberpunk',
  'valentine', 'halloween', 'garden', 'forest', 'aqua', 'lofi', 'pastel', 'fantasy', 'wireframe', 'black',
  'luxury', 'dracula', 'cmyk', 'autumn', 'business', 'acid', 'lemonade', 'night', 'coffee', 'winter', 'dim',
  'nord', 'sunset', 'caramellatte', 'abyss', 'silk',
] as const;

/** `system`, Vidra temalarindan biri ya da bir daisyUI tema adi. */
export type ThemeSetting = string;

interface ThemeContextValue {
  theme: ThemeSetting;
  /** `data-theme`'e yazilan gercek tema. */
  resolved: string;
  setTheme: (theme: ThemeSetting) => void;
}

// Eski "YouTube Downloader" surumlerinden tasinan ayarlardaki tema adlari.
const LEGACY_THEMES: Record<string, string> = { 'youtube-dark': APP_THEMES.dark, 'youtube-light': APP_THEMES.light };

const ThemeContext = createContext<ThemeContextValue>({ theme: 'system', resolved: APP_THEMES.dark, setTheme: () => {} });

const prefersLight = () => window.matchMedia('(prefers-color-scheme: light)').matches;

export function ThemeProvider({ children }: { children: ReactNode }) {
  const stored: ThemeSetting = useSettings().data?.theme || 'system';
  const theme = LEGACY_THEMES[stored] ?? stored;
  const save = useSaveSettings();
  const [systemLight, setSystemLight] = useState(prefersLight);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = () => setSystemLight(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const resolved = theme === 'system' ? (systemLight ? APP_THEMES.light : APP_THEMES.dark) : theme;

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolved);
  }, [resolved]);

  return (
    <ThemeContext.Provider value={{ theme, resolved, setTheme: (t) => save.mutate({ theme: t }) }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

/** Tema acik mi koyu mu; kenar cubugundaki hizli gecis dugmesi icin. */
export function isDarkTheme(name: string): boolean {
  const dark = new Set(['dark', 'synthwave', 'halloween', 'forest', 'black', 'luxury', 'dracula', 'business', 'night', 'coffee', 'dim', 'sunset', 'abyss', APP_THEMES.dark]);
  return dark.has(name);
}
