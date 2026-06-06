/**
 * WZIONBridgeService.js
 * ──────────────────────────────────────────────────────────────────────────
 * Handles all wZION ERC-20 bridge interactions on Base network.
 *
 * Uses native @noble/* + @scure/bip32 stack — NO ethers.js dependency.
 *
 * Architecture:
 *  - EVM reads  : raw JSON-RPC eth_call  → Base RPC endpoint
 *  - EVM writes : sign TX locally with secp256k1 → eth_sendRawTransaction
 *  - Key derive : BIP-39 mnemonic → secp256k1 @ m/44'/60'/0'/0/0
 *
 * L1→EVM flow: user sends ZION to L1 vault with memo "BRIDGE:BASE:0xEVM"
 *              Rust relay monitors L1, calls bridgeMint on EVM.
 * EVM→L1 flow: user calls bridgeBurn here → wZION burned → relay releases L1.
 */

import { sha3_256, keccak_256 } from '@noble/hashes/sha3';
import * as secp from '@noble/secp256k1';
import { HDKey } from '@scure/bip32';
import { mnemonicToSeedSync } from 'bip39';
import axios from 'axios';
import CONFIG from '../constants/config';

// ── Network config (testnet default, switch for mainnet) ──────────────────
const NET = __DEV__
  ? CONFIG.BRIDGE.TESTNET    // Base Sepolia during development
  : CONFIG.BRIDGE.MAINNET;   // Base Mainnet in production

// ── ABI function selectors (keccak256 of signature, first 4 bytes) ────────
const SEL = {
  balanceOf   : '0x70a08231', // balanceOf(address)
  bridgeStats : computeSel('bridgeStats()'),
  bridgeBurn  : computeSel('bridgeBurn(uint256,string,bytes32)'),
  nonces      : '0x70ae92d2', // nonces(address) — ERC-20Permit
};

function computeSel(sig) {
  const hash = keccak_256(new TextEncoder().encode(sig));
  return '0x' + Buffer.from(hash.slice(0, 4)).toString('hex');
}

// ── Minimal ABI encoding ──────────────────────────────────────────────────
function encodeUint256(value) {
  // value can be BigInt or number
  const hex = BigInt(value).toString(16).padStart(64, '0');
  return hex;
}

function encodeAddress(addr) {
  // address → 32 bytes padded left
  return addr.replace('0x', '').toLowerCase().padStart(64, '0');
}

function encodeBytes32(hex) {
  // already 32 bytes
  return hex.replace('0x', '').padEnd(64, '0');
}

function encodeString(str) {
  // dynamic string: length + data padded to 32-byte boundary
  const bytes = new TextEncoder().encode(str);
  const lenHex = encodeUint256(bytes.length);
  const dataHex = Buffer.from(bytes).toString('hex').padEnd(
    Math.ceil(bytes.length / 32) * 64, '0'
  );
  return lenHex + dataHex;
}

/** Build calldata for bridgeBurn(uint256 amount, string l1Recipient, bytes32 burnId) */
function encodeCallBridgeBurn(amount, l1Recipient, burnId) {
  // ABI layout: [amount (32)] [offset_for_string (32)] [burnId (32)] [string_len (32)] [string_data]
  const offset = BigInt(96); // 3 fixed-size args * 32 = 96 bytes before dynamic data
  return (
    SEL.bridgeBurn +
    encodeUint256(amount) +
    encodeUint256(offset) +
    encodeBytes32(burnId) +
    encodeString(l1Recipient)
  );
}

/** Build calldata for balanceOf(address) */
function encodeCallBalanceOf(addr) {
  return SEL.balanceOf + encodeAddress(addr);
}

/** Build calldata for bridgeStats() */
function encodeCallBridgeStats() {
  return SEL.bridgeStats;
}

// ── JSON-RPC helpers ──────────────────────────────────────────────────────
let _rpcId = 1;
async function rpc(method, params = []) {
  const res = await axios.post(
    NET.RPC_URL,
    { jsonrpc: '2.0', id: _rpcId++, method, params },
    { timeout: 15_000 }
  );
  if (res.data.error) throw new Error(`RPC error: ${JSON.stringify(res.data.error)}`);
  return res.data.result;
}

async function ethCall(to, data) {
  return rpc('eth_call', [{ to, data }, 'latest']);
}

// ── EVM key derivation ────────────────────────────────────────────────────
function deriveEvmKey(mnemonic) {
  const seed = mnemonicToSeedSync(mnemonic);
  const root = HDKey.fromMasterSeed(seed);
  const child = root.derive("m/44'/60'/0'/0/0");
  if (!child.privateKey) throw new Error('Key derivation failed');
  return child.privateKey; // Uint8Array 32 bytes
}

