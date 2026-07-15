'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Rocket, Calendar } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import { tr } from '@/lib/translations';

const LAUNCH_DATE = new Date('2026-12-31T00:00:00Z');
const GENESIS_DATE = new Date('2026-06-11T00:00:00Z');
const BRIDGE_DATE = new Date('2026-06-18T00:00:00Z');

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
}

function getTimeLeft(target: Date): TimeLeft {
  const total = target.getTime() - Date.now();
  const seconds = Math.max(0, Math.floor((total / 1000) % 60));
  const minutes = Math.max(0, Math.floor((total / 1000 / 60) % 60));
  const hours = Math.max(0, Math.floor((total / (1000 * 60 * 60)) % 24));
  const days = Math.max(0, Math.floor(total / (1000 * 60 * 60 * 24)));
  return { days, hours, minutes, seconds, total };
}

function pad(n: number) {
  return n.toString().padStart(2, '0');
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
  const [time, setTime] = useState<TimeLeft>(getTimeLeft(LAUNCH_DATE));
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const id = setInterval(() => {
      setTime(getTimeLeft(LAUNCH_DATE));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const units = [
    { value: time.days, label: cs ? 'Dnů' : 'Days' },
    { value: time.hours, label: cs ? 'Hodin' : 'Hours' },
    { value: time.minutes, label: cs ? 'Minut' : 'Minutes' },
    { value: time.seconds, label: cs ? 'Sekund' : 'Seconds' },
  ];

  const tMinus = time.total > 0 ? `T-${time.days}` : 'LIVE';
  const isLive = time.total <= 0;

  if (!mounted) {
    return (
      <Wrap embedded={embedded}>
        <div className="zion-panel-soft zion-panel-hover p-6 min-h-[140px]" />
      </Wrap>
    );
  }

  if (isLive) {
    return (
      <Wrap embedded={embedded}>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className={`zion-rainbow-card relative overflow-hidden backdrop-blur-xl ${embedded ? 'p-4' : 'p-6 md:p-8'}`}
          style={{ '--rc': '16, 185, 129' } as React.CSSProperties}
        >
            <div className="absolute -top-16 -right-16 w-40 h-40 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

            <div className="relative flex items-center gap-3">
              <div className="flex-none w-10 h-10 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                <Rocket className="w-5 h-5 text-emerald-300 animate-pulse" />
              </div>
              <div className="flex-1">
                <h2 className="text-sm font-bold text-white">Mainnet LIVE</h2>
                <p className="text-[11px] text-gray-400">Edge server · Mining · Bridge</p>
              </div>
              <span className="text-xs font-bold text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2.5 py-1">
                GO
              </span>
            </div>

            <div className="relative mt-3">
              <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-violet-500 to-zion-cyan"
                  initial={{ width: 0 }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 1.2, ease: 'easeOut' }}
                />
              </div>
            </div>
          </motion.div>
      </Wrap>
    );
  }

  return (
    <Wrap embedded={embedded}>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className={`zion-rainbow-card relative overflow-hidden backdrop-blur-xl ${embedded ? 'p-4' : 'p-6 md:p-8'}`}
        style={{ '--rc': '139, 92, 246' } as React.CSSProperties}
      >
          {/* ambient glow */}
          <div className="absolute -top-16 -right-16 w-40 h-40 rounded-full bg-zion-gold/10 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-16 -left-16 w-40 h-40 rounded-full bg-zion-purple/10 blur-3xl pointer-events-none" />

          <div className="relative flex flex-col gap-3">
            {/* Phase badge — compact */}
            <div className="flex items-center gap-2 text-[10px] text-violet-300 bg-violet-500/10 border border-violet-500/20 rounded-full px-2.5 py-1 self-start">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
              {cs ? 'L2 Bridge · L3 AI · DeFi' : 'L2 Bridge · L3 AI · DeFi'}
            </div>

            {/* Title row */}
            <div className="flex items-center gap-2.5">
              <div className="flex-none w-8 h-8 rounded-lg bg-zion-gold/15 flex items-center justify-center">
                <Rocket className="w-4 h-4 text-zion-gold animate-pulse" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-bold text-white leading-tight">
                  {cs ? 'Odpočet launchu' : 'Launch Countdown'}
                </h2>
                <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                  <Calendar className="w-3 h-3 text-zion-cyan shrink-0" />
                  <span className="truncate">31 Dec 2026</span>
                  <span className="text-zion-gold font-semibold shrink-0">{tMinus}</span>
                </div>
              </div>
            </div>

            {/* Countdown digits — compact row */}
            <div className="flex items-center justify-center gap-1.5">
              {units.map((unit, i) => (
                <motion.div
                  key={unit.label}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4, delay: i * 0.06 }}
                  className="flex flex-col items-center"
                >
                  <div className="w-12 h-12 rounded-lg border border-white/10 bg-white/5 backdrop-blur-md flex items-center justify-center">
                    <span className="text-base font-bold text-gradient tabular-nums">
                      {pad(unit.value)}
                    </span>
                  </div>
                  <span className="text-[8px] uppercase tracking-wider text-gray-500 mt-1">
                    {unit.label}
                  </span>
                </motion.div>
              ))}
            </div>

            {/* Progress bar */}
            <div className="relative">
              <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-zion-gold via-zion-purple to-zion-cyan"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, (29 - time.days) / 29 * 100)}%` }}
                  transition={{ duration: 1.2, ease: 'easeOut' }}
                />
              </div>
              <p className="text-[9px] text-gray-500 mt-1.5 text-center leading-tight">
                {tr('countdown', 'subtitle', lang)}
              </p>
            </div>
          </div>
      </motion.div>
    </Wrap>
  );
}
