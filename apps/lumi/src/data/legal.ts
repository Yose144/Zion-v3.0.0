import type { Localized } from '@/lib/i18n';

export interface LegalSection {
  heading: Localized;
  body: Localized;
}

export interface LegalDoc {
  kicker: Localized;
  title: Localized;
  updated: string;
  note?: Localized;
  sections: LegalSection[];
}

export const TERMS: LegalDoc = {
  kicker: { cs: 'Právní informace', en: 'Legal', de: 'Rechtliches' },
  title: { cs: 'Obchodní podmínky', en: 'Terms and conditions', de: 'Allgemeine Geschäftsbedingungen' },
  updated: '2026-11-11',
  note: {
    cs: 'Prodávající je Omnity.One s.r.o. Tyto podmínky se řídí právem České republiky.',
    en: 'The seller is Omnity.One s.r.o. These terms are governed by the law of the Czech Republic. The Czech version is binding.',
    de: 'Verkäufer ist Omnity.One s.r.o. Es gilt tschechisches Recht. Verbindlich ist die tschechische Fassung.',
  },
  sections: [
    {
      heading: { cs: '1. Prodávající', en: '1. Seller', de: '1. Verkäufer' },
      body: {
        cs: 'Omnity.One s.r.o., se sídlem Horní Čermná 229, 561 56 Horní Čermná, IČO 09120050, zapsaná u Krajského soudu v Hradci Králové, spisová značka C 00215716. Kontakt: ahoj@lumi.zionterranova.com. Nejsme plátci DPH, ceny jsou konečné.',
        en: 'Omnity.One s.r.o., registered at Horní Čermná 229, 561 56 Horní Čermná, Czech Republic, company ID 09120050, registered at the Regional Court in Hradec Králové, file no. C 00215716. Contact: ahoj@lumi.zionterranova.com. We are not VAT payers; prices are final.',
        de: 'Omnity.One s.r.o., Sitz Horní Čermná 229, 561 56 Horní Čermná, Tschechien, Handelsregisternummer 09120050, eingetragen beim Regionalgericht Hradec Králové, Aktenzeichen C 00215716. Kontakt: ahoj@lumi.zionterranova.com. Wir sind keine Umsatzsteuerzahler; die Preise sind endgültig.',
      },
    },
    {
      heading: { cs: '2. Objednávka a uzavření smlouvy', en: '2. Order and contract', de: '2. Bestellung und Vertrag' },
      body: {
        cs: 'Objednávka je návrhem na uzavření kupní smlouvy. Smlouva vzniká potvrzením objednávky e-mailem. Ceny a dostupnost se mohou změnit do okamžiku potvrzení. U zboží na zakázku potvrzujeme termín výroby. Podrobný průběh objednávky popisuje nákupní řád.',
        en: 'An order is an offer to conclude a purchase contract. The contract is formed when we confirm the order by e-mail. Prices and availability may change until confirmation. For made-to-order goods we confirm the production date. The order process is described in our order rules.',
        de: 'Die Bestellung ist ein Angebot zum Abschluss eines Kaufvertrags. Der Vertrag entsteht mit unserer Bestätigung per E-Mail. Preise und Verfügbarkeit können sich bis zur Bestätigung ändern. Bei Auftragsfertigung bestätigen wir den Produktionstermin. Der Bestellablauf ist in unseren Bestellregeln beschrieben.',
      },
    },
    {
      heading: { cs: '3. Ceny a platba', en: '3. Prices and payment', de: '3. Preise und Zahlung' },
      body: {
        cs: 'Ceny jsou uvedeny v Kč a jsou konečné. Platba probíhá bankovním převodem, kartou přes Stripe nebo dobírkou. Při dobírce se účtuje příplatek 45 Kč. Zboží odesíláme po připsání platby, u dobírky po potvrzení objednávky.',
        en: 'Prices are in CZK and are final. Payment is by bank transfer, card via Stripe or cash on delivery. A CZK 45 fee applies to cash on delivery. We ship after payment is received; for cash on delivery, after order confirmation.',
        de: 'Die Preise sind in CZK und endgültig. Zahlung per Überweisung, Karte über Stripe oder Nachnahme. Bei Nachnahme fallen 45 CZK an. Wir versenden nach Zahlungseingang, bei Nachnahme nach Bestellbestätigung.',
      },
    },
    {
      heading: { cs: '4. Dodání', en: '4. Delivery', de: '4. Lieferung' },
      body: {
        cs: 'Dodací doba je obvykle 5 pracovních dnů, u personalizace 7–8 pracovních dnů. Dopravu zajišťuje Zásilkovna nebo osobní odběr po domluvě. Riziko přechází na kupujícího převzetím zásilky.',
        en: 'Delivery usually takes 5 working days, or 7–8 working days with personalisation. Delivery is by Zásilkovna or personal pickup by arrangement. Risk passes to the buyer on receipt.',
        de: 'Die Lieferzeit beträgt meist 5 Werktage, mit Personalisierung 7–8 Werktage. Lieferung durch Zásilkovna oder Abholung nach Vereinbarung. Die Gefahr geht mit Erhalt auf den Käufer über.',
      },
    },
    {
      heading: { cs: '5. Odstoupení od smlouvy', en: '5. Right of withdrawal', de: '5. Widerrufsrecht' },
      body: {
        cs: 'Spotřebitel může odstoupit do 14 dnů od převzetí. Zboží musí být nepoužité a v původním obalu. Personalizované zboží (jména, datum, logo) je z odstoupení vyloučeno podle § 1837 občanského zákoníku, nejde-li o vadu. Podrobný postup a vzorový formulář jsou na stránce Odstoupení od smlouvy.',
        en: 'A consumer may withdraw within 14 days of receipt. Goods must be unused and in the original packaging. Personalised goods (names, date, logo) are excluded under § 1837 of the Czech Civil Code unless faulty. The detailed process and model form are on the Withdrawal page.',
        de: 'Verbraucher können innerhalb von 14 Tagen nach Erhalt widerrufen. Die Ware muss unbenutzt und in der Originalverpackung sein. Personalisierte Ware (Namen, Datum, Logo) ist nach § 1837 des tschechischen Zivilgesetzbuchs ausgeschlossen, sofern nicht fehlerhaft. Der genaue Ablauf und das Musterformular stehen auf der Widerrufsseite.',
      },
    },
    {
      heading: { cs: '6. Reklamace', en: '6. Claims', de: '6. Reklamation' },
      body: {
        cs: 'Vady uplatněte e-mailem s číslem objednávky a fotografií. Reklamaci vyřídíme do 30 dnů. Vadný kus vyměníme nebo vrátíme peníze. Na opotřebení běžným používáním se záruka nevztahuje. Postup a adresa pro vrácení jsou na stránce Reklamace a vrácení.',
        en: 'Report defects by e-mail with the order number and a photo. We handle claims within 30 days. A faulty piece is replaced or refunded. Normal wear is not covered. The process and return address are on the Claims and returns page.',
        de: 'Mängel bitte per E-Mail mit Bestellnummer und Foto melden. Wir bearbeiten Reklamationen innerhalb von 30 Tagen. Fehlerhafte Stücke werden ersetzt oder erstattet. Normaler Verschleiß ist nicht abgedeckt. Ablauf und Rücksendeadresse stehen auf der Seite Reklamation und Rückgabe.',
      },
    },
    {
      heading: { cs: '7. Bezpečnost a odpovědnost', en: '7. Safety and liability', de: '7. Sicherheit und Haftung' },
      body: {
        cs: 'Lampion je dřevěný výrobek určený pro svíčku. Kupující je povinen dodržovat bezpečnostní pokyny: svíčka ve sklenici, nehořlavý podklad, dohled, odstup 30 cm od hořlavin, žádné zapalování dětmi. Omnity.One s.r.o. neodpovídá za škody vzniklé nedodržením pokynů. Informace podle nařízení GPSR jsou na stránce Bezpečnost produktu.',
        en: 'The lantern is a wooden product intended for a candle. The buyer must follow the safety instructions: candle in a glass, non-flammable base, supervision, 30 cm from flammable items, no lighting by children. Omnity.One s.r.o. is not liable for damage caused by failure to follow them. GPSR information is on the Product safety page.',
        de: 'Die Laterne ist ein Holzprodukt für eine Kerze. Der Käufer muss die Sicherheitshinweise befolgen: Kerze im Glas, nicht brennbare Unterlage, Aufsicht, 30 cm Abstand zu Brennbarem, kein Anzünden durch Kinder. Omnity.One s.r.o. haftet nicht für Schäden durch Nichtbeachtung. GPSR-Informationen stehen auf der Seite Produktsicherheit.',
      },
    },
    {
      heading: { cs: '8. Ochrana údajů a mimosoudní řešení', en: '8. Data protection and disputes', de: '8. Datenschutz und Streitbeilegung' },
      body: {
        cs: 'Osobní údaje zpracováváme podle zásad v dokumentu Ochrana osobních údajů. Spotřebitel může podat návrh na mimosoudní řešení sporu u České obchodní inspekce (www.coi.cz), nebo se obrátit na soud příslušný podle místa bydliště. Podrobnosti o cookies jsou v dokumentu Cookies.',
        en: 'We process personal data according to our Privacy policy. A consumer may seek out-of-court resolution through the Czech Trade Inspection Authority (www.coi.cz) or apply to a court with local jurisdiction. Cookie details are in the Cookie policy.',
        de: 'Wir verarbeiten personenbezogene Daten gemäß unserer Datenschutzerklärung. Verbraucher können sich an die Tschechische Handelsinspektion (www.coi.cz) oder an ein örtlich zuständiges Gericht wenden. Cookie-Details stehen in der Cookie-Richtlinie.',
      },
    },
    {
      heading: { cs: '9. Závěrečná ustanovení', en: '9. Final provisions', de: '9. Schlussbestimmungen' },
      body: {
        cs: 'Smlouva se řídí právem České republiky. Tyto podmínky jsou účinné od 11. 11. 2026; změny zveřejníme na této stránce a u objednávek platí znění účinné v okamžiku objednávky. Pokud je některé ustanovení neplatné, ostatní zůstávají v platnosti.',
        en: 'The contract is governed by the law of the Czech Republic. These terms are effective from 11 November 2026; changes are published on this page and the version in force at the time of the order applies. If any provision is invalid, the remaining provisions remain in force.',
        de: 'Der Vertrag unterliegt dem Recht der Tschechischen Republik. Diese Bedingungen gelten ab 11. November 2026; Änderungen werden auf dieser Seite veröffentlicht, und es gilt die zum Zeitpunkt der Bestellung gültige Fassung. Ist eine Bestimmung unwirksam, bleiben die übrigen in Kraft.',
      },
    },
  ],
};

