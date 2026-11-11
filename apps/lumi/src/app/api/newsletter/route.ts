import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { sendNewsletterWelcome } from '@/lib/email';

export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  const rl = rateLimit(`news:${clientIp(request)}`, 6, 60_000);
  if (!rl.ok) return NextResponse.json({ success: false, error: 'Příliš mnoho pokusů.' }, { status: 429 });

  let body: { email?: string; lang?: string; source?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Neplatný požadavek.' }, { status: 400 });
  }

  const email = String(body.email ?? '').trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json({ success: false, error: 'Neplatný e-mail.' }, { status: 400 });
  }
  const lang = body.lang === 'en' || body.lang === 'de' ? body.lang : 'cs';
  const source = String(body.source ?? 'web').slice(0, 40);

  try {
    const existing = await prisma.subscriber.findUnique({ where: { email } });
    if (!existing) {
      await prisma.subscriber.create({ data: { email, lang, source } });
      void sendNewsletterWelcome(email, lang).catch((error) => console.error(error));
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Newsletter failed:', error);
    return NextResponse.json({ success: false, error: 'Přihlášení se nepodařilo.' }, { status: 500 });
  }
}
