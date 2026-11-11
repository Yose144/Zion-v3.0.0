import type { OrderLike, StoredOrderItem } from '@/lib/order-types';
import { parseJson } from '@/lib/utils';
import type { Localized } from '@/lib/i18n';
import type { Order } from '@/generated/prisma';

export function itemsOf(order: Pick<OrderLike, 'items'>): StoredOrderItem[] {
  return Array.isArray(order.items) ? order.items : [];
}

export function parseItems(value: string | null | undefined): StoredOrderItem[] {
  const parsed = parseJson<StoredOrderItem[]>(value, []);
  return Array.isArray(parsed) ? parsed : [];
}

/** Veřejná podoba objednávky — bez interních sloupců a bez podpisu. */
export function publicOrder(order: {
  orderId: string;
  status: string;
  paymentStatus: string;
  payment: string;
  shipping: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  addressStreet: string | null;
  addressCity: string | null;
  addressZip: string | null;
  pickupPoint: string | null;
  note: string | null;
  items: string;
  subtotalCzk: number;
  shippingCzk: number;
  codCzk: number;
  totalCzk: number;
  variableSymbol: string | null;
  invoiceNumber: string | null;
  trackingNumber: string | null;
  createdAt: Date;
  paidAt: Date | null;
  shippedAt: Date | null;
}) {
  return {
    orderId: order.orderId,
    status: order.status,
    paymentStatus: order.paymentStatus,
    payment: order.payment,
    shipping: order.shipping,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    customerPhone: order.customerPhone,
    address: order.addressStreet
      ? { street: order.addressStreet, city: order.addressCity, zip: order.addressZip }
      : null,
    pickupPoint: order.pickupPoint,
    note: order.note,
    items: parseItems(order.items),
    subtotalCzk: order.subtotalCzk,
    shippingCzk: order.shippingCzk,
    codCzk: order.codCzk,
    totalCzk: order.totalCzk,
    variableSymbol: order.variableSymbol,
    invoiceNumber: order.invoiceNumber,
    trackingNumber: order.trackingNumber,
    createdAt: order.createdAt,
    paidAt: order.paidAt,
    shippedAt: order.shippedAt,
  };
}

/** Název produktu pro e-mail/fakturu v daném jazyce. */
export function itemName(item: StoredOrderItem, lang: keyof Localized = 'cs'): string {
  return item.name?.[lang] || item.name?.cs || item.externalId;
}

/** DB řádek → tvar, se kterým pracuje e-mail a faktura. */
export function orderToLike(order: Order): OrderLike {
  return {
    orderId: order.orderId,
    invoiceNumber: order.invoiceNumber,
    createdAt: order.createdAt,
    paidAt: order.paidAt,
    status: order.status,
    paymentStatus: order.paymentStatus,
    payment: order.payment,
    shipping: order.shipping,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    customerPhone: order.customerPhone,
    addressStreet: order.addressStreet,
    addressCity: order.addressCity,
    addressZip: order.addressZip,
    pickupPoint: order.pickupPoint,
    note: order.note,
    companyName: order.companyName,
    buyerIco: order.buyerIco,
    buyerDic: order.buyerDic,
    subtotalCzk: order.subtotalCzk,
    shippingCzk: order.shippingCzk,
    codCzk: order.codCzk,
    totalCzk: order.totalCzk,
    variableSymbol: order.variableSymbol,
    items: parseItems(order.items),
    lang: order.lang,
    trackingNumber: order.trackingNumber,
  };
}
