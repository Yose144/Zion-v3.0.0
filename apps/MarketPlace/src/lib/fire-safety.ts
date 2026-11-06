/**
 * Bezpečnostní prohlášení — oheň, dřevo a lampiony.
 *
 * Lampion Lumi 2 je vyřezávaný z 3mm březové překližky a svítí se v něm
 * **otevřeným plamenem**. To je kombinace, u které musí být prodávající
 * schopen doložit, že kupujícího poučil — proto se u pokladny podepisuje
 * prohlášení a podpis (jméno + čas + verze textu) se ukládá k objednávce.
 *
 * Pravidla pro práci s tímto souborem:
 *  1. **Text se needituje „potichu".** Jakákoli změna věty, která mění obsah
 *     prohlášení, musí bumpnout `FIRE_CONSENT_VERSION`; jinak by v objednávkách
 *     zůstal podpis pod jiným textem, než jaký zákazník viděl.
 *  2. **Jeden zdroj pravdy.** Stejné body používá pokladna (`/cart`), detail
 *     produktu (`/vanoce/lampion`) i e-mail s pokyny. Kdyby se rozešly,
 *     zákazník se dozví něco jiného, než co podepsal.
 *  3. **Nic neslibovat.** Text neříká „je to bezpečné", říká, jak to bezpečně
 *     používat a kdo nese odpovědnost při nedodržení.
 *
 * Právní poznámka: tohle je poučení a záznam o něm, ne náhrada obchodních
 * podmínek — ty řeší `/terms`, tento text je jejich doplněk pro zboží s ohněm.
 */

export interface LocalizedText {
  cs: string;
  en: string;
}

/**
 * Verze prohlášení. Zvyš při každé změně textu, který zákazník odsouhlasí.
 * Ukládá se k objednávce (`ShopOrder.fireConsentVersion`).
 */
export const FIRE_CONSENT_VERSION = 'fire-2026-11-06';

/**
 * Produkty, u kterých hoří dřevo a svíčka. U nich pokladna vyžaduje
 * odsouhlasení a digitální podpis. Nový svíčkový produkt = přidat sem.
 */
export const FIRE_RISK_PRODUCTS: readonly string[] = ['lamp-001'];

/** Má objednávka obsahovat svíčkové zboží? (rozhoduje klient i server) */
export function requiresFireConsent(items: readonly { externalId: string }[]): boolean {
  return items.some((item) => FIRE_RISK_PRODUCTS.includes(item.externalId));
}

