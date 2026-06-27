'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Flame,
  Layers,
  Scale,
  Shield,
  Users,
  Vote,
} from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import { CONTRACTS, GOVERNANCE_DEPLOYED } from '@/lib/defi-contracts';
import { getGovernanceProposals, type GovernanceProposal } from '@/lib/dao-api';
import { useEffect, useState } from 'react';

interface Proposal {
  id: number;
  title: string;
  titleCs: string;
  status: 'active' | 'passed' | 'rejected' | 'pending';
  votesFor: number;
  votesAgainst: number;
  quorum: number;
  endDate: string;
  proposer: string;
}

const FALLBACK_PROPOSALS: Proposal[] = [
  {
    id: 1,
    title: 'Increase bridge validator threshold to 3/5',
    titleCs: 'Zvýšit bridge validator threshold na 3/5',
    status: 'active',
    votesFor: 1_200_000_000,
    votesAgainst: 300_000_000,
    quorum: 2_000_000_000,
    endDate: '2026-06-15',
    proposer: '0xdde1...3D186',
  },
];

function mapProposal(p: GovernanceProposal): Proposal {
  const state = (p.state ?? '').toLowerCase();
  const status: Proposal['status'] =
    state === 'active' ? 'active' : state === 'passed' ? 'passed' : state === 'executed' ? 'passed' : state === 'rejected' ? 'rejected' : 'pending';
  const date = new Date(p.voting_ends_at || p.created_at || Date.now());
  const endDate = isNaN(date.getTime()) ? '-' : date.toISOString().split('T')[0];
  const forVotes = Number(p.for_votes || 0);
  const againstVotes = Number(p.against_votes || 0);
  return {
    id: p.id,
    title: p.title || (status === 'active' ? 'Active proposal' : 'Governance proposal'),
    titleCs: p.title || (status === 'active' ? 'Aktivní návrh' : 'Governance návrh'),
    status,
    votesFor: forVotes,
    votesAgainst: againstVotes,
    quorum: 2_000_000_000,
    endDate,
    proposer: p.proposer || '-',
  };
}

function statusBadge(status: Proposal['status'], cs: boolean) {
  switch (status) {
    case 'active':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] text-emerald-400 uppercase tracking-wider">
          <Vote className="h-3 w-3" /> {cs ? 'Aktivní' : 'Active'}
        </span>
      );
    case 'passed':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-zion-gold/10 border border-zion-gold/30 px-2 py-0.5 text-[10px] text-zion-gold uppercase tracking-wider">
          <CheckCircle2 className="h-3 w-3" /> {cs ? 'Schváleno' : 'Passed'}
        </span>
      );
    case 'rejected':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 border border-red-500/30 px-2 py-0.5 text-[10px] text-red-400 uppercase tracking-wider">
          <Flame className="h-3 w-3" /> {cs ? 'Zamítnuto' : 'Rejected'}
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-gray-500/10 border border-gray-500/30 px-2 py-0.5 text-[10px] text-gray-400 uppercase tracking-wider">
          <Clock className="h-3 w-3" /> {cs ? 'Čeká' : 'Pending'}
        </span>
      );
  }
}

