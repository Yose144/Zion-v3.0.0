/**
 * ZION DAO API Client
 * Connects to the Rust zion-dao daemon (axum, port 8081).
 *
 * Endpoint base (override via NEXT_PUBLIC_DAO_API_URL):
 *   default     → internal Next.js `/api/dao` proxy route
 *   override    → any external DAO gateway base URL
 *
 * Rust DAO routes:
 *   GET  /api/dao/health
 *   GET  /api/dao/stats
 *   GET  /api/dao/proposals          ?limit=N&offset=N&status=Active
 *   GET  /api/dao/proposals/:id
 *   POST /api/dao/proposals          (X-DAO-Key required)
 *   POST /api/dao/proposals/:id/vote (X-DAO-Key required)
 *   GET  /api/dao/treasury
 *   POST /api/dao/treasury/submit    (X-DAO-Key required)
 *   POST /api/dao/treasury/:op_id/sign
 *   POST /api/dao/treasury/:op_id/execute
 */

const DAO_BASE =
  process.env.NEXT_PUBLIC_DAO_API_URL || '';

// ---------------------------------------------------------------------------
// TypeScript interfaces — aligned with Rust ProposalRow + dao_stats response
// ---------------------------------------------------------------------------

/** ProposalRow as returned by Rust /api/dao/proposals */
export interface GovernanceProposal {
  id: number;
  /** "Active" | "Passed" | "Rejected" | "Executed" | "Pending" */
  state: string;
  proposal_type_json: string;
  title: string;
  description: string;
  proposer: string;
  /** votes_yes as string (safe for BigInt) */
  for_votes: string;
  /** votes_no as string (safe for BigInt) */
  against_votes: string;
  /** votes_abstain as string */
  abstain_votes: string;
  /** ISO-8601 datetime string */
  created_at: string;
  voting_ends_at: string;
  executed_at: string | null;
  // Optional fields used for display
  start_block?: number;
  end_block?: number;
}

export interface HumanitarianProposal {
  id: number;
  title: string;
  description: string;
  category: string;
  recipient_address: string;
  recipient_organization: string;
  amount_zion: number;
  amount_usd: number;
  location: string;
  beneficiaries: number;
  votes_for: number;
  votes_against: number;
  voter_count: number;
  created_at: number;
  voting_deadline: number;
  status: string;
  proposer_address: string;
}

/** Shaped to match the existing page/component expectations */
export interface DAOStats {
  governance: {
    total_proposals: number;
    active_voters: number;
    treasury_balance: string;
    grants_funded: number;
    total_spent: number;
    dao_reserve: string;
  };
  humanitarian: {
    total_proposals: number;
    active_proposals: number;
    total_funded: number;
    total_beneficiaries: number;
  };
  treasury_balance: number;
  /** Raw Rust fields */
  active: number;
  passed: number;
  executed: number;
  quorum_percent: number;
  multisig: string;
  voting_period_days: number;
}

export interface DAOHealth {
  status: string;
  total_proposals?: number;
  db_version?: string;
}

export interface DAOTreasuryOverview {
  total_zion: number;
  available_atomic: string;
  available_zion: number;
  addresses: string[];
  multisig: string;
  pending_operations: number;
  daily_spend_limit_zion: number;
  note?: string;
}

export interface TreasuryMultisigResult {
  op_id: string;
  signatures?: number;
  threshold?: number;
  ready?: boolean;
  executed_by?: string;
  amount_atomic?: number;
  amount_zion?: number;
}

// ---------------------------------------------------------------------------
// Placeholder / fallback data (shown when DAO daemon is not yet deployed)
// ---------------------------------------------------------------------------

const PLACEHOLDER_STATS: DAOStats = {
  governance: {
    total_proposals: 0,
    active_voters: 0,
    treasury_balance: '4,000,000,000 ZION',
    grants_funded: 0,
    total_spent: 0,
    dao_reserve: '4,000,000,000 ZION',
  },
  humanitarian: {
    total_proposals: 0,
    active_proposals: 0,
    total_funded: 0,
    total_beneficiaries: 0,
  },
  treasury_balance: 4_000_000_000,
  active: 0,
  passed: 0,
  executed: 0,
  quorum_percent: 10,
  multisig: '5-of-7',
  voting_period_days: 7,
};

