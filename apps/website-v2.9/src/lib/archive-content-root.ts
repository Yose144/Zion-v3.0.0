import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Where gated archive markdown is read from.
 *
 * ARCHIVE_CONTENT_ROOT is an explicit override. In production the copy next
 * to the standalone server wins, because that is the tree deploy refreshes.
 * In development the source tree wins, even if a stale standalone copy exists.
 */
export function archiveContentRoot(
  cwd = process.cwd(),
  env: NodeJS.ProcessEnv = process.env,
): string {
  const override = env.ARCHIVE_CONTENT_ROOT?.trim();
  if (override) return resolve(override);
  const source = resolve(cwd, 'archive-content');
  const standalone = resolve(cwd, '.next/standalone/archive-content');
  const parent = resolve(cwd, '../../archive-content');
  if (env.NODE_ENV === 'production' && existsSync(standalone)) return standalone;
  if (existsSync(source)) return source;
  if (existsSync(standalone)) return standalone;
  if (existsSync(parent)) return parent;
  return source;
}
