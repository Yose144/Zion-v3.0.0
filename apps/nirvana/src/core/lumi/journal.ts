/**
 * DENÍK LUMI — co už jsi v obloze našel.
 *
 * Hra měla příběh, který se ztrácel: text se ukázal na osm sekund a pak
 * zmizel. Deník z něj dělá **trvalou stopu** — sebraná světla zůstávají
 * v prohlížeči a dají se kdykoli přečíst, nesebraná jsou jen obrysy.
 *
 * Je to stejná smlouva jako u žetonů a mistrovství: jen `localStorage`,
 * žádný účet, žádná synchronizace, žádné peníze. Kdo si prohlížeč vymaže,
 * začne znovu — a dostane stejnou cestu.
 */

const STORAGE_KEY = 'nirvana.lumi.v1';

export interface LumiJournal {
  /** Id sebraných světel (1..7). */
  found: number[];
  /** Kolik cest jsi doletěl. */
  runs: number;
  /** Kolikrát jsi světlo nechal / daroval. */
  gifts: { keep: number; give: number };
  /**
   * Které cesty jsi doletěl. Třetí cesta (`light`) je odemčená, až když
   * jsou v tomhle seznamu obě předchozí — jinak by šlo začít tím nejtěžším.
   */
  paths: string[];
}

export const EMPTY_JOURNAL: LumiJournal = { found: [], runs: 0, gifts: { keep: 0, give: 0 }, paths: [] };

function read(): LumiJournal {
  if (typeof window === 'undefined') return { ...EMPTY_JOURNAL, found: [], gifts: { keep: 0, give: 0 } };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY_JOURNAL, found: [], gifts: { keep: 0, give: 0 } };
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return { ...EMPTY_JOURNAL, found: [], gifts: { keep: 0, give: 0 } };
    const rec = parsed as Record<string, unknown>;
    const found = Array.isArray(rec.found)
      ? [...new Set(rec.found.filter((value): value is number => typeof value === 'number' && value >= 1 && value <= 7))]
      : [];
    const gifts = (rec.gifts ?? {}) as Record<string, unknown>;
    const paths = Array.isArray(rec.paths)
      ? [...new Set(rec.paths.filter((value): value is string => typeof value === 'string' && value.length > 0 && value.length < 16))]
      : [];
    return {
      found: found.sort((a, b) => a - b),
      runs: Math.max(0, Math.floor(Number(rec.runs) || 0)),
      gifts: {
        keep: Math.max(0, Math.floor(Number(gifts.keep) || 0)),
        give: Math.max(0, Math.floor(Number(gifts.give) || 0)),
      },
      paths,
    };
  } catch {
    // poškozený záznam nesmí shodit hru
    return { ...EMPTY_JOURNAL, found: [], gifts: { keep: 0, give: 0 } };
  }
}

function write(journal: LumiJournal): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(journal));
  } catch {
    // soukromý režim — deník prostě nepřežije reload
  }
}

export function loadJournal(): LumiJournal {
  return read();
}

/** Zapiš dolet: nová světla, počet cest a volbu se světlem. */
export function recordJourney(lights: number[], gift: 'keep' | 'give', path = 'calm'): LumiJournal {
  const current = read();
  const merged = [...new Set([...current.found, ...lights.filter((id) => id >= 1 && id <= 7)])].sort((a, b) => a - b);
  const next: LumiJournal = {
    found: merged,
    runs: current.runs + 1,
    gifts: { ...current.gifts, [gift]: current.gifts[gift] + 1 },
    paths: [...new Set([...current.paths, path])],
  };
  write(next);
  return next;
}

/**
 * Je cesta odemčená? `calm` a `wind` ano vždy, `light` až po dohrání obou.
 * Pravidlo je tady, ne ve stránce — test ho tak vidí a UI ho nemůže obejít.
 */
export function isPathUnlocked(pathId: string, journal: LumiJournal): boolean {
  if (pathId !== 'light') return true;
  return journal.paths.includes('calm') && journal.paths.includes('wind');
}

/** Kolik světel ještě chybí do plného deníku. */
export function missingInJournal(journal: LumiJournal, total = 7): number {
  return Math.max(0, total - journal.found.length);
}
