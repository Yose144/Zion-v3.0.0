// @zion/wallet — smoke test jádra (bez sítě, bez Electronu).
// node test/wallet.test.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { WalletCore, Keys, Utxo } = require('../src/index.cjs');

let passed = 0;
const checks = [];
function check(name, fn) {
  checks.push([name, fn]);
}
async function run() {
  for (const [name, fn] of checks) {
    await fn();
    passed += 1;
    console.log(`  ok ${name}`);
  }
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(`\n${passed} checks passed`);
}

// ── generování + zion1 adresa ────────────────────────────────────────────
const w = Keys.generateWallet();
check('address format', () => {
  assert.match(w.address, /^zion1[023456789acdefghjklmnpqrstuvwxyz]{39}$/);
  assert.equal(w.address.length, 44);
  assert.equal(Keys.isValidAddress(w.address), true);
});
check('mnemonic 12 words', () => assert.equal(w.mnemonic.split(' ').length, 12));

// ── recover → stejná adresa ───────────────────────────────────────────────
check('recover derives same address', () => {
  const r = Keys.recoverWallet(w.mnemonic);
  assert.equal(r.address, w.address);
  assert.equal(r.publicKey, w.publicKey);
});

// ── špatná adresa odmítnuta ───────────────────────────────────────────────
check('invalid address rejected', () => {
  assert.equal(Keys.isValidAddress('zion1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'), false);
  assert.equal(Keys.getAddressType('zion1' + '0'.repeat(39)), 'invalid');
});

// ── encrypt/decrypt roundtrip ────────────────────────────────────────────
check('encrypt/decrypt roundtrip', () => {
  const enc = Keys.encryptPrivateKey(w.privateKey, 'heslo-123');
  assert.equal(Keys.decryptPrivateKey(enc, 'heslo-123'), w.privateKey);
  assert.throws(() => Keys.decryptPrivateKey(enc, 'spatne'), /|/); // auth tag fail
});

// ── UTXO tx build (syntetické UTXO, konzensus-struktura) ──────────────────
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zion-wallet-test-'));
const core = new WalletCore(dir);
let addr;
check('core.create unlocks + persists', () => {
  const r = core.create('heslo-123');
  addr = r.address;
  assert.equal(core.status().unlocked, true);
  assert.equal(core.status().address, addr);
  const stored = JSON.parse(fs.readFileSync(path.join(dir, 'zion-wallet.json'), 'utf8'));
  assert.equal(stored.address, addr);
  assert.equal(stored.privateKey, undefined); // klíč jen zašifrovaný
  assert.ok(stored.encrypted.authTag);
});

check('lock/unlock cycle', () => {
  core.lock();
  assert.equal(core.status().unlocked, false);
  assert.throws(() => core.unlock('spatne'));
  core.unlock('heslo-123');
  assert.equal(core.status().unlocked, true);
});

check('send validates recipient', async () => {
  await assert.rejects(() => core.send({ to: 'zion1bad', amountZion: 1 }), /Invalid recipient/);
});

check('utxo tx build (synthetic)', () => {
  const privDer = Buffer.from(
    Keys.decryptPrivateKey(core._loadStored().encrypted, 'heslo-123'),
    'hex',
  );
  const fakeUtxo = {
    tx_hash: crypto.randomBytes(32).toString('hex'),
    output_index: 0,
    amount: '5000000', // 5 ZION
    address: addr,
    height: 1,
  };
  const dest = Keys.generateWallet().address;
  const { tx_id, transaction } = Utxo.buildUtxoTransaction({
    fromAddress: addr,
    toAddress: dest,
    amountZion: 2,
    utxos: [fakeUtxo],
    privateKeyDer: privDer,
  });
  assert.match(tx_id, /^[0-9a-f]{64}$/);
  assert.equal(transaction.version, 1);
  assert.equal(transaction.inputs.length, 1);
  assert.equal(transaction.outputs.length, 2); // příjemce + drobné
  assert.equal(transaction.inputs[0].script.length, 96); // sig64 + pubkey32
  const [pay, change] = transaction.outputs;
  assert.equal(pay.amount, '2000000');
  assert.equal(pay.address.encoded, dest);
  assert.equal(change.address.encoded, addr);
});

// ── insufficient funds ───────────────────────────────────────────────────
check('insufficient funds rejected', () => {
  const privDer = Buffer.from(
    Keys.decryptPrivateKey(core._loadStored().encrypted, 'heslo-123'),
    'hex',
  );
  assert.throws(() =>
    Utxo.buildUtxoTransaction({
      fromAddress: addr,
      toAddress: Keys.generateWallet().address,
      amountZion: 100,
      utxos: [{ tx_hash: crypto.randomBytes(32).toString('hex'), output_index: 0, amount: '1000000', address: addr }],
      privateKeyDer: privDer,
    }), /Insufficient balance/);
});

run().catch((e) => { console.error(e); process.exit(1); });
