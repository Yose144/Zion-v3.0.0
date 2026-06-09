'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowRight, Crown, ShieldCheck, Plus, Heart, TreeDeciduous, Star, Sparkles, Users, Info } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLang } from '@/contexts/LanguageContext';
import DAOStats from '@/components/dao/DAOStats';
import ProposalCard from '@/components/dao/ProposalCard';
import GuardiansTreeClient from '@/components/GuardiansTreeClient';
import {
  getDAOStats,
  getDAOTreasuryOverview,
  getGovernanceProposals,
  castGovernanceVote,
  type GovernanceProposal,
  type DAOStats as DAOStatsType,
  type DAOTreasuryOverview,
} from '@/lib/dao-api';

const getPhases = (cs: boolean) => [
  {
    title: tr('daoPage', 'phase_1_stewardship_2025', lang),
    bullets: cs
      ? ['Maitreya Buddha + Round Table guardians zajišťují uptime', 'Emergency intervence + schválení rozpočtu roadmapy', '90denní reporting publikovaný v docs']
      : ['Maitreya Buddha + Round Table guardians ensure uptime', 'Emergency intervention + roadmap budget approvals', '90-day reporting cadence published in docs'],
  },
  {
    title: tr('daoPage', 'phase_2_hybrid_dao_2026', lang),
    bullets: cs
      ? ['Validator council + guardians · 5-of-7 treasury', 'On-chain proposal lifecycle (create → vote → execute)', 'Golden Egg incentivy + community matching pooly']
      : ['Validator council joins guardians · 5-of-7 treasury', 'On-chain proposal lifecycle (create → vote → execute)', 'Golden Egg incentives + community matching pools'],
  },
  {
    title: tr('daoPage', 'phase_3_full_dao_2026', lang),
    bullets: cs
      ? ['Treasury + roadmapa plně řízeny stakery', 'Kvadratické nebo consciousness-weighted hlasování', 'Transparentní granty + investiční komise ekosystému']
      : ['Treasury + roadmap fully controlled by stakers', 'Quadratic or consciousness-weighted voting experiments', 'Transparent grants + ecosystem investment committee'],
  },
];

const getQuickLinks = (cs: boolean) => [
  { label: tr('daoPage', 'governance_docs', lang), href: '/docs', description: tr('daoPage', 'proposal_flow_voting_power_emergency_clauses', lang) },
  { label: tr('daoPage', 'treasury_dashboard', lang), href: '/dashboard', description: tr('daoPage', 'real_time_balances_allocation_overview_tithe', lang) },
  { label: tr('daoPage', 'defi_hub', lang), href: '/defi', description: tr('daoPage', 'swap_bridge_and_portfolio_on_base_mainnet', lang) },
];

