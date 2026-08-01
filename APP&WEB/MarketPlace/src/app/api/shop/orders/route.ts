import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import QRCode from 'qrcode';
import type { ShopOrderInput } from '@/types/shop';

const BANK_ACCOUNT = 'CZ680600000000259251079';
const BANK_BIC = 'AGBACZPP';

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

    return NextResponse.json({
      success: true,
      data: {
        order,
        bank: {
          account: '259251079/0600',
          iban: 'CZ68 0600 0000 0002 5925 1079',
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
