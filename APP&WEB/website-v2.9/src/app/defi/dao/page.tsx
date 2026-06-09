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
import { CONTRACTS_SEPOLIA } from '@/lib/defi-contracts';
import { tr } from '@/lib/translations';

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

const MOCK_PROPOSALS: Proposal[] = [
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
  {
    id: 2,
    title: 'Fund humanitarian tithe pool with 50M ZION',
    titleCs: 'Fundovat humanitární desátek 50M ZION',
    status: 'passed',
    votesFor: 2_500_000_000,
    votesAgainst: 50_000_000,
    quorum: 2_000_000_000,
    endDate: '2026-04-20',
    proposer: '0x8cc6...5c787',
  },
  {
    id: 3,
    title: 'Add wZION/WETH 0.05% fee tier to DEX',
    titleCs: 'Přidat wZION/WETH 0.05% fee tier do DEX',
    status: 'rejected',
    votesFor: 800_000_000,
    votesAgainst: 1_500_000_000,
    quorum: 2_000_000_000,
    endDate: '2026-03-10',
    proposer: '0x039F...290a1',
  },
];

function statusBadge(status: Proposal['status'], cs: boolean) {
  switch (status) {
    case 'active':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] text-emerald-400 uppercase tracking-wider">
          <Vote className="h-3 w-3" /> {tr('APP_WEB_website_v2_9_src_app_defi_dao_pa', 'active', lang)}
        </span>
      );
    case 'passed':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-zion-gold/10 border border-zion-gold/30 px-2 py-0.5 text-[10px] text-zion-gold uppercase tracking-wider">
          <CheckCircle2 className="h-3 w-3" /> {tr('APP_WEB_website_v2_9_src_app_defi_dao_pa', 'passed', lang)}
        </span>
      );
    case 'rejected':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 border border-red-500/30 px-2 py-0.5 text-[10px] text-red-400 uppercase tracking-wider">
          <Flame className="h-3 w-3" /> {tr('APP_WEB_website_v2_9_src_app_defi_dao_pa', 'rejected', lang)}
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-gray-500/10 border border-gray-500/30 px-2 py-0.5 text-[10px] text-gray-400 uppercase tracking-wider">
          <Clock className="h-3 w-3" /> {tr('APP_WEB_website_v2_9_src_app_defi_dao_pa', 'pending', lang)}
        </span>
      );
  }
}

