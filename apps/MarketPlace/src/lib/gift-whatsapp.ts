// ── WhatsApp share pro admin dárky ────────────────────────────────────
// wa.me deep link: admin klikne, WhatsApp Web se otevře s předvyplněnou
// zprávou a on ji pošle ze svého čísla. Žádná Business API, žádný poplatek.
// Zpráva nese odkaz na stránku /gift/<token> — seed a detaily jsou jen tam
// ( bearer token v URL ), ne v WhatsApp/Meta serverech.

import { randomBytes } from 'crypto';
import { prisma } from './db';

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://market.zionterranova.com';

export interface GiftWhatsappInput {
  orderId: string;
  customerName?: string | null;
  amountZion?: number | null;
  passCode?: string | null;
  bookUrl?: string | null;
  bonusTxHash?: string | null;
  giftUrl?: string | null;
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

/**
 * Atomicky zajistí giftClaimToken pro objednávku (bearer token pro /gift/<token>).
 * Existující token se nemění; při souběhu vyhraje updateMany s NULL podmínkou.
 */
export async function ensureGiftClaimToken(
  orderId: string,
  existing?: string | null
): Promise<string | null> {
  if (existing) return existing;
  const token = randomBytes(24).toString('base64url');
  const claim = await prisma.shopOrder
    .updateMany({
      where: { orderId, giftClaimToken: null },
      data: { giftClaimToken: token },
    })
    .catch(() => null);
  if (claim && claim.count === 1) return token;
  const again = await prisma.shopOrder.findUnique({
    where: { orderId },
    select: { giftClaimToken: true },
  });
  return again?.giftClaimToken ?? null;
}

export function giftPageUrl(token: string): string {
  return `${SITE_URL}/gift/${token}`;
}

/** Sestaví text zprávy. Vrací null, když není co posílat. */
export function buildGiftWhatsappMessage(input: GiftWhatsappInput): string | null {
  const giftUrl = input.giftUrl?.trim() || null;
  const pass = input.passCode?.trim() || null;
  const book = input.bookUrl?.trim() || null;
  const tx = input.bonusTxHash?.trim() || null;
  const amount =
    typeof input.amountZion === 'number' && input.amountZion > 0
      ? `${input.amountZion.toLocaleString('cs-CZ')} ZION`
      : null;

  if (!giftUrl && !pass && !book && !amount) return null;

  const name = input.customerName?.trim();
  const lines: string[] = [
    '🎁 *ZION Market — váš dárek od týmu ZION TerraNova*',
    '',
    name ? `Ahoj ${name}! 🌿` : 'Dobrý den! 🌿',
    '',
    'Posíláme vám dárek:',
  ];
  if (amount) lines.push(`💎 *${amount}*`);
  if (pass) lines.push(`🎟️ *ZION Archive Pass:* ${pass}`);
  if (giftUrl) {
    lines.push('');
    lines.push('🔗 *Otevřít svůj dárek:*');
    lines.push(giftUrl);
    lines.push('');
    lines.push(
      'Na stránce je vše, co potřebujete: adresa i *seed phrase* peněženky, návod na uplatnění pass, kniha a odkazy do Nirvany, Marketu a ZION Archivu. *Uložte si odkaz — je to klíč ke dárku.*'
    );
  }
  if (book) {
    lines.push('');
    lines.push(`📖 *Království srdce* — kniha (PDF + EPUB, 5 jazyků):`);
    lines.push(book);
  }
  lines.push('');
  lines.push('Kam vyrazit:');
  lines.push('🛒 Market: https://market.zionterranova.com');
  lines.push('🎮 Nirvana: https://nirvana.zionterranova.com');
  lines.push('🏛️ ZION Archiv: https://app.zionterranova.com/zion-archive');
  lines.push('💡 Lumi: https://lumi.zionterranova.com');
  lines.push('');
  lines.push(`Objednávka: ${input.orderId}`);
  if (tx) lines.push(`Bonus tx: ${tx}`);
  lines.push('');
  lines.push('S pozdravem,');
  lines.push('Tým ZION TerraNova 🌍');
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
