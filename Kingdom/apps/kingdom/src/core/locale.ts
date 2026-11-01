import type { Locale } from '@zion/contract';
import { resolveLocale } from '@zion/i18n';

/** Klíč cookie. Bez server-only importů — používá ho i klientský přepínač. */
export const LOCALE_COOKIE = 'zion_locale';

export function localeFromCookie(value: string | undefined): Locale {
  return resolveLocale(value);
}
