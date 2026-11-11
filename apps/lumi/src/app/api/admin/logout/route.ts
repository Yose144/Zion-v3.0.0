import { NextResponse } from 'next/server';
import { clearSessionCookie } from '@/lib/admin';

export const dynamic = 'force-dynamic';

export async function POST() {
  return clearSessionCookie(NextResponse.json({ success: true }));
}
