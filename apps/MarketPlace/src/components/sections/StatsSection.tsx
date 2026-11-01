'use client';

import { useEffect, useState } from 'react';
import { Package, BarChart3, Gavel, Users } from 'lucide-react';
import { useLangT } from '@/lib/useTranslation';

interface MarketStats {
  artifacts: number;
  activeListings: number;
  activeAuctions: number;
  sales: number;
  volumeWei: string;
  volumeWzion: number;
  holders: number;
  categories: Record<string, number>;
}

function formatWzion(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
  return v % 1 === 0 ? String(v) : v.toFixed(2);
}

export default function StatsSection() {
  const { t } = useLangT();
  const [stats, setStats] = useState<MarketStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/stats')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (!cancelled && data) setStats(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const cards = [
    { labelKey: 'stats.itemsListed', value: stats ? stats.artifacts.toLocaleString() : '—', icon: Package, rc: '7, 137, 48' },
    { labelKey: 'stats.totalVolume', value: stats ? formatWzion(stats.volumeWzion) : '—', subKey: 'stats.wzion', icon: BarChart3, rc: '252, 209, 22' },
    { labelKey: 'stats.activeAuctions', value: stats ? String(stats.activeAuctions) : '—', icon: Gavel, rc: '228, 30, 43' },
    { labelKey: 'stats.holders', value: stats ? stats.holders.toLocaleString() : '—', icon: Users, rc: '7, 137, 48' },
  ];

  return (
    <section className="zion-hero-grid">
      {cards.map((s) => {
        const Icon = s.icon;
        return (
          <div
            key={s.labelKey}
            className="zion-hero-card text-left"
            style={{ '--rc': s.rc } as React.CSSProperties}
          >
            <div className="flex items-center justify-between mb-3">
              <Icon className="w-5 h-5" style={{ color: `rgb(${s.rc})` }} />
              <div className="text-[10px] uppercase tracking-widest text-gray-500">{t(s.labelKey)}</div>
            </div>
            <div className="text-2xl md:text-3xl font-black font-mono">
              <span className="text-gradient-gold">{s.value}</span>
              {s.subKey && <span className="text-sm text-gray-400 ml-1">{t(s.subKey)}</span>}
            </div>
          </div>
        );
      })}
    </section>
  );
}
