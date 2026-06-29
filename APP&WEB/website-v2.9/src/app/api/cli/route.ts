/**
 * ZION Web CLI API
 *
 * Proxy endpoint for the interactive web terminal on the homepage.
 * Supports read-only commands that mirror the public zion-cli:
 *
 *   Node       — info / chain / peers / supply / mempool
 *   Pool       — stats / miners / blocks / servers
 *   Explorer   — block / tx / address / search / richlist / supply / stats
 *   DeFi       — price / status
 *   Mining     — start / calc / benchmarks
 *   Network    — stats / peers
 *   DAO        — proposals
 *   Bridge     — status
 *   Wallet     — balance
 *   AI         — ask / status
 *   Meta       — help / version / status / about / docs / links / clear
 *
 * No write operations, no private keys, no admin commands.
 * All outbound fetches use AbortSignal.timeout(8000) for robustness.
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getZionRpc } from '@/lib/zion-rpc';
import { coreUrl } from '@/lib/core-endpoints';
import {
  FLOWERS_PER_ZION,
  ATOMIC_UNITS_PER_ZION,
  BLOCK_REWARD_ZION,
  TOTAL_SUPPLY_ZION,
  GENESIS_PREMINE_ZION,
  POOL_FEE_PCT,
  HUMANITARIAN_TITHE_PCT,
  ISSOBELLA_FUND_PCT,
  MINER_SHARE_PCT,
} from '@/lib/constants';
import {
  SITE_VERSION,
  SITE_RUNTIME_VERSION,
  SITE_ENVIRONMENT_LABEL,
  SITE_PRIMARY_HOST,
  SITE_POOL_PRIMARY,
} from '@/lib/site';

// ─── Constants ──────────────────────────────────────────────────────────────

const FETCH_TIMEOUT = 8000;
const CLEAR_MARKER = '__CLEAR__';
const WEB_CLI_VERSION = 'v2.1.0';

interface CliResponse {
  ok: boolean;
  output: string;
  error?: string;
}

// ─── Entry point ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { command } = await req.json();
    if (!command || typeof command !== 'string') {
      return NextResponse.json<CliResponse>(
        { ok: false, output: '', error: 'No command provided. Type "help" for available commands.' },
        { status: 400 },
      );
    }

    const result = await executeCommand(command.trim());
    return NextResponse.json<CliResponse>(result);
  } catch (err: any) {
    return NextResponse.json<CliResponse>(
      { ok: false, output: '', error: err?.message ?? 'Internal error' },
      { status: 500 },
    );
  }
}

// ─── Command dispatcher ─────────────────────────────────────────────────────

async function executeCommand(input: string): Promise<CliResponse> {
  if (!input) {
    return { ok: true, output: formatHelp() };
  }

  const parts = input.split(/\s+/);
  const rawCmd = parts[0] ?? '';
  const cmd = rawCmd.toLowerCase();
  const sub = parts[1]?.toLowerCase();
  const args = parts.slice(2);

  // ─── Aliases ──────────────────────────────────────────────────────────────
  if (cmd === 'ls' || cmd === 'h' || cmd === '?' || cmd === 'commands') {
    return { ok: true, output: formatHelp() };
  }
  if (cmd === 'whoami' || cmd === 'ver') {
    return await handleVersion();
  }
  if (cmd === 'clr' || cmd === 'cls') {
    return { ok: true, output: CLEAR_MARKER };
  }

  // ─── Meta ─────────────────────────────────────────────────────────────────
  if (cmd === 'help') return { ok: true, output: formatHelp() };
  if (cmd === 'version' || cmd === 'v') return await handleVersion();
  if (cmd === 'status') return await handleStatus();
  if (cmd === 'about') return { ok: true, output: formatAbout() };
  if (cmd === 'docs') return { ok: true, output: formatDocs() };
  if (cmd === 'links') return { ok: true, output: formatLinks() };
  if (cmd === 'clear') return { ok: true, output: CLEAR_MARKER };

  // ─── Node ─────────────────────────────────────────────────────────────────
  if (cmd === 'node') return await handleNode(sub);

  // ─── Pool ─────────────────────────────────────────────────────────────────
  if (cmd === 'pool') return await handlePool(sub);

  // ─── Explorer ─────────────────────────────────────────────────────────────
  if (cmd === 'explorer' || cmd === 'ex') return await handleExplorer(sub, args);

  // ─── DeFi ─────────────────────────────────────────────────────────────────
  if (cmd === 'defi') return await handleDefi(sub);

  // ─── CEX ──────────────────────────────────────────────────────────────────
  if (cmd === 'cex') return await handleCex(sub);

  // ─── Mining ───────────────────────────────────────────────────────────────
  if (cmd === 'mine' || cmd === 'mining') return await handleMine(sub, args);

  // ─── Network ──────────────────────────────────────────────────────────────
  if (cmd === 'network' || cmd === 'net') return await handleNetwork(sub);

  // ─── DAO ──────────────────────────────────────────────────────────────────
  if (cmd === 'dao') return await handleDao(sub);

  // ─── Bridge ───────────────────────────────────────────────────────────────
  if (cmd === 'bridge') return await handleBridge();

  // ─── AI ───────────────────────────────────────────────────────────────────
  if (cmd === 'ai') return await handleAi(sub, args);

  // ─── Wallet ───────────────────────────────────────────────────────────────
  if (cmd === 'wallet') return await handleWallet(sub, args);

  return {
    ok: false,
    output: '',
    error: `Unknown command: "${rawCmd}". Type 'help' for available commands.`,
  };
}

// ─── Fetch helpers ──────────────────────────────────────────────────────────

/** Base URL for internal API calls (server-side fetch needs absolute URLs). */
const INTERNAL_BASE = process.env.INTERNAL_API_BASE || `http://127.0.0.1:${process.env.PORT || 3000}`;

