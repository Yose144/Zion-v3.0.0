// ── AES-256-GCM encryption-at-rest for custodial wallet material ──────
// ShopOrder.customerWallet{Seed,SecretKey} are stored encrypted with
// WALLET_SEED_KEY (env, 64-hex = 32 bytes). Legacy plaintext rows are
// still readable (they lack the `enc:v1:` prefix) and are re-encrypted
// lazily on next write.

import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

const PREFIX = 'enc:v1:';

function getKey(): Buffer | null {
  const raw = process.env.WALLET_SEED_KEY ?? '';
  if (!raw) return null;
  // Accept 64-hex or derive from arbitrary passphrase via sha256
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex');
  return createHash('sha256').update(raw, 'utf8').digest();
}

export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

/** Encrypt plaintext. Dev passthrough when no key; production fails closed. */
export function encryptSecret(plaintext: string): string {
  const key = getKey();
  if (!key) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('WALLET_SEED_KEY required in production — refusing plaintext wallet storage');
    }
    return plaintext;
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`;
}

/** Decrypt `enc:v1:` value. Plaintext input is returned as-is (legacy rows). */
export function decryptSecret(value: string | null | undefined): string | null {
  if (value == null) return null;
  if (!isEncrypted(value)) return value;
  const key = getKey();
  if (!key) throw new Error('WALLET_SEED_KEY required to decrypt wallet material');
  const [, , ivB64, tagB64, ctB64] = value.split(':');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64')), decipher.final()]).toString('utf8');
}
