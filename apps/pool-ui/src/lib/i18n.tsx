'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  isPublicLang,
  readPublicLang,
  writePublicLang,
  type PublicLang,
} from '../../../shared/i18n/persist';

export type Lang = PublicLang;

type LangCtx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  /** Czech, a translation for es/pt/fr when passed, otherwise English. */
  t: (cs: string, en: string, more?: { es?: string; pt?: string; fr?: string }) => string;
};

const Ctx = createContext<LangCtx>({
  lang: 'cs',
  setLang: () => {},
  t: (cs) => cs,
});

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('cs');

  useEffect(() => {
    const shared = readPublicLang();
    if (shared) {
      setLangState(shared);
      return;
    }
    const saved = window.localStorage.getItem('pool-lang');
    if (isPublicLang(saved)) setLangState(saved);
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    writePublicLang(l);
    try {
      window.localStorage.setItem('pool-lang', l);
    } catch {
      /* private mode */
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const t = useCallback(
    (cs: string, en: string, more?: { es?: string; pt?: string; fr?: string }) => {
      if (lang === 'cs') return cs;
      return more?.[lang] ?? en;
    },
    [lang],
  );

  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

export const useLang = () => useContext(Ctx);