function privateKeyToAddress(privKey) {
  // uncompressed public key (65 bytes, starts with 0x04)
  const pub = secp.getPublicKey(privKey, false);
  // drop first byte (0x04), keccak256 last 64 bytes, take last 20 bytes
  const hash = keccak_256(pub.slice(1));
  const addr = '0x' + Buffer.from(hash.slice(12)).toString('hex');
  return toChecksumAddress(addr);
}

function toChecksumAddress(addr) {
  const lower = addr.toLowerCase().replace('0x', '');
  const hash = Buffer.from(keccak_256(new TextEncoder().encode(lower))).toString('hex');
  let result = '0x';
  for (let i = 0; i < lower.length; i++) {
    result += parseInt(hash[i], 16) >= 8 ? lower[i].toUpperCase() : lower[i];
  }
  return result;
}

// ── Minimal RLP encoding for EVM legacy TX ────────────────────────────────
function rlpEncode(input) {
  if (Array.isArray(input)) {
    const encoded = input.map(rlpEncode);
    const payload = concat(encoded);
    return concat([encodeLength(payload.length, 0xc0), payload]);
  }
  // Uint8Array or Buffer
  const bytes = input instanceof Uint8Array ? input : Buffer.from(input);
  if (bytes.length === 1 && bytes[0] < 0x80) return bytes;
  return concat([encodeLength(bytes.length, 0x80), bytes]);
}

function encodeLength(length, offset) {
  if (length < 56) return Buffer.from([length + offset]);
  const hex = length.toString(16).padStart(length.toString(16).length % 2 === 0 ? 0 : 1, '0');
  const lenBytes = Buffer.from(hex.padStart(hex.length % 2 === 0 ? hex.length : hex.length + 1, '0'), 'hex');
  return concat([Buffer.from([offset + 55 + lenBytes.length]), lenBytes]);
}

function concat(arrays) {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) { out.set(a, offset); offset += a.length; }
  return out;
}

function bigintToBytes(n) {
  if (n === 0n || n === 0) return Buffer.alloc(0);
  const hex = n.toString(16).padStart(n.toString(16).length % 2 === 0 ? 64 : 63, '0');
  return Buffer.from(hex.replace(/^0+/, '') || '00', 'hex');
}

function hexToBytes(hex) {
  return Buffer.from(hex.replace('0x', ''), 'hex');
}

