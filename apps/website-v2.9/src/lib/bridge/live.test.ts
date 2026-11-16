import assert from 'node:assert/strict';
import { mapWarpTransfer, mergeBridgeTransactions, relayIsOnline } from './live.ts';

assert.equal(relayIsOnline(0, 0), false);
assert.equal(relayIsOnline(0, 125604), true);
assert.equal(relayIsOnline(12, 0), true);

const outbound = mapWarpTransfer({
  id: '11111111-1111-1111-1111-111111111111',
  source_chain: { family: 'ZionL1', name: 'zion' },
  dest_chain: { family: 'Evm', name: 'base' },
  sender: 'zion1abc',
  recipient: '0xabc',
  amount_flowers: 5_000_000,
  status: 'Completed',
  source_tx_hash: 'ab'.repeat(32),
  memo: 'bridge',
});
assert.ok(outbound);
assert.equal(outbound.direction, 'outbound');
assert.equal(outbound.status, 'finalized');
assert.equal(outbound.amount_zion, '5');
assert.equal(outbound.recipient_chain, 'base');
assert.equal(outbound.txid, 'ab'.repeat(32));

const failed = mapWarpTransfer({
  id: '22222222-2222-2222-2222-222222222222',
  source_chain: { family: 'Evm', name: 'base' },
  dest_chain: { family: 'ZionL1', name: 'zion' },
  sender: '0xdef',
  recipient: 'zion1def',
  amount_flowers: 1_500_000,
  status: 'Failed',
});
assert.ok(failed);
assert.equal(failed.direction, 'inbound');
assert.equal(failed.status, 'failed');
assert.equal(failed.amount_zion, '1.5');

const lock = {
  txid: 'ab'.repeat(32),
  block_height: 20919,
  sender: 'zion1abc',
  recipient_chain: 'Base',
  recipient: '0xabc',
  amount_zion: '5',
  amount_flowers: 5_000_000,
  memo: '',
  confirmations: 100,
  finalized: true,
  status: 'finalized' as const,
  direction: 'lock' as const,
};
const merged = mergeBridgeTransactions(
  [lock],
  [outbound, failed!],
  50,
);
assert.equal(merged.length, 2);
assert.equal(merged[0].txid, lock.txid);
assert.equal(merged[0].block_height, 20919);
assert.equal(merged[0].direction, 'lock');
assert.equal(merged[1].status, 'failed');

console.log('bridge-live ok');
