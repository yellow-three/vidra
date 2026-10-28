// Arayuz dili: ayarlardaki `language`, yoksa sistem dili (Turkce disindaki her dil Ingilizce).

import { create } from 'zustand';
import en from './en';
import tr, { type Messages } from './tr';

export type Language = 'tr' | 'en';
export type { Messages };

const MESSAGES: Record<Language, Messages> = { tr, en };

export const LANGUAGES: [Language, string][] = [['tr', 'Türkçe'], ['en', 'English']];

export function detectLanguage(): Language {
  const system = typeof navigator === 'undefined' ? 'tr' : navigator.language;
  return system.toLowerCase().startsWith('tr') ? 'tr' : 'en';
}

const useLanguage = create<{ language: Language }>()(() => ({ language: detectLanguage() }));

export function setLanguage(language: Language | undefined): void {
  useLanguage.setState({ language: language && language in MESSAGES ? language : detectLanguage() });
}

/** React disi kod (store, motor) icin o anki dilin metinleri. */
export const msg = (): Messages => MESSAGES[useLanguage.getState().language];

/** Bilesenler icin; dil degisince yeniden cizer. */
export const useT = (): Messages => MESSAGES[useLanguage((s) => s.language)];

export const useLanguageCode = () => useLanguage((s) => s.language);