export const PRIVACY: LegalDoc = {
  kicker: { cs: 'Právní informace', en: 'Legal', de: 'Rechtliches' },
  title: { cs: 'Ochrana osobních údajů', en: 'Privacy policy', de: 'Datenschutzerklärung' },
  updated: '2026-11-11',
  note: {
    cs: 'Správcem údajů je Omnity.One s.r.o. Údaje používáme jen k vyřízení objednávky, komunikaci a (se souhlasem) k novinkám. Česká verze je závazná.',
    en: 'The controller is Omnity.One s.r.o. We use data only to process orders, communicate and (with consent) to send news. The Czech version is binding.',
    de: 'Verantwortlicher ist Omnity.One s.r.o. Wir nutzen Daten nur zur Bestellabwicklung, Kommunikation und (mit Einwilligung) für Neuigkeiten. Verbindlich ist die tschechische Fassung.',
  },
  sections: [
    {
      heading: { cs: '1. Správce a kontakt', en: '1. Controller and contact', de: '1. Verantwortlicher und Kontakt' },
      body: {
        cs: 'Omnity.One s.r.o., Horní Čermná 229, 561 56 Horní Čermná, IČO 09120050, zapsaná u Krajského soudu v Hradci Králové, spisová značka C 00215716. Kontakt pro ochranu údajů: ahoj@lumi.zionterranova.com. Nemáme povinně určeného pověřence; na dotazy odpovídáme do jednoho měsíce.',
        en: 'Omnity.One s.r.o., Horní Čermná 229, 561 56 Horní Čermná, Czech Republic, ID 09120050, registered at the Regional Court in Hradec Králové, file no. C 00215716. Data protection contact: ahoj@lumi.zionterranova.com. We have no mandatory data protection officer; we answer requests within one month.',
        de: 'Omnity.One s.r.o., Horní Čermná 229, 561 56 Horní Čermná, Tschechien, ID 09120050, eingetragen beim Regionalgericht Hradec Králové, Aktenzeichen C 00215716. Kontakt für Datenschutz: ahoj@lumi.zionterranova.com. Ein Pflicht-Datenschutzbeauftragter ist nicht bestellt; wir antworten innerhalb eines Monats.',
      },
    },
    {
      heading: { cs: '2. Jaké údaje zpracováváme', en: '2. What data we process', de: '2. Welche Daten wir verarbeiten' },
      body: {
        cs: 'Jméno, e-mail, telefon, fakturační a dodací adresa, výdejní místo, údaje o objednávce, platební stav, komunikace s námi a (u firemních nákupů) název firmy, IČO a DIČ. U zboží se svíčkou také jméno a čas digitálního podpisu bezpečnostního prohlášení. Newsletter: e-mail a jazyk. Bez údajů nutných k objednávce ji nemůžeme vyřídit.',
        en: 'Name, e-mail, phone, billing and shipping address, pickup point, order details, payment status, communication with us and (for company purchases) company name, company ID and VAT ID. For candle products also the name and time of the digital safety signature. Newsletter: e-mail and language. We cannot process an order without the data required for it.',
        de: 'Name, E-Mail, Telefon, Rechnungs- und Lieferadresse, Abholstelle, Bestelldaten, Zahlungsstatus, Kommunikation mit uns und (bei Firmenkäufen) Firmenname, Handelsregisternummer und USt-IdNr. Bei Kerzenprodukten auch Name und Zeitpunkt der digitalen Sicherheitsunterschrift. Newsletter: E-Mail und Sprache. Ohne die für die Bestellung nötigen Daten können wir sie nicht bearbeiten.',
      },
    },
    {
      heading: { cs: '3. Účely a právní základy', en: '3. Purposes and legal bases', de: '3. Zwecke und Rechtsgrundlagen' },
      body: {
        cs: 'Splnění smlouvy (objednávka, platba, doprava, reklamace) — čl. 6 odst. 1 písm. b) GDPR. Právní povinnost (účetnictví, archivace dokladů) — písm. c). Oprávněný zájem (ochrana práv, prevence podvodů, zlepšování webu) — písm. f). Souhlas (odběr novinek) — písm. a); souhlas lze kdykoli odvolat. Cookies: viz dokument Cookies.',
        en: 'Performance of the contract (order, payment, delivery, claims) — Art. 6(1)(b) GDPR. Legal obligation (accounting, record retention) — point (c). Legitimate interest (legal protection, fraud prevention, website improvement) — point (f). Consent (newsletter) — point (a); consent can be withdrawn at any time. Cookies: see the Cookie policy.',
        de: 'Vertragserfüllung (Bestellung, Zahlung, Lieferung, Reklamation) — Art. 6 Abs. 1 lit. b DSGVO. Rechtliche Verpflichtung (Buchhaltung, Aufbewahrung) — lit. c. Berechtigtes Interesse (Rechtsschutz, Betrugsprävention, Verbesserung der Website) — lit. f. Einwilligung (Newsletter) — lit. a; jederzeit widerrufbar. Cookies: siehe Cookie-Richtlinie.',
      },
    },
    {
      heading: { cs: '4. Komu údaje předáváme', en: '4. Who receives the data', de: '4. An wen wir Daten weitergeben' },
      body: {
        cs: 'Přepravce Zásilkovna (doručení), platební poskytovatel Stripe (pouze při platbě kartou), poskytovatel e-mailové infrastruktury, účetní a poskytovatel hostingu. Všichni pracují na základě smlouvy a jen podle našich pokynů. Údaje neprodáváme ani nepředáváme pro reklamu třetích stran.',
        en: 'Carrier Zásilkovna (delivery), payment provider Stripe (card payments only), e-mail infrastructure provider, accountant and hosting provider. All act under contract and on our instructions. We never sell data or share it for third-party advertising.',
        de: 'Versanddienstleister Zásilkovna (Lieferung), Zahlungsdienstleister Stripe (nur Kartenzahlung), E-Mail-Infrastruktur, Buchhaltung und Hosting. Alle handeln auf Vertragsbasis und nach unseren Weisungen. Wir verkaufen keine Daten und geben sie nicht für Werbung Dritter weiter.',
      },
    },
    {
      heading: { cs: '5. Doba uchování', en: '5. Retention', de: '5. Aufbewahrungsdauer' },
      body: {
        cs: 'Účetní doklady a údaje o objednávkách uchováváme 10 let podle zákona o účetnictví. Reklamace a komunikaci po dobu potřebnou k ochraně práv (obvykle 4 roky). Poptávky 2 roky. Newsletter do odhlášení. Technické logy nejvýše 90 dnů, pokud nejsou potřebné pro řešení incidentu.',
        en: 'Accounting records and order data are kept for 10 years under Czech accounting law. Claims and communication for the period needed to protect legal rights (usually 4 years). Enquiries for 2 years. Newsletter until withdrawal. Technical logs for at most 90 days unless needed for an incident.',
        de: 'Buchhaltungsunterlagen und Bestelldaten werden nach tschechischem Bilanzrecht 10 Jahre aufbewahrt. Reklamationen und Kommunikation für den Zeitraum zum Schutz von Rechten (in der Regel 4 Jahre). Anfragen 2 Jahre. Newsletter bis zum Widerruf. Technische Logs höchstens 90 Tage, sofern nicht für einen Vorfall erforderlich.',
      },
    },
    {
      heading: { cs: '6. Předání mimo EU', en: '6. Transfers outside the EU', de: '6. Übermittlung außerhalb der EU' },
      body: {
        cs: 'Data primárně zpracováváme v EU. Stripe může při platbě kartou zpracovat údaje i mimo EU na základě standardních smluvních doložek. Jiné předání mimo EU neprobíhá.',
        en: 'We primarily process data in the EU. For card payments, Stripe may process data outside the EU under standard contractual clauses. No other transfers outside the EU take place.',
        de: 'Wir verarbeiten Daten primär in der EU. Bei Kartenzahlung kann Stripe Daten außerhalb der EU auf Grundlage der Standardvertragsklauseln verarbeiten. Andere Übermittlungen außerhalb der EU finden nicht statt.',
      },
    },
    {
      heading: { cs: '7. Vaše práva', en: '7. Your rights', de: '7. Ihre Rechte' },
      body: {
        cs: 'Máte právo na přístup, opravu, výmaz, omezení zpracování, přenositelnost, vznesení námitky a odvolání souhlasu. Napište na ahoj@lumi.zionterranova.com; odpovíme do jednoho měsíce. Dozorovým orgánem je Úřad pro ochranu osobních údajů (www.uoou.cz).',
        en: 'You have the right to access, rectify, erase, restrict, port, object and withdraw consent. Write to ahoj@lumi.zionterranova.com; we reply within one month. The supervisory authority is the Czech Office for Personal Data Protection (www.uoou.cz).',
        de: 'Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung, Übertragbarkeit, Widerspruch und Widerruf der Einwilligung. Schreiben Sie an ahoj@lumi.zionterranova.com; wir antworten innerhalb eines Monats. Aufsichtsbehörde ist das tschechische Datenschutzamt (www.uoou.cz).',
      },
    },
    {
      heading: { cs: '8. Cookies a automatizované rozhodování', en: '8. Cookies and automated decisions', de: '8. Cookies und automatisierte Entscheidungen' },
      body: {
        cs: 'Používáme jen technické cookies (jazyk, košík, přihlášení); podrobnosti a doby platnosti jsou v dokumentu Cookies. Neprovádíme profilování ani automatizované rozhodování s právními účinky. Fonty načítáme z vlastního serveru, ne z Google Fonts.',
        en: 'We use only technical cookies (language, cart, login); details and durations are in the Cookie policy. We do not profile or make automated decisions with legal effects. Fonts are served from our own server, not Google Fonts.',
        de: 'Wir verwenden nur technische Cookies (Sprache, Warenkorb, Anmeldung); Details und Laufzeiten stehen in der Cookie-Richtlinie. Wir betreiben kein Profiling und keine automatisierten Entscheidungen mit rechtlicher Wirkung. Schriften werden von unserem Server geladen, nicht von Google Fonts.',
      },
    },
    {
      heading: { cs: '9. Zabezpečení a změny', en: '9. Security and changes', de: '9. Sicherheit und Änderungen' },
      body: {
        cs: 'Přístup k údajům je omezen na osoby, které je potřebují; data jsou na serveru v EU, komunikace je šifrovaná (HTTPS). Tyto zásady jsou účinné od 11. 11. 2026. Změny zveřejníme na této stránce.',
        en: 'Access to data is limited to people who need it; data is stored on a server in the EU and communication is encrypted (HTTPS). This policy is effective from 11 November 2026. Changes will be published on this page.',
        de: 'Der Zugriff auf Daten ist auf die Personen beschränkt, die ihn benötigen; die Daten liegen auf einem Server in der EU, die Kommunikation ist verschlüsselt (HTTPS). Diese Richtlinie gilt ab 11. November 2026. Änderungen werden auf dieser Seite veröffentlicht.',
      },
    },
  ],
};

