// Native multichain wallet — derives per-chain keys from the user's ZION
// mnemonic (non-custodial, keys never leave this process).
//
// Derivation goes through the bundled `zion-derive-addr` helper (Rust) —
// the mnemonic is piped via stdin, never argv. The helper output carries
// secret material, which stays in memory only; persisted wallet state holds
// addresses + public keys.
//
// Chains & standards (parity-tested against the Rust helper):
//   zion    bip39 seed[0:32] → ed25519 → zion1…   (existing wallet compat)
//   evm     BIP32 m/44'/60'/0'/0/0 → secp256k1    (MetaMask-compatible)
//   bitcoin BIP84 m/84'/0'/0'/0/0 → P2WPKH bc1q…
//   solana  SLIP-0010 m/44'/501'/0'/0' → ed25519  (Phantom-compatible)
//   quantus m/44'/189'/0'/0/0 → ML-DSA-87 → qz…   (sign/send via helper only)

const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { sha256 } = require('@noble/hashes/sha256');
const { ripemd160 } = require('@noble/hashes/ripemd160');
const ed25519 = require('@noble/ed25519');

const QuantusWallet = require('./quantus-wallet.js');

const ZION_BASE32 = '023456789acdefghjklmnpqrstuvwxyz';
const B58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

const EVM_RPC = process.env.ZION_NATIVE_EVM_RPC || 'https://mainnet.base.org';
const BTC_API = process.env.ZION_NATIVE_BTC_API || 'https://mempool.space/api';
const SOL_RPC = process.env.ZION_NATIVE_SOL_RPC || 'https://api.mainnet-beta.solana.com';

// ── helper invocation ────────────────────────────────────────────────────────

function runHelper(args, input, appRoot, isPackaged, timeoutMs = 15_000) {
  const helper = QuantusWallet.resolveHelperPath(appRoot, isPackaged);
  if (!helper) return null;
  const res = spawnSync(helper, args, {
    input,
    encoding: 'utf8',
    timeout: timeoutMs,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (res.status !== 0 || !res.stdout) return null;
  return res.stdout;
}

/**
 * Derive the full native bundle { zion, evm, bitcoin, solana, quantus }
 * for a mnemonic. Returns null when the helper is missing/fails.
 * WARNING: the bundle contains private keys — keep in memory only.
 */
function deriveNativeBundle(mnemonic, appRoot, isPackaged) {
  const out = runHelper(['--json'], String(mnemonic).trim() + '\n', appRoot, isPackaged);
  if (!out) return null;
  try {
    return JSON.parse(out.trim().split('\n').pop());
  } catch {
    return null;
  }
}

/** Sign arbitrary message bytes (hex) with the key for `chain`. */
function signNative(chain, mnemonic, msgBytes, appRoot, isPackaged, account = 0, index = 0) {
  const hexMsg = Buffer.from(msgBytes).toString('hex');
  const out = runHelper(
    ['--sign', chain, String(account), String(index)],
    `${String(mnemonic).trim()}\n${hexMsg}\n`,
    appRoot,
    isPackaged,
  );
  if (!out) return null;
  const m = /(?:^|\s)sig=([0-9a-fA-F]+)/.exec(out);
  return m ? m[1] : null;
}

/** Submit a QTC transfer via the helper (extrinsic built+signed in Rust). */
function sendQuantus(mnemonic, destAddress, planks, appRoot, isPackaged) {
  const out = runHelper(
    ['--qtc-send', String(destAddress).trim(), String(planks)],
    String(mnemonic).trim() + '\n',
    appRoot,
    isPackaged,
    60_000,
  );
  if (!out) return { ok: false, error: 'helper failed' };
  const m = /(?:^|\s)txhash=(0x[0-9a-fA-F]+)/.exec(out);
  return m ? { ok: true, txHash: m[1] } : { ok: false, error: out.trim() };
}

// ── address validation helpers ───────────────────────────────────────────────

function isValidBtcAddress(a) {
  return /^(bc1[qp][a-z0-9]{11,71}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/.test(String(a || '').trim());
}
function isValidSolanaAddress(a) {
  const s = String(a || '').trim();
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s)) return false;
  try {
    return b58decode(s).length === 32;
  } catch {
    return false;
  }
}
function isValidEvmAddress(a) {
  return /^0x[0-9a-fA-F]{40}$/.test(String(a || '').trim());
}

function b58decode(str) {
  let num = 0n;
  for (const ch of str) {
    const d = B58_ALPHABET.indexOf(ch);
    if (d < 0) throw new Error(`invalid base58 char '${ch}'`);
    num = num * 58n + BigInt(d);
  }
  let hex = num.toString(16);
  if (hex.length % 2) hex = '0' + hex;
  const bytes = hex === '00' ? Buffer.alloc(0) : Buffer.from(hex, 'hex');
  let zeros = 0;
  while (zeros < str.length && str[zeros] === '1') zeros++;
  return Buffer.concat([Buffer.alloc(zeros), bytes]);
}

function b58encode(buf) {
  let num = 0n;
  for (const b of buf) num = num * 256n + BigInt(b);
  let out = '';
  while (num > 0n) {
    out = B58_ALPHABET[Number(num % 58n)] + out;
    num /= 58n;
  }
  let zeros = 0;
  while (zeros < buf.length && buf[zeros] === 0) zeros++;
  return '1'.repeat(zeros) + out;
}

// ── balances (public RPCs) ───────────────────────────────────────────────────

async function rpcJson(url, method, params) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: 1, jsonrpc: '2.0', method, params }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message || 'rpc error');
  return json.result;
}

