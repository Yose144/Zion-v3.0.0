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
import l4hubEs from './ui-strings/l4hub.es.json';
import l4hubPt from './ui-strings/l4hub.pt.json';
import l4hubFr from './ui-strings/l4hub.fr.json';
import bohemiaEs from './ui-strings/bohemia.es.json';
import bohemiaPt from './ui-strings/bohemia.pt.json';
import bohemiaFr from './ui-strings/bohemia.fr.json';
import marketEs from './ui-strings/market.es.json';
import marketPt from './ui-strings/market.pt.json';
import marketFr from './ui-strings/market.fr.json';
import networkEs from './ui-strings/network.es.json';
import networkPt from './ui-strings/network.pt.json';
import networkFr from './ui-strings/network.fr.json';
import freeworldEs from './ui-strings/freeworld.es.json';
import freeworldPt from './ui-strings/freeworld.pt.json';
import freeworldFr from './ui-strings/freeworld.fr.json';
import daoEs from './ui-strings/dao.es.json';
import daoPt from './ui-strings/dao.pt.json';
import daoFr from './ui-strings/dao.fr.json';
import hiranEs from './ui-strings/hiran.es.json';
import hiranPt from './ui-strings/hiran.pt.json';
import hiranFr from './ui-strings/hiran.fr.json';
import deekshaEs from './ui-strings/deeksha.es.json';
import deekshaPt from './ui-strings/deeksha.pt.json';
import deekshaFr from './ui-strings/deeksha.fr.json';
import ainativeEs from './ui-strings/ainative.es.json';
import ainativePt from './ui-strings/ainative.pt.json';
import ainativeFr from './ui-strings/ainative.fr.json';
import genesisEs from './ui-strings/genesis.es.json';
import genesisPt from './ui-strings/genesis.pt.json';
import genesisFr from './ui-strings/genesis.fr.json';
import walletEs from './ui-strings/wallet.es.json';
import walletPt from './ui-strings/wallet.pt.json';
import walletFr from './ui-strings/wallet.fr.json';
import bodhilankaEs from './ui-strings/bodhilanka.es.json';
import bodhilankaPt from './ui-strings/bodhilanka.pt.json';
import bodhilankaFr from './ui-strings/bodhilanka.fr.json';
import downloadEs from './ui-strings/download.es.json';
import downloadPt from './ui-strings/download.pt.json';
import downloadFr from './ui-strings/download.fr.json';
import pooldashEs from './ui-strings/pooldash.es.json';
import pooldashPt from './ui-strings/pooldash.pt.json';
import pooldashFr from './ui-strings/pooldash.fr.json';
import poolbenchEs from './ui-strings/poolbench.es.json';
import poolbenchPt from './ui-strings/poolbench.pt.json';
import poolbenchFr from './ui-strings/poolbench.fr.json';
import poolqtcEs from './ui-strings/poolqtc.es.json';
import poolqtcPt from './ui-strings/poolqtc.pt.json';
import poolqtcFr from './ui-strings/poolqtc.fr.json';
import homeEs from './ui-strings/home.es.json';
import homePt from './ui-strings/home.pt.json';
import homeFr from './ui-strings/home.fr.json';


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
  es: merge(avatarsEs, newsfeedEs, issobellaEs, treeoflifeEs, mariaEs, kralovstviEs, nabukanoEs, archivelockEs, zionarchiveEs, whitepapersEs, tepikooraEs, contractsEs, knihovnaEs, qvEs, teamEs, l4hubEs, bohemiaEs, marketEs, networkEs, freeworldEs, daoEs, hiranEs, deekshaEs, ainativeEs, genesisEs, walletEs, bodhilankaEs, downloadEs, pooldashEs, poolbenchEs, poolqtcEs, homeEs),
  pt: merge(avatarsPt, newsfeedPt, issobellaPt, treeoflifePt, mariaPt, kralovstviPt, nabukanoPt, archivelockPt, zionarchivePt, whitepapersPt, tepikooraPt, contractsPt, knihovnaPt, qvPt, teamPt, l4hubPt, bohemiaPt, marketPt, networkPt, freeworldPt, daoPt, hiranPt, deekshaPt, ainativePt, genesisPt, walletPt, bodhilankaPt, downloadPt, pooldashPt, poolbenchPt, poolqtcPt, homePt),
  fr: merge(avatarsFr, newsfeedFr, issobellaFr, treeoflifeFr, mariaFr, kralovstviFr, nabukanoFr, archivelockFr, zionarchiveFr, whitepapersFr, tepikooraFr, contractsFr, knihovnaFr, qvFr, teamFr, l4hubFr, bohemiaFr, marketFr, networkFr, freeworldFr, daoFr, hiranFr, deekshaFr, ainativeFr, genesisFr, walletFr, bodhilankaFr, downloadFr, pooldashFr, poolbenchFr, poolqtcFr, homeFr),
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
// Pole řetězců (tagy) — každý prvek přes slovník, fallback na EN.
export function t5a(items: readonly string[], lang: Lang): string[] {
  return items.map((s) => t5(s, lang));
}

export function t5(en: string, lang: Lang): string {
  if (!en) return '';
  if (lang === 'cs' || lang === 'en') return en;
  return DICTS[lang]?.[en] ?? en;
}
