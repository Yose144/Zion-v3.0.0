// Direct wallet discovery + balance lookup (replaces /api/wallets from app.py).
// Reads PREMINE_ADDRESSES_PUBLIC.txt, node startup logs, .env files, zion.toml,
// then enriches with live on-chain balances via node RPC.

import { Command } from '@tauri-apps/plugin-shell';
import { isTauri } from '../lib/fs';
import { getBalance, getBlockByHeight } from './node';
import { LOCAL_BACKUP_NODE, EDGE_NODE1 } from '../config/services';
import type { Wallet, WalletSummary, WalletsResponse } from '../lib/api';

const REPO_ROOT = '/home/zionserver/2.9.6-main';
const LOG_DIR = `${REPO_ROOT}/logs`;
const FLOWERS_PER_ZION = 1_000_000;

const PREMINE_LABELS = [
  'OASIS + Winners Golden Egg/Xp (Slot 1)',
  'OASIS + Winners Golden Egg/Xp (Slot 2)',
  'OASII + Winners Golden Egg/Xp (Slot 3)',
  'OASIS + Winners Golden Egg/Xp (Slot 4)',
  'OASIS + Winners Golden Egg/Xp (Slot 5)',
  'DAO Treasury — Community Governance (main)',
  'DAO Treasury — Grants & Bounties',
  'DAO Treasury — Ecosystem Bootstrap',
  'Core Development Fund',
  'Network Infrastructure — P2P Seed Nodes',
  'Genesis Projects — Dharma Temple, Piko de Ora + DAO',
  'Children Future Fund — Humanitarian DAO',
];

function flowersToZion(flowers: number | string | undefined): number {
  if (flowers === undefined || flowers === null) return 0;
  const f = typeof flowers === 'string' ? Number(flowers) : flowers;
  return Number.isNaN(f) ? 0 : f / FLOWERS_PER_ZION;
}

async function readFile(path: string): Promise<string | null> {
  if (!isTauri()) return null;
  try {
    const output = await Command.create('cat', [path]).execute();
    if (output.code !== 0) return null;
    return output.stdout;
  } catch {
    return null;
  }
}

async function parsePremineFromGenesis(): Promise<Wallet[]> {
  try {
    const genesis = await getBlockByHeight(LOCAL_BACKUP_NODE, 0);
    if (!genesis?.transactions?.length) {
      // Fallback to Edge RPC
      const edge = await getBlockByHeight(EDGE_NODE1, 0);
      if (!edge?.transactions?.length) return parsePremineFromFile();
      return buildPremineWallets(edge.transactions);
    }
    return buildPremineWallets(genesis.transactions);
  } catch {
    return parsePremineFromFile();
  }
}

function buildPremineWallets(transactions: { to?: string; amount_zion?: number }[]): Wallet[] {
  const wallets: Wallet[] = [];
  transactions.forEach((tx, i) => {
    const addr = tx.to || '';
    const amount = Number(tx.amount_zion || 0);
    wallets.push({
      address: addr,
      label: PREMINE_LABELS[i] ?? `Premine Output ${i + 1}`,
      source: 'genesis',
      category: 'premine',
      amount_zion: flowersToZion(amount),
      balance_zion: null,
      balance_atomic: null,
      rpc_ok: false,
    });
  });
  return wallets;
}

async function parsePremineFromFile(): Promise<Wallet[]> {
  const text = await readFile(`${REPO_ROOT}/PREMINE_ADDRESSES_PUBLIC.txt`);
  if (!text) return [];
  const wallets: Wallet[] = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const m = trimmed.match(/^\s*(\d+)\s+(\S+)\s+(\S+)\s+([0-9,]+)/);
    if (m) {
      const amountStr = m[4].replace(/,/g, '');
      wallets.push({
        address: m[2],
        label: m[3].replace(/_/g, ' '),
        source: 'premine',
        category: 'premine',
        amount_zion: /^\d+$/.test(amountStr) ? Number(amountStr) : 0,
        balance_zion: null,
        balance_atomic: null,
        rpc_ok: false,
      });
    }
  }
  return wallets;
}

async function parseNodeStartupAddresses(): Promise<Record<string, string>> {
  const text = await readFile(`${LOG_DIR}/node-backup.log`);
  if (!text) return {};
  const addresses: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    const patterns: [RegExp, string][] = [
      [/^miner_address=(\S+)/, 'miner'],
      [/^humanitarian_address=(\S+)/, 'humanitarian'],
      [/^issobella_address=(\S+)/, 'issobella'],
      [/^pool_fee_address=(\S+)/, 'pool_fee'],
    ];
    for (const [re, key] of patterns) {
      const m = trimmed.match(re);
      if (m) addresses[key] = m[1];
    }
    if (trimmed.startsWith('p2p_peer_addr=') || trimmed.startsWith('p2p_in=')) break;
  }
  return addresses;
}

