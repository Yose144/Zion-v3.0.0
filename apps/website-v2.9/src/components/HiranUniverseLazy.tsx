'use client';

import { memo, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import clsx from 'clsx';

const HiranUniverse = dynamic(() => import('./HiranUniverse'), { ssr: false });

function isWebGLAvailable() {
  if (typeof window === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
  } catch {
    return false;
  }
}

/**
 * Statický náhled scény — Mléčná dráha + zlatý orb jako CSS, bez WebGL.
 * Ukazuje se pro no-WebGL / reduced-motion / save-data a jako poster
 * než se stáhne three.js.
 */
function HiranUniverseFallback({ className = '' }: { className?: string }) {
  return (
    <div
      className={clsx('relative h-full w-full overflow-hidden bg-[#040308]', className)}
      aria-hidden="true"
    >
      {/* Mléčná dráha jako pozadí */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-70"
        style={{ backgroundImage: 'url(/textures/milkyway-eso-4k.jpg)', backgroundPosition: 'center 30%' }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(60rem_30rem_at_50%_-10rem,rgba(252,209,22,0.06),transparent_60%),linear-gradient(180deg,rgba(0,0,0,0.35),rgba(0,0,0,0.72))]" />
      {/* zlatý orb */}
      <div className="absolute left-1/2 top-[38%] h-40 w-40 -translate-x-1/2 -translate-y-1/2 sm:h-48 sm:w-48">
        <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_34%_28%,#fffbeb_0%,#fde68a_8%,#fbbf24_22%,#f59e0b_45%,#d97706_68%,#78350f_88%,#1c0a02_100%)] shadow-[0_0_90px_30px_rgba(251,191,36,0.28)]" />
        <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(252,209,22,0.35),transparent_65%)] blur-xl" />
      </div>
      {/* jemné hvězdy */}
      <div className="absolute inset-0 opacity-60 [background-image:radial-gradient(1px_1px_at_20%_30%,rgba(255,240,200,0.9),transparent),radial-gradient(1px_1px_at_70%_15%,rgba(255,240,200,0.7),transparent),radial-gradient(1.5px_1.5px_at_85%_60%,rgba(255,220,150,0.8),transparent),radial-gradient(1px_1px_at_40%_80%,rgba(255,240,200,0.6),transparent),radial-gradient(1px_1px_at_10%_70%,rgba(255,220,150,0.7),transparent)]" />
    </div>
  );
}

/**
 * Lazy wrapper pro HiranUniverse — živá WebGL scéna jen když to jde:
 * WebGL + ne reduced-motion + ne save-data + 700 ms prodleva (stejně jako
 * HiranOrbLazy). Jinak statický náhled s Mléčnou dráhou a zlatým orbem.
 */
function HiranUniverseLazy({ className = '', active = true }: { className?: string; active?: boolean }) {
  const [webglOk, setWebglOk] = useState<boolean | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [enhanced, setEnhanced] = useState(false);

  useEffect(() => {
    setWebglOk(isWebGLAvailable());
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setBlocked(reduceMotion || !!connection?.saveData);
  }, []);

  useEffect(() => {
    if (!webglOk || blocked) return;
    const timer = window.setTimeout(() => setEnhanced(true), 700);
    return () => window.clearTimeout(timer);
  }, [blocked, webglOk]);

  if (webglOk === null || !webglOk || blocked || !enhanced) {
    return <HiranUniverseFallback className={className} />;
  }

  return <HiranUniverse className={className} active={active} />;
}

export default memo(HiranUniverseLazy);
