/**
 * Portréty hrdinů pro HUD.
 *
 * Sada je **generovaná ze stejného avatar modelu** jako webové karty
 * (`scripts/ops/gen-moba-portraits.mjs` je zkopíruje do `public/portraits`).
 * Když pro id portrét chybí (katalog má mezery), vrací `null` a UI kreslí
 * iniciálu — nikdy nespadne na 404 obrázek.
 */

import { PORTRAIT_IDS } from './portraits.generated';

const AVAILABLE = new Set<number>(PORTRAIT_IDS);

export function portraitUrl(heroId: number | null | undefined): string | null {
  if (heroId === null || heroId === undefined) return null;
  return AVAILABLE.has(heroId) ? `/portraits/${heroId}.webp` : null;
}
