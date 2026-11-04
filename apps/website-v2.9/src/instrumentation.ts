/**
 * Next.js server instrumentation — runs once when the standalone server boots.
 * Used to warm explorer caches so the first visitor after a deploy does not
 * pay for cold chain reads. See lib/explorer-warmup.ts.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  try {
    const { startExplorerWarmup } = await import('./lib/explorer-warmup');
    startExplorerWarmup();
  } catch {
    /* warm-up must never break boot */
  }
}