async function fetchJson<T = any>(url: string, init?: RequestInit, timeoutMs = FETCH_TIMEOUT): Promise<{ ok: boolean; status: number; data: T | null }> {
  try {
    const absUrl = url.startsWith('http') ? url : `${INTERNAL_BASE}${url}`;
    const res = await fetch(absUrl, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return { ok: false, status: res.status, data: null };
    const data = (await res.json()) as T;
    return { ok: true, status: res.status, data };
  } catch (e: any) {
    return { ok: false, status: 0, data: null };
  }
}

/** Fetch with extended timeout for endpoints that do heavy RPC work (e.g. pool stats). */
async function fetchJsonSlow<T = any>(url: string): Promise<{ ok: boolean; status: number; data: T | null }> {
  return fetchJson<T>(url, undefined, 30000);
}

function isValidAddress(addr?: string): boolean {
  return !!addr && addr.startsWith('zion1') && addr.length >= 44;
}

function formatHashrate(h: number): string {
  if (!h || h <= 0) return '0 H/s';
  if (h >= 1e12) return `${(h / 1e12).toFixed(2)} TH/s`;
  if (h >= 1e9) return `${(h / 1e9).toFixed(2)} GH/s`;
  if (h >= 1e6) return `${(h / 1e6).toFixed(2)} MH/s`;
  if (h >= 1e3) return `${(h / 1e3).toFixed(2)} kH/s`;
  return `${h.toFixed(0)} H/s`;
}

function formatNum(n: number | undefined | null, digits = 2): string {
  if (n == null || isNaN(n)) return '—';
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function formatTimeAgo(unixSeconds: number): string {
  if (!unixSeconds) return '—';
  const diff = Math.floor(Date.now() / 1000 - unixSeconds);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function formatDuration(seconds: number): string {
  if (!seconds) return '—';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// ─── Meta handlers ──────────────────────────────────────────────────────────

async function handleVersion(): Promise<CliResponse> {
  let nodeProtocol = '—';
  try {
    const rpc = getZionRpc();
    const info = await rpc.getInfo();
    nodeProtocol = info.version || '—';
  } catch {
    nodeProtocol = '(node unreachable)';
  }

  return {
    ok: true,
    output: [
      'ZION Web CLI',
      '',
      `  web-cli version:     ${WEB_CLI_VERSION}`,
      `  site version:        ${SITE_VERSION}`,
      `  runtime version:     ${SITE_RUNTIME_VERSION}`,
      `  node protocol:       ${nodeProtocol}`,
      `  environment:         ${SITE_ENVIRONMENT_LABEL}`,
      `  flowers_per_zion:    ${FLOWERS_PER_ZION.toLocaleString()} (1 ZION = 1,000,000 flowers)`,
      `  total supply cap:    ${TOTAL_SUPPLY_ZION.toLocaleString()} ZION`,
      `  genesis premine:     ${GENESIS_PREMINE_ZION.toLocaleString()} ZION`,
      `  block reward:        ${BLOCK_REWARD_ZION} ZION (Decade 1)`,
      '',
      'Type "help" for all commands.',
    ].join('\n'),
  };
}

async function handleStatus(): Promise<CliResponse> {
  const lines: string[] = ['ZION Network Status', ''];

  // Node RPC
  lines.push('── Node RPC ──');
  let nodeOnline = false;
  try {
    const rpc = getZionRpc();
    const info = await rpc.getInfo();
    nodeOnline = true;
    lines.push(`  ✓ Online — height ${info.height}, ${info.tx_pool_size} mempool txs`);
    lines.push(`    Network:    ${info.nettype}`);
    lines.push(`    Protocol:   ${info.version ?? '—'}`);
    lines.push(`    Tip:        ${info.top_block_hash?.slice(0, 24) ?? '—'}...`);
    lines.push(`    Peers:      ${info.outgoing_connections_count}`);
    lines.push(`    Difficulty: ${formatNum(info.difficulty, 0)}`);
  } catch (e: any) {
    lines.push(`  ✗ Offline — ${e.message}`);
  }

  // Pool
  lines.push('', '── Mining Pool ──');
  let poolOnline = false;
  try {
    const { ok, data } = await fetchJsonSlow<any>('/api/pool/stats');
    if (ok && data) {
      poolOnline = true;
      const agg = data.aggregate ?? {};
      const runtime = data.runtime ?? {};
      const pplns = data.pplns ?? {};
      const fee = data.fee ?? {};
      const feeBal = fee.balances ?? {};
      lines.push(`  ✓ Online — ${SITE_POOL_PRIMARY}`);
      lines.push(`    Hashrate:       ${formatHashrate(agg.hashrate ?? runtime.network_hashrate ?? 0)}`);
      lines.push(`    Active miners: ${agg.active_miners ?? 0}`);
      lines.push(`    Blocks found:  ${agg.blocks_found ?? 0}`);
      lines.push(`    Share eff:     ${agg.share_efficiency ?? '—'}%`);
      lines.push(`    Total paid:    ${formatNum(pplns.total_paid_zion, 4)} ZION (${pplns.payout_rounds ?? 0} rounds)`);
      lines.push(`    Fee split:     ${fee.miner_share ?? MINER_SHARE_PCT}/${fee.humanitarian_tithe ?? HUMANITARIAN_TITHE_PCT}/${fee.issobella_fund ?? ISSOBELLA_FUND_PCT}/${fee.pool_fee ?? POOL_FEE_PCT} (miner/hum/isso/burn)`);
      lines.push(`    Pool wallet:   ${formatNum(feeBal.pool?.balance_zion ?? 0, 2)} ZION`);
      lines.push(`    Humanitarian:  ${formatNum(feeBal.humanitarian?.balance_zion ?? 0, 2)} ZION`);
      lines.push(`    Issobella:     ${formatNum(feeBal.issobella?.balance_zion ?? 0, 2)} ZION`);
      lines.push(`    Burned (1%):   ${formatNum(fee.burned_total_zion ?? 0, 2)} ZION`);
    } else {
      lines.push(`  ⚠ Pool stats unavailable (stratum on ${SITE_POOL_PRIMARY})`);
    }
  } catch {
    lines.push(`  ⚠ Pool probe failed — stratum on ${SITE_POOL_PRIMARY}`);
  }

  // DeFi
  lines.push('', '── DeFi ──');
  try {
    const { ok, data } = await fetchJson<any>('/api/defi/price');
    if (ok && data?.price) {
      lines.push(`  ✓ Price feed online — ${data.source ?? 'live'}`);
      lines.push(`    ZION/USD: $${formatNum(data.price.usd_per_wzion, 6)}`);
      lines.push(`    ZION/ETH: ${formatNum(data.price.weth_per_wzion, 8)}`);
    } else {
      lines.push('  ⚠ Price feed unavailable');
    }
  } catch {
    lines.push('  ⚠ Price feed unavailable');
  }

  // Bridge
  lines.push('', '── Bridge ──');
  try {
    const { ok, data } = await fetchJson<any>('/api/bridge/status');
    if (ok && data) {
      lines.push(`  ${data.online ? '✓' : '✗'} ${data.online ? 'Online' : 'Offline'}`);
      if (data.online) {
        lines.push(`    Uptime:        ${formatDuration(data.uptime_seconds)}`);
        lines.push(`    L1 locks:      ${data.l1_locks_detected ?? 0}`);
        lines.push(`    EVM mints:     ${data.evm_mints_confirmed ?? 0}`);
      }
    } else {
      lines.push('  ⚠ Bridge status unavailable');
    }
  } catch {
    lines.push('  ⚠ Bridge status unavailable');
  }

  // CEX + DEX
  lines.push('', '── CEX + DEX ──');
  try {
    const { ok, data } = await fetchJson<any>('/api/cex/listings');
    if (ok && data) {
      const listed = data.cex?.summary?.listed ?? 0;
      const total = data.cex?.summary?.total_exchanges ?? 0;
      lines.push(`  CEX: ${listed}/${total} listed, ${data.cex?.summary?.planned ?? 0} planned`);
      const dex = data.dex;
      if (dex) {
        lines.push(`  DEX: ${dex.pairs ?? 0} pairs, ${formatVolume(dex.total_volume_24h ?? 0)} vol/24h, ${formatVolume(dex.total_liquidity_usd ?? 0)} liq`);
        lines.push(`  Price: $${(dex.best_price_usd ?? 0).toFixed(6)} (${dex.source ?? 'unknown'})`);
      }
    } else {
      lines.push('  ⚠ CEX data unavailable');
    }
  } catch {
    lines.push('  ⚠ CEX data unavailable');
  }

  // AI (Hiran)
  lines.push('', '── Hiran AI ──');
  try {
    const aiUrl = coreUrl('hiranInference', 'http://127.0.0.1:8002');
    const res = await fetch(`${aiUrl}/health`, { signal: AbortSignal.timeout(FETCH_TIMEOUT) });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      lines.push(`  ✓ Online — ${aiUrl}`);
      lines.push(`    Model: ${data.model ?? 'hiran-v2.2'}`);
    } else {
      lines.push(`  ⚠ Offline (HTTP ${res.status}) — inference service not running`);
    }
  } catch (e: any) {
    lines.push(`  ⚠ Offline — inference service not running on this node`);
  }

  // Website
  lines.push('', '── Website ──');
  lines.push(`  ✓ Online — https://zionterranova.com`);
  lines.push(`    Version: ${SITE_VERSION}`);

  lines.push('');
  return { ok: true, output: lines.join('\n') };
}

// ─── Node handlers ──────────────────────────────────────────────────────────

async function handleNode(sub?: string): Promise<CliResponse> {
  const rpc = getZionRpc();

  if (!sub) {
    return {
      ok: false,
      output: '',
      error: 'Usage: node <subcommand>. Try: info, chain, peers, supply, mempool',
    };
  }

  if (sub === 'info') {
    try {
      const info = await rpc.getInfo();
      return { ok: true, output: formatNodeInfo(info) };
    } catch (e: any) {
      return { ok: false, output: '', error: `Node is temporarily unreachable (${e.message}). The node may be busy or syncing. Try 'status' for a quick health check.` };
    }
  }

  if (sub === 'chain') {
    try {
      const info = await rpc.getInfo();
      const lastBlock = await rpc.getLastBlockHeader().catch(() => null);
      return { ok: true, output: formatChainInfo(info, lastBlock) };
    } catch (e: any) {
      return { ok: false, output: '', error: `Node is temporarily unreachable (${e.message}). Try 'status' for a quick health check.` };
    }
  }

  if (sub === 'peers') {
    try {
      const peers = await rpc.getConnections();
      return { ok: true, output: formatPeers(peers) };
    } catch (e: any) {
      return { ok: false, output: '', error: `Node is temporarily unreachable (${e.message}). Try 'status' for a quick health check.` };
    }
  }

  if (sub === 'supply') {
    try {
      const info = await rpc.getInfo();
      const summary = await rpc.getNetworkSummary().catch(() => null);
      return { ok: true, output: formatSupply(info, summary) };
    } catch (e: any) {
      return { ok: false, output: '', error: `Node is temporarily unreachable (${e.message}). Try 'status' for a quick health check.` };
    }
  }

  if (sub === 'mempool') {
    try {
      const mempool = await rpc.getTransactionPool();
      return { ok: true, output: formatMempool(mempool) };
    } catch (e: any) {
      return { ok: false, output: '', error: `Node is temporarily unreachable (${e.message}). Try 'status' for a quick health check.` };
    }
  }

  return {
    ok: false,
    output: '',
    error: `Unknown node subcommand: "${sub}". Try: info, chain, peers, supply, mempool`,
  };
}

// ─── Pool handlers ──────────────────────────────────────────────────────────

async function handlePool(sub?: string): Promise<CliResponse> {
  if (!sub) {
    return {
      ok: false,
      output: '',
      error: 'Usage: pool <subcommand>. Try: stats, miners, blocks, servers, payouts',
    };
  }

  const { ok, data, status } = await fetchJsonSlow<any>('/api/pool/stats');
  if (!ok || !data) {
    return {
      ok: false,
      output: '',
      error: `Pool stats temporarily unavailable (the pool API may be under load). Try 'status' for a quick health check.`,
    };
  }

  if (sub === 'stats') return { ok: true, output: formatPoolStats(data) };
  if (sub === 'miners') return { ok: true, output: formatPoolMiners(data) };
  if (sub === 'blocks') return { ok: true, output: formatPoolBlocks(data) };
  if (sub === 'servers') return { ok: true, output: formatPoolServers(data) };
  if (sub === 'payouts' || sub === 'fees') return { ok: true, output: formatPoolPayouts(data) };

  return {
    ok: false,
    output: '',
    error: `Unknown pool subcommand: "${sub}". Try: stats, miners, blocks, servers, payouts`,
  };
}

// ─── Explorer handlers ──────────────────────────────────────────────────────

async function handleExplorer(sub?: string, args?: string[]): Promise<CliResponse> {
  if (!sub) {
    return {
      ok: false,
      output: '',
      error: 'Usage: explorer <subcommand>. Try: block <height>, tx <hash>, address <zion1...>, search <query>, richlist, supply, stats',
    };
  }

  if (sub === 'block') {
    const heightOrHash = args?.[0];
    if (!heightOrHash) {
      return { ok: false, output: '', error: 'Usage: explorer block <height|hash>' };
    }
    const param = /^\d+$/.test(heightOrHash) ? `height=${heightOrHash}` : `hash=${encodeURIComponent(heightOrHash)}`;
    const { ok: okRes, data, status } = await fetchJsonSlow<any>(`/api/blockchain/block?${param}`);
    if (!okRes || !data) {
      return { ok: false, output: '', error: `Block not found. Check the height/hash and try again.` };
    }
    return { ok: true, output: formatBlock(data) };
  }

  if (sub === 'tx' || sub === 'transaction') {
    const hash = args?.[0];
    if (!hash) {
      return { ok: false, output: '', error: 'Usage: explorer tx <tx_hash>' };
    }
    const { ok: okRes, data, status } = await fetchJsonSlow<any>(`/api/blockchain/transactions?tx_hash=${encodeURIComponent(hash)}`);
    if (!okRes || !data) {
      return { ok: false, output: '', error: `Transaction not found. Verify the hash (64 hex chars).` };
    }
    return { ok: true, output: formatTx(data) };
  }

  if (sub === 'address' || sub === 'addr') {
    const addr = args?.[0];
    if (!isValidAddress(addr)) {
      return { ok: false, output: '', error: 'Usage: explorer address <zion1...>. Address must start with "zion1" and be at least 44 chars.' };
    }
    const { ok: okRes, data, status } = await fetchJsonSlow<any>(`/api/blockchain/address?address=${encodeURIComponent(addr!)}`);
    if (!okRes || !data) {
      return { ok: false, output: '', error: `Address lookup failed. The blockchain API may be busy.` };
    }
    return { ok: true, output: formatAddress(data) };
  }

  if (sub === 'search') {
    const query = (args ?? []).join(' ');
    if (!query) {
      return { ok: false, output: '', error: 'Usage: explorer search <query>. Query can be a block height, hash, tx hash, or address.' };
    }
    const { ok: okRes, data } = await fetchJsonSlow<any>(`/api/blockchain/search?q=${encodeURIComponent(query)}`);
    if (!okRes || !data) {
      return { ok: false, output: '', error: 'Search failed. Try a block height, hash, tx hash, or zion1 address.' };
    }
    return { ok: true, output: formatSearch(data, query) };
  }

  if (sub === 'richlist') {
    const { ok: okRes, data, status } = await fetchJsonSlow<any>(`/api/blockchain/richlist?limit=10`);
    if (!okRes || !data) {
      return { ok: false, output: '', error: `Rich list temporarily unavailable. The blockchain API may be busy.` };
    }
    return { ok: true, output: formatRichlist(data) };
  }

  if (sub === 'supply') {
    const { ok: okRes, data, status } = await fetchJsonSlow<any>(`/api/blockchain/stats`);
    if (!okRes || !data) {
      return { ok: false, output: '', error: `Supply info temporarily unavailable. Try 'node supply' instead.` };
    }
    return { ok: true, output: formatSupplyStats(data) };
  }

  if (sub === 'stats') {
    const { ok: okRes, data, status } = await fetchJsonSlow<any>(`/api/blockchain/stats`);
    if (!okRes || !data) {
      return { ok: false, output: '', error: `Blockchain stats temporarily unavailable. The blockchain API may be busy.` };
    }
    return { ok: true, output: formatBlockchainStats(data) };
  }

  return {
    ok: false,
    output: '',
    error: `Unknown explorer subcommand: "${sub}". Try: block, tx, address, search, richlist, supply, stats`,
  };
}

// ─── DeFi handlers ──────────────────────────────────────────────────────────

async function handleDefi(sub?: string): Promise<CliResponse> {
  if (!sub) {
    return {
      ok: false,
      output: '',
      error: 'Usage: defi <subcommand>. Try: price, pools, status',
    };
  }

  if (sub === 'price') {
    const { ok, data, status } = await fetchJsonSlow<any>('/api/defi/price');
    if (!ok || !data) {
      return { ok: false, output: '', error: `Price feed temporarily unavailable.` };
    }
    return { ok: true, output: formatDefiPrice(data) };
  }

  if (sub === 'pools') {
    const { ok, data, status } = await fetchJsonSlow<any>('/api/defi/pools');
    if (!ok || !data) {
      return { ok: false, output: '', error: `Pool stats temporarily unavailable.` };
    }
    return { ok: true, output: formatDefiPools(data) };
  }

  if (sub === 'status') {
    const { ok, data, status } = await fetchJsonSlow<any>('/api/defi/status');
    if (!ok || !data) {
      return { ok: false, output: '', error: `DeFi status temporarily unavailable.` };
    }
    return { ok: true, output: formatDefiStatus(data) };
  }

  return {
    ok: false,
    output: '',
    error: `Unknown defi subcommand: "${sub}". Try: price, pools, status`,
  };
}

// ─── CEX handlers ────────────────────────────────────────────────────────────

async function handleCex(sub?: string): Promise<CliResponse> {
  if (!sub) {
    return {
      ok: false,
      output: '',
      error: 'Usage: cex <subcommand>. Try: listings, dex, status',
    };
  }

  if (sub === 'listings' || sub === 'ls') {
    const { ok, data } = await fetchJson<any>('/api/cex/listings');
    if (!ok || !data) {
      return { ok: false, output: '', error: 'CEX listings unavailable.' };
    }
    const lines: string[] = ['── CEX Listings ──', ''];
    for (const ex of data.cex?.listings ?? []) {
      const statusIcon = ex.status === 'listed' ? '✓' : ex.status === 'planned' ? '○' : '!';
      lines.push(`  ${statusIcon} ${ex.name.padEnd(12)} [${ex.status.toUpperCase()}]  pairs: ${ex.pairs.join(', ')}  kyc: ${ex.kyc_required ? 'yes' : 'no'}`);
      if (ex.notes) lines.push(`    └ ${ex.notes}`);
    }
    lines.push('', `  Total: ${data.cex?.summary?.total_exchanges ?? 0} exchanges, ${data.cex?.summary?.listed ?? 0} listed, ${data.cex?.summary?.planned ?? 0} planned`);
    return { ok: true, output: lines.join('\n') };
  }

  if (sub === 'dex') {
    const { ok, data } = await fetchJson<any>('/api/cex/listings');
    if (!ok || !data) {
      return { ok: false, output: '', error: 'DEX data unavailable.' };
    }
    const dex = data.dex;
    const lines: string[] = [
      '── DEX Trading (Uniswap V3 · Base) ──',
      '',
      `  Source:       ${dex?.source ?? 'unknown'}`,
      `  Pairs:        ${dex?.pairs ?? 0}`,
      `  Volume 24h:   ${formatVolume(dex?.total_volume_24h ?? 0)}`,
      `  Liquidity:    ${formatVolume(dex?.total_liquidity_usd ?? 0)}`,
      `  Txns 24h:     ${dex?.total_txns_24h ?? 0} (${dex?.total_buys_24h ?? 0} buys / ${dex?.total_sells_24h ?? 0} sells)`,
      `  Best price:   $${(dex?.best_price_usd ?? 0).toFixed(6)}`,
    ];
    if (dex?.pairs_detail && dex.pairs_detail.length > 0) {
      lines.push('', '  ── Per-pair breakdown ──');
      for (const p of dex.pairs_detail) {
        const change = p.price_change_24h >= 0 ? `+${p.price_change_24h.toFixed(2)}%` : `${p.price_change_24h.toFixed(2)}%`;
        lines.push(`  ${p.pair.padEnd(16)} $${p.price_usd.toFixed(6)}  ${change}  liq: ${formatVolume(p.liquidity_usd)}  vol: ${formatVolume(p.volume_24h)}`);
      }
    }
    lines.push('', '  Trade: https://app.uniswap.org/swap?chain=base');
    return { ok: true, output: lines.join('\n') };
  }

  if (sub === 'status') {
    const { ok, data } = await fetchJson<any>('/api/cex/listings');
    if (!ok || !data) {
      return { ok: false, output: '', error: 'CEX status unavailable.' };
    }
    const lines: string[] = [
      '── CEX + DEX Status ──',
      '',
      `  CEX: ${data.cex?.summary?.listed ?? 0}/${data.cex?.summary?.total_exchanges ?? 0} listed, ${data.cex?.summary?.planned ?? 0} planned`,
      `  DEX: ${data.dex?.pairs ?? 0} pairs, ${formatVolume(data.dex?.total_volume_24h ?? 0)} vol/24h, ${formatVolume(data.dex?.total_liquidity_usd ?? 0)} liquidity`,
      `  Price: $${(data.dex?.best_price_usd ?? 0).toFixed(6)}`,
      `  Source: ${data.dex?.source ?? 'unknown'}`,
    ];
    return { ok: true, output: lines.join('\n') };
  }

  return {
    ok: false,
    output: '',
    error: `Unknown cex subcommand: "${sub}". Try: listings, dex, status`,
  };
}

function formatVolume(v: number): string {
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(2)}K`;
  return `$${v.toFixed(2)}`;
}

// ─── Mining handlers ────────────────────────────────────────────────────────

async function handleMine(sub?: string, args?: string[]): Promise<CliResponse> {
  if (!sub) {
    return {
      ok: false,
      output: '',
      error: 'Usage: mine <subcommand>. Try: start, calc <hashrate>, benchmarks',
    };
  }

  if (sub === 'start') return { ok: true, output: formatMineStart() };

  if (sub === 'calc' || sub === 'calculator') {
    const hashrateInput = args?.[0];
    if (!hashrateInput) {
      return { ok: false, output: '', error: 'Usage: mine calc <hashrate>. Examples: "mine calc 100M", "mine calc 18KH", "mine calc 500"' };
    }
    return await handleMineCalc(hashrateInput);
  }

  if (sub === 'benchmarks' || sub === 'bench') return { ok: true, output: formatBenchmarks() };

  return {
    ok: false,
    output: '',
    error: `Unknown mine subcommand: "${sub}". Try: start, calc <hashrate>, benchmarks`,
  };
}

function parseHashrate(input: string): number | null {
  const m = input.trim().toLowerCase().match(/^([\d.]+)\s*([kmgt]?h?s?\/?)?$/);
  if (!m) return null;
  const value = parseFloat(m[1]);
  if (isNaN(value)) return null;
  const unit = (m[2] ?? '').replace(/h?s?\/?$/, '').replace('h', '');
  switch (unit) {
    case '': return value;
    case 'k': return value * 1e3;
    case 'm': return value * 1e6;
    case 'g': return value * 1e9;
    case 't': return value * 1e12;
    default: return null;
  }
}

async function handleMineCalc(hashrateInput: string): Promise<CliResponse> {
  const userHashrate = parseHashrate(hashrateInput);
  if (userHashrate == null || userHashrate <= 0) {
    return {
      ok: false,
      output: '',
      error: `Could not parse hashrate "${hashrateInput}". Try formats like "100M", "18KH", "2.5GH", or "500".`,
    };
  }

  // Fetch pool stats (for pool hashrate + blocks) and price in parallel
  const [poolRes, priceRes] = await Promise.all([
    fetchJsonSlow<any>('/api/pool/stats'),
    fetchJson<any>('/api/defi/price'),
  ]);

  const poolHashrate = poolRes.data?.aggregate?.hashrate ?? poolRes.data?.runtime?.network_hashrate ?? 0;
  const networkHashrate = poolRes.data?.runtime?.network_hashrate ?? poolHashrate ?? 0;
  const blocksPerDay = 86400 / 60; // 60s target block time → 1440 blocks/day
  const blockReward = BLOCK_REWARD_ZION;
  const dailyRewardZion = blocksPerDay * blockReward;

  // Share of network hashrate
  const effectiveHashrate = networkHashrate > 0 ? networkHashrate : poolHashrate;
  const userShare = effectiveHashrate > 0 ? userHashrate / effectiveHashrate : 0;
  const dailyZion = userShare * dailyRewardZion;
  const monthlyZion = dailyZion * 30;
  const yearlyZion = dailyZion * 365;

  const usdPerZion = priceRes.data?.price?.usd_per_wzion ?? 0;
  const dailyUsd = dailyZion * usdPerZion;
  const monthlyUsd = monthlyZion * usdPerZion;

  const lines: string[] = [
    'Mining Reward Calculator',
    '',
    `  Your hashrate:        ${formatHashrate(userHashrate)}`,
    `  Network hashrate:     ${formatHashrate(effectiveHashrate)}`,
    `  Your share:           ${(userShare * 100).toFixed(6)}%`,
    `  Block reward:         ${blockReward} ZION`,
    `  Blocks/day:           ${blocksPerDay.toFixed(0)} (60s target)`,
    '',
    '── Estimated Rewards ──',
    `  Daily:     ${formatNum(dailyZion, 6)} ZION  ($${formatNum(dailyUsd, 2)})`,
    `  Monthly:   ${formatNum(monthlyZion, 4)} ZION  ($${formatNum(monthlyUsd, 2)})`,
    `  Yearly:    ${formatNum(yearlyZion, 2)} ZION  ($${formatNum(yearlyZion * usdPerZion, 2)})`,
    '',
    `  ZION/USD used:  $${formatNum(usdPerZion, 6)}`,
    '',
    'Note: Estimates assume constant network hashrate and 100% uptime.',
    'Pool fees and PPLNS variance will reduce actual rewards.',
  ];

  return { ok: true, output: lines.join('\n') };
}

// ─── Network handlers ───────────────────────────────────────────────────────

async function handleNetwork(sub?: string): Promise<CliResponse> {
  if (!sub || sub === 'stats' || sub === 'overview') {
    const { ok, data, status } = await fetchJson<any>('/api/network');
    if (!ok || !data) {
      return { ok: false, output: '', error: `Network status temporarily unavailable.` };
    }
    return { ok: true, output: formatNetworkStats(data) };
  }

  if (sub === 'peers') {
    try {
      const rpc = getZionRpc();
      const peers = await rpc.getConnections();
      return { ok: true, output: formatNetworkPeers(peers) };
    } catch (e: any) {
      return { ok: false, output: '', error: `Node is temporarily unreachable (${e.message}). Try 'status' for a quick health check.` };
    }
  }

  return {
    ok: false,
    output: '',
    error: `Unknown network subcommand: "${sub}". Try: stats, peers`,
  };
}

// ─── DAO handlers ───────────────────────────────────────────────────────────

async function handleDao(sub?: string): Promise<CliResponse> {
  if (!sub || sub === 'proposals' || sub === 'list') {
    const { ok, data, status } = await fetchJson<any>('/api/dao/proposals?limit=20&status=Active');
    if (!ok || data == null) {
      if (data && data.note) {
        return { ok: false, output: '', error: `DAO API offline: ${data.note}` };
      }
      return { ok: false, output: '', error: `DAO proposals temporarily unavailable.` };
    }
    const proposals = data?.proposals ?? data?.data?.proposals ?? (Array.isArray(data) ? data : []);
    return { ok: true, output: formatDaoProposals(proposals) };
  }

  return {
    ok: false,
    output: '',
    error: `Unknown dao subcommand: "${sub}". Try: proposals`,
  };
}

// ─── Bridge handler ─────────────────────────────────────────────────────────

async function handleBridge(): Promise<CliResponse> {
  const { ok, data, status } = await fetchJson<any>('/api/bridge/status');
  if (!ok || !data) {
    return { ok: false, output: '', error: `Bridge status temporarily unavailable.` };
  }
  return { ok: true, output: formatBridge(data) };
}

// ─── AI handlers ────────────────────────────────────────────────────────────

async function handleAi(sub?: string, args?: string[]): Promise<CliResponse> {
  if (sub === 'status') {
    try {
      const aiUrl = coreUrl('hiranInference', 'http://127.0.0.1:8002');
      const res = await fetch(`${aiUrl}/health`, { signal: AbortSignal.timeout(FETCH_TIMEOUT) });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        return {
          ok: true,
          output: [
            'Hiran AI Status',
            `  Endpoint: ${aiUrl}`,
            `  Status:   Online`,
            `  Model:    ${data.model ?? 'hiran-v2.2'}`,
          ].join('\n'),
        };
      }
      return { ok: false, output: '', error: `Hiran AI is currently offline (HTTP ${res.status}). The inference service may not be running.` };
    } catch (e: any) {
      return { ok: false, output: '', error: `Hiran AI is currently offline. The inference service may not be running on this node.` };
    }
  }

  if (sub === 'ask') {
    const question = (args ?? []).join(' ');
    if (!question) {
      return { ok: false, output: '', error: 'Usage: ai ask "your question". Example: ai ask "What is the ZION consensus algorithm?"' };
    }
    try {
      const res = await fetch(`${INTERNAL_BASE}/api/ai-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: question }),
        signal: AbortSignal.timeout(120000),
      });
      if (!res.ok) throw new Error(`AI chat HTTP ${res.status}`);
      const data = await res.json();
      const answer = data.response ?? data.answer ?? data.content ?? 'No response';
      return { ok: true, output: `Hiran: ${answer}` };
    } catch (e: any) {
      return { ok: false, output: '', error: `AI request failed. The inference service may be offline. Try 'ai status' to check.` };
    }
  }

  return {
    ok: false,
    output: '',
    error: `Unknown ai subcommand: "${sub}". Try: ask "question", status`,
  };
}

