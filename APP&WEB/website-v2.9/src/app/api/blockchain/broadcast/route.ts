/**
 * ZION Explorer — Broadcast Transaction API (V4)
 *
 * Submits a signed transaction to the ZION daemon via RPC.
 * Supports both account-model and UTXO-model transactions.
 *
 * POST body (JSON):
 *   {
 *     "transaction": { ... },          // signed transaction object
 *     "model": "account" | "utxo"      // optional, defaults to auto-detect
 *   }
 *
 * Or raw hex:
 *   {
 *     "raw": "020000...",               // raw transaction hex
 *   }
 *
 * Response:
 *   { accepted: boolean, tx_id: string }
 *   or { error: string }
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getZionRpc } from '@/lib/zion-rpc';

interface BroadcastBody {
  transaction?: unknown;
  raw?: string;
  model?: 'account' | 'utxo';
}

export async function POST(request: NextRequest) {
  const rpc = getZionRpc();

  let body: BroadcastBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.transaction && !body.raw) {
    return NextResponse.json(
      { error: 'Request body must contain "transaction" (object) or "raw" (hex string)' },
      { status: 400 }
    );
  }

  // Determine submission method based on model
  // - submitAccountTransaction: for account-model TXs (from/to/amount/nonce/signature)
  // - submitUtxoTransaction: for UTXO-model TXs (vin/vout)
  // - sendRawTransaction: for raw hex
  let method: 'submitAccountTransaction' | 'submitUtxoTransaction' | 'sendRawTransaction';
  let payload: unknown;

  if (body.raw) {
    // Raw hex submission
    if (!/^[0-9a-fA-F]+$/.test(body.raw)) {
      return NextResponse.json({ error: 'Raw transaction must be valid hex string' }, { status: 400 });
    }
    method = 'sendRawTransaction';
    payload = body.raw;
  } else if (body.model === 'account') {
    method = 'submitAccountTransaction';
    payload = body.transaction;
  } else if (body.model === 'utxo') {
    method = 'submitUtxoTransaction';
    payload = body.transaction;
  } else {
    // Auto-detect: try account first, fall back to UTXO if the node rejects it
    try {
      const result = await rpc.submitSignedTransaction(body.transaction, 'submitAccountTransaction');
      return NextResponse.json({
        accepted: result.accepted,
        tx_id: result.tx_id ?? '',
        method: 'submitAccountTransaction',
      });
    } catch (accountErr) {
      // Fall back to UTXO submission
      try {
        const result = await rpc.submitSignedTransaction(body.transaction, 'submitUtxoTransaction');
        return NextResponse.json({
          accepted: result.accepted,
          tx_id: result.tx_id ?? '',
          method: 'submitUtxoTransaction',
        });
      } catch (utxoErr) {
        const msg = utxoErr instanceof Error ? utxoErr.message : 'Unknown error';
        return NextResponse.json(
          { error: `Transaction rejected by both account and UTXO submission: ${msg}` },
          { status: 400 }
        );
      }
    }
  }

  // Direct submission for explicit model / raw
  try {
    const result = await rpc.submitSignedTransaction(payload, method);
    return NextResponse.json({
      accepted: result.accepted,
      tx_id: result.tx_id ?? '',
      method,
    });
  } catch (submitErr) {
    const msg = submitErr instanceof Error ? submitErr.message : 'Unknown error';
    // Node rejection (validation/parse) → 400; transport failure (timeout/conn) → 503
    const isClientError = !/timeout|ECONNREFUSED|ECONNRESET|connect|network/i.test(msg);
    return NextResponse.json(
      { error: msg },
      { status: isClientError ? 400 : 503 }
    );
  }
}
