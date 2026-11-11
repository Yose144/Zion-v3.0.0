import type { Localized } from '@/lib/i18n';

/** Společné popisky UI (tlačítka, formuláře, košík). */
export const UI = {
  menu: { cs: 'Menu', en: 'Menu', de: 'Menü' },
  close: { cs: 'Zavřít', en: 'Close', de: 'Schließen' },
  cart: { cs: 'Košík', en: 'Cart', de: 'Warenkorb' },
  cartEmpty: { cs: 'Košík je prázdný', en: 'Your cart is empty', de: 'Ihr Warenkorb ist leer' },
  cartEmptyText: {
    cs: 'Vyberte si lampion a začneme.',
    en: 'Choose a lantern and let’s begin.',
    de: 'Wählen Sie eine Laterne und los geht’s.',
  },
  continueShopping: { cs: 'Pokračovat v nákupu', en: 'Continue shopping', de: 'Weiter einkaufen' },
  addToCart: { cs: 'Přidat do košíku', en: 'Add to cart', de: 'In den Warenkorb' },
  added: { cs: 'Přidáno do košíku', en: 'Added to cart', de: 'Zum Warenkorb hinzugefügt' },
  buyNow: { cs: 'Koupit', en: 'Buy', de: 'Kaufen' },
  quantity: { cs: 'Množství', en: 'Quantity', de: 'Menge' },
  remove: { cs: 'Odebrat', en: 'Remove', de: 'Entfernen' },
  subtotal: { cs: 'Mezisoučet', en: 'Subtotal', de: 'Zwischensumme' },
  shipping: { cs: 'Doprava', en: 'Shipping', de: 'Versand' },
  cod: { cs: 'Dobírka', en: 'Cash on delivery', de: 'Nachnahme' },
  total: { cs: 'Celkem', en: 'Total', de: 'Gesamt' },
  free: { cs: 'Zdarma', en: 'Free', de: 'Kostenlos' },
  freeShippingFrom: {
    cs: 'Doprava zdarma od 1 500 Kč',
    en: 'Free shipping from CZK 1,500',
    de: 'Versandkostenfrei ab 1.500 CZK',
  },
  checkout: { cs: 'Dokončit objednávku', en: 'Complete order', de: 'Bestellung abschließen' },
  submitting: { cs: 'Odesílám…', en: 'Sending…', de: 'Wird gesendet…' },
  orderError: {
    cs: 'Objednávku se nepodařilo odeslat. Zkuste to prosím znovu.',
    en: 'The order could not be sent. Please try again.',
    de: 'Die Bestellung konnte nicht gesendet werden. Bitte erneut versuchen.',
  },
  fieldRequired: {
    cs: 'Vyplňte prosím povinná pole.',
    en: 'Please fill in the required fields.',
    de: 'Bitte füllen Sie die Pflichtfelder aus.',
  },
  inStock: { cs: 'Skladem', en: 'In stock', de: 'Auf Lager' },
  outOfStock: { cs: 'Vyprodáno', en: 'Sold out', de: 'Ausverkauft' },
  madeToOrder: { cs: 'Na zakázku', en: 'Made to order', de: 'Auf Bestellung' },
  includes: { cs: 'V balení', en: 'In the box', de: 'In der Box' },
  specs: { cs: 'Parametry', en: 'Details', de: 'Details' },
  leadTime: { cs: 'Dodání', en: 'Delivery', de: 'Lieferung' },
  related: { cs: 'Mohlo by se hodit', en: 'You may also like', de: 'Das könnte auch passen' },
  from: { cs: 'od', en: 'from', de: 'ab' },
  loading: { cs: 'Načítám…', en: 'Loading…', de: 'Wird geladen…' },
  error: { cs: 'Něco se pokazilo.', en: 'Something went wrong.', de: 'Etwas ist schiefgelaufen.' },
  send: { cs: 'Odeslat', en: 'Send', de: 'Senden' },
  sending: { cs: 'Odesílám…', en: 'Sending…', de: 'Wird gesendet…' },
  sent: { cs: 'Odesláno', en: 'Sent', de: 'Gesendet' },
  optional: { cs: 'nepovinné', en: 'optional', de: 'optional' },
  back: { cs: 'Zpět', en: 'Back', de: 'Zurück' },
  readMore: { cs: 'Číst dál', en: 'Read more', de: 'Weiterlesen' },
  all: { cs: 'Vše', en: 'All', de: 'Alle' },
  // ── Pokladna ──────────────────────────────────────────────────────
  form: {
    name: { cs: 'Jméno a příjmení', en: 'Full name', de: 'Vor- und Nachname' },
    email: { cs: 'E-mail', en: 'E-mail', de: 'E-Mail' },
    phone: { cs: 'Telefon', en: 'Phone', de: 'Telefon' },
    street: { cs: 'Ulice a číslo', en: 'Street and number', de: 'Straße und Hausnummer' },
    city: { cs: 'Město', en: 'City', de: 'Stadt' },
    zip: { cs: 'PSČ', en: 'Postal code', de: 'Postleitzahl' },
    pickupPoint: {
      cs: 'Zadejte výdejní místo Zásilkovny (např. Z-Box Náměstí)',
      en: 'Enter your Zásilkovna pickup point (e.g. Z-Box Náměstí)',
      de: 'Zásilkovna-Abholstelle eingeben (z. B. Z-Box Náměstí)',
    },
    note: { cs: 'Poznámka k objednávce', en: 'Order note', de: 'Bestellnotiz' },
    companyToggle: { cs: 'Nakupuji na firmu', en: 'Buying for a company', de: 'Ich kaufe für eine Firma' },
    companyName: { cs: 'Název firmy', en: 'Company name', de: 'Firmenname' },
    ico: { cs: 'IČO', en: 'Company ID', de: 'Handelsregisternummer' },
    dic: { cs: 'DIČ', en: 'VAT ID', de: 'USt-IdNr.' },
    newsletter: {
      cs: 'Chci dostávat novinky Lumi (jeden e-mail za sezónu).',
      en: 'Send me Lumi news (one e-mail per season).',
      de: 'Ich möchte Lumi-Neuigkeiten erhalten (eine E-Mail pro Saison).',
    },
    terms: {
      cs: 'Souhlasím s obchodními podmínkami a beru na vědomí zpracování osobních údajů.',
      en: 'I agree to the terms and acknowledge the processing of my personal data.',
      de: 'Ich stimme den AGB zu und nehme die Verarbeitung meiner Daten zur Kenntnis.',
    },
  },
  sections: {
    shipping: { cs: 'Doprava', en: 'Shipping', de: 'Versand' },
    customer: { cs: 'Kontaktní údaje', en: 'Contact details', de: 'Kontaktdaten' },
    address: { cs: 'Adresa', en: 'Address', de: 'Adresse' },
    payment: { cs: 'Platba', en: 'Payment', de: 'Zahlung' },
    summary: { cs: 'Souhrn', en: 'Summary', de: 'Übersicht' },
  },
  payment: {
    transferDesc: {
      cs: 'Pošleme QR kód a číslo účtu. Odesíláme po připsání platby.',
      en: 'We send a QR code and bank details. We ship once the payment arrives.',
      de: 'Sie erhalten QR-Code und Bankdaten. Versand nach Zahlungseingang.',
    },
    cardDesc: {
      cs: 'Zaplatíte kartou přes Stripe. Bezpečně, bez ukládání čísla karty u nás.',
      en: 'Pay by card via Stripe. Secure, and we never store your card number.',
      de: 'Kartenzahlung über Stripe. Sicher, ohne dass wir Ihre Kartennummer speichern.',
    },
    codDesc: {
      cs: 'Zaplatíte při převzetí. Příplatek za dobírku.',
      en: 'Pay on delivery. A cash-on-delivery fee applies.',
      de: 'Zahlung bei Lieferung. Es fällt eine Nachnahmegebühr an.',
    },
    cardUnavailable: { cs: 'Platba kartou zatím není dostupná.', en: 'Card payment is not available yet.', de: 'Kartenzahlung ist noch nicht verfügbar.' },
  },
  confirmation: {
    title: { cs: 'Děkujeme za objednávku', en: 'Thank you for your order', de: 'Danke für Ihre Bestellung' },
    orderNumber: { cs: 'Číslo objednávky', en: 'Order number', de: 'Bestellnummer' },
    instructions: {
      cs: 'Objednávku jsme přijali. Potvrzení jsme poslali na e-mail.',
      en: 'We have received your order. A confirmation has been sent to your e-mail.',
      de: 'Wir haben Ihre Bestellung erhalten. Eine Bestätigung wurde per E-Mail gesendet.',
    },
    payTitle: { cs: 'Zaplaťte převodem', en: 'Pay by bank transfer', de: 'Per Überweisung bezahlen' },
    payText: {
      cs: 'Naskenujte QR kód v aplikaci vaší banky, nebo použijte údaje níže. Jako variabilní symbol použijte číslo objednávky.',
      en: 'Scan the QR code in your banking app or use the details below. Use the order number as the payment reference.',
      de: 'Scannen Sie den QR-Code in Ihrer Banking-App oder nutzen Sie die Angaben unten. Verwenden Sie die Bestellnummer als Verwendungszweck.',
    },
    account: { cs: 'Číslo účtu', en: 'Account number', de: 'Kontonummer' },
    iban: { cs: 'IBAN', en: 'IBAN', de: 'IBAN' },
    vs: { cs: 'Variabilní symbol', en: 'Payment reference', de: 'Verwendungszweck' },
    amount: { cs: 'Částka', en: 'Amount', de: 'Betrag' },
    waiting: {
      cs: 'Stav objednávky se aktualizuje automaticky.',
      en: 'The order status updates automatically.',
      de: 'Der Bestellstatus wird automatisch aktualisiert.',
    },
    trackTitle: { cs: 'Sledování objednávky', en: 'Track your order', de: 'Bestellung verfolgen' },
    trackHint: {
      cs: 'Zadejte e-mail, kterým jste objednávali.',
      en: 'Enter the e-mail you used for the order.',
      de: 'Geben Sie die E-Mail-Adresse der Bestellung ein.',
    },
    invoice: { cs: 'Zobrazit fakturu', en: 'View invoice', de: 'Rechnung ansehen' },
    notFound: { cs: 'Objednávka nenalezena.', en: 'Order not found.', de: 'Bestellung nicht gefunden.' },
  },
} as const satisfies Record<string, unknown>;

export type UiDict = typeof UI;

/** Pomocník pro camelCase klíče z `UI` v komponentách. */
export function t<K extends keyof UiDict>(key: K, lang: import('@/lib/i18n').Lang): string {
  const value = UI[key] as unknown as Localized | string;
  if (typeof value === 'string') return value;
  return value[lang] || value.cs;
}
