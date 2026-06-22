#!/usr/bin/env node
/**
 * Desktop Agent Wallet E2E Smoke Test
 *
 * Exercises the same code paths the GUI uses, without launching Electron:
 *   - wallet generation
 *   - deterministic mnemonic recovery
 *   - wallet encryption / decryption
 *   - balance + UTXO lookup against Edge RPC
 *   - UTXO transaction building (v2 hash)
 *   - Ed25519 signature verification
 *
 * Usage (from APP&WEB/desktop-agent):
 *   node scripts/test-wallet-e2e.js
 */

const path = require('path');
const http = require('http');

const WalletGenerator = require(path.join(__dirname, '..', 'src', 'wallet-generator'));
const UtxoBuilder = require(path.join(__dirname, '..', 'src', 'utxo-builder'));

const RPC_HOST = process.env.ZION_RPC_HOST || '77.42.71.94';
const RPC_PORT = parseInt(process.env.ZION_RPC_PORT || '8443', 10);

function rpcCall(method, params) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params });
    const req = http.request(
      {
        hostname: RPC_HOST,
        port: RPC_PORT,
        path: '/jsonrpc',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        }
      },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            resolve({ parse_error: true, raw: body });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  console.log('=== ZION Desktop Agent — Wallet E2E Smoke Test ===\n');

  // 1. Generate wallet
  console.log('[1/7] Generating wallet...');
  const wallet = WalletGenerator.generateWallet();
  console.log('  address:', wallet.address, '(valid:', WalletGenerator.isValidAddress(wallet.address), ')');

  // 2. Encrypt / decrypt
  console.log('\n[2/7] Testing wallet encryption...');
  const password = 'test-password-123';
  const encrypted = WalletGenerator.encryptPrivateKey(wallet.privateKey, password);
  const decrypted = WalletGenerator.decryptPrivateKey(encrypted, password);
  if (decrypted !== wallet.privateKey) throw new Error('Wallet encryption/decryption mismatch');
  console.log('  encryption round-trip: OK');

  // 3. Mnemonic recovery is deterministic
  console.log('\n[3/7] Testing deterministic mnemonic recovery...');
  const recovered = WalletGenerator.recoverWallet(wallet.mnemonic);
  if (recovered.address !== wallet.address) {
    throw new Error(
      `Mnemonic recovery is not deterministic! generated=${wallet.address} recovered=${recovered.address}`
    );
  }
  if (recovered.privateKey !== wallet.privateKey) {
    throw new Error('Recovered private key does not match generated private key');
  }
  console.log('  deterministic recovery: OK');

  // 4. Balance lookup via Edge RPC
  console.log('\n[4/7] Querying balance via Edge RPC...');
  const balanceRes = await rpcCall('getBalance', { address: wallet.address });
  if (balanceRes.error) {
    console.log('  RPC error:', balanceRes.error);
  } else {
    const r = balanceRes.result || {};
    console.log('  rpc_ok: true');
    console.log('  chain_height:', r.chain_height);
    console.log('  balance_flowers:', r.balance_flowers);
    console.log('  utxo_count:', r.utxo_count);
  }

  // 5. UTXO lookup via Edge RPC
  console.log('\n[5/7] Querying UTXOs via Edge RPC...');
  const utxoRes = await rpcCall('getUtxos', { address: wallet.address });
  if (utxoRes.error) {
    console.log('  RPC error:', utxoRes.error);
  } else {
    const r = utxoRes.result || {};
    console.log('  utxo_count:', r.count, 'total_amount:', r.total_amount);
  }

  // 6. Build a signed UTXO transaction (uses v2 hash required from genesis)
  console.log('\n[6/7] Building signed UTXO transaction...');
  const fakeUtxo = {
    tx_hash: 'aabbccdd11223344556677889900aabbccdd11223344556677889900aabbccdd',
    output_index: 0,
    amount: 20000000000, // 0.02 ZION in flowers
    address: wallet.address
  };
  const tx = UtxoBuilder.buildUtxoTransaction({
    fromAddress: wallet.address,
    toAddress: wallet.address,
    amountZion: 0.001,
    utxos: [fakeUtxo],
    privateKeyDer: Buffer.from(wallet.privateKey, 'hex'),
    memo: 'e2e smoke test'
  });
  console.log('  tx.version:', tx.version, '(expected: 2)');
  console.log('  tx.id:', UtxoBuilder.bytesToHex(tx.id));
  console.log('  inputs:', tx.inputs.length, 'outputs:', tx.outputs.length);
  console.log('  fee:', tx.fee);

  // 7. Verify signature
  console.log('\n[7/7] Verifying Ed25519 signature...');
  const ed = require('@noble/ed25519');
  const { sha512 } = require('@noble/hashes/sha512');
  ed.hashes.sha512 = sha512;

  const pubKey = new Uint8Array(tx.inputs[0].public_key);
  const sig = new Uint8Array(tx.inputs[0].signature);
  const msg = new Uint8Array(tx.id);
  const valid = ed.verify(sig, msg, pubKey);
  if (!valid) throw new Error('Transaction signature verification failed');
  console.log('  signature valid: OK');

  console.log('\n=== All wallet E2E smoke tests passed ===');
  console.log('\nNote: A real outgoing transaction requires UTXOs for the sender address.');
  console.log('      Mine to this address, receive a payout, or transfer UTXOs to it first.');
}

main().catch((err) => {
  console.error('\nE2E test failed:', err.message || err);
  process.exit(1);
});