async function evmBalanceWei(address, rpcUrl = EVM_RPC) {
  const hexBal = await rpcJson(rpcUrl, 'eth_getBalance', [address, 'latest']);
  return BigInt(hexBal);
}

async function bitcoinBalanceSats(address, api = BTC_API) {
  const res = await fetch(`${api}/address/${address}`);
  if (!res.ok) throw new Error(`btc api ${res.status}`);
  const j = await res.json();
  const funded = BigInt(j.chain_stats?.funded_txo_sum ?? 0) + BigInt(j.mempool_stats?.funded_txo_sum ?? 0);
  const spent = BigInt(j.chain_stats?.spent_txo_sum ?? 0) + BigInt(j.mempool_stats?.spent_txo_sum ?? 0);
  return funded - spent;
}

async function solanaBalanceLamports(address, rpcUrl = SOL_RPC) {
  const r = await rpcJson(rpcUrl, 'getBalance', [address]);
  return BigInt(r?.value ?? 0);
}

/**
 * Fetch balances for every chain in a derived bundle. Returns
 * { zion?, evm, bitcoin, solana, quantus } — zion uses the caller's fetcher.
 */
async function fetchNativeBalances(bundle, zionFetcher) {
  const out = {};
  if (bundle.zion?.address && typeof zionFetcher === 'function') {
    try {
      out.zion = await zionFetcher(bundle.zion.address);
    } catch { /* keep undefined */ }
  }
  const jobs = [
    ['evm', () => evmBalanceWei(bundle.evm.address).then((v) => ({ wei: v.toString() }))],
    ['bitcoin', () => bitcoinBalanceSats(bundle.bitcoin.address).then((v) => ({ sats: v.toString() }))],
    ['solana', () => solanaBalanceLamports(bundle.solana.address).then((v) => ({ lamports: v.toString() }))],
    [
      'quantus',
      () => QuantusWallet.quantusBalance(bundle.quantus.address).then((r) => (r ? { planks: r.free.toString(), nonce: r.nonce } : null)),
    ],
  ];
  const results = await Promise.allSettled(jobs.map(([, fn]) => fn()));
  results.forEach((r, i) => {
    if (r.status === 'fulfilled' && r.value) out[jobs[i][0]] = r.value;
  });
  return out;
}

// ── sends ────────────────────────────────────────────────────────────────────

/** EVM native-asset transfer (ETH on Base by default). */
async function sendEvm(privateKeyHex, to, amountWei, rpcUrl = EVM_RPC) {
  const { ethers } = require('ethers');
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKeyHex, provider);
  const tx = await wallet.sendTransaction({ to, value: ethers.BigNumber.from(String(amountWei)) });
  return { ok: true, txHash: tx.hash };
}

