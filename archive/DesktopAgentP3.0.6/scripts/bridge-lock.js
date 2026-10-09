// Headless L1 -> Base wZION bridge lock helper.
//
// Usage (mnemonic — value read from env, never passed as CLI arg):
//   ZION_BRIDGE_MNEMONIC="12 or 24 words" \
//     node APP&WEB/desktop-agent/scripts/bridge-lock.js \
//     --to-evm 0xfd445bcff4649aa6afbab4eb6105cfdd119b0f62 \
//     --amount 100
//
// Or decrypt an existing desktop-agent wallet JSON:
//   ZION_BRIDGE_WALLET_FILE="~/Library/Application Support/zion-desktop-agent/wallets/zion1....json" \
//   ZION_BRIDGE_WALLET_PASSWORD="..." \
//     node APP&WEB/desktop-agent/scripts/bridge-lock.js \
//     --to-evm 0x... --amount 100
//
// Sends native ZION to the canonical bridge vault with a BRIDGE:base:<evm> memo.
// The bridge relay will mint wZION on Base to the given EVM address.

const fs = require('fs');
const path = require('path');

const PUBLIC_API_BASE = 'https://app.zionterranova.com';
const PUBLIC_API_ADDRESS = `${PUBLIC_API_BASE}/api/blockchain/address`;
const PUBLIC_API_BROADCAST = `${PUBLIC_API_BASE}/api/blockchain/broadcast`;

// Canonical V31 Mainnet Alpha L1 bridge vault (E4 round-trip, 2026-08-22).
const BRIDGE_VAULT = 'zion1j3w3h7k8m635h734y786j5804305m822t5uk546';

const WalletGenerator = require('../src/wallet-generator');
const UtxoBuilder = require('../src/utxo-builder');

function parseArgs(argv) {
  const args = { toEvm: '', amount: 0, help: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--to-evm' || a === '--evm') {
      args.toEvm = argv[++i] || '';
    } else if (a === '--amount') {
      args.amount = parseFloat(argv[++i]) || 0;
    } else if (a === '--help' || a === '-h') {
      args.help = true;
    }
  }
  return args;
}

function showHelp() {
  console.log(`bridge-lock.js — send native ZION to the L1 bridge vault and mint wZION on Base.

Required:
  --to-evm <0x...>   target Base EVM address (the L2 wZION recipient)
  --amount <n>       amount of native ZION to lock (min 100)

Authentication (choose one, via env):
  ZION_BRIDGE_MNEMONIC="..."        12/24-word BIP39 mnemonic of a funded wallet
  ZION_BRIDGE_WALLET_FILE="..."     desktop-agent wallet JSON path
  ZION_BRIDGE_WALLET_PASSWORD="..." password for the wallet JSON

Example:
  ZION_BRIDGE_MNEMONIC="bullet tribe ..." \
    node scripts/bridge-lock.js --to-evm 0xfd445... --amount 100
`);
}

async function httpGet(url, timeoutMs = 15000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function httpPost(url, body, timeoutMs = 20000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  } finally {
    clearTimeout(timer);
  }
}

function deriveWallet() {
  const mnemonic = process.env.ZION_BRIDGE_MNEMONIC;
  const walletFile = process.env.ZION_BRIDGE_WALLET_FILE;
  const walletPassword = process.env.ZION_BRIDGE_WALLET_PASSWORD;

  if (mnemonic) {
    const w = WalletGenerator.recoverWallet(mnemonic.trim());
    return { address: w.address, privateKeyHex: w.privateKey };
  }

  if (walletFile && walletPassword) {
    const raw = fs.readFileSync(path.resolve(walletFile.replace(/^~/, process.env.HOME)), 'utf8');
    const data = JSON.parse(raw);
    if (!data.address || !data.encryptedPrivateKey) {
      throw new Error('wallet file missing address or encryptedPrivateKey');
    }
    const privateKeyHex = WalletGenerator.decryptPrivateKey(data.encryptedPrivateKey, walletPassword);
    return { address: data.address, privateKeyHex };
  }

  throw new Error('Set ZION_BRIDGE_MNEMONIC or both ZION_BRIDGE_WALLET_FILE and ZION_BRIDGE_WALLET_PASSWORD');
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.toEvm || args.amount <= 0) {
    showHelp();
    process.exit(args.help ? 0 : 1);
  }

  if (!/^0x[0-9a-fA-F]{40}$/.test(args.toEvm)) {
    throw new Error(`invalid EVM address: ${args.toEvm}`);
  }
  if (args.amount < 100) {
    throw new Error('minimum bridge lock amount is 100 ZION');
  }

  const { address: fromAddress, privateKeyHex } = deriveWallet();
  const toEvm = args.toEvm.toLowerCase();
  const memo = `BRIDGE:base:${toEvm}`;

  console.log(`Source L1 wallet: ${fromAddress}`);
  console.log(`Bridge vault:     ${BRIDGE_VAULT}`);
  console.log(`Target EVM:       ${toEvm}`);
  console.log(`Amount:           ${args.amount} ZION`);
  console.log(`Memo:             ${memo}`);

  console.log('\nFetching UTXOs from public API...');
  const snap = await httpGet(`${PUBLIC_API_ADDRESS}?address=${encodeURIComponent(fromAddress)}`);
  const utxos = Array.isArray(snap.utxos) ? snap.utxos : [];
  if (utxos.length === 0) {
    throw new Error('no UTXOs found for source wallet');
  }
  const total = utxos.reduce((s, u) => s + BigInt(u.amount || 0), 0n);
  console.log(`  UTXOs: ${utxos.length}, total: ${(Number(total) / 1e6).toFixed(6)} ZION`);

  if (total < BigInt(Math.floor(args.amount * 1e6))) {
    throw new Error(`insufficient balance: have ${(Number(total) / 1e6).toFixed(6)} ZION, need ${args.amount}`);
  }

  console.log('\nBuilding and signing V31 native transaction...');
  const { tx_id: txId, transaction } = UtxoBuilder.buildUtxoTransaction({
    fromAddress,
    toAddress: BRIDGE_VAULT,
    amountZion: args.amount,
    utxos,
    privateKeyDer: Buffer.from(privateKeyHex, 'hex'),
    memo,
  });

  console.log(`  Local tx_id: ${txId}`);

  console.log('\nBroadcasting transaction...');
  const result = await httpPost(PUBLIC_API_BROADCAST, {
    transaction,
    model: 'utxo',
  });

  console.log('\nResult:');
  console.log(`  accepted: ${result.accepted}`);
  console.log(`  tx_id:    ${result.tx_id || txId}`);
  console.log(`  model:    ${result.model || 'v31-native'}`);

  if (!result.accepted) {
    throw new Error('broadcast rejected by node');
  }

  console.log(`\nLock transaction submitted. The bridge relay will mint wZION to ${toEvm} after finality.`);
}

main().catch((err) => {
  console.error(`\nError: ${err.message}`);
  process.exit(1);
});
