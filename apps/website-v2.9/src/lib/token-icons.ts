/**
 * Token icon registry — maps token symbols to local image paths.
 *
 * All ZION-family tokens (ZION, wZION, tZION) use the same ZION logo.
 * Other well-known tokens (USDT, USDC, WETH, etc.) use inline SVG initials
 * via the `TokenIcon` component — no external image dependencies.
 *
 * Images live in `/public/tokens/`.
 */

/** Map of token symbol → local image path (in /public). */
const TOKEN_ICON_PATHS: Record<string, string> = {
  // ZION family — all use the same ZION logo
  ZION: '/tokens/zion.png',
  wZION: '/tokens/zion.png',
  tZION: '/tokens/zion.png',
};

/** Fallback color (hex without #) for tokens without an image, keyed by symbol. */
const TOKEN_FALLBACK_COLORS: Record<string, string> = {
  ZION: 'ffd700',
  wZION: 'ffd700',
  tZION: 'ffd700',
  USDT: '26a17b',
  USDC: '2775ca',
  tUSDT: '26a17b',
  WETH: '627eea',
  tWETH: '627eea',
  ETH: '627eea',
  BNB: 'f3ba2f',
  WMATIC: '8247e5',
  WAVAX: 'e84142',
  ARB: '28a0f0',
  SOL: '9945ff',
  TRX: 'ff060a',
  XLM: '14b6e7',
  ADA: '0033ad',
  ATOM: '2e3148',
  APT: '06b6d4',
  SUI: '4da2ff',
  NEAR: '00ec97',
  TON: '0098ea',
  BTC: 'f7931a',
};

/**
 * Get the local image path for a token symbol, or null if no image is available.
 * The path is relative to the public root (e.g. `/tokens/zion.png`).
 */
export function getTokenIconPath(symbol: string): string | null {
  return TOKEN_ICON_PATHS[symbol] ?? null;
}

/**
 * Get a fallback background color (hex without #) for a token symbol.
 * Used by the `TokenIcon` component when no image is available.
 */
export function getTokenFallbackColor(symbol: string): string {
  return TOKEN_FALLBACK_COLORS[symbol] ?? '71717a'; // zinc-500
}

/**
 * Get the 1-2 letter initials for a token symbol (for fallback display).
 */
export function getTokenInitials(symbol: string): string {
  // Strip common prefixes
  const clean = symbol.replace(/^(w|t)/i, '');
  return clean.length <= 2 ? clean.toUpperCase() : clean.slice(0, 2).toUpperCase();
}