async function findEnvValue(key: string): Promise<string> {
  // Try process env first (works in dev if Vite env is injected at build time; limited at runtime)
  try {
    const fromEnv = (import.meta.env as Record<string, string>)[key];
    if (fromEnv) return fromEnv;
  } catch {
    // ignore
  }
  // Scan .env* files in repo root
  if (!isTauri()) return '';
  try {
    const ls = await Command.create('ls', [REPO_ROOT]).execute();
    if (ls.code !== 0) return '';
    const files = ls.stdout.split('\n').filter((f) => f.startsWith('.env') || f.startsWith('env'));
    for (const file of files) {
      const text = await readFile(`${REPO_ROOT}/${file}`);
      if (!text) continue;
      for (const line of text.split('\n')) {
        let l = line.trim();
        if (l.startsWith('#') || !l.includes('=')) continue;
        if (l.startsWith('export ')) l = l.slice(7).trim();
        const [k] = l.split('=');
        if (k.trim() === key) {
          const v = l.slice(l.indexOf('=') + 1).trim();
          return v.replace(/^["']|["']$/g, '');
        }
      }
    }
  } catch {
    // ignore
  }
  return '';
}

async function parseZionTomlMinerWallet(activeMiner: string): Promise<Wallet | null> {
  const text = await readFile(`${REPO_ROOT}/zion.toml`);
  if (!text) return null;
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#')) continue;
    const m = trimmed.match(/wallet\s*=\s*["']?([^"'\s#]+)/);
    if (m) {
      const addr = m[1].trim();
      if (addr && addr !== activeMiner) {
        return {
          address: addr,
          label: 'Remote Config Wallet (zion.toml)',
          source: 'zion.toml',
          category: 'operational',
          balance_zion: null,
          balance_atomic: null,
          rpc_ok: false,
        };
      }
    }
  }
  return null;
}

export async function fetchWallets(): Promise<WalletsResponse> {
  const wallets: Wallet[] = [];

  // 1. Premine
  const premine = await parsePremineFromGenesis();
  wallets.push(...premine);

  // 2. Operational wallets
  const nodeAddrs = await parseNodeStartupAddresses();
  const canonicalPool = 'zion177w668f4g5g8s3t844s3f053k8h7r6d540853g6';
  const opSources: [string | undefined, string, string][] = [
    [canonicalPool, 'Pool Canonical (Main Payout)', 'canonical'],
    [nodeAddrs.miner || (await findEnvValue('ZION_MINER_ADDRESS')), 'Miner Payout', 'node'],
    [nodeAddrs.humanitarian || (await findEnvValue('ZION_HUMANITARIAN_WALLET')), 'Humanitarian Tithe', 'node'],
    [nodeAddrs.issobella || (await findEnvValue('ZION_ISSOBELLA_WALLET')), 'Issobella Fund', 'node'],
    [nodeAddrs.pool_fee || (await findEnvValue('ZION_POOL_FEE_WALLET')), 'Pool Fee Recipient', 'node'],
    [await findEnvValue('ZION_POOL_WALLET'), 'Pool Operational', 'env'],
  ];
  for (let [val, label, src] of opSources) {
    if (!val) continue;
    val = val.trim().replace(/^["']|["']$/g, '');
    if (val && !val.startsWith('$') && val.length > 10 && !wallets.some((w) => w.address === val)) {
      wallets.push({
        address: val,
        label,
        source: src,
        category: 'operational',
        balance_zion: null,
        balance_atomic: null,
        rpc_ok: false,
      });
    }
  }

  // 3. zion.toml miner wallet
  const activeMiner = nodeAddrs.miner || (await findEnvValue('ZION_MINER_ADDRESS'));
  const tomlWallet = await parseZionTomlMinerWallet(activeMiner);
  if (tomlWallet && !wallets.some((w) => w.address === tomlWallet.address)) {
    wallets.push(tomlWallet);
  }

  // 4. Enrich balances via RPC (prefer local, fallback Edge)
  let endpoint = LOCAL_BACKUP_NODE;
  try {
    const ping = await getBalance(endpoint, canonicalPool);
    if (!ping) endpoint = EDGE_NODE1;
  } catch {
    endpoint = EDGE_NODE1;
  }

  let rpcReachable = false;
  for (const w of wallets) {
    if (w.address && w.address.startsWith('zion1')) {
      try {
        const bal = await getBalance(endpoint, w.address);
        rpcReachable = rpcReachable || !!bal;
        if (bal) {
          const atomic = Number(bal.balance_flowers ?? bal.balance_zion ?? 0);
          const zion = bal.balance_zion ? Number(bal.balance_zion) : flowersToZion(atomic);
          w.balance_zion = Number.isNaN(zion) ? 0 : zion;
          w.balance_atomic = atomic;
          w.rpc_ok = true;
        }
      } catch {
        w.balance_zion = null;
        w.balance_atomic = null;
        w.rpc_ok = false;
      }
    }
  }

  const premineTotal = wallets
    .filter((w) => w.category === 'premine')
    .reduce((sum, w) => sum + (w.amount_zion || 0), 0);
  const opTotal = wallets
    .filter((w) => w.category === 'operational')
    .reduce((sum, w) => sum + (w.balance_zion || 0), 0);
  const withBalance = wallets.filter((w) => w.balance_zion !== null).length;

  const categorySummary: Record<string, { count: number; total_zion: number; labels: string[] }> = {};
  for (const w of wallets) {
    const cat = w.category;
    if (!categorySummary[cat]) categorySummary[cat] = { count: 0, total_zion: 0, labels: [] };
    categorySummary[cat].count++;
    categorySummary[cat].total_zion += w.category === 'premine' ? (w.amount_zion || 0) : (w.balance_zion || 0);
    categorySummary[cat].labels.push(w.label);
  }

  return {
    wallets,
    summary: {
      total_wallets: wallets.length,
      premine_wallets: premine.length,
      operational_wallets: wallets.filter((w) => w.category === 'operational').length,
      with_live_balance: withBalance,
      total_premine_zion: premineTotal,
      total_operational_zion: Number(opTotal.toFixed(6)),
    },
    category_summary: categorySummary,
    rpc: { host: endpoint.host, port: endpoint.port, reachable: rpcReachable },
  };
}