// ─── Wallet handlers ────────────────────────────────────────────────────────

async function handleWallet(sub?: string, args?: string[]): Promise<CliResponse> {
  if (sub === 'balance') {
    const address = (args ?? [])[0];
    if (!isValidAddress(address)) {
      return {
        ok: false,
        output: '',
        error: 'Usage: wallet balance <zion1...address>. Address must start with "zion1" and be at least 44 chars.',
      };
    }
    try {
      const rpc = getZionRpc();
      const balance = await rpc.getAddressBalance(address!);
      return {
        ok: true,
        output: [
          'Wallet Balance',
          `  Address:  ${address}`,
          `  Balance:  ${balance.balance_zion ?? 0} ZION`,
          `  UTXOs:    ${balance.utxo_count ?? 0}`,
        ].join('\n'),
      };
    } catch (e: any) {
      return { ok: false, output: '', error: `Node is temporarily unreachable (${e.message}). Try 'status' for a quick health check.` };
    }
  }

  if (sub === 'address' || sub === 'info' || sub === 'new' || sub === 'import') {
    return {
      ok: true,
      output: [
        'Wallet operations requiring private keys are not available in the web terminal.',
        'Use the desktop CLI for full wallet management:',
        '  zion wallet new       Create a new wallet',
        '  zion wallet import    Import a wallet from seed',
        '  zion wallet balance   Check balance (also available here: wallet balance <addr>)',
      ].join('\n'),
    };
  }

  return {
    ok: false,
    output: '',
    error: `Unknown wallet subcommand: "${sub}". Try: balance <zion1...address>`,
  };
}

