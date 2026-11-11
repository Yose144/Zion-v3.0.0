import type { Localized } from '@/lib/i18n';

export interface LegalBlock {
  heading: Localized;
  body: Localized;
}

export const SHOPPING_PROCESS = {
  kicker: { cs: 'Nákupní řád', en: 'Order process', de: 'Bestellablauf' },
  title: { cs: 'Jak nakupovat', en: 'How to order', de: 'So bestellen Sie' },
  updated: '2026-11-11',
  lead: {
    cs: 'Od výběru lampionu po doručení. Osm kroků, jasné ceny, žádná překvapení.',
    en: 'From choosing the lantern to delivery. Eight steps, clear prices, no surprises.',
    de: 'Von der Auswahl der Laterne bis zur Lieferung. Acht Schritte, klare Preise, keine Überraschungen.',
  } satisfies Localized,
  steps: [
    {
      title: { cs: 'Vyberte produkt', en: 'Choose a product', de: 'Produkt wählen' },
      text: {
        cs: 'V kolekci najdete Lumi 2, Mini, Kit, sadu tří a doplňky. Na detailu vidíte cenu, sklad a dobu výroby.',
        en: 'In the collection you will find Lumi 2, Mini, Kit, a set of three and extras. The detail shows price, stock and production time.',
        de: 'In der Kollektion finden Sie Lumi 2, Mini, Kit, ein Set aus drei und Extras. Die Detailseite zeigt Preis, Lager und Fertigungszeit.',
      },
    },
    {
      title: { cs: 'Vložte do košíku', en: 'Add to cart', de: 'In den Warenkorb' },
      text: {
        cs: 'Zvolte množství. Personalizace a dárkové balení se přidávají k lampionu — samostatně je neobjednáte.',
        en: 'Choose the quantity. Personalisation and gift wrapping are added together with a lantern — they cannot be ordered alone.',
        de: 'Wählen Sie die Menge. Personalisierung und Geschenkverpackung werden zusammen mit einer Laterne bestellt — nicht einzeln.',
      },
    },
    {
      title: { cs: 'Zadejte údaje', en: 'Enter your details', de: 'Daten eingeben' },
      text: {
        cs: 'Jméno, e-mail, telefon, adresa nebo výdejní místo. Na firmu přidejte IČO a DIČ kvůli faktuře.',
        en: 'Name, e-mail, phone, address or pickup point. For a company add the company ID and VAT ID for the invoice.',
        de: 'Name, E-Mail, Telefon, Adresse oder Abholstelle. Für Firmen bitte Handelsregister- und USt-IdNr. für die Rechnung angeben.',
      },
    },
    {
      title: { cs: 'Zvolte dopravu a platbu', en: 'Choose shipping and payment', de: 'Versand und Zahlung wählen' },
      text: {
        cs: 'Zásilkovna na výdejní místo nebo adresu, případně osobní odběr. Platba převodem, kartou nebo dobírkou.',
        en: 'Zásilkovna to a pickup point or address, or personal pickup. Pay by transfer, card or cash on delivery.',
        de: 'Zásilkovna an eine Abholstelle oder Adresse oder persönliche Abholung. Zahlung per Überweisung, Karte oder Nachnahme.',
      },
    },
    {
      title: { cs: 'Potvrďte objednávku', en: 'Confirm the order', de: 'Bestellung bestätigen' },
      text: {
        cs: 'Souhlasíte s obchodními podmínkami a berete na vědomí zpracování údajů. U zboží se svíčkou podepisujete bezpečnostní prohlášení.',
        en: 'You agree to the terms and acknowledge data processing. For candle products you sign the safety statement.',
        de: 'Sie stimmen den AGB zu und nehmen die Datenverarbeitung zur Kenntnis. Bei Kerzenprodukten unterschreiben Sie die Sicherheitserklärung.',
      },
    },
    {
      title: { cs: 'Zaplaťte', en: 'Pay', de: 'Bezahlen' },
      text: {
        cs: 'Převod: pošleme QR kód a variabilní symbol. Karta: přes Stripe. Dobírka: platíte při převzetí, příplatek 45 Kč.',
        en: 'Transfer: we send a QR code and payment reference. Card: via Stripe. Cash on delivery: pay on receipt, CZK 45 fee.',
        de: 'Überweisung: Sie erhalten QR-Code und Verwendungszweck. Karte: über Stripe. Nachnahme: Zahlung bei Lieferung, 45 CZK Gebühr.',
      },
    },
    {
      title: { cs: 'Výroba a odeslání', en: 'Production and dispatch', de: 'Fertigung und Versand' },
      text: {
        cs: 'Vyrábíme na zakázku. Odesíláme obvykle do 5 pracovních dnů, personalizace přidává 2–3 dny. Termín potvrdíme e-mailem.',
        en: 'Made to order. We usually ship within 5 working days; personalisation adds 2–3 days. We confirm the date by e-mail.',
        de: 'Auftragsfertigung. Versand meist innerhalb von 5 Werktagen; Personalisierung verlängert um 2–3 Tage. Den Termin bestätigen wir per E-Mail.',
      },
    },
    {
      title: { cs: 'Doručení a převzetí', en: 'Delivery and receipt', de: 'Lieferung und Erhalt' },
      text: {
        cs: 'Zkontrolujte obal při převzetí. Když je něco poškozené, napište nám do 24 hodin — reklamaci ale přijmeme kdykoli.',
        en: 'Check the packaging on receipt. If anything is damaged, write to us within 24 hours — claims are accepted at any time.',
        de: 'Prüfen Sie die Verpackung bei Erhalt. Ist etwas beschädigt, schreiben Sie uns innerhalb von 24 Stunden — Reklamationen nehmen wir jederzeit an.',
      },
    },
  ],
  sections: [
    {
      heading: { cs: 'Ceny a platby', en: 'Prices and payments', de: 'Preise und Zahlung' },
      body: {
        cs: 'Ceny jsou uvedeny v Kč a jsou konečné — nejsme plátci DPH. Přijímáme bankovní převod, kartu (pokud je zapnutá) a dobírku s příplatkem 45 Kč. Objednávka je návrh na uzavření smlouvy; smlouva vzniká potvrzením objednávky e-mailem.',
        en: 'Prices are in CZK and final — we are not VAT payers. We accept bank transfer, card (when enabled) and cash on delivery with a CZK 45 fee. An order is an offer; the contract is formed when we confirm the order by e-mail.',
        de: 'Die Preise sind in CZK und endgültig — wir sind keine Umsatzsteuerzahler. Wir akzeptieren Überweisung, Karte (wenn aktiviert) und Nachnahme mit 45 CZK Gebühr. Die Bestellung ist ein Angebot; der Vertrag entsteht mit unserer Bestätigung per E-Mail.',
      },
    },
    {
      heading: { cs: 'Doprava', en: 'Shipping', de: 'Versand' },
      body: {
        cs: 'Zásilkovna na výdejní místo 79 Kč, na adresu 99 Kč. Doprava zdarma od 1 500 Kč. Osobní odběr po domluvě zdarma. Dodací doba je obvykle 5 pracovních dnů.',
        en: 'Zásilkovna pickup point CZK 79, to address CZK 99. Free shipping from CZK 1,500. Personal pickup by arrangement, free. Delivery usually takes 5 working days.',
        de: 'Zásilkovna Abholstelle 79 CZK, an Adresse 99 CZK. Versandkostenfrei ab 1.500 CZK. Persönliche Abholung nach Vereinbarung kostenlos. Lieferzeit meist 5 Werktage.',
      },
    },
    {
      heading: { cs: 'Personalizace', en: 'Personalisation', de: 'Personalisierung' },
      body: {
        cs: 'Jména, datum nebo logo vypálíme do dřeva. Před výrobou pošleme náhled k odsouhlasení. Personalizované zboží nelze vrátit, pokud není vadné.',
        en: 'We burn names, a date or a logo into the wood. We send a proof before production. Personalised goods cannot be returned unless faulty.',
        de: 'Wir brennen Namen, Datum oder Logo ins Holz. Vor der Fertigung senden wir einen Entwurf zur Freigabe. Personalisierte Ware ist nur bei Mängeln rückgabefähig.',
      },
    },
    {
      heading: { cs: 'Odstoupení a reklamace', en: 'Withdrawal and claims', de: 'Widerruf und Reklamation' },
      body: {
        cs: 'Spotřebitel může odstoupit do 14 dnů od převzetí (podrobnosti a formulář na stránce Odstoupení). Vady řešíme do 30 dnů; vadný kus vyměníme nebo vrátíme peníze.',
        en: 'A consumer may withdraw within 14 days of receipt (details and form on the Withdrawal page). We handle defects within 30 days; a faulty piece is replaced or refunded.',
        de: 'Verbraucher können innerhalb von 14 Tagen nach Erhalt widerrufen (Details und Formular auf der Widerrufsseite). Mängel bearbeiten wir innerhalb von 30 Tagen; fehlerhafte Stücke werden ersetzt oder erstattet.',
      },
    },
    {
      heading: { cs: 'Osobní údaje a bezpečnost', en: 'Personal data and safety', de: 'Personendaten und Sicherheit' },
      body: {
        cs: 'Údaje zpracováváme podle zásad ochrany osobních údajů, používáme jen technické cookies. Lampion je dřevěný výrobek se svíčkou — před použitím si přečtěte bezpečnostní pokyny a informace GPSR.',
        en: 'We process data under our privacy policy and use only technical cookies. The lantern is a wooden product with a candle — read the safety instructions and GPSR information before use.',
        de: 'Wir verarbeiten Daten gemäß unserer Datenschutzerklärung und verwenden nur technische Cookies. Die Laterne ist ein Holzprodukt mit Kerze — lesen Sie vor Gebrauch die Sicherheitshinweise und GPSR-Informationen.',
      },
    },
  ],
  links: [
    { href: '/obchodni-podminky', label: { cs: 'Obchodní podmínky', en: 'Terms', de: 'AGB' } },
    { href: '/odstoupeni-od-smlouvy', label: { cs: 'Odstoupení od smlouvy', en: 'Withdrawal', de: 'Widerruf' } },
    { href: '/reklamace', label: { cs: 'Reklamace', en: 'Claims', de: 'Reklamation' } },
    { href: '/ochrana-osobnich-udaju', label: { cs: 'Ochrana údajů', en: 'Privacy', de: 'Datenschutz' } },
    { href: '/cookies', label: { cs: 'Cookies', en: 'Cookies', de: 'Cookies' } },
    { href: '/bezpecnost-produktu', label: { cs: 'Bezpečnost produktu', en: 'Product safety', de: 'Produktsicherheit' } },
  ],
} as const;

