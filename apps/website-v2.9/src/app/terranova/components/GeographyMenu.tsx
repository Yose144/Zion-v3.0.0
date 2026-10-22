'use client';

import { motion } from 'framer-motion';
import {
  Globe,
  Mountain,
  TreePalm,
  Landmark,
  Sparkles,
  LucideIcon,
} from 'lucide-react';

const TerranovaComponentsGeographyMenuCopy = {
  culturalInsertsByGeography: { cs: `Kulturní vložky podle geografie`, en: `Cultural inserts by geography` },
};

type Region = {
  id: string;
  labelCs: string;
  labelEn: string;
  href: string;
  icon: LucideIcon;
  color: string;
  rgb: string;
};

const REGIONS: Region[] = [
  {
    id: 'europe',
    labelCs: 'Evropa',
    labelEn: 'Europe',
    href: '/terranova/geography/europe',
    icon: Landmark,
    color: '#A78BFA',
    rgb: '167,139,250',
  },
  {
    id: 'asia',
    labelCs: 'Asie',
    labelEn: 'Asia',
    href: '/terranova/geography/asia',
    icon: Mountain,
    color: '#38BDF8',
    rgb: '56,189,248',
  },
  {
    id: 'africa',
    labelCs: 'Afrika',
    labelEn: 'Africa',
    href: '/terranova/geography/africa',
    icon: TreePalm,
    color: '#F472B6',
    rgb: '244,114,182',
  },
  {
    id: 'americas',
    labelCs: 'Ameriky',
    labelEn: 'Americas',
    href: '/terranova/geography/americas',
    icon: Globe,
    color: '#34D399',
    rgb: '52,211,153',
  },
  {
    id: 'oceania',
    labelCs: 'Oceánie',
    labelEn: 'Oceania',
    href: '/terranova/geography/oceania',
    icon: Sparkles,
    color: '#FBBF24',
    rgb: '252, 209, 22',
  },
];

export default function GeographyMenu({ cs }: { cs: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35, duration: 0.6 }}
      className="mt-6"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-[10px] uppercase tracking-[0.3em] text-zion-gold/65">
          {TerranovaComponentsGeographyMenuCopy.culturalInsertsByGeography[cs ? 'cs' : 'en']}
        </p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {REGIONS.map((region, i) => {
          const Icon = region.icon;
          return (
            <motion.a
              key={region.id}
              href={region.href}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.06, duration: 0.5 }}
              className="group relative flex flex-col items-center gap-2 zion-rainbow-sub p-4 transition-all duration-300 hover:scale-[1.03]"
              style={{ '--rc': region.rgb } as React.CSSProperties}
            >
              <div
                className="absolute -top-6 -right-6 h-16 w-16 rounded-full blur-2xl opacity-20 group-hover:opacity-35 transition-opacity duration-500"
                style={{ backgroundColor: region.color }}
              />
              <span
                className="relative z-10 inline-flex h-10 w-10 items-center justify-center zion-rainbow-sub"
                style={{ '--rc': region.rgb } as React.CSSProperties}
              >
                <Icon className="h-5 w-5" style={{ color: region.color }} />
              </span>
              <span
                className="relative z-10 text-xs font-semibold"
                style={{ color: region.color }}
              >
                {cs ? region.labelCs : region.labelEn}
              </span>
            </motion.a>
          );
        })}
      </div>
    </motion.div>
  );
}
