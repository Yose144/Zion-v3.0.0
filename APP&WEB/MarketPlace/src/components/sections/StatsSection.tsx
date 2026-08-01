import { Package, BarChart3, Gavel, Users } from 'lucide-react';

const stats = [
  { label: 'Items Listed', value: '12,847', icon: Package, rc: '6, 182, 212' },
  { label: 'Total Volume', value: '847k', sub: 'wZION', icon: BarChart3, rc: '255, 215, 0' },
  { label: 'Active Auctions', value: '34', icon: Gavel, rc: '147, 51, 234' },
  { label: 'Holders', value: '2,193', icon: Users, rc: '16, 185, 129' },
];

export default function StatsSection() {
  return (
    <section className="zion-hero-grid">
      {stats.map((s) => {
        const Icon = s.icon;
        return (
          <div
            key={s.label}
            className="zion-hero-card text-left"
            style={{ '--rc': s.rc } as React.CSSProperties}
          >
            <div className="flex items-center justify-between mb-3">
              <Icon className="w-5 h-5" style={{ color: `rgb(${s.rc})` }} />
              <div className="text-[10px] uppercase tracking-widest text-gray-500">{s.label}</div>
            </div>
            <div className="text-2xl md:text-3xl font-black font-mono">
              <span className="text-gradient-gold">{s.value}</span>
              {s.sub && <span className="text-sm text-gray-400 ml-1">{s.sub}</span>}
            </div>
          </div>
        );
      })}
    </section>
  );
}
