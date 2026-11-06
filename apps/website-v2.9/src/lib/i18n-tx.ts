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
import treeoflifeEs from './ui-strings/treeoflife.es.json';
import treeoflifePt from './ui-strings/treeoflife.pt.json';
import treeoflifeFr from './ui-strings/treeoflife.fr.json';
import mariaEs from './ui-strings/maria.es.json';
import mariaPt from './ui-strings/maria.pt.json';
import mariaFr from './ui-strings/maria.fr.json';
import kralovstviEs from './ui-strings/kralovstvi.es.json';
import kralovstviPt from './ui-strings/kralovstvi.pt.json';
import kralovstviFr from './ui-strings/kralovstvi.fr.json';
import nabukanoEs from './ui-strings/nabukano.es.json';
import nabukanoPt from './ui-strings/nabukano.pt.json';
import nabukanoFr from './ui-strings/nabukano.fr.json';
import archivelockEs from './ui-strings/archivelock.es.json';
import archivelockPt from './ui-strings/archivelock.pt.json';
import archivelockFr from './ui-strings/archivelock.fr.json';
import zionarchiveEs from './ui-strings/zionarchive.es.json';
import zionarchivePt from './ui-strings/zionarchive.pt.json';
import zionarchiveFr from './ui-strings/zionarchive.fr.json';
import whitepapersEs from './ui-strings/whitepapers.es.json';
import whitepapersPt from './ui-strings/whitepapers.pt.json';
import whitepapersFr from './ui-strings/whitepapers.fr.json';
import tepikooraEs from './ui-strings/tepikoora.es.json';
import tepikooraPt from './ui-strings/tepikoora.pt.json';
import tepikooraFr from './ui-strings/tepikoora.fr.json';
import contractsEs from './ui-strings/contracts.es.json';
import contractsPt from './ui-strings/contracts.pt.json';
import contractsFr from './ui-strings/contracts.fr.json';
import knihovnaEs from './ui-strings/knihovna.es.json';
import knihovnaPt from './ui-strings/knihovna.pt.json';
import knihovnaFr from './ui-strings/knihovna.fr.json';
import qvEs from './ui-strings/qv.es.json';
import qvPt from './ui-strings/qv.pt.json';
import qvFr from './ui-strings/qv.fr.json';
import teamEs from './ui-strings/team.es.json';
import teamPt from './ui-strings/team.pt.json';
import teamFr from './ui-strings/team.fr.json';


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
  es: merge(avatarsEs, newsfeedEs, issobellaEs, treeoflifeEs, mariaEs, kralovstviEs, nabukanoEs, archivelockEs, zionarchiveEs, whitepapersEs, tepikooraEs, contractsEs, knihovnaEs, qvEs, teamEs),
  pt: merge(avatarsPt, newsfeedPt, issobellaPt, treeoflifePt, mariaPt, kralovstviPt, nabukanoPt, archivelockPt, zionarchivePt, whitepapersPt, tepikooraPt, contractsPt, knihovnaPt, qvPt, teamPt),
  fr: merge(avatarsFr, newsfeedFr, issobellaFr, treeoflifeFr, mariaFr, kralovstviFr, nabukanoFr, archivelockFr, zionarchiveFr, whitepapersFr, tepikooraFr, contractsFr, knihovnaFr, qvFr, teamFr),
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