/** Krátké nadpisy pro UI. */
export const FIRE_SAFETY = {
  title: {
    cs: 'Bezpečnost: oheň a dřevo',
    en: 'Safety: fire and wood',
  } satisfies LocalizedText,
  lead: {
    cs: 'Lampion je z 3mm březové překližky a svítí se v něm otevřený plamen. Dřevo hoří. Přečtěte si prosím pět bodů níže — jsou krátké a jsou důvod, proč lampion vypadá tak, jak vypadá.',
    en: 'The lantern is 3 mm birch plywood and burns an open flame. Wood burns. Please read the five points below — they are short, and they are the reason the lantern is built the way it is.',
  } satisfies LocalizedText,
  points: [
    {
      cs: '**Svíčku dávejte do sklenice.** Obyčejná čajová svíčka ve sklenici od malé Nutelly (nebo jakékoli sklo od zavařeniny) zachytí vosk i případný plamen. Lampion pak stojí na skle, ne na dřevě.',
      en: '**Put the candle in a glass.** An ordinary tea light inside a small Nutella jar (or any jam jar) catches the wax and any flame. The lantern then stands on glass, not on wood.',
    },
    {
      cs: '**Podklad nehořlavý.** Lampion stavte na kámen, keramiku, plech nebo sklo. Nikdy na ubrus, papír, polystyren, koberec ani na lakovaný nábytek.',
      en: '**Non-flammable base.** Stand the lantern on stone, ceramic, metal or glass. Never on a tablecloth, paper, polystyrene, carpet or lacquered furniture.',
    },
    {
      cs: '**Nenechávejte ho bez dozoru.** Zhasněte, než odejdete z místnosti nebo jdete spát. Ať ho nikdy nezapálí dítě samo.',
      en: '**Never leave it unattended.** Blow it out before you leave the room or go to sleep. A child should never light it alone.',
    },
    {
      cs: '**Odstup od všeho, co hoří.** Minimálně 30 cm od záclon, knih, větví, košů a horních polic. Hořící svíčku nepřesouvejte — nejdřív zhasněte.',
      en: '**Distance from anything that burns.** At least 30 cm from curtains, books, branches, baskets and shelves above. Never move a lit candle — blow it out first.',
    },
    {
      cs: '**Bezpečnější varianta je LED.** Čajová svíčka na baterii svítí skoro stejně a nic nehoří. Doporučujeme ji tam, kde jsou děti, zvířata nebo lidé, kteří na svíčku zapomenou.',
      en: '**The safer option is LED.** A battery tea light glows almost the same and nothing burns. We recommend it wherever there are children, pets, or people who forget candles.',
    },
  ] satisfies LocalizedText[],
  disclaimer: {
    cs: 'Nedodržení těchto pokynů může způsobit požár nebo zranění. Kupující odpovídá za bezpečné používání výrobku; Omnity.One s.r.o. neodpovídá za škody vzniklé nesprávným zacházením s otevřeným ohněm ani za škody vzniklé nedodržením výše uvedených zásad.',
    en: 'Failing to follow these instructions can cause fire or injury. The buyer is responsible for safe use of the product; Omnity.One s.r.o. is not liable for damage caused by improper handling of an open flame or by failure to follow the principles above.',
  } satisfies LocalizedText,
  /** Text, který zákazník odsouhlasí a podepíše u pokladny. */
  consent: {
    cs: 'Přečetl(a) jsem si bezpečnostní pokyny k lampionu Lumi 2 a rozumím, že výrobek je ze dřeva a svítí se v něm otevřený plamen. Budu svíčku používat ve sklenici, na nehořlavém podkladu, pod dozorem a mimo dosah dětí a hořlavých věcí. Beru na vědomí, že Omnity.One s.r.o. neodpovídá za škody vzniklé nesprávným zacházením s ohněm.',
    en: 'I have read the safety instructions for the Lumi 2 lantern and understand that the product is made of wood and burns an open flame. I will use the candle in a glass, on a non-flammable base, attended, and away from children and flammable items. I acknowledge that Omnity.One s.r.o. is not liable for damage caused by improper handling of fire.',
  } satisfies LocalizedText,
  signatureLabel: {
    cs: 'Digitální podpis — napište celé jméno',
    en: 'Digital signature — type your full name',
  } satisfies LocalizedText,
  signatureHint: {
    cs: 'Jménem potvrzujete výše uvedené. K objednávce se uloží jméno, čas a verze textu.',
    en: 'Your name confirms the above. The name, time and text version are stored with the order.',
  } satisfies LocalizedText,
  ackLabel: {
    cs: 'Přečetl(a) jsem si bezpečnostní pokyny a budu je dodržovat.',
    en: 'I have read the safety instructions and will follow them.',
  } satisfies LocalizedText,
  requiredError: {
    cs: 'U zboží se svíčkou je potřeba odsouhlasit bezpečnostní pokyny a podepsat se jménem.',
    en: 'Candle products require accepting the safety instructions and signing with your name.',
  } satisfies LocalizedText,
} as const;

/** Jazyk pro server (bez React kontextu). */
export function fireText(text: LocalizedText, lang: 'cs' | 'en' = 'cs'): string {
  return lang === 'en' ? text.en : text.cs;
}

/** Co pošle pokladna; `accepted` + `signature` jsou povinné u svíčkového zboží. */
export interface FireConsentInput {
  accepted?: boolean;
  signature?: string;
  version?: string;
  signedAt?: string;
}

export type FireConsentCheck =
  | { ok: true; name: string; version: string }
  | { ok: false; error: string; code: 'fire_consent_required' };

/**
 * Ověření prohlášení — **jediné místo**, kde se rozhoduje, jestli objednávka
 * se svíčkovým zbožím projde. Volá ho API (`/api/shop/orders`); klient
 * používá stejnou funkci jen k zašednutí tlačítka, takže se nedá obejít
 * vypnutým JavaScriptem.
 *
 * Verze se **neodmítá**, jen se vrací ta, kterou zákazník podepsal — mohla
 * být z jiného (staršího) znění a je to důkaz, ne chyba. Volající ji zaloguje.
 */
export function checkFireConsent(
  items: readonly { externalId: string }[],
  consent: FireConsentInput | undefined,
): FireConsentCheck | null {
  if (!requiresFireConsent(items)) return null;
  const name = typeof consent?.signature === 'string' ? consent.signature.trim() : '';
  if (!consent?.accepted || name.length < 3 || name.length > 120) {
    return { ok: false, error: 'Fire safety consent and digital signature required', code: 'fire_consent_required' };
  }
  const version =
    typeof consent.version === 'string' && consent.version.trim() ? consent.version.trim() : FIRE_CONSENT_VERSION;
  return { ok: true, name, version };
}