export const CLAIMS: LegalDoc = {
  kicker: { cs: 'Právní informace', en: 'Legal', de: 'Rechtliches' },
  title: { cs: 'Reklamace a vrácení', en: 'Claims and returns', de: 'Reklamation und Rückgabe' },
  updated: '2026-11-11',
  note: {
    cs: 'Reklamaci vyřídíme do 30 dnů. Napište nám na ahoj@lumi.zionterranova.com.',
    en: 'We handle claims within 30 days. Write to ahoj@lumi.zionterranova.com.',
    de: 'Wir bearbeiten Reklamationen innerhalb von 30 Tagen. Schreiben Sie an ahoj@lumi.zionterranova.com.',
  },
  sections: [
    {
      heading: { cs: 'Vadný kus', en: 'A faulty piece', de: 'Ein fehlerhaftes Stück' },
      body: {
        cs: 'Pošlete nám číslo objednávky, popis vady a fotografii. Vadný kus vyměníme, opravíme nebo vrátíme peníze — podle povahy vady a vaší volby.',
        en: 'Send us the order number, a description and a photo. We will replace, repair or refund the faulty piece according to the nature of the defect and your choice.',
        de: 'Senden Sie uns Bestellnummer, Beschreibung und Foto. Wir ersetzen, reparieren oder erstatten das fehlerhafte Stück je nach Art des Mangels und Ihrer Wahl.',
      },
    },
    {
      heading: { cs: 'Vrácení do 14 dnů', en: 'Return within 14 days', de: 'Rückgabe innerhalb von 14 Tagen' },
      body: {
        cs: 'Nepoužité zboží v původním obalu můžete vrátit do 14 dnů od převzetí. Náklady na vrácení nese kupující. Peníze vrátíme do 14 dnů od obdržení zásilky.',
        en: 'Unused goods in the original packaging can be returned within 14 days of receipt. The buyer bears the return cost. We refund within 14 days of receiving the parcel.',
        de: 'Unbenutzte Ware in der Originalverpackung kann innerhalb von 14 Tagen nach Erhalt zurückgegeben werden. Die Rücksendekosten trägt der Käufer. Wir erstatten innerhalb von 14 Tagen nach Eingang.',
      },
    },
    {
      heading: { cs: 'Personalizované zboží', en: 'Personalised goods', de: 'Personalisierte Ware' },
      body: {
        cs: 'Kusy se jmény, datem nebo logem nelze vrátit, pokud nejsou vadné. Před výrobou vám posíláme náhled k odsouhlasení.',
        en: 'Pieces with names, dates or logos cannot be returned unless faulty. We send a proof for approval before production.',
        de: 'Stücke mit Namen, Datum oder Logo können nur bei Mängeln zurückgegeben werden. Vor der Produktion senden wir einen Entwurf zur Freigabe.',
      },
    },
    {
      heading: { cs: 'Kam poslat vrácení', en: 'Where to send a return', de: 'Wohin die Rücksendung' },
      body: {
        cs: 'Omnity.One s.r.o., Horní Čermná 229, 561 56 Horní Čermná. Před odesláním nám napište e-mail s číslem objednávky. Doporučujeme zaslat doporučeně nebo s pojištěním.',
        en: 'Omnity.One s.r.o., Horní Čermná 229, 561 56 Horní Čermná, Czech Republic. E-mail us the order number before sending. We recommend insured or tracked shipping.',
        de: 'Omnity.One s.r.o., Horní Čermná 229, 561 56 Horní Čermná, Tschechien. Senden Sie uns vorab die Bestellnummer per E-Mail. Wir empfehlen versicherten oder verfolgten Versand.',
      },
    },
    {
      heading: { cs: 'Mimosoudní řešení sporu', en: 'Out-of-court dispute resolution', de: 'Außergerichtliche Streitbeilegung' },
      body: {
        cs: 'Spotřebitel může podat návrh na mimosoudní řešení sporu u České obchodní inspekce (www.coi.cz), případně se obrátit na soud příslušný podle místa bydliště. Nejsme povinni se mimosoudního řešení účastnit, ale nabízíme nejprve přímou dohodu.',
        en: 'A consumer may seek out-of-court resolution through the Czech Trade Inspection Authority (www.coi.cz) or apply to a court with local jurisdiction. We are not obliged to participate in out-of-court proceedings, but we offer a direct agreement first.',
        de: 'Verbraucher können sich an die Tschechische Handelsinspektion (www.coi.cz) oder an ein örtlich zuständiges Gericht wenden. Wir sind nicht zur Teilnahme an außergerichtlichen Verfahren verpflichtet, bieten aber zunächst eine direkte Einigung an.',
      },
    },
  ],
};
