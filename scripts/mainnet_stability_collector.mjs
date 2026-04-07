#!/usr/bin/env node

import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';

const DEFAULT_STATE_PATH = path.resolve(process.cwd(), 'ops', 'mainnet-stability-run', 'active-run.json');
const DEFAULT_LOG_PATH = path.resolve(process.cwd(), 'ops', 'mainnet-stability-run', 'samples.jsonl');
const DEFAULT_INTERVAL_SEC = 60;
const DEFAULT_TARGET_DURATION_SECS = 72 * 3600;
const STATE_SCHEMA_VERSION = 2;
const INCIDENT_DEBOUNCE_SAMPLES = 2;
const DEFAULT_NODES = [
  { id: 'prague-eu', host: '91.98.122.165', port: 8443 },
];
const DEFAULT_POOL = { host: '91.98.122.165', port: 8080, path: '/stats' };

function parseArgs(argv) {
  const options = {
    once: false,
    intervalSec: DEFAULT_INTERVAL_SEC,
    statePath: DEFAULT_STATE_PATH,
    logPath: DEFAULT_LOG_PATH,
    runId: null,
    startAt: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case '--once':
        options.once = true;
        break;
      case '--interval-sec':
        options.intervalSec = Math.max(5, Number(argv[index + 1] ?? DEFAULT_INTERVAL_SEC));
        index += 1;
        break;
      case '--state-path':
        options.statePath = path.resolve(argv[index + 1] ?? DEFAULT_STATE_PATH);
        index += 1;
        break;
      case '--log-path':
        options.logPath = path.resolve(argv[index + 1] ?? DEFAULT_LOG_PATH);
        index += 1;
        break;
      case '--run-id':
        options.runId = argv[index + 1] ?? null;
        index += 1;
        break;
      case '--start-at':
        options.startAt = argv[index + 1] ?? null;
        index += 1;
        break;
      case '--help':
        console.log('Usage: node scripts/mainnet_stability_collector.mjs [--once] [--interval-sec 60] [--state-path <file>] [--log-path <file>] [--run-id <id>] [--start-at <iso>]');
        process.exit(0);
        break;
      default:
        break;
    }
  }

  return options;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function roundTo(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

async function ensureParentDir(filePath) {
  await mkdir(path.dirname(filePath), { recursive: true });
}

async function readJsonFile(filePath) {
  try {
    const raw = await readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function readJsonLines(filePath) {
  try {
    const raw = await readFile(filePath, 'utf8');
    return raw
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => JSON.parse(line));
  } catch {
    return [];
  }
}

function isHealthySummary(summary) {
  return summary?.status === 'RUNNING';
}

async function migrateStateIfNeeded(state, logPath) {
  if (Number(state?.schema_version ?? 0) >= STATE_SCHEMA_VERSION && Number.isFinite(Number(state?.non_running_streak ?? 0))) {
    return state;
  }

  const samples = await readJsonLines(logPath);
  let healthySamples = 0;
  let issueCount = 0;
  let nonRunningStreak = 0;
  let latest = null;
  let lastSampleAt = null;

  for (const sample of samples) {
    const healthy = isHealthySummary(sample?.summary);
    if (healthy) {
      healthySamples += 1;
      nonRunningStreak = 0;
    } else {
      nonRunningStreak += 1;
      if (nonRunningStreak === INCIDENT_DEBOUNCE_SAMPLES) {
        issueCount += 1;
      }
    }

    latest = sample?.summary ?? latest;
    lastSampleAt = sample?.timestamp ?? lastSampleAt;
  }

  return {
    ...state,
    schema_version: STATE_SCHEMA_VERSION,
    samples_collected: samples.length,
    healthy_samples: healthySamples,
    issue_count: issueCount,
    non_running_streak: nonRunningStreak,
    healthy_sample_ratio: samples.length > 0 ? roundTo(healthySamples / samples.length, 4) : null,
    last_sample_at: lastSampleAt ?? state?.last_sample_at ?? null,
    latest: latest ?? state?.latest ?? null,
  };
}

function tcpJsonRpc(host, port, method, params = {}) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let data = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        socket.destroy();
        reject(new Error(`timeout calling ${method}`));
      }
    }, 5000);

    const finish = () => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      socket.destroy();

      const trimmed = data.trim();
      if (!trimmed) {
        reject(new Error(`empty response for ${method}`));
        return;
      }

      try {
        const parsed = JSON.parse(trimmed);
        if (parsed.error) {
          reject(new Error(parsed.error.message ?? JSON.stringify(parsed.error)));
          return;
        }
        resolve(parsed.result ?? null);
      } catch (error) {
        reject(error);
      }
    };

    socket.connect(port, host, () => {
      socket.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) + '\n');
    });
    socket.on('data', chunk => { data += chunk.toString(); });
    socket.on('end', finish);
    socket.on('close', finish);
    socket.on('error', error => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(error);
      }
    });
  });
}