export default function DaoPage() {
  const { lang } = useLang();
  const cs = lang === 'cs';

  const [stats, setStats] = useState<DAOStatsType | null>(null);
  const [treasury, setTreasury] = useState<DAOTreasuryOverview | null>(null);
  const [proposals, setProposals] = useState<GovernanceProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [daemonOnline, setDaemonOnline] = useState<boolean | null>(null);

  const phases = getPhases(cs);
  const quickLinks = getQuickLinks(cs);

  useEffect(() => { loadDAOData(); }, []);

  async function loadDAOData() {
    try {
      setLoading(true);
      const [statsData, proposalsData, treasuryData] = await Promise.all([
        getDAOStats(),
        getGovernanceProposals(),
        getDAOTreasuryOverview(),
      ]);
      setStats(statsData);
      setProposals(proposalsData);
      setTreasury(treasuryData);
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
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Vote failed');
    }
  }

  return (
    <div className="pt-28 pb-24 overflow-x-hidden">
      <div className="zion-container max-w-7xl space-y-16">

        {/* ── HERO ── */}
        <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl md:rounded-[32px] border border-white/10 bg-black/60 p-6 md:p-10 backdrop-blur-xl">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1 text-xs font-semibold tracking-[0.3em] text-zion-gold uppercase">
              <Crown className="h-4 w-4" />
              DAO 2.0 · {tr('daoPage', 'governance', lang)}
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.4em] text-gray-400">{tr('daoPage', 'treasury_proposals_voting', lang)}</p>
              <h1 className="text-3xl sm:text-5xl md:text-6xl font-semibold text-gradient leading-tight">
                {cs ? 'Formuj budoucnost ZION společně' : "Shape ZION's future together"}
              </h1>
            </div>
            <p className="text-lg text-gray-300 max-w-3xl">
              {cs
                ? 'DAO ZION řídí alokaci treasury, upgrady protokolu a humanitární iniciativy. Každý držitel ZION má hlasovací sílu — posílenou consciousness level.'
                : "ZION's DAO governs treasury allocation, protocol upgrades, and humanitarian initiatives. Every ZION holder has voting power — enhanced by consciousness level."}
            </p>
            <div className="flex flex-wrap gap-4">
              <button onClick={loadDAOData} disabled={loading} className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-zion-gold via-zion-purple to-zion-cyan px-6 py-3 text-sm font-semibold text-black disabled:opacity-50">
                {loading ? (tr('daoPage', 'loading', lang)) : (tr('daoPage', 'refresh_data', lang))}
                <ArrowRight className="h-4 w-4" />
              </button>
              <Link href="/docs" className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-white">
                {tr('daoPage', 'governance_docs_1', lang)}
              </Link>
            </div>
          </div>
        </motion.section>

        {/* ── Daemon status ── */}
        {!loading && daemonOnline === false && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-6">
            <div className="flex items-start gap-3">
              <Info className="h-6 w-6 text-blue-400 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-blue-300">{tr('daoPage', 'dao_daemon_phase_2_hybrid_dao', lang)}</p>
                <p className="text-sm text-blue-200/80 mt-1">
                  {cs
                    ? 'On-chain DAO governance daemon bude nasazen s fází Hybrid DAO (Q2 2026). Treasury zůstatky a pravidla jsou aktivní; tvorba návrhů přes UI bude spuštěna s daemonem.'
                    : 'The on-chain DAO governance daemon will be deployed with the Hybrid DAO phase (Q2 2026). Treasury balance and governance rules are active; proposal creation via UI launches with the daemon.'}
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Stats ── */}
        {stats && (
          <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <DAOStats stats={stats} />
          </motion.section>
        )}

        {/* ── Treasury overview ── */}
        {treasury && (
          <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="rounded-[32px] border border-white/10 bg-black/40 p-8">
            <div className="mb-6">
              <p className="text-sm uppercase tracking-[0.4em] text-gray-500">Treasury</p>
              <h2 className="text-3xl font-semibold text-white">{tr('daoPage', 'treasury_overview', lang)}</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-wider text-gray-400">Multisig</p>
                <p className="text-lg font-semibold text-white mt-1">{treasury.multisig}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-wider text-gray-400">{tr('daoPage', 'available', lang)}</p>
                <p className="text-lg font-semibold text-white mt-1">{treasury.available_zion.toLocaleString()} ZION</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-wider text-gray-400">{tr('daoPage', 'pending_ops', lang)}</p>
                <p className="text-lg font-semibold text-white mt-1">{treasury.pending_operations}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-wider text-gray-400">{tr('daoPage', 'daily_limit', lang)}</p>
                <p className="text-lg font-semibold text-white mt-1">{treasury.daily_spend_limit_zion.toLocaleString()} ZION</p>
              </div>
            </div>
          </motion.section>
        )}

        {/* ── Governance phases ── */}
        <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="rounded-[32px] border border-white/10 bg-white/5 p-8">
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tr('daoPage', 'governance_phases', lang)}</p>
            <h2 className="text-3xl font-semibold text-white">{tr('daoPage', 'road_to_full_decentralization', lang)}</h2>
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

        {/* ── Proposals ── */}
        <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tr('daoPage', 'governance_proposals', lang)}</p>
              <h2 className="text-3xl font-semibold text-white">{tr('daoPage', 'vote_on_protocol_decisions', lang)}</h2>
            </div>
            <button className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 transition-colors">
              <Plus className="h-4 w-4" />
              {tr('daoPage', 'create_proposal', lang)}
            </button>
          </div>
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-zion-gold border-r-transparent" />
              <p className="mt-4 text-gray-400">{tr('daoPage', 'loading_proposals', lang)}</p>
            </div>
          ) : proposals.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-black/40 p-12 text-center backdrop-blur-xl">
              <Crown className="h-12 w-12 text-gray-500 mx-auto mb-4" />
              <p className="text-lg font-semibold text-white mb-2">{tr('daoPage', 'no_proposals_yet', lang)}</p>
              <p className="text-gray-400">{tr('daoPage', 'be_the_first_to_create_a_governance_proposal', lang)}</p>
            </div>
          ) : (
            <div className="space-y-6">
              {proposals.map((proposal) => (
                <ProposalCard key={proposal.id} proposal={proposal} onVote={handleVote} />
              ))}
            </div>
          )}
        </motion.section>

        {/* ── Humanitarian Tithe ── */}
        <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="rounded-[32px] border border-pink-500/30 bg-gradient-to-r from-pink-500/20 via-purple-500/20 to-pink-500/20 p-10">
          <div className="flex items-center gap-3 mb-4">
            <Heart className="h-8 w-8 text-pink-400" />
            <h2 className="text-3xl font-semibold text-white">{tr('daoPage', 'humanitarian_tithe', lang)}</h2>
          </div>
          <p className="text-lg text-gray-300 mb-6">
            {cs
              ? '10 % všech odměn za těžbu financuje projekty čisté vody, potravinové bezpečnosti a vzdělávání.'
              : '10% of all mining rewards fund clean water, food security, and education projects worldwide.'}
          </p>
          {stats && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: tr('daoPage', 'total_projects', lang), value: stats.humanitarian.total_proposals },
                { label: tr('daoPage', 'active_funding', lang), value: stats.humanitarian.active_proposals },
                { label: tr('daoPage', 'beneficiaries', lang), value: stats.humanitarian.total_beneficiaries.toLocaleString() },
                { label: tr('daoPage', 'funded_amount', lang), value: stats.humanitarian.total_funded.toLocaleString() },
              ].map((s) => (
                <div key={s.label} className="rounded-2xl border border-pink-500/20 bg-black/40 p-4">
                  <p className="text-xs uppercase tracking-wider text-gray-400">{s.label}</p>
                  <p className="text-3xl font-bold text-white">{s.value}</p>
                </div>
              ))}
            </div>
          )}
        </motion.section>

        {/* ── Co-Admin Governance + Sacred Trinity ── */}
        <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="rounded-[32px] border border-zion-gold/30 bg-gradient-to-br from-zion-gold/10 via-zion-purple/10 to-transparent p-8">
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tr('daoPage', 'multi_layer_governance', lang)}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Crown className="h-7 w-7 text-zion-gold" />
              {tr('daoPage', 'co_admin_sacred_trinity', lang)}
            </h2>
            <p className="text-sm text-gray-400 max-w-3xl">
              {cs
                ? 'Multi-vrstvá DAO správa přes L1–L6. Co-Admini koordinují cross-layer veta a politiku, Posvátná trojice symbolizuje kosmické archetypy správy.'
                : 'Multi-layer DAO governance across L1–L6. Co-Admins coordinate cross-layer vetoes and policy, while the Sacred Trinity embodies cosmic archetypes of stewardship.'}
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            {/* Co-Admin system */}
            <div className="rounded-2xl border border-white/10 bg-black/40 p-5">
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck className="h-5 w-5 text-cyan-400" />
                <h3 className="font-semibold text-white">{tr('daoPage', 'co_admin_system', lang)}</h3>
              </div>
              <p className="text-sm text-gray-400 mb-3">
                {cs
                  ? 'Každá vrstva (L1–L6) má svého Co-Admina pro technická rozhodnutí a koordinaci. Cross-layer rozhodnutí vyžadují souhlas dotčených Co-Adminů.'
                  : 'Each layer (L1–L6) has a Co-Admin for technical decisions and coordination. Cross-layer decisions require consent from affected Co-Admins.'}
              </p>
              <div className="space-y-1.5 text-xs">
                {(['L1 Consensus', 'L2 DAO/Bridge', 'L3 WARP', 'L4 Oasis', 'L5 Free World', 'L6 Issobella'] as const).map((layer) => (
                  <div key={layer} className="flex items-center justify-between rounded-lg border border-white/5 bg-white/5 px-3 py-1.5">
                    <span className="text-gray-300 font-mono">{layer}</span>
                    <span className="text-gray-500">{tr('daoPage', 'co_admin', lang)} · {tr('daoPage', 'dao_authority', lang)}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Sacred Trinity */}
            <div className="rounded-2xl border border-zion-gold/20 bg-zion-gold/5 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Star className="h-5 w-5 text-zion-gold" />
                <h3 className="font-semibold text-white">{tr('daoPage', 'sacred_trinity', lang)}</h3>
              </div>
              <p className="text-sm text-gray-400 mb-4">
                {cs
                  ? 'Kosmické archetypy DAO governance — Rama (správce, L1), Síta (srdce, L5), Hanuman (ochránce, L2).'
                  : 'Cosmic archetypes of DAO governance — Rama (steward, L1), Síta (heart, L5), Hanuman (guardian, L2).'}
              </p>
              <div className="space-y-3">
                {[
                  { name: 'Rama', role: tr('daoPage', 'steward_consensus_l1', lang), color: 'text-cyan-300', desc: tr('daoPage', 'chain_dharma_fair_mining_protocol_integrity', lang) },
                  { name: 'Síta', role: tr('daoPage', 'heart_community_l5', lang), color: 'text-rose-300', desc: tr('daoPage', 'humanitarian_fund_physical_communities_care', lang) },
                  { name: 'Hanuman', role: tr('daoPage', 'guardian_bridge_l2', lang), color: 'text-amber-300', desc: tr('daoPage', 'bridging_worlds_protection_faithful_service', lang) },
                ].map((archetype) => (
                  <div key={archetype.name} className="rounded-xl border border-white/10 bg-black/20 p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`font-bold text-sm ${archetype.color}`}>{archetype.name}</span>
                      <span className="text-[10px] text-gray-500 uppercase tracking-wider">{archetype.role}</span>
                    </div>
                    <p className="text-xs text-gray-400">{archetype.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* Consent Engine */}
          <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-5">
            <div className="flex items-center gap-3 mb-3">
              <Sparkles className="h-5 w-5 text-cyan-400" />
              <h3 className="font-semibold text-white">{tr('daoPage', 'consent_engine', lang)}</h3>
              <span className="text-[10px] uppercase tracking-widest border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded-full font-semibold">L2 DAO</span>
            </div>
            <p className="text-sm text-gray-400 max-w-3xl">
              {cs
                ? 'Mechanismus souhlasu zajišťuje, že cross-layer rozhodnutí neprocházejí bez aktivního souhlasu dotčených vrstev. Blokující veto je vyhrazeno pro bezpečnostní incidenty a porušení dohody.'
                : 'The consent mechanism ensures cross-layer decisions do not pass without active consent from affected layers. Blocking veto is reserved for security incidents and agreement violations.'}
            </p>
            <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px]">
              {[
                { label: tr('daoPage', 'propose', lang), detail: tr('daoPage', 'any_co_admin', lang) },
                { label: tr('daoPage', 'consent', lang), detail: tr('daoPage', 'affected_layers', lang) },
                { label: tr('daoPage', 'veto_window', lang), detail: '72h' },
                { label: tr('daoPage', 'execute', lang), detail: tr('daoPage', 'after_consent', lang) },
              ].map((step) => (
                <div key={step.label} className="rounded-lg border border-white/10 bg-white/5 p-2.5 text-center">
                  <p className="font-semibold text-cyan-300 text-xs">{step.label}</p>
                  <p className="text-gray-500 mt-0.5">{step.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* ── Tree of Life ── */}
        <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="rounded-[32px] border border-white/10 bg-white/5 p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
            <div>
              <p className="text-sm uppercase tracking-[0.4em] text-gray-500">Tree of Life</p>
              <h2 className="text-3xl font-semibold text-white">{tr('daoPage', 'dao_circles_governance_topology', lang)}</h2>
              <p className="text-gray-300 max-w-2xl mt-2">
                {cs
                  ? 'Tree of Life slouží jako živý DAO ledger. Kořeny reprezentují komunitní guildy, srdce vývojové kruhy a koruna správní guardians.'
                  : 'Tree of Life serves as a living DAO ledger. Roots represent community guilds, the heart development circles, and the crown governance guardians.'}
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/60 px-4 py-2 text-sm">
              <TreeDeciduous className="h-5 w-5 text-emerald-300" />
              <span className="text-gray-300">{tr('daoPage', 'live_topology', lang)}</span>
            </div>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                level: tr('daoPage', 'crown', lang),
                title: tr('daoPage', 'guardians_council', lang),
                description: tr('daoPage', 'top_dao_governance_layer_treasury_oversight_s', lang),
                color: 'from-indigo-500/70 to-fuchsia-500/40',
                Icon: Crown,
                iconColor: 'text-yellow-200',
              },
              {
                level: tr('daoPage', 'heart', lang),
                title: tr('daoPage', 'builders_circle', lang),
                description: tr('daoPage', 'ecosystem_heart_protocol_development_core_pro', lang),
                color: 'from-emerald-500/60 to-cyan-500/30',
                Icon: Sparkles,
                iconColor: 'text-teal-200',
              },
              {
                level: tr('daoPage', 'roots', lang),
                title: tr('daoPage', 'community_guild', lang),
                description: tr('daoPage', 'dao_roots_open_community_contribution_streams', lang),
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

        {/* ── Kabbalah Tree ── */}
        <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="rounded-[32px] border border-white/10 bg-gradient-to-b from-zion-purple/10 to-black/80 p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
            <div>
              <p className="text-sm uppercase tracking-[0.4em] text-gray-500">Consciousness Mining</p>
              <h2 className="text-3xl font-semibold text-white">Kabbalah Tree of Life · 144k Guardians</h2>
              <p className="text-gray-300 max-w-2xl mt-2">
                {cs
                  ? '9 vědomostních levelů namapovaných na 10 Sefirot. Každý DAO circle odpovídá různým consciousness levelům.'
                  : '9 consciousness levels mapped to 10 Sefirot. Each DAO circle corresponds to different consciousness levels.'}
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-zion-gold/30 bg-zion-gold/10 px-4 py-2 text-sm">
              <Star className="h-5 w-5 text-zion-gold" />
              <span className="text-white">{tr('daoPage', 'real_time_dao_tracking', lang)}</span>
            </div>
          </div>
          <GuardiansTreeClient />
        </motion.section>

        {/* ── Quick links ── */}
        <motion.section initial={{ opacity: 0, scale: 0.98 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} className="rounded-[32px] border border-zion-gold/30 bg-gradient-to-r from-zion-purple/30 via-zion-gold/15 to-zion-purple/30 p-10">
          <h2 className="text-3xl font-semibold text-white text-center mb-8">{tr('daoPage', 'helpful_links', lang)}</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {quickLinks.map((link) => (
              <div key={link.label} className="rounded-2xl border border-white/10 bg-black/40 p-5 hover:bg-black/60 transition-colors">
                <p className="text-sm font-semibold text-white">{link.label}</p>
                <p className="mt-2 text-sm text-gray-300">{link.description}</p>
                <Link href={link.href} target={link.href.startsWith('http') ? '_blank' : undefined} rel={link.href.startsWith('http') ? 'noreferrer' : undefined} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-zion-gold hover:text-zion-gold/80 transition-colors">
                  {tr('daoPage', 'open', lang)}
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