export const COOKIES = {
  kicker: { cs: 'Cookies', en: 'Cookies', de: 'Cookies' },
  title: { cs: 'Používáme jen technické cookies', en: 'We use only technical cookies', de: 'Wir verwenden nur technische Cookies' },
  updated: '2026-11-11',
  lead: {
    cs: 'Žádná reklama, žádné měření, žádné sledování. Jen to, co potřebuje košík, jazyk a přihlášení do administrace.',
    en: 'No advertising, no analytics, no tracking. Only what the cart, language and admin login need.',
    de: 'Keine Werbung, keine Analyse, kein Tracking. Nur was Warenkorb, Sprache und Admin-Anmeldung brauchen.',
  } satisfies Localized,
  rows: [
    {
      name: 'lumi_lang',
      purpose: { cs: 'Zapamatuje zvolený jazyk', en: 'Remembers your language', de: 'Merkt sich die Sprache' },
      type: { cs: 'localStorage + cookie', en: 'localStorage + cookie', de: 'localStorage + Cookie' },
      duration: { cs: '1 rok', en: '1 year', de: '1 Jahr' },
      necessary: true,
    },
    {
      name: 'lumi_cart_v1',
      purpose: { cs: 'Obsah košíku', en: 'Cart contents', de: 'Warenkorbinhalt' },
      type: { cs: 'localStorage', en: 'localStorage', de: 'localStorage' },
      duration: { cs: 'do vymazání', en: 'until cleared', de: 'bis zur Löschung' },
      necessary: true,
    },
    {
      name: 'lumi_cookie_notice',
      purpose: { cs: 'Skrytí informační lišty', en: 'Hides the cookie notice', de: 'Blendet den Cookie-Hinweis aus' },
      type: { cs: 'localStorage + cookie', en: 'localStorage + cookie', de: 'localStorage + Cookie' },
      duration: { cs: '1 rok', en: '1 year', de: '1 Jahr' },
      necessary: true,
    },
    {
      name: 'lumi_order_email',
      purpose: { cs: 'Dohledání objednávky v tomto prohlížeči', en: 'Finds your order in this browser', de: 'Findet Ihre Bestellung in diesem Browser' },
      type: { cs: 'sessionStorage', en: 'sessionStorage', de: 'sessionStorage' },
      duration: { cs: 'do zavření karty', en: 'until the tab closes', de: 'bis zum Schließen des Tabs' },
      necessary: true,
    },
    {
      name: 'lumi_admin',
      purpose: { cs: 'Přihlášení do administrace', en: 'Admin login', de: 'Admin-Anmeldung' },
      type: { cs: 'cookie', en: 'cookie', de: 'Cookie' },
      duration: { cs: '12 hodin', en: '12 hours', de: '12 Stunden' },
      necessary: true,
    },
    {
      name: 'Stripe',
      purpose: {
        cs: 'Pouze při platbě kartou — bezpečnost a prevence podvodů',
        en: 'Only for card payment — security and fraud prevention',
        de: 'Nur bei Kartenzahlung — Sicherheit und Betrugsprävention',
      },
      type: { cs: 'cookie třetí strany', en: 'third-party cookie', de: 'Cookie eines Drittanbieters' },
      duration: { cs: 'dle Stripe', en: 'per Stripe', de: 'gemäß Stripe' },
      necessary: false,
    },
  ],
  note: {
    cs: 'Technické cookies jsou nutné pro fungování obchodu, proto k nim nepotřebujeme souhlas. Všechny můžete kdykoli smazat v nastavení prohlížeče. Fonty načítáme z našeho serveru, ne z Google Fonts.',
    en: 'Technical cookies are necessary for the shop to work, so they do not require consent. You can delete them in your browser settings at any time. Fonts are served from our own server, not Google Fonts.',
    de: 'Technische Cookies sind für den Betrieb des Shops notwendig und benötigen keine Einwilligung. Sie können sie jederzeit in den Browsereinstellungen löschen. Schriften werden von unserem Server geladen, nicht von Google Fonts.',
  } satisfies Localized,
} as const;

