'use client';

import { type ReactNode } from 'react';
import { useLang } from '@/contexts/LanguageContext';

/**
 * Language switch for static (server-rendered) info pages.
 *
 * Both variants are rendered into the RSC payload and the client picks one,
 * which lets legal pages keep a single JSX skeleton in a server component
 * (so `export const metadata` still works) while honouring the CS/EN toggle.
 */
export function T({ cs, en }: { cs: ReactNode; en: ReactNode }) {
  const { lang } = useLang();
  return <>{lang === 'cs' ? cs : en}</>;
}

export default T;
