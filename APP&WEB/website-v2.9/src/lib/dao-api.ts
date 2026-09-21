/**
 * ZION DAO API Client
 * Connects to the Rust zion-dao daemon (axum, port 8450).
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

/** Proposal as returned by Rust /api/dao/proposals (serialize_proposal) */
export interface GovernanceProposal {
  id: number;
  uuid?: string;
  /** "Draft" | "Active" | "Passed" | "Failed" | "Timelocked" | "Executed" | "Cancelled" | "Expired" */
  state: string;
  /** "parameter" | "treasury" | "emergency" | "grant" | "humanitarian" | ... */
  proposal_type: string;
  title: string;
  description: string;
  proposer: string;
  /** proposer balance at snapshot (flowers, as string — safe for BigInt) */
  proposer_balance?: string;
  /** vote weight in favour (flowers, string) */
  for_votes: string;
  /** vote weight against (flowers, string) */
  against_votes: string;
  /** abstain vote weight (flowers, string) */
  abstain_votes: string;
  /** number of distinct voters */
  voter_count: number;
  /** total vote weight (flowers, string) */
  total_votes: string;
  /** ISO-8601 datetime string */
  created_at: string;
  voting_ends_at: string;
  timelock_ends_at?: string | null;
  executed_at: string | null;
  /** server-computed: status == Active && now < voting_ends_at */
  is_voting_open: boolean;
  has_passed: boolean;
  snapshot_block?: number;
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
  /** Active proposals whose voting window already closed (pending tally) */
  awaiting_tally: number;
  passed: number;
  executed: number;
  failed: number;
  quorum_percent: number;
  multisig: string;
  voting_period_days: number;
  timelock_hours: number;
  /** Minimum balance (flowers) required to vote — 1 ZION = 1_000_000 */
  min_vote_weight: number;
  /** Minimum proposer balance (flowers) required to create a proposal */
  proposal_threshold: number;
  guardian_count: number;
  total_votes_cast: number;
  unique_voters: number;
}

/** A single vote record from GET /api/dao/proposals/:id/votes */
export interface ProposalVote {
  voter: string;
  choice: string;
  /** vote weight in flowers */
  weight: string | number;
  tx_hash: string | null;
  voted_at: string;
}

/** A treasury multisig operation from GET /api/dao/treasury/ops */
export interface TreasuryOp {
  op_id: string;
  proposal_id: number | null;
  operation: Record<string, unknown> | null;
  submitted_by: string;
  status: string;
  created_at: string;
  executed_at: string | null;
  signatures: string[];
  signature_count: number;
  threshold: number;
  amount_atomic: number;
  amount_zion: number;
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
    treasury_balance: '1,500,000,000 ZION',
    grants_funded: 0,
    total_spent: 0,
    dao_reserve: '1,500,000,000 ZION',
  },
  humanitarian: {
    total_proposals: 0,
    active_proposals: 0,
    total_funded: 0,
    total_beneficiaries: 0,
  },
  treasury_balance: 1_500_000_000,
  active: 0,
  awaiting_tally: 0,
  passed: 0,
  executed: 0,
  failed: 0,
  quorum_percent: 15,
  multisig: '5-of-7',
  voting_period_days: 14,
  timelock_hours: 72,
  min_vote_weight: 1_000_000,
  proposal_threshold: 10_000_000_000_000,
  guardian_count: 7,
  total_votes_cast: 0,
  unique_voters: 0,
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