export default function DaoPage() {
  const { lang } = useLang();
  const cs = lang === 'cs';

  const totalProposals = MOCK_PROPOSALS.length;
  const activeCount = MOCK_PROPOSALS.filter((p) => p.status === 'active').length;
  const passedCount = MOCK_PROPOSALS.filter((p) => p.status === 'passed').length;

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
          {tr('APP_WEB_website_v2_9_src_app_defi_dao_pa', 'back_to_defi_hub', lang)}
        </Link>

        {/* HERO */}
        <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="zion-panel rounded-3xl md:rounded-4xl bg-black/60 p-6 md:p-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-rose-500/40 bg-rose-500/10 px-4 py-1 text-xs font-semibold tracking-[0.3em] text-rose-300 uppercase mb-4">
            <Scale className="h-4 w-4" />
            {tr('APP_WEB_website_v2_9_src_app_defi_dao_pa', 'governance', lang)}
          </div>
          <h1 className="text-3xl sm:text-5xl font-semibold text-gradient leading-tight">
            {tr('APP_WEB_website_v2_9_src_app_defi_dao_pa', 'zion_dao', lang)}
          </h1>
          <p className="mt-4 text-lg text-gray-300 max-w-2xl">
            {cs
              ? 'On-chain hlasování váhou tokenů. Navrhujte, hlasujte a exekvujte rozhodnutí komunity. Decentralizovaná governance pro Terra Nova ekosystém.'
              : 'On-chain token-weighted voting. Propose, vote, and execute community decisions. Decentralized governance for the Terra Nova ecosystem.'}
          </p>

          <div className="mt-6 flex flex-wrap gap-3 text-xs">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
              <Vote className="h-3 w-3 text-emerald-400" /> {tr('APP_WEB_website_v2_9_src_app_defi_dao_pa', '1_token_1_vote', lang)}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
              <Shield className="h-3 w-3 text-zion-cyan" /> {tr('APP_WEB_website_v2_9_src_app_defi_dao_pa', 'quorum_based', lang)}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
              <Clock className="h-3 w-3 text-zion-gold" /> {tr('APP_WEB_website_v2_9_src_app_defi_dao_pa', 'timelock_execution', lang)}
            </span>
          </div>
        </motion.section>

        {/* Stats */}
        <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: tr('APP_WEB_website_v2_9_src_app_defi_dao_pa', 'total_proposals', lang), value: totalProposals.toString(), icon: Layers, color: 'text-zion-cyan' },
              { label: tr('APP_WEB_website_v2_9_src_app_defi_dao_pa', 'active', lang), value: activeCount.toString(), icon: Vote, color: 'text-emerald-400' },
              { label: tr('APP_WEB_website_v2_9_src_app_defi_dao_pa', 'passed', lang), value: passedCount.toString(), icon: CheckCircle2, color: 'text-zion-gold' },
              { label: tr('APP_WEB_website_v2_9_src_app_defi_dao_pa', 'quorum', lang), value: '2B', icon: Users, color: 'text-purple-400' },
            ].map((card) => (
              <div key={card.label} className="rounded-3xl border border-white/8 bg-black/60 backdrop-blur-xl p-5">
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
            {tr('APP_WEB_website_v2_9_src_app_defi_dao_pa', 'proposals', lang)}
          </h2>
          <div className="space-y-3">
            {MOCK_PROPOSALS.map((p) => {
              const totalVotes = p.votesFor + p.votesAgainst;
              const forPct = totalVotes > 0 ? (p.votesFor / totalVotes) * 100 : 0;
              const againstPct = totalVotes > 0 ? (p.votesAgainst / totalVotes) * 100 : 0;
              const quorumPct = p.quorum > 0 ? Math.min((totalVotes / p.quorum) * 100, 100) : 0;
              return (
                <div key={p.id} className="rounded-2xl border border-white/6 bg-white/3 p-5 hover:border-white/12 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-4">
                    <span className="text-xs font-mono text-gray-500">#{p.id}</span>
                    <h3 className="text-sm font-medium text-white flex-1">{cs ? p.titleCs : p.title}</h3>
                    {statusBadge(p.status, cs)}
                  </div>

                  <div className="space-y-3">
                    {/* For / Against bars */}
                    <div>
                      <div className="flex justify-between text-[10px] mb-1">
                        <span className="text-emerald-400">{tr('APP_WEB_website_v2_9_src_app_defi_dao_pa', 'for', lang)}</span>
                        <span className="text-gray-400">{forPct.toFixed(1)}%</span>
                      </div>
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${forPct}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] mb-1">
                        <span className="text-red-400">{tr('APP_WEB_website_v2_9_src_app_defi_dao_pa', 'against', lang)}</span>
                        <span className="text-gray-400">{againstPct.toFixed(1)}%</span>
                      </div>
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-red-500 rounded-full" style={{ width: `${againstPct}%` }} />
                      </div>
                    </div>

                    {/* Quorum */}
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-[10px] text-gray-500">{tr('APP_WEB_website_v2_9_src_app_defi_dao_pa', 'quorum', lang)}:</span>
                      <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-zion-gold rounded-full" style={{ width: `${quorumPct}%` }} />
                      </div>
                      <span className="text-[10px] text-gray-500">{quorumPct.toFixed(0)}%</span>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3 text-[10px] text-gray-500">
                    <span>{tr('APP_WEB_website_v2_9_src_app_defi_dao_pa', 'proposer', lang)}: {p.proposer}</span>
                    <span>{tr('APP_WEB_website_v2_9_src_app_defi_dao_pa', 'ends', lang)}: {p.endDate}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.section>

        {/* Contract */}
        <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }} className="rounded-2xl border border-white/8 bg-black/60 p-5">
          <div className="flex items-center gap-2 mb-2">
            <Layers className="h-4 w-4 text-gray-400" />
            <span className="text-xs text-gray-400 uppercase tracking-wider">{tr('APP_WEB_website_v2_9_src_app_defi_dao_pa', 'contract', lang)}</span>
          </div>
          <p className="font-mono text-sm text-gray-300 break-all">{CONTRACTS_SEPOLIA.ZIONGovernance}</p>
          <p className="text-[10px] text-gray-500 mt-1">Base Sepolia · ZIONGovernance.sol</p>
        </motion.section>

        <p className="text-center text-xs text-gray-600">
          ZION TerraNova · DAO Governance
        </p>
      </div>
    </div>
  );
}