// ─── Formatters: Meta ───────────────────────────────────────────────────────

function formatHelp(): string {
  const groups: Array<{ name: string; cmds: Array<[string, string]> }> = [
    {
      name: 'Node',
      cmds: [
        ['node info', 'Node info (version, network, peers, difficulty)'],
        ['node chain', 'Chain info (height, tip, mempool)'],
        ['node peers', 'Connected peers'],
        ['node supply', 'Supply info (emission, block reward)'],
        ['node mempool', 'Mempool transactions'],
      ],
    },
    {
      name: 'Pool',
      cmds: [
        ['pool stats', 'Pool hashrate, miners, blocks, PPLNS, fee wallets'],
        ['pool miners', 'Top 10 active miners'],
        ['pool blocks', 'Recent 10 blocks found'],
        ['pool servers', 'Pool servers and online status'],
        ['pool payouts', 'Fee split, on-chain wallet balances, burned total'],
      ],
    },
    {
      name: 'Explorer',
      cmds: [
        ['explorer block <height>', 'Block details by height or hash'],
        ['explorer tx <hash>', 'Transaction details by hash'],
        ['explorer address <zion1...>', 'Address balance and txs'],
        ['explorer search <query>', 'Search block/tx/address'],
        ['explorer richlist', 'Top 10 richest addresses'],
        ['explorer supply', 'Circulating/total/mined supply'],
        ['explorer stats', 'Network statistics'],
      ],
    },
    {
      name: 'DeFi',
      cmds: [
        ['defi price', 'ZION price in USD/ETH + TVL'],
        ['defi pools', 'Uniswap V3 pool stats (liquidity, TVL, NFTs)'],
        ['defi status', 'DeFi protocol status (wZION, bridge, staking)'],
      ],
    },
    {
      name: 'CEX',
      cmds: [
        ['cex listings', 'CEX exchange listing status'],
        ['cex dex', 'DEX trading data (DexScreener)'],
        ['cex status', 'CEX + DEX summary'],
      ],
    },
    {
      name: 'Mining',
      cmds: [
        ['mine start', 'Quick-start mining guide'],
        ['mine calc <hashrate>', 'Reward calculator (e.g. "100M", "18KH", "2.5GH")'],
        ['mine benchmarks', 'Hardware benchmark table'],
      ],
    },
    {
      name: 'Network',
      cmds: [
        ['network stats', 'Network overview (nodes, hashrate, sync)'],
        ['network peers', 'Detailed peer list'],
      ],
    },
    {
      name: 'DAO & Bridge',
      cmds: [
        ['dao proposals', 'Active governance proposals'],
        ['bridge status', 'L1<->EVM bridge relay status'],
      ],
    },
    {
      name: 'Wallet',
      cmds: [
        ['wallet balance <zion1...>', 'Check address balance'],
      ],
    },
    {
      name: 'AI',
      cmds: [
        ['ai ask "..."', 'Ask Hiran AI a question'],
        ['ai status', 'Check Hiran AI endpoint health'],
      ],
    },
    {
      name: 'Meta',
      cmds: [
        ['help', 'Show this help (aliases: ls, h, ?)'],
        ['version', 'Show CLI/site/node versions (alias: whoami, ver)'],
        ['status', 'Full network health check (node+pool+defi+bridge+ai)'],
        ['about', 'ZION project info & mission'],
        ['docs', 'Documentation links'],
        ['links', 'Useful links (explorer, pool, github...)'],
        ['clear', 'Clear the terminal (aliases: clr, cls)'],
      ],
    },
  ];

  const lines: string[] = [
    'ZION Web CLI v2.1.0 — Available Commands',
    '═══════════════════════════════════════════════════════════════',
    '',
  ];

  for (const group of groups) {
    lines.push(`── ${group.name} ──`);
    const colWidth = Math.max(...group.cmds.map((c) => c[0].length)) + 4;
    for (const [cmdName, desc] of group.cmds) {
      lines.push(`  ${cmdName.padEnd(colWidth)}${desc}`);
    }
    lines.push('');
  }

  lines.push('── Examples ──');
  lines.push('  pool stats              Quick pool overview');
  lines.push('  pool payouts            Fee split & wallet balances');
  lines.push('  explorer block 19274    Look up a block by height');
  lines.push('  explorer address zion1...  Check any address balance');
  lines.push('  mine calc 18KH          Estimate rewards for 18 KH/s');
  lines.push('  wallet balance zion1... Check your wallet balance');
  lines.push('  ai ask "What is ZION?"  Ask the AI a question');
  lines.push('');
  lines.push('── Aliases ──');
  lines.push('  ls / h / ?      = help');
  lines.push('  v / whoami      = version');
  lines.push('  clr / cls       = clear');
  lines.push('  ex              = explorer');
  lines.push('  net             = network');
  lines.push('  mining          = mine');
  lines.push('');
  lines.push('Tip: Use Up/Down for command history, Tab for autocomplete.');
  lines.push('     Click any quick-command chip above the terminal for one-click access.');
  return lines.join('\n');
}