/** sha256d + varint + DER helpers for the BTC builder. */
function sha256d(b) {
  return sha256(sha256(b));
}
function varint(n) {
  n = Number(n);
  if (n < 0xfd) return Buffer.from([n]);
  if (n <= 0xffff) return Buffer.from([0xfd, n & 0xff, n >> 8]);
  if (n <= 0xffffffff) { const b = Buffer.alloc(5); b[0] = 0xfe; b.writeUInt32LE(n, 1); return b; }
  const b = Buffer.alloc(9); b[0] = 0xff; b.writeBigUInt64LE(BigInt(n), 1); return b;
}
function derSig(r, s) {
  const enc = (x) => {
    let b = Buffer.from(x.toString(16).padStart(64, '0'), 'hex');
    while (b.length > 1 && b[0] === 0 && !(b[1] & 0x80)) b = b.subarray(1);
    if (b[0] & 0x80) b = Buffer.concat([Buffer.from([0]), b]);
    return b;
  };
  const rb = enc(r), sb = enc(s);
  return Buffer.concat([Buffer.from([0x30, rb.length + sb.length + 4, 0x02, rb.length]), rb, Buffer.from([0x02, sb.length]), sb]);
}

/**
 * P2WPKH spend — fetch UTXOs from mempool.space, build a segwit tx,
 * BIP-143 sighash, ECDSA via ethers' secp256k1 SigningKey.
 */
async function sendBitcoin(privateKeyHex, fromAddress, toAddress, sats, feeSats = 1000, api = BTC_API) {
  const { ethers } = require('ethers');
  if (!isValidBtcAddress(toAddress)) return { ok: false, error: 'invalid recipient' };

  const signingKey = new ethers.utils.SigningKey(privateKeyHex);
  const pubCompressed = Buffer.from(signingKey.compressedPublicKey.replace(/^0x/, ''), 'hex');
  const myHash160 = ripemd160(sha256(pubCompressed));
  const myScript = Buffer.concat([Buffer.from([0x00, 0x14]), Buffer.from(myHash160)]); // p2wpkh spk

  // recipient scriptPubKey (p2wpkh or p2sh/p2pkh)
  let toScript;
  const t = toAddress.trim();
  if (t.startsWith('bc1q')) {
    const prog = bech32DecodeProgram(t);
    toScript = Buffer.concat([Buffer.from([0x00, prog.length]), prog]);
  } else if (t.startsWith('bc1p')) {
    const prog = bech32DecodeProgram(t, 'bech32m');
    toScript = Buffer.concat([Buffer.from([0x51, prog.length]), prog]);
  } else {
    return { ok: false, error: 'only bc1 recipients supported in v1' };
  }

  const utxos = await (await fetch(`${api}/address/${fromAddress}/utxo`)).json();
  if (!Array.isArray(utxos) || !utxos.length) return { ok: false, error: 'no utxos' };

  const target = BigInt(sats) + BigInt(feeSats);
  const picked = [];
  let total = 0n;
  for (const u of utxos.sort((a, b) => Number(b.value - a.value))) {
    picked.push(u);
    total += BigInt(u.value);
    if (total >= target) break;
  }
  if (total < target) return { ok: false, error: `insufficient: have ${total} need ${target} sats` };
  const change = total - target;

  const SIGHASH_ALL = 1;
  const zero = Buffer.alloc(32);
  const hashPrevouts = sha256d(Buffer.concat(picked.map((u) => Buffer.concat([
    Buffer.from(u.txid, 'hex').reverse(),
    (() => { const b = Buffer.alloc(4); b.writeUInt32LE(u.vout); return b; })(),
  ]))));
  const hashSequence = sha256d(Buffer.concat(picked.map(() => Buffer.from([0xff, 0xff, 0xff, 0xff]))));
  const outsBytes = (outs) => Buffer.concat(outs.map((o) => Buffer.concat([
    (() => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(o.value)); return b; })(),
    varint(o.script.length), o.script,
  ])));
  const outputs = [{ value: BigInt(sats), script: toScript }];
  if (change > 546n) outputs.push({ value: change, script: myScript });
  const hashOutputs = sha256d(outsBytes(outputs));

  // sign each input (bip143)
  const witnesses = [];
  for (let i = 0; i < picked.length; i++) {
    const u = picked[i];
    const outpoint = Buffer.concat([
      Buffer.from(u.txid, 'hex').reverse(),
      (() => { const b = Buffer.alloc(4); b.writeUInt32LE(u.vout); return b; })(),
    ]);
    const scriptCode = Buffer.concat([Buffer.from([0x19, 0x76, 0xa9, 0x14]), Buffer.from(myHash160), Buffer.from([0x88, 0xac])]);
    const preimage = Buffer.concat([
      (() => { const b = Buffer.alloc(4); b.writeUInt32LE(2); return b; })(), // version
      hashPrevouts, hashSequence,
      outpoint,
      scriptCode,
      (() => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(u.value)); return b; })(),
      (() => { const b = Buffer.alloc(4); b.writeUInt32LE(0xfffffffd); return b; })(), // sequence (rbf)
      hashOutputs,
      (() => { const b = Buffer.alloc(4); b.writeUInt32LE(0); return b; })(), // locktime
      (() => { const b = Buffer.alloc(4); b.writeUInt32LE(SIGHASH_ALL); return b; })(),
    ]);
    const sighash = sha256d(preimage);
    const sig = signingKey.signDigest(sighash);
    const der = derSig(sig.r, sig.s);
    witnesses.push(Buffer.concat([
      varint(2), varint(der.length + 1), Buffer.concat([der, Buffer.from([SIGHASH_ALL])]),
      varint(pubCompressed.length), pubCompressed,
    ]));
  }

  // serialize segwit tx
  const ins = Buffer.concat(picked.map((u) => Buffer.concat([
    Buffer.from(u.txid, 'hex').reverse(),
    (() => { const b = Buffer.alloc(4); b.writeUInt32LE(u.vout); return b; })(),
    varint(0), // empty scriptSig
    Buffer.from([0xfd, 0xff, 0xff, 0xff]), // sequence 0xfffffffd
  ])));
  const tx = Buffer.concat([
    (() => { const b = Buffer.alloc(4); b.writeUInt32LE(2); return b; })(),
    Buffer.from([0x00, 0x01]), // marker+flag
    varint(picked.length), ins,
    varint(outputs.length), outsBytes(outputs),
    Buffer.concat(witnesses),
    (() => { const b = Buffer.alloc(4); b.writeUInt32LE(0); return b; })(),
  ]);

  const res = await fetch(`${api}/tx`, { method: 'POST', body: tx.toString('hex') });
  const body = await res.text();
  if (!res.ok) return { ok: false, error: `broadcast ${res.status}: ${body.slice(0, 200)}` };
  return { ok: true, txHash: body.trim() };
}

