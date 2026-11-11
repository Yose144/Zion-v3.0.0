// ── WhatsApp share pro admin dárky ────────────────────────────────────
// wa.me deep link: admin klikne, WhatsApp Web se otevře s předvyplněnou
// zprávou a on ji pošle ze svého čísla. Žádná Business API, žádný poplatek.
// Zpráva nese i seed — uživatel to explicitně schválil (11. 11. 2026).

import { decryptSecret } from './crypto';

export interface GiftWhatsappInput {
  orderId: string;
  customerName?: string | null;
  amountZion?: number | null;
  walletAddress?: string | null;
  walletSeedEnc?: string | null;
  passCode?: string | null;
  bookUrl?: string | null;
  bonusTxHash?: string | null;
}

/** Placeholder, který route ukládá když telefon chybí — pro wa.me je to nesmysl. */
const PHONE_PLACEHOLDER = '420000000000';

/**
 * Normalizuje telefon na mezinárodní číslo bez + pro wa.me.
 * „+420 123 456 789", „00420…", „123456789" (lokální CZ) → „420123456789".
 * Vrací null pro placeholder/prázdné/neplatné.
 */
export function normalizeWhatsappPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = raw.replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (/^\d{9}$/.test(d)) d = `420${d}`;
  if (d === PHONE_PLACEHOLDER) return null;
  if (!/^\d{8,15}$/.test(d)) return null;
  return d;
}

function safeDecryptSeed(enc: string | null | undefined): string | null {
  if (!enc) return null;
  try {
    return decryptSecret(enc);
  } catch {
    return null;
  }
}

/** Sestaví text zprávy. Vrací null, když není co posílat (žádná wallet ani obsah). */
export function buildGiftWhatsappMessage(input: GiftWhatsappInput): string | null {
  const seed = safeDecryptSeed(input.walletSeedEnc);
  const wallet = input.walletAddress?.trim() || null;
  const pass = input.passCode?.trim() || null;
  const book = input.bookUrl?.trim() || null;
  const tx = input.bonusTxHash?.trim() || null;
  const amount =
    typeof input.amountZion === 'number' && input.amountZion > 0
      ? `${input.amountZion.toLocaleString('cs-CZ')} ZION`
      : null;

  if (!wallet && !pass && !book && !amount) return null;

  const name = input.customerName?.trim();
  const lines: string[] = [
    '🎁 ZION Market — váš dárek od týmu ZION TerraNova',
    '',
    name ? `Ahoj ${name}!` : 'Dobrý den!',
    '',
    'Posíláme vám dárek:',
  ];
  if (amount) lines.push(`💎 ${amount}`);
  if (wallet) lines.push(`🔐 Adresa peněženky: ${wallet}`);
  if (seed) lines.push(`🌱 Seed phrase (12 slov): ${seed}`);
  if (seed || wallet) {
    lines.push('');
    lines.push(
      '⚠️ Seed si uložte na bezpečném místu — je to jediný způsob, jak získat plný přístup k tokenům. Nikomu ho neukazujte.'
    );
  }
  if (pass) lines.push(`🎟️ ZION Archive Pass: ${pass}`);
  if (book) lines.push(`📖 Kniha Království srdce (PDF + EPUB, 5 jazyků): ${book}`);
  lines.push('');
  lines.push(`Objednávka: ${input.orderId}`);
  if (tx) lines.push(`Bonus tx: ${tx}`);
  lines.push('');
  lines.push('S pozdravem,');
  lines.push('Tým ZION TerraNova');
  return lines.join('\n');
}

/** wa.me URL s předvyplněnou zprávou. */
export function whatsappShareUrl(phone: string, text: string): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

export interface GiftWhatsappPayload {
  url: string;
  text: string;
}

/** Sestaví share payload pro dárek; null když telefon chybí nebo není co posílat. */
export function giftWhatsappPayload(
  phoneRaw: string | null | undefined,
  input: GiftWhatsappInput
): GiftWhatsappPayload | null {
  const phone = normalizeWhatsappPhone(phoneRaw);
  if (!phone) return null;
  const text = buildGiftWhatsappMessage(input);
  if (!text) return null;
  return { url: whatsappShareUrl(phone, text), text };
}
