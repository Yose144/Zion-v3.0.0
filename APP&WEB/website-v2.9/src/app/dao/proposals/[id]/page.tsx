'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  ThumbsUp,
  ThumbsDown,
  Minus,
  Clock,
  Users,
  Calendar,
  Landmark,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { useLang } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import QuorumProgress from '@/components/dao/QuorumProgress';
import VoteMemoCard from '@/components/dao/VoteMemoCard';
import ZisAvatar from '@/components/ZisAvatar';
import {
  getGovernanceProposal,
  getProposalVotes,
  getProposalEvents,
  castGovernanceVote,
  type GovernanceProposal,
  type ProposalVote,
  type DaoEvent,
} from '@/lib/dao-api';

const FLOWERS_PER_ZION = 1_000_000;

function flowersToZion(v: string | number | undefined): number {
  if (v == null) return 0;
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

function fmtDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

const C = {
  backToDao: { cs: 'Zpět na DAO', en: 'Back to DAO' },
  proposal: { cs: 'Návrh', en: 'Proposal' },
  signInRequired: { cs: 'Pro hlasování se přihlas přes ZIS účet.', en: 'Sign in with your ZIS account to vote.' },
  signInToVote: { cs: 'Přihlas se pro hlasování', en: 'Sign in to vote' },
  forLabel: { cs: 'Pro', en: 'For' },
  againstLabel: { cs: 'Proti', en: 'Against' },
  abstainLabel: { cs: 'Zdržel se', en: 'Abstain' },
  awaitingTally: {
    cs: 'Hlasování skončilo — návrh čeká na sčítání (automaticky do ~1 min).',
    en: 'Voting ended — the proposal is awaiting tally (automatic within ~1 min).',
  },
  voters: { cs: 'Hlasující', en: 'Voters' },
  delegated: { cs: 'delegovaných', en: 'delegated' },
  timeline: { cs: 'Časová osa', en: 'Timeline' },
  created: { cs: 'Vytvořeno', en: 'Created' },
  votingEnds: { cs: 'Konec hlasování', en: 'Voting ends' },
  timelockEnds: { cs: 'Konec timelocku', en: 'Timelock ends' },
  executedAt: { cs: 'Exekuováno', en: 'Executed' },
  snapshotBlock: { cs: 'Snapshot blok', en: 'Snapshot block' },
  proposer: { cs: 'Navrhovatel', en: 'Proposer' },
  voterCount: { cs: 'Počet hlasujících', en: 'Voter count' },
  history: { cs: 'Historie událostí', en: 'Event history' },
  loading: { cs: 'Načítám návrh…', en: 'Loading proposal…' },
  notFound: { cs: 'Návrh nenalezen nebo je DAO daemon offline.', en: 'Proposal not found or the DAO daemon is offline.' },
  voteRecorded: { cs: 'Hlas zaznamenán.', en: 'Vote recorded.' },
  quorumSection: { cs: 'Quorum', en: 'Quorum' },
} as const;

export default function ProposalDetailPage() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const { user, authenticated } = useAuth();
  const zionAddress =
    user?.linkedAddresses?.find((a) => a.chainType === 'zion-l1')?.address ??
    user?.address ??
    '';
  const params = useParams();
  const id = Number(Array.isArray(params?.id) ? params.id[0] : params?.id);

  const [proposal, setProposal] = useState<GovernanceProposal | null>(null);
  const [votes, setVotes] = useState<ProposalVote[]>([]);
  const [events, setEvents] = useState<DaoEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [isVoting, setIsVoting] = useState(false);
  const [voteMsg, setVoteMsg] = useState<string | null>(null);
  const [voteErr, setVoteErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!Number.isFinite(id)) {
      setLoading(false);
      return;
    }
    const [p, v, e] = await Promise.all([
      getGovernanceProposal(id),
      getProposalVotes(id),
      getProposalEvents(id),
    ]);
    setProposal(p);
    setVotes(v);
    setEvents(e);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleVote = async (voteType: 'for' | 'against' | 'abstain') => {
    setVoteMsg(null);
    setVoteErr(null);
    if (!authenticated) {
      setVoteErr(C.signInRequired[cs ? 'cs' : 'en']);
      return;
    }
    setIsVoting(true);
    try {
      await castGovernanceVote(id, zionAddress, voteType);
      setVoteMsg(C.voteRecorded[cs ? 'cs' : 'en']);
      await load();
    } catch (err) {
      setVoteErr(err instanceof Error ? err.message : 'Vote failed');
    } finally {
      setIsVoting(false);
    }
  };

  const status = proposal?.state.toUpperCase() ?? '';
  const awaitingTally = status === 'ACTIVE' && proposal && !proposal.is_voting_open;
  const statusClass =
    awaitingTally || status === 'PASSED' || status === 'EXECUTED' || status === 'TIMELOCKED'
      ? 'text-zion-gold border-zion-gold/20 bg-zion-gold/10'
      : status === 'ACTIVE'
        ? 'text-zion-cyan border-zion-cyan/20 bg-zion-cyan/10'
        : 'text-zion-purple border-zion-purple/20 bg-zion-purple/10';

  const votesFor = proposal ? flowersToZion(proposal.for_votes) : 0;
  const votesAgainst = proposal ? flowersToZion(proposal.against_votes) : 0;
  const votesAbstain = proposal ? flowersToZion(proposal.abstain_votes) : 0;
  const totalVotes = votesFor + votesAgainst + votesAbstain;
  const pct = (v: number) => (totalVotes > 0 ? (v / totalVotes) * 100 : 0);

  return (
    <div className="zion-page text-white relative">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-36 -left-28 h-[520px] w-[520px] rounded-full bg-zion-purple/18 blur-3xl" />
        <div className="absolute top-40 -right-24 h-[420px] w-[420px] rounded-full bg-zion-cyan/14 blur-3xl" />
      </div>

      <div className="zion-container max-w-4xl relative z-10 space-y-8 pb-24">
        <Link
          href="/dao"
          className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {C.backToDao[cs ? 'cs' : 'en']}
        </Link>

        {loading ? (
          <div className="zion-rainbow-card p-10 text-center text-gray-400">
            {C.loading[cs ? 'cs' : 'en']}
          </div>
        ) : !proposal ? (
          <div className="zion-rainbow-card p-10 text-center" style={{ '--rc': '228, 30, 43' } as CSSProperties}>
            <AlertTriangle className="h-8 w-8 text-zion-purple mx-auto mb-3" />
            <p className="text-gray-300">{C.notFound[cs ? 'cs' : 'en']}</p>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="zion-rainbow-card p-6 md:p-10"
            style={{ '--rc': '6, 105, 40' } as CSSProperties}
          >
            {/* Header */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="text-xs font-mono text-gray-500">
                {C.proposal[cs ? 'cs' : 'en']} #{proposal.id}
              </span>
              <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] uppercase tracking-wider ${statusClass}`}>
                <Clock className="h-3 w-3" />
                {awaitingTally ? (cs ? 'Awaiting tally' : 'Awaiting tally') : proposal.state}
              </span>
              {proposal.proposal_type && (
                <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10px] uppercase tracking-wider text-gray-400">
                  {proposal.proposal_type}
                </span>
              )}
              {proposal.has_passed && (
                <span className="inline-flex items-center gap-1 rounded-full border border-zion-gold/30 bg-zion-gold/10 px-2.5 py-0.5 text-[10px] uppercase tracking-wider text-zion-gold">
                  <CheckCircle2 className="h-3 w-3" />
                  {cs ? 'Schváleno hlasy' : 'Passed by votes'}
                </span>
              )}
            </div>

            <h1 className="text-2xl md:text-4xl font-semibold text-white leading-tight mb-4">
              {proposal.title}
            </h1>
            <p className="text-gray-300 whitespace-pre-wrap mb-8">{proposal.description}</p>

            {/* Vote breakdown */}
            <div className="space-y-3 mb-6">
              {(
                [
                  [C.forLabel[cs ? 'cs' : 'en'], votesFor, 'bg-zion-cyan', 'text-zion-cyan'],
                  [C.againstLabel[cs ? 'cs' : 'en'], votesAgainst, 'bg-zion-purple', 'text-zion-purple'],
                  [C.abstainLabel[cs ? 'cs' : 'en'], votesAbstain, 'bg-gray-500', 'text-gray-400'],
                ] as const
              ).map(([label, value, bar, text]) => (
                <div key={label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className={text}>{label}</span>
                    <span className="text-gray-400">
                      {formatZion(value)} ZION · {pct(value).toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <div className={`h-full ${bar} rounded-full`} style={{ width: `${pct(value)}%` }} />
                  </div>
                </div>
              ))}
            </div>

            <QuorumProgress proposal={proposal} />

            {/* Voting */}
            {proposal.is_voting_open && (
              <div className="mb-6">
                {!authenticated && (
                  <p className="text-xs text-zion-gold/90 mb-3 flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    {C.signInToVote[cs ? 'cs' : 'en']}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleVote('for')}
                    disabled={isVoting || !authenticated}
                    className="zion-button-primary flex-1 min-w-[120px] !px-4 !py-2.5 !text-sm disabled:opacity-50"
                  >
                    <ThumbsUp className="h-4 w-4" />
                    {C.forLabel[cs ? 'cs' : 'en']}
                  </button>
                  <button
                    onClick={() => handleVote('against')}
                    disabled={isVoting || !authenticated}
                    className="zion-button-secondary flex-1 min-w-[120px] !px-4 !py-2.5 !text-sm disabled:opacity-50"
                  >
                    <ThumbsDown className="h-4 w-4" />
                    {C.againstLabel[cs ? 'cs' : 'en']}
                  </button>
                  <button
                    onClick={() => handleVote('abstain')}
                    disabled={isVoting || !authenticated}
                    className="zion-button-secondary !px-4 !py-2.5 !text-sm disabled:opacity-50"
                  >
                    <Minus className="h-4 w-4" />
                    {C.abstainLabel[cs ? 'cs' : 'en']}
                  </button>
                </div>
                {/* D8: on-chain vote via L1 self-transfer memo + QR */}
                <VoteMemoCard proposalId={proposal.id} />
              </div>
            )}
            {awaitingTally && (
              <p className="text-sm text-zion-gold/80 mb-6 flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                {C.awaitingTally[cs ? 'cs' : 'en']}
              </p>
            )}
            {voteMsg && <p className="text-sm text-zion-cyan mb-4">{voteMsg}</p>}
            {voteErr && <p className="text-sm text-zion-purple mb-4">{voteErr}</p>}

            {/* Voter list */}
            <div className="mb-8">
              <h2 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                <Users className="h-4 w-4" />
                {C.voters[cs ? 'cs' : 'en']} ({votes.length})
              </h2>
              {votes.length === 0 ? (
                <p className="text-xs text-gray-500">—</p>
              ) : (
                <div className="space-y-1.5 max-h-72 overflow-y-auto">
                  {votes.map((v) => {
                    const delegated = v.delegated_from ?? [];
                    const delegatedTotal = delegated.reduce(
                      (sum, d) => sum + Number(d.weight ?? 0),
                      0,
                    );
                    return (
                      <div
                        key={`${v.voter}-${v.voted_at}`}
                        className="text-xs zion-rainbow-sub px-3 py-2"
                        style={{ '--rc': '6, 105, 40' } as CSSProperties}
                      >
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 min-w-0 max-w-[50%]">
                            <ZisAvatar seed={v.voter} size={16} className="rounded shrink-0" />
                            <span className="font-mono text-gray-400 truncate">{v.voter}</span>
                          </span>
                          <span className="flex items-center gap-3">
                            <span
                              className={
                                v.choice === 'Yes'
                                  ? 'text-zion-cyan'
                                  : v.choice === 'No'
                                    ? 'text-zion-purple'
                                    : 'text-gray-400'
                              }
                            >
                              {v.choice}
                            </span>
                            <span className="font-mono text-gray-300">
                              {formatZion(flowersToZion(v.weight))} ZION
                            </span>
                          </span>
                        </div>
                        {delegated.length > 0 && (
                          <div
                            className="mt-1 pl-3 border-l border-white/10 text-gray-500"
                            title={delegated
                              .map((d) => `${d.delegator}: ${formatZion(flowersToZion(d.weight))} ZION`)
                              .join('\n')}
                          >
                            ↳ +{delegated.length} {C.delegated[cs ? 'cs' : 'en']} (
                            {formatZion(flowersToZion(delegatedTotal))} ZION)
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Event history (D4 audit log — oldest first) */}
            {events.length > 0 && (
              <div className="mb-8">
                <h2 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {C.history[cs ? 'cs' : 'en']}
                </h2>
                <div className="space-y-1.5">
                  {events.map((e) => (
                    <div
                      key={e.id}
                      className="flex items-center justify-between text-xs zion-rainbow-sub px-3 py-2"
                      style={{ '--rc': '107, 114, 128' } as CSSProperties}
                    >
                      <span className="text-gray-300">
                        {e.event_type.replace(/_/g, ' ')}
                        {e.actor && (
                          <span className="text-gray-500 font-mono ml-2">{e.actor}</span>
                        )}
                      </span>
                      <span className="text-gray-500 font-mono">{fmtDate(e.created_at)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Timeline / meta */}
            <div className="border-t border-white/10 pt-5">
              <h2 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                <Landmark className="h-4 w-4" />
                {C.timeline[cs ? 'cs' : 'en']}
              </h2>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500">{C.created[cs ? 'cs' : 'en']}</dt>
                  <dd className="text-gray-300 font-mono">{fmtDate(proposal.created_at)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500">{C.votingEnds[cs ? 'cs' : 'en']}</dt>
                  <dd className="text-gray-300 font-mono">{fmtDate(proposal.voting_ends_at)}</dd>
                </div>
                {proposal.timelock_ends_at && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-gray-500">{C.timelockEnds[cs ? 'cs' : 'en']}</dt>
                    <dd className="text-gray-300 font-mono">{fmtDate(proposal.timelock_ends_at)}</dd>
                  </div>
                )}
                {proposal.executed_at && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-gray-500">{C.executedAt[cs ? 'cs' : 'en']}</dt>
                    <dd className="text-gray-300 font-mono">{fmtDate(proposal.executed_at)}</dd>
                  </div>
                )}
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500">{C.snapshotBlock[cs ? 'cs' : 'en']}</dt>
                  <dd className="text-gray-300 font-mono">{proposal.snapshot_block ?? '—'}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500">{C.proposer[cs ? 'cs' : 'en']}</dt>
                  <dd className="text-gray-300 font-mono truncate max-w-[60%] flex items-center gap-1.5">
                    <ZisAvatar seed={proposal.proposer} size={18} className="rounded shrink-0" />
                    <span className="truncate">{proposal.proposer}</span>
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500">{C.voterCount[cs ? 'cs' : 'en']}</dt>
                  <dd className="text-gray-300 font-mono">{proposal.voter_count}</dd>
                </div>
              </dl>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
