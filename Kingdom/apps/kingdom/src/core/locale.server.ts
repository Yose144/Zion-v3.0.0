import { cookies } from 'next/headers';
import type { Locale } from '@zion/contract';
import { LOCALE_COOKIE, localeFromCookie } from './locale';

/**
 * Jazyk se čte z cookie na serveru. Volá se jen v server komponentách,
 * takže do prohlížeče nejde žádný slovník.
 */
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  return localeFromCookie(store.get(LOCALE_COOKIE)?.value);
}
