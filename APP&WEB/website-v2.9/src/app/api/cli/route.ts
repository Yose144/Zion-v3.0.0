/**
 * ZION Web CLI API
 *
 * Proxy endpoint for the interactive web terminal on the homepage.
 * Supports read-only commands that mirror the public zion-cli:
 *   - node info / chain / peers / supply / mempool
 *   - status (health check)
 *   - ai ask "question"
 *   - wallet balance <address>
 *
 * No write operations, no private keys, no admin commands.
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getZionRpc } from '@/lib/zion-rpc';
import { coreUrl } from '@/lib/core-endpoints';

interface CliResponse {
  ok: boolean;
  output: string;
  error?: string;
}

export async function POST(req: NextRequest) {
  try {
    const { command } = await req.json();
    if (!command || typeof command !== 'string') {
      return NextResponse.json<CliResponse>({ ok: false, output: '', error: 'No command provided' }, { status: 400 });
    }

    const result = await executeCommand(command.trim());
    return NextResponse.json<CliResponse>(result);
  } catch (err: any) {
    return NextResponse.json<CliResponse>({
      ok: false,
      output: '',
      error: err?.message ?? 'Internal error',
    }, { status: 500 });
  }
}

async function executeCommand(input: string): Promise<CliResponse> {
  const parts = input.split(/\s+/);
  const cmd = parts[0]?.toLowerCase();
  const sub = parts[1]?.toLowerCase();
  const args = parts.slice(2);

  // ─── help ─────────────────────────────────────────────────────
  if (cmd === 'help' || cmd === '?' || cmd === '') {
    return {
      ok: true,
      output: formatHelp(),
    };
  }

  // ─── version ──────────────────────────────────────────────────
  if (cmd === 'version' || cmd === 'v') {
    return {
      ok: true,
      output: 'zion web-cli v1.0.0 — community edition\nConnected to: ZION V3 Mainnet',
    };
  }

  // ─── node ─────────────────────────────────────────────────────
  if (cmd === 'node') {
    return await handleNode(sub);
  }

  // ─── status ───────────────────────────────────────────────────
  if (cmd === 'status') {
    return await handleStatus();
  }

  // ─── ai ───────────────────────────────────────────────────────
  if (cmd === 'ai') {
    return await handleAi(sub, args);
  }

  // ─── wallet ───────────────────────────────────────────────────
  if (cmd === 'wallet') {
    return await handleWallet(sub, args);
  }

  return {
    ok: false,
    output: '',
    error: `Unknown command: ${cmd}. Type 'help' for available commands.`,
  };
}

// ─── Command handlers ─────────────────────────────────────────────────────

async function handleNode(sub?: string): Promise<CliResponse> {
  const rpc = getZionRpc();

  if (sub === 'info') {
    try {
      const info = await rpc.getInfo();
      return { ok: true, output: formatNodeInfo(info) };
    } catch (e: any) {
      return { ok: false, output: '', error: `Cannot reach node: ${e.message}` };
    }
  }

  if (sub === 'chain') {
    try {
      const info = await rpc.getInfo();
      const lastBlock = await rpc.getLastBlockHeader().catch(() => null);
      return { ok: true, output: formatChainInfo(info, lastBlock) };
    } catch (e: any) {
      return { ok: false, output: '', error: `Cannot reach node: ${e.message}` };
    }
  }

  if (sub === 'peers') {
    try {
      const peers = await rpc.getConnections();
      return { ok: true, output: formatPeers(peers) };
    } catch (e: any) {
      return { ok: false, output: '', error: `Cannot reach node: ${e.message}` };
    }
  }

  if (sub === 'supply') {
    try {
      const info = await rpc.getInfo();
      const summary = await rpc.getNetworkSummary().catch(() => null);
      return { ok: true, output: formatSupply(info, summary) };
    } catch (e: any) {
      return { ok: false, output: '', error: `Cannot reach node: ${e.message}` };
    }
  }

  if (sub === 'mempool') {
    try {
      const mempool = await rpc.getTransactionPool();
      return { ok: true, output: formatMempool(mempool) };
    } catch (e: any) {
      return { ok: false, output: '', error: `Cannot reach node: ${e.message}` };
    }
  }

  return {
    ok: false,
    output: '',
    error: `Unknown node subcommand: ${sub}. Try: info, chain, peers, supply, mempool`,
  };
}

async function handleStatus(): Promise<CliResponse> {
  const lines: string[] = ['ZION Network Status', ''];

  // Node RPC
  lines.push('── Node RPC ──');
  try {
    const rpc = getZionRpc();
    const info = await rpc.getInfo();
    lines.push(`  ✓ Online — height ${info.height}, ${info.tx_pool_size} mempool txs`);
    lines.push(`    Network: ${info.nettype}`);
    lines.push(`    Tip: ${info.top_block_hash?.slice(0, 24) ?? '—'}...`);
    lines.push(`    Peers: ${info.outgoing_connections_count}`);
  } catch (e: any) {
    lines.push(`  ✗ Offline — ${e.message}`);
  }

  // Pool
  lines.push('', '── Mining Pool ──');
  try {
    const poolUrl = coreUrl('poolApi', 'http://127.0.0.1:8455');
    const res = await fetch(`${poolUrl}/api/pool`, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      lines.push(`  ✓ Online — ${poolUrl}`);
    } else {
      lines.push(`  ⚠ Responded HTTP ${res.status}`);
    }
  } catch {
    lines.push(`  ⚠ HTTP probe failed — pool may accept stratum on port 8444`);
  }

  // AI (Hiran)
  lines.push('', '── Hiran AI ──');
  try {
    const aiUrl = coreUrl('hiranInference', 'http://127.0.0.1:8002');
    const res = await fetch(`${aiUrl}/health`, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      lines.push(`  ✓ Online — ${aiUrl}`);
    } else {
      lines.push(`  ⚠ Responded HTTP ${res.status}`);
    }
  } catch (e: any) {
    lines.push(`  ✗ Offline — ${e.message}`);
  }

  // Website
  lines.push('', '── Website ──');
  lines.push(`  ✓ Online — https://zionterranova.com`);

  lines.push('');
  return { ok: true, output: lines.join('\n') };
}

async function handleAi(sub?: string, args?: string[]): Promise<CliResponse> {
  if (sub === 'status') {
    try {
      const aiUrl = coreUrl('hiranInference', 'http://127.0.0.1:8002');
      const res = await fetch(`${aiUrl}/health`, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        return { ok: true, output: `Hiran AI: Online\nModel: ${data.model ?? 'hiran-v2.2'}\nEndpoint: ${aiUrl}` };
      }
      return { ok: false, output: '', error: `Hiran AI responded HTTP ${res.status}` };
    } catch (e: any) {
      return { ok: false, output: '', error: `Hiran AI offline: ${e.message}` };
    }
  }

  if (sub === 'ask') {
    const question = args.join(' ');
    if (!question) {
      return { ok: false, output: '', error: 'Usage: ai ask "your question"' };
    }
    try {
      // Use the existing ai-chat API route internally
      const res = await fetch('http://127.0.0.1:3000/api/ai-chat', {
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
      return { ok: false, output: '', error: `AI request failed: ${e.message}` };
    }
  }

  return {
    ok: false,
    output: '',
    error: `Unknown ai subcommand: ${sub}. Try: ask "question", status`,
  };
}

async function handleWallet(sub?: string, args?: string[]): Promise<CliResponse> {
  if (sub === 'balance') {
    const address = args[0];
    if (!address || !address.startsWith('zion1')) {
      return { ok: false, output: '', error: 'Usage: wallet balance <zion1...address>' };
    }
    try {
      const rpc = getZionRpc();
      const balance = await rpc.getAddressBalance(address);
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
      return { ok: false, output: '', error: `Cannot reach node: ${e.message}` };
    }
  }

  if (sub === 'address' || sub === 'info') {
    return {
      ok: true,
      output: 'Wallet operations requiring private keys are not available in the web terminal.\nUse the desktop CLI (zion wallet new/import) for full wallet management.',
    };
  }

  return {
    ok: false,
    output: '',
    error: `Unknown wallet subcommand: ${sub}. Try: balance <zion1...address>`,
  };
}

// ─── Formatters ───────────────────────────────────────────────────────────

function formatHelp(): string {
  return [
    'ZION Web CLI — Available Commands',
    '',
    '  node info       Show node info (version, network, peers)',
    '  node chain      Show chain info (height, tip, mempool)',
    '  node peers      Show connected peers',
    '  node supply     Show supply info (total, mined, remaining)',
    '  node mempool    Show mempool info',
    '',
    '  status          Network health check (node, pool, AI, website)',
    '',
    '  ai ask "..."    Ask Hiran AI a question',
    '  ai status       Check Hiran AI endpoint health',
    '',
    '  wallet balance <zion1...>   Check balance of an address',
    '',
    '  help            Show this help',
    '  version         Show CLI version',
    '',
    'Type a command and press Enter. Use the quick buttons above for common commands.',
  ].join('\n');
}

function formatNodeInfo(info: any): string {
  return [
    'Node Info',
    `  Network:          ${info.nettype ?? '—'}`,
    `  Chain height:     ${info.height ?? '—'}`,
    `  Protocol:         ${info.version ?? '—'}`,
    `  Tip hash:         ${info.top_block_hash?.slice(0, 32) ?? '—'}`,
    `  Difficulty:       ${info.difficulty ?? '—'}`,
    `  Peers:            ${info.outgoing_connections_count ?? '—'}`,
    `  Mempool txs:      ${info.tx_pool_size ?? '—'}`,
    `  Status:           ${info.status ?? 'OK'}`,
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
  const blockReward = 5400.067;
  return [
    'Supply Info',
    `  Chain height:     ${height}`,
    `  Total emission:   ${typeof emission === 'number' ? emission.toFixed(2) : emission} ZION`,
    `  Block reward:     ${blockReward} ZION`,
    `  Mempool txs:      ${info?.tx_pool_size ?? '—'}`,
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
