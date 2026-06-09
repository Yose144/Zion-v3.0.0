'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { ArrowRight, Leaf, LoaderCircle, Sparkles } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import { tr } from '@/lib/translations';

const TreeOfLifeSwitch = dynamic(() => import('@/components/TreeOfLifeSwitch'), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[420px] items-center justify-center rounded-4xl border border-white/10 bg-black/40 text-gray-400">
      <LoaderCircle className="h-5 w-5 animate-spin text-zion-gold" />
    </div>
  ),
});

export default function HomeTreePortal() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const [revealed, setRevealed] = useState(false);

  return (
    <section id="tree-of-life" className="px-4 py-16 md:py-20 scroll-mt-28">
      <div className="zion-container space-y-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tr('APP_WEB_website_v2_9_src_components_Home', 'interactive_layer', lang)}</p>
            <h2 className="mt-2 text-3xl font-semibold text-white md:text-5xl">{tr('APP_WEB_website_v2_9_src_components_Home', 'tree_of_life', lang)}</h2>
            <p className="mt-3 max-w-2xl text-base text-gray-300 md:text-lg">
              {cs
                ? 'Interaktivní strom se načítá na vyžádání. Domovská stránka tak zůstává rychlá pro každého návštěvníka, zatímco hlubší symbolická vrstva je vzdálená jen jedno kliknutí.'
                : 'The interactive tree loads on demand. This keeps the homepage fast for every visitor while the deeper symbolic layer stays one click away.'}
            </p>
          </div>
          {!revealed && (
            <button
              type="button"
              onClick={() => setRevealed(true)}
              className="inline-flex items-center gap-2 rounded-2xl bg-linear-to-r from-zion-gold via-zion-purple to-zion-cyan px-6 py-3 text-sm font-semibold text-white shadow-[0_0_40px_rgba(147,51,234,0.25)]"
            >
              <Leaf className="h-4 w-4" />
              {tr('APP_WEB_website_v2_9_src_components_Home', 'load_interactive_scene', lang)}
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>

        {!revealed ? (
          <div className="relative overflow-hidden rounded-4xl border border-white/10 bg-[radial-gradient(circle_at_top,rgba(18,25,52,0.75),rgba(3,4,10,0.96)_62%)] p-6 md:p-8">
            <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/30 to-transparent" />
            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.3em] text-gray-300">
                  <Sparkles className="h-4 w-4 text-zion-gold" />
                  {tr('APP_WEB_website_v2_9_src_components_Home', 'performance_safe_preview', lang)}
                </div>
                <p className="text-lg leading-relaxed text-gray-300">
                  {cs
                    ? 'Toto je záměrně odlehčený stav náhledu. Interaktivní Strom života se spustí až po kliknutí, takže první vykreslení neblokují canvas prvky, dynamické scény ani přehnané efekty.'
                    : 'This is an intentionally lightweight preview state. The interactive Tree of Life launches only after clicking, so the first render is not blocked by canvases, dynamic scenes, or excessive effects.'}
                </p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.3em] text-gray-500">{tr('APP_WEB_website_v2_9_src_components_Home', 'mode', lang)}</p>
                    <p className="mt-2 text-lg font-semibold text-white">{tr('APP_WEB_website_v2_9_src_components_Home', 'on_demand', lang)}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.3em] text-gray-500">{tr('APP_WEB_website_v2_9_src_components_Home', 'goal', lang)}</p>
                    <p className="mt-2 text-lg font-semibold text-white">{tr('APP_WEB_website_v2_9_src_components_Home', 'fast_first_paint', lang)}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.3em] text-gray-500">{tr('APP_WEB_website_v2_9_src_components_Home', 'fallback', lang)}</p>
                    <p className="mt-2 text-lg font-semibold text-white">{tr('APP_WEB_website_v2_9_src_components_Home', 'classic_query_ready', lang)}</p>
                  </div>
                </div>
              </div>

              <div className="relative mx-auto flex aspect-4/3 w-full max-w-xl items-center justify-center overflow-hidden rounded-[28px] border border-emerald-300/15 bg-[radial-gradient(circle_at_50%_20%,rgba(88,221,172,0.22),rgba(10,12,24,0.04)_28%,rgba(1,3,6,0.98)_74%)]">
                <div className="absolute inset-y-10 left-1/2 w-px -translate-x-1/2 bg-linear-to-b from-emerald-300/0 via-emerald-300/40 to-emerald-300/0" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_15%,rgba(251,191,36,0.12),transparent_32%)]" />
                <div className="absolute top-[18%] left-1/2 h-10 w-10 -translate-x-1/2 rounded-full border border-zion-gold/40 bg-zion-gold/15" />
                <div className="absolute top-[34%] left-[38%] h-8 w-8 rounded-full border border-emerald-300/30 bg-emerald-300/10" />
                <div className="absolute top-[34%] right-[38%] h-8 w-8 rounded-full border border-emerald-300/30 bg-emerald-300/10" />
                <div className="absolute top-[50%] left-[30%] h-8 w-8 rounded-full border border-cyan-300/30 bg-cyan-300/10" />
                <div className="absolute top-[50%] right-[30%] h-8 w-8 rounded-full border border-cyan-300/30 bg-cyan-300/10" />
                <div className="absolute bottom-[16%] left-1/2 h-9 w-9 -translate-x-1/2 rounded-full border border-violet-300/35 bg-violet-300/10" />
                <div className="absolute bottom-[10%] left-[40%] h-7 w-7 rounded-full border border-zion-gold/25 bg-zion-gold/10" />
                <div className="absolute bottom-[10%] right-[40%] h-7 w-7 rounded-full border border-zion-gold/25 bg-zion-gold/10" />
              </div>
            </div>
          </div>
        ) : (
          <TreeOfLifeSwitch />
        )}
      </div>
    </section>
  );
}