async function fetchNodeSnapshot(node) {
  try {
    const [chainInfo, peerInfo] = await Promise.all([
      tcpJsonRpc(node.host, node.port, 'getChainInfo'),
      tcpJsonRpc(node.host, node.port, 'getPeerInfo').catch(() => null),
    ]);

    return {
      id: node.id,
      host: node.host,
      reachable: true,
      chain_height: chainInfo?.chain_height ?? 0,
      accepted_blocks: chainInfo?.accepted_blocks ?? 0,
      tip_hash: chainInfo?.tip_hash ?? '',
      network: chainInfo?.network ?? 'unknown',
      protocol_version: chainInfo?.protocol_version ?? '',
      peer_count: peerInfo?.count ?? 0,
    };
  } catch (error) {
    return {
      id: node.id,
      host: node.host,
      reachable: false,
      error: error instanceof Error ? error.message : String(error),
      chain_height: 0,
      accepted_blocks: 0,
      tip_hash: '',
      network: 'unknown',
      protocol_version: '',
      peer_count: 0,
    };
  }
}

async function fetchPoolSnapshot() {
  try {
    const response = await fetch(`http://${DEFAULT_POOL.host}:${DEFAULT_POOL.port}${DEFAULT_POOL.path}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = await response.json();
    const validShares = payload?.shares?.valid ?? 0;
    const invalidShares = payload?.shares?.invalid ?? 0;
    const acceptRate = validShares + invalidShares > 0
      ? roundTo((validShares / (validShares + invalidShares)) * 100, 1)
      : payload?.ok
      ? 100
      : null;

    return {
      reachable: true,
      active_miners: payload?.miners?.active ?? 0,
      valid_shares: validShares,
      invalid_shares: invalidShares,
      accept_rate_pct: acceptRate,
      uptime_secs: payload?.pool?.uptime_secs ?? 0,
      blocks_found: payload?.blocks?.found ?? 0,
    };
  } catch (error) {
    return {
      reachable: false,
      error: error instanceof Error ? error.message : String(error),
      active_miners: 0,
      valid_shares: 0,
      invalid_shares: 0,
      accept_rate_pct: null,
      uptime_secs: 0,
      blocks_found: 0,
    };
  }
}

function buildSummary(nodes, pool) {
  const reachableNodes = nodes.filter(node => node.reachable && node.tip_hash);
  const heights = reachableNodes.map(node => node.chain_height).filter(height => Number.isFinite(height) && height > 0);
  const tips = reachableNodes.map(node => node.tip_hash).filter(Boolean);
  const tipAgreement = tips.length > 0 && new Set(tips).size === 1;
  const heightSpread = heights.length > 0 ? Math.max(...heights) - Math.min(...heights) : null;
  const currentTip = tipAgreement ? tips[0] : tips[0] ?? null;
  const nodesOnline = reachableNodes.length;
  const expectedNodes = DEFAULT_NODES.length;

  let status = 'ISSUE';
  if (nodesOnline > 0) {
    status = tipAgreement && nodesOnline === expectedNodes && (heightSpread ?? 0) === 0 ? 'RUNNING' : 'DEGRADED';
  }

  return {
    status,
    tip_agreement: tipAgreement,
    height_spread: heightSpread,
    nodes_online: nodesOnline,
    expected_nodes: expectedNodes,
    current_tip: currentTip,
    min_height: heights.length > 0 ? Math.min(...heights) : null,
    max_height: heights.length > 0 ? Math.max(...heights) : null,
    pool_reachable: !!pool.reachable,
    pool_active_miners: pool.active_miners,
    pool_valid_shares: pool.valid_shares,
    pool_invalid_shares: pool.invalid_shares,
    pool_accept_rate_pct: pool.accept_rate_pct,
  };
}

function createInitialState(options) {
  const startedAt = options.startAt ?? new Date().toISOString();
  return {
    schema_version: STATE_SCHEMA_VERSION,
    run_id: options.runId ?? `mainnet-stability-${startedAt.replace(/[:.]/g, '-')}`,
    started_at: startedAt,
    target_duration_secs: DEFAULT_TARGET_DURATION_SECS,
    sample_interval_secs: options.intervalSec,
    last_sample_at: null,
    samples_collected: 0,
    healthy_samples: 0,
    issue_count: 0,
    non_running_streak: 0,
    healthy_sample_ratio: null,
    latest: null,
  };
}

async function collectOnce(options) {
  await ensureParentDir(options.statePath);
  await ensureParentDir(options.logPath);

  let state = (await readJsonFile(options.statePath)) ?? createInitialState(options);
  state = await migrateStateIfNeeded(state, options.logPath);
  const timestamp = new Date().toISOString();

  const [nodes, pool] = await Promise.all([
    Promise.all(DEFAULT_NODES.map(fetchNodeSnapshot)),
    fetchPoolSnapshot(),
  ]);

  const summary = buildSummary(nodes, pool);
  const previousSamples = Number(state.samples_collected ?? 0);
  const previousHealthySamples = Number.isFinite(Number(state.healthy_samples))
    ? Number(state.healthy_samples)
    : state.healthy_sample_ratio == null
    ? 0
    : Math.round(Number(state.healthy_sample_ratio) * previousSamples);
  const previousNonRunningStreak = Number(state.non_running_streak ?? 0);
  const isHealthySample = isHealthySummary(summary);
  const nextSamples = previousSamples + 1;
  const nextHealthySamples = previousHealthySamples + (isHealthySample ? 1 : 0);
  const nextNonRunningStreak = isHealthySample ? 0 : previousNonRunningStreak + 1;
  const incidentOpened = !isHealthySample && nextNonRunningStreak === INCIDENT_DEBOUNCE_SAMPLES;

  const sample = {
    timestamp,
    run_id: state.run_id,
    started_at: state.started_at,
    nodes,
    pool,
    summary,
    evaluation: {
      healthy_sample: isHealthySample,
      non_running_streak: nextNonRunningStreak,
      incident_opened: incidentOpened,
    },
  };

  const nextState = {
    ...state,
    schema_version: STATE_SCHEMA_VERSION,
    sample_interval_secs: options.intervalSec,
    last_sample_at: timestamp,
    samples_collected: nextSamples,
    healthy_samples: nextHealthySamples,
    issue_count: Number(state.issue_count ?? 0) + (incidentOpened ? 1 : 0),
    non_running_streak: nextNonRunningStreak,
    healthy_sample_ratio: roundTo(nextHealthySamples / nextSamples, 4),
    latest: summary,
  };

  await appendFile(options.logPath, `${JSON.stringify(sample)}\n`, 'utf8');
  await writeFile(options.statePath, `${JSON.stringify(nextState, null, 2)}\n`, 'utf8');

  console.log(JSON.stringify({
    timestamp,
    run_id: nextState.run_id,
    status: summary.status,
    samples_collected: nextState.samples_collected,
    issue_count: nextState.issue_count,
    incident_opened: incidentOpened,
    nodes_online: summary.nodes_online,
    tip_agreement: summary.tip_agreement,
    height_spread: summary.height_spread,
  }));
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  do {
    await collectOnce(options);
    if (options.once) {
      return;
    }
    await sleep(options.intervalSec * 1000);
  } while (true);
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});