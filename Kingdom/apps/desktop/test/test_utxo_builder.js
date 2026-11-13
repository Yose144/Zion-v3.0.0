#!/usr/bin/env node
/**
 * Unit testy UTXO builderu (Kingdom desktop klient) — bez Electronu i sítě.
 *   node test/test_utxo_builder.js
 *
 * Pokrývá backport z 13. 11. (maxTxInputs budget + fragmentation error +
 * buildUtxoSelfSpend — ekvivalent `zion wallet consolidate`).
 */

const path = require('path');
const assert = require('assert');
const crypto = require('crypto');

const ub = require(path.join(__dirname, '..', 'src', 'utxo-builder'));

let passed = 0;
const failures = [];
function check(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (e) {
    failures.push(`${name}: ${e.message}`);
    console.log(`FAIL ${name}: ${e.message}`);
  }
}

// ── maxTxInputs — konsensus budget (100 KB JSON tx) ────────────────────
check('maxTxInputs(2,0) = 177 (shodné s v31_wallet::max_tx_inputs_for(2))', () => {
  assert.strictEqual(ub.maxTxInputs(2, 0), 177);
});
check('maxTxInputs(1,0) ≥ 177 (1 output nezabírá místo navíc tuhle velikost)', () => {
  assert.ok(ub.maxTxInputs(1, 0) >= 177);
});
check('maxTxInputs s dlouhým memo klesá', () => {
  assert.ok(ub.maxTxInputs(2, 200) < ub.maxTxInputs(2, 0));
});
check('maxTxInputs clamp na MAX_TX_INPUTS_CONSENSUS (1000)', () => {
  assert.ok(ub.maxTxInputs(1, 0) <= 1000);
});

// ── buildUtxoTransaction — normální send ───────────────────────────────
function makeKey() {
  // Deterministický Ed25519 klíč (nutné pro reprodukovatelné tx_id).
  const seed = crypto.createHash('sha256').update('kingdom-utxo-test-seed').digest();
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
  return { privateKey, publicKey };
}

const KEY = makeKey();
const pkDer = KEY.privateKey.export({ type: 'pkcs8', format: 'der' });
const FROM = 'zion1k000000000000000000000000000000000000000000000000000test';

function utxo(i, zion) {
  return {
    tx_hash: `aa${String(i).padStart(62, '0')}`,
    output_index: 0,
    address: FROM,
    amount: String(BigInt(zion) * 1_000_000n),
  };
}

check('normální 2-UTXO send: 2 in / 2 out, fee = in − out ≥ min fee', () => {
  const tx = ub.buildUtxoTransaction({
    fromAddress: FROM,
    utxos: [utxo(1, 10), utxo(2, 20)],
    privateKeyDer: pkDer,
    toAddress: 'zion1d222222222222222222222222222222222222222222222222222test',
    amountZion: '25',
    memo: 'TEST',
  });
  assert.strictEqual(tx.transaction.inputs.length, 2);
  assert.strictEqual(tx.transaction.outputs.length, 2);
  const inSum = (10n + 20n) * 1_000_000n;
  const outSum = tx.transaction.outputs.reduce((a, o) => a + BigInt(o.amount), 0n);
  const fee = inSum - outSum;
  assert.strictEqual(fee >= ub.MIN_TX_FEE_FLOWERS, true, `fee ${fee} < min`);
  assert.strictEqual(
    fee,
    ub.minimumFeeForSize(ub.estimateTxSize(2, 2)),
    'fee = minimumFeeForSize(estimateTxSize(2,2))',
  );
});

check('podpisy: každý input má non-empty script', () => {
  const tx = ub.buildUtxoTransaction({
    fromAddress: FROM,
    utxos: [utxo(1, 10)],
    privateKeyDer: pkDer,
    toAddress: 'zion1d222222222222222222222222222222222222222222222222222test',
    amountZion: '5',
  });
  assert.strictEqual(tx.transaction.inputs[0].script.length > 0, true);
});

check('fragmentace: chybná zpráva místo oversized tx', () => {
  // 200 UTXO po 1 ZION, cíl 500 ZION — cap 177 pokryje jen ~177.
  const utxos = Array.from({ length: 200 }, (_, i) => utxo(1000 + i, 1));
  assert.throws(
    () =>
      ub.buildUtxoTransaction({
        fromAddress: FROM,
        utxos,
        privateKeyDer: pkDer,
        toAddress: 'zion1d222222222222222222222222222222222222222222222222222test',
        amountZion: '500',
      }),
    /UTXO set too fragmented.*consolidate/i,
  );
});

// ── buildUtxoSelfSpend — konsolidace (ekvivalent `zion wallet consolidate`) ──
check('self-spend: 1 output na sebe, amount = sum − fee (2+ UTXO povinné)', () => {
  const r = ub.buildUtxoSelfSpend({
    fromAddress: FROM,
    utxos: [utxo(1, 50), utxo(2, 30), utxo(3, 20)],
    privateKeyDer: pkDer,
    memo: 'CONSOLIDATE',
  });
  assert.strictEqual(r.transaction.inputs.length, 3);
  assert.strictEqual(r.transaction.outputs.length, 1);
  const inSum = 100n * 1_000_000n;
  assert.strictEqual(BigInt(r.transaction.outputs[0].amount), inSum - BigInt(r.fee_flowers));
  assert.strictEqual(r.transaction.outputs[0].address.encoded, FROM);
  assert.strictEqual(r.output_amount, (inSum - BigInt(r.fee_flowers)).toString());
});

check('self-spend: podpisy přítomny', () => {
  const r = ub.buildUtxoSelfSpend({
    fromAddress: FROM,
    utxos: [utxo(1, 5), utxo(2, 5)],
    privateKeyDer: pkDer,
  });
  assert.strictEqual(r.transaction.inputs[0].script.length > 0, true);
});

check('self-spend: filtruje cizí adresy a prázdné částky', () => {
  const r = ub.buildUtxoSelfSpend({
    fromAddress: FROM,
    utxos: [utxo(1, 5), { tx_hash: 'bb', output_index: 0, address: 'zion1FOREIGN', amount: '1000000' }, utxo(2, 3)],
    privateKeyDer: pkDer,
  });
  assert.strictEqual(r.transaction.inputs.length, 2);
});

check('self-spend bez UTXO hodí chybu', () => {
  assert.throws(() => ub.buildUtxoSelfSpend({ fromAddress: FROM, utxos: [], privateKeyDer: pkDer }), /No UTXOs/);
});

// ── sanity: hash funkce ────────────────────────────────────────────────
check('keccak256 vs blake3 nejsou totéž', () => {
  const d = Buffer.from('abc');
  assert.notStrictEqual(ub.keccak256Hash(d).toString('hex'), ub.blake3Hash(d).toString('hex'));
});

if (failures.length) {
  console.error(`\n${failures.length} selhání`);
  process.exit(1);
}
console.log(`\n# utxo-builder: ${passed}/${passed + failures.length} OK`);
