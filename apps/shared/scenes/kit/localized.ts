/**
 * Výběr jazyka pro texty ve scénách.
 *
 * Scény drží texty jako `{ cs, en }` (a volitelně `es`). Indexovat je přímo
 * `text[lang]` nejde ve chvíli, kdy `lang` umí i jazyky, které scéna nemá —
 * TypeScript to po právu odmítne. Tenhle helper je jediné místo, kde se
 * rozhoduje, a **chybějící překlad spadne na angličtinu**, nikdy na `undefined`.
 */
export type SceneLang = 'cs' | 'en' | 'es';

export interface LocalizedText {
  cs: string;
  en: string;
  es?: string;
}

export function pickLang(text: LocalizedText, lang: SceneLang): string {
  if (lang === 'cs') return text.cs ?? text.en;
  if (lang === 'es') return text.es ?? text.en ?? text.cs;
  return text.en ?? text.cs;
}
