/**
 * Free World (L5) API client — talks to the same-origin proxy
 * `/api/free-world/*` which forwards to the L5 service on the edge.
 *
 * All daemon responses are wrapped: { success, data, error }.
 */

export interface FwFundBalance {
  total_accumulated: number;
  total_disbursed: number;
  last_block_height: number;
  updated_at: string;
}

export type FwGrantStatus =
  | 'pending'
  | 'under_review'
  | 'approved'
  | 'funded'
  | 'completed'
  | 'rejected'
  | 'on_dao';

export interface FwGrant {
  id: string;
  title: string;
  description: string | null;
  applicant_name: string | null;
  applicant_address: string | null;
  category: string;
  amount_zion: number;
  status: FwGrantStatus;
  dao_proposal_id: number | null;
  created_at: string;
  reviewed_at: string | null;
  reviewer_notes: string | null;
}

export type FwProjectStatus =
  | 'proposed'
  | 'approved'
  | 'active'
  | 'on_hold'
  | 'completed'
  | 'cancelled';

export interface FwProject {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  category: string;
  budget_zion: number;
  spent_zion: number;
  status: FwProjectStatus;
  started_at: string | null;
  completed_at: string | null;
  impact_metrics: string | null;
  created_at: string;
}

export type FwRoundStatus = 'draft' | 'open' | 'tallying' | 'closed';

export interface FwRoundGrant {
  id: string;
  title: string;
  category: string;
  amount_zion: number;
}

export interface FwRound {
  id: string;
  title: string;
  credits_per_voter: number;
  matching_pool_zion: number;
  status: FwRoundStatus;
  created_at: string;
  opened_at: string | null;
  closed_at: string | null;
  ballot_count: number;
  grants?: FwRoundGrant[];
}

export interface FwResultGrant {
  grant_id: string;
  votes: number;
  voters: number;
  credits: number;
  requested_zion: number;
  allocated_zion: number;
  capped: boolean;
}

export interface FwResults {
  round_id: string;
  ballots: number;
  total_votes: number;
  total_credits_spent: number;
  matching_pool_zion: number;
  allocated_zion: number;
  unallocated_zion: number;
  grants: FwResultGrant[];
  closed_at: string;
}

interface Envelope<T> {
  success: boolean;
  data: T;
  error: string | null;
}

export class FwApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/free-world/${path}`, {
    cache: 'no-store',
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  });
  let env: Envelope<T> | null = null;
  try {
    env = (await res.json()) as Envelope<T>;
  } catch {
    throw new FwApiError(res.status, `HTTP ${res.status}`);
  }
  if (!res.ok || !env?.success) {
    throw new FwApiError(res.status, env?.error ?? `HTTP ${res.status}`);
  }
  return env.data;
}

export const fwApi = {
  fundBalance: () => request<FwFundBalance>('fund/balance'),
  projects: () => request<FwProject[]>('projects'),
  grants: () => request<FwGrant[]>('grants'),
  rounds: () => request<FwRound[]>('rounds'),
  round: (id: string) => request<FwRound>(`rounds/${id}`),
  roundResults: (id: string) => request<FwResults>(`rounds/${id}/results`),
  castBallot: (roundId: string, votes: { grant_id: string; votes: number }[]) =>
    request<{ round_id: string; voter_id: string; votes: number; credits: number; tally: number }>(
      `rounds/${roundId}/ballots`,
      { method: 'POST', body: JSON.stringify({ votes }) },
    ),
};
