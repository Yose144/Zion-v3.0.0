/**
 * Souhlas s digitálním obsahem — okamžité plnění (§ 1837 písm. l OZ).
 *
 * Digitální produkty (kniha, ZION Pass, digitální část lampionu) se dodávají
 * okamžitě po zaplacení. Podle § 1837 písm. l zákona č. 89/2012 Sb. (OZ)
 * spotřebitel ztrácí právo na odstoupení, jen když k tomu dal **výslovný souhlas**
 * a byl poučen o jeho důsledcích. Proto se u pokladny vyžaduje zaškrtnutí
 * souhlasu a souhlas se ukládá k objednávce (čas serveru + verze textu).
 *
 * Pravidla pro práci s tímto souborem:
 *  1. **Text se needituje „potichu".** Jakákoli změna znění souhlasu musí
 *     bumpnout `DIGITAL_CONSENT_VERSION`; jinak by v objednávkách zůstal
 *     záznam souhlasu s jiným textem, než jaký zákazník viděl.
 *  2. **Jeden zdroj pravdy.** Stejný text používá pokladna (`/cart`) i server
 *     (`/api/shop/orders`). Klient jen šedí tlačítko — rozhoduje server.
 *  3. **Bez souhlasu žádné plnění.** Bez zaškrtnutí se digitální obsah
 *     nesmí vydat, ani kdyby ho zákazník zaplatil.
 *
 * Právní poznámka: § 9.3 obchodních podmínek (`/terms`) je delší verze téhož
 * poučení; tento soubor nese zkrácenou verzi přímo do pokladny.
 */

export interface LocalizedText {
  cs: string;
  en: string;
}

/**
 * Verze souhlasu. Zvyš při každé změně textu, který zákazník odsouhlasí.
 * Ukládá se k objednávce (`ShopOrder.digitalConsentVersion`).
 */
export const DIGITAL_CONSENT_VERSION = 'digital-2026-11-17';

/**
 * Produkty, které dodávají digitální obsah okamžitě po zaplacení, ale samy
 * `digital: false` nemají (fyzický lampion s digitální knížkou a Pasem).
 * Kniha (`book-001`) a ZION Pass (`zion-pass-001`) se poznají podle
 * `digital: true` v DB — sem patří jen výjimky bez digitálního flagu.
 */
export const DIGITAL_IMMEDIATE_PRODUCTS: readonly string[] = ['lamp-001'];

interface ConsentItem {
  externalId?: string;
  digital?: boolean;
  category?: string;
}

/** Obsahuje objednávka digitální obsah s okamžitým dodáním? (rozhoduje klient i server) */
export function requiresDigitalConsent(items: readonly ConsentItem[]): boolean {
  return items.some(
    (item) =>
      item.digital === true ||
      item.category === 'digital' ||
      (item.externalId !== undefined && DIGITAL_IMMEDIATE_PRODUCTS.includes(item.externalId)),
  );
}

export const DIGITAL_CONSENT = {
  title: {
    cs: 'Digitální obsah — okamžité dodání',
    en: 'Digital content — immediate delivery',
  } satisfies LocalizedText,
  lead: {
    cs: 'Tato objednávka obsahuje digitální obsah (knihu, licence, klíče nebo digitální bonus), který se vydá okamžitě po zaplacení — na e-mail i v účtu.',
    en: 'This order contains digital content (a book, licences, keys or a digital bonus) that will be delivered immediately after payment — by email and in your account.',
  } satisfies LocalizedText,
  ackLabel: {
    cs: 'Souhlasím s tím, že digitální obsah bude dodán okamžitě po zaplacení a beru na vědomí, že tím zaniká mé právo na odstoupení od smlouvy do 14 dnů podle § 1837 písm. l zákona č. 89/2012 Sb. (viz § 9.3 obchodních podmínek).',
    en: 'I agree that the digital content will be delivered immediately after payment and acknowledge that this extinguishes my right to withdraw from the contract within 14 days under § 1837(l) of Act No. 89/2012 Sb. (see § 9.3 of the Terms).',
  } satisfies LocalizedText,
  requiredError: {
    cs: 'U digitálního obsahu je potřeba souhlasit s okamžitým dodáním (§ 1837 písm. l OZ).',
    en: 'Digital content requires consent to immediate delivery (§ 1837(l) of the Civil Code).',
  } satisfies LocalizedText,
} as const;

/** Co pošle pokladna; `accepted` je povinné tam, kde se digitální obsah vydává. */
export interface DigitalConsentInput {
  accepted?: boolean;
  version?: string;
}

export type DigitalConsentCheck =
  | { ok: true; version: string }
  | { ok: false; error: string; code: 'digital_consent_required' };

/**
 * Ověření souhlasu — **jediné místo**, kde se rozhoduje, jestli se digitální
 * obsah smí vydat. Volá ho API (`/api/shop/orders`); klient používá stejnou
 * funkci jen k zašednutí tlačítka, takže se nedá obejít vypnutým JavaScriptem.
 *
 * Stejně jako u podpisu ohně se verze **neodmítá** — jen se vrací ta, kterou
 * zákazník odsouhlasil; starší znění je důkaz, ne chyba. Volající ji zaloguje.
 */
export function checkDigitalConsent(
  items: readonly ConsentItem[],
  consent: DigitalConsentInput | undefined,
): DigitalConsentCheck | null {
  if (!requiresDigitalConsent(items)) return null;
  if (!consent?.accepted) {
    return { ok: false, error: 'Digital content consent required', code: 'digital_consent_required' };
  }
  const version =
    typeof consent.version === 'string' && consent.version.trim() ? consent.version.trim() : DIGITAL_CONSENT_VERSION;
  return { ok: true, version };
}