function formatAbout(): string {
  return [
    'ZION — TerraNova',
    '═══════════════════════════════════════════════════════════',
    '',
    'Mission:',
    '  A humanitarian proof-of-work blockchain where mining rewards fund',
    '  global humanitarian causes (89% miner share, 5% humanitarian tithe,',
    '  5% Issobella Fund, 1% pool fee).',
    '',
    'Consensus Algorithm:',
    '  Cosmic Harmony (Deeksha/Ekam) — multi-algorithm PoW with',
    '  deeksha_lite_v1, cosmic_harmony_ekam_deeksha_v2, and deeksha_lite_fire.',
    '',
    'Reward Distribution (per block):',
    `  Miner share:        ${MINER_SHARE_PCT}%`,
    `  Humanitarian tithe: ${HUMANITARIAN_TITHE_PCT}%`,
    `  Issobella Fund:     ${ISSOBELLA_FUND_PCT}%`,
    `  Pool fee:           ${POOL_FEE_PCT}%`,
    '',
    'Emission Schedule:',
    '  Decade Decay — block reward starts at 5,400.067 ZION and decays',
    '  by 20% per decade. Tail emission ~724.785 ZION/block after decade 10.',
    '',
    'Supply:',
    `  Total supply cap:   ${TOTAL_SUPPLY_ZION.toLocaleString()} ZION`,
    `  Genesis premine:    ${GENESIS_PREMINE_ZION.toLocaleString()} ZION`,
    `  Sub-unit:           1 ZION = ${FLOWERS_PER_ZION.toLocaleString()} flowers (6 decimals)`,
    '',
    'Launch:',
    `  Site version:       ${SITE_VERSION}`,
    `  Environment:        ${SITE_ENVIRONMENT_LABEL}`,
    '',
    'Gate, Gate, Paragate, Parasamgate, Bodhi Swaha.',
    'The Golden Age begins. Peace & One Love 4ever.',
  ].join('\n');
}

function formatDocs(): string {
  return [
    'ZION Documentation',
    '═══════════════════════════════════════════════════════════',
    '',
    '  Whitepaper:        https://zionterranova.com/whitepaper',
    '  Docs (main):       https://zionterranova.com/docs',
    '  Mining guide:      https://zionterranova.com/mining',
    '  Explorer:          https://zionterranova.com/explorer',
    '  Pool:              https://zionterranova.com/pool',
    '  DeFi:              https://zionterranova.com/defi',
    '  CEX:               https://zionterranova.com/cex',
    '  DAO:               https://zionterranova.com/dao',
    '  Bridge:            https://zionterranova.com/bridge',
    '  Downloads:         https://zionterranova.com/downloads',
    '',
    'Type "links" for a quick reference of all useful URLs.',
  ].join('\n');
}

function formatLinks(): string {
  return [
    'Useful Links',
    '═══════════════════════════════════════════════════════════',
    '',
    '  Website:           https://zionterranova.com',
    '  Explorer:          https://zionterranova.com/explorer',
    '  Pool:              https://zionterranova.com/pool',
    '  DeFi:              https://zionterranova.com/defi',
    '  CEX:               https://zionterranova.com/cex',
    '  DAO:               https://zionterranova.com/dao',
    '  Bridge:            https://zionterranova.com/bridge',
    '  Downloads:         https://zionterranova.com/downloads',
    '  GitHub:            https://github.com/zionterranova',
    '  Whitepaper:        https://zionterranova.com/whitepaper',
    '  Pool stratum:      ' + SITE_POOL_PRIMARY,
    '  Node RPC:          ' + SITE_PRIMARY_HOST + ':8443',
    '',
    'Type "docs" for documentation pages.',
  ].join('\n');
}

// ─── Formatters: Node ───────────────────────────────────────────────────────

function formatNodeInfo(info: any): string {
  const protocolNumeric = info.version ? info.version.replace(/[^0-9.]/g, '') : '—';
  return [
    'Node Info',
    `  Network:                ${info.nettype ?? '—'}`,
    `  Chain height:           ${info.height ?? '—'}`,
    `  Protocol:               ${info.version ?? '—'}`,
    `  Protocol (numeric):     ${protocolNumeric}`,
    `  Tip hash:               ${info.top_block_hash?.slice(0, 32) ?? '—'}`,
    `  Difficulty:             ${formatNum(info.difficulty, 0)}`,
    `  Cumulative difficulty:  ${formatNum(info.cumulative_difficulty, 0)}`,
    `  Peers (outgoing):       ${info.outgoing_connections_count ?? '—'}`,
    `  Peers (incoming):       ${info.incoming_connections_count ?? '—'}`,
    `  White peerlist:         ${info.white_peerlist_size ?? '—'}`,
    `  Grey peerlist:          ${info.grey_peerlist_size ?? '—'}`,
    `  Mempool txs:            ${info.tx_pool_size ?? '—'}`,
    `  Total txs:              ${info.tx_count ?? '—'}`,
    `  Alt blocks:             ${info.alt_blocks_count ?? '—'}`,
    `  Block size median:      ${info.block_size_median ?? '—'}`,
    `  Status:                 ${info.status ?? 'OK'}`,
    `  FLOWERS_PER_ZION:       ${FLOWERS_PER_ZION.toLocaleString()}`,
    `  ATOMIC_UNITS_PER_ZION:  ${ATOMIC_UNITS_PER_ZION.toLocaleString()}`,
  ].join('\n');
}

function formatChainInfo(info: any, lastBlock: any): string {
  return [
    'Chain Info',
    `  Network:          ${info.nettype ?? '—'}`,
    `  Height:           ${info.height ?? '—'}`,
    `  Tip hash:         ${info.top_block_hash?.slice(0, 32) ?? '—'}`,
    `  Difficulty:       ${info.difficulty ?? lastBlock?.difficulty ?? '—'}`,
    `  Mempool txs:      ${info.tx_pool_size ?? '—'}`,
    `  Protocol:         ${info.version ?? '—'}`,
    lastBlock ? `  Last block time:  ${new Date(lastBlock.timestamp * 1000).toISOString()}` : '',
    lastBlock ? `  Last block reward:${lastBlock.reward ? ' ' + (lastBlock.reward / ATOMIC_UNITS_PER_ZION) + ' ZION' : ' —'}` : '',
  ].filter(Boolean).join('\n');
}

function formatPeers(peers: any): string {
  const list = Array.isArray(peers) ? peers : (peers?.peers ?? []);
  if (list.length === 0) return 'Connected Peers\n  No peers connected.';
  const lines = ['Connected Peers', `  Peer count: ${list.length}`, ''];
  list.forEach((p: any, i: number) => {
    lines.push(`  ${(i + 1).toString().padStart(3)}. ${p.host ?? p.ip ?? '—'}:${p.port ?? '—'} — ${p.address ?? p.node_id ?? '—'}`);
  });
  return lines.join('\n');
}

function formatSupply(info: any, summary: any): string {
  const height = info?.height ?? summary?.info?.height ?? '—';
  const emission = summary?.emission?.total ?? '—';
  const blockReward = BLOCK_REWARD_ZION;
  return [
    'Supply Info',
    `  Chain height:     ${height}`,
    `  Total emission:   ${typeof emission === 'number' ? emission.toFixed(2) : emission} ZION`,
    `  Block reward:     ${blockReward} ZION (Decade 1)`,
    `  Mempool txs:      ${info?.tx_pool_size ?? '—'}`,
    `  Total supply cap: ${TOTAL_SUPPLY_ZION.toLocaleString()} ZION`,
    `  Genesis premine:  ${GENESIS_PREMINE_ZION.toLocaleString()} ZION`,
  ].join('\n');
}

function formatMempool(mempool: any): string {
  const list = Array.isArray(mempool) ? mempool : [];
  return [
    'Mempool',
    `  Transactions:     ${list.length}`,
    list.length > 0 ? `  Latest:           ${list.slice(0, 5).map((t: any) => t.tx_hash?.slice(0, 16) ?? '—').join(', ')}` : '  (empty)',
  ].filter(Boolean).join('\n');
}

// ─── Formatters: Pool ───────────────────────────────────────────────────────

function formatPoolStats(data: any): string {
  const agg = data.aggregate ?? {};
  const fee = data.fee ?? {};
  const pplns = data.pplns ?? {};
  const runtime = data.runtime ?? {};
  const servers = data.servers ?? [];
  const feeBalances = fee.balances ?? {};

  return [
    'Pool Stats',
    '═══════════════════════════════════════════════════════════',
    '',
    '── Hashrate & Miners ──',
    `  Pool hashrate:     ${formatHashrate(agg.hashrate ?? 0)}`,
    `  Hashrate (24h):    ${formatHashrate(agg.hashrate_24h ?? 0)}`,
    `  Active miners:     ${agg.active_miners ?? 0}`,
    `  Total miners:      ${agg.total_miners ?? 0}`,
    '',
    '── Blocks & Shares ──',
    `  Blocks found:      ${agg.blocks_found ?? 0}`,
    `  Valid shares:      ${formatNum(agg.valid_shares, 0)}`,
    `  Invalid shares:    ${formatNum(agg.invalid_shares, 0)}`,
    `  Share efficiency:  ${agg.share_efficiency ?? '—'}%`,
    `  Accept rate:       ${agg.accept_rate_pct ?? '—'}%`,
    '',
    '── PPLNS ──',
    `  Window size:       ${pplns.window_size ?? 0}`,
    `  Window used:       ${pplns.window_used ?? 0}`,
    `  Window %:          ${pplns.window_pct != null ? pplns.window_pct.toFixed(2) + '%' : '—'}`,
    `  Total paid:        ${formatNum(pplns.total_paid_zion, 4)} ZION`,
    `  Payout rounds:     ${pplns.payout_rounds ?? 0}`,
    '',
    '── Fee Distribution ──',
    `  Pool fee (burned): ${fee.pool_fee ?? POOL_FEE_PCT}%`,
    `  Humanitarian:      ${fee.humanitarian_tithe ?? HUMANITARIAN_TITHE_PCT}%`,
    `  Issobella Fund:    ${fee.issobella_fund ?? ISSOBELLA_FUND_PCT}%`,
    `  Miner share:       ${fee.miner_share ?? MINER_SHARE_PCT}%`,
    `  Min payout:        ${fee.min_payout ?? 0.1} ZION`,
    '',
    '── Fee Wallet On-Chain Balances ──',
    `  Pool/Miner:        ${formatNum(feeBalances.pool?.balance_zion ?? 0, 2)} ZION  (${fee.pool_wallet ?? '—'})`,
    `  Humanitarian:      ${formatNum(feeBalances.humanitarian?.balance_zion ?? 0, 2)} ZION  (${fee.humanitarian_wallet ?? '—'})`,
    `  Issobella:         ${formatNum(feeBalances.issobella?.balance_zion ?? 0, 2)} ZION  (${fee.issobella_wallet ?? '—'})`,
    `  Burned (1%):       ${formatNum(fee.burned_total_zion ?? 0, 2)} ZION  (permanently destroyed)`,
    '',
    '── Runtime ──',
    `  Chain height:      ${runtime.chain_height ?? '—'}`,
    `  Difficulty:        ${formatNum(runtime.difficulty, 0)}`,
    `  Network hashrate:  ${formatHashrate(runtime.network_hashrate ?? 0)}`,
    `  Pool uptime:       ${formatDuration(runtime.pool_uptime_seconds ?? 0)}`,
    `  Server status:     ${servers.length > 0 ? (servers[0].online ? '✓ Online' : '✗ Offline') : '—'}`,
  ].join('\n');
}

