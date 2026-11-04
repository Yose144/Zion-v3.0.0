'use client';

// Reader preferences for the Zion Archive (font size, column width, theme).
// Stored in localStorage; applied as classes on the reader content so the same
// typography rules keep working for every book.

import { useCallback, useEffect, useState } from 'react';

export const READER_SETTINGS_KEY = 'zion.archive.reader.v1';
export const READER_SETTINGS_EVENT = 'zion-archive-reader-settings';

export type ReaderFont = 'sm' | 'md' | 'lg' | 'xl';
export type ReaderWidth = 'narrow' | 'normal' | 'wide';
export type ReaderTheme = 'dark' | 'sepia' | 'light';

export interface ReaderSettings {
  font: ReaderFont;
  width: ReaderWidth;
  theme: ReaderTheme;
}

export const DEFAULT_READER_SETTINGS: ReaderSettings = {
  font: 'md',
  width: 'normal',
  theme: 'dark',
};

const FONTS: ReaderFont[] = ['sm', 'md', 'lg', 'xl'];
const WIDTHS: ReaderWidth[] = ['narrow', 'normal', 'wide'];
const THEMES: ReaderTheme[] = ['dark', 'sepia', 'light'];

function normalize(value: unknown): ReaderSettings {
  if (!value || typeof value !== 'object') return DEFAULT_READER_SETTINGS;
  const v = value as Partial<ReaderSettings>;
  return {
    font: FONTS.includes(v.font as ReaderFont) ? (v.font as ReaderFont) : DEFAULT_READER_SETTINGS.font,
    width: WIDTHS.includes(v.width as ReaderWidth)
      ? (v.width as ReaderWidth)
      : DEFAULT_READER_SETTINGS.width,
    theme: THEMES.includes(v.theme as ReaderTheme)
      ? (v.theme as ReaderTheme)
      : DEFAULT_READER_SETTINGS.theme,
  };
}

export function getReaderSettings(): ReaderSettings {
  if (typeof window === 'undefined') return DEFAULT_READER_SETTINGS;
  try {
    const raw = window.localStorage.getItem(READER_SETTINGS_KEY);
    return raw ? normalize(JSON.parse(raw)) : DEFAULT_READER_SETTINGS;
  } catch {
    return DEFAULT_READER_SETTINGS;
  }
}

export function saveReaderSettings(settings: ReaderSettings): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(READER_SETTINGS_KEY, JSON.stringify(settings));
    window.dispatchEvent(new Event(READER_SETTINGS_EVENT));
  } catch {
    /* ignore */
  }
}

export const readerWidthClass: Record<ReaderWidth, string> = {
  narrow: 'max-w-2xl',
  normal: 'max-w-3xl xl:max-w-4xl',
  wide: 'max-w-5xl',
};

export const readerFontClass: Record<ReaderFont, string> = {
  sm: 'reader-size-sm',
  md: 'reader-size-md',
  lg: 'reader-size-lg',
  xl: 'reader-size-xl',
};

export const readerThemeClass: Record<ReaderTheme, string> = {
  dark: '',
  sepia: 'reader-theme-sepia',
  light: 'reader-theme-light',
};

export function useReaderSettings(): [ReaderSettings, (patch: Partial<ReaderSettings>) => void] {
  const [settings, setSettings] = useState<ReaderSettings>(DEFAULT_READER_SETTINGS);

  useEffect(() => {
    const sync = () => setSettings(getReaderSettings());
    sync();
    window.addEventListener('storage', sync);
    window.addEventListener(READER_SETTINGS_EVENT, sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(READER_SETTINGS_EVENT, sync);
    };
  }, []);

  const update = useCallback((patch: Partial<ReaderSettings>) => {
    const next = normalize({ ...getReaderSettings(), ...patch });
    saveReaderSettings(next);
    setSettings(next);
  }, []);

  return [settings, update];
}
