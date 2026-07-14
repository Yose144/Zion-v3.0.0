// Direct DAO daemon HTTP API client.

import { httpGet, httpPost } from '../lib/client';
import { DAO, endpointUrl, type ServiceEndpoint } from '../config/services';

export interface DaoHealth {
  status?: string;
  ok?: boolean;
  error?: string;
}

export interface DaoProposal {
  id: string;
  title?: string;
  description?: string;
  proposer?: string;
  status?: string;
  yes_votes?: number;
  no_votes?: number;
  created_at?: number;
  ends_at?: number;
}

export interface DaoStats {
  ok: boolean;
  total_proposals?: number;
  active_proposals?: number;
  executed_proposals?: number;
  guardians?: number;
  members?: number;
  treasury_balance_zion?: number;
  error?: string;
}

export interface DaoVotePayload {
  proposal_id: string;
  vote: 'yes' | 'no';
  voter?: string;
}

function daoUrl(path: string, ep: ServiceEndpoint = DAO): string {
  return endpointUrl(ep, path);
}

export async function checkDaoHealth(ep: ServiceEndpoint = DAO): Promise<boolean> {
  const h = await httpGet<DaoHealth>(daoUrl('/health', ep), 2000);
  return !!h && (h.ok === true || h.status === 'ok');
}

export async function fetchDaoStats(ep: ServiceEndpoint = DAO): Promise<DaoStats | null> {
  return httpGet<DaoStats>(daoUrl('/stats', ep), 4000);
}

export async function fetchDaoProposals(ep: ServiceEndpoint = DAO): Promise<{ ok: boolean; proposals: DaoProposal[]; error?: string } | null> {
  return httpGet<{ ok: boolean; proposals: DaoProposal[]; error?: string }>(daoUrl('/proposals', ep), 4000);
}

export async function fetchDaoProposal(id: string, ep: ServiceEndpoint = DAO): Promise<{ ok: boolean; proposal?: DaoProposal; error?: string } | null> {
  return httpGet<{ ok: boolean; proposal?: DaoProposal; error?: string }>(daoUrl(`/proposals/${encodeURIComponent(id)}`, ep), 4000);
}

export async function submitDaoVote(payload: DaoVotePayload, ep: ServiceEndpoint = DAO): Promise<{ ok: boolean; error?: string } | null> {
  return httpPost<{ ok: boolean; error?: string }>(daoUrl('/proposals/vote', ep), payload, 8000);
}
