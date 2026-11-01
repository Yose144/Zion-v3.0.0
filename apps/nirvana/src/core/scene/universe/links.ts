/**
 * Jeden vizuální jazyk pro kreslené linky ve scéně vesmíru.
 *
 * Dřív každá linka vypadala jinak: dráhy byly tlustý mesh `#8892b0` (op 0,2),
 * osy planet vlasová 1px linka v barvě planety (op 0,45), vodící prstenec
 * orbitálních světů fialová trubička (op 0,14), rámečky dlaždic konzole
 * per-slot barva (op 0,45/0,95) a trasa flotily kyanovalá trubice (op 0,42).
 * Čtyři idiomy, čtyři barvy, čtyři průhlednosti — čitelnost záležela na tom,
 * kam se právě koukáte.
 *
 * Tahle definice je **jediné místo pro trvalé vodicí linky**:
 *
 *   barva .......... LINK_COLOR (ledově modrá, čte se na #040614 z jakékoli dálky)
 *   šířka .......... LINK_WIDTH ve světových jednotkách; vzdálené dráhy berou
 *                    orbitWidth(r) — stejná úhlová tloušťťka od Slunce, aby
 *                    Neptun nezmizel dřív než Merkur
 *   průhlednost .... LINK_OPACITY (klid) / LINK_ACTIVE_OPACITY (hover, aktivní trasa)
 *
 * Mimo jazyk zůstává záměrně:
 *   · ornamenty — Śrí jantra a prstence Slunce, prstenec Issobelly, Nová Země,
 *     stanice (to jsou předměty, ne linky);
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

/**
 * Šířka systémové dráhy o poloměru `r`. Vzdálenější dráha je úměrně širší,
 * takže z pohledu na soustavu mají všechny stejnou uhlovou tloušťťku
 * (při r = 30 = LINK_WIDTH, tedy přesně to, co scéna používala dřív).
 */
export function orbitWidth(r: number): number {
  return LINK_WIDTH * Math.max(0.35, r / 30);
}
