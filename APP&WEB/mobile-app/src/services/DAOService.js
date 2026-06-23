/**
 * DAOService.js — L2 DAO API client for mobile app
 * ──────────────────────────────────────────────────────────────────────
 * Wraps the public DAO REST API (read-only endpoints).
 *
 * Base URL: https://zionterranova.com/api/dao
 * Endpoints used:
 *   GET /api/dao/health
 *   GET /api/dao/stats
 *   GET /api/dao/proposals?limit=N&status=Active
 *   GET /api/dao/proposals/:id
 *   GET /api/dao/treasury
 *
 * Voting/submission endpoints require X-DAO-Key and are not exposed
 * in the mobile app (guardian-only operations).
 */

import CONFIG from '../constants/config';

const DAO_BASE = (CONFIG.DAO && CONFIG.DAO.API_BASE) || 'https://zionterranova.com/api/dao';

async function daoFetch(path, opts = {}) {
  const url = `${DAO_BASE.replace(/\/$/, '')}${path}`;
  const res = await fetch(url, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  if (!res.ok) throw new Error(`DAO API ${res.status} ${res.statusText}`);
  const raw = await res.json();
  // Rust returns { ok: true, data: {...} } wrapper
  return raw.data ?? raw;
}

/** GET /api/dao/health → { status: 'online'|'offline' } */
export async function getDAOHealth() {
  try {
    const d = await daoFetch('/health');
    return { status: d.status || 'online', ...d };
  } catch {
    return { status: 'offline' };
  }
}

/** GET /api/dao/stats → governance summary */
export async function getDAOStats() {
  try {
    const d = await daoFetch('/stats');
    return {
      total_proposals : d.total_proposals ?? 0,
      active          : d.active ?? 0,
      passed          : d.passed ?? 0,
      executed        : d.executed ?? 0,
      treasury_total_zion : d.treasury_total_zion ?? 4_000_000_000,
      quorum_percent       : d.quorum_percent ?? 10,
      multisig             : d.multisig ?? '5-of-7',
      voting_period_days   : d.voting_period_days ?? 7,
    };
  } catch {
    return null;
  }
}

/** GET /api/dao/proposals → list of proposals */
export async function getDAOProposals({ limit = 20, status } = {}) {
  try {
    const params = new URLSearchParams();
    if (limit) params.set('limit', String(limit));
    if (status) params.set('status', status);
    const qs = params.toString();
    const d = await daoFetch(`/proposals${qs ? `?${qs}` : ''}`);
    // API may return array or { proposals: [...] }
    return Array.isArray(d) ? d : (d.proposals ?? []);
  } catch {
    return [];
  }
}

/** GET /api/dao/proposals/:id → single proposal */
export async function getDAOProposal(id) {
  return daoFetch(`/proposals/${encodeURIComponent(id)}`);
}

/** GET /api/dao/treasury → treasury overview */
export async function getDAOTreasury() {
  try {
    return await daoFetch('/treasury');
  } catch {
    return null;
  }
}

/** Bridge Vault section — derived from bridge config, not DAO API */
export function getBridgeVaultInfo() {
  return {
    vault_address : CONFIG.BRIDGE.L1_VAULT_ADDRESS,
    locked_zion   : '~100M',
    threshold     : CONFIG.BRIDGE.MAINNET.THRESHOLD || 5,
    validators    : CONFIG.BRIDGE.MAINNET.VALIDATOR_COUNT || 5,
    bridge_contract : CONFIG.BRIDGE.MAINNET.BRIDGE_ADDRESS,
    validator_contract : CONFIG.BRIDGE.MAINNET.BRIDGE_VALIDATOR_ADDRESS,
  };
}
