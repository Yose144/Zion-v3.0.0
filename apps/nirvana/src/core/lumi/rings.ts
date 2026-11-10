/**
 * PRSTENCE SVĚTLA — volitelná obratnost v obloze.
 *
 * Hra do 2026-11-10 uměla jednu věc: doleť k nejbližšímu světlu a pak ke
 * svatyni. Bylo to krásné, ale chyběla **cesta**: hráč letěl pořád stejně
 * rovně a proudy vzduchu i lucerna byly jen palivo. Prstence dávají obloze
 * tvar — jsou to oblouky, kterými se dá proletět, a kdo letí středem, letí
 * „čistě“.
 *
 * Co to je a co to není:
 *  1. **Není to ani brána, ani past.** Nic neblokují, nic netrestají; kdo je
 *     ignoruje, doletí stejně. Jsou tu pro radost z letu, ne pro postup.
 *  2. **Řetěz (combo) je odměna za plynulost**, ne za přesnost: proletět
 *     tři prstence během pár sekund dá víc než proletět jeden středem.
 *  3. **Finální prstence se objeví, až když máš všech sedm světel** — cesta
 *     ke svatyni tak dostane finále, které dřív chybělo.
 *
 * Logika je čistá (žádné three.js, žádný React), takže se dá otestovat
 * v Node (`test/lumi-rings.mjs`) a scéna z ní jen čte. Kdyby si scéna
 * počítala průlety sama, hráč by viděl jiný řetěz, než jaký počítá pravidlo.
 */

export interface LumiRing {
  /** Pořadové id v rámci cesty — `passed` drží id, ne index. */
  id: number;
  x: number;
  y: number;
  /** Hloubka kulisy (menší = dál). Prstenec není kolizní, jen vizuální. */
  z: number;
  /** Poloměr otvoru, do kterého se letí. */
  r: number;
  /** Prstenec finále — aktivní, až když má hráč všechna světla. */
  afterAll?: boolean;
}

// ── čísla ────────────────────────────────────────────────────────────

/** Body za proletění prstence (mimo řetěz). */
export const RING_BONUS = 40;
/** Body za proletění **středem** — odměna za čistý let. */
export const RING_PERFECT_BONUS = 80;
/** Energie, kterou prstenec vrátí lucerně. */
export const RING_ENERGY = 14;
/** Středem proletěný prstenec vrátí energii víc — riziko se vyplatí. */
export const RING_PERFECT_ENERGY = 22;
/** Jak blízko středu musíš proletět, aby to bylo „perfektní“ (0–1 z poloměru). */
export const PERFECT_RATIO = 0.45;
/** Okno řetězu v sekundách — delší pauza řetěz resetuje. */
export const COMBO_WINDOW = 6;
/** Strop řetězu; další prstence už násobek nezvyšují. */
export const COMBO_MAX = 5;
/** Bonus za proletění všech prstenců cesty (jednorázově). */
export const ALL_RINGS_BONUS = 250;

/** Násobek bodů podle délky řetězu (×1 … ×2). */
export function comboMultiplier(combo: number): number {
  const safe = Number.isFinite(combo) ? Math.max(1, Math.floor(combo)) : 1;
  return 1 + 0.25 * (Math.min(COMBO_MAX, safe) - 1);
}

export interface RingRun {
  /** Id proletěných prstenců. */
  passed: number[];
  /** Aktuální řetěz (0 = žádný). */
  combo: number;
  /** Nejdelší řetěz v této cestě — pro panel po doletu. */
  bestCombo: number;
  /** Kolikrát hráč proletěl středem. */
  perfect: number;
  /** Body z prstenců (bez bonusu za všechny). */
  score: number;
  /** Simulovaný čas posledního průletu (s) — podle něj se měří okno řetězu. */
  lastPassAt: number;
  /** Naposledy proletěný prstenec (id). Vyzvedne ho až ten, kdo ho zobrazí. */
  lastRing: number | null;
  /** Proletěl hráč všechny prstence cesty? (bonus se připočítá jednou) */
  allDone: boolean;
}

export interface RingPass {
  id: number;
  perfect: boolean;
  combo: number;
  points: number;
  energy: number;
}