export default function DaoPage() {
  const { lang } = useLang();
  const cs = lang === 'cs';

  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getGovernanceProposals()
      .then((rows) => {
        if (cancelled) return;
        const mapped = rows.map(mapProposal);
        setProposals(mapped);
      })
      .catch(() => {
        if (!cancelled) setProposals([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const totalProposals = proposals.length;
  const activeCount = proposals.filter((p) => p.status === 'active').length;
  const passedCount = proposals.filter((p) => p.status === 'passed').length;

  return (
    <div className="pt-28 md:pt-32 pb-24 overflow-x-hidden">
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -left-40 top-1/4 h-[500px] w-[500px] rounded-full blur-[200px] bg-rose-500/8" />
        <div className="absolute -right-40 top-2/3 h-[400px] w-[400px] rounded-full blur-[200px] bg-purple-500/6" />
      </div>

      <div className="relative z-10 zion-container max-w-5xl space-y-14">
        {/* Back */}
        <Link href="/defi" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="h-4 w-4" />
          {cs ? 'Zpět do DeFi Hub' : 'Back to DeFi Hub'}
        </Link>

        {/* HERO */}
        <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} style={{ '--rc': '139, 92, 246' } as React.CSSProperties} className="zion-rainbow-card rounded-3xl md:rounded-4xl bg-black/60 p-6 md:p-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-rose-500/40 bg-rose-500/10 px-4 py-1 text-xs font-semibold tracking-[0.3em] text-rose-300 uppercase mb-4">
            <Scale className="h-4 w-4" />
            {cs ? 'Governance' : 'Governance'}
          </div>
          <h1 className="text-3xl sm:text-5xl font-semibold text-gradient leading-tight">
            {cs ? 'ZION DAO' : 'ZION DAO'}
          </h1>
          <p className="mt-4 text-lg text-gray-300 max-w-2xl">
            {cs
              ? 'On-chain hlasování váhou tokenů. Navrhujte, hlasujte a exekvujte rozhodnutí komunity. Decentralizovaná governance pro Terra Nova ekosystém.'
              : 'On-chain token-weighted voting. Propose, vote, and execute community decisions. Decentralized governance for the Terra Nova ecosystem.'}
          </p>

          {/* Link to full DAO page */}
          <div className="mt-6 zion-rainbow-sub p-4 flex items-center gap-3" style={{ '--rc': '139, 92, 246' } as React.CSSProperties}>
            <Vote className="h-5 w-5 text-zion-gold shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-gray-300">
                {cs
                  ? 'Plná DAO stránka s treasury, návrhy a hlasováním je dostupná na /dao.'
                  : 'The full DAO page with treasury, proposals, and voting is available at /dao.'}
              </p>
            </div>
            <Link href="/dao" className="text-zion-gold hover:underline text-sm whitespace-nowrap">
              {cs ? 'Otevřít DAO →' : 'Open DAO →'}
            </Link>
          </div>

          <div className="mt-6 flex flex-wrap gap-3 text-xs">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
              <Vote className="h-3 w-3 text-emerald-400" /> {cs ? '1 token = 1 hlas' : '1 token = 1 vote'}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
              <Shield className="h-3 w-3 text-zion-cyan" /> {cs ? 'Quorum-based' : 'Quorum-based'}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
              <Clock className="h-3 w-3 text-zion-gold" /> {cs ? 'Timelock exekuce' : 'Timelock execution'}
            </span>
          </div>

          {!GOVERNANCE_DEPLOYED && (
            <div className="mt-6 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 flex items-center gap-3">
              <Clock className="h-5 w-5 text-amber-400 shrink-0" />
              <p className="text-sm text-gray-300">
                {cs
                  ? 'Governance kontrakt čeká na deploy na Base Mainnet. DAO treasury cliff ~červen 2027.'
                  : 'Governance contract awaiting deployment on Base Mainnet. DAO treasury cliff ~June 2027.'}
              </p>
            </div>
          )}
        </motion.section>

        {/* Stats */}
        <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: cs ? 'Návrhy celkem' : 'Total Proposals', value: totalProposals.toString(), icon: Layers, color: 'text-zion-cyan' },
              { label: cs ? 'Aktivní' : 'Active', value: activeCount.toString(), icon: Vote, color: 'text-emerald-400' },
              { label: cs ? 'Schváleno' : 'Passed', value: passedCount.toString(), icon: CheckCircle2, color: 'text-zion-gold' },
              { label: cs ? 'Quorum' : 'Quorum', value: '2B', icon: Users, color: 'text-purple-400' },
            ].map((card) => (
              <div key={card.label} className="zion-rainbow-sub p-5" style={{ '--rc': '139, 92, 246' } as React.CSSProperties}>
                <div className="flex items-center gap-2 mb-2">
                  <card.icon className={`h-4 w-4 ${card.color}`} />
                  <span className="text-[10px] uppercase tracking-[0.2em] text-gray-500">{card.label}</span>
                </div>
                <p className={`text-2xl font-bold tabular-nums ${card.color}`}>{card.value}</p>
              </div>
            ))}
          </div>
        </motion.section>

        {/* Proposals */}
        <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <h2 className="text-2xl font-semibold text-white mb-6 flex items-center gap-2">
            <Vote className="h-6 w-6 text-emerald-400" />
            {cs ? 'Návrhy' : 'Proposals'}
          </h2>
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-zion-gold border-r-transparent" />
              <p className="mt-4 text-gray-400">{cs ? 'Načítám návrhy…' : 'Loading proposals…'}</p>
            </div>
          ) : (
          <div className="space-y-3">
            {proposals.map((p) => {
              const totalVotes = p.votesFor + p.votesAgainst;
              const forPct = totalVotes > 0 ? (p.votesFor / totalVotes) * 100 : 0;
              const againstPct = totalVotes > 0 ? (p.votesAgainst / totalVotes) * 100 : 0;
              const quorumPct = p.quorum > 0 ? Math.min((totalVotes / p.quorum) * 100, 100) : 0;
              return (
                <div key={p.id} className="zion-rainbow-sub p-5" style={{ '--rc': '139, 92, 246' } as React.CSSProperties}>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-4">
                    <span className="text-xs font-mono text-gray-500">#{p.id}</span>
                    <h3 className="text-sm font-medium text-white flex-1">{cs ? p.titleCs : p.title}</h3>
                    {statusBadge(p.status, cs)}
                  </div>

                  <div className="space-y-3">
                    {/* For / Against bars */}
                    <div>
                      <div className="flex justify-between text-[10px] mb-1">
                        <span className="text-emerald-400">{cs ? 'Pro' : 'For'}</span>
                        <span className="text-gray-400">{forPct.toFixed(1)}%</span>
                      </div>
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${forPct}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] mb-1">
                        <span className="text-red-400">{cs ? 'Proti' : 'Against'}</span>
                        <span className="text-gray-400">{againstPct.toFixed(1)}%</span>
                      </div>
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-red-500 rounded-full" style={{ width: `${againstPct}%` }} />
                      </div>
                    </div>

                    {/* Quorum */}
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-[10px] text-gray-500">{cs ? 'Quorum' : 'Quorum'}:</span>
                      <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-zion-gold rounded-full" style={{ width: `${quorumPct}%` }} />
                      </div>
                      <span className="text-[10px] text-gray-500">{quorumPct.toFixed(0)}%</span>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3 text-[10px] text-gray-500">
                    <span>{cs ? 'Navrhovatel' : 'Proposer'}: {p.proposer}</span>
                    <span>{cs ? 'Konec' : 'Ends'}: {p.endDate}</span>
                  </div>
                </div>
              );
            })}
          </div>
          )}
        </motion.section>

        {/* Contract */}
        <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }} className="zion-section p-5">
          <div className="flex items-center gap-2 mb-2">
            <Layers className="h-4 w-4 text-gray-400" />
            <span className="text-xs text-gray-400 uppercase tracking-wider">{cs ? 'Kontrakt' : 'Contract'}</span>
          </div>
          <p className="font-mono text-sm text-gray-300 break-all">
            {GOVERNANCE_DEPLOYED ? CONTRACTS.ZIONGovernance : (cs ? 'Čeká na deploy' : 'Awaiting deployment')}
          </p>
          <p className="text-[10px] text-gray-500 mt-1">Base Mainnet · ZIONGovernance.sol</p>
        </motion.section>

        <p className="text-center text-xs text-gray-600">
          ZION TerraNova · DAO Governance
        </p>
      </div>
    </div>
  );
}