// ── Sign & broadcast EVM transaction ─────────────────────────────────────
async function signAndBroadcast({ privKey, to, data, value = 0n }) {
  const fromAddr = privateKeyToAddress(privKey);

  const [nonceHex, gasPriceHex] = await Promise.all([
    rpc('eth_getTransactionCount', [fromAddr, 'pending']),
    rpc('eth_gasPrice'),
  ]);

  const nonce    = BigInt(nonceHex);
  const gasPrice = BigInt(gasPriceHex) * 110n / 100n; // +10% buffer
  const gasLimit = 200_000n;

  // EIP-155 raw TX: encode with (chainId, 0, 0) for signing
  const chainId = BigInt(NET.CHAIN_ID);
  const txForSign = rlpEncode([
    bigintToBytes(nonce),
    bigintToBytes(gasPrice),
    bigintToBytes(gasLimit),
    hexToBytes(to),
    bigintToBytes(value),
    hexToBytes(data),
    bigintToBytes(chainId),
    Buffer.alloc(0),
    Buffer.alloc(0),
  ]);

  const msgHash = keccak_256(txForSign);
  const sig = secp.sign(msgHash, privKey, { lowS: true, extraEntropy: false });

  const v = BigInt(sig.recovery) + chainId * 2n + 35n;
  const r = sig.r;
  const s = sig.s;

  const rawTx = rlpEncode([
    bigintToBytes(nonce),
    bigintToBytes(gasPrice),
    bigintToBytes(gasLimit),
    hexToBytes(to),
    bigintToBytes(value),
    hexToBytes(data),
    bigintToBytes(v),
    bigintToBytes(r),
    bigintToBytes(s),
  ]);

  const rawHex = '0x' + Buffer.from(rawTx).toString('hex');
  const txHash = await rpc('eth_sendRawTransaction', [rawHex]);
  return txHash;
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Derive EVM address from BIP-39 mnemonic (HD path m/44'/60'/0'/0/0).
 * Returns { address, privateKey (Uint8Array) }
 */
export function deriveEvmWallet(mnemonic) {
  const privKey = deriveEvmKey(mnemonic);
  const address = privateKeyToAddress(privKey);
  return { address, privateKey: privKey };
}

/**
 * Get wZION balance for an EVM address.
 * Returns human-readable amount (18-decimal → float).
 */
export async function getWzionBalance(evmAddress) {
  const data = encodeCallBalanceOf(evmAddress);
  const result = await ethCall(NET.WZION_ADDRESS, data);
  const raw = BigInt(result || '0x0');
  return Number(raw) / 1e18;
}

/**
 * Get global bridge statistics.
 * Returns { totalMinted, totalBurned, outstanding, circulating } (all in ZION units)
 */
export async function getBridgeStats() {
  const data = encodeCallBridgeStats();
  const result = await ethCall(NET.BRIDGE_ADDRESS, data);
  const hex = (result || '0x' + '0'.repeat(256)).slice(2);
  const chunk = (i) => BigInt('0x' + hex.slice(i * 64, i * 64 + 64));
  const scale = 1e18;
  return {
    totalMinted  : Number(chunk(0)) / scale,
    totalBurned  : Number(chunk(1)) / scale,
    outstanding  : Number(chunk(2)) / scale,
    circulating  : Number(chunk(3)) / scale,
  };
}

/**
 * Check if a TX has been confirmed.
 * Returns { confirmed: bool, status: 0|1, blockNumber }
 */
export async function getTxStatus(txHash) {
  const receipt = await rpc('eth_getTransactionReceipt', [txHash]);
  if (!receipt) return { confirmed: false, status: null, blockNumber: null };
  return {
    confirmed   : true,
    status      : parseInt(receipt.status, 16), // 1 = success, 0 = reverted
    blockNumber : parseInt(receipt.blockNumber, 16),
    explorerUrl : `${NET.EXPLORER}/tx/${txHash}`,
  };
}

/**
 * Initiate EVM→L1 bridge: burn wZION on Base → relay unlocks ZION on L1.
 *
 * @param {string}     mnemonic      BIP-39 mnemonic of the wallet
 * @param {number}     amountZion    Amount in ZION units (e.g. 500)
 * @param {string}     l1Recipient   ZION L1 address (zion1...)
 * @returns {string}   txHash of the bridgeBurn transaction
 */
export async function bridgeBurnToL1(mnemonic, amountZion, l1Recipient) {
  if (amountZion < CONFIG.BRIDGE.MIN_BRIDGE_AMOUNT) {
    throw new Error(`Minimum bridge amount is ${CONFIG.BRIDGE.MIN_BRIDGE_AMOUNT} ZION`);
  }

  const { privateKey } = deriveEvmWallet(mnemonic);

  // wZION uses 18 decimals, L1 ZION 6 decimals → factor = 1e12
  const amountWei = BigInt(Math.round(amountZion * 1e6)) * BigInt(CONFIG.BRIDGE.SCALE_FACTOR);

  // Unique burnId: keccak256(l1Recipient + timestamp)
  const burnIdRaw = keccak_256(
    new TextEncoder().encode(l1Recipient + Date.now().toString())
  );
  const burnId = '0x' + Buffer.from(burnIdRaw).toString('hex');

  const calldata = encodeCallBridgeBurn(amountWei, l1Recipient, burnId);

  const txHash = await signAndBroadcast({
    privKey : privateKey,
    to      : NET.BRIDGE_ADDRESS,
    data    : calldata,
  });

  return { txHash, burnId, amountWei: amountWei.toString() };
}

/**
 * Generate L1 locking memo for L1→EVM direction.
 * User sends this amount of ZION to the L1 vault with this memo.
 *
 * @param {string} evmRecipient  Base EVM address to receive wZION
 * @returns {{ vaultAddress, memo, minAmount }}
 */
export function prepareLockMemo(evmRecipient) {
  if (!evmRecipient || !evmRecipient.match(/^0x[0-9a-fA-F]{40}$/)) {
    throw new Error('Invalid EVM address');
  }
  return {
    vaultAddress : CONFIG.BRIDGE.L1_VAULT_ADDRESS,
    memo         : `BRIDGE:BASE:${evmRecipient.toLowerCase()}`,
    minAmount    : CONFIG.BRIDGE.MIN_BRIDGE_AMOUNT,
    network      : NET.NAME,
  };
}

export default {
  deriveEvmWallet,
  getWzionBalance,
  getBridgeStats,
  getTxStatus,
  bridgeBurnToL1,
  prepareLockMemo,
};
