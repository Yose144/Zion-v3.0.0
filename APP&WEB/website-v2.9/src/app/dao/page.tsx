'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowRight, Crown, ShieldCheck, Plus, Heart, TreeDeciduous, Star, Sparkles, Users, Info, Link2, ArrowLeftRight } from 'lucide-react';
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
  createGovernanceProposal,
  type GovernanceProposal,
  type DAOStats as DAOStatsType,
  type DAOTreasuryOverview,
} from '@/lib/dao-api';

const getPhases = (cs: boolean) => [
  {
    title: cs ? 'Fáze 1 · Stewardship (2025)' : 'Phase 1 · Stewardship (2025)',
    bullets: cs
      ? ['Maitreya Buddha + Round Table guardians zajišťují uptime', 'Emergency intervence + schválení rozpočtu roadmapy', '90denní reporting publikovaný v docs']
      : ['Maitreya Buddha + Round Table guardians ensure uptime', 'Emergency intervention + roadmap budget approvals', '90-day reporting cadence published in docs'],
  },
  {
    title: cs ? 'Fáze 2 · Hybridní DAO (2026)' : 'Phase 2 · Hybrid DAO (2026)',
    bullets: cs
      ? ['Validator council + guardians · 5-of-7 treasury', 'On-chain proposal lifecycle (create → vote → execute)', 'Golden Egg incentivy + community matching pooly']
      : ['Validator council joins guardians · 5-of-7 treasury', 'On-chain proposal lifecycle (create → vote → execute)', 'Golden Egg incentives + community matching pools'],
  },
  {
    title: cs ? 'Fáze 3 · Plné DAO (2026+)' : 'Phase 3 · Full DAO (2026+)',
    bullets: cs
      ? ['Treasury + roadmapa plně řízeny stakery', 'Kvadratické nebo consciousness-weighted hlasování', 'Transparentní granty + investiční komise ekosystému']
      : ['Treasury + roadmap fully controlled by stakers', 'Quadratic or consciousness-weighted voting experiments', 'Transparent grants + ecosystem investment committee'],
  },
];

const getQuickLinks = (cs: boolean) => [
  { label: cs ? 'Governance dokumentace' : 'Governance docs', href: '/docs', description: cs ? 'Proposal flow, hlasovací síla, nouzové klauzule.' : 'Proposal flow, voting power, emergency clauses.' },
  { label: cs ? 'Treasury dashboard' : 'Treasury dashboard', href: '/dashboard', description: cs ? 'Real-time zůstatky, přehled alokací, tithe.' : 'Real-time balances, allocation overview, tithe.' },
  { label: cs ? 'DeFi Hub' : 'DeFi Hub', href: '/defi', description: cs ? 'Swap, bridge a portfolio na Base Mainnet.' : 'Swap, bridge and portfolio on Base Mainnet.' },
];