function formatPoolMiners(data: any): string {
  const miners: any[] = data.miners ?? [];
  if (miners.length === 0) {
    return 'Pool Miners\n  No active miners reported.';
  }
  const top = miners.slice(0, 10);
  const lines = ['Pool Miners (Top 10)', `  Total: ${miners.length}`, ''];
  top.forEach((m, i) => {
    const addr = m.address ?? '—';
    const short = addr.length > 20 ? `${addr.slice(0, 12)}...${addr.slice(-6)}` : addr;
    const lastShare = m.last_share ? formatTimeAgo(m.last_share) : '—';
    lines.push(`  ${(i + 1).toString().padStart(2)}. ${short.padEnd(24)} last share: ${lastShare}`);
  });
  return lines.join('\n');
}

function formatPoolBlocks(data: any): string {
  const blocks: any[] = data.recent_blocks ?? [];
  if (blocks.length === 0) {
    return 'Pool Blocks\n  No recent blocks found.';
  }
  const top = blocks.slice(0, 10);
  const lines = ['Pool Blocks (Recent 10)', ''];
  top.forEach((b) => {
    const reward = b.reward ? (typeof b.reward === 'number' ? b.reward : Number(b.reward) / ATOMIC_UNITS_PER_ZION) : 0;
    const miner = b.miner_address ? (b.miner_address.length > 16 ? `${b.miner_address.slice(0, 10)}...${b.miner_address.slice(-4)}` : b.miner_address) : '—';
    lines.push(`  #${b.height ?? '—'}  reward: ${formatNum(reward, 4)} ZION  miner: ${miner}  ${formatTimeAgo(b.timestamp)}`);
  });
  return lines.join('\n');
}

function formatPoolServers(data: any): string {
  const servers: any[] = data.servers ?? [];
  if (servers.length === 0) {
    return 'Pool Servers\n  No servers configured.';
  }
  const lines = ['Pool Servers', ''];
  servers.forEach((s) => {
    lines.push(`  ${s.online ? '✓' : '✗'} ${s.name ?? s.id ?? '—'}  ${s.flag ?? ''} ${s.host ?? '—'}:${s.stratum ?? '—'}  region: ${s.region ?? '—'}`);
  });
  return lines.join('\n');
}

function formatPoolPayouts(data: any): string {
  const fee = data.fee ?? {};
  const pplns = data.pplns ?? {};
  const agg = data.aggregate ?? {};
  const feeBal = fee.balances ?? {};
  const blocksFound = agg.blocks_found ?? 0;
  const blockReward = BLOCK_REWARD_ZION;
  const minerPerBlock = blockReward * (fee.miner_share ?? MINER_SHARE_PCT) / 100;
  const humPerBlock = blockReward * (fee.humanitarian_tithe ?? HUMANITARIAN_TITHE_PCT) / 100;
  const issoPerBlock = blockReward * (fee.issobella_fund ?? ISSOBELLA_FUND_PCT) / 100;
  const burnPerBlock = blockReward * (fee.pool_fee ?? POOL_FEE_PCT) / 100;

  return [
    'Pool Payouts & Fee Split',
    '═══════════════════════════════════════════════════════════',
    '',
    '── PPLNS ──',
    `  Total paid:        ${formatNum(pplns.total_paid_zion, 4)} ZION`,
    `  Payout rounds:     ${pplns.payout_rounds ?? 0}`,
    `  Window:            ${pplns.window_used ?? 0} / ${pplns.window_size ?? 0} (${pplns.window_pct != null ? pplns.window_pct.toFixed(2) + '%' : '—'})`,
    `  Registered miners: ${pplns.registered_miners ?? 0}`,
    `  Min payout:        ${fee.min_payout ?? 0.1} ZION`,
    '',
    '── Fee Split (per block) ──',
    `  Block reward:      ${formatNum(blockReward, 4)} ZION`,
    `  Miner (89%):       ${formatNum(minerPerBlock, 4)} ZION/block  → ${formatNum(minerPerBlock * blocksFound, 2)} ZION total`,
    `  Humanitarian (5%): ${formatNum(humPerBlock, 4)} ZION/block  → ${formatNum(humPerBlock * blocksFound, 2)} ZION total`,
    `  Issobella (5%):    ${formatNum(issoPerBlock, 4)} ZION/block  → ${formatNum(issoPerBlock * blocksFound, 2)} ZION total`,
    `  Burned (1%):       ${formatNum(burnPerBlock, 4)} ZION/block  → ${formatNum(burnPerBlock * blocksFound, 2)} ZION total`,
    `  Blocks found:      ${blocksFound}`,
    '',
    '── On-Chain Wallet Balances ──',
    `  Pool/Miner:        ${formatNum(feeBal.pool?.balance_zion ?? 0, 2)} ZION  UTXOs: ${feeBal.pool?.utxo_count ?? 0}`,
    `    ${fee.pool_wallet ?? '—'}`,
    `  Humanitarian:      ${formatNum(feeBal.humanitarian?.balance_zion ?? 0, 2)} ZION  UTXOs: ${feeBal.humanitarian?.utxo_count ?? 0}`,
    `    ${fee.humanitarian_wallet ?? '—'}`,
    `  Issobella:         ${formatNum(feeBal.issobella?.balance_zion ?? 0, 2)} ZION  UTXOs: ${feeBal.issobella?.utxo_count ?? 0}`,
    `    ${fee.issobella_wallet ?? '—'}`,
    '',
    '── Burned (Permanent Destruction) ──',
    `  Total burned:      ${formatNum(fee.burned_total_zion ?? 0, 2)} ZION`,
    `  Note:             1% of every block subsidy is permanently destroyed at coinbase.`,
    `                    There is no pool_fee wallet — the coins are unspendable.`,
  ].join('\n');
}

// ─── Formatters: Explorer ───────────────────────────────────────────────────

function formatBlock(b: any): string {
  const reward = typeof b.reward === 'number' ? b.reward : 0;
  const miner = b.miner_address ?? b.miner ?? '—';
  const shortMiner = miner.length > 20 ? `${miner.slice(0, 12)}...${miner.slice(-6)}` : miner;
  return [
    'Block Details',
    '═══════════════════════════════════════════════════════════',
    `  Height:         ${b.height ?? '—'}`,
    `  Hash:           ${b.hash ?? '—'}`,
    `  Prev hash:      ${b.prev_hash?.slice(0, 32) ?? '—'}...`,
    `  Timestamp:      ${b.timestamp ? new Date(b.timestamp * 1000).toISOString() : '—'}`,
    `  Difficulty:     ${formatNum(b.difficulty, 0)}`,
    `  Reward:         ${formatNum(reward, 6)} ZION`,
    `  Miner:          ${shortMiner}${b.miner_label ? ` (${b.miner_label})` : ''}`,
    `  Tx count:       ${b.tx_count ?? b.num_txes ?? 0}`,
    `  Block size:     ${formatNum(b.block_size, 0)} bytes`,
    `  Confirmations:  ${b.confirmations ?? 0}`,
    `  Status:         ${b.status ?? 'confirmed'}`,
    `  Major version:  ${b.major_version ?? '—'}`,
    `  Minor version:  ${b.minor_version ?? '—'}`,
  ].join('\n');
}

function formatTx(tx: any): string {
  const amount = typeof tx.amount === 'number' ? tx.amount : 0;
  const fee = typeof tx.fee === 'number' ? tx.fee : 0;
  return [
    'Transaction Details',
    '═══════════════════════════════════════════════════════════',
    `  Hash:           ${tx.tx_hash ?? tx.tx_id ?? '—'}`,
    `  Block height:   ${tx.block_height ?? '—'}`,
    `  Timestamp:      ${tx.block_timestamp ? new Date(tx.block_timestamp * 1000).toISOString() : '—'}`,
    `  From:           ${tx.from ?? '—'}`,
    `  To:             ${tx.to ?? '—'}`,
    `  Amount:         ${formatNum(amount, 6)} ZION`,
    `  Fee:            ${formatNum(fee, 6)} ZION`,
    `  Nonce:          ${tx.nonce ?? '—'}`,
    `  Confirmations:  ${tx.confirmations ?? 0}`,
    `  Status:         ${tx.status ?? (tx.in_pool ? 'pending' : 'confirmed')}`,
    `  Model:          ${tx.transaction_model ?? 'hybrid'}`,
  ].join('\n');
}

function formatAddress(a: any): string {
  const bal = a.balance ?? {};
  const mining = a.mining_stats;
  const shortAddr = a.address.length > 24 ? `${a.address.slice(0, 14)}...${a.address.slice(-6)}` : a.address;
  const lines = [
    'Address Details',
    '═══════════════════════════════════════════════════════════',
    `  Address:        ${shortAddr}`,
    `  Label:          ${a.known_label ?? '—'}`,
    `  Type:           ${a.known_type ?? '—'}`,
    `  Balance:        ${formatNum(bal.total, 6)} ZION`,
    `  UTXOs:          ${bal.utxo_count ?? 0}`,
    `  Pool pending:   ${formatNum(bal.pool_pending, 6)} ZION`,
    `  Pool paid:      ${formatNum(bal.pool_paid, 6)} ZION`,
    `  Tx count:       ${a.transaction_count ?? 0}`,
    `  Model:          ${a.transaction_model ?? '—'}`,
  ];
  if (mining) {
    lines.push('', '── Mining Stats ──');
    lines.push(`  Blocks found:    ${mining.blocks_found ?? 0}`);
    lines.push(`  Accepted shares: ${formatNum(mining.accepted_shares, 0)}`);
    lines.push(`  Rejected shares: ${formatNum(mining.rejected_shares, 0)}`);
    lines.push(`  Hashrate (1h):   ${mining.hashrate_formatted ?? '—'}`);
    lines.push(`  Worker:          ${mining.worker_name ?? '—'}`);
    lines.push(`  Consciousness:   ${mining.consciousness_level ?? '—'} (×${mining.consciousness_multiplier ?? 1})`);
  }
  return lines.join('\n');
}

