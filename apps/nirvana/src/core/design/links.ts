/**
 * Jednotný vizuální jazyk pro **všechny vodicí linky** ve scénách.
 *
 * Dřív každá linka vypadala jinak: dráhy tlustý mesh `#8892b0` (op 0,2), osy
 * planet vlasová 1px linka v barvě planety (op 0,45), vodící prstenec
 * orbitálních světů fialová trubička (op 0,14), rámečky dlaždic konzole
 * per-slot barva (op 0,45/0,95) a trasa flotily kyanovalá trubice (op 0,42).
 * Čtyři idiomy, čtyři barvy, čtyři průhlednosti — čitelnost záležela na tom,
 * kam se právě koukáte.
 *
 * Tenhle modul je **jediné místo pro trvalé vodicí linky**:
 *
 *   barva .......... LINK_COLOR (ledově modrá, čte se na #040614 z jakékoli dálky)
 *   šířka .......... LINK_WIDTH ve světových jednotkách; vzdálené dráhy berou
 *                    orbitWidth(r) — stejná úhlová tloušťka od Slunce
 *   průhlednost .... LINK_OPACITY (klid) / LINK_ACTIVE_OPACITY (hover, aktivní trasa)
 *
 * `LINK_KINDS` drží odchylky pro konkrétní druh linky (dráha / osa / trasa /
 * stopa / prstenec / spoj), aby je nebylo potřeba vymýšlet v rendererech.
 *
 * Mimo jazyk zůstává záměrně:
 *   · ornamenty — Śrí jantra a prstence Slunce, prstenec Issobelly, Nová Země,
 *     stanice, brána (to jsou předměty, ne linky);
 *   · interaktivní zvýraznění — hover prstenec planety nese její tint, aby
 *     odpovídal chipu `--planet-tone`;
 *   · particle pás orbitálních světů (barvy vrstev).
 */

/** Trvalá barva všech vodicích linek. */
export const LINK_COLOR = '#a6c8ff';

/** Šířka lokálního prvku (osa planety, rám dlaždice, trasa) ve světových jednotkách. */
export const LINK_WIDTH = 0.03;

/** Průměr trubice (trasa flotily, prstenec orbitálních světů) = LINK_WIDTH. */
export const LINK_RADIUS = LINK_WIDTH / 2;

/** Klidová průhlednost. */
export const LINK_OPACITY = 0.45;

/** Průhlednost aktivního stavu (hover, právě probíhající trasa). */
export const LINK_ACTIVE_OPACITY = 0.9;

/** Druhy linek — odchylky od základního tokenu. */
export type LinkVariant = 'orbit' | 'axis' | 'route' | 'trail' | 'ring' | 'connector';

export const LINK_KINDS: Record<
  LinkVariant,
  { width: number; opacity: number; activeOpacity: number }
> = {
  /** Oběžná dráha — vzdálenost řeší `orbitWidth(r)`. */
  orbit: { width: LINK_WIDTH, opacity: LINK_OPACITY, activeOpacity: LINK_ACTIVE_OPACITY },
  /** Rotační osa planety — stejná šířka jako dráha, jen kratší. */
  axis: { width: LINK_WIDTH, opacity: LINK_OPACITY, activeOpacity: LINK_ACTIVE_OPACITY },
  /** Spoj mezi dvěma body (LinkLayer) — trubice/čára, v klidu tlumená. */
  route: { width: LINK_RADIUS, opacity: LINK_OPACITY * 0.55, activeOpacity: LINK_ACTIVE_OPACITY },
  /** Stopa za kamerou při přeletu. */
  trail: { width: LINK_RADIUS, opacity: LINK_OPACITY * 0.8, activeOpacity: LINK_ACTIVE_OPACITY },
  /** Vodicí prstenec (orbitální světy, L6 ring) — tenká trubice. */
  ring: { width: LINK_RADIUS, opacity: LINK_OPACITY * 0.35, activeOpacity: LINK_ACTIVE_OPACITY },
  /** Rámeček / spoj mezi UI body (konzole) — nejtenčí. */
  connector: { width: LINK_WIDTH * 0.6, opacity: LINK_OPACITY, activeOpacity: LINK_ACTIVE_OPACITY },
};

/**
 * Šířka systémové dráhy o poloměru `r`. Vzdálenější dráha je úměrně širší,
 * takže z pohledu na soustavu mají všechny stejnou úhlovou tloušťku
 * (při r = 30 = LINK_WIDTH, tedy přesně to, co scéna používala dřív).
 */
export function orbitWidth(r: number): number {
  return LINK_WIDTH * Math.max(0.35, r / 30);
}
