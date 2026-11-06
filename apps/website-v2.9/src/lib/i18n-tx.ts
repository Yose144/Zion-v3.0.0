import type { Lang } from '@/contexts/LanguageContext';

import avatarsEs from './ui-strings/avatars.es.json';
import avatarsPt from './ui-strings/avatars.pt.json';
import avatarsFr from './ui-strings/avatars.fr.json';
import newsfeedEs from './ui-strings/newsfeed.es.json';
import newsfeedPt from './ui-strings/newsfeed.pt.json';
import newsfeedFr from './ui-strings/newsfeed.fr.json';
import issobellaEs from './ui-strings/issobella.es.json';
import issobellaPt from './ui-strings/issobella.pt.json';
import issobellaFr from './ui-strings/issobella.fr.json';

/**
 * Překlady „page-local" textů (mimo `translations.ts`).
 *
 * Stránky mají vlastní objekty `{ cs, en }` a inline ternáry `cs ? 'A' : 'B'`.
 * Místo přepisování každého objektu na 5 jazyků se překládá **anglický řetězec**
 * (klíč = přesné EN znění). Výhoda: `Copy` objekty zůstávají nedotčené a překlad
 * jde doplňovat po stránkách; nevýhoda: stejný EN řetězec má jednu translaci
 * (pro UI labely to nevadí).
 *
 * Pořadí fallbacku: `entry[lang]` → slovník pro EN řetězec → `entry.en` → `entry.cs`.
 * Přidání další stránky = jeden JSON na jazyk (`ui-strings/<page>.<lang>.json`)
 * a jeden import tady.
 */
type Entry = unknown;
type Dict = Record<string, string>;

const merge = (...parts: Dict[]): Dict => Object.assign({}, ...parts);

const DICTS: Record<'es' | 'pt' | 'fr', Dict> = {
  es: merge(avatarsEs, newsfeedEs, issobellaEs),
  pt: merge(avatarsPt, newsfeedPt, issobellaPt),
  fr: merge(avatarsFr, newsfeedFr, issobellaFr),
};

/** Přeloží lokalizovaný objekt pro daný jazyk (5 kódů). */
export function tx5(entry: Entry, lang: Lang): string {
  if (!entry || typeof entry !== 'object') return '';
  const e = entry as Record<string, unknown>;
  const pick = (k: string) => (typeof e[k] === 'string' ? (e[k] as string) : '');
  const direct = pick(lang);
  if (direct) return direct;
  const cs = pick('cs');
  const en = pick('en') || cs;
  if (lang === 'cs') return cs || en;
  if (lang === 'en' || !en) return en;
  return DICTS[lang]?.[en] ?? en;
}

/** Přeloží holý anglický řetězec (inline ternáry typu `cs ? 'A' : 'B'`). */
export function t5(en: string, lang: Lang): string {
  if (!en) return '';
  if (lang === 'cs' || lang === 'en') return en;
  return DICTS[lang]?.[en] ?? en;
}