export const PRODUCT_SAFETY = {
  kicker: { cs: 'GPSR', en: 'GPSR', de: 'GPSR' },
  title: { cs: 'Bezpečnost produktu', en: 'Product safety', de: 'Produktsicherheit' },
  updated: '2026-11-11',
  lead: {
    cs: 'Informace podle nařízení EU 2023/988 o obecné bezpečnosti výrobků. Lampion je dekorace se svíčkou, ne hračka.',
    en: 'Information under EU Regulation 2023/988 on general product safety. The lantern is a decoration with a candle, not a toy.',
    de: 'Informationen nach EU-Verordnung 2023/988 über die allgemeine Produktsicherheit. Die Laterne ist eine Dekoration mit Kerze, kein Spielzeug.',
  } satisfies Localized,
  rows: [
    {
      label: { cs: 'Výrobce', en: 'Manufacturer', de: 'Hersteller' },
      value: {
        cs: 'Omnity.One s.r.o., Horní Čermná 229, 561 56 Horní Čermná, IČO 09120050',
        en: 'Omnity.One s.r.o., Horní Čermná 229, 561 56 Horní Čermná, Czech Republic, ID 09120050',
        de: 'Omnity.One s.r.o., Horní Čermná 229, 561 56 Horní Čermná, Tschechien, ID 09120050',
      },
    },
    {
      label: { cs: 'Produkty', en: 'Products', de: 'Produkte' },
      value: { cs: 'Lumi 2, Lumi Mini, Lumi Kit', en: 'Lumi 2, Lumi Mini, Lumi Kit', de: 'Lumi 2, Lumi Mini, Lumi Kit' },
    },
    {
      label: { cs: 'Materiál', en: 'Material', de: 'Material' },
      value: {
        cs: '3mm březová překližka, dřevěné lepidlo D3, bez povrchové úpravy',
        en: '3 mm birch plywood, D3 wood glue, unfinished',
        de: '3 mm Birkensperrholz, D3-Holzleim, unbehandelt',
      },
    },
    {
      label: { cs: 'Určení', en: 'Intended use', de: 'Verwendungszweck' },
      value: {
        cs: 'Dekorativní svítidlo pro čajovou svíčku ve sklenici, interiér, suché prostředí',
        en: 'Decorative light for a tea light in a glass, indoor use, dry environment',
        de: 'Dekorative Leuchte für ein Teelicht im Glas, Innenbereich, trockene Umgebung',
      },
    },
    {
      label: { cs: 'Věkové určení', en: 'Age guidance', de: 'Altershinweis' },
      value: {
        cs: 'Není hračka. Uchovávejte mimo dosah dětí; zapalování jen dospělou osobou.',
        en: 'Not a toy. Keep out of reach of children; light only by an adult.',
        de: 'Kein Spielzeug. Von Kindern fernhalten; nur von Erwachsenen anzünden.',
      },
    },
    {
      label: { cs: 'Dohledatelnost', en: 'Traceability', de: 'Rückverfolgbarkeit' },
      value: {
        cs: 'Číslovaná edice; číslo kusu je vyznačeno na spodní straně.',
        en: 'Numbered edition; the piece number is marked on the base.',
        de: 'Nummerierte Edition; die Stücknummer ist auf der Unterseite markiert.',
      },
    },
  ],
  sections: [
    {
      heading: { cs: 'Co výrobek je', en: 'What the product is', de: 'Was das Produkt ist' },
      body: {
        cs: 'Ručně řezaný dřevěný lampion pro dekorativní osvětlení interiéru. Svítí čajovou svíčkou ve sklenici. Není určen k vytápění, vaření ani k venkovnímu použití ve vlhku.',
        en: 'A hand-cut wooden lantern for decorative indoor lighting. It is lit by a tea light in a glass. Not intended for heating, cooking or outdoor use in damp conditions.',
        de: 'Eine handgeschnittene Holzlaterne für dekorative Innenbeleuchtung. Sie wird mit einem Teelicht im Glas betrieben. Nicht zum Heizen, Kochen oder für den Außenbereich bei Feuchtigkeit bestimmt.',
      },
    },
    {
      heading: { cs: 'Bezpečnostní pokyny', en: 'Safety instructions', de: 'Sicherheitshinweise' },
      body: {
        cs: 'Svíčku vždy do sklenice, na nehořlavý podklad, pod dohledem a mimo dosah dětí a hořlavin. Dodržujte odstup nejméně 30 cm od záclon, knih a dalších hořlavých věcí. Hořící svíčku nepřesouvejte. Bezpečnější variantou je LED svíčka. Celé pokyny najdete níže na této stránce.',
        en: 'Always use the candle in a glass, on a non-flammable base, attended, away from children and flammable items. Keep at least 30 cm from curtains, books and other combustibles. Never move a lit candle. An LED candle is the safer option. Full instructions are below on this page.',
        de: 'Kerze immer im Glas, auf nicht brennbarer Unterlage, beaufsichtigt und fern von Kindern und Brennbarem. Mindestens 30 cm Abstand zu Vorhängen, Büchern und anderen brennbaren Gegenständen. Eine brennende Kerze nie umstellen. Eine LED-Kerze ist die sicherere Variante. Alle Hinweise finden Sie unten auf dieser Seite.',
      },
    },
    {
      heading: { cs: 'Poškození a opravy', en: 'Damage and repairs', de: 'Schäden und Reparaturen' },
      body: {
        cs: 'Poškozený nebo zdeformovaný kus nepoužívejte. Napište nám s číslem objednávky a fotografií — domluvíme výměnu nebo opravu. Výrobek neopravujte lepením, pokud by se tím zhoršila stabilita nebo se zvětšila vzdálenost od svíčky.',
        en: 'Do not use a damaged or deformed piece. Write to us with the order number and a photo — we will arrange a replacement or repair. Do not repair with glue if it would reduce stability or bring the candle closer to the wood.',
        de: 'Ein beschädigtes oder verformtes Stück nicht verwenden. Schreiben Sie uns mit Bestellnummer und Foto — wir vereinbaren Ersatz oder Reparatur. Nicht mit Kleber reparieren, wenn dadurch die Stabilität leidet oder die Kerze näher an das Holz kommt.',
      },
    },
    {
      heading: { cs: 'Kontakt pro bezpečnost', en: 'Safety contact', de: 'Sicherheitskontakt' },
      body: {
        cs: 'Omnity.One s.r.o., ahoj@lumi.zionterranova.com. Na dotazy k bezpečnosti odpovídáme do jednoho pracovního dne.',
        en: 'Omnity.One s.r.o., ahoj@lumi.zionterranova.com. We answer safety questions within one working day.',
        de: 'Omnity.One s.r.o., ahoj@lumi.zionterranova.com. Sicherheitsfragen beantworten wir innerhalb eines Werktags.',
      },
    },
  ],
} as const;