function bech32DecodeProgram(addr, enc = 'bech32') {
  // minimal bech32/bech32m decode → witness program bytes
  const AL = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
  const s = addr.toLowerCase();
  const pos = s.lastIndexOf('1');
  const data = [...s.slice(pos + 1)].map((c) => AL.indexOf(c));
  const values = data.slice(0, -6);
  const ver = values[0];
  let acc = 0, bits = 0;
  const prog = [];
  for (const v of values.slice(1)) {
    acc = (acc << 5) | v;
    bits += 5;
    if (bits >= 8) { bits -= 8; prog.push((acc >> bits) & 0xff); }
  }
  if (ver !== (enc === 'bech32' ? 0 : 1)) throw new Error('bad witness version');
  return Buffer.from(prog);
}

/** Solana system transfer (Lamports) — manual v0-legacy message build. */
async function sendSolana(secretKeyB58, fromAddress, toAddress, lamports, rpcUrl = SOL_RPC) {
  const secret = b58decode(secretKeyB58);
  if (secret.length !== 64) return { ok: false, error: 'bad secretKey' };
  const seed = secret.subarray(0, 32);
  const fromPk = ed25519.getPublicKey(seed); // 32B
  const toPk = b58decode(toAddress);
  if (toPk.length !== 32) return { ok: false, error: 'invalid recipient' };

  const bh = await rpcJson(rpcUrl, 'getLatestBlockhash', [{ commitment: 'finalized' }]);
  const blockhash = b58decode(bh.blockhash);

  const SYSTEM_PROGRAM = Buffer.alloc(32); // 11111111111111111111111111111111
  const keys = [Buffer.from(fromPk), Buffer.from(toPk), SYSTEM_PROGRAM];
  const compact = (n) => {
    const out = [];
    let x = n;
    do { let b = x & 0x7f; x >>= 7; if (x) b |= 0x80; out.push(b); } while (x);
    return Buffer.from(out);
  };
  // transfer ix data: u32le(2) ‖ u64le(lamports)
  const ixData = Buffer.alloc(12);
  ixData.writeUInt32LE(2, 0);
  ixData.writeBigUInt64LE(BigInt(lamports), 4);

  const message = Buffer.concat([
    Buffer.from([1, 0, 1]), // header: 1 signer, 0 signed-ro, 1 unsigned-ro
    compact(keys.length),
    ...keys,
    blockhash,
    compact(1), // 1 instruction
    Buffer.from([2]), // program_id_index → SYSTEM_PROGRAM
    compact(2), Buffer.from([0, 1]), // account indices [from, to]
    compact(ixData.length), ixData,
  ]);
  const sig = ed25519.sign(message, seed);
  const wire = Buffer.concat([compact(1), Buffer.from(sig), message]);
  const sigB58 = await rpcJson(rpcUrl, 'sendTransaction', [
    wire.toString('base64'),
    { encoding: 'base64', preflightCommitment: 'confirmed' },
  ]);
  return { ok: true, txHash: sigB58 };
}

