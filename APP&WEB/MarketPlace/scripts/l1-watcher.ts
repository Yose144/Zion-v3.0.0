#!/usr/bin/env npx tsx
/**
 * ZION MarketPlace L1 Watcher — hybrid L1/L2 payment settlement service.
 *
 * Monitors ZION L1 for transactions to the bridge vault with memo:
 *   MARKETBUY:<listingId>:<buyerL2Address>:<quantity>
 *
 * When a matching transaction is confirmed (after finality blocks), the
 * watcher calls `relayerSettle(listingId, buyer, quantity)` on the L2
 * ZIONMarketplace contract on Base. The NFT transfers on L2; the seller
 * receives wZION via the existing bridge mechanism.
 *
 * Usage:
 *   npx tsx scripts/l1-watcher.ts
 *
 * Env vars:
 *   L1_RPC_URL          — ZION L1 RPC address (default: 127.0.0.1:9443)
 *   L1_BRIDGE_VAULT     — Bridge vault address (default: zion1j53677g5k83030x3s2z2z644e7h07792q0u02t7)
 *   L1_FINALITY_BLOCKS  — Blocks to wait before settling (default: 60)
 *   L1_POLL_INTERVAL_S  — Poll interval in seconds (default: 15)
 *   L2_RPC_URL          — Base L2 RPC URL (default: https://mainnet.base.org)
 *   L2_MARKETPLACE_ADDR — ZIONMarketplace contract address on Base
 *   L2_RELAYER_PRIV_KEY — Relayer's private key (must have RELAYER_ROLE)
 *   L1_START_HEIGHT     — Start scanning from this height (default: latest)
 *   L1_SCALE_FIX_HEIGHT — Migration height for amount scaling (default: 0)
 */

import { createWalletClient, http, parseEther, createPublicClient, getContractAddress } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import * as net from 'net';
import * as fs from 'fs';
import * as path from 'path';

// ── Configuration ────────────────────────────────────────────────────

const L1_RPC_URL = process.env.L1_RPC_URL ?? '127.0.0.1:9443';
const L1_BRIDGE_VAULT =
  process.env.L1_BRIDGE_VAULT ?? 'zion1j53677g5k83030x3s2z2z644e7h07792q0u02t7';
const L1_FINALITY_BLOCKS = parseInt(process.env.L1_FINALITY_BLOCKS ?? '60', 10);
const L1_POLL_INTERVAL_S = parseInt(process.env.L1_POLL_INTERVAL_S ?? '15', 10);
const L2_RPC_URL = process.env.L2_RPC_URL ?? 'https://mainnet.base.org';
const L2_MARKETPLACE_ADDR = (process.env.L2_MARKETPLACE_ADDR ?? '') as `0x${string}`;
const L2_RELAYER_PRIV_KEY = (process.env.L2_RELAYER_PRIV_KEY ?? '') as `0x${string}`;
const L1_START_HEIGHT = process.env.L1_START_HEIGHT
  ? parseInt(process.env.L1_START_HEIGHT, 10)
  : undefined;
const L1_SCALE_FIX_HEIGHT = parseInt(process.env.L1_SCALE_FIX_HEIGHT ?? '0', 10);

const MIGRATION_DIVISOR = 1_000_000n; // 1e12 → 1e6 scale

// ── L1 RPC client (raw TCP JSON-RPC) ─────────────────────────────────

interface L1TxOutput {
  address: string;
  amount: string | number;
  memo?: string | null;
}

interface L1TxInput {
  public_key?: string | number[];
}

interface L1UtxoTx {
  id: string | number[];
  inputs: L1TxInput[];
  outputs: L1TxOutput[];
}

interface L1AccountTx {
  tx_id: string;
  from: string;
  to: string;
  amount_zion: string | number;
  memo?: string | null;
}

interface L1Block {
  height: number;
  hash_hex?: string;
  hash?: string;
  utxo_transactions?: L1UtxoTx[];
  account_transactions?: L1AccountTx[];
}

interface RpcResponse<T> {
  result?: T;
  error?: unknown;
}

async function l1Rpc<T>(method: string, params: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    const sock = net.createConnection(L1_RPC_URL, () => {
      const req = JSON.stringify({
        jsonrpc: '2.0',
        method,
        params,
        id: 1,
      });
      sock.write(req + '\n');
    });

    let buf = '';
    sock.on('data', (chunk) => {
      buf += chunk.toString();
      if (buf.includes('\n')) {
        const line = buf.split('\n')[0].trim();
        sock.end();
        try {
          const resp: RpcResponse<T> = JSON.parse(line);
          if (resp.error) {
            reject(new Error(`L1 RPC error: ${JSON.stringify(resp.error)}`));
          } else if (resp.result === undefined) {
            reject(new Error('L1 RPC returned null result'));
          } else {
            resolve(resp.result);
          }
        } catch (e) {
          reject(new Error(`L1 RPC parse error: ${e}`));
        }
      }
    });
    sock.on('error', (e) => reject(new Error(`L1 RPC connect failed: ${e.message}`)));
    sock.setTimeout(10_000, () => {
      sock.destroy();
      reject(new Error('L1 RPC timeout'));
    });
  });
}