function formatSearch(data: any, query: string): string {
  const results: any[] = data.results ?? [];
  if (results.length === 0) {
    return `Search: "${query}"\n  No results found. Try a block height, tx hash, or zion1 address.`;
  }
  const lines = [`Search: "${query}"`, `  ${results.length} result(s)`, ''];
  results.forEach((r, i) => {
    lines.push(`  ${(i + 1).toString().padStart(2)}. [${r.type}] ${r.title}`);
    lines.push(`      ${r.meta}`);
    lines.push(`      → ${r.href}`);
  });
  return lines.join('\n');
}

function formatRichlist(data: any): string {
  const list: any[] = data.rich_list ?? [];
  if (list.length === 0) {
    return 'Rich List\n  No data available.';
  }
  const top = list.slice(0, 10);
  const lines = ['Rich List (Top 10)', ''];
  top.forEach((e) => {
    const addr = e.address.length > 20 ? `${e.address.slice(0, 12)}...${e.address.slice(-6)}` : e.address;
    const label = e.label ? ` (${e.label})` : '';
    lines.push(`  #${e.rank.toString().padStart(2)}  ${formatNum(e.balance, 0).padStart(20)} ZION  ${addr}${label}  [${e.type}]`);
  });
  const stats = data.stats ?? {};
  lines.push('');
  lines.push(`  Total in list:    ${formatNum(stats.total_balance, 0)} ZION`);
  lines.push(`  Circulating:      ${formatNum(stats.circulating_supply, 0)} ZION`);
  lines.push(`  Top 10 %:         ${stats.top_10_percentage != null ? stats.top_10_percentage.toFixed(2) + '%' : '—'}`);
  return lines.join('\n');
}

function formatSupplyStats(data: any): string {
  return [
    'Supply Info',
    '═══════════════════════════════════════════════════════════',
    `  Chain height:        ${data.block_height ?? '—'}`,
    `  Premine supply:      ${formatNum(data.premine_supply, 0)} ZION`,
    `  Mined supply:        ${formatNum(data.mined_supply, 0)} ZION`,
    `  Circulating supply:  ${formatNum(data.circulating_supply, 0)} ZION`,
    `  Total supply cap:    ${formatNum(data.total_supply ?? data.max_supply, 0)} ZION`,
    `  Remaining supply:    ${formatNum(data.remaining_supply, 0)} ZION`,
    `  Emission:            ${data.emission_pct ?? '—'}%`,
  ].join('\n');
}

function formatBlockchainStats(data: any): string {
  return [
    'Blockchain Stats',
    '═══════════════════════════════════════════════════════════',
    '',
    '── Chain ──',
    `  Block height:        ${data.block_height ?? '—'}`,
    `  Difficulty:          ${formatNum(data.difficulty, 0)}`,
    `  Network hashrate:    ${data.network_hashrate_formatted ?? formatHashrate(data.network_hashrate ?? 0)}`,
    `  Target block time:   ${data.target_block_time ?? 60}s`,
    `  Avg block time:      ${data.avg_block_time ?? '—'}s`,
    '',
    '── Supply ──',
    `  Circulating:         ${formatNum(data.circulating_supply, 0)} ZION`,
    `  Mined:               ${formatNum(data.mined_supply, 0)} ZION`,
    `  Total cap:           ${formatNum(data.total_supply, 0)} ZION`,
    `  Emission:            ${data.emission_pct ?? '—'}%`,
    '',
    '── Transactions ──',
    `  Total txs:           ${formatNum(data.tx_count, 0)}`,
    `  Mempool:             ${data.tx_pool_size ?? 0}`,
    '',
    '── Peers ──',
    `  Incoming:            ${data.incoming_connections ?? 0}`,
    `  Outgoing:            ${data.outgoing_connections ?? 0}`,
    `  Total:               ${data.total_connections ?? 0}`,
    `  White peerlist:      ${data.white_peerlist_size ?? 0}`,
    '',
    '── Node ──',
    `  Version:             ${data.version ?? '—'}`,
    `  Status:              ${data.status ?? '—'}`,
    `  Database size:       ${formatNum(data.database_size, 0)} bytes`,
    `  Alt blocks:          ${data.alt_blocks_count ?? 0}`,
    '',
    '── Pool ──',
    `  Pool hashrate:       ${data.pool_hashrate_formatted ?? formatHashrate(data.pool_hashrate ?? 0)}`,
    `  Active miners:       ${data.active_miners ?? 0}`,
    `  Blocks found:        ${data.pool_blocks_found ?? 0}`,
    `  Valid shares:        ${formatNum(data.valid_shares, 0)}`,
  ].join('\n');
}

// ─── Formatters: DeFi ───────────────────────────────────────────────────────

function formatDefiPrice(data: any): string {
  const p = data.price ?? {};
  const tvl = data.tvl ?? {};
  const liq = data.liquidity ?? '0';
  const liqNum = Number(liq);
  return [
    'ZION Price',
    '═══════════════════════════════════════════════════════════',
    `  Network:        ${data.network ?? '—'} (chainId ${data.chainId ?? '—'})`,
    `  Source:         ${data.source ?? '—'}`,
    `  Pool:           ${data.pool ?? '—'}`,
    '',
    `  ZION/USD:       $${formatNum(p.usd_per_wzion, 6)}`,
    `  ZION/ETH:       ${formatNum(p.weth_per_wzion, 8)}`,
    `  ETH/ZION:       ${formatNum(p.wzion_per_weth, 2)}`,
    `  ETH/USD:        $${formatNum(p.weth_usd, 2)}`,
    `  Tick:           ${p.tick ?? '—'}`,
    '',
    '── Liquidity ──',
    `  Pool liquidity: ${liqNum > 0 ? formatNum(liqNum, 0) : '0 (inactive)'}`,
    `  TVL (WETH):     ${formatNum(tvl.weth ?? 0, 6)} WETH`,
    `  TVL (wZION):    ${formatNum(tvl.wzion ?? 0, 2)} wZION`,
    `  TVL (USD):      $${formatNum(tvl.usd ?? 0, 2)}`,
    '',
    `  Fetched:        ${data.fetchedAt ? new Date(data.fetchedAt).toISOString() : '—'}`,
  ].join('\n');
}

function formatDefiPools(data: any): string {
  const pools = data.pools ?? {};
  const summary = data.summary ?? {};
  const weth = pools.wzion_weth ?? {};
  const usdc = pools.wzion_usdc ?? {};
  const lines: string[] = [
    'Uniswap V3 Pool Stats',
    '═══════════════════════════════════════════════════════════',
    `  Network:        ${data.network ?? '—'} (chainId ${data.chainId ?? '—'})`,
    `  ETH/USD:        $${formatNum(data.weth_usd ?? 0, 2)}`,
    '',
    '── wZION/WETH (1% fee) ──',
    `  Address:        ${weth.address ?? '—'}`,
    `  Active:         ${weth.active ? 'YES' : 'NO'}`,
    `  Liquidity:      ${weth.liquidity ? formatNum(Number(weth.liquidity), 0) : '0'}`,
    `  Tick:           ${weth.tick ?? '—'}`,
    `  Price (WETH):   ${formatNum(weth.price?.token1_per_token0 ?? 0, 8)}`,
    `  Price (USD):    $${formatNum(weth.price?.usd_per_wzion ?? 0, 6)}`,
    `  wZION in pool:  ${formatNum(weth.balances?.token0 ?? 0, 2)}`,
    `  WETH in pool:   ${formatNum(weth.balances?.token1 ?? 0, 6)}`,
    `  TVL (USD):      $${formatNum(weth.tvl?.usd ?? 0, 2)}`,
    `  NFT positions:  ${weth.nft_positions?.length ?? 0}`,
  ];

  if (weth.nft_positions) {
    for (const pos of weth.nft_positions) {
      lines.push(`    #${pos.id}: ${pos.type} (${pos.tickLower} to ${pos.tickUpper})`);
    }
  }

  lines.push(
    '',
    '── wZION/USDC (0.3% fee) ──',
    `  Address:        ${usdc.address ?? '—'}`,
    `  Active:         ${usdc.active ? 'YES' : 'NO'}`,
    `  Liquidity:      ${usdc.liquidity ? formatNum(Number(usdc.liquidity), 0) : '0'}`,
    `  Tick:           ${usdc.tick ?? '—'}`,
    `  Price (USDC):   ${formatNum(usdc.price?.token1_per_token0 ?? 0, 6)}`,
    `  Price (USD):    $${formatNum(usdc.price?.usd_per_wzion ?? 0, 6)}`,
    `  wZION in pool:  ${formatNum(usdc.balances?.token0 ?? 0, 2)}`,
    `  USDC in pool:   ${formatNum(usdc.balances?.token1 ?? 0, 2)}`,
    `  TVL (USD):      $${formatNum(usdc.tvl?.usd ?? 0, 2)}`,
    `  NFT positions:  ${usdc.nft_positions?.length ?? 0}`,
  );

  if (usdc.nft_positions) {
    for (const pos of usdc.nft_positions) {
      lines.push(`    #${pos.id}: ${pos.type} (${pos.tickLower} to ${pos.tickUpper})`);
    }
  }

  lines.push(
    '',
    '── Summary ──',
    `  Total TVL:      $${formatNum(summary.total_tvl_usd ?? 0, 2)}`,
    `  Total wZION:    ${formatNum(summary.total_wzion_liquidity ?? 0, 2)} wZION`,
    `  Active pools:   ${summary.active_pools ?? 0}`,
    `  NFT positions:  ${summary.total_nft_positions ?? 0}`,
    '',
    `  Fetched:        ${data.fetchedAt ? new Date(data.fetchedAt).toISOString() : '—'}`,
  );

  return lines.join('\n');
}