export function createRingRun(): RingRun {
  return {
    passed: [],
    combo: 0,
    bestCombo: 0,
    perfect: 0,
    score: 0,
    lastPassAt: -Infinity,
    lastRing: null,
    allDone: false,
  };
}

/** Je prstenec aktivní? Finální prstence čekají na všechna světla. */
export function ringActive(ring: LumiRing, collected: number, total: number): boolean {
  if (!ring.afterAll) return true;
  return collected >= total;
}

/** Prstence, které teď jde proletět. */
export function activeRings(rings: LumiRing[], collected: number, total: number): LumiRing[] {
  return rings.filter((ring) => ringActive(ring, collected, total));
}

/**
 * Aktuální řetěz pro HUD. Po `COMBO_WINDOW` sekundách bez průletu je nula —
 * jinak by číslo viselo na obrazovce, i když hráč dávno letí jinam.
 */
export function comboAt(run: RingRun, now: number): number {
  if (run.combo <= 0) return 0;
  if (!Number.isFinite(now)) return 0;
  return now - run.lastPassAt <= COMBO_WINDOW ? Math.min(COMBO_MAX, run.combo) : 0;
}

/**
 * Vzdálenost bodu od úsečky `a → b`.
 *
 * Detekce nesmí být „stojím uvnitř kruhu“: při 20 fps se hráč mezi snímky
 * posune o 1,2 jednotky, ale při teleportu (debug) i o desítky. Úsečka
 * zachytí i rychlý průlet, aniž by hra musela vzorkovat častěji.
 */
function segmentDistance(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  px: number,
  py: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq <= 1e-9) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/**
 * Jeden krok kontroly průletu. Volá se po každém kroku letu.
 *
 * `from` je poloha před krokem, `to` po něm. Vrací poslední průlet (nebo
 * `null`), takže volající má co přehrát a zobrazit; stav se ale aktualizuje
 * i pro všechny ostatní prstence proletěné ve stejném kroku.
 */
export function advanceRings(
  run: RingRun,
  from: { x: number; y: number },
  to: { x: number; y: number },
  now: number,
  rings: LumiRing[],
  collected: number,
  total: number,
): RingPass | null {
  if (!Number.isFinite(now)) return null;
  let last: RingPass | null = null;

  for (const ring of rings) {
    if (run.passed.includes(ring.id)) continue;
    if (!ringActive(ring, collected, total)) continue;

    const distance = segmentDistance(from.x, from.y, to.x, to.y, ring.x, ring.y);
    if (distance > ring.r) continue;

    const perfect = distance <= ring.r * PERFECT_RATIO;
    run.passed.push(ring.id);
    // Řetěz: pokračuje, jen když předchozí průlet nebyl dávno.
    const chained = run.combo > 0 && now - run.lastPassAt <= COMBO_WINDOW;
    run.combo = chained ? Math.min(COMBO_MAX, run.combo + 1) : 1;
    run.lastPassAt = now;
    run.bestCombo = Math.max(run.bestCombo, run.combo);
    if (perfect) run.perfect += 1;

    const points = Math.round((perfect ? RING_PERFECT_BONUS : RING_BONUS) * comboMultiplier(run.combo));
    // Bonus „všechny prstence“ se počítá zvlášť, aby ho panel uměl ukázat.
    run.score += points;
    run.lastRing = ring.id;

    last = {
      id: ring.id,
      perfect,
      combo: run.combo,
      points,
      energy: perfect ? RING_PERFECT_ENERGY : RING_ENERGY,
    };
  }

  // Všechny prstence cesty proletěné → jednorázový bonus za čistý let.
  if (!run.allDone && rings.length > 0 && run.passed.length >= rings.length) {
    run.allDone = true;
    run.score += ALL_RINGS_BONUS;
  }

  return last;
}

/**
 * Kolik prstenců hráč proletěl — a kolik jich je v cestě.
 *
 * HUD ukazuje `passed / total` (i s finálními prstenci, protože k cestě
 * patří), `active` říká, kolik jich je právě teď otevřených.
 */
export function ringProgress(
  run: RingRun,
  rings: LumiRing[],
  collected: number,
  total: number,
): { passed: number; total: number; active: number } {
  const open = activeRings(rings, collected, total);
  return { passed: run.passed.length, total: rings.length, active: open.length };
}
