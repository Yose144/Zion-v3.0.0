'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowRight, Crown, ShieldCheck, Plus, Heart, TreeDeciduous, Star, Sparkles, Users, Info } from 'lucide-react';
import { useEffect, useState } from 'react';
import DAOStats from '@/components/dao/DAOStats';
import ProposalCard from '@/components/dao/ProposalCard';
import GuardiansTreeClient from '@/components/GuardiansTreeClient';
import { 
  getDAOStats, 
  getGovernanceProposals, 
  castGovernanceVote,
  type GovernanceProposal,
  type DAOStats as DAOStatsType 
} from '@/lib/dao-api';

const phases = [
  {
    title: 'Phase 1 · Stewardship (2025)',
    bullets: [
      'Maitreya Buddha + Round Table guardians ensure uptime',
      'Emergency intervention + roadmap budget approvals',
      '90-day reporting cadence published in docs'
    ]
  },
  {
    title: 'Phase 2 · Hybrid DAO (2026)',
    bullets: [
      'Validator council joins guardians · 5-of-7 treasury',
      'On-chain proposal lifecycle (create → vote → execute)',
      'Golden Egg incentives + community matching pools'
    ]
  },
  {
    title: 'Phase 3 · Full DAO (2026+)',
    bullets: [
      'Treasury + roadmap fully controlled by stakers',
      'Quadratic or consciousness-weighted voting experiments',
      'Transparent grants + ecosystem investment committee'
    ]
  }
];

const quickLinks = [
  { label: 'Governance docs', href: '/docs', description: 'Proposal flow, voting power, emergency clauses.' },
  { label: 'Treasury dashboard', href: '/dashboard', description: 'Real-time balances, allocation overview, tithe.' },
  { label: 'Join discussion', href: 'https://github.com/Zion-TerraNova', description: 'Open issues for proposals, comments, audits.' }
];

