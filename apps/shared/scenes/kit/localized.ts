/**
 * Výběr jazyka pro texty ve scénách.
 *
 * Scény drží texty jako `{ cs, en }` (a volitelně `es`). Indexovat je přímo
 * `text[lang]` nejde ve chvíli, kdy `lang` umí i jazyky, které scéna nemá —
 * TypeScript to po právu odmítne. Tenhle helper je jediné místo, kde se
 * rozhoduje, a **chybějící překlad spadne na angličtinu**, nikdy na `undefined`.
 */
export type SceneLang = 'cs' | 'en' | 'es' | 'pt' | 'fr';

export interface LocalizedText {
  cs: string;
  en: string;
  es?: string;
  pt?: string;
  fr?: string;
}

export function pickLang(text: LocalizedText, lang: SceneLang): string {
  if (lang === 'cs') return text.cs ?? text.en;
  return text[lang] ?? text.en ?? text.cs;
}
