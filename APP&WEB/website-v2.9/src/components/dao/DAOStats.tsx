'use client';

import { motion } from 'framer-motion';
import { Coins, Gavel, Users, TrendingUp } from 'lucide-react';
import { DAOStats as DAOStatsType } from '@/lib/dao-api';

interface DAOStatsProps {
  stats: DAOStatsType;
}

export default function DAOStats({ stats }: DAOStatsProps) {
  const formatTreasury = (value: number | string) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
    return num.toFixed(2);
  };

  const statCards = [
    {
      label: 'Treasury Balance',
      value: `${formatTreasury(stats.treasury_balance)} ZION`,
      icon: Coins,
      color: 'text-zion-gold',
      rc: '252, 209, 22',
    },
    {
      label: 'Total Proposals',
      value: stats.governance.total_proposals.toString(),
      icon: Gavel,
      color: 'text-zion-cyan',
      rc: '7, 137, 48',
    },
    {
      label: 'Active Voters',
      value: stats.governance.active_voters.toString(),
      icon: Users,
      color: 'text-zion-gold',
      rc: '252, 209, 22',
    },
    {
      label: 'Humanitarian Projects',
      value: stats.humanitarian.total_proposals.toString(),
      icon: TrendingUp,
      color: 'text-zion-cyan',
      rc: '7, 137, 48',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {statCards.map((stat, index) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          className="zion-rainbow-sub p-6"
          style={{ '--rc': stat.rc } as React.CSSProperties}
        >
          <stat.icon className={`h-8 w-8 ${stat.color} mb-4`} />
          <p className="text-xs uppercase tracking-wider text-gray-400 mb-2">{stat.label}</p>
          <p className="text-3xl font-bold text-white">{stat.value}</p>
        </motion.div>
      ))}
    </div>
  );
}
