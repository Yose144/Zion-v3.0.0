/**
 * Language helpers for transactional e-mails.
 *
 * The shop has no stored locale per order, so the language is resolved as:
 *   1. `order.lang` (explicit, e.g. from the checkout request)
 *   2. `SHOP_EMAIL_LANG` env (`cs` | `en`)
 *   3. Czech (shop default)
 */
export type EmailLang = 'cs' | 'en';

export const DEFAULT_EMAIL_LANG: EmailLang = 'cs';

export function normalizeEmailLang(value?: string | null): EmailLang {
  return String(value ?? '').toLowerCase().startsWith('en') ? 'en' : 'cs';
}

/** Resolve the language for an outgoing e-mail. */
export function resolveEmailLang(order?: { lang?: string | null } | null): EmailLang {
  if (order?.lang) return normalizeEmailLang(order.lang);
  if (process.env.SHOP_EMAIL_LANG) return normalizeEmailLang(process.env.SHOP_EMAIL_LANG);
  return DEFAULT_EMAIL_LANG;
}

/** Pick a CS/EN string. */
export function tl(lang: EmailLang, cs: string, en: string): string {
  return lang === 'cs' ? cs : en;
}

/** Locale used for number/date formatting. */
export function emailLocale(lang: EmailLang): string {
  return lang === 'cs' ? 'cs-CZ' : 'en-GB';
}

/**
 * Best-effort language sniff from an `Accept-Language` header.
 * Used at checkout so an English browser gets an English confirmation.
 */
export function emailLangFromAcceptLanguage(header: string | null | undefined): EmailLang {
  if (!header) return DEFAULT_EMAIL_LANG;
  const first = header.split(',')[0]?.trim().toLowerCase() ?? '';
  if (first.startsWith('en')) return 'en';
  return DEFAULT_EMAIL_LANG;
}
