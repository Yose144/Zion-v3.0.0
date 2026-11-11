import type { Lang, Localized } from '@/lib/i18n';

export type ShippingMethod = 'zasilkovna' | 'zasilkovna-home' | 'osobni-odber';
export type PaymentMethod = 'transfer' | 'card' | 'cod';

export interface ShippingOption {
  value: ShippingMethod;
  label: Localized;
  hint: Localized;
  priceCzk: number;
  /** Vyžaduje adresu / výdejní místo. */
  needsAddress?: boolean;
  needsPickup?: boolean;
}

export const SHIPPING_OPTIONS: ShippingOption[] = [
  {
    value: 'zasilkovna',
    label: { cs: 'Zásilkovna — výdejní místo', en: 'Zásilkovna pickup point', de: 'Zásilkovna Abholstelle' },
    hint: {
      cs: 'Vyzvednete v nejbližším Z-boxu nebo na pobočce. Doručení 1–2 dny.',
      en: 'Collect at a nearby pickup point. Delivery in 1–2 days.',
      de: 'Abholung an der nächsten Abholstelle. Lieferung in 1–2 Tagen.',
    },
    priceCzk: 79,
    needsPickup: true,
  },
  {
    value: 'zasilkovna-home',
    label: { cs: 'Zásilkovna — na adresu', en: 'Zásilkovna to your address', de: 'Zásilkovna an Ihre Adresse' },
    hint: {
      cs: 'Kurýr doručí na adresu, obvykle do 24–48 hodin.',
      en: 'Courier delivery to your address, usually within 24–48 hours.',
      de: 'Kurierlieferung an Ihre Adresse, meist in 24–48 Stunden.',
    },
    priceCzk: 99,
    needsAddress: true,
  },
  {
    value: 'osobni-odber',
    label: { cs: 'Osobní odběr', en: 'Personal pickup', de: 'Persönliche Abholung' },
    hint: {
      cs: 'Termín a místo předání potvrdíme e-mailem.',
      en: 'We confirm the time and place by e-mail.',
      de: 'Termin und Übergabeort bestätigen wir per E-Mail.',
    },
    priceCzk: 0,
  },
];

export function shippingOption(method: string): ShippingOption | undefined {
  return SHIPPING_OPTIONS.find((option) => option.value === method);
}

export const FREE_SHIPPING_FROM = Number(process.env.LUMI_FREE_SHIPPING_FROM ?? 1500) || 0;
export const COD_FEE_CZK = Number(process.env.LUMI_COD_FEE_CZK ?? 45) || 0;

export function shippingPriceFor(method: ShippingMethod, subtotalCzk: number): number {
  const option = shippingOption(method);
  if (!option) return 0;
  if (
    FREE_SHIPPING_FROM > 0 &&
    subtotalCzk >= FREE_SHIPPING_FROM &&
    (method === 'zasilkovna' || method === 'zasilkovna-home')
  ) {
    return 0;
  }
  return option.priceCzk;
}

export const PAYMENT_LABEL: Record<PaymentMethod, Localized> = {
  transfer: { cs: 'Bankovní převod', en: 'Bank transfer', de: 'Banküberweisung' },
  card: { cs: 'Platba kartou', en: 'Card payment', de: 'Kartenzahlung' },
  cod: { cs: 'Dobírka', en: 'Cash on delivery', de: 'Nachnahme' },
};

export const ORDER_STATUS_LABEL: Record<string, Localized> = {
  pending: { cs: 'Čeká na platbu', en: 'Awaiting payment', de: 'Wartet auf Zahlung' },
  paid: { cs: 'Zaplaceno', en: 'Paid', de: 'Bezahlt' },
  processing: { cs: 'Ve výrobě', en: 'In production', de: 'In Produktion' },
  shipped: { cs: 'Odesláno', en: 'Shipped', de: 'Versendet' },
  completed: { cs: 'Dokončeno', en: 'Completed', de: 'Abgeschlossen' },
  cancelled: { cs: 'Zrušeno', en: 'Cancelled', de: 'Storniert' },
};

export function statusLabel(status: string, lang: Lang): string {
  return ORDER_STATUS_LABEL[status]?.[lang] ?? status;
}
