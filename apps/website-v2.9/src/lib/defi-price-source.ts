export type WzionPriceSource = 'live-usdt' | 'live-pancake' | 'seed-fallback';

/** Uni V3 wins while it has liquidity. Pancake is the next live pool. Seed is last. */
export function wzionPriceSource(uniHasLiquidity: boolean, pancakeHasLiquidity: boolean): WzionPriceSource {
  if (uniHasLiquidity) return 'live-usdt';
  if (pancakeHasLiquidity) return 'live-pancake';
  return 'seed-fallback';
}
