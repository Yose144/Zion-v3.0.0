export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { getBridgeTransactionsResponse } from '@/lib/bridge/helpers';

export async function GET(request: NextRequest) {
  return getBridgeTransactionsResponse(request.nextUrl);
}
