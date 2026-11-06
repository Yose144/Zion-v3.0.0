'use client';

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { readPublicLang, writePublicLang } from '../../../shared/i18n/persist';

/**
 * Jazyky ekosystému. 👤 2026-11-05: „cely ecosystem by mel podporovat nativne
 * prepinani 5 jazyku, cz, en, sp, ptg, fr".
 *
 * `Lang` je jediný zdroj pravdy pro kód — všude, kde se porovnává `lang === 'cs'`,
 * spadne `es`/`pt`/`fr` do angličtiny (bezpečný fallback), dokud texty nejsou
 * přeložené. Překlady se doplňují postupně (`tr()`/`tx()` mají fallback chain).
 */
export const LANGS = [
  { code: 'cs', label: 'Čeština', short: 'CS', flag: '🇨🇿' },
  { code: 'en', label: 'English', short: 'EN', flag: '🇬🇧' },
  { code: 'es', label: 'Español', short: 'ES', flag: '🇪🇸' },
  { code: 'pt', label: 'Português', short: 'PT', flag: '🇵🇹' },
  { code: 'fr', label: 'Français', short: 'FR', flag: '🇫🇷' },
] as const;

export type Lang = (typeof LANGS)[number]['code'];

export const LANG_CODES = LANGS.map((l) => l.code) as readonly Lang[];

/** Validace hodnoty z localStorage / URL — cokoli jiného se ignoruje. */
export function isLang(value: unknown): value is Lang {
  return typeof value === 'string' && LANG_CODES.includes(value as Lang);
}

export function langMeta(code: Lang) {
  return LANGS.find((l) => l.code === code) ?? LANGS[0];
}

interface LanguageContextType {
  lang: Lang;
  setLang: (l: Lang) => void;
}

const LanguageContext = createContext<LanguageContextType>({
  lang: 'cs',
  setLang: () => {},
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Default to 'cs' for SSR and the first client render to avoid hydration mismatches.
  const [lang, setLangState] = useState<Lang>('cs');

  useEffect(() => {
    const stored = readPublicLang();
    if (isLang(stored)) setLangState(stored);
  }, []);

  const setLang = (l: Lang) => {
    if (!isLang(l)) return;
    setLangState(l);
    writePublicLang(l);
  };

  useEffect(() => {
    if (typeof document === 'undefined') return;
    // `lang` na <html> je pro čtečky i vyhledávače — musí nést skutečný kód.
    document.documentElement.lang = lang;
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  return useContext(LanguageContext);
}