function formatDefiStatus(data: any): string {
  const d = data.data ?? {};
  const w = d.wZION ?? {};
  const st = d.staking ?? {};
  const f = d.farm ?? {};
  const g = d.governance ?? {};
  const br = d.bridge ?? {};
  return [
    'DeFi Protocol Status',
    '═══════════════════════════════════════════════════════════',
    `  Network:        ${data.network ?? '—'} (chainId ${data.chainId ?? '—'})`,
    '',
    '── wZION Token ──',
    `  Total supply:   ${w.totalSupply ?? '—'}`,
    '',
    '── Staking ──',
    `  Total staked:   ${st.totalStaked ?? '—'}`,
    `  APR:            ${st.apr ?? '—'}`,
    `  Cooldown:       ${st.cooldownDays ?? '—'} days`,
    '',
    '── Farm ──',
    `  Pool count:     ${f.poolCount ?? 0}`,
    `  Reward/sec:     ${f.rewardPerSecond ?? '0'}`,
    '',
    '── Governance ──',
    `  Proposals:      ${g.proposalCount ?? 0}`,
    '',
    '── Bridge ──',
    `  Threshold:      ${br.threshold ?? '—'}`,
    `  Validators:     ${br.validatorCount ?? '—'}`,
  ].join('\n');
}

// ─── Formatters: Mining ─────────────────────────────────────────────────────

function formatMineStart(): string {
  return [
    'ZION Mining — Quick Start Guide',
    '═══════════════════════════════════════════════════════════',
    '',
    '1. Download the ZION miner from https://zionterranova.com/downloads',
    '   (or build from source: cargo build --release -p zion-miner)',
    '',
    '2. Choose a mining algorithm:',
    '   - deeksha_lite_v1         (default, balanced)',
    '   - cosmic_harmony_ekam_deeksha_v2  (advanced)',
    '   - deeksha_lite_fire       (thermal-intensive, higher power)',
    '',
    '3. Connect to the pool:',
    `   Pool stratum:  ${SITE_POOL_PRIMARY}`,
    `   Pool host:     ${SITE_PRIMARY_HOST}`,
    `   Stratum port:  8444`,
    '',
    '4. Native miner command (CPU):',
    '   ZION_POOL_ADDR=' + SITE_PRIMARY_HOST + ':8444 \\',
    '   ZION_WORKER_NAME=<your-name> \\',
    '   ZION_MINER_ID=<miner-id> \\',
    '   ZION_PAYOUT_ADDRESS=<zion1...address> \\',
    '   ZION_MINER_ALGORITHM=deeksha_lite_v1 \\',
    '   cargo run --release -p zion-miner',
    '',
    '5. GPU miner (AMD/NVIDIA):',
    '   cargo build --release -p zion-miner --features gpu-opencl',
    '   # then set ZION_GPU_BACKEND=opencl and ZION_LOOP_COUNT=1000000',
    '',
    '6. xmrig-compatible (if supported by your setup):',
    '   xmrig -o ' + SITE_PRIMARY_HOST + ':8444 -u <zion1...payout_address> -p x',
    '',
    'Notes:',
    '  - ZION_PAYOUT_ADDRESS must be a valid 44-char zion1... address.',
    '  - For sustained GPU mining, set ZION_LOOP_COUNT=1000000.',
    '  - Pool and miner binaries must be compiled from the same source version.',
    '',
    'Type "mine calc <hashrate>" to estimate rewards.',
    'Type "mine benchmarks" for hardware hashrate reference.',
  ].join('\n');
}

function formatBenchmarks(): string {
  const rows: Array<[string, string, string, string]> = [
    ['Hardware', 'Algorithm', 'Hashrate', 'Notes'],
    ['RX 5700 XT (AMD)', 'deeksha_lite_fire', '18.16 KH/s', 'RDNA1, OpenCL, 85% VRAM'],
    ['RX 5700 XT (AMD)', 'deeksha_lite_v1', '9.70 KH/s', 'RDNA1, OpenCL'],
    ['RTX 4090 (NVIDIA)', 'deeksha_lite_v1', '~45 KH/s', 'CUDA, estimated'],
    ['RTX 3090 (NVIDIA)', 'deeksha_lite_v1', '~28 KH/s', 'CUDA, estimated'],
    ['Ryzen 9 7950X (CPU)', 'deeksha_lite_v1', '~2 KH/s', '32 threads'],
    ['Ryzen 7 5800X (CPU)', 'deeksha_lite_v1', '~1.2 KH/s', '16 threads'],
    ['Raspberry Pi 4 (CPU)', 'deeksha_lite_v1', '~50 H/s', 'ARM, not recommended'],
  ];
  const colWidths = [22, 22, 14, 28];
  const lines = ['Hardware Benchmarks (ZION Deeksha)', '═══════════════════════════════════════════════════════════', ''];
  rows.forEach((row, idx) => {
    const padded = row.map((cell, i) => cell.padEnd(colWidths[i]));
    lines.push(`  ${padded.join('  ')}`);
    if (idx === 0) {
      lines.push(`  ${colWidths.map((w) => '─'.repeat(w)).join('  ')}`);
    }
  });
  lines.push('');
  lines.push('Note: Hashrates are benchmarks (ekam-bench). Live stratum hashrate may be');
  lines.push('lower due to nonce batch size (ZION_NONCE_COUNT). For sustained GPU');
  lines.push('mining, set ZION_LOOP_COUNT=1000000 on the miner.');
  return lines.join('\n');
}

// ─── Formatters: Network ────────────────────────────────────────────────────

function formatNetworkStats(data: any): string {
  const summary = data.summary ?? {};
  const nodes: any[] = data.nodes ?? [];
  const lines = [
    'Network Overview',
    '═══════════════════════════════════════════════════════════',
    '',
    '── Summary ──',
    `  Total nodes:       ${summary.total ?? nodes.length}`,
    `  Online:            ${summary.online ?? 0} / ${summary.total ?? nodes.length}`,
    `  Online %:          ${summary.onlinePct ?? '—'}%`,
    `  In sync:           ${summary.inSync ? '✓ Yes' : '✗ No'}`,
    `  Max height:        ${summary.maxHeight ?? '—'}`,
    `  Min height:        ${summary.minHeight ?? '—'}`,
    `  Height gap:        ${summary.heightGap ?? 0}`,
    `  Total hashrate:    ${formatHashrate(summary.totalHashrate ?? 0)}`,
    `  Total miners:      ${summary.totalMiners ?? 0}`,
    `  Total blocks:      ${summary.totalBlocks ?? 0}`,
    '',
    '── Nodes ──',
  ];
  nodes.forEach((n) => {
    lines.push(`  ${n.online ? '✓' : '✗'} ${n.name ?? n.id}  ${n.host ?? '—'}  height: ${n.height ?? 0}  peers: ${n.peers ?? 0}  hashrate: ${formatHashrate(n.hashrate ?? 0)}`);
  });
  return lines.join('\n');
}

function formatNetworkPeers(peers: any): string {
  const list = Array.isArray(peers) ? peers : (peers?.peers ?? []);
  if (list.length === 0) return 'Network Peers\n  No peers connected.';
  const lines = ['Network Peers (Detailed)', `  Peer count: ${list.length}`, ''];
  list.forEach((p: any, i: number) => {
    lines.push(`  ${(i + 1).toString().padStart(3)}. ${p.host ?? p.ip ?? '—'}:${p.port ?? '—'}`);
    lines.push(`      Peer ID:     ${p.peer_id ?? p.address ?? p.node_id ?? '—'}`);
    lines.push(`      State:       ${p.state ?? '—'}`);
    lines.push(`      Height:      ${p.height ?? '—'}`);
    lines.push(`      Incoming:    ${p.incoming ? 'yes' : 'no'}`);
    lines.push(`      Live time:   ${formatDuration(p.live_time ?? 0)}`);
    lines.push(`      Avg download:${formatNum(p.avg_download, 0)} bytes/s`);
    lines.push(`      Avg upload:  ${formatNum(p.avg_upload, 0)} bytes/s`);
  });
  return lines.join('\n');
}

// ─── Formatters: DAO ────────────────────────────────────────────────────────

function formatDaoProposals(proposals: any[]): string {
  if (!Array.isArray(proposals) || proposals.length === 0) {
    return 'DAO Proposals\n  No active proposals found. The DAO API may be offline.';
  }
  const lines = ['DAO Proposals (Active)', `  Count: ${proposals.length}`, ''];
  proposals.slice(0, 10).forEach((p, i) => {
    const yes = p.for_votes ?? p.votes_yes ?? '0';
    const no = p.against_votes ?? p.votes_no ?? '0';
    const ends = p.voting_ends_at ?? '—';
    lines.push(`  ${(i + 1).toString().padStart(2)}. #${p.id ?? '—'} [${p.state ?? '—'}] ${p.title ?? 'Untitled'}`);
    lines.push(`      Type:    ${p.proposal_type_json ?? '—'}`);
    lines.push(`      Proposer:${p.proposer ? ' ' + (p.proposer.length > 16 ? p.proposer.slice(0, 12) + '...' : p.proposer) : ' —'}`);
    lines.push(`      Votes:   ✓ ${yes}  ✗ ${no}`);
    lines.push(`      Ends:    ${ends}`);
  });
  return lines.join('\n');
}

// ─── Formatters: Bridge ─────────────────────────────────────────────────────

function formatBridge(data: any): string {
  const lines = [
    'Bridge Status (L1 ↔ EVM)',
    '═══════════════════════════════════════════════════════════',
    `  Online:              ${data.online ? '✓ Yes' : '✗ No'}`,
    `  Uptime:              ${formatDuration(data.uptime_seconds ?? 0)}`,
    '',
    '── Sync ──',
    `  Last L1 height:      ${data.last_l1_height ?? 0}`,
    `  Last EVM block:      ${data.last_evm_block ?? 0}`,
    '',
    '── L1 → EVM (Lock & Mint) ──',
    `  Locks detected:      ${data.l1_locks_detected ?? 0}`,
    `  Locks finalized:     ${data.l1_locks_finalized ?? 0}`,
    `  EVM mints submitted: ${data.evm_mints_submitted ?? 0}`,
    `  EVM mints confirmed: ${data.evm_mints_confirmed ?? 0}`,
    '',
    '── EVM → L1 (Burn & Unlock) ──',
    `  EVM burns detected:  ${data.evm_burns_detected ?? 0}`,
    `  L1 unlocks submitted:${data.l1_unlocks_submitted ?? 0}`,
    `  L1 unlocks confirmed:${data.l1_unlocks_confirmed ?? 0}`,
    '',
    '── Errors ──',
    `  Total errors:        ${data.errors_total ?? 0}`,
  ];
  return lines.join('\n');
}
