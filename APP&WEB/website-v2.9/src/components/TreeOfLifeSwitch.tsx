'use client';

import { Component, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import InteractiveTreeOfLife from '@/components/InteractiveTreeOfLife';

function SplineFallbackScene() {
  return (
    <section className="relative py-10 md:py-16 px-4 overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(to bottom, #08081a 0%, #0c0c28 35%, #15122a 60%, #0b0908 100%)',
        }}
      />
      <div className="zion-container relative z-10">
        <div className="text-center mb-7 md:mb-10">
          <p className="text-[10px] uppercase tracking-[0.6em] mb-3 font-light" style={{ color: 'rgba(249,217,118,0.42)' }}>
            The Eternal Network · 3D Experience
          </p>
          <h2 className="text-3xl md:text-5xl lg:text-6xl font-bold text-white mb-4">
            Tree of{' '}
            <span className="bg-linear-to-r from-zion-gold via-zion-gold to-yellow-200 bg-clip-text text-transparent">
              Life
            </span>
          </h2>
        </div>
        <div className="relative mx-auto max-w-5xl zion-rainbow-card shadow-[0_20px_80px_rgba(0,0,0,0.45)] overflow-hidden" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
          <div className="aspect-16/10 min-h-[420px] md:min-h-[560px] w-full flex items-center justify-center">
            <div className="text-center px-8">
              <div className="mx-auto mb-5 h-20 w-20 rounded-full border border-zion-gold/30 flex items-center justify-center animate-pulse">
                <span className="text-3xl">✦</span>
              </div>
              <p className="text-amber-100/85 text-sm md:text-base font-light tracking-wide">Preparing cinematic 3D scene...</p>
              <p className="text-gray-400 text-xs mt-2">Classic mode: add ?tree=classic</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const SplineTreeOfLife = dynamic(() => import('@/components/SplineTreeOfLife'), {
  ssr: false,
  loading: () => <SplineFallbackScene />,
});

class TreeErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('TreeOfLife Spline failed, fallback to stable tree:', error);
  }

  render() {
    if (this.state.hasError) {
      return <SplineFallbackScene />;
    }
    return this.props.children;
  }
}

export default function TreeOfLifeSwitch() {
  const searchParams = useSearchParams();
  const treeParam = searchParams.get('tree');
  const useSpline = !(treeParam === 'classic' || treeParam === 'old');

  if (!useSpline) {
    return <InteractiveTreeOfLife />;
  }

  return (
    <TreeErrorBoundary>
      <SplineTreeOfLife />
    </TreeErrorBoundary>
  );
}
