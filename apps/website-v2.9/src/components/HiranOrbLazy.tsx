'use client';

import { memo, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import GoldenOrb from './GoldenOrb';

const HiranOrb = dynamic(() => import('./HiranOrb'), { ssr: false });

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
 * Lazy wrapper: živá WebGL koule (HiranOrb) kde to jde,
 * jinak statický CSS GoldenOrb — no WebGL / reduced-motion / save-data.
 * Vzor HolographicEarthLazy.
 */
function HiranOrbLazy({ className = '' }: { className?: string }) {
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
    return <GoldenOrb className={className} />;
  }

  return <HiranOrb className={className} />;
}

export default memo(HiranOrbLazy);
