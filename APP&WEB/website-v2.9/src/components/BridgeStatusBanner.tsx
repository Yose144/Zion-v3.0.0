'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Lock, Shield, Activity, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLang } from '@/contexts/LanguageContext';

interface BridgeStatus {
  online: boolean;
  locked_total?: string;
  minted_total?: string;
  validator_threshold?: string;
  l1_height?: number;
  uptime_seconds?: number;
}

export default function BridgeStatusBanner() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const [status, setStatus] = useState<BridgeStatus | null>(null);

  useEffect(() => {
    fetch('/api/bridge/status', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => setStatus(d))
      .catch(() => {});
  }, []);

  const online = status?.online ?? false;
  const locked = status?.locked_total ?? '100,000,000';
  const threshold = status?.validator_threshold ?? '5/5';

  return (
    <section className="relative px-4 -mt-2 pb-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="zion-container"
      >
        <Link
          href="/bridge"
          className="group relative block overflow-hidden rounded-3xl border border-emerald-500/20 bg-gradient-to-r from-emerald-500/8 via-teal-500/4 to-transparent p-5 md:p-6 transition-all hover:border-emerald-500/40 hover:shadow-[0_18px_60px_rgba(16,185,129,0.15)]"
        >
          {/* Glow accent */}
          <div className="absolute -top-px left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent" />

          <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
            {/* Status indicator */}
            <div className="flex items-center gap-3 shrink-0">
              <div className={`relative flex h-12 w-12 items-center justify-center rounded-2xl border ${online ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-gray-500/30 bg-gray-500/5'}`}>
                <Activity className={`h-6 w-6 ${online ? 'text-emerald-400' : 'text-gray-400'}`} />
                {online && (
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
                  </span>
                )}
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500">
                  {cs ? 'Bridge Status' : 'Bridge Status'}
                </p>
                <p className={`text-sm font-bold ${online ? 'text-emerald-300' : 'text-gray-400'}`}>
                  {online ? (cs ? 'Online · Relay aktivní' : 'Online · Relay active') : (cs ? 'Offline' : 'Offline')}
                </p>
              </div>
            </div>

            {/* Stats */}
            <div className="flex flex-1 flex-wrap gap-4 md:gap-8">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-zion-gold shrink-0" />
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-gray-500">{cs ? 'Zamčeno' : 'Locked'}</p>
                  <p className="text-sm font-bold text-white tabular-nums">{locked} ZION</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-zion-cyan shrink-0" />
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-gray-500">{cs ? 'Validátory' : 'Validators'}</p>
                  <p className="text-sm font-bold text-white tabular-nums">{threshold}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-emerald-400 shrink-0" />
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-gray-500">{cs ? 'Síť' : 'Network'}</p>
                  <p className="text-sm font-bold text-white">Base Mainnet</p>
                </div>
              </div>
            </div>

            {/* CTA */}
            <div className="flex items-center gap-2 text-emerald-300 group-hover:gap-3 transition-all shrink-0">
              <span className="text-sm font-semibold">
                {cs ? 'Otevřít Bridge' : 'Open Bridge'}
              </span>
              <ArrowRight className="h-4 w-4" />
            </div>
          </div>
        </Link>
      </motion.div>
    </section>
  );
}
