'use client';

import { motion } from 'framer-motion';
import { ThumbsUp, ThumbsDown, Minus, Clock, Users, Calendar } from 'lucide-react';
import { useState } from 'react';
import { GovernanceProposal } from '@/lib/dao-api';

interface ProposalCardProps {
  proposal: GovernanceProposal;
  onVote?: (proposalId: string, voteType: string) => void;
}

export default function ProposalCard({ proposal, onVote }: ProposalCardProps) {
  const [isVoting, setIsVoting] = useState(false);

  const votesFor = Number(proposal.for_votes || 0);
  const votesAgainst = Number(proposal.against_votes || 0);
  const votesAbstain = Number(proposal.abstain_votes || 0);
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

  const status = proposal.state.toUpperCase();
  const isActive = status === 'ACTIVE';

  const statusClass =
    status === 'ACTIVE'
      ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10'
      : status === 'PASSED' || status === 'EXECUTED'
      ? 'text-zion-gold border-zion-gold/20 bg-zion-gold/10'
      : status === 'REJECTED'
      ? 'text-red-400 border-red-500/20 bg-red-500/10'
      : 'text-gray-400 border-white/10 bg-white/5';

  const formatNumber = (n: number) => (n ? n.toLocaleString() : '—');
  const endDate = proposal.voting_ends_at
    ? new Date(proposal.voting_ends_at).toISOString().split('T')[0]
    : '—';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="zion-rainbow-sub p-5 transition-colors"
      style={{ '--rc': '16, 185, 129' } as React.CSSProperties}
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <span className="text-xs font-mono text-gray-500 mt-1">#{proposal.id}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${statusClass}`}>
              <Clock className="h-3 w-3" />
              {proposal.state}
            </span>
          </div>
          <h3 className="text-base font-medium text-white leading-snug">{proposal.title}</h3>
        </div>
      </div>

      <p className="text-sm text-gray-400 mb-4 line-clamp-2">{proposal.description}</p>

      {/* Vote bars */}
      <div className="space-y-3 mb-4">
        <div>
          <div className="flex justify-between text-[10px] mb-1">
            <span className="text-emerald-400">For</span>
            <span className="text-gray-400">{forPercent.toFixed(1)}%</span>
          </div>
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${forPercent}%` }} />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-[10px] mb-1">
            <span className="text-red-400">Against</span>
            <span className="text-gray-400">{againstPercent.toFixed(1)}%</span>
          </div>
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div className="h-full bg-red-500 rounded-full" style={{ width: `${againstPercent}%` }} />
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

      {/* Vote counts */}
      <div className="grid grid-cols-3 gap-2 mb-4 text-center">
        <div className="zion-rainbow-sub p-2" style={{ '--rc': '16, 185, 129' } as React.CSSProperties}>
          <p className="text-xs font-semibold text-emerald-400">{formatNumber(votesFor)}</p>
          <p className="text-[10px] text-gray-500">For</p>
        </div>
        <div className="zion-rainbow-sub p-2" style={{ '--rc': '239, 68, 68' } as React.CSSProperties}>
          <p className="text-xs font-semibold text-red-400">{formatNumber(votesAgainst)}</p>
          <p className="text-[10px] text-gray-500">Against</p>
        </div>
        <div className="zion-rainbow-sub p-2" style={{ '--rc': '107, 114, 128' } as React.CSSProperties}>
          <p className="text-xs font-semibold text-gray-400">{formatNumber(votesAbstain)}</p>
          <p className="text-[10px] text-gray-500">Abstain</p>
        </div>
      </div>

      {/* Voting buttons */}
      {isActive && onVote && (
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
      </div>
    </motion.div>
  );
}
