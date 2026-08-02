import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import QRCode from 'qrcode';
import type { ShopOrderInput } from '@/types/shop';
import { sendAdminOrderNotification, sendCustomerOrderConfirmation } from '@/lib/email';
import { createInvoiceForOrder } from '@/lib/invoice';

const BANK_ACCOUNT = 'CZ6320100000002901809148';
const BANK_BIC = 'FIOBCZPPXXX';

// POST /api/shop/orders — create order and return bank transfer QR
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ShopOrderInput;

    if (!body.orderId || !body.customer?.name || !body.customer?.email || !body.customer?.phone) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!body.termsAccepted) {
      return NextResponse.json(
        { success: false, error: 'Terms must be accepted' },
        { status: 400 }
      );
    }

    const order = await prisma.shopOrder.create({
      data: {
        orderId: body.orderId,
        status: 'pending',
        customerName: body.customer.name,
        customerEmail: body.customer.email,
        customerPhone: body.customer.phone,
        shipping: body.shipping.method,
        payment: body.payment,
        addressStreet: body.customer.address?.street ?? null,
        addressCity: body.customer.address?.city ?? null,
        addressZip: body.customer.address?.zip ?? null,
        pickupPoint: (body.shipping.pickupPoint as Prisma.InputJsonValue | undefined) ?? Prisma.JsonNull,
        note: body.note ?? null,
        totalCzk: body.total,
        shippingCzk: body.shipping.price,
        items: body.items as unknown as never,
        zionTokens: body.zionTokens,
        termsAccepted: body.termsAccepted,
        newsletter: body.customer.newsletter ?? false,
      },
    });

    const vs = body.orderId.match(/(\d{10})/)?.[1] ?? body.orderId.replace(/\D/g, '').slice(0, 10);
    const qrData = `SPD*1.0*ACC:${BANK_ACCOUNT}*AM:${body.total}.00*CC:CZK*MSG:Objednavka ${body.orderId}*X-VS:${vs}`;
    const qrSvg = await QRCode.toString(qrData, { type: 'svg', margin: 2, width: 280 });
    const qrCode = `data:image/svg+xml;base64,${Buffer.from(qrSvg).toString('base64')}`;

    const invoiceResult = await createInvoiceForOrder({
      orderId: order.orderId,
      orderDatabaseId: order.id,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      customerPhone: order.customerPhone,
      customerAddress: body.customer.address
        ? {
            street: body.customer.address.street,
            city: body.customer.address.city,
            zip: body.customer.address.zip,
          }
        : null,
      payment: order.payment,
      totalCzk: order.totalCzk,
      shippingCzk: order.shippingCzk,
      items: order.items,
    }).catch((err) => {
      console.error('Invoice auto-generation failed:', err);
      return null;
    });

    const emailData = {
      orderId: order.orderId,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      customerPhone: order.customerPhone,
      shipping: order.shipping,
      payment: order.payment,
      totalCzk: order.totalCzk,
      shippingCzk: order.shippingCzk,
      items: order.items,
      addressStreet: order.addressStreet,
      addressCity: order.addressCity,
      addressZip: order.addressZip,
      pickupPoint: order.pickupPoint,
      note: order.note,
      zionTokens: order.zionTokens,
      trackingNumber: order.trackingNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
    };

    // Send notifications in background; don't block the response
    sendAdminOrderNotification(emailData).catch(console.error);
    sendCustomerOrderConfirmation(emailData).catch(console.error);

    return NextResponse.json({
      success: true,
      data: {
        order,
        invoice: invoiceResult?.invoice ?? null,
        bank: {
          account: '2901809148 / 2010',
          iban: 'CZ63 2010 0000 0029 0180 9148',
          bic: BANK_BIC,
          vs,
          amount: body.total,
          qrCode,
        },
      },
    });
  } catch (error) {
    console.error('Failed to create shop order:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create order' },
      { status: 500 }
    );
  }
}
