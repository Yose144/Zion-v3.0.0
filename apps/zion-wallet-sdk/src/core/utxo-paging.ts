/**
 * Paged UTXO collection for sends.
 *
 * `getUtxos` without a limit returns the whole set. A payout wallet holds
 * tens of thousands of outputs, so send walks pages and stops once the
 * largest `inputCap` outputs cover the amount plus fee.
 */

import { estimateTxSize, minimumFeeForSize } from './transaction.js';

export const UTXO_PAGE_SIZE = 2000;
export const UTXO_MAX_PAGES = 80;

export function amountToFlowers(amount: unknown): bigint {
  if (typeof amount === 'bigint') return amount;
  const raw = String(amount ?? '0').trim();
  if (/^\d+$/.test(raw)) return BigInt(raw);
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 0n;
  return BigInt(Math.trunc(n));
}

/**
 * Collect address-scoped UTXO pages until the largest `inputCap` outputs
 * cover `amountFlowers` plus the fee bound, or the set is exhausted.
 */
export class UtxoCollector {
  private collected = new Map<string, Record<string, unknown>>();
  private topAmounts: bigint[] = [];
  private topSum = 0n;
  private seen = 0;
  private totalCount = 0;

  constructor(
    private readonly address: string,
    private readonly amountFlowers: bigint,
    private readonly inputCap: number,
    private readonly pageSize: number = UTXO_PAGE_SIZE,
  ) {}

  addPage(utxos: Array<Record<string, unknown>>, totalCount: number): { covered: boolean; exhausted: boolean } {
    if (totalCount > 0) this.totalCount = totalCount;
    for (const raw of utxos) {
      const txHash = String(raw.tx_hash ?? raw.txid ?? '');
      const outputIndex = Number(raw.output_index ?? raw.vout ?? 0);
      if (!txHash) continue;
      const key = `${txHash}:${outputIndex}`;
      if (this.collected.has(key)) continue;
      const row: Record<string, unknown> = {
        ...raw,
        tx_hash: txHash,
        output_index: outputIndex,
        address: raw.address ?? this.address,
      };
      this.collected.set(key, row);
      this.pushTop(amountToFlowers(raw.amount));
    }
    this.seen += utxos.length;

    const n = Math.min(this.inputCap, this.collected.size);
    const feeBound = n > 0 ? minimumFeeForSize(estimateTxSize(n, 2)) : 0n;
    const covered = n > 0 && this.topSum >= this.amountFlowers + feeBound;
    const exhausted =
      utxos.length === 0 ||
      utxos.length < this.pageSize ||
      (this.totalCount > 0 && this.seen >= this.totalCount);
    return { covered, exhausted };
  }

  list(): Array<Record<string, unknown>> {
    return [...this.collected.values()];
  }

  private pushTop(value: bigint): void {
    if (value <= 0n) return;
    const cap = Math.max(1, this.inputCap);
    if (this.topAmounts.length === cap && value <= this.topAmounts[this.topAmounts.length - 1]) return;
    let lo = 0;
    let hi = this.topAmounts.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.topAmounts[mid] >= value) lo = mid + 1;
      else hi = mid;
    }
    const evicted = this.topAmounts.length === cap ? this.topAmounts[cap - 1] : 0n;
    this.topAmounts.splice(lo, 0, value);
    if (this.topAmounts.length > cap) this.topAmounts.pop();
    this.topSum += value - evicted;
  }
}
