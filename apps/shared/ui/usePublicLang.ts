'use client';

import { useEffect, useState } from 'react';
import {
  readPublicLang,
  subscribePublicLang,
  writePublicLang,
  type PublicLang,
} from '../i18n/persist';

export function usePublicLang(initial: PublicLang = 'cs') {
  const [lang, setLangState] = useState<PublicLang>(initial);

  useEffect(() => {
    const saved = readPublicLang();
    if (saved) setLangState(saved);
    return subscribePublicLang(setLangState);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = (next: PublicLang) => {
    setLangState(next);
    writePublicLang(next);
  };

  return [lang, setLang] as const;
}
