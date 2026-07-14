import { Shield } from 'lucide-react';
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

  const color = score >= 80 ? 'text-emerald-400' : score >= 50 ? 'text-amber-400' : 'text-red-400';

  return (
    <div className="zion-panel p-4 bg-gradient-to-r from-emerald-900/10 to-transparent">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Shield className="h-5 w-5 text-emerald-400" />
          <div>
            <div className="text-xs text-gray-400 uppercase tracking-wider">Readiness</div>
            <div className="flex items-center gap-3 mt-1">
              <div className={`text-2xl font-bold ${color}`}>{score}%</div>
              <div className="text-sm font-semibold text-white">{label}</div>
            </div>
          </div>
        </div>
        <div className="text-[10px] text-gray-400 font-mono truncate max-w-md">
          {readiness.checks?.map(c => `${c.ok ? '✓' : '✗'} ${c.id}`).join('  ·  ')}
        </div>
      </div>
    </div>
  );
}
