/**
 * ZION Explorer — Broadcast Transaction API (V4)
 *
 * Submits a signed transaction to the ZION daemon via RPC.
 * Supports V31 native UTXO JSON, legacy account-model JSON, and raw hex.
 *
 * POST body (JSON):
 *   {
 *     "transaction": { ... },          // signed transaction object
 *     "model": "account" | "utxo"      // optional; auto-detected from shape
 *   }
 *
 * V31 native UTXO transaction format:
 *   {
 *     "version": 1,
 *     "inputs": [
 *       {
 *         "previous_output": [0,1,...],   // 32 bytes of the funding tx hash
 *         "index": 0,
 *         "script": [...]                 // 64-byte signature + 32-byte public key
 *       }
 *     ],
 *     "outputs": [
 *       {
 *         "amount": "100000",             // u128 as decimal string (flowers)
 *         "address": {
 *           "chain": "zion_l1",
 *           "bytes": [],
 *           "encoded": "zion1..."
 *         }
 *       }
 *     ],
 *     "memo": []
 *   }
 *
 * Or raw hex:
 *   {
 *     "raw": "020000..."                // raw transaction hex (0x prefix is stripped)
 *   }
 *
 * Response:
 *   { accepted: boolean, tx_id: string, method: string, model?: string }
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

type BroadcastMethod = 'submitAccountTransaction' | 'submitUtxoTransaction' | 'sendRawTransaction';

interface RpcResult {
  accepted: boolean;
  tx_id?: string;
  model?: string;
}

function strip0x(hex: string): string {
  return hex.replace(/^0x/i, '');
}

function isHex(s: string): boolean {
  return /^[0-9a-fA-F]+$/.test(s);
}

function detectModel(tx: unknown): 'account' | 'utxo' {
  if (typeof tx === 'object' && tx !== null) {
    const obj = tx as Record<string, unknown>;
    if (
      typeof obj.version === 'number' &&
      Array.isArray(obj.inputs) &&
      Array.isArray(obj.outputs)
    ) {
      return 'utxo';
    }
    if (
      typeof obj.from === 'string' &&
      typeof obj.to === 'string' &&
      (typeof obj.signature === 'string' || typeof obj.public_key === 'string')
    ) {
      return 'account';
    }
  }
  // V31-first: default to UTXO when the shape is ambiguous.
  return 'utxo';
}

function resultModel(method: BroadcastMethod, rpcModel?: string): string {
  if (rpcModel) return rpcModel;
  if (method === 'submitUtxoTransaction') return 'v31-native';
  if (method === 'submitAccountTransaction') return 'account';
  return 'raw';
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

  let method: BroadcastMethod;
  let payload: unknown;

  if (body.raw) {
    const hex = strip0x(body.raw);
    if (!isHex(hex)) {
      return NextResponse.json(
        { error: 'Raw transaction must be a valid hex string (0x prefix is allowed but will be stripped)' },
        { status: 400 }
      );
    }
    method = 'sendRawTransaction';
    payload = hex;
  } else if (body.model === 'account') {
    method = 'submitAccountTransaction';
    payload = body.transaction;
  } else if (body.model === 'utxo') {
    method = 'submitUtxoTransaction';
    payload = body.transaction;
  } else {
    // Auto-detect: V31 native UTXO uses { version, inputs, outputs, memo }.
    method = detectModel(body.transaction) === 'account'
      ? 'submitAccountTransaction'
      : 'submitUtxoTransaction';
    payload = body.transaction;
  }

  try {
    const result = (await rpc.submitSignedTransaction(payload, method)) as RpcResult;
    return NextResponse.json({
      accepted: result.accepted,
      tx_id: result.tx_id ?? '',
      method,
      model: resultModel(method, result.model),
    });
  } catch (submitErr) {
    const msg = submitErr instanceof Error ? submitErr.message : 'Unknown error';
    // Node rejection (validation/parse) -> 400; transport failure (timeout/conn) -> 503
    const isClientError = !/timeout|ECONNREFUSED|ECONNRESET|connect|network/i.test(msg);
    return NextResponse.json(
      { error: msg },
      { status: isClientError ? 400 : 503 }
    );
  }
}