// ---------------------------------------------------------------------------
// Internal helper — fetch from Rust DAO with timeout + graceful error
// ---------------------------------------------------------------------------

async function daoFetch(path: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${DAO_BASE}${path}`, {
      ...init,
      signal: controller.signal,
    });
    clearTimeout(tid);
    return res;
  } catch (e) {
    clearTimeout(tid);
    throw e;
  }
}

/** Map Rust ProposalRow fields → GovernanceProposal used by the page */
function mapProposal(row: any): GovernanceProposal {
  return {
    id: row.id,
    state: row.status ?? row.state ?? 'Pending',
    proposal_type_json: row.proposal_type_json ?? '{}',
    title: row.title,
    description: row.description,
    proposer: row.proposer,
    for_votes: String(row.votes_yes ?? row.for_votes ?? 0),
    against_votes: String(row.votes_no ?? row.against_votes ?? 0),
    abstain_votes: String(row.votes_abstain ?? row.abstain_votes ?? 0),
    created_at: row.created_at ?? new Date().toISOString(),
    voting_ends_at: row.voting_ends_at ?? '',
    executed_at: row.executed_at ?? null,
    start_block: row.start_block,
    end_block: row.end_block,
  };
}

// ---------------------------------------------------------------------------
// Public API functions
// ---------------------------------------------------------------------------

/** GET /api/dao/health */
export async function getDAOHealth(): Promise<DAOHealth> {
  try {
    const res = await daoFetch('/api/dao/health', { cache: 'no-store' });
    if (!res.ok) throw new Error(`${res.status}`);
    const data = await res.json();
    // Rust returns {ok: true, data: {...}} wrapper
    return (data.data ?? data) as DAOHealth;
  } catch {
    return { status: 'offline' };
  }
}

/**
 * GET /api/dao/stats
 * Shapes flat Rust response into the nested structure the page expects.
 */
export async function getDAOStats(): Promise<DAOStats> {
  try {
    const res = await daoFetch('/api/dao/stats', { cache: 'no-store' });
    if (!res.ok) throw new Error(`${res.status}`);
    const raw = await res.json();
    const d = raw.data ?? raw;

    return {
      governance: {
        total_proposals: d.total_proposals ?? 0,
        active_voters: d.active ?? 0,
        treasury_balance: `${(d.treasury_total_zion ?? 4_000_000_000).toLocaleString()} ZION`,
        grants_funded: d.executed ?? 0,
        total_spent: 0,
        dao_reserve: `${(d.treasury_total_zion ?? 4_000_000_000).toLocaleString()} ZION`,
      },
      humanitarian: {
        total_proposals: 0,
        active_proposals: d.active ?? 0,
        total_funded: 0,
        total_beneficiaries: 0,
      },
      treasury_balance: d.treasury_total_zion ?? 4_000_000_000,
      active: d.active ?? 0,
      passed: d.passed ?? 0,
      executed: d.executed ?? 0,
      quorum_percent: d.quorum_percent ?? 10,
      multisig: d.multisig ?? '5-of-7',
      voting_period_days: d.voting_period_days ?? 7,
    };
  } catch {
    // DAO daemon not yet deployed — return placeholder so page looks good
    return PLACEHOLDER_STATS;
  }
}

/** GET /api/dao/treasury */
export async function getDAOTreasuryOverview(): Promise<DAOTreasuryOverview | null> {
  try {
    const res = await daoFetch('/api/dao/treasury', { cache: 'no-store' });
    if (!res.ok) throw new Error(`${res.status}`);
    const raw = await res.json();
    return (raw.data ?? raw) as DAOTreasuryOverview;
  } catch {
    return null;
  }
}

/**
 * POST /api/dao/treasury/submit
 * operation format follows Rust TreasuryOperation enum JSON shape.
 */
export async function submitTreasuryOperation(input: {
  apiKey: string;
  op_id: string;
  guardian: string;
  operation: Record<string, unknown>;
}): Promise<TreasuryMultisigResult> {
  const res = await daoFetch('/api/dao/treasury/submit', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-DAO-Key': input.apiKey,
    },
    body: JSON.stringify({
      op_id: input.op_id,
      guardian: input.guardian,
      operation: input.operation,
    }),
  });

  const raw = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(raw.error || `Submit failed (${res.status})`);
  return (raw.data ?? raw) as TreasuryMultisigResult;
}

/** POST /api/dao/treasury/:op_id/sign */
export async function signTreasuryOperation(input: {
  apiKey: string;
  op_id: string;
  guardian: string;
}): Promise<TreasuryMultisigResult> {
  const res = await daoFetch(`/api/dao/treasury/${encodeURIComponent(input.op_id)}/sign`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-DAO-Key': input.apiKey,
    },
    body: JSON.stringify({ guardian: input.guardian }),
  });

  const raw = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(raw.error || `Sign failed (${res.status})`);
  return (raw.data ?? raw) as TreasuryMultisigResult;
}

/** POST /api/dao/treasury/:op_id/execute */
export async function executeTreasuryOperation(input: {
  apiKey: string;
  op_id: string;
  guardian: string;
}): Promise<TreasuryMultisigResult> {
  const res = await daoFetch(`/api/dao/treasury/${encodeURIComponent(input.op_id)}/execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-DAO-Key': input.apiKey,
    },
    body: JSON.stringify({ guardian: input.guardian }),
  });

  const raw = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(raw.error || `Execute failed (${res.status})`);
  return (raw.data ?? raw) as TreasuryMultisigResult;
}

