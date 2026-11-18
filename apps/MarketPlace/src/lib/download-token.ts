// ── Podepsané odkazy na placené digitální soubory ────────────────────
// Veřejné /shop/downloads/<file> bez podpisu už nesmí soubor vydat.
// Zákazník dostane odkaz s HMAC (objednávka + soubor) v e-mailu / na
// stránce dárku. Archiv (website-v2.9) používá krátkodobý grant
// `p=archive`. Algoritmus musí zůstat shodný s
// apps/website-v2.9/src/lib/market-download-sign.ts.
//
// Payload (UTF-8):
//   order:   `v1\norder\n${file}\n${orderId}\n${exp}`
//   archive: `v1\narchive\n${file}\n\n${exp}`
// exp = unix seconds, nebo "0" = bez vypršení (odkazy z e-mailu).
// sig = base64url(HMAC-SHA256(secret, payload))

import { createHmac, timingSafeEqual } from 'crypto';
import { shopProducts } from '@/data/shopProducts';

export const BOOK_ZIP_FILE = 'Kralovstvi_srdce_kompletni_edice_5_jazyku.zip';

/** Bezpečné jméno souboru — bez cestovních zkratek (`..`, `/`). */
const SAFE_FILE_RE = /^[A-Za-z0-9._-]+$/;

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://market.zionterranova.com';

const MARKET_DOWNLOAD_HOSTS = new Set([
  'market.zionterranova.com',
  'www.market.zionterranova.com',
  'localhost',
  '127.0.0.1',
]);

function downloadSecret(): string {
  return (
    process.env.DOWNLOAD_SIGNING_SECRET ??
    process.env.SHOP_CONFIRM_SECRET ??
    process.env.ADMIN_SESSION_SECRET ??
    process.env.ADMIN_API_KEY ??
    ''
  );
}

function b64uHmac(payload: string): string {
  const secret = downloadSecret();
  if (!secret) throw new Error('DOWNLOAD_SIGNING_SECRET (or fallback shop/admin secret) is not set');
  return createHmac('sha256', secret).update(payload, 'utf8').digest('base64url');
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/** Basenames of files we host ourselves (not third-party filesUrl). */
export function allowedDownloadFiles(): Set<string> {
  const files = new Set<string>();
  for (const p of shopProducts) {
    const name = basenameFromUrl(p.filesUrl);
    if (name) files.add(name);
  }
  files.add(BOOK_ZIP_FILE);
  return files;
}

export function isAllowedDownloadFile(file: string): boolean {
  if (!SAFE_FILE_RE.test(file)) return false;
  return allowedDownloadFiles().has(file);
}

/**
 * Basename from a self-hosted `/shop/downloads/<file>` URL.
 *
 * Pozor: NESMÍ volat `isAllowedDownloadFile` — `allowedDownloadFiles()` staví
 * seznam právě přes tuhle funkci, takže vzájemné volání = nekonečná rekurze
 * (celý server se zasekl na /gift/<token> i /shop/downloads/<file>).
 */
function basenameFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (!MARKET_DOWNLOAD_HOSTS.has(u.hostname)) return null;
    const m = u.pathname.match(/^\/shop\/downloads\/([^/]+)$/);
    if (!m) return null;
    const file = decodeURIComponent(m[1]);
    return SAFE_FILE_RE.test(file) ? file : null;
  } catch {
    return null;
  }
}

export function protectedFileFromUrl(url: string | null | undefined): string | null {
  const name = basenameFromUrl(url);
  return name && isAllowedDownloadFile(name) ? name : null;
}

function orderPayload(file: string, orderId: string, exp: number): string {
  return `v1\norder\n${file}\n${orderId}\n${exp}`;
}

function archivePayload(file: string, exp: number): string {
  return `v1\narchive\n${file}\n\n${exp}`;
}

export function signOrderDownloadUrl(file: string, orderId: string, exp = 0): string {
  const sig = b64uHmac(orderPayload(file, orderId, exp));
  const url = new URL(`${SITE_URL.replace(/\/$/, '')}/shop/downloads/${encodeURIComponent(file)}`);
  url.searchParams.set('o', orderId);
  if (exp > 0) url.searchParams.set('exp', String(exp));
  url.searchParams.set('sig', sig);
  return url.toString();
}

export function signArchiveDownloadUrl(file: string, ttlSeconds = 900): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const sig = b64uHmac(archivePayload(file, exp));
  const url = new URL(`${SITE_URL.replace(/\/$/, '')}/shop/downloads/${encodeURIComponent(file)}`);
  url.searchParams.set('p', 'archive');
  url.searchParams.set('exp', String(exp));
  url.searchParams.set('sig', sig);
  return url.toString();
}

/** Rewrite a catalog filesUrl to a signed order link; leave third-party URLs alone. */
export function signedUrlForFilesUrl(filesUrl: string, orderId: string): string {
  const file = protectedFileFromUrl(filesUrl);
  if (!file) return filesUrl;
  if (!downloadSecret()) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('DOWNLOAD_SIGNING_SECRET (or fallback shop/admin secret) is not set');
    }
    console.warn('download signing secret missing; leaving unsigned filesUrl');
    return filesUrl;
  }
  return signOrderDownloadUrl(file, orderId);
}

export type DownloadAuth =
  | { ok: true; kind: 'order'; orderId: string }
  | { ok: true; kind: 'archive' }
  | { ok: false; status: 401 | 403; message: string };

export function verifyDownloadRequest(opts: {
  file: string;
  orderId: string | null;
  purpose: string | null;
  exp: string | null;
  sig: string | null;
}): DownloadAuth {
  if (!opts.sig) {
    return { ok: false, status: 401, message: 'Missing download signature' };
  }
  if (!downloadSecret()) {
    return { ok: false, status: 401, message: 'Download signing is not configured' };
  }

  const exp = opts.exp && /^\d+$/.test(opts.exp) ? Number(opts.exp) : 0;
  if (exp > 0 && exp < Math.floor(Date.now() / 1000)) {
    return { ok: false, status: 403, message: 'Download link expired' };
  }

  if (opts.purpose === 'archive') {
    if (exp <= 0) {
      return { ok: false, status: 401, message: 'Archive grants must expire' };
    }
    const expected = b64uHmac(archivePayload(opts.file, exp));
    if (!safeEqual(opts.sig, expected)) {
      return { ok: false, status: 401, message: 'Invalid download signature' };
    }
    return { ok: true, kind: 'archive' };
  }

  const orderId = opts.orderId?.trim() ?? '';
  if (!orderId || orderId.length > 80) {
    return { ok: false, status: 401, message: 'Missing order id' };
  }
  const expected = b64uHmac(orderPayload(opts.file, orderId, exp));
  if (!safeEqual(opts.sig, expected)) {
    return { ok: false, status: 401, message: 'Invalid download signature' };
  }
  return { ok: true, kind: 'order', orderId };
}
