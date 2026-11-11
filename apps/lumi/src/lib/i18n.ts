export type Lang = 'cs' | 'en' | 'de';

export const LANGS: Lang[] = ['cs', 'en', 'de'];

export const LANG_LABEL: Record<Lang, string> = {
  cs: 'Čeština',
  en: 'English',
  de: 'Deutsch',
};

export const LANG_SHORT: Record<Lang, string> = {
  cs: 'CZ',
  en: 'EN',
  de: 'DE',
};

export type Localized = Record<Lang, string>;

export function isLang(value: unknown): value is Lang {
  return value === 'cs' || value === 'en' || value === 'de';
}

/** Vybraný jazyk → text; fallback na češtinu, když překlad chybí. */
export function pick(text: Localized | undefined | null, lang: Lang): string {
  if (!text) return '';
  return text[lang] || text.cs || text.en || '';
}

export function pickList(text: { cs: string[]; en: string[]; de: string[] } | undefined, lang: Lang): string[] {
  if (!text) return [];
  return text[lang] || text.cs || text.en || [];
}

export function formatPrice(czk: number, lang: Lang): string {
  const locale = lang === 'cs' ? 'cs-CZ' : lang === 'de' ? 'de-DE' : 'en-GB';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'CZK',
    maximumFractionDigits: 0,
  }).format(czk);
}

export function formatDate(iso: Date | string, lang: Lang): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  const locale = lang === 'cs' ? 'cs-CZ' : lang === 'de' ? 'de-DE' : 'en-GB';
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}
