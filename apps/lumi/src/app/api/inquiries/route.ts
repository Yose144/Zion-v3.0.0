import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { sendInquiryNotification } from '@/lib/email';

export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TYPES = new Set(['svatba', 'firma', 'kontakt', 'objednavka', 'jine']);

export async function POST(request: NextRequest) {
  const rl = rateLimit(`inquiry:${clientIp(request)}`, 5, 60_000);
  if (!rl.ok) return NextResponse.json({ success: false, error: 'Příliš mnoho pokusů.' }, { status: 429 });

  let body: {
    type?: string;
    name?: string;
    email?: string;
    phone?: string;
    company?: string;
    eventDate?: string;
    quantity?: number;
    message?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Neplatný požadavek.' }, { status: 400 });
  }

  const type = TYPES.has(String(body.type)) ? String(body.type) : 'kontakt';
  const name = String(body.name ?? '').trim();
  const email = String(body.email ?? '').trim().toLowerCase();
  const message = String(body.message ?? '').trim();

  if (name.length < 2 || name.length > 160) {
    return NextResponse.json({ success: false, error: 'Zadejte jméno.' }, { status: 400 });
  }
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json({ success: false, error: 'Neplatný e-mail.' }, { status: 400 });
  }
  if (message.length < 5 || message.length > 4000) {
    return NextResponse.json({ success: false, error: 'Napište prosím zprávu.' }, { status: 400 });
  }

  const quantity = Number.isInteger(Number(body.quantity)) && Number(body.quantity) > 0 ? Number(body.quantity) : null;

  try {
    await prisma.inquiry.create({
      data: {
        type,
        name: name.slice(0, 160),
        email,
        phone: body.phone ? String(body.phone).slice(0, 40) : null,
        company: body.company ? String(body.company).slice(0, 200) : null,
        eventDate: body.eventDate ? String(body.eventDate).slice(0, 20) : null,
        quantity,
        message: message.slice(0, 4000),
      },
    });
    void sendInquiryNotification({
      type,
      name,
      email,
      phone: body.phone ?? null,
      company: body.company ?? null,
      eventDate: body.eventDate ?? null,
      quantity,
      message,
    }).catch((error) => console.error(error));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Inquiry failed:', error);
    return NextResponse.json({ success: false, error: 'Poptávku se nepodařilo uložit.' }, { status: 500 });
  }
}
