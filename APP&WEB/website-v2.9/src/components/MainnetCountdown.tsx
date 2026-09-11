'use client';

import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Clock,
  Coins,
  Construction,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';

const MainnetCountdownCopy = {
  title: { cs: `Stav launchu`, en: `Launch status` },
  badge: { cs: `Veřejný launch odložen`, en: `Public launch postponed` },
  body: {
    cs: `Projekt ZION TerraNova zůstává ve vývoji. Veřejný start bude možný až po splnění následujících podmínek:`,
    en: `The ZION TerraNova project remains in development. A public start will only be possible once the following conditions are met:`,
  },
  conditions: {
    team: {
      cs: `Tým dobrovolných vývojářů`,
      en: `Team of volunteer developers`,
    },
    maturity: {
      cs: `Úspěšné Maturity Gate (Maturita)`,
      en: `Maturity Gate passed`,
    },
    liquidity: {
      cs: `Základní likvidita`,
      en: `Basic liquidity`,
    },
    listing: {
      cs: `Schválený veřejný listing`,
      en: `Approved public listing`,
    },
  },
  note: {
    cs: `Nové datum neoznámíme, dokud nebudeme připraveni.`,
    en: `No new date will be announced until we are ready.`,
  },
  cta: { cs: `Číst oznámení`, en: `Read the announcement` },
};

function Condition({
  icon: Icon,
  label,
}: {
  icon: typeof Users;
  label: string;
}) {
  return (
    <li className="flex items-center gap-2.5 text-xs text-gray-300">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5">
        <Icon className="h-3.5 w-3.5 text-zion-cyan" />
      </div>
      <span className="leading-tight">{label}</span>
    </li>
  );
}

function Wrap({ embedded, children }: { embedded: boolean; children: React.ReactNode }) {
  if (embedded) return <>{children}</>;
  return (
    <section className="py-6 px-4">
      <div className="zion-container">{children}</div>
    </section>
  );
}

export default function MainnetCountdown({ embedded = false }: { embedded?: boolean }) {
  const { lang } = useLang();
  const cs = lang === 'cs';

  const conditions = [
    { icon: Users, label: MainnetCountdownCopy.conditions.team[cs ? 'cs' : 'en'] },
    { icon: ShieldCheck, label: MainnetCountdownCopy.conditions.maturity[cs ? 'cs' : 'en'] },
    { icon: Coins, label: MainnetCountdownCopy.conditions.liquidity[cs ? 'cs' : 'en'] },
    { icon: Construction, label: MainnetCountdownCopy.conditions.listing[cs ? 'cs' : 'en'] },
  ];

  return (
    <Wrap embedded={embedded}>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className={`zion-rainbow-card relative overflow-hidden backdrop-blur-xl ${embedded ? 'p-4' : 'p-6 md:p-8'}`}
        style={{ '--rc': '228, 30, 43' } as React.CSSProperties}
      >
        <div className="absolute -top-16 -right-16 w-40 h-40 rounded-full bg-zion-purple/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-40 h-40 rounded-full bg-zion-gold/10 blur-3xl pointer-events-none" />

        <div className="relative flex flex-col gap-3">
          {/* Status badge */}
          <div
            className="flex items-center gap-2 text-[10px] text-zion-gold bg-zion-gold/10 border border-zion-gold/20 rounded-full px-2.5 py-1 self-start"
            style={{ boxShadow: '0 0 12px rgba(252, 209, 22, 0.12)' }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-zion-gold animate-pulse" />
            {MainnetCountdownCopy.badge[cs ? 'cs' : 'en']}
          </div>

          {/* Title */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zion-purple/15">
              <AlertTriangle className="h-4 w-4 text-zion-purple" />
            </div>
            <h2 className="text-sm font-bold text-white leading-tight">
              {MainnetCountdownCopy.title[cs ? 'cs' : 'en']}
            </h2>
          </div>

          <p className="text-xs text-gray-400 leading-relaxed">
            {MainnetCountdownCopy.body[cs ? 'cs' : 'en']}
          </p>

          {/* Conditions list */}
          <ul className="space-y-2 mt-1">
            {conditions.map((c, i) => (
              <Condition key={i} icon={c.icon} label={c.label} />
            ))}
          </ul>

          <p className="text-[10px] text-gray-500 mt-1 flex items-center gap-1.5">
            <Clock className="h-3 w-3" />
            {MainnetCountdownCopy.note[cs ? 'cs' : 'en']}
          </p>

          <a
            href="/news/launch-postponed"
            className="mt-1 inline-flex items-center justify-center gap-2 rounded-xl border border-zion-cyan/30 bg-zion-cyan/10 px-3 py-2 text-xs font-medium text-zion-cyan hover:bg-zion-cyan/20 transition"
          >
            {MainnetCountdownCopy.cta[cs ? 'cs' : 'en']}
          </a>
        </div>
      </motion.div>
    </Wrap>
  );
}
