'use client';

import { motion } from 'framer-motion';
import { ThumbsUp, ThumbsDown, Minus, Clock, Users, Calendar, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { GovernanceProposal, ProposalVote, getProposalVotes } from '@/lib/dao-api';
import { useLang } from '@/contexts/LanguageContext';

const FLOWERS_PER_ZION = 1_000_000;

/** Vote weights are stored in flowers (1 ZION = 1e6) — render as ZION. */
function flowersToZion(v: string | number): number {
  const n = typeof v === 'string' ? Number(v) : v;
  return Number.isFinite(n) ? n / FLOWERS_PER_ZION : 0;
}

function formatZion(n: number): string {
  if (!n) return '0';
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

interface ProposalCardProps {
  proposal: GovernanceProposal;
  onVote?: (proposalId: string, voteType: string) => void;
}

export default function ProposalCard({ proposal, onVote }: ProposalCardProps) {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const [isVoting, setIsVoting] = useState(false);
  const [votesOpen, setVotesOpen] = useState(false);
  const [votes, setVotes] = useState<ProposalVote[] | null>(null);
  const [votesLoading, setVotesLoading] = useState(false);

  const votesFor = flowersToZion(proposal.for_votes);
  const votesAgainst = flowersToZion(proposal.against_votes);
  const votesAbstain = flowersToZion(proposal.abstain_votes);
  const totalVotes = votesFor + votesAgainst + votesAbstain;

  const forPercent = totalVotes > 0 ? (votesFor / totalVotes) * 100 : 0;
  const againstPercent = totalVotes > 0 ? (votesAgainst / totalVotes) * 100 : 0;
  const abstainPercent = totalVotes > 0 ? (votesAbstain / totalVotes) * 100 : 0;

  const handleVote = async (voteType: string) => {
    if (!onVote) return;
    setIsVoting(true);
    try {
      await onVote(String(proposal.id), voteType);
    } finally {
      setIsVoting(false);
    }
  };

  const toggleVotes = async () => {
    if (!votesOpen && votes === null) {
      setVotesLoading(true);
      try {
        setVotes(await getProposalVotes(proposal.id));
      } finally {
        setVotesLoading(false);
      }
    }
    setVotesOpen(!votesOpen);
  };

  const status = proposal.state.toUpperCase();
  const isActive = status === 'ACTIVE';
  const votingOpen = proposal.is_voting_open;
  // Voting window closed but not yet tallied — voting is rejected server-side.
  const awaitingTally = isActive && !votingOpen;

  const statusClass =
    awaitingTally
      ? 'text-zion-gold border-zion-gold/20 bg-zion-gold/10'
      : status === 'ACTIVE'
      ? 'text-zion-cyan border-zion-cyan/20 bg-zion-cyan/10'
      : status === 'PASSED' || status === 'EXECUTED' || status === 'TIMELOCKED'
      ? 'text-zion-gold border-zion-gold/20 bg-zion-gold/10'
      : status === 'FAILED' || status === 'REJECTED' || status === 'CANCELLED' || status === 'EXPIRED'
      ? 'text-zion-purple border-zion-purple/20 bg-zion-purple/10'
      : 'text-gray-400 border-white/10 bg-white/5';

  const endDate = proposal.voting_ends_at
    ? new Date(proposal.voting_ends_at).toISOString().split('T')[0]
    : '—';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="zion-rainbow-sub p-5 transition-colors"
      style={{ '--rc': '6, 105, 40' } as React.CSSProperties}
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <span className="text-xs font-mono text-gray-500 mt-1">#{proposal.id}</span>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${statusClass}`}>
              <Clock className="h-3 w-3" />
              {awaitingTally
                ? (cs ? 'Awaiting tally' : 'Awaiting tally')
                : proposal.state}
            </span>
            {proposal.proposal_type && (
              <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wider text-gray-400">
                {proposal.proposal_type}
              </span>
            )}
          </div>
          <h3 className="text-base font-medium text-white leading-snug">{proposal.title}</h3>
        </div>
      </div>

      <p className="text-sm text-gray-400 mb-4 line-clamp-2">{proposal.description}</p>

      {/* Vote bars */}
      <div className="space-y-3 mb-4">
        <div>
          <div className="flex justify-between text-[10px] mb-1">
            <span className="text-zion-cyan">For</span>
            <span className="text-gray-400">{forPercent.toFixed(1)}%</span>
          </div>
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div className="h-full bg-zion-cyan rounded-full" style={{ width: `${forPercent}%` }} />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-[10px] mb-1">
            <span className="text-zion-purple">Against</span>
            <span className="text-gray-400">{againstPercent.toFixed(1)}%</span>
          </div>
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div className="h-full bg-zion-purple rounded-full" style={{ width: `${againstPercent}%` }} />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-[10px] mb-1">
            <span className="text-gray-400">Abstain</span>
            <span className="text-gray-400">{abstainPercent.toFixed(1)}%</span>
          </div>
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div className="h-full bg-gray-500 rounded-full" style={{ width: `${abstainPercent}%` }} />
          </div>
        </div>
      </div>

      {/* Vote counts (weights rendered in ZION) */}
      <div className="grid grid-cols-3 gap-2 mb-4 text-center">
        <div className="zion-rainbow-sub p-2" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
          <p className="text-xs font-semibold text-zion-cyan">{formatZion(votesFor)}</p>
          <p className="text-[10px] text-gray-500">For (ZION)</p>
        </div>
        <div className="zion-rainbow-sub p-2" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
          <p className="text-xs font-semibold text-zion-purple">{formatZion(votesAgainst)}</p>
          <p className="text-[10px] text-gray-500">Against (ZION)</p>
        </div>
        <div className="zion-rainbow-sub p-2" style={{ '--rc': '107, 114, 128' } as React.CSSProperties}>
          <p className="text-xs font-semibold text-gray-400">{formatZion(votesAbstain)}</p>
          <p className="text-[10px] text-gray-500">Abstain (ZION)</p>
        </div>
      </div>

      {/* Voting buttons — only while the voting window is actually open */}
      {votingOpen && onVote && (
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => handleVote('for')}
            disabled={isVoting}
            className="zion-button-primary flex-1 !px-3 !py-2 !text-xs disabled:opacity-50"
          >
            <ThumbsUp className="h-3.5 w-3.5" />
            For
          </button>
          <button
            onClick={() => handleVote('against')}
            disabled={isVoting}
            className="zion-button-secondary flex-1 !px-3 !py-2 !text-xs disabled:opacity-50"
          >
            <ThumbsDown className="h-3.5 w-3.5" />
            Against
          </button>
          <button
            onClick={() => handleVote('abstain')}
            disabled={isVoting}
            className="zion-button-secondary !px-3 !py-2 !text-xs disabled:opacity-50"
          >
            <Minus className="h-3.5 w-3.5" />
            Abstain
          </button>
        </div>
      )}
      {awaitingTally && (
        <p className="text-[11px] text-zion-gold/80 mb-4 flex items-center gap-1.5">
          <Clock className="h-3 w-3" />
          {cs
            ? 'Hlasování skončilo — návrh čeká na sčítání (automaticky do ~1 min).'
            : 'Voting ended — the proposal is awaiting tally (automatic within ~1 min).'}
        </p>
      )}

      {/* Expandable voter list */}
      {proposal.voter_count > 0 && (
        <div className="mb-4">
          <button
            onClick={toggleVotes}
            className="flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-white transition-colors"
          >
            <ChevronDown className={`h-3 w-3 transition-transform ${votesOpen ? 'rotate-180' : ''}`} />
            {proposal.voter_count} {cs ? 'hlasujících' : 'voters'}
          </button>
          {votesOpen && (
            <div className="mt-2 space-y-1.5 max-h-40 overflow-y-auto">
              {votesLoading ? (
                <p className="text-[11px] text-gray-500">{cs ? 'Načítám…' : 'Loading…'}</p>
              ) : (votes ?? []).map((v) => (
                <div key={`${v.voter}-${v.voted_at}`} className="flex items-center justify-between text-[11px] zion-rainbow-sub px-2.5 py-1.5" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
                  <span className="font-mono text-gray-400 truncate max-w-[55%]">{v.voter}</span>
                  <span className="flex items-center gap-2">
                    <span className={v.choice === 'Yes' ? 'text-zion-cyan' : v.choice === 'No' ? 'text-zion-purple' : 'text-gray-400'}>{v.choice}</span>
                    <span className="font-mono text-gray-300">{formatZion(flowersToZion(v.weight))} ZION</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex flex-wrap gap-3 text-[10px] text-gray-500 border-t border-white/6 pt-3">
        <span className="inline-flex items-center gap-1">
          <Users className="h-3 w-3" />
          Proposer: <span className="text-gray-400 font-mono">{proposal.proposer}</span>
        </span>
        <span className="inline-flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          Ends: <span className="text-gray-400">{endDate}</span>
        </span>
        {proposal.timelock_ends_at && (
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Timelock: <span className="text-gray-400">{new Date(proposal.timelock_ends_at).toISOString().split('T')[0]}</span>
          </span>
        )}
      </div>
    </motion.div>
  );
}
