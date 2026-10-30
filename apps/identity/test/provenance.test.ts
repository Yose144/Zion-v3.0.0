// Tests for link provenance flagging (audit 3.B3 — QTU/PRL address
// squatting). Quantus/pearl links are attestation-only: they prove the
// attesting ZION key, not external-key ownership, so they must be
// emitted as `proven:false` until an external-chain proof exists.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { linkProven, withLinkProvenance } from '../src/lib/provenance.js';

test('self-signed chains are proven', () => {
  for (const chainType of ['zion-l1', 'evm', 'bitcoin', 'solana', 'google']) {
    assert.equal(linkProven(chainType), true, chainType);
  }
});

test('attestation-only chains are unproven', () => {
  assert.equal(linkProven('quantus'), false);
  assert.equal(linkProven('pearl'), false);
});

test('withLinkProvenance annotates every row and preserves fields', () => {
  const rows = [
    { id: 'l1', address: 'zion1abc', chainType: 'zion-l1' },
    { id: 'l2', address: 'qz9victim', chainType: 'quantus' },
    { id: 'l3', address: 'prl1victim', chainType: 'pearl' },
    { id: 'l4', address: '0xdead', chainType: 'evm' },
  ];
  const out = withLinkProvenance(rows);
  assert.deepEqual(
    out.map((r) => ({ address: r.address, proven: r.proven })),
    [
      { address: 'zion1abc', proven: true },
      { address: 'qz9victim', proven: false },
      { address: 'prl1victim', proven: false },
      { address: '0xdead', proven: true },
    ],
  );
  // Original rows untouched; row fields preserved for consumers.
  assert.equal('proven' in rows[0], false);
  assert.equal(out[0].id, 'l1');
});