/** GET /api/dao/proposals */
export async function getGovernanceProposals(
  limit = 20,
  offset = 0,
  status?: string,
): Promise<GovernanceProposal[]> {
  try {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (status) params.set('status', status);
    const res = await daoFetch(`/api/dao/proposals?${params}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`${res.status}`);
    const raw = await res.json();
    const rows: unknown[] = (raw.data ?? raw).proposals ?? [];
    return rows.map(mapProposal);
  } catch {
    return [];
  }
}

/** GET /api/dao/proposals/:id */
export async function getGovernanceProposal(id: number): Promise<GovernanceProposal | null> {
  try {
    const res = await daoFetch(`/api/dao/proposals/${id}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const raw = await res.json();
    return mapProposal(raw.data ?? raw);
  } catch {
    return null;
  }
}

/**
 * POST /api/dao/proposals/:id/vote
 * Maps frontend 'for'/'against' → Rust 'yes'/'no'
 */
export async function castGovernanceVote(
  proposalId: number,
  voter: string,
  voteType: 'for' | 'against' | 'abstain',
  weightFlowers?: number,
): Promise<{ success: boolean; message: string }> {
  const rustChoice = voteType === 'for' ? 'yes' : voteType === 'against' ? 'no' : 'abstain';
  const weight = weightFlowers ?? 1_000_000; // default 1 ZION if no balance provided
  const res = await daoFetch(`/api/dao/proposals/${proposalId}/vote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ voter, choice: rustChoice, weight }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err.data ?? err.error) || `Vote failed: ${res.status}`);
  }
  const data = await res.json();
  return { success: true, message: data.data?.message ?? 'Vote recorded' };
}

/**
 * POST /api/dao/proposals  (requires X-DAO-Key header)
 */
export async function createGovernanceProposal(proposal: {
  proposer: string;
  title: string;
  description: string;
  proposal_type?: Record<string, unknown>;
}): Promise<GovernanceProposal> {
  const res = await daoFetch('/api/dao/proposals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      proposer: proposal.proposer,
      title: proposal.title,
      description: proposal.description,
      proposal_type: proposal.proposal_type ?? { Parameter: { parameter_name: 'general', current_value: '', proposed_value: '' } },
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err.data ?? err.error) || 'Failed to create proposal');
  }
  const raw = await res.json();
  return mapProposal(raw.data ?? raw);
}

/** Humanitarian proposals — not yet in Rust daemon, returns empty list */
export async function getHumanitarianProposals(): Promise<HumanitarianProposal[]> {
  return [];
}

export async function createHumanitarianProposal(
  _proposal: Partial<HumanitarianProposal>
): Promise<HumanitarianProposal> {
  throw new Error('Humanitarian DAO API not yet available — coming in Phase 2');
}

