'use client';

import { CheckCircle2 } from 'lucide-react';
import { GovernanceProposal } from '@/lib/dao-api';
import { useLang } from '@/contexts/LanguageContext';

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

/**
 * Quorum progress bar — participation (total weight) vs the required
 * quorum votes reported by the daemon. Renders nothing when the daemon
 * predates quorum fields (undefined → no misleading bar).
 */
export default function QuorumProgress({ proposal }: { proposal: GovernanceProposal }) {
  const { lang } = useLang();
  const cs = lang === 'cs';

  const required = flowersToZion(proposal.quorum_required_votes);
  if (required <= 0 || proposal.required_quorum_percent == null) return null;

  const votesFor = flowersToZion(proposal.for_votes);
  const votesAgainst = flowersToZion(proposal.against_votes);
  const votesAbstain = flowersToZion(proposal.abstain_votes);
  const participation = votesFor + votesAgainst + votesAbstain;

  const pct = Math.min(100, (participation / required) * 100);
  const met = proposal.quorum_met ?? participation >= required;

  return (
    <div className="mb-4">
      <div className="flex justify-between text-[10px] mb-1">
        <span className={met ? 'text-zion-gold' : 'text-gray-400'}>
          {cs ? 'Quorum' : 'Quorum'} ({proposal.required_quorum_percent}%)
        </span>
        <span className="text-gray-400">
          {formatZion(participation)} / {formatZion(required)} ZION
          {met && (
            <span className="text-zion-gold ml-1 inline-flex items-center gap-0.5">
              <CheckCircle2 className="h-3 w-3 inline" />
              {cs ? 'splněno' : 'met'}
            </span>
          )}
        </span>
      </div>
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${met ? 'bg-zion-gold' : 'bg-gradient-to-r from-zion-cyan to-zion-gold'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
