/**
 * MISTROVSTVÍ HRDINY — dlouhodobá stopa za postavu.
 *
 * MOBA měla dosud jen jeden druhý život: denní výzvu. Po pár zápasech ale
 * všechno splynulo — kdo hrál za Krišnu nebo za Šivu, to nikde nezůstalo.
 * Mistrovství je odpověď: každá postava si nese vlastní zkušenost, titul
 * a počet zápasů.
 *
 * Tři pravidla, na kterých to stojí:
 *
 *  1. **Mistrovství nikdy neposiluje hru.** Je to titul a číslo, ne +dmg.
 *     Kdyby dávalo bonusy, stal by se z výběru postavy pay-to-grind a nový
 *     hráč by proti veteránovi neměl šanci.
 *  2. **XP se počítá z odehraného zápasu, ne z kliknutí.** Vítězství,
 *     zabití, poškození a MVP — aby se dalo „hrát dobře", ne „hrát dlouho".
 *  3. **Ukládá se v prohlížeči** (`localStorage`), stejně jako žetony.
 *     Žádný účet, žádná synchronizace, žádné peníze.
 *
 * Kdo přidá postavu, nemusí nic registrova — klíč je `heroId` z katalogu.
 */

const STORAGE_KEY = 'nirvana.mastery.v1';
/** Strop, aby se z veterána nestal nesmrtelný symbol. */
const MAX_LEVEL = 9;

export interface HeroMastery {
  /** Celkové XP postavy. */
  xp: number;
  matches: number;
  wins: number;
}

export type MasteryBook = Record<string, HeroMastery>;

export const EMPTY_MASTERY: HeroMastery = { xp: 0, matches: 0, wins: 0 };

/**
 * Tituly podle úrovně — devět kroků, devět jmen.
 * Index 0 = level 1, takže `MASTERY_TITLES[level - 1]`.
 */
export const MASTERY_TITLES: { cs: string; en: string }[] = [
  { cs: 'Učeň', en: 'Apprentice' },
  { cs: 'Poutník', en: 'Wayfarer' },
  { cs: 'Znalec', en: 'Adept' },
  { cs: 'Mistr', en: 'Master' },
  { cs: 'Vědmysl', en: 'Sage' },
  { cs: 'Strážce kruhu', en: 'Ring Warden' },
  { cs: 'Světlonoš', en: 'Lightbringer' },
  { cs: 'První jméno', en: 'First Name' },
  { cs: 'Kruh sám', en: 'The Circle' },
];

/** Kolik XP potřebuje daná úroveň na další (lineární, ať je vidět pokrok). */
export function xpToNext(level: number): number {
  return 120 * Math.max(1, Math.min(MAX_LEVEL, level));
}

export interface MasteryLevel {
  level: number;
  title: { cs: string; en: string };
  /** 0..1 — jak daleko do další úrovně. */
  ratio: number;
  /** Kolik XP ještě chybí (0 na maximu). */
  remaining: number;
}

/** Úroveň z celkového XP — jediná funkce, kterou používá UI i testy. */
export function masteryLevel(xp: number): MasteryLevel {
  let level = 1;
  let rest = Math.max(0, Math.floor(xp));
  while (level < MAX_LEVEL && rest >= xpToNext(level)) {
    rest -= xpToNext(level);
    level += 1;
  }
  const need = xpToNext(level);
  const ratio = level >= MAX_LEVEL ? 1 : Math.max(0, Math.min(1, rest / need));
  return {
    level,
    title: MASTERY_TITLES[Math.min(MASTERY_TITLES.length, Math.max(1, level)) - 1]!,
    ratio,
    remaining: level >= MAX_LEVEL ? 0 : Math.max(0, need - rest),
  };
}

export interface MatchSummary {
  won: boolean;
  kills: number;
  deaths: number;
  /** Celkové poškození, které hráč udělal. */
  damage: number;
  /** Byl vyhlášen MVP zápasu? */
  mvp: boolean;
  /** Hrál proti botům (méně XP — jinak by šlo farmit sólo). */
  versusBots: boolean;
  /** Násobek za hrdinu dne (1 = bez bonusu). */
  bonus?: number;
}

/**
 * XP ze zápasu. Sólo proti botům dává polovinu: hra má být odměna za
 * sehrávku s lidmi, ne za mlácení botů donekonečna.
 */
export function matchXp(summary: MatchSummary): number {
  const base =
    20 +
    (summary.won ? 25 : 0) +
    Math.min(40, summary.kills * 8) +
    Math.min(30, Math.round(summary.damage / 250)) +
    (summary.mvp ? 20 : 0);
  const withBonus = base * (summary.bonus ?? 1);
  return Math.max(5, Math.round(summary.versusBots ? withBonus * 0.5 : withBonus));
}

function read(): MasteryBook {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    const book: MasteryBook = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!value || typeof value !== 'object') continue;
      const rec = value as Record<string, unknown>;
      book[key] = {
        xp: Math.max(0, Math.floor(Number(rec.xp) || 0)),
        matches: Math.max(0, Math.floor(Number(rec.matches) || 0)),
        wins: Math.max(0, Math.floor(Number(rec.wins) || 0)),
      };
    }
    return book;
  } catch {
    // poškozený záznam nesmí shodit hru — začne se znovu
    return {};
  }
}

function write(book: MasteryBook): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(book));
  } catch {
    // soukromý režim — mistrovství prostě nepřežije reload
  }
}

export function loadMastery(): MasteryBook {
  return read();
}

export function masteryFor(heroId: number): HeroMastery {
  return read()[String(heroId)] ?? EMPTY_MASTERY;
}

export interface MasteryGain {
  xp: number;
  before: MasteryLevel;
  after: MasteryLevel;
  leveledUp: boolean;
  total: number;
}

/** Zapiš zápas postavě. Vrací, kolik XP dala a jestli se změnil titul. */
export function recordMastery(heroId: number, summary: MatchSummary): MasteryGain {
  const book = read();
  const key = String(heroId);
  const previous = book[key] ?? EMPTY_MASTERY;
  const xp = matchXp(summary);
  const total = previous.xp + xp;
  book[key] = {
    xp: total,
    matches: previous.matches + 1,
    wins: previous.wins + (summary.won ? 1 : 0),
  };
  write(book);

  const before = masteryLevel(previous.xp);
  const after = masteryLevel(total);
  return { xp, before, after, leveledUp: after.level > before.level, total };
}

/**
 * „Hrdina dne" — deterministický z data, stejný pro všechny.
 *
 * Dává +50 % mistrovství (jen kosmetické tempo), takže se vyplatí zkusit
 * postavu, kterou by člověk jinak nevybral. Není to náhoda: stejný den =
 * stejná postava, aby se o tom dalo mluvit.
 */
export function heroOfDay(pool: number[], date = new Date()): number | null {
  if (pool.length === 0) return null;
  const key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  let hash = 2166136261;
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return pool[(hash >>> 0) % pool.length] ?? null;
}

/** Bonus za hrdinu dne — aplikuje se na XP, ne na titul. */
export const HERO_OF_DAY_BONUS = 1.5;
