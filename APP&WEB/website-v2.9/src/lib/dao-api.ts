/**
 * ZION DAO API Client
 * Connects to FastAPI backend at localhost:8001/dao
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

export interface GovernanceProposal {
  id: number;
  proposer: string;
  title: string;
  description: string;
  ipfs_hash: string;
  targets: string[];
  values: number[];
  calldatas: string[];
  start_block: number;
  end_block: number;
  for_votes: string;
  against_votes: string;
  abstain_votes: string;
  state: string;
  created_at: number;
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
}

export interface DAOHealth {
  status: string;
  governance_db: string;
  humanitarian_db: string;
  governance_proposals: number;
  humanitarian_proposals: number;
  humanitarian_treasury: number;
}

/**
 * Fetch DAO health status
 */
export async function getDAOHealth(): Promise<DAOHealth> {
  const response = await fetch(`${API_BASE_URL}/dao/health`, {
    cache: 'no-store'
  });
  
  if (!response.ok) {
    throw new Error(`Health check failed: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Fetch DAO statistics
 */
export async function getDAOStats(): Promise<DAOStats> {
  const response = await fetch(`${API_BASE_URL}/dao/stats`, {
    cache: 'no-store'
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch stats: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.stats;
}

/**
 * Fetch all governance proposals
 */
export async function getGovernanceProposals(): Promise<GovernanceProposal[]> {
  const response = await fetch(`${API_BASE_URL}/dao/governance/proposals`, {
    cache: 'no-store'
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch proposals: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.proposals;
}

/**
 * Fetch single governance proposal
 */
export async function getGovernanceProposal(id: number): Promise<GovernanceProposal> {
  const response = await fetch(`${API_BASE_URL}/dao/governance/proposal/${id}`, {
    cache: 'no-store'
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch proposal: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.proposal;
}

/**
 * Cast vote on governance proposal
 */
export async function castGovernanceVote(
  proposalId: number, 
  voter: string, 
  voteType: 'for' | 'against' | 'abstain'
): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE_URL}/dao/governance/vote?proposal_id=${proposalId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      voter,
      vote_type: voteType
    })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to cast vote');
  }
  
  return response.json();
}

/**
 * Create governance proposal
 */
export async function createGovernanceProposal(proposal: {
  proposer: string;
  title: string;
  description: string;
  targets: string[];
  values: number[];
  calldatas: string[];
}): Promise<GovernanceProposal> {
  const response = await fetch(`${API_BASE_URL}/dao/governance/proposal/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(proposal)
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to create proposal');
  }
  
  const data = await response.json();
  return data.proposal;
}

/**
 * Fetch all humanitarian proposals
 */
export async function getHumanitarianProposals(): Promise<HumanitarianProposal[]> {
  const response = await fetch(`${API_BASE_URL}/dao/humanitarian/proposals`, {
    cache: 'no-store'
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch humanitarian proposals: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.proposals;
}

/**
 * Create humanitarian proposal
 */
export async function createHumanitarianProposal(proposal: {
  title: string;
  description: string;
  category: string;
  recipient_address: string;
  recipient_organization: string;
  amount_zion: number;
  amount_usd: number;
  location: string;
  beneficiaries: number;
  proposer_address: string;
}): Promise<HumanitarianProposal> {
  const response = await fetch(`${API_BASE_URL}/dao/humanitarian/proposal/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(proposal)
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to create humanitarian proposal');
  }
  
  const data = await response.json();
  return data.proposal;
}
