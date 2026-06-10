// Wallet Send Flow Integration Test
// Verifies: generate → encrypt → build UTXO tx → sign → hash round-trip

const path = require('path');
const fs = require('fs');

const WalletGenerator = require('../src/wallet-generator');
const UtxoBuilder = require('../src/utxo-builder');

const TEST_WALLET_DIR = path.join(__dirname, 'test_wallets');
const TEST_PASSWORD = 'test-password-123!';

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function cleanDir(dir) {
  if (fs.existsSync(dir)) {
    fs.readdirSync(dir).forEach(f => fs.unlinkSync(path.join(dir, f)));
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`);
}

function log(label, ok, detail) {
  const icon = ok ? '\u2713' : '\u2717';
  console.log(`${icon} ${label}${detail ? ' — ' + detail : ''}`);
}

async function runTests() {
  console.log('=== ZION Wallet Send Flow Test ===\n');
  let passed = 0;
  let failed = 0;

  ensureDir(TEST_WALLET_DIR);
  cleanDir(TEST_WALLET_DIR);

  // ── 1. Generate wallet ──
  let wallet;
  try {
    wallet = WalletGenerator.generateWallet();
    assert(wallet && wallet.address && wallet.address.startsWith('zion1'), 'address format');
    assert(wallet.address.length === 44, 'address length');
    assert(wallet.privateKey && wallet.privateKey.length >= 64, 'privateKey hex present');
    assert(wallet.mnemonic && wallet.mnemonic.split(' ').length === 12, 'mnemonic 12 words');
    log('Generate wallet', true, wallet.address);
    passed++;
  } catch (e) {
    log('Generate wallet', false, e.message);
    failed++;
    return { passed, failed };
  }

  // ── 2. Validate address ──
  try {
    const valid = WalletGenerator.isValidAddress(wallet.address);
    assert(valid === true, 'isValidAddress');
    const type = WalletGenerator.getAddressType(wallet.address);
    assert(type === 'zion1', 'getAddressType');
    log('Address validation', true);
    passed++;
  } catch (e) {
    log('Address validation', false, e.message);
    failed++;
  }

  // ── 3. Encrypt / decrypt private key ──
  let encryptedPk;
  try {
    encryptedPk = WalletGenerator.encryptPrivateKey(wallet.privateKey, TEST_PASSWORD);
    assert(encryptedPk && typeof encryptedPk.encrypted === 'string', 'encrypted object');
    const decrypted = WalletGenerator.decryptPrivateKey(encryptedPk, TEST_PASSWORD);
    assert(decrypted === wallet.privateKey, 'decrypt matches original');
    log('Encrypt/decrypt privateKey', true);
    passed++;
  } catch (e) {
    log('Encrypt/decrypt privateKey', false, e.message);
    failed++;
  }

  // ── 4. Save wallet JSON ──
  const walletFile = path.join(TEST_WALLET_DIR, 'test-wallet.json');
  try {
    const walletRecord = {
      name: 'Test Wallet',
      address: wallet.address,
      encryptedPrivateKey: encryptedPk,
      createdAt: Date.now()
    };
    fs.writeFileSync(walletFile, JSON.stringify(walletRecord, null, 2));
    assert(fs.existsSync(walletFile), 'wallet file exists');
    log('Save wallet JSON', true);
    passed++;
  } catch (e) {
    log('Save wallet JSON', false, e.message);
    failed++;
  }

  // ── 5. Recover from mnemonic produces valid wallet ──
  try {
    const recovered = WalletGenerator.recoverWallet(wallet.mnemonic);
    assert(recovered && recovered.address.startsWith('zion1'), 'recover address valid');
    assert(recovered.address.length === 44, 'recover address length');
    assert(recovered.privateKey && recovered.privateKey.length >= 64, 'recover privateKey');
    log('Recover from mnemonic', true, recovered.address);
    passed++;
  } catch (e) {
    log('Recover from mnemonic', false, e.message);
    failed++;
  }

  // ── 6. Build + sign UTXO transaction (mock UTXOs with enough balance) ──
  let signedTx;
  try {
    // 1000 ZION in flowers (1 ZION = 1e12 flowers)
    const mockUtxos = [
      {
        tx_hash: 'a'.repeat(64),
        output_index: 0,
        amount: 1_000_000_000_000_000, // 1000 ZION
        address: wallet.address
      },
      {
        tx_hash: 'b'.repeat(64),
        output_index: 1,
        amount: 500_000_000_000_000, // 500 ZION
        address: wallet.address
      }
    ];
    const privateKeyDer = Buffer.from(wallet.privateKey, 'hex');
    signedTx = UtxoBuilder.buildUtxoTransaction({
      fromAddress: wallet.address,
      toAddress: wallet.address,
      amountZion: 100, // 100 ZION
      utxos: mockUtxos,
      privateKeyDer,
      memo: 'test-memo'
    });
    assert(signedTx && signedTx.id, 'tx.id exists');
    assert(Array.isArray(signedTx.inputs) && signedTx.inputs.length > 0, 'has inputs');
    assert(Array.isArray(signedTx.outputs) && signedTx.outputs.length >= 1, 'has outputs');
    assert(signedTx.inputs.every(i => i.signature && i.signature.length === 64), 'each signature is 64 bytes');
    log('Build + sign UTXO tx', true, `inputs=${signedTx.inputs.length} outputs=${signedTx.outputs.length}`);
    passed++;
  } catch (e) {
    log('Build + sign UTXO tx', false, e.message);
    failed++;
  }

  // ── 7. TX hash round-trip (id matches re-calculation) ──
  try {
    const recalculated = UtxoBuilder.calculateTxHash(signedTx);
    const idHex = UtxoBuilder.bytesToHex(signedTx.id);
    const recalcHex = UtxoBuilder.bytesToHex(recalculated);
    assert(recalcHex === idHex, 'tx hash round-trip');
    log('TX hash round-trip', true, idHex.slice(0, 16) + '...');
    passed++;
  } catch (e) {
    log('TX hash round-trip', false, e.message);
    failed++;
  }

  // ── 8. Extract public key ──
  try {
    const pubKey = UtxoBuilder.extractPublicKey(Buffer.from(wallet.privateKey, 'hex'));
    assert(pubKey && pubKey.length === 32, 'public key is 32 bytes');
    log('Extract public key', true, `${pubKey.length} bytes`);
    passed++;
  } catch (e) {
    log('Extract public key', false, e.message);
    failed++;
  }

  // ── 9. Check tx structure ──
  try {
    assert(signedTx.outputs[0].address === wallet.address, 'first output address matches');
    assert(signedTx.outputs[0].memo === 'test-memo', 'memo preserved');
    assert(BigInt(signedTx.fee) === UtxoBuilder.MIN_FEE_FLOWERS, 'fee is minimum');
    log('Tx structure check', true, `${signedTx.inputs.length} in / ${signedTx.outputs.length} out`);
    passed++;
  } catch (e) {
    log('Tx structure check', false, e.message);
    failed++;
  }

  // ── 10. Negative: insufficient funds ──
  try {
    const privateKeyDer = Buffer.from(wallet.privateKey, 'hex');
    let threw = false;
    try {
      UtxoBuilder.buildUtxoTransaction({
        fromAddress: wallet.address,
        toAddress: wallet.address,
        amountZion: 999_999, // way more than available
        utxos: [
          { tx_hash: 'c'.repeat(64), output_index: 0, amount: 1_000, address: wallet.address }
        ],
        privateKeyDer
      });
    } catch (err) {
      threw = true;
      assert(err.message && err.message.includes('nsufficient'), 'error mentions insufficient funds');
    }
    assert(threw, 'throws on insufficient funds');
    log('Insufficient funds guard', true);
    passed++;
  } catch (e) {
    log('Insufficient funds guard', false, e.message);
    failed++;
  }

  cleanDir(TEST_WALLET_DIR);

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  return { passed, failed };
}

runTests().then(({ passed, failed }) => {
  process.exit(failed > 0 ? 1 : 0);
}).catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
