'use client';

import { useEffect, useRef, useState, type ComponentType } from 'react';
import dynamic from 'next/dynamic';
import { useLang } from '@/contexts/LanguageContext';

const WebTerminal = dynamic(() => import('@/components/WebTerminal'), { ssr: false });
const LiveDashboard = dynamic(() => import('@/components/LiveDashboard'), { ssr: false });
const GoldenEggHaraniagharba = dynamic(() => import('@/components/GoldenEggHaraniagharba'), {
  ssr: false,
});

type Kind = 'terminal' | 'dashboard' | 'hiran';

const KIND_COMPONENT: Record<Kind, ComponentType> = {
  terminal: () => <WebTerminal />,
  dashboard: () => <LiveDashboard />,
  hiran: () => <GoldenEggHaraniagharba />,
};

const Copy = {
  terminal: { cs: 'Terminál', en: 'Terminal' },
  dashboard: { cs: 'Živý dashboard', en: 'Live dashboard' },
  hiran: { cs: 'Hiranyagarbha', en: 'Hiranyagarbha' },
  load: { cs: 'Načíst' as const, en: 'Load' as const },
};

/** Reserved heights keep layout stable until the real widget mounts. */
const MIN_HEIGHT: Record<Kind, string> = {
  terminal: 'min-h-[100px]',
  dashboard: 'min-h-[600px] lg:min-h-[400px]',
  hiran: 'min-h-[400px]',
};

/**
 * Interactive home islands mount only when scrolled near (400px) — their API
 * polling / heavy chunks never start at initial page top. Falls back to a
 * manual load affordance when IntersectionObserver is unavailable.
 */
export default function HomeInteractiveSection({ kind }: { kind: Kind }) {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setNear(true);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: '400px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const Widget = KIND_COMPONENT[kind];
  return (
    <div ref={ref} className={MIN_HEIGHT[kind]}>
      {near ? (
        <Widget />
      ) : (
        <div className={`flex w-full items-center justify-center ${MIN_HEIGHT[kind]}`}>
          <div className="zion-container w-full">
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-8 text-center">
              <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-gray-300">
                {Copy[kind][cs ? 'cs' : 'en']}
              </h3>
              <noscript>
                <p className="text-xs text-gray-500">
                  {cs ? 'Interaktivní widget vyžaduje JavaScript.' : 'The interactive widget requires JavaScript.'}
                </p>
              </noscript>
              <button
                type="button"
                onClick={() => setNear(true)}
                className="rounded-full border border-white/15 px-4 py-1.5 text-xs font-semibold text-gray-400 transition-colors hover:border-zion-gold/30 hover:text-zion-gold"
              >
                {Copy.load[cs ? 'cs' : 'en']}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
