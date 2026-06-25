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

export default function MainnetCountdown() {
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
      <section className="py-8 px-4">
        <div className="zion-container">
          <div className="zion-panel-soft zion-panel-hover p-6 min-h-[140px]" />
        </div>
      </section>
    );
  }

  if (isLive) {
    return (
      <section className="py-6 px-4">
        <div className="zion-container">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="zion-rainbow-card relative overflow-hidden backdrop-blur-xl p-6 md:p-8"
            style={{ '--rc': '139, 92, 246' } as React.CSSProperties}
          >
            {/* ambient glow */}
            <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full bg-violet-500/10 blur-3xl pointer-events-none" />

            <div className="relative flex flex-col lg:flex-row items-center justify-between gap-6">
              {/* left: title + date */}
              <div className="flex items-center gap-4">
                <div className="flex-none w-12 h-12 rounded-2xl bg-emerald-500/15 flex items-center justify-center">
                  <Rocket className="w-6 h-6 text-emerald-300 animate-pulse" />
                </div>
                <div>
                  <h2 className="text-xl md:text-2xl font-bold text-white">
                    Mainnet LIVE
                  </h2>
                  <div className="flex items-center gap-2 mt-1 text-sm text-gray-400">
                    <Calendar className="w-4 h-4 text-zion-cyan" />
                    <span>Target: 31 December 2026 (New Year's Eve)</span>
                    <span className="text-emerald-400 font-semibold">GO</span>
                  </div>
                </div>
              </div>

              {/* right: LIVE badge */}
              <div className="flex items-center gap-3">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4 }}
                  className="flex flex-col items-center"
                >
                  <div className="w-20 h-20 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 backdrop-blur-md flex items-center justify-center">
                    <span className="text-2xl md:text-3xl font-bold text-emerald-300 tabular-nums">
                      LIVE
                    </span>
                  </div>
                  <span className="text-[10px] md:text-xs uppercase tracking-wider text-emerald-400 mt-2">
                    Status
                  </span>
                </motion.div>
              </div>
            </div>

            {/* progress bar */}
            <div className="relative mt-6">
              <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-violet-500 to-zion-cyan"
                  initial={{ width: 0 }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 1.2, ease: 'easeOut' }}
                />
              </div>
              <p className="text-[11px] text-gray-500 mt-2 text-center">
                V3 Mainnet is operational · Core + Edge topology · Mining active · Bridge deployed
              </p>
            </div>
          </motion.div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-6 px-4">
      <div className="zion-container">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="zion-rainbow-card relative overflow-hidden backdrop-blur-xl p-6 md:p-8"
          style={{ '--rc': '139, 92, 246' } as React.CSSProperties}
        >
          {/* ambient glow */}
          <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-zion-gold/10 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full bg-zion-purple/10 blur-3xl pointer-events-none" />

          <div className="relative flex flex-col gap-6">
            {/* Top: Current phase banner */}
            <div className="flex flex-col sm:flex-row items-center gap-4 rounded-2xl border border-zion-purple/20 bg-zion-purple/5 px-5 py-3">
              <div className="flex items-center gap-3">
                <div className="flex-none w-10 h-10 rounded-xl bg-zion-purple/15 flex items-center justify-center">
                  <Rocket className="w-5 h-5 text-zion-purple-300" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">{cs ? 'Aktuální fáze: L2, L3 Run' : 'Current Phase: L2, L3 Run'}</h2>
                  <p className="text-xs text-gray-400">{cs ? 'Bridge a DeFi na Base Mainnet, Hiran v2.3 natrénován' : 'Bridge and DeFi on Base Mainnet, Hiran v2.3 trained'}</p>
                </div>
              </div>
              <div className="sm:ml-auto flex items-center gap-2 text-xs text-zion-purple-300 bg-zion-purple/10 border border-zion-purple/20 rounded-full px-3 py-1">
                <span className="w-2 h-2 rounded-full bg-zion-purple-400 animate-pulse" />
                {cs ? 'L2 Bridge Live · L3 AI Ready · DeFi Active' : 'L2 Bridge Live · L3 AI Ready · DeFi Active'}
              </div>
            </div>

            {/* Bottom: countdown to public launch */}
            <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="flex-none w-12 h-12 rounded-2xl bg-zion-gold/15 flex items-center justify-center">
                  <Rocket className="w-6 h-6 text-zion-gold animate-pulse" />
                </div>
                <div>
                  <h2 className="text-xl md:text-2xl font-bold text-white">
                    {cs ? 'Odpočet veřejného launchu' : 'Public Launch Countdown'}
                  </h2>
                  <div className="flex items-center gap-2 mt-1 text-sm text-gray-400">
                    <Calendar className="w-4 h-4 text-zion-cyan" />
                    <span>{tr('countdown', 'target_date', lang)}</span>
                    <span className="text-zion-gold font-semibold">{tMinus}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
                {units.map((unit, i) => (
                  <motion.div
                    key={unit.label}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4, delay: i * 0.08 }}
                    className="flex flex-col items-center"
                  >
                    <div className="w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md flex items-center justify-center">
                      <span className="text-xl sm:text-2xl md:text-3xl font-bold text-gradient tabular-nums">
                        {pad(unit.value)}
                      </span>
                    </div>
                    <span className="text-[10px] md:text-xs uppercase tracking-wider text-gray-500 mt-2">
                      {unit.label}
                    </span>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>

          {/* progress bar */}
          <div className="relative mt-6">
            <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-zion-gold via-zion-purple to-zion-cyan"
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, (29 - time.days) / 29 * 100)}%` }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
              />
            </div>
            <p className="text-[11px] text-gray-500 mt-2 text-center">
              {tr('countdown', 'subtitle', lang)}
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