async function getChainHeight(): Promise<number> {
  const info = await l1Rpc<{ chain_height: number }>('getChainInfo', {});
  return info.chain_height;
}

async function getBlock(height: number): Promise<L1Block> {
  return l1Rpc<L1Block>('getBlockByHeight', { height });
}

// ── Amount scaling (legacy 1e12 → 1e6) ───────────────────────────────

function scaledAmount(raw: bigint, blockHeight: number): bigint {
  // Pre-migration blocks have 1e12 scale; divide to get 1e6 flower scale
  if (blockHeight < L1_SCALE_FIX_HEIGHT && raw > BigInt(144_000_000) * MIGRATION_DIVISOR) {
    return raw / MIGRATION_DIVISOR;
  }
  return raw;
}

function toBigInt(v: string | number): bigint {
  if (typeof v === 'number') return BigInt(v);
  return BigInt(v);
}

// ── Memo parsing ─────────────────────────────────────────────────────

interface MarketBuyMemo {
  listingId: bigint;
  buyerL2Address: `0x${string}`;
  quantity: bigint;
}

function parseMarketBuyMemo(memo: string | null | undefined): MarketBuyMemo | null {
  if (!memo) return null;
  // Format: MARKETBUY:42:0xBuyerAddress:1
  const parts = memo.split(':');
  if (parts.length < 4 || parts[0] !== 'MARKETBUY') return null;
  const listingId = BigInt(parts[1]);
  const buyerL2Address = parts[2] as `0x${string}`;
  const quantity = BigInt(parts[3]);
  if (!buyerL2Address.startsWith('0x') || buyerL2Address.length !== 42) return null;
  if (quantity <= 0n) return null;
  return { listingId, buyerL2Address, quantity };
}

// ── L2 settlement ────────────────────────────────────────────────────

const MARKETPLACE_ABI = [
  {
    inputs: [
      { name: 'listingId', type: 'uint256' },
      { name: 'buyer', type: 'address' },
      { name: 'quantity', type: 'uint256' },
    ],
    name: 'relayerSettle',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'listingId', type: 'uint256' }],
    name: 'relayerSettleAuction',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

function makeL2Client() {
  if (!L2_MARKETPLACE_ADDR) throw new Error('L2_MARKETPLACE_ADDR not set');
  if (!L2_RELAYER_PRIV_KEY) throw new Error('L2_RELAYER_PRIV_KEY not set');

  const account = privateKeyToAccount(L2_RELAYER_PRIV_KEY);
  const client = createWalletClient({
    account,
    chain: base,
    transport: http(L2_RPC_URL),
  });
  return { client, account };
}

async function settleOnL2(
  listingId: bigint,
  buyer: `0x${string}`,
  quantity: bigint,
): Promise<string> {
  const { client, account } = makeL2Client();
  const txHash = await client.writeContract({
    address: L2_MARKETPLACE_ADDR,
    abi: MARKETPLACE_ABI,
    functionName: 'relayerSettle',
    args: [listingId, buyer, quantity],
    account,
    chain: base,
  });
  console.log(`  → L2 settle tx: ${txHash}`);
  return txHash;
}

// ── Pending settlement tracking ──────────────────────────────────────

interface PendingSettlement {
  txHash: string;
  blockHeight: number;
  sender: string;
  amountFlowers: bigint;
  memo: MarketBuyMemo;
  detectedAt: Date;
}

const pending: Map<string, PendingSettlement> = new Map();
const settled: Set<string> = new Set(); // txHashes already settled

// Persist settled txs to avoid re-settling after restart
const STATE_FILE = path.join(process.cwd(), '.l1-watcher-state.json');

function loadState(): { lastHeight: number; settled: string[] } {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
      for (const h of data.settled ?? []) settled.add(h);
      return { lastHeight: data.lastHeight ?? 0, settled: data.settled ?? [] };
    }
  } catch (e) {
    console.error('Warning: could not load state file:', e);
  }
  return { lastHeight: 0, settled: [] };
}

function saveState(lastHeight: number) {
  try {
    fs.writeFileSync(
      STATE_FILE,
      JSON.stringify({ lastHeight, settled: [...settled] }, null, 2),
    );
  } catch (e) {
    console.error('Warning: could not save state file:', e);
  }
}

// ── Main watcher loop ────────────────────────────────────────────────

let lastProcessedHeight: number;

