'use client';

import { motion } from 'framer-motion';
import { ThumbsUp, ThumbsDown, Clock, Users, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { GovernanceProposal } from '@/lib/dao-api';

interface ProposalCardProps {
  proposal: GovernanceProposal;
  onVote?: (proposalId: string, voteType: string) => void;
}

export default function ProposalCard({ proposal, onVote }: ProposalCardProps) {
  const [isVoting, setIsVoting] = useState(false);

  // GovernanceProposal stores votes as strings
  const votesFor = BigInt(Math.floor(Number(proposal.for_votes || 0)));
  const votesAgainst = BigInt(Math.floor(Number(proposal.against_votes || 0)));
  const votesAbstain = 0n; // Not in GovernanceProposal yet

  const totalVotes = votesFor + votesAgainst + votesAbstain;
  
  const forPercent = totalVotes > 0n 
    ? Number((votesFor * 100n) / totalVotes) 
    : 0;
  
  const againstPercent = totalVotes > 0n 
    ? Number((votesAgainst * 100n) / totalVotes) 
    : 0;

  const handleVote = async (voteType: string) => {
    if (!onVote) return;
    
    setIsVoting(true);
    try {
      await onVote(String(proposal.id), voteType);
    } finally {
      setIsVoting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch(status.toUpperCase()) {
      case 'ACTIVE': return 'text-green-400 bg-green-400/10 border-green-400/20';
      case 'PENDING': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
      case 'PASSED': return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
      case 'REJECTED': return 'text-red-400 bg-red-400/10 border-red-400/20';
      case 'EXECUTED': return 'text-purple-400 bg-purple-400/10 border-purple-400/20';
      default: return 'text-gray-400 bg-gray-400/10 border-gray-400/20';
    }
  };

  const formatVotes = (value: bigint) => {
    return value ? value.toLocaleString() : '—';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl border border-white/10 bg-black/40 p-6 backdrop-blur-xl hover:border-zion-gold/30 transition-all"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl font-bold text-zion-gold">#{proposal.id}</span>
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider ${getStatusColor(proposal.state)}`}>
              <Clock className="h-3 w-3" />
              {proposal.state}
            </span>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">{proposal.title}</h3>
          <p className="text-sm text-gray-400 line-clamp-2">{proposal.description}</p>
        </div>
      </div>

      {/* Proposer */}
      <div className="flex items-center gap-2 mb-4 text-sm text-gray-400">
        <Users className="h-4 w-4" />
        <span>Proposer: <span className="text-gray-300 font-mono">{proposal.proposer.slice(0, 12)}...</span></span>
      </div>

      {/* Voting Stats */}
      <div className="space-y-3 mb-6">
        {/* Progress Bar */}
        <div className="relative h-8 rounded-full bg-white/5 overflow-hidden">
          <div 
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-green-500 to-green-400 transition-all"
            style={{ width: `${forPercent}%` }}
          />
          <div 
            className="absolute inset-y-0 bg-gradient-to-r from-red-500 to-red-400 transition-all"
            style={{ left: `${forPercent}%`, width: `${againstPercent}%` }}
          />
          <div className="absolute inset-0 flex items-center justify-center gap-4 text-xs font-semibold">
            <span className="text-green-400">{forPercent.toFixed(1)}% FOR</span>
            <span className="text-gray-400">•</span>
            <span className="text-red-400">{againstPercent.toFixed(1)}% AGAINST</span>
          </div>
        </div>

        {/* Vote Counts */}
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl bg-green-500/10 border border-green-500/20 p-3">
            <div className="flex items-center gap-2 text-green-400 mb-1">
              <ThumbsUp className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-wider">For</span>
            </div>
            <p className="text-lg font-bold text-white">{formatVotes(votesFor)}</p>
            <p className="text-xs text-gray-400">Votes</p>
          </div>

          <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3">
            <div className="flex items-center gap-2 text-red-400 mb-1">
              <ThumbsDown className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-wider">Against</span>
            </div>
            <p className="text-lg font-bold text-white">{formatVotes(votesAgainst)}</p>
            <p className="text-xs text-gray-400">Votes</p>
          </div>

          <div className="rounded-xl bg-gray-500/10 border border-gray-500/20 p-3">
            <div className="flex items-center gap-2 text-gray-400 mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-wider">Abstain</span>
            </div>
            <p className="text-lg font-bold text-white">{formatVotes(votesAbstain)}</p>
            <p className="text-xs text-gray-400">Votes</p>
          </div>
        </div>
      </div>

      {/* Voting Buttons */}
      {proposal.state.toUpperCase() === 'ACTIVE' && onVote && (
        <div className="flex gap-3">
          <button
            onClick={() => handleVote('for')}
            disabled={isVoting}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-green-500 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-3 text-sm font-semibold text-white transition-colors"
          >
            <ThumbsUp className="h-4 w-4" />
            Vote FOR
          </button>
          <button
            onClick={() => handleVote('against')}
            disabled={isVoting}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-3 text-sm font-semibold text-white transition-colors"
          >
            <ThumbsDown className="h-4 w-4" />
            Vote AGAINST
          </button>
          <button
            onClick={() => handleVote('abstain')}
            disabled={isVoting}
            className="flex items-center justify-center gap-2 rounded-xl bg-gray-600 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-3 text-sm font-semibold text-white transition-colors"
          >
            Abstain
          </button>
        </div>
      )}

      {/* Timestamp */}
      <div className="mt-4 pt-4 border-t border-white/10 text-xs text-gray-500">
        Created: {proposal.created_at ? new Date(proposal.created_at).toLocaleString() : '—'}
      </div>
    </motion.div>
  );
}
