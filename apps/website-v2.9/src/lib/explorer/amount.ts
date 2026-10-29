/**
 * ZION Explorer — net-of-change amount helpers
 *
 * UTXO transfers spend whole inputs and send the leftover back to the sender
 * as change. Reporting the raw output sum as "amount" therefore overstates the
 * real payment (pool payouts showed ~430k ZION for a ~4.7k payment). These
 * helpers compute the net amount = outputs not returning to a sender address.
 */

export interface AmountTxLike {
  inputs?: Array<{ address?: string }> | null;
  outputs?: Array<{ address?: string; amount?: number | string }> | null;
}

/** Set of distinct sender addresses resolved on the tx inputs. */
export function senderAddressSet(tx: AmountTxLike): Set<string> {
  const set = new Set<string>();
  for (const input of tx.inputs ?? []) {
    const addr = input?.address;
    if (typeof addr === 'string' && addr.startsWith('zion1')) {
      set.add(addr);
    }
  }
  return set;
}

function outputAmount(o: { amount?: number | string } | null | undefined): number {
  const n = Number(o?.amount ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/** Sum (atomic units) of outputs paying to any sender address — the change. */
export function changeAmountAtomic(tx: AmountTxLike, senders?: Set<string>): number {
  const senderSet = senders ?? senderAddressSet(tx);
  if (senderSet.size === 0) return 0;
  let sum = 0;
  for (const out of tx.outputs ?? []) {
    const addr = out?.address;
    if (typeof addr === 'string' && senderSet.has(addr)) {
      sum += outputAmount(out);
    }
  }
  return sum;
}

export function totalOutputAtomic(tx: AmountTxLike): number {
  let sum = 0;
  for (const out of tx.outputs ?? []) {
    sum += outputAmount(out);
  }
  return sum;
}

/**
 * Net transferred amount in atomic units: all outputs minus change returned to
 * the sender(s). Coinbase (no inputs) and txs whose sender can't be resolved
 * return the gross output sum.
 */
export function netAmountAtomic(tx: AmountTxLike): number {
  return totalOutputAtomic(tx) - changeAmountAtomic(tx);
}

/** Mark each output as change when it pays back to a sender address. */
export function markChangeOutputs<T extends { address?: string; amount?: number | string }>(
  outputs: T[],
  senders?: Set<string>,
): Array<T & { is_change: boolean }> {
  const senderSet = senders ?? new Set<string>();
  return (outputs ?? []).map((o) => ({
    ...o,
    is_change: typeof o?.address === 'string' && senderSet.has(o.address),
  }));
}