async function scanBlock(block: L1Block) {
  const processed = new Set<string>();

  // UTXO transactions
  for (const tx of block.utxo_transactions ?? []) {
    const txHash = typeof tx.id === 'string' ? tx.id : Buffer.from(tx.id as number[]).toString('hex');
    if (processed.has(txHash)) continue;
    processed.add(txHash);
    if (settled.has(txHash)) continue;

    for (const output of tx.outputs) {
      if (output.address !== L1_BRIDGE_VAULT) continue;
      const memo = parseMarketBuyMemo(output.memo ?? null);
      if (!memo) continue;

      const sender =
        tx.inputs[0]?.public_key
          ? typeof tx.inputs[0].public_key === 'string'
            ? '(pubkey hex)'
            : '(pubkey bytes)'
          : '(unknown)';

      const amountFlowers = scaledAmount(toBigInt(output.amount), block.height);

      console.log(
        `\n  [L1 LOCK] MARKETBUY detected at height ${block.height}`,
        `\n  TX: ${txHash}`,
        `\n  Listing #${memo.listingId}, buyer ${memo.buyerL2Address}, qty ${memo.quantity}`,
        `\n  Amount: ${amountFlowers} flowers`,
      );

      pending.set(txHash, {
        txHash,
        blockHeight: block.height,
        sender,
        amountFlowers,
        memo,
        detectedAt: new Date(),
      });
    }
  }

  // Account-model transactions
  for (const tx of block.account_transactions ?? []) {
    if (tx.to !== L1_BRIDGE_VAULT) continue;
    if (processed.has(tx.tx_id)) continue;
    processed.add(tx.tx_id);
    if (settled.has(tx.tx_id)) continue;

    const memo = parseMarketBuyMemo(tx.memo ?? null);
    if (!memo) continue;

    const amountFlowers = scaledAmount(toBigInt(tx.amount_zion), block.height);

    console.log(
      `\n  [L1 LOCK] MARKETBUY detected (account tx) at height ${block.height}`,
      `\n  TX: ${tx.tx_id}`,
      `\n  Listing #${memo.listingId}, buyer ${memo.buyerL2Address}, qty ${memo.quantity}`,
      `\n  From: ${tx.from}, Amount: ${amountFlowers} flowers`,
    );

    pending.set(tx.tx_id, {
      txHash: tx.tx_id,
      blockHeight: block.height,
      sender: tx.from,
      amountFlowers,
      memo,
      detectedAt: new Date(),
    });
  }
}

async function checkFinality(currentHeight: number) {
  const finalizedHeight = currentHeight - L1_FINALITY_BLOCKS;
  const toFinalize: string[] = [];

  for (const [txHash, p] of pending) {
    if (p.blockHeight <= finalizedHeight) {
      toFinalize.push(txHash);
    }
  }

  for (const txHash of toFinalize) {
    const p = pending.get(txHash)!;
    console.log(`\n  [FINALIZED] TX ${txHash} — settling on L2...`);

    try {
      await settleOnL2(p.memo.listingId, p.memo.buyerL2Address, p.memo.quantity);
      settled.add(txHash);
      pending.delete(txHash);
      console.log(`  ✅ Settled listing #${p.memo.listingId} for buyer ${p.memo.buyerL2Address}`);
    } catch (e) {
      console.error(`  ❌ L2 settlement failed for ${txHash}:`, e);
      // Keep in pending — will retry next cycle
    }
  }

  if (toFinalize.length > 0) {
    saveState(lastProcessedHeight);
  }
}

async function pollCycle() {
  let currentHeight: number;
  try {
    currentHeight = await getChainHeight();
  } catch (e) {
    console.error('Failed to get chain height:', e);
    return;
  }

  if (currentHeight <= lastProcessedHeight) {
    return;
  }

  const from = lastProcessedHeight + 1;
  const to = currentHeight;
  console.log(`Scanning blocks ${from} → ${to}...`);

  let highestOk = lastProcessedHeight;
  for (let h = from; h <= to; h++) {
    try {
      const block = await getBlock(h);
      await scanBlock(block);
      highestOk = h;
    } catch (e) {
      console.error(`Block ${h} fetch failed, will retry next cycle:`, e);
      break;
    }
  }

  lastProcessedHeight = highestOk;
  saveState(lastProcessedHeight);

  await checkFinality(currentHeight);
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  ZION MarketPlace — L1 Watcher (hybrid L1/L2 settlement)');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  L1 RPC:          ${L1_RPC_URL}`);
  console.log(`  Bridge vault:    ${L1_BRIDGE_VAULT}`);
  console.log(`  Finality:        ${L1_FINALITY_BLOCKS} blocks`);
  console.log(`  Poll interval:   ${L1_POLL_INTERVAL_S}s`);
  console.log(`  L2 RPC:          ${L2_RPC_URL}`);
  console.log(`  L2 Marketplace:  ${L2_MARKETPLACE_ADDR || '(NOT SET)'}`);
  console.log(`  Memo format:     MARKETBUY:<listingId>:<buyerL2Addr>:<qty>`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  const state = loadState();
  lastProcessedHeight = L1_START_HEIGHT ?? state.lastHeight;
  console.log(`Starting from height ${lastProcessedHeight}, ${settled.size} already settled\n`);

  // Main loop
  while (true) {
    try {
      await pollCycle();
    } catch (e) {
      console.error('Poll cycle error:', e);
    }
    await new Promise((r) => setTimeout(r, L1_POLL_INTERVAL_S * 1000));
  }
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