export default function DaoPage() {
  const { lang } = useLang();
  const cs = lang === 'cs';

  const [stats, setStats] = useState<DAOStatsType | null>(null);
  const [treasury, setTreasury] = useState<DAOTreasuryOverview | null>(null);
  const [proposals, setProposals] = useState<GovernanceProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [daemonOnline, setDaemonOnline] = useState<boolean | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [createProposer, setCreateProposer] = useState('');
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [bridgeStatus, setBridgeStatus] = useState<{
    online: boolean;
    l1_locks_detected: number;
    l1_locks_finalized: number;
    evm_mints_confirmed: number;
    last_l1_height: number;
    errors_total: number;
  } | null>(null);

  const phases = getPhases(cs);
  const quickLinks = getQuickLinks(cs);

  useEffect(() => { loadDAOData(); }, []);

  async function loadDAOData() {
    try {
      setLoading(true);
      const [statsData, proposalsData, treasuryData, bridgeData] = await Promise.all([
        getDAOStats(),
        getGovernanceProposals(),
        getDAOTreasuryOverview(),
        fetch('/api/bridge/status', { cache: 'no-store' }).then(r => r.json()).catch(() => null),
      ]);
      setStats(statsData);
      setProposals(proposalsData);
      setTreasury(treasuryData);
      setDaemonOnline(proposalsData.length > 0 || statsData.governance.total_proposals > 0);
      if (bridgeData) setBridgeStatus(bridgeData);
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

  async function handleCreateProposal(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    if (!createTitle.trim() || !createDesc.trim()) {
      setCreateError(cs ? 'Vyplňte název a popis.' : 'Please enter a title and description.');
      return;
    }
    setCreateBusy(true);
    try {
      const proposer = createProposer.trim() || 'zion1demo' + Math.random().toString(36).substring(2, 10);
      await createGovernanceProposal({
        proposer,
        title: createTitle.trim(),
        description: createDesc.trim(),
      });
      setCreateOpen(false);
      setCreateTitle('');
      setCreateDesc('');
      setCreateProposer('');
      await loadDAOData();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : (cs ? 'Nepodařilo se vytvořit návrh.' : 'Failed to create proposal.'));
    } finally {
      setCreateBusy(false);
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
              DAO 2.0 · {cs ? 'Správa' : 'Governance'}
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.4em] text-gray-400">{cs ? 'Treasury · návrhy · hlasování' : 'Treasury · proposals · voting'}</p>
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
                {loading ? (cs ? 'Načítám…' : 'Loading…') : (cs ? 'Obnovit data' : 'Refresh Data')}
                <ArrowRight className="h-4 w-4" />
              </button>
              <Link href="/docs" className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-white">
                {cs ? 'Dokumentace governance' : 'Governance docs'}
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
                <p className="font-semibold text-blue-300">{cs ? 'DAO Daemon — Fáze 2 (Hybridní DAO)' : 'DAO Daemon — Phase 2 (Hybrid DAO)'}</p>
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
              <h2 className="text-3xl font-semibold text-white">{cs ? 'Přehled treasury' : 'Treasury overview'}</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-wider text-gray-400">Multisig</p>
                <p className="text-lg font-semibold text-white mt-1">{treasury.multisig}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-wider text-gray-400">{cs ? 'K dispozici' : 'Available'}</p>
                <p className="text-lg font-semibold text-white mt-1">{treasury.available_zion.toLocaleString()} ZION</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-wider text-gray-400">{cs ? 'Čekající operace' : 'Pending Ops'}</p>
                <p className="text-lg font-semibold text-white mt-1">{treasury.pending_operations}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-wider text-gray-400">{cs ? 'Denní limit' : 'Daily Limit'}</p>
                <p className="text-lg font-semibold text-white mt-1">{treasury.daily_spend_limit_zion.toLocaleString()} ZION</p>
              </div>
            </div>
          </motion.section>
        )}

        {/* ── Bridge Vault ── */}
        <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="rounded-[32px] border border-white/10 bg-white/5 p-8">
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Bridge Vault' : 'Bridge Vault'}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <ArrowLeftRight className="h-7 w-7 text-zion-gold" />
              {cs ? '100M ZION → Base Mainnet' : '100M ZION → Base Mainnet'}
            </h2>
            <p className="text-gray-300 max-w-2xl mt-2">
              {cs
                ? '6 UTXO lock transakcí (~16.67M ZION každá) odesláno na bridge vault v blocích 11611–11612. Bridge relay mintne wZION na Base mainnet po dosažení finality.'
                : '6 UTXO lock transactions (~16.67M ZION each) sent to the bridge vault in blocks 11611–11612. The bridge relay will mint wZION on Base mainnet after finality.'}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-wider text-gray-400">{cs ? 'Zamčeno ZION' : 'Locked ZION'}</p>
              <p className="text-lg font-semibold text-white mt-1">~100,000,000</p>
              <p className="text-xs text-gray-500">6 UTXO locks</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-wider text-gray-400">{cs ? 'Relay status' : 'Relay status'}</p>
              <p className="text-lg font-semibold mt-1 flex items-center gap-2">
                {bridgeStatus?.online ? (
                  <>
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-emerald-400">Online</span>
                  </>
                ) : (
                  <>
                    <span className="h-2 w-2 rounded-full bg-gray-500" />
                    <span className="text-gray-400">Offline</span>
                  </>
                )}
              </p>
              <p className="text-xs text-gray-500">{cs ? 'L2 Cross-Chain Relay' : 'L2 Cross-Chain Relay'}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-wider text-gray-400">{cs ? 'wZION mints' : 'wZION mints'}</p>
              <p className="text-lg font-semibold text-white mt-1">{bridgeStatus?.evm_mints_confirmed ?? '—'}</p>
              <p className="text-xs text-gray-500">{cs ? 'potvrzeno na Base' : 'confirmed on Base'}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-wider text-gray-400">{cs ? 'L1 blok' : 'L1 block'}</p>
              <p className="text-lg font-semibold text-white mt-1">{bridgeStatus?.last_l1_height ?? '—'}</p>
              <p className="text-xs text-gray-500">{cs ? 'poslední scan' : 'last scan'}</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-gray-500">
            <span className="inline-flex items-center gap-1.5">
              <Link2 className="h-3.5 w-3.5" />
              wZION: <span className="text-gray-400 font-mono">0x0c49…2bb6</span>
            </span>
            <span className="text-gray-600">·</span>
            <span>{cs ? 'Vault:' : 'Vault:'} <span className="text-gray-400 font-mono">zion1w0r0…w0t0</span></span>
            <span className="text-gray-600">·</span>
            <span>{cs ? 'Finality: 60 bloků' : 'Finality: 60 blocks'}</span>
          </div>
        </motion.section>

        {/* ── Governance phases ── */}
        <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="rounded-[32px] border border-white/10 bg-white/5 p-8">
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Fáze governance' : 'Governance phases'}</p>
            <h2 className="text-3xl font-semibold text-white">{cs ? 'Cesta k plné decentralizaci' : 'Road to full decentralization'}</h2>
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
              <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Governance návrhy' : 'Governance proposals'}</p>
              <h2 className="text-3xl font-semibold text-white">{cs ? 'Hlasuj o rozhodnutích' : 'Vote on protocol decisions'}</h2>
            </div>
            <button
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
            >
              <Plus className="h-4 w-4" />
              {cs ? 'Vytvořit návrh' : 'Create Proposal'}
            </button>
          </div>
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-zion-gold border-r-transparent" />
              <p className="mt-4 text-gray-400">{cs ? 'Načítám návrhy…' : 'Loading proposals…'}</p>
            </div>
          ) : proposals.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-black/40 p-12 text-center backdrop-blur-xl">
              <Crown className="h-12 w-12 text-gray-500 mx-auto mb-4" />
              <p className="text-lg font-semibold text-white mb-2">{cs ? 'Zatím žádné návrhy' : 'No proposals yet'}</p>
              <p className="text-gray-400">{cs ? 'Buď první, kdo vytvoří governance návrh!' : 'Be the first to create a governance proposal!'}</p>
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
            <h2 className="text-3xl font-semibold text-white">{cs ? 'Humanitární desátek' : 'Humanitarian Tithe'}</h2>
          </div>
          <p className="text-lg text-gray-300 mb-6">
            {cs
              ? '10 % všech odměn za těžbu financuje projekty čisté vody, potravinové bezpečnosti a vzdělávání.'
              : '10% of all mining rewards fund clean water, food security, and education projects worldwide.'}
          </p>
          {stats && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: cs ? 'Celkem projektů' : 'Total Projects', value: stats.humanitarian.total_proposals },
                { label: cs ? 'Aktivní financování' : 'Active Funding', value: stats.humanitarian.active_proposals },
                { label: cs ? 'Příjemci' : 'Beneficiaries', value: stats.humanitarian.total_beneficiaries.toLocaleString() },
                { label: cs ? 'Financováno' : 'Funded Amount', value: stats.humanitarian.total_funded.toLocaleString() },
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
        <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="zion-rainbow-card p-8" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'Vícevrstvá správa' : 'Multi-Layer Governance'}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Crown className="h-7 w-7 text-zion-gold" />
              {cs ? 'Co-Admin & Posvátná trojice' : 'Co-Admin & Sacred Trinity'}
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
                <h3 className="font-semibold text-white">{cs ? 'Co-Admin systém' : 'Co-Admin System'}</h3>
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
                    <span className="text-gray-500">{cs ? 'Co-Admin' : 'Co-Admin'} · {cs ? 'DAO autorita' : 'DAO authority'}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Sacred Trinity */}
            <div className="rounded-2xl border border-zion-gold/20 bg-zion-gold/5 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Star className="h-5 w-5 text-zion-gold" />
                <h3 className="font-semibold text-white">{cs ? 'Posvátná trojice' : 'Sacred Trinity'}</h3>
              </div>
              <p className="text-sm text-gray-400 mb-4">
                {cs
                  ? 'Kosmické archetypy DAO governance — Rama (správce, L1), Síta (srdce, L5), Hanuman (ochránce, L2).'
                  : 'Cosmic archetypes of DAO governance — Rama (steward, L1), Síta (heart, L5), Hanuman (guardian, L2).'}
              </p>
              <div className="space-y-3">
                {[
                  { name: 'Rama', role: cs ? 'Správce · Konsenzus · L1' : 'Steward · Consensus · L1', color: 'text-cyan-300', desc: cs ? 'Dharma chainu, fair mining, protokolová integrita' : 'Chain dharma, fair mining, protocol integrity' },
                  { name: 'Síta', role: cs ? 'Srdce · Komunita · L5' : 'Heart · Community · L5', color: 'text-rose-300', desc: cs ? 'Humanitární fond, fyzické komunity, péče' : 'Humanitarian fund, physical communities, care' },
                  { name: 'Hanuman', role: cs ? 'Ochránce · Bridge · L2' : 'Guardian · Bridge · L2', color: 'text-amber-300', desc: cs ? 'Přemostění světů, ochrana, věrná služba' : 'Bridging worlds, protection, faithful service' },
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
              <h3 className="font-semibold text-white">{cs ? 'Consent Engine' : 'Consent Engine'}</h3>
              <span className="text-[10px] uppercase tracking-widest border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded-full font-semibold">L2 DAO</span>
            </div>
            <p className="text-sm text-gray-400 max-w-3xl">
              {cs
                ? 'Mechanismus souhlasu zajišťuje, že cross-layer rozhodnutí neprocházejí bez aktivního souhlasu dotčených vrstev. Blokující veto je vyhrazeno pro bezpečnostní incidenty a porušení dohody.'
                : 'The consent mechanism ensures cross-layer decisions do not pass without active consent from affected layers. Blocking veto is reserved for security incidents and agreement violations.'}
            </p>
            <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px]">
              {[
                { label: cs ? 'Návrh' : 'Propose', detail: cs ? 'Jakýkoliv Co-Admin' : 'Any Co-Admin' },
                { label: cs ? 'Souhlas' : 'Consent', detail: cs ? 'Dotčené vrstvy' : 'Affected layers' },
                { label: cs ? 'Veto okno' : 'Veto window', detail: '72h' },
                { label: cs ? 'Provedení' : 'Execute', detail: cs ? 'Po souhlasu' : 'After consent' },
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
              <h2 className="text-3xl font-semibold text-white">{cs ? 'DAO kruhy & topologie' : 'DAO Circles & Governance Topology'}</h2>
              <p className="text-gray-300 max-w-2xl mt-2">
                {cs
                  ? 'Tree of Life slouží jako živý DAO ledger. Kořeny reprezentují komunitní guildy, srdce vývojové kruhy a koruna správní guardians.'
                  : 'Tree of Life serves as a living DAO ledger. Roots represent community guilds, the heart development circles, and the crown governance guardians.'}
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/60 px-4 py-2 text-sm">
              <TreeDeciduous className="h-5 w-5 text-emerald-300" />
              <span className="text-gray-300">{cs ? 'Živá topologie' : 'Live topology'}</span>
            </div>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                level: cs ? 'Koruna' : 'Crown',
                title: cs ? 'Rada guardianů' : 'Guardians Council',
                description: cs ? 'Vrchní vrstva správy DAO — dohled nad treasury, bezpečnostní revize a dlouhodobá vize.' : 'Top DAO governance layer — treasury oversight, security reviews, and long-term vision.',
                color: 'from-indigo-500/70 to-fuchsia-500/40',
                Icon: Crown,
                iconColor: 'text-yellow-200',
              },
              {
                level: cs ? 'Srdce' : 'Heart',
                title: cs ? 'Kruh stavitelů' : 'Builders Circle',
                description: cs ? 'Srdce ekosystému — vývoj protokolu, core návrhy a koordinace technických misí.' : 'Ecosystem heart — protocol development, core proposals, and technical mission coordination.',
                color: 'from-emerald-500/60 to-cyan-500/30',
                Icon: Sparkles,
                iconColor: 'text-teal-200',
              },
              {
                level: cs ? 'Kořeny' : 'Roots',
                title: cs ? 'Komunitní guilda' : 'Community Guild',
                description: cs ? 'Kořeny DAO — otevřená komunita, contribution streamy, komunitní hlasování a růst sítě.' : 'DAO roots — open community, contribution streams, community votes, and network growth.',
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
        <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="rounded-[32px] border border-white/10 bg-white/5 p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
            <div>
              <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{cs ? 'DAO' : 'DAO'}</p>
              <h2 className="text-3xl font-semibold text-white">{cs ? 'Kabbalah Tree of Life · 144k Guardians' : 'Kabbalah Tree of Life · 144k Guardians'}</h2>
              <p className="text-gray-300 max-w-2xl mt-2">
                {cs
                  ? '9 vědomostních levelů namapovaných na 10 Sefirot. Každý DAO circle odpovídá různým consciousness levelům.'
                  : '9 consciousness levels mapped to 10 Sefirot. Each DAO circle corresponds to different consciousness levels.'}
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/60 px-4 py-2 text-sm">
              <Star className="h-5 w-5 text-zion-gold" />
              <span className="text-gray-300">{cs ? 'Real-time DAO tracking' : 'Real-time DAO tracking'}</span>
            </div>
          </div>
          <GuardiansTreeClient />
        </motion.section>

        {/* ── Quick links ── */}
        <motion.section initial={{ opacity: 0, scale: 0.98 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} className="zion-cta-banner p-10">
          <h2 className="text-3xl font-semibold text-white text-center mb-8">{cs ? 'Užitečné odkazy' : 'Helpful links'}</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {quickLinks.map((link) => (
              <div key={link.label} className="rounded-2xl border border-white/10 bg-black/40 p-5 hover:bg-black/60 transition-colors">
                <p className="text-sm font-semibold text-white">{link.label}</p>
                <p className="mt-2 text-sm text-gray-300">{link.description}</p>
                <Link href={link.href} target={link.href.startsWith('http') ? '_blank' : undefined} rel={link.href.startsWith('http') ? 'noreferrer' : undefined} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-zion-gold hover:text-zion-gold/80 transition-colors">
                  {cs ? 'Otevřít' : 'Open'}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ── Create Proposal Modal ── */}
        {createOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-black/90 p-6 shadow-2xl">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-xl font-semibold text-white">{cs ? 'Nový governance návrh' : 'New governance proposal'}</h3>
                <button onClick={() => setCreateOpen(false)} className="text-gray-400 hover:text-white">✕</button>
              </div>
              <form onSubmit={handleCreateProposal} className="space-y-4">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-gray-400 mb-1">{cs ? 'Název' : 'Title'}</label>
                  <input
                    type="text"
                    value={createTitle}
                    onChange={(e) => setCreateTitle(e.target.value)}
                    placeholder={cs ? 'Např. Zvýšit bridge validator threshold' : 'e.g. Increase bridge validator threshold'}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-gray-600 focus:border-zion-gold focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wider text-gray-400 mb-1">{cs ? 'Popis' : 'Description'}</label>
                  <textarea
                    value={createDesc}
                    onChange={(e) => setCreateDesc(e.target.value)}
                    rows={4}
                    placeholder={cs ? 'Detailní popis návrhu a očekávaného dopadu...' : 'Detailed description of the proposal and expected impact...'}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-gray-600 focus:border-zion-gold focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wider text-gray-400 mb-1">{cs ? 'Proposer (zion1...)' : 'Proposer (zion1...)'}</label>
                  <input
                    type="text"
                    value={createProposer}
                    onChange={(e) => setCreateProposer(e.target.value)}
                    placeholder={cs ? 'Volitelně — jinak se použije demo adresa' : 'Optional — otherwise a demo address is used'}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-gray-600 focus:border-zion-gold focus:outline-none"
                  />
                </div>
                {createError && (
                  <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                    {createError}
                  </div>
                )}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setCreateOpen(false)}
                    className="flex-1 rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
                  >
                    {cs ? 'Zrušit' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    disabled={createBusy}
                    className="flex-1 rounded-xl bg-gradient-to-r from-zion-gold via-zion-purple to-zion-cyan px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
                  >
                    {createBusy ? (cs ? 'Vytvářím…' : 'Creating…') : (cs ? 'Vytvořit návrh' : 'Create Proposal')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
