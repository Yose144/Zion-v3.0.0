import type { Localized } from '@/lib/i18n';

export interface StoredOrderItem {
  externalId: string;
  slug: string;
  name: Localized;
  quantity: number;
  unitPriceCzk: number;
  lineTotalCzk: number;
}

export interface OrderLike {
  orderId: string;
  invoiceNumber: string | null;
  createdAt: Date;
  paidAt: Date | null;
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
  note?: string | null;
  companyName: string | null;
  buyerIco: string | null;
  buyerDic: string | null;
  subtotalCzk: number;
  shippingCzk: number;
  codCzk: number;
  totalCzk: number;
  variableSymbol: string | null;
  items: StoredOrderItem[];
  lang?: string;
  trackingNumber?: string | null;
}