export default function DaoPage() {
  const [stats, setStats] = useState<DAOStatsType | null>(null);
  const [proposals, setProposals] = useState<GovernanceProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [daemonOnline, setDaemonOnline] = useState<boolean | null>(null);

  useEffect(() => {
    loadDAOData();
  }, []);

  async function loadDAOData() {
    try {
      setLoading(true);
      const [statsData, proposalsData] = await Promise.all([
        getDAOStats(),
        getGovernanceProposals()
      ]);
      setStats(statsData);
      setProposals(proposalsData);
      // Daemon is considered online if we have > 0 proposals OR treasury > 0 and not default placeholder
      setDaemonOnline(proposalsData.length > 0 || statsData.governance.total_proposals > 0);
    } catch {
      setDaemonOnline(false);
    } finally {
      setLoading(false);
    }
  }

  async function handleVote(proposalId: string, voteType: string) {
    try {
      const demoWallet = 'zion1demo' + Math.random().toString(36).substring(2, 10);
      await castGovernanceVote(parseInt(proposalId, 10), demoWallet, voteType as 'for' | 'against');
      await loadDAOData();
      alert(`Vote cast: ${voteType.toUpperCase()}`);
    } catch (err) {
      console.error('Vote failed:', err);
      alert(err instanceof Error ? err.message : 'Failed to cast vote');
    }
  }

  return (
    <div className="min-h-screen pt-32 pb-24 px-4">
      <div className="container mx-auto max-w-7xl space-y-16">
        <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl md:rounded-[32px] border border-white/10 bg-black/60 p-6 md:p-10 backdrop-blur-xl">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1 text-xs font-semibold tracking-[0.3em] text-zion-gold uppercase">
              <Crown className="h-4 w-4" />
              DAO 2.0 · Live Governance
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.4em] text-gray-400">Treasury · proposals · voting</p>
              <h1 className="text-3xl sm:text-5xl md:text-6xl font-semibold text-gradient leading-tight">Shape ZION&apos;s future together</h1>
            </div>
            <p className="text-lg text-gray-300 max-w-3xl">
              ZION&apos;s DAO governs treasury allocation, protocol upgrades, and humanitarian initiatives. 
              Every ZION holder has voting power—enhanced by consciousness level achievements.
            </p>
            <div className="flex flex-wrap gap-4">
              <button onClick={loadDAOData} disabled={loading} className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-zion-gold via-zion-purple to-zion-cyan px-6 py-3 text-sm font-semibold text-black disabled:opacity-50">
                {loading ? 'Loading...' : 'Refresh Data'}
                <ArrowRight className="h-4 w-4" />
              </button>
              <Link href="/docs" className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-white">
                Review governance docs
              </Link>
            </div>
          </div>
        </motion.section>

        {/* DAO daemon status notice */}
        {!loading && daemonOnline === false && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-6">
            <div className="flex items-start gap-3">
              <Info className="h-6 w-6 text-blue-400 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-blue-300">DAO Daemon — Phase 2 (Hybrid DAO)</p>
                <p className="text-sm text-blue-200/80 mt-1">
                  The on-chain DAO governance daemon will be deployed with the Hybrid DAO phase (Q2 2026).
                  Treasury balance and governance rules are active; proposal creation via UI launches with the daemon.
                  Showing placeholder treasury data below.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {stats && (
          <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <DAOStats stats={stats} />
          </motion.section>
        )}

        <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }} className="rounded-[32px] border border-white/10 bg-white/5 p-8">
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">Governance phases</p>
            <h2 className="text-3xl font-semibold text-white">Road to full decentralization</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {phases.map((phase) => (
              <div key={phase.title} className="rounded-3xl border border-white/10 bg-black/30 p-6">
                <p className="text-xs uppercase tracking-[0.3em] text-gray-400">{phase.title}</p>
                <ul className="mt-4 space-y-2 text-sm text-gray-300">
                  {phase.bullets.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <ShieldCheck className="h-4 w-4 text-zion-gold mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </motion.section>

        <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-sm uppercase tracking-[0.4em] text-gray-500">Governance proposals</p>
              <h2 className="text-3xl font-semibold text-white">Vote on protocol decisions</h2>
            </div>
            <button className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 transition-colors">
              <Plus className="h-4 w-4" />
              Create Proposal
            </button>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-zion-gold border-r-transparent"></div>
              <p className="mt-4 text-gray-400">Loading proposals...</p>
            </div>
          ) : proposals.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-black/40 p-12 text-center backdrop-blur-xl">
              <Crown className="h-12 w-12 text-gray-500 mx-auto mb-4" />
              <p className="text-lg font-semibold text-white mb-2">No proposals yet</p>
              <p className="text-gray-400">Be the first to create a governance proposal!</p>
            </div>
          ) : (
            <div className="space-y-6">
              {proposals.map((proposal) => (
                <ProposalCard key={proposal.id} proposal={proposal} onVote={handleVote} />
              ))}
            </div>
          )}
        </motion.section>

        <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.3 }} className="rounded-[32px] border border-pink-500/30 bg-gradient-to-r from-pink-500/20 via-purple-500/20 to-pink-500/20 p-10">
          <div className="flex items-center gap-3 mb-4">
            <Heart className="h-8 w-8 text-pink-400" />
            <h2 className="text-3xl font-semibold text-white">Humanitarian Tithe</h2>
          </div>
          <p className="text-lg text-gray-300 mb-6">
            10% of all mining rewards fund clean water, food security, and education projects worldwide. 
            Vote on which projects receive funding.
          </p>
          {stats && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-pink-500/20 bg-black/40 p-4">
                <p className="text-xs uppercase tracking-wider text-gray-400">Total Projects</p>
                <p className="text-3xl font-bold text-white">{stats.humanitarian.total_proposals}</p>
              </div>
              <div className="rounded-2xl border border-pink-500/20 bg-black/40 p-4">
                <p className="text-xs uppercase tracking-wider text-gray-400">Active Funding</p>
                <p className="text-3xl font-bold text-white">{stats.humanitarian.active_proposals}</p>
              </div>
              <div className="rounded-2xl border border-pink-500/20 bg-black/40 p-4">
                <p className="text-xs uppercase tracking-wider text-gray-400">Beneficiaries</p>
                <p className="text-3xl font-bold text-white">{stats.humanitarian.total_beneficiaries.toLocaleString()}</p>
              </div>
              <div className="rounded-2xl border border-pink-500/20 bg-black/40 p-4">
                <p className="text-xs uppercase tracking-wider text-gray-400">Funded Amount</p>
                <p className="text-3xl font-bold text-white">{stats.humanitarian.total_funded.toLocaleString()}</p>
              </div>
            </div>
          )}
        </motion.section>

        {/* Tree of Life — DAO Circles */}
        <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.25 }} className="rounded-[32px] border border-white/10 bg-white/5 p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
            <div>
              <p className="text-sm uppercase tracking-[0.4em] text-gray-500">Tree of Life</p>
              <h2 className="text-3xl font-semibold text-white">DAO Circles & Governance Topology</h2>
              <p className="text-gray-300 max-w-2xl mt-2">
                Tree of Life slouží jako živý DAO ledger. Kořeny reprezentují komunitní guildy,
                srdce vývojové kruhy a koruna správní guardians.
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/60 px-4 py-2 text-sm">
              <TreeDeciduous className="h-5 w-5 text-emerald-300" />
              <span className="text-gray-300">Live topology</span>
            </div>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                level: 'Crown',
                title: 'Guardians Council',
                description: 'Vrchní vrstva správy DAO — dohled nad treasury, bezpečnostní revize a dlouhodobá vize.',
                color: 'from-indigo-500/70 to-fuchsia-500/40',
                Icon: Crown,
                iconColor: 'text-yellow-200',
              },
              {
                level: 'Heart',
                title: 'Builders Circle',
                description: 'Srdce ekosystému — vývoj protokolu, core návrhy a koordinace technických misí.',
                color: 'from-emerald-500/60 to-cyan-500/30',
                Icon: Sparkles,
                iconColor: 'text-teal-200',
              },
              {
                level: 'Roots',
                title: 'Community Guild',
                description: 'Kořeny DAO — otevřená komunita, contribution streamy, komunitní hlasování a růst sítě.',
                color: 'from-amber-500/60 to-orange-500/30',
                Icon: Users,
                iconColor: 'text-amber-200',
              },
            ].map((node) => (
              <div key={node.level} className={`rounded-2xl border border-white/10 bg-gradient-to-b ${node.color} p-5`}>
                <div className="flex items-center gap-3">
                  <node.Icon className={`h-5 w-5 ${node.iconColor}`} />
                  <div>
                    <p className="text-xs uppercase tracking-[0.4em] text-gray-100">{node.level}</p>
                    <h3 className="text-xl font-semibold text-white">{node.title}</h3>
                  </div>
                </div>
                <p className="mt-3 text-sm text-gray-50/90">{node.description}</p>
              </div>
            ))}
          </div>
        </motion.section>

        {/* Kabbalah Consciousness Tree — Interactive */}
        <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.3 }} className="rounded-[32px] border border-white/10 bg-gradient-to-b from-zion-purple/10 to-black/80 p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
            <div>
              <p className="text-sm uppercase tracking-[0.4em] text-gray-500">Consciousness Mining</p>
              <h2 className="text-3xl font-semibold text-white">Kabbalah Tree of Life · 144k Guardians</h2>
              <p className="text-gray-300 max-w-2xl mt-2">
                9 vědomostních levelů namapovaných na 10 Sefirot. Každý DAO circle odpovídá
                různým consciousness levelům. Hover nad uzlem pro detaily.
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-zion-gold/30 bg-zion-gold/10 px-4 py-2 text-sm">
              <Star className="h-5 w-5 text-zion-gold" />
              <span className="text-white">Real-time DAO tracking</span>
            </div>
          </div>
          <GuardiansTreeClient />
        </motion.section>

        <motion.section initial={{ opacity: 0, scale: 0.98 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: 0.4 }} className="rounded-[32px] border border-zion-gold/30 bg-gradient-to-r from-zion-purple/30 via-zion-gold/15 to-zion-purple/30 p-10">
          <h2 className="text-3xl font-semibold text-white text-center mb-8">Helpful links</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {quickLinks.map((link) => (
              <div key={link.label} className="rounded-2xl border border-white/10 bg-black/40 p-5 hover:bg-black/60 transition-colors">
                <p className="text-sm font-semibold text-white">{link.label}</p>
                <p className="mt-2 text-sm text-gray-300">{link.description}</p>
                <Link href={link.href} target={link.href.startsWith('http') ? '_blank' : undefined} rel={link.href.startsWith('http') ? 'noreferrer' : undefined} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-zion-gold hover:text-zion-gold/80 transition-colors">
                  Open
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ))}
          </div>
        </motion.section>
      </div>
    </div>
  );
}
