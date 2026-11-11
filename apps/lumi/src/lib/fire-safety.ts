import type { Localized } from '@/lib/i18n';

/**
 * Bezpečnostní prohlášení pro zboží s otevřeným plamenem.
 *
 * Stejná pravidla jako v MarketPlace:
 *  1. Změna textu, který zákazník odsouhlasí, **musí** bumpnout verzi —
 *     jinak by u objednávek zůstal podpis pod jiným zněním.
 *  2. Jeden zdroj pravdy pro detail, pokladnu, e-mail i fakturu.
 *  3. Text neslibuje bezpečnost, popisuje správné použití a odpovědnost.
 */
export const FIRE_CONSENT_VERSION = 'lumi-fire-2026-11';

/** Produkty, u kterých hoří dřevo a svíčka. Nový svíčkový produkt = přidat sem. */
export const FIRE_RISK_PRODUCTS: readonly string[] = [
  'lumi-2',
  'lumi-mini',
  'lumi-kit',
  'lumi-set-3',
];

export function requiresFireConsent(items: readonly { externalId: string }[]): boolean {
  return items.some((item) => FIRE_RISK_PRODUCTS.includes(item.externalId));
}

export const FIRE_SAFETY = {
  title: {
    cs: 'Bezpečnost: oheň a dřevo',
    en: 'Safety: fire and wood',
    de: 'Sicherheit: Feuer und Holz',
  } satisfies Localized,
  lead: {
    cs: 'Lampion je z 3mm březové překližky a svítí se v něm otevřený plamen. Dřevo hoří. Přečtěte si prosím pět bodů níže — jsou krátké a jsou důvod, proč lampion vypadá tak, jak vypadá.',
    en: 'The lantern is made of 3 mm birch plywood and burns an open flame. Wood burns. Please read the five points below — they are short, and they are the reason the lantern is built the way it is.',
    de: 'Die Laterne besteht aus 3 mm Birkensperrholz und brennt mit offener Flamme. Holz brennt. Bitte lesen Sie die fünf Punkte unten — sie sind kurz und der Grund, warum die Laterne so gebaut ist, wie sie ist.',
  } satisfies Localized,
  points: [
    {
      cs: '**Svíčku dávejte do sklenice.** Obyčejná čajová svíčka ve sklenici od malé Nutelly (nebo jakékoli sklo od zavařeniny) zachytí vosk i případný plamen. Lampion pak stojí na skle, ne na dřevě.',
      en: '**Put the candle in a glass.** An ordinary tea light inside a small jam jar catches the wax and any flame. The lantern then stands on glass, not on wood.',
      de: '**Kerze in ein Glas stellen.** Ein normales Teelicht in einem kleinen Marmeladenglas fängt Wachs und eine eventuelle Flamme auf. Die Laterne steht dann auf Glas, nicht auf Holz.',
    },
    {
      cs: '**Podklad nehořlavý.** Lampion stavte na kámen, keramiku, plech nebo sklo. Nikdy na ubrus, papír, polystyren, koberec ani na lakovaný nábytek.',
      en: '**Non-flammable base.** Stand the lantern on stone, ceramic, metal or glass. Never on a tablecloth, paper, polystyrene, carpet or lacquered furniture.',
      de: '**Nicht brennbare Unterlage.** Stellen Sie die Laterne auf Stein, Keramik, Metall oder Glas. Niemals auf Tischdecke, Papier, Styropor, Teppich oder lackierte Möbel.',
    },
    {
      cs: '**Nenechávejte ho bez dozoru.** Zhasněte, než odejdete z místnosti nebo jdete spát. Ať ho nikdy nezapálí dítě samo.',
      en: '**Never leave it unattended.** Blow it out before you leave the room or go to sleep. A child should never light it alone.',
      de: '**Nie unbeaufsichtigt lassen.** Löschen Sie die Kerze, bevor Sie den Raum verlassen oder schlafen gehen. Kinder dürfen sie nie allein anzünden.',
    },
    {
      cs: '**Odstup od všeho, co hoří.** Minimálně 30 cm od záclon, knih, větví, košů a horních polic. Hořící svíčku nepřesouvejte — nejdřív zhasněte.',
      en: '**Distance from anything that burns.** At least 30 cm from curtains, books, branches, baskets and shelves above. Never move a lit candle — blow it out first.',
      de: '**Abstand zu allem Brennbaren.** Mindestens 30 cm von Vorhängen, Büchern, Zweigen, Körben und Regalen darüber. Eine brennende Kerze nie umstellen — zuerst löschen.',
    },
    {
      cs: '**Bezpečnější varianta je LED.** Čajová svíčka na baterii svítí skoro stejně a nic nehoří. Doporučujeme ji tam, kde jsou děti, zvířata nebo lidé, kteří na svíčku zapomenou.',
      en: '**The safer option is LED.** A battery tea light glows almost the same and nothing burns. We recommend it wherever there are children, pets, or people who forget candles.',
      de: '**Die sicherere Variante ist LED.** Ein Teelicht mit Batterie leuchtet fast genauso und nichts brennt. Wir empfehlen es überall dort, wo Kinder, Tiere oder vergessliche Menschen sind.',
    },
  ] satisfies Localized[],
  disclaimer: {
    cs: 'Nedodržení těchto pokynů může způsobit požár nebo zranění. Kupující odpovídá za bezpečné používání výrobku; Omnity.One s.r.o. neodpovídá za škody vzniklé nesprávným zacházením s otevřeným ohněm ani za škody vzniklé nedodržením výše uvedených zásad.',
    en: 'Failing to follow these instructions can cause fire or injury. The buyer is responsible for safe use of the product; Omnity.One s.r.o. is not liable for damage caused by improper handling of an open flame or by failure to follow the principles above.',
    de: 'Die Nichtbeachtung dieser Hinweise kann Feuer oder Verletzungen verursachen. Der Käufer ist für die sichere Verwendung des Produkts verantwortlich; Omnity.One s.r.o. haftet nicht für Schäden durch unsachgemäßen Umgang mit offenem Feuer oder durch Nichtbeachtung der oben genannten Grundsätze.',
  } satisfies Localized,
  consent: {
    cs: 'Přečetl(a) jsem si bezpečnostní pokyny k lampionu Lumi a rozumím, že výrobek je ze dřeva a svítí se v něm otevřený plamen. Budu svíčku používat ve sklenici, na nehořlavém podkladu, pod dozorem a mimo dosah dětí a hořlavých věcí. Beru na vědomí, že Omnity.One s.r.o. neodpovídá za škody vzniklé nesprávným zacházením s ohněm.',
    en: 'I have read the safety instructions for the Lumi lantern and understand that the product is made of wood and burns an open flame. I will use the candle in a glass, on a non-flammable base, attended, and away from children and flammable items. I acknowledge that Omnity.One s.r.o. is not liable for damage caused by improper handling of fire.',
    de: 'Ich habe die Sicherheitshinweise zur Lumi-Laterne gelesen und verstehe, dass das Produkt aus Holz ist und mit offener Flamme brennt. Ich verwende die Kerze in einem Glas, auf einer nicht brennbaren Unterlage, beaufsichtigt und außerhalb der Reichweite von Kindern und brennbaren Gegenständen. Mir ist bekannt, dass Omnity.One s.r.o. nicht für Schäden durch unsachgemäßen Umgang mit Feuer haftet.',
  } satisfies Localized,
  signatureLabel: {
    cs: 'Digitální podpis — napište celé jméno',
    en: 'Digital signature — type your full name',
    de: 'Digitale Unterschrift — vollständigen Namen eingeben',
  } satisfies Localized,
  signatureHint: {
    cs: 'Jménem potvrzujete výše uvedené. K objednávce se uloží jméno, čas a verze textu.',
    en: 'Your name confirms the above. The name, time and text version are stored with the order.',
    de: 'Mit dem Namen bestätigen Sie das oben Gesagte. Name, Zeit und Textversion werden mit der Bestellung gespeichert.',
  } satisfies Localized,
  ackLabel: {
    cs: 'Přečetl(a) jsem si bezpečnostní pokyny a budu je dodržovat.',
    en: 'I have read the safety instructions and will follow them.',
    de: 'Ich habe die Sicherheitshinweise gelesen und werde sie befolgen.',
  } satisfies Localized,
  requiredError: {
    cs: 'U zboží se svíčkou je potřeba odsouhlasit bezpečnostní pokyny a podepsat se jménem.',
    en: 'Candle products require accepting the safety instructions and signing with your name.',
    de: 'Bei Kerzenprodukten müssen die Sicherheitshinweise akzeptiert und mit dem Namen unterschrieben werden.',
  } satisfies Localized,
} as const;

export interface FireConsentInput {
  accepted?: boolean;
  signature?: string;
  version?: string;
  signedAt?: string;
}

export type FireConsentCheck =
  | { ok: true; name: string; version: string }
  | { ok: false; error: string; code: 'fire_consent_required' };

export function checkFireConsent(
  items: readonly { externalId: string }[],
  consent: FireConsentInput | undefined,
): FireConsentCheck | null {
  if (!requiresFireConsent(items)) return null;
  const name = typeof consent?.signature === 'string' ? consent.signature.trim() : '';
  if (!consent?.accepted || name.length < 3 || name.length > 120) {
    return {
      ok: false,
      error: 'Fire safety consent and digital signature required',
      code: 'fire_consent_required',
    };
  }
  const version =
    typeof consent.version === 'string' && consent.version.trim()
      ? consent.version.trim()
      : FIRE_CONSENT_VERSION;
  return { ok: true, name, version };
}
