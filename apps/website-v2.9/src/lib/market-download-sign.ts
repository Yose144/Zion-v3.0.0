// Must stay in sync with apps/MarketPlace/src/lib/download-token.ts
// Payload: `v1\narchive\n${file}\n\n${exp}`
// sig = base64url(HMAC-SHA256(secret, payload))

import { createHmac } from 'crypto';

const MARKET_BASE =
  process.env.ARCHIVE_DOWNLOAD_BASE ?? 'https://market.zionterranova.com/shop/downloads';

function secret(): string {
  return process.env.DOWNLOAD_SIGNING_SECRET ?? '';
}

export function signArchiveMarketDownloadUrl(file: string, ttlSeconds = 900): string {
  const key = secret();
  if (!key) {
    throw new Error('DOWNLOAD_SIGNING_SECRET is required to mint archive download URLs');
  }
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `v1\narchive\n${file}\n\n${exp}`;
  const sig = createHmac('sha256', key).update(payload, 'utf8').digest('base64url');
  const base = MARKET_BASE.replace(/\/$/, '');
  const url = new URL(`${base}/${encodeURIComponent(file)}`);
  url.searchParams.set('p', 'archive');
  url.searchParams.set('exp', String(exp));
  url.searchParams.set('sig', sig);
  return url.toString();
}
