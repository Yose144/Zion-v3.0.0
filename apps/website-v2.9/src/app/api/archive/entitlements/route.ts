import { createHash, timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  grantEntitlement,
  listEntitlements,
  revokeEntitlement,
  type EntitlementType,
} from '@/lib/archive-entitlements';

export const dynamic = 'force-dynamic';

// Admin entitlement issuance for Zion Archive — the plumbing a marketplace
// backend or ops script calls to grant/revoke identity-bound passes.
// Auth: `Authorization: Bearer $ARCHIVE_ADMIN_TOKEN` (env). Disabled
// entirely when the token is not configured.

const TYPES: EntitlementType[] = ['b2b', 'market', 'promo'];

function authorized(req: NextRequest): boolean {
  const token = process.env.ARCHIVE_ADMIN_TOKEN;
  if (!token || token.length < 16) return false;
  const presented = req.headers.get('authorization') ?? '';
  const bearer = presented.startsWith('Bearer ') ? presented.slice(7) : '';
  const a = createHash('sha256').update(bearer).digest();
  const b = createHash('sha256').update(token).digest();
  return timingSafeEqual(a, b);
}

function unauthorized(): NextResponse {
  return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
}

/** List entitlement records (admin). */
export async function GET(req: NextRequest) {
  if (!authorized(req)) return unauthorized();
  return NextResponse.json({ ok: true, records: listEntitlements() });
}

/**
 * Grant an entitlement.
 * Body: { subject: 'zis:<userId>', type?: 'b2b'|'market'|'promo',
 *         org?, note?, expiresAt?: ISO string }
 */
export async function POST(req: NextRequest) {
  if (!authorized(req)) return unauthorized();

  let body: {
    subject?: string;
    type?: string;
    org?: string;
    note?: string;
    expiresAt?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 });
  }

  const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
  if (!subject.startsWith('zis:') || subject.length < 5) {
    return NextResponse.json(
      { ok: false, error: 'subject must be "zis:<userId>"' },
      { status: 422 },
    );
  }
  const type = (body.type ?? 'b2b') as EntitlementType;
  if (!TYPES.includes(type)) {
    return NextResponse.json({ ok: false, error: 'invalid type' }, { status: 422 });
  }
  if (body.expiresAt && Number.isNaN(Date.parse(body.expiresAt))) {
    return NextResponse.json(
      { ok: false, error: 'expiresAt must be an ISO date' },
      { status: 422 },
    );
  }

  const record = grantEntitlement({
    subject,
    type,
    org: body.org?.slice(0, 120),
    note: body.note?.slice(0, 500),
    claimedVia: 'admin',
    expiresAt: body.expiresAt ?? null,
  });
  return NextResponse.json({ ok: true, record }, { status: 201 });
}

/** Revoke an entitlement. Body: { id } */
export async function DELETE(req: NextRequest) {
  if (!authorized(req)) return unauthorized();
  let body: { id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 });
  }
  if (!body.id || !revokeEntitlement(body.id)) {
    return NextResponse.json(
      { ok: false, error: 'not_found_or_revoked' },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true });
}