/** Map Rust serialize_proposal fields → GovernanceProposal used by the page */
function mapProposal(row: any): GovernanceProposal {
  return {
    id: row.id,
    uuid: row.uuid,
    state: row.status ?? row.state ?? 'Pending',
    proposal_type: row.proposal_type ?? '',
    title: row.title,
    description: row.description,
    proposer: row.proposer,
    proposer_balance: row.proposer_balance != null ? String(row.proposer_balance) : undefined,
    for_votes: String(row.votes_for ?? row.for_votes ?? row.votes_yes ?? 0),
    against_votes: String(row.votes_against ?? row.against_votes ?? row.votes_no ?? 0),
    abstain_votes: String(row.votes_abstain ?? row.abstain_votes ?? 0),
    voter_count: row.voter_count ?? 0,
    total_votes: String(row.total_votes ?? 0),
    created_at: row.created_at ?? new Date().toISOString(),
    voting_ends_at: row.voting_ends_at ?? '',
    timelock_ends_at: row.timelock_ends_at ?? null,
    executed_at: row.executed_at ?? null,
    is_voting_open: !!row.is_voting_open,
    has_passed: !!row.has_passed,
    snapshot_block: row.snapshot_block ?? row.start_block,
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
        active_voters: d.unique_voters ?? 0,
        treasury_balance: `${(d.treasury_total_zion ?? 1_500_000_000).toLocaleString()} ZION`,
        grants_funded: d.executed ?? 0,
        total_spent: 0,
        dao_reserve: `${(d.treasury_total_zion ?? 1_500_000_000).toLocaleString()} ZION`,
      },
      humanitarian: {
        total_proposals: 0,
        active_proposals: d.active ?? 0,
        total_funded: 0,
        total_beneficiaries: 0,
      },
      treasury_balance: d.treasury_total_zion ?? 1_500_000_000,
      active: d.active ?? 0,
      awaiting_tally: d.awaiting_tally ?? 0,
      passed: d.passed ?? 0,
      executed: d.executed ?? 0,
      failed: d.failed ?? 0,
      quorum_percent: d.quorum_percent ?? 10,
      multisig: d.multisig ?? '5-of-7',
      voting_period_days: d.voting_period_days ?? 7,
      timelock_hours: d.timelock_hours ?? 48,
      min_vote_weight: d.min_vote_weight ?? 1_000_000,
      proposal_threshold: d.proposal_threshold ?? 1_000_000_000_000,
      guardian_count: d.guardian_count ?? 7,
      total_votes_cast: d.total_votes_cast ?? 0,
      unique_voters: d.unique_voters ?? 0,
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

/** GET /api/dao/proposals/:id/votes — per-voter breakdown */
export async function getProposalVotes(id: number): Promise<ProposalVote[]> {
  try {
    const res = await daoFetch(`/api/dao/proposals/${id}/votes`, { cache: 'no-store' });
    if (!res.ok) return [];
    const raw = await res.json();
    return ((raw.data ?? raw).votes ?? []) as ProposalVote[];
  } catch {
    return [];
  }
}

/** GET /api/dao/treasury/ops — multisig operations with signature progress */
export async function getTreasuryOps(status?: string): Promise<TreasuryOp[]> {
  try {
    const params = status ? `?status=${encodeURIComponent(status)}` : '';
    const res = await daoFetch(`/api/dao/treasury/ops${params}`, { cache: 'no-store' });
    if (!res.ok) return [];
    const raw = await res.json();
    return ((raw.data ?? raw).operations ?? []) as TreasuryOp[];
  } catch {
    return [];
  }
}

/** Proposal type payloads accepted by the Rust `ProposalTypeDto` (kind/data tagged). */
export type ProposalTypeInput =
  | { kind: 'Parameter'; data: { parameter_name: string; current_value: string; proposed_value: string } }
  | { kind: 'Treasury'; data: { recipient: string; amount: number; purpose: string } }
  | { kind: 'Grant'; data: { recipient: string; amount: number; milestones: string[]; duration_days: number } }
  | { kind: 'Emergency'; data: { action: string; justification: string } }
  | { kind: 'Humanitarian'; data: { category: string; amount: number; region: string; description: string } };

/**
 * POST /api/dao/proposals
 *
 * Auth: `zion_session` cookie (identity + balance resolved server-side from
 * ZIS/L1) or `X-DAO-Key` operator header. `proposer_balance`/`snapshot_block`
 * are server-resolved for ZIS callers — clients must not send them.
 */
export async function createGovernanceProposal(proposal: {
  proposer: string;
  title: string;
  description: string;
  proposal_type?: ProposalTypeInput;
}): Promise<{ proposal_id: number }> {
  const res = await daoFetch('/api/dao/proposals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      proposer: proposal.proposer,
      title: proposal.title,
      description: proposal.description,
      proposal_type: proposal.proposal_type ?? {
        kind: 'Parameter',
        data: { parameter_name: 'general', current_value: '', proposed_value: '' },
      },
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err.data ?? err.error) || 'Failed to create proposal');
  }
  const raw = await res.json();
  return (raw.data ?? raw) as { proposal_id: number };
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