// ── ZIS auto-link ────────────────────────────────────────────────────────────

/**
 * Link all derived addresses to the signed-in ZIS account.
 * `zis` must provide: challenge(address, chainType), linkAddress(payload).
 * Errors are collected per chain — partial success is returned.
 */
async function linkAllToZis(bundle, mnemonic, zis, appRoot, isPackaged) {
  const results = {};
  const doLink = async (chain, fn) => {
    try {
      results[chain] = await fn();
    } catch (e) {
      results[chain] = { ok: false, error: e.message };
    }
  };

  // zion-l1: ed25519 over the raw challenge
  await doLink('zion', async () => {
    const ch = await zis.challenge(bundle.zion.address, 'zion-l1');
    const sig = signNative('zion', mnemonic, Buffer.from(ch, 'utf8'), appRoot, isPackaged);
    return zis.linkAddress({
      address: bundle.zion.address, chainType: 'zion-l1',
      publicKey: bundle.zion.publicKey, signature: sig,
    });
  });

  // solana: ed25519 over the raw challenge (address = pubkey)
  await doLink('solana', async () => {
    const ch = await zis.challenge(bundle.solana.address, 'solana');
    const sig = signNative('solana', mnemonic, Buffer.from(ch, 'utf8'), appRoot, isPackaged);
    return zis.linkAddress({ address: bundle.solana.address, chainType: 'solana', signature: sig });
  });

  // bitcoin: recoverable ECDSA link proof
  await doLink('bitcoin', async () => {
    const ch = await zis.challenge(bundle.bitcoin.address, 'bitcoin');
    const sig = signNative('bitcoin', mnemonic, Buffer.from(ch, 'utf8'), appRoot, isPackaged);
    return zis.linkAddress({ address: bundle.bitcoin.address, chainType: 'bitcoin', signature: sig });
  });

  // evm: SIWE-style message over the challenge nonce
  await doLink('evm', async () => {
    const { ethers } = require('ethers');
    const wallet = new ethers.Wallet(bundle.evm.privateKey);
    const ch = await zis.challenge(bundle.evm.address, 'evm');
    const nonce = /nonce: ([^\n]+)/i.exec(ch)?.[1];
    const issuedAt = new Date().toISOString();
    const message = [
      `app.zionterranova.com wants you to sign in with your Ethereum account:`,
      bundle.evm.address, '', 'Link your native EVM address to ZION.', '',
      `URI: https://app.zionterranova.com`, 'Version: 1', 'Chain ID: 8453',
      `Nonce: ${nonce}`, `Issued At: ${issuedAt}`,
    ].join('\n');
    const signature = await wallet.signMessage(message);
    return zis.linkAddress({
      address: bundle.evm.address, chainType: 'evm', chainId: 'base',
      message, signature,
    });
  });

  // quantus: zion-key attestation (ML-DSA has no JS impl)
  await doLink('quantus', async () => {
    const ch = await zis.challenge(bundle.zion.address, 'zion-l1');
    const msg = Buffer.from(`${ch}\nquantus:${bundle.quantus.address}`, 'utf8');
    const sig = signNative('zion', mnemonic, msg, appRoot, isPackaged);
    return zis.linkAddress({
      address: bundle.quantus.address, chainType: 'quantus',
      zionAddress: bundle.zion.address, zionPublicKey: bundle.zion.publicKey,
      signature: sig,
    });
  });

  return results;
}

module.exports = {
  deriveNativeBundle,
  signNative,
  sendQuantus,
  sendEvm,
  sendBitcoin,
  sendSolana,
  fetchNativeBalances,
  linkAllToZis,
  isValidBtcAddress,
  isValidSolanaAddress,
  isValidEvmAddress,
  b58decode,
  b58encode,
};
