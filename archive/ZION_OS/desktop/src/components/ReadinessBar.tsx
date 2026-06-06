import { Activity } from 'lucide-react';
import type { ReadinessScore } from '../lib/api';

interface Props {
  readiness: ReadinessScore | null;
}

export default function ReadinessBar({ readiness }: Props) {
  if (!readiness || readiness.score >= 95) return null;

  const score = readiness.score ?? 0;
  let label = 'Needs Work';
  if (score >= 80) label = 'Almost Ready';
  else if (score >= 50) label = 'Getting There';

  return (
    <div className="rounded-xl border border-white/10 p-4 bg-gradient-to-r from-emerald-900/20 to-transparent">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`text-2xl font-bold ${score >= 80 ? 'text-emerald-400' : score >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
            {score}%
          </div>
          <div>
            <div className="text-sm font-semibold text-white">{label}</div>
            <div className="text-[10px] text-gray-400 font-mono">
              {readiness.checks?.map(c => `${c.ok ? '✓' : '✗'} ${c.id}`).join('  ·  ')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
