'use client';

import { motion } from 'framer-motion';
import {
  Globe2,
  Rocket,
  Sparkles,
  LucideIcon,
} from 'lucide-react';

const TerranovaComponentsLayerMenuCopy = {
  ecosystemLayers: { cs: `Ekosystémové vrstvy`, en: `Ecosystem Layers` },
};

type Layer = {
  id: string;
  labelCs: string;
  labelEn: string;
  href: string;
  icon: LucideIcon;
  color: string;
  rgb: string;
};

const LAYERS: Layer[] = [
  {
    id: 'l5',
    labelCs: 'L5 Free World',
    labelEn: 'L5 Free World',
    href: '/l5-free-world',
    icon: Globe2,
    color: '#F59E0B',
    rgb: '245,158,11',
  },
  {
    id: 'l6',
    labelCs: 'L6 Issobella',
    labelEn: 'L6 Issobella',
    href: '/l6-issobella',
    icon: Rocket,
    color: '#F43F5E',
    rgb: '244,63,94',
  },
];

export default function LayerMenu({ cs }: { cs: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.6 }}
      className="mt-6"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500">
          {TerranovaComponentsLayerMenuCopy.ecosystemLayers[cs ? 'cs' : 'en']}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {LAYERS.map((layer, i) => {
          const Icon = layer.icon;
          return (
            <motion.a
              key={layer.id}
              href={layer.href}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.06, duration: 0.5 }}
              className="group relative flex flex-col items-center gap-2 zion-rainbow-sub p-4 transition-all duration-300 hover:scale-[1.03]"
              style={{ '--rc': layer.rgb } as React.CSSProperties}
            >
              <div
                className="absolute -top-6 -right-6 h-16 w-16 rounded-full blur-2xl opacity-20 group-hover:opacity-35 transition-opacity duration-500"
                style={{ backgroundColor: layer.color }}
              />
              <span
                className="relative z-10 inline-flex h-10 w-10 items-center justify-center zion-rainbow-sub"
                style={{ '--rc': layer.rgb } as React.CSSProperties}
              >
                <Icon className="h-5 w-5" style={{ color: layer.color }} />
              </span>
              <span
                className="relative z-10 text-xs font-semibold"
                style={{ color: layer.color }}
              >
                {cs ? layer.labelCs : layer.labelEn}
              </span>
            </motion.a>
          );
        })}
      </div>
    </motion.div>
  );
}
