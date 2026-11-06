/**
 * Kooperativní odměna v Lumi (L-11) — rozdělení podílem, ne plošně.
 *
 * Ve hře nejsou hashe ani shares, ale je tu něco velmi podobného: **kdo
 * kolik světel přinesl**. Odměna proto funguje jako PPLNS — jeden společný
 * pool se rozdělí podle skutečného přínosu, ne rovným dílem všem.
 *
 * Dvě věci, které to drží rozumné:
 *  1. **Podlaha** (`COOP_FLOOR`): kdo doletěl, dostane aspoň malý díl. Čisté
 *     PPLNS by „nosiči" dalo nulu, což je u hry o darování špatný vzkaz.
 *  2. **Sólo = nula**: bez druhého hráče není co rozdělovat; odměna je za
 *     společný let, ne za hraní.
 *
 * Výpočet je čistá funkce — testuje se v Node (`test/lumi-coop.mjs`) a scéna
 * ani server nemají vlastní verzi (jinak by se čísla rozešla).
 */

/** Kolik bodů se v koopu rozděluje mezi letce (jedno světlo navíc). */
export const COOP_POOL = 300;

/**
 * Podíl, který dostane každý, kdo doletěl, bez ohledu na přínos (0,1 = 10 %).
 * Zbytek poolu se dělí podle nasbíraných světel.
 */
export const COOP_FLOOR = 0.1;

export interface CoopSplitInput {
  /** Kolik světel jsem sebral já. */
  mine: number;
  /** Kolik jich sebrali ostatní (jedno číslo na letce). */
  others: number[];
}

export interface CoopSplit {
  /** Body, které dostanu navíc. */
  bonus: number;
  /** Můj podíl na nasbíraných světlech (0–1) — pro text na panelu. */
  share: number;
  /** Kolik letců se do rozdělení počítá (včetně mě). */
  players: number;
}

/** Rozdělení koop poolu. Vrací nulu, když letím sám. */
export function coopSplit({ mine, others }: CoopSplitInput): CoopSplit {
  const players = 1 + others.length;
  if (players < 2) return { bonus: 0, share: 1, players: 1 };

  const safeMine = Number.isFinite(mine) ? Math.max(0, mine) : 0;
  const safeOthers = others.map((value) => (Number.isFinite(value) ? Math.max(0, value) : 0));
  const total = safeMine + safeOthers.reduce((sum, value) => sum + value, 0);

  /**
   * Rovný díl, když se podíl nedá spočítat: buď nikdo nic nese, nebo naopak
   * **nikdo jiný** zatím nese jen nulu (doletěl jsem dřív, než ostatní
   * sbírali). Bez toho by první doletěvší dostal skoro celý pool — a součet
   * odměn by přelezl jeho velikost.
   */
  const othersContributed = safeOthers.some((value) => value > 0);
  const share = total > 0 && othersContributed ? safeMine / total : 1 / players;

  // Podlaha pro každého + zbytek podílem. Součet se drží na `COOP_POOL`.
  const floorTotal = Math.min(0.9, COOP_FLOOR * players);
  const bonus = Math.round(COOP_POOL * (COOP_FLOOR + (1 - floorTotal) * share));

  return {
    bonus: Math.max(0, Math.min(COOP_POOL, bonus)),
    share,
    players,
  };
}