export const WITHDRAWAL = {
  kicker: { cs: 'Odstoupení', en: 'Withdrawal', de: 'Widerruf' },
  title: { cs: 'Odstoupení od smlouvy do 14 dnů', en: 'Withdrawal within 14 days', de: 'Widerruf innerhalb von 14 Tagen' },
  updated: '2026-11-11',
  lead: {
    cs: 'Zboží můžete vrátit bez udání důvodu do 14 dnů od převzetí. Napište nám e-mail a my vám pošleme další krok.',
    en: 'You can return goods without giving a reason within 14 days of receipt. Send us an e-mail and we will send the next step.',
    de: 'Sie können Waren innerhalb von 14 Tagen nach Erhalt ohne Angabe von Gründen zurückgeben. Schreiben Sie uns eine E-Mail und wir senden den nächsten Schritt.',
  } satisfies Localized,
  steps: [
    {
      title: { cs: 'Napište do 14 dnů', en: 'Write within 14 days', de: 'Innerhalb von 14 Tagen schreiben' },
      text: {
        cs: 'E-mail s číslem objednávky a větou „odstupuji od smlouvy“. Nemusíte uvádět důvod.',
        en: 'An e-mail with the order number and the words “I withdraw from the contract”. You do not need to give a reason.',
        de: 'Eine E-Mail mit Bestellnummer und dem Satz „Ich widerrufe den Vertrag“. Sie müssen keinen Grund angeben.',
      },
    },
    {
      title: { cs: 'Pošlete zboží', en: 'Send the goods', de: 'Ware senden' },
      text: {
        cs: 'Nepoužité zboží v původním obalu na adresu Omnity.One s.r.o., Horní Čermná 229, 561 56 Horní Čermná. Náklady na vrácení nese kupující.',
        en: 'Unused goods in the original packaging to Omnity.One s.r.o., Horní Čermná 229, 561 56 Horní Čermná, Czech Republic. The buyer bears the return cost.',
        de: 'Unbenutzte Ware in der Originalverpackung an Omnity.One s.r.o., Horní Čermná 229, 561 56 Horní Čermná, Tschechien. Die Rücksendekosten trägt der Käufer.',
      },
    },
    {
      title: { cs: 'Vrátíme peníze', en: 'We refund', de: 'Wir erstatten' },
      text: {
        cs: 'Penize vrátíme do 14 dnů od obdržení zásilky, stejným způsobem, jakým jste platili.',
        en: 'We refund within 14 days of receiving the parcel, using the same payment method you used.',
        de: 'Wir erstatten innerhalb von 14 Tagen nach Eingang der Sendung mit derselben Zahlungsmethode.',
      },
    },
  ],
  conditions: {
    cs: 'Personalizované zboží (jména, datum, logo) je z odstoupení vyloučeno podle § 1837 občanského zákoníku, pokud není vadné. Zboží musí být nepoužité, v původním obalu a bez poškození. Doporučujeme posílat doporučeně nebo s pojištěním.',
    en: 'Personalised goods (names, date, logo) are excluded from withdrawal under § 1837 of the Czech Civil Code unless faulty. Goods must be unused, in the original packaging and undamaged. We recommend sending them insured.',
    de: 'Personalisierte Ware (Namen, Datum, Logo) ist nach § 1837 des tschechischen Zivilgesetzbuchs vom Widerruf ausgeschlossen, sofern nicht fehlerhaft. Die Ware muss unbenutzt, in der Originalverpackung und unbeschädigt sein. Wir empfehlen den Versand versichert.',
  } satisfies Localized,
  formTitle: { cs: 'Vzorový formulář', en: 'Model form', de: 'Musterformular' },
  form: {
    cs: `Omnity.One s.r.o.
Horní Čermná 229, 561 56 Horní Čermná
IČO 09120050
ahoj@lumi.zionterranova.com

OZNÁMENÍ O ODSTOUPENÍ OD SMLOUVY

Oznamuji, že odstupuji od kupní smlouvy na objednávku č.: ____________________
Datum objednání: ____________________
Datum převzetí: ____________________
Jméno a příjmení: ____________________
Adresa: ____________________
E-mail: ____________________
Číslo účtu pro vrácení: ____________________
Podpis: ____________________
Datum: ____________________`,
    en: `Omnity.One s.r.o.
Horní Čermná 229, 561 56 Horní Čermná
Czech Republic, ID 09120050
ahoj@lumi.zionterranova.com

NOTICE OF WITHDRAWAL FROM THE CONTRACT

I hereby withdraw from the purchase contract for order no.: ____________________
Order date: ____________________
Date received: ____________________
Name: ____________________
Address: ____________________
E-mail: ____________________
Bank account for refund: ____________________
Signature: ____________________
Date: ____________________`,
    de: `Omnity.One s.r.o.
Horní Čermná 229, 561 56 Horní Čermná
Tschechien, ID 09120050
ahoj@lumi.zionterranova.com

WIDERRUFSERKLÄRUNG

Hiermit widerrufe ich den Kaufvertrag über die Bestellung Nr.: ____________________
Bestelldatum: ____________________
Erhalten am: ____________________
Name: ____________________
Adresse: ____________________
E-Mail: ____________________
Bankkonto für die Erstattung: ____________________
Unterschrift: ____________________
Datum: ____________________`,
  } satisfies Localized,
} as const;
